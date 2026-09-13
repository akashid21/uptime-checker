# Supabase Migration and Operations Runbook

This document explains what each database migration changes, when it runs, and how to verify or roll it back. Schema migrations are applied with the Supabase CLI; operational SQL files are run explicitly in the Supabase SQL Editor.

## Safe execution order

For a fresh database:

1. Apply the base schema from `supabase_schema.sql` if the project is not using the Supabase CLI migration history.
2. Run `supabase db push` to apply versioned migrations.
3. Run `supabase/sql/backfill_daily_stats.sql` with the required date range.
4. Verify the daily stats and checks partition conversion.
5. Run `supabase/sql/checks_partition_scheduler.sql`.
6. Run the dry-run checks in `supabase/sql/checks_retention_scheduler.sql`.
7. Only after the dry run is correct, run `supabase/sql/checks_retention_scheduler.sql` to enable rollups and pruning.

For an existing deployment, take a Supabase backup or confirm point-in-time recovery before running any migration that changes or removes data. Never run the destructive retention scheduler before the dry-run report has been reviewed.

## Versioned migrations

### `20260827000000_enable_pg_cron_scheduler_extensions.sql`

What it does:

- Creates the `extensions` and `vault` schemas if needed.
- Enables `pg_cron` for scheduled database jobs.
- Enables `pg_net` for the HTTP scheduler.
- Enables Supabase Vault for encrypted scheduler secrets.

How it runs:

- Automatically with `supabase db push`.
- It does not create a monitoring cron job by itself.

Rollback:

- Do not remove these extensions while cron jobs or the worker scheduler depend on them.
- Disable individual cron jobs first, then remove extensions only as a separately approved operation.

### `20260830000000_add_notification_deliveries.sql`

What it does:

- Creates the notification delivery ledger.
- Prevents duplicate incident-started and incident-resolved emails with a unique `(incident_id, event_type)` constraint.
- Enables RLS on the ledger.

How it runs:

- Automatically with `supabase db push`.

Rollback:

- Removing the table would remove notification history and deduplication state. Keep it unless the notification system is being retired.

### `20260905000000_add_daily_stats.sql`

What it does:

- Creates `daily_stats`, keyed by `(monitor_id, check_date)`.
- Adds RLS and a date index.
- Creates `rollup_daily_stats()` for idempotent aggregation.
- Creates `get_current_daily_stats()` for the live current-day dashboard block.

How it runs:

- Automatically with `supabase db push`.
- It does not backfill history and does not create a cron job.

Operational follow-up:

- Run `supabase/sql/backfill_daily_stats.sql` with an explicit inclusive date range.
- Verify `daily_stats` before enabling retention.

Rollback:

- Stop the daily stats scheduler first.
- The table and functions can be removed or recreated, but dropping `daily_stats` loses the long-term history that replaces pruned raw checks.

### `20260906000000_partition_checks_by_day.sql`

What it does:

- Enables `uuid-ossp` so production matches the development schema and provides `uuid_generate_v4()`.
- Renames the original table to `checks_legacy_20260905` as a rollback backup.
- Creates a new `checks` table partitioned by UTC calendar day.
- Uses `(id, created_at)` as the primary key because partitioned unique constraints must include the partition key.
- Creates partitions covering all existing data plus 31 future days.
- Copies existing rows into the new partitioned table.
- Restores RLS and indexes.
- Adds `ensure_checks_partitions()` for future partition creation.

How it runs:

- Automatically with `supabase db push`.
- Run during a maintenance window because the rename and copy lock the checks write path.
- Afterward, run `supabase/sql/checks_partition_scheduler.sql`.

Verification:

```sql
select count(*) from public.checks;
select count(*) from public.checks_legacy_20260905;

select c.relname
from pg_inherits i
join pg_class c on c.oid = i.inhrelid
join pg_class p on p.oid = i.inhparent
where p.relname = 'checks'
order by c.relname;
```

Rollback:

- Unschedule the partition-creation job.
- Do not drop `checks_legacy_20260905` until row counts, date coverage, and new worker writes are verified.
- Restoring the old table requires a planned maintenance operation because the application must be switched back to it.

### `20260908000000_add_checks_retention.sql`

What it does:

- Creates `run_daily_stats_rollup_job()` with success/failure audit logging.
- Creates `get_prunable_checks_partitions()` as a read-only eligibility report.
- Creates `prune_checks_partitions()` with `dry_run = true` by default.
- Allows pruning only when per-monitor raw totals exactly match `daily_stats`.
- Writes each successful partition drop to `audit_logs`.

How it runs:

- Automatically with `supabase db push`.
- It never drops partitions and never installs a cron job during migration.

Rollback:

- Function creation is reversible with `create or replace` or by dropping the functions.
- Already-dropped partition data is not restored by function rollback; use Supabase backup/PITR or a retained archive.

## Explicit operational SQL files

### `supabase/sql/backfill_daily_stats.sql`

Edit the inclusive start and end dates, then run it manually. It is idempotent and updates existing daily rows rather than duplicating them.

```sql
select public.rollup_daily_stats(
  '2026-08-01'::date,
  '2026-09-05'::date,
  'UTC'
);
```

### `supabase/sql/daily_stats_scheduler.sql`

Installs the daily rollup job at `00:10 UTC`. This is retained for standalone daily-stats operation. The retention scheduler below replaces this job with the audited wrapper.

### `supabase/sql/checks_partition_scheduler.sql`

Installs the daily partition-creation job at `00:05 UTC` and keeps 31 future UTC partitions available. It can be unscheduled without deleting any data.

### `supabase/sql/checks_retention_scheduler.sql`

Replaces the daily stats job with the audited wrapper at `00:10 UTC` and installs pruning at `00:20 UTC`.

Before enabling it:

```sql
select * from public.get_prunable_checks_partitions(7);
select * from public.prune_checks_partitions(7, true);
```

The scheduler uses `prune_checks_partitions(7, false)` only after those checks are reviewed. To stop future activity:

```sql
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'uptimeboard-daily-stats-rollup',
  'uptimeboard-checks-retention',
  'uptimeboard-checks-partitions'
);
```

Stopping the jobs is reversible. Dropped data is recoverable only through database backup/PITR or a deliberately retained archive.
