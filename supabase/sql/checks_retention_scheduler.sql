-- Ticket 3.5: daily rollup monitoring and safe raw-check retention.
--
-- Run this only after:
--   1. daily_stats has been backfilled;
--   2. the partition migration is verified; and
--   3. the dry-run query below reports the expected candidates.
--
-- Rollup runs at 00:10 UTC. Pruning runs at 00:20 UTC and drops only
-- partitions whose per-monitor totals exactly match daily_stats.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'uptimeboard-daily-stats-rollup') then
    perform cron.unschedule('uptimeboard-daily-stats-rollup');
  end if;
  if exists (select 1 from cron.job where jobname = 'uptimeboard-checks-retention') then
    perform cron.unschedule('uptimeboard-checks-retention');
  end if;

  perform cron.schedule(
    'uptimeboard-daily-stats-rollup',
    '10 0 * * *',
    $rollup$select public.run_daily_stats_rollup();$rollup$
  );

  perform cron.schedule(
    'uptimeboard-checks-retention',
    '20 0 * * *',
    $prune$select public.prune_checks_partitions(7, false);$prune$
  );
end;
$$;

-- Dry-run verification before enabling the destructive scheduler:
-- select * from public.get_prunable_checks_partitions(7);
-- select * from public.prune_checks_partitions(7, true);

-- Rollback scheduler only (does not restore already-dropped partitions):
-- select cron.unschedule(jobid)
-- from cron.job
-- where jobname in ('uptimeboard-daily-stats-rollup', 'uptimeboard-checks-retention');
