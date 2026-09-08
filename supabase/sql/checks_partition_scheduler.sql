-- Ticket 3.3: create future checks partitions before they are needed.
-- Run after 20260905000000_partition_checks_by_day.sql.
-- Runs daily at 00:05 UTC and keeps 31 days of partitions ahead.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'uptimeboard-checks-partitions') then
    perform cron.unschedule('uptimeboard-checks-partitions');
  end if;

  perform cron.schedule(
    'uptimeboard-checks-partitions',
    '5 0 * * *',
    $job$select public.ensure_checks_partitions(current_date, 31);$job$
  );
end;
$$;

-- Verification:
-- select c.relname
-- from pg_inherits i
-- join pg_class c on c.oid = i.inhrelid
-- join pg_class p on p.oid = i.inhparent
-- where p.relname = 'checks'
-- order by c.relname;
