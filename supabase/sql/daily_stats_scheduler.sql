-- Ticket 3.6: schedule the daily stats rollup separately from the schema migration.
-- Runs daily at 00:10 UTC and rolls up the previous UTC calendar day.
-- The job is safe to rerun: an existing job with the same name is replaced.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'uptimeboard-daily-stats-rollup') then
    perform cron.unschedule('uptimeboard-daily-stats-rollup');
  end if;

  perform cron.schedule(
    'uptimeboard-daily-stats-rollup',
    '10 0 * * *',
    $job$select public.rollup_daily_stats((current_date - 1)::date, (current_date - 1)::date, 'UTC');$job$
  );
end;
$$;

-- Verification:
-- select jobid, jobname, schedule, active
-- from cron.job
-- where jobname = 'uptimeboard-daily-stats-rollup';
