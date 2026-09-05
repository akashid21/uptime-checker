# Implementation Plan: UptimeBoard Uptime Tracker

This document details the implementation plan and development roadmap for **UptimeBoard**, incorporating the latest design and architectural decisions.

## Selected Architecture

### 1. Authentication
*   **Provider:** **Supabase Auth**
*   **Rationale:** Fully managed, highly secure, integrates natively with Supabase Postgres via Row Level Security (RLS) policies, and provides a generous free tier (up to 50,000 monthly active users).

### 2. Background Worker & Scheduler
*   **Solution:** **Supabase Edge Functions** + **pg_cron**
*   **How it Works:**
    *   A Postgres extension `pg_cron` (enabled inside Supabase) runs a scheduled trigger every 1 minute.
    *   The cron job calls a Supabase Edge Function `/v1/uptimeboard-run-checks` over HTTP, passing the service role key for authentication.
    *   The `/v1/uptimeboard-run-checks` Edge Function queries the database for all active monitors that are due for a check, performs the HTTP checks concurrently (using `Promise.all` with a small batch limit if necessary), and saves results.
*   **Rationale:**
    *   **100% Free & Scalable:** Supabase free tier offers 500,000 Edge Function invocations per month. By batching due checks inside a single invocation triggered every minute, we only consume ~43,200 invocations per month (well within the free limit).
    *   **Audit Logging:** All background runs write detailed execution reports to an `audit_logs` database table (tracking execution time, duration, checks triggered, failures, and errors). Deno console logs are also retained in Supabase.

---

## Proposed PRD Updates

We will update [uptime-tracker-prd.md](file:///Users/abhijeetkashid/uptime-tracker/uptime-tracker-prd.md) as follows:
1.  **Section 5 (Core Features - MVP):** Under "Projects / Monitor Grouping", explicitly codify the free tier limits (2 projects per account, 5 monitors per project) and mandate showing a clear alert modal or validation warning to the user upon reaching the limit.
2.  **Section 7 (Suggested Architecture):** Declare **Supabase Auth** as the chosen Auth solution and **Supabase Edge Functions + pg_cron** as the background worker solution. Detail the database-backed audit logging structure.
3.  **Section 9 (Differentiation / USP):** Explicitly move "AI-assisted incident diagnosis", "Developer-first, API/webhook-first", and "Uptime history as a shareable artifact / status pages" to Phase 2 (Nice-to-Have/Post-MVP), keeping Phase 1 highly focused on core uptime monitoring.
4.  **Section 11 (Open Questions):** Mark Auth, Free-Tier Limits, and Background Worker decisions as **Decided**.

---

## Sub-Phase Wise Roadmap (Tickets)

### Phase 1: Core Foundation & Auth (MVP)

#### Ticket 1.1: Supabase Setup & Database Schema
*   Initialize the Supabase project and execute the migrations to set up the following schema:
    *   `profiles` (id references auth.users, full_name, created_at)
    *   `projects` (id, name, owner_id references profiles, created_at, updated_at)
    *   `monitors` (id, project_id references projects, name, url, check_interval_minutes, type, status, is_active, last_checked_at, next_check_at, created_at, updated_at)
    *   `checks` (id, monitor_id references monitors, status_code, response_time_ms, is_up, error_message, created_at)
    *   `incidents` (id, monitor_id references monitors, start_time, end_time, duration_minutes, resolution_reason, created_at)
    *   `audit_logs` (id, actor, action, details, created_at)
*   Configure RLS (Row Level Security) policies so users can only access their own profile, projects, monitors, checks, and incidents.

#### Ticket 1.2: Supabase Auth Integration
*   Integrate `@supabase/ssr` into the Next.js app.
*   Implement sign-up, sign-in, and sign-out UI views.
*   Create Next.js middleware to protect all routes under `/dashboard/*` and redirect unauthenticated users to `/login`.

#### Ticket 1.3: Projects & Monitors CRUD with Free-Tier Limits
*   Create REST/GraphQL endpoints or Supabase client operations for CRUD actions on projects and monitors.
*   Implement the UI for creating projects and monitors.
*   **Enforce Limits & Warnings:**
    *   *Projects Check:* When a user attempts to create a project, query their existing project count. If count >= 2, abort the operation and render an alert dialog: `"Free tier limit reached: You can create a maximum of 2 projects. Upgrade to add more."`
    *   *Monitors Check:* When a user attempts to create a monitor, query the monitor count for the target project. If count >= 5, abort the operation and render an alert dialog: `"Free tier limit reached: You can create a maximum of 5 monitors per project. Upgrade to add more."`
*   Add frontend validations to block the form submission and show a inline banner/warning message.

---

### Phase 2: Background Checker & Audit Logging

#### Ticket 2.1: Supabase Edge Function Checker (`uptimeboard-run-checks`)
*   Develop a Deno-based Supabase Edge Function `/v1/uptimeboard-run-checks`.
*   The function will:
    1. Query all active monitors where `next_check_at <= now()`.
    2. Perform parallel ping checks using `fetch` with a timeout of 10 seconds.
    3. Implement retry logic: if a ping fails, retry twice with a 2-second delay before registering a state transition (from UP to DOWN).
    4. Save check results to the `checks` table.
    5. Handle incidents:
        *   If monitor was UP and is now DOWN: Create a new row in `incidents` with `start_time = now()`. Update monitor status to `DOWN`.
        *   If monitor was DOWN and is now UP: Update the existing open incident row (set `end_time = now()`, calculate `duration_minutes`). Update monitor status to `UP`.
    6. Calculate the next execution time based on `check_interval_minutes` and update `next_check_at`.

#### Ticket 2.2: pg_cron Scheduling Setup
*   Enable the `pg_cron` extension in the Supabase database.
*   Configure a recurring cron job that ticks every minute to POST to `/v1/uptimeboard-run-checks`:
    ```sql
    SELECT cron.schedule(
      'uptimeboard-scheduler',
      '* * * * *',
      $$
      SELECT net.http_post(
        'https://<project-id>.supabase.co/functions/v1/uptimeboard-run-checks',
        '{}',
        '{"Authorization": "Bearer <SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb
      );
      $$
    );
    ```

#### Ticket 2.3: Audit Logging for Worker Executions
*   Extend `/v1/uptimeboard-run-checks` to write an entry to `audit_logs` at the end of each run.
*   Log structure:
    *   `actor`: `'system/background-worker'`
    *   `action`: `'execute_checks'`
    *   `details`: JSON containing execution time, duration in milliseconds, count of monitors processed, count of successes, list of detected failures, and errors.
*   Create a simple admin or user-facing "System Logs" tab in the dashboard showing the background worker status history.

---

### Phase 3: Core Dashboard & Email Alerts (MVP Launch)

#### Ticket 3.1: Clean Dashboard UI
*   Create the main dashboard page summarizing overall status (e.g., "All Systems Operational" vs "1 System Down").
*   Show daily uptime grid graphs (30-day block grids similar to GitHub contributions) indicating daily success rates.
*   Render incident timelines showing recent downtime periods, durations, and status codes.
*   **Automatic Status Updates:** Refresh the dashboard data automatically while the page is open so users do not need to reload the browser manually.
    *   Start with a client-side polling interval of 30–60 seconds that calls `router.refresh()` and retrieves the latest monitor status from the server.
    *   Pause polling when the browser tab is hidden and resume when it becomes visible.
    *   Show a subtle last-updated timestamp or refresh state, and avoid replacing local form state while a user is editing a monitor.
    *   Evaluate Supabase Realtime subscriptions as a later optimization if polling creates unnecessary database reads or faster updates are required.
    *   Define the expected delay from a worker status change to the dashboard display, including the scheduler interval and polling interval.

*   **Acceptance Criteria:**
    *   A monitor status change from the Edge Function appears on an open dashboard without a manual browser refresh.
    *   The dashboard does not poll while its browser tab is hidden.
    *   Polling errors do not break the dashboard and are retried on the next interval.
    *   The polling mechanism is cleaned up when the dashboard component is unmounted.

#### Ticket 3.2: Basic Email Notifications
*   Integrate email delivery on incident status changes (UP to DOWN / DOWN to UP).
*   Use Resend or Supabase's built-in SMTP service to dispatch alerts.
*   Ensure deduplication: only alert when an incident starts or ends, never on intermediate checks.

#### Dashboard History Data Integrity — Root Cause and Required Solution
*   **Root cause identified:** the reliability grid currently loads raw rows from `checks` for all monitors, orders them newest-first, and does not paginate the Supabase query. Supabase's API response limit is 1,000 rows by default. A monitor checking every minute can produce more than 1,000 rows in a few days, so older days are silently omitted from the response and appear as `No data` even though checks exist.
*   The current grid recomputes each block in the browser from `checks.created_at`. It does not consume the daily aggregate fields (`check_date`, `total_checks`, `successful_checks`, `failed_checks`, and `uptime_percentage`), so the block display depends on the incomplete raw-check response.
*   **Required solution:** create and maintain one `daily_stats` row per monitor and calendar day, and use those rows for the 30-day reliability grid. The result must include `monitor_id`; an aggregate without monitor identity cannot populate per-monitor rows.
*   Raw checks may continue to be used for current-day operational details, but the grid must use a SQL/RPC aggregate or an incrementally upserted `daily_stats` row for the current day rather than downloading all current-day checks.
*   Daily boundaries must use one explicit timezone consistently in aggregation and display. Use UTC for the initial implementation, or persist the configured user timezone when user-local reporting is introduced; do not compare UTC database dates with browser-local midnight boundaries implicitly.
*   Raw-check retention must happen only after the corresponding daily rollup succeeds and is verified. Otherwise, pruning can permanently remove history required by the 30-day grid.

---

### Phase 3.5: `checks` Table Scalability & Retention

*Context: at 1-min check intervals, a single maxed-out free-tier account (5 projects × 10 monitors) generates up to ~72,000 raw check rows/day. Raw data is meant to be capped at a 7-day retention window per the PRD (Section 7), but the write path and pruning strategy need to be explicit before this is running unattended in prod.*

#### Ticket 3.3: Partition the `checks` Table by Day
*   Convert `checks` to a native Postgres **declarative partitioned table**, partitioned by day (or week) on `created_at`.
*   Write a migration to backfill/convert existing data into the new partitioned structure.
*   Auto-create upcoming partitions ahead of time (e.g., via a scheduled job or `pg_partman`) so `run-checks` never fails due to a missing partition.
*   **Rationale:** enables retention pruning via partition drop (near-instant, no table bloat/vacuum pressure) instead of row-by-row `DELETE`, which degrades as data grows.
#### Ticket 3.4: Batch Inserts in the `run-checks` Edge Function
*   Update `/v1/run-checks` (Ticket 2.1) so all check results from a single invocation are written via one batched multi-row `INSERT`, not one `INSERT` per monitor.
*   Add a test asserting a single DB round-trip per invocation regardless of monitor count (within Supabase's payload/row limits — chunk if needed for very large batches).
*   **Rationale:** avoids unnecessary connection/round-trip overhead at scale (up to 14,400 individual inserts/day per project otherwise).
#### Ticket 3.5: Retention Pruning Job & Rollup Monitoring
*   Add a scheduled job (same pg_cron pattern as the checker) that drops/detaches `checks` partitions older than 7 days.
*   Extend the `audit_logs` entries (Ticket 2.3) or the "System Logs" tab to surface:
    *   Whether the `daily_stats` aggregation job ran successfully and how far behind (if at all) it is.
    *   Whether the retention pruning job ran successfully and which partitions were dropped.
*   Add alerting (even just a dashboard warning banner) if the rollup job falls behind, since raw data loss without a completed rollup would silently lose long-term history.
*   **Acceptance Criteria:**
    *   A partition older than 7 days is dropped automatically within 24 hours of expiring.
    *   If the `daily_stats` rollup fails for a given day, this is visible in System Logs before the corresponding raw partition is pruned.

#### Ticket 3.6: Daily Stats Rollups and Dashboard History
*   Create a `daily_stats` table with a unique constraint on `(monitor_id, check_date)` and fields sufficient for current and planned reporting:
    *   `monitor_id`, `check_date`, `total_checks`, `successful_checks`, `failed_checks`
    *   `uptime_percentage`, `average_response_time_ms`, `min_response_time_ms`, `max_response_time_ms`
    *   `total_downtime_minutes`, `incident_count`, `created_at`, and `updated_at`
*   Backfill `daily_stats` from existing `checks` before enabling retention pruning.
*   Implement an idempotent daily aggregation/upsert job. It must aggregate by `monitor_id` and the selected timezone, so reruns produce the same result and late-arriving checks are included.
*   Ensure the previous day's rollup is complete and verified before its raw `checks` partition is dropped. Keep the current day's raw checks available for live status and operational views.
*   Update the dashboard reliability grid to read one daily record per monitor/day from `daily_stats`. For the current day, either read an incrementally maintained `daily_stats` row or call a server-side aggregate over today's checks; never rely on a client-side fetch of the full raw-check list.
*   Remove the unpaginated 30-day raw-check query from the grid data path. If raw checks are needed elsewhere, use pagination or bounded queries explicitly.
*   Return empty daily slots as `No data`, and distinguish them from a recorded day with 0% uptime.
*   **Acceptance Criteria:**
    *   A monitor with checks on six consecutive days displays six populated blocks, regardless of whether the raw checks exceed 1,000 rows.
    *   A 30-day grid remains correct after raw checks older than seven days are pruned.
    *   Each monitor's row uses only that monitor's daily stats.
    *   The current-day block updates after the existing dashboard polling interval without loading all current-day raw checks.
    *   Rollup reruns are safe and do not duplicate or double-count daily statistics.
---

### Phase 4: Deferred Features (Post-MVP)

#### Ticket 4.1: API & Webhooks
*   Provide users with API Key Generation in their settings.
*   Expose public endpoints for programmatic monitor creation and retrieval.
*   Allow custom webhook endpoints for instant Slack/Discord/custom alerts when state shifts.

#### Ticket 4.2: AI-Assisted Incident Diagnosis
*   On monitor failure, capture response headers and the first 1KB of the response body.
*   Trigger an edge function to analyze this payload using the Gemini API.
*   Save the plain-English diagnosis (e.g., "Database connection timeout detected in server response") to the incident row.

#### Ticket 4.3: Shareable Artifacts (Status Pages & Badges)
*   Implement public status page URLs that allow users to share their uptime history publicly.
*   Generate embeddable SVG badges indicating status (e.g., `Uptime: 99.9%`).

---

## Verification Plan

### Automated Tests
- Write Jest / Vitest unit tests for the free tier limit check helper functions.
- Run tests: `npm run test`

### Manual Verification
1.  **Limits Test:**
    *   Create 2 projects and verify that attempting to create a 3rd project displays the free tier alert and blocks database submission.
    *   Under a single project, create 5 monitors and verify that attempting to add a 6th monitor is blocked with the warning.
2.  **Worker Test:**
    *   Invoke the Supabase Edge Function directly and check the `audit_logs` and `checks` tables to confirm pings are successfully recorded.
    *   Simulate a failure (e.g., target a non-existent or blocked URL) and ensure the retry logic and incident creation occur.
3.  **Automatic Dashboard Update Test:**
    *   Keep the dashboard open with a monitor displayed.
    *   Trigger or wait for a worker check that changes the monitor from UP to DOWN, then verify the dashboard updates without a browser refresh.
    *   Restore the monitor target and verify the dashboard changes from DOWN to UP automatically.
    *   Hide the browser tab and verify that polling pauses, then make the tab visible and verify that polling resumes.
