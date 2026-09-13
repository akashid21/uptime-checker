-- Ticket 3.5: safe retention pruning and rollup monitoring.
--
-- This migration only creates functions. It does not drop data and does not
-- install a cron job. Install the scheduler separately after verification.

create or replace function public.run_daily_stats_rollup_job()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  rows_written integer;
  rollup_date date := current_date - 1;
begin
  rows_written := public.rollup_daily_stats(rollup_date, rollup_date, 'UTC');

  insert into public.audit_logs (actor, action, details)
  values (
    'system/background-worker',
    'daily_stats_rollup',
    jsonb_build_object(
      'status', 'succeeded',
      'check_date', rollup_date,
      'rows_written', rows_written,
      'completed_at', now()
    )
  );

  return jsonb_build_object('status', 'succeeded', 'check_date', rollup_date, 'rows_written', rows_written);
exception when others then
  insert into public.audit_logs (actor, action, details)
  values (
    'system/background-worker',
    'daily_stats_rollup',
    jsonb_build_object(
      'status', 'failed',
      'check_date', rollup_date,
      'error', sqlerrm,
      'failed_at', now()
    )
  );
  return jsonb_build_object('status', 'failed', 'check_date', rollup_date, 'error', sqlerrm);
end;
$$;

revoke all on function public.run_daily_stats_rollup_job() from public;
grant execute on function public.run_daily_stats_rollup_job() to service_role;

-- Read-only report of partitions that are safe to prune. A partition is
-- eligible only when every raw monitor/day count has an exact daily_stats
-- counterpart. This function never deletes data.
create or replace function public.get_prunable_checks_partitions(
  p_retention_days integer default 7
)
returns table (
  partition_name text,
  check_date date,
  raw_checks bigint,
  rollup_checks bigint,
  eligible boolean,
  reason text
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with partitions as (
    select
      c.relname::text as partition_name,
      to_date((regexp_match(c.relname, '^checks_([0-9]{8})$'))[1], 'YYYYMMDD') as check_date
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_class parent on parent.oid = i.inhparent
    join pg_namespace n on n.oid = c.relnamespace
    where parent.relname = 'checks'
      and n.nspname = 'public'
      and c.relname ~ '^checks_[0-9]{8}$'
  ),
  candidates as (
    select *
    from partitions
    where check_date < current_date - p_retention_days
  ),
  counts as (
    select
      candidate.partition_name,
      candidate.check_date,
      count(checks.id)::bigint as raw_checks,
      coalesce((
        select sum(stats.total_checks)::bigint
        from public.daily_stats stats
        where stats.check_date = candidate.check_date
      ), 0)::bigint as rollup_checks,
      not exists (
        select 1
        from (
          select checks.monitor_id, count(*)::integer as raw_count
          from public.checks checks
          where checks.created_at >= candidate.check_date::timestamp at time zone 'UTC'
            and checks.created_at < (candidate.check_date + 1)::timestamp at time zone 'UTC'
          group by checks.monitor_id
        ) raw_by_monitor
        left join public.daily_stats stats
          on stats.monitor_id = raw_by_monitor.monitor_id
         and stats.check_date = candidate.check_date
        where stats.total_checks is null
           or stats.total_checks <> raw_by_monitor.raw_count
      ) as monitor_counts_match
    from candidates candidate
    left join public.checks checks
      on checks.created_at >= candidate.check_date::timestamp at time zone 'UTC'
     and checks.created_at < (candidate.check_date + 1)::timestamp at time zone 'UTC'
    group by candidate.partition_name, candidate.check_date
  )
  select
    partition_name,
    check_date,
    raw_checks,
    rollup_checks,
    (monitor_counts_match and raw_checks = rollup_checks) as eligible,
    case
      when not monitor_counts_match then 'daily_stats is missing or mismatched for one or more monitors'
      when raw_checks <> rollup_checks then 'raw and rollup totals do not match'
      else 'safe to prune'
    end as reason
  from counts
  order by check_date;
$$;

revoke all on function public.get_prunable_checks_partitions(integer) from public;
grant execute on function public.get_prunable_checks_partitions(integer) to service_role;

-- Drops only eligible old partitions. dry_run defaults to true so an explicit
-- false is required for destructive execution. Every successful drop is logged.
create or replace function public.prune_checks_partitions(
  p_retention_days integer default 7,
  p_dry_run boolean default true
)
returns table (
  partition_name text,
  check_date date,
  raw_checks bigint,
  action text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  candidate record;
  prune_action text;
begin
  if p_dry_run is null then
    p_dry_run := true;
  end if;

  for candidate in
    select *
    from public.get_prunable_checks_partitions(p_retention_days)
    where eligible
  loop
    prune_action := case when p_dry_run then 'would_drop' else 'dropped' end;

    if not p_dry_run then
      execute format('drop table public.%I', candidate.partition_name);
      insert into public.audit_logs (actor, action, details)
      values (
        'system/background-worker',
        'checks_partition_pruned',
        jsonb_build_object(
          'status', 'succeeded',
          'partition_name', candidate.partition_name,
          'check_date', candidate.check_date,
          'raw_checks', candidate.raw_checks,
          'retention_days', p_retention_days,
          'completed_at', now()
        )
      );
    end if;

    partition_name := candidate.partition_name;
    check_date := candidate.check_date;
    raw_checks := candidate.raw_checks;
    action := prune_action;
    return next;
  end loop;
end;
$$;

revoke all on function public.prune_checks_partitions(integer, boolean) from public;
grant execute on function public.prune_checks_partitions(integer, boolean) to service_role;
