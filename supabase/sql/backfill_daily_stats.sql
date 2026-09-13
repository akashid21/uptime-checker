-- Ticket 3.6: manually backfill or rebuild daily stats for a chosen date range.
-- Change only the two dates below, then run this file in Supabase SQL Editor.
-- The operation is idempotent and updates existing rows rather than duplicating them.

select public.rollup_daily_stats(
  '2026-08-01'::date, -- start date, inclusive
  '2026-09-05'::date, -- end date, inclusive
  'UTC'
);

-- Optional verification:
-- select monitor_id, check_date, total_checks, successful_checks, failed_checks
-- from public.daily_stats
-- where check_date between '2026-08-01'::date and '2026-09-05'::date
-- order by check_date desc, monitor_id;
