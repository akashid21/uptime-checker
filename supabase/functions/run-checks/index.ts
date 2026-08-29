/**
 * PulseCheck — run-checks Edge Function
 *
 * Triggered every minute by pg_cron via net.http_post.
 * Queries all active monitors that are due for a check,
 * performs parallel HTTP checks with retry logic,
 * manages incident lifecycle (open/close), and writes
 * an execution report to audit_logs.
 *
 * Retry logic:
 *   - Single check failure → retry up to 2 more times with a 2-second gap
 *   - Only mark DOWN if all 3 attempts fail (avoids false positives from transient blips)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import type { Monitor, CheckResult, CheckOutcome } from './types.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CHECK_TIMEOUT_MS = 10_000   // 10 seconds per HTTP request
const RETRY_ATTEMPTS   = 3        // total attempts (1 initial + 2 retries)
const RETRY_DELAY_MS   = 2_000    // 2 seconds between retries
const BATCH_SIZE       = 20       // max concurrent checks per invocation

// ─────────────────────────────────────────────────────────────────────────────
// Helper: delay
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: single HTTP ping attempt with timeout
// ─────────────────────────────────────────────────────────────────────────────

async function pingOnce(url: string): Promise<{
  is_up: boolean
  status_code: number | null
  response_time_ms: number
  error_message: string | null
}> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

  const startedAt = Date.now()

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'PulseCheck-Monitor/1.0' },
      redirect: 'follow',
    })

    const response_time_ms = Date.now() - startedAt
    const is_up = res.status >= 200 && res.status < 400

    return {
      is_up,
      status_code: res.status,
      response_time_ms,
      error_message: is_up ? null : `HTTP ${res.status} ${res.statusText}`,
    }
  } catch (err: unknown) {
    const response_time_ms = Date.now() - startedAt
    const message = err instanceof Error ? err.message : String(err)
    const isTimeout = message.includes('aborted') || message.includes('timeout')

    return {
      is_up: false,
      status_code: null,
      response_time_ms,
      error_message: isTimeout ? 'Request timed out after 10s' : message,
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: ping with retry (up to RETRY_ATTEMPTS total)
// ─────────────────────────────────────────────────────────────────────────────

async function pingWithRetry(monitor: Monitor): Promise<CheckResult> {
  let lastResult = await pingOnce(monitor.url)

  for (let attempt = 1; attempt < RETRY_ATTEMPTS; attempt++) {
    if (lastResult.is_up) break          // short-circuit on success
    await sleep(RETRY_DELAY_MS)
    lastResult = await pingOnce(monitor.url)
  }

  return {
    monitor_id: monitor.id,
    is_up: lastResult.is_up,
    status_code: lastResult.status_code,
    response_time_ms: lastResult.response_time_ms,
    error_message: lastResult.error_message,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const executionStart = Date.now()
  const runAt = new Date().toISOString()

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Use service-role key to bypass Row Level Security for system operations
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── 1. Fetch due monitors ──────────────────────────────────────────────────
  const { data: dueMonitors, error: fetchError } = await supabase
    .from('monitors')
    .select('*')
    .eq('is_active', true)
    .lte('next_check_at', runAt)
    .limit(BATCH_SIZE)

  if (fetchError) {
    console.error('Failed to fetch monitors:', fetchError.message)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch monitors', detail: fetchError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const monitors: Monitor[] = dueMonitors ?? []

  if (monitors.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: 'No monitors due for checking', ran_at: runAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  console.log(`[run-checks] Processing ${monitors.length} monitors...`)

  // ── 2. Run checks in parallel ──────────────────────────────────────────────
  const checkResults = await Promise.all(monitors.map(pingWithRetry))

  // ── 3. Enrich results with previous state & detect transitions ────────────
  const outcomes: CheckOutcome[] = checkResults.map((result) => {
    const monitor = monitors.find((m) => m.id === result.monitor_id)!
    const previousStatus = monitor.status as Monitor['status']
    const currentIsUp = result.is_up
    const wasUp = previousStatus === 'up'
    const wasDown = previousStatus === 'down'
    const wasUnknown = previousStatus === 'unmonitored'

    const stateChanged = (wasUp && !currentIsUp) ||
                         (wasDown && currentIsUp) ||
                         (wasUnknown)

    return { ...result, monitor, previousStatus, stateChanged }
  })

  // ── 4. Write check results in bulk ────────────────────────────────────────
  const checksToInsert = outcomes.map(({ monitor_id, is_up, status_code, response_time_ms, error_message }) => ({
    monitor_id,
    is_up,
    status_code,
    response_time_ms,
    error_message,
    created_at: new Date().toISOString(),
  }))

  const { error: checksInsertError } = await supabase.from('checks').insert(checksToInsert)
  if (checksInsertError) {
    console.error('Failed to insert checks:', checksInsertError.message)
  }

  // ── 5. Manage incidents & update monitor status ───────────────────────────
  const incidentErrors: string[] = []
  const newDownMonitors: string[] = []
  const recoveredMonitors: string[] = []

  for (const outcome of outcomes) {
    const { monitor, is_up, stateChanged, previousStatus } = outcome
    const newStatus = is_up ? 'up' : 'down'
    const nextCheckAt = new Date(Date.now() + monitor.check_interval_minutes * 60 * 1000).toISOString()

    // Update monitor: status + last_checked_at + next_check_at
    const { error: updateError } = await supabase
      .from('monitors')
      .update({
        status: newStatus,
        last_checked_at: new Date().toISOString(),
        next_check_at: nextCheckAt,
      })
      .eq('id', monitor.id)

    if (updateError) {
      incidentErrors.push(`Monitor update failed for ${monitor.id}: ${updateError.message}`)
      continue
    }

    if (!stateChanged) continue

    if (!is_up && previousStatus !== 'down') {
      // ── Monitor just went DOWN → open a new incident ─────────────────────
      const { error: incidentError } = await supabase.from('incidents').insert({
        monitor_id: monitor.id,
        start_time: new Date().toISOString(),
      })

      if (incidentError) {
        incidentErrors.push(`Failed to open incident for ${monitor.name}: ${incidentError.message}`)
      } else {
        newDownMonitors.push(monitor.name)
        console.log(`⚠ INCIDENT OPENED: ${monitor.name} (${monitor.url}) went DOWN`)
      }
    } else if (is_up && previousStatus === 'down') {
      // ── Monitor just RECOVERED → close the open incident ─────────────────
      const { data: openIncident } = await supabase
        .from('incidents')
        .select('id, start_time')
        .eq('monitor_id', monitor.id)
        .is('end_time', null)
        .order('start_time', { ascending: false })
        .limit(1)
        .single()

      if (openIncident) {
        const startTime   = new Date(openIncident.start_time).getTime()
        const endTime     = Date.now()
        const durationMin = Math.round((endTime - startTime) / 60_000)

        const { error: closeError } = await supabase
          .from('incidents')
          .update({
            end_time:         new Date(endTime).toISOString(),
            duration_minutes: durationMin,
            resolution_reason: `Monitor recovered after ${durationMin} minute(s) of downtime`,
          })
          .eq('id', openIncident.id)

        if (closeError) {
          incidentErrors.push(`Failed to close incident for ${monitor.name}: ${closeError.message}`)
        } else {
          recoveredMonitors.push(monitor.name)
          console.log(`✓ INCIDENT RESOLVED: ${monitor.name} recovered after ${durationMin}m`)
        }
      }
    }
  }

  // ── 6. Write audit log entry ───────────────────────────────────────────────
  const durationMs   = Date.now() - executionStart
  const successCount = outcomes.filter((o) => o.is_up).length
  const failCount    = outcomes.filter((o) => !o.is_up).length

  const auditDetails = {
    ran_at:             runAt,
    duration_ms:        durationMs,
    monitors_processed: monitors.length,
    success_count:      successCount,
    fail_count:         failCount,
    new_incidents:      newDownMonitors,
    resolved_incidents: recoveredMonitors,
    errors:             incidentErrors,
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    actor:   'system/background-worker',
    action:  'execute_checks',
    details: auditDetails,
  })

  if (auditError) {
    console.error('Failed to write audit log:', auditError.message)
  }

  console.log(`[run-checks] Done in ${durationMs}ms — ${successCount} up / ${failCount} down`)

  return new Response(
    JSON.stringify({
      ok:            true,
      ...auditDetails,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})

