// Shared types for the run-checks Edge Function

export interface Monitor {
  id: string
  project_id: string
  name: string
  url: string
  check_interval_minutes: number
  status: 'up' | 'down' | 'unmonitored' | 'paused'
  is_active: boolean
  last_checked_at: string | null
  next_check_at: string | null
}

export interface CheckResult {
  monitor_id: string
  is_up: boolean
  status_code: number | null
  response_time_ms: number | null
  error_message: string | null
}

export interface CheckOutcome extends CheckResult {
  monitor: Monitor
  previousStatus: 'up' | 'down' | 'unmonitored' | 'paused'
  stateChanged: boolean
}

