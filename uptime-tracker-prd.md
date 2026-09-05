# PRD: UptimeBoard — Website Uptime Tracker

*(working title — rename as you like)*

## 1. Problem Statement

Developers and small teams need to know when their websites/APIs go down, how often, and for how long — without paying enterprise prices or wrestling with cluttered dashboards built for ops teams. Most existing tools (UptimeRobot, Pingdom, StatusCake) are either too basic (free tier) or too expensive/complex (paid tiers with SLA/on-call features nobody asked for).

## 2. Goals

- Let a user add a URL and get automatic uptime/downtime tracking with zero config
- Show a clean daily history (uptime %, downtime duration, incidents) over 30/90 days
- Alert the user quickly when something goes down, with minimal noise/false positives
- Be cheap to run and cheap to offer a generous free tier

## 3. Non-Goals (v1)

- Full enterprise on-call/escalation policies (PagerDuty-style)
- Infrastructure/server monitoring (CPU, memory, etc.) — website/API monitoring only
- Multi-tenant team management — single-user accounts first

## 4. Target Users

Indie developers, small SaaS founders, freelancers hosting client sites — people who want "is my site up" peace of mind without an enterprise contract.

## 5. Core Features (MVP)

### Monitor Management
- Add a URL (HTTP/HTTPS), give it a name, set check interval (1/5/15 min)
- Pause/resume a monitor, edit, delete
- Choose check type: status code (2xx/3xx = up), keyword match in response body, or response time threshold

### Projects / Monitor Grouping
- A **project** groups related monitors together (e.g. "Project A" → Dev, Stage, Prod as three monitors under one project)
- Dashboard rolls up status at the project level (all-green vs. one-environment-down at a glance) as well as per-monitor
- **Free tier limits (fixed until billing is finalized): 2 projects per account, 5 monitors per project.** When a user hits either limit, block the create action and show a clear "Free tier limit reached" message (with a placeholder for future upgrade CTA once pricing exists) rather than a silent failure or generic error

### Monitoring Engine
- Scheduled checks per monitor via background jobs
- Retry-before-alert logic: don't mark "down" on a single failed check — confirm with 2–3 retries over a short window to avoid false positives from transient network blips
- Store raw check results (timestamp, status, response time, HTTP code)

### Uptime History & Reporting
- Per-day rollup: uptime %, total downtime (minutes), number of incidents
- History views: last 24h (minute-level), 7d, 30d, 90d (daily rollups)
- Response time trend graph
- Incident timeline: when it went down, when it recovered, duration, cause if detectable (timeout, 5xx, DNS failure, SSL error, connection refused)
- The 30-day reliability grid is powered by one `daily_stats` record per monitor and calendar day, not by an unbounded client-side read of raw checks.
- The current day is represented by an incrementally maintained daily rollup or a server-side aggregate of today's checks; the browser must not download the full current-day raw-check list.
- Daily history queries must include `monitor_id` so statistics cannot be applied to the wrong monitor. Missing records mean `No data`; a record with failed checks represents recorded downtime.

### Alerting
- Email alerts on down/recovered (v1)
- Webhook support (so power users can wire up their own Slack/Discord/anything)
- Debounce: only alert after confirmed downtime, and don't spam repeat alerts for the same ongoing incident

### Status Page
- Simple public status page per account (or per monitor group) — shareable URL showing current status + uptime history bar (like GitHub's contribution graph, but for uptime)

## 6. V2 / Nice-to-Have Features

- SSL certificate expiry monitoring & alerts
- Domain expiry monitoring
- Heartbeat/cron job monitoring (for background jobs that should "check in" periodically — different model from HTTP polling)
- Maintenance windows (suppress alerts during planned downtime)
- Multi-region checks (verify downtime isn't just a local network issue on your check server)
- Team accounts with shared monitors
- Custom domain for status pages
- Mobile push notifications
- AI-assisted incident summaries (see USP section)

## 7. Suggested Architecture — Vercel-first Stack

**Recommendation: Node.js (Next.js), not Rails.** Vercel is built around Node/Next.js — first-class deploys, zero-config previews, tight DX. Rails doesn't run natively on Vercel; you'd be fighting the platform (custom builders, no real support for a persistent Ruby process), which works against the "fast ship time" goal you specifically asked for. Given the Vercel constraint, Node wins cleanly over Rails for this project.

- **Next.js on Vercel**: single repo for frontend (dashboard, status pages) + API routes (monitors CRUD, auth, incident/history endpoints). One deploy, fast iteration.
- **The scheduling & background worker solution**: Supabase Edge Functions + pg_cron.
  - A database-level scheduler (`pg_cron`) runs a recurring job every minute, executing a POST request to a Supabase Edge Function (`/v1/uptimeboard-run-checks`) authorized via the service role key.
  - The Edge Function queries due monitors, runs checks in parallel, and logs check outcomes and state transitions (UP/DOWN) to the database.
  - This execution is fully serverless, highly scalable, and completely free within Supabase's monthly Edge Function allowance.
- **Audit Logging**: Each background run writes a detailed execution log to an `audit_logs` database table, recording time, duration, processed counts, and any check failures or system errors for troubleshooting and audit trails.
- **Database**: Postgres via Supabase (integrates natively, generous free tier):
  - `monitors` (url, interval, type, config, project_id, last_checked_at, next_check_at)
  - `projects` (name, owner_id) — the Dev/Stage/Prod grouping
  - `checks` (raw ping results — high volume, short retention)
  - `incidents` (start, end, cause, monitor_id)
  - `audit_logs` (actor, action, details, created_at)
  - `daily_stats` (one aggregated row per monitor and calendar day) — this powers the 7/30/90-day views cheaply and remains available after raw checks are pruned
- **Auth**: Supabase Auth (native JWT verification, protected tables with RLS policies, and seamless integration with Next.js).
- A scheduled aggregation job (via the same pg_cron + Edge Function scheduler) rolls raw `checks` into `daily_stats` using an idempotent upsert keyed by `(monitor_id, check_date)`. It must complete and verify the rollup before pruning the corresponding raw partition (e.g., keep raw data 7 days, keep daily rollups forever).
- `daily_stats` should initially include `monitor_id`, `check_date`, `total_checks`, `successful_checks`, `failed_checks`, `uptime_percentage`, `average_response_time_ms`, `min_response_time_ms`, `max_response_time_ms`, `total_downtime_minutes`, `incident_count`, `created_at`, and `updated_at` so future history and performance views do not require re-reading raw checks.
- The dashboard must query daily stats for historical blocks and use either the current day's maintained rollup or a server-side current-day aggregate. It must not depend on the default 1,000-row Supabase response limit.

This keeps the expensive/high-volume data (raw checks) short-lived, while the long-term history the user actually cares about is cheap aggregated rows — same principle as before, adapted to a serverless-friendly stack.

## 8. Key Challenges & How to Handle Them

| Challenge | Approach |
|---|---|
| **False positives** — a single failed ping isn't real downtime | Require N consecutive failed checks (with short retry delay) before marking a monitor "down" |
| **Check volume/scale** — many monitors × frequent checks = lots of rows | Aggregate into per-monitor daily rollups, purge raw check data after a verified retention window, and never use an unpaginated raw-check query for historical dashboard data |
| **Alert fatigue / flapping services** | Debounce alerts; one alert per incident, not per failed check; recovery alert only once |
| **"Who monitors the monitor?"** — your own service needs to be reliable | Run checks from a separate worker fleet from your web app; have your own status page/self-check; consider a secondary lightweight watchdog |
| **Timezone-correct daily stats** | Store event timestamps in UTC and apply one explicit reporting timezone consistently when producing and displaying `check_date`; use UTC initially if user-local reporting is not yet configured |
| **Incomplete dashboard blocks** — Supabase returns only the first 1,000 raw checks | Drive the grid from `daily_stats` rows keyed by `monitor_id` and `check_date`; aggregate the current day server-side or maintain it incrementally |
| **Distinguishing real downtime from your own deploys/maintenance** | Maintenance windows that suppress alerting without hiding the downtime from history |
| **Cost of frequent polling at scale** | Tier check intervals by plan (free = 5–15 min, paid = 1 min); consider batching HTTP checks efficiently in worker pools |
| **False "up" from a site that responds but is broken** (e.g., a 200 OK error page) | Optional keyword/content assertion checks, not just status codes |
| **No persistent process to run per-monitor scheduling on Vercel** | Offload scheduling to Upstash QStash (or a small external worker) rather than trying to run a cron loop inside a serverless function |

## 9. Differentiation / USP Ideas

The uptime-monitoring space is crowded, so the wedge is usually **UX + price + one genuinely useful feature others don't do well**:

1. **AI-assisted incident diagnosis** *(Deferred to Post-MVP)* — when a monitor goes down, use the response body/headers/error type to generate a plain-English guess at the cause ("Likely a database connection timeout on your server" vs "DNS resolution failed — check your domain's nameservers"), and auto-draft an incident summary/postmortem the user can publish to their status page. This plays to your AI-engineering interest and isn't well done by incumbents.
2. **Developer-first, API/webhook-first** *(Deferred to Post-MVP)* — no forced Slack/PagerDuty integrations to get basic alerting; a clean REST API and webhooks from day one.
3. **Radically simpler UX** *(Phase 1 MVP)* — most competitors (Pingdom, StatusCake) have UI built for ops teams from a decade ago. A clean, fast, opinionated dashboard is a differentiator on its own.
4. **Honest, generous free tier** *(Phase 1 MVP)* — many tools cripple the free tier to force upgrades; a genuinely useful free tier (2 projects, 5 monitors/project) builds trust and word-of-mouth in the indie-hacker community.
5. **Uptime history as a shareable artifact** *(Deferred to Post-MVP)* — a GitHub-contribution-graph-style visual of uptime history that's satisfying to look at and easy to embed/share (README badges, status page).

*Note: By deferring the AI diagnosis, developer-first API/webhooks, and shareable status page assets to Post-MVP (Phase 2), we focus on shipping the core working monitoring loop and dashboard quickly before adding enhancements in parallel once live.*

## 10. Success Metrics (once live)

- Time from signup to first monitor created (activation)
- % of monitors with zero false-positive alerts in first 30 days
- Free → paid conversion rate
- Alert delivery latency (time from real downtime to notification)

## 11. Open Questions

**Decided:**
- Monitors are grouped into projects (e.g. Dev/Stage/Prod under one project)
- Free tier limits are set to exactly 2 projects per account, and 5 monitors per project. When the limit is hit, we show a warning alert in the UI and block execution.
- Single-region checks for v1; multi-region moved to phase 2 (see Section 6)
- Stack: Next.js/Node on Vercel over Rails, specifically for deploy speed
- Auth: Supabase Auth (native JWT, protected tables, easy integration with Next.js client)
- Scheduler/Worker: Supabase Edge Functions + pg_cron database-level scheduler (running every minute, logging executions to an `audit_logs` table)

**Still open:**
- Pricing model for v1 monetization (flat tiers vs pay-per-project vs pay-per-monitor) — we will run under the 2 projects / 5 monitors per project free-tier constraints while pricing details are being finalized.
