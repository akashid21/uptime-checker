-- Ticket 3.6: durable per-monitor daily rollups for dashboard history.
-- Raw checks remain the source of truth while daily_stats provides the
-- bounded, long-lived data used by 7/30/90-day views.

create table if not exists public.daily_stats (
  monitor_id uuid references public.monitors(id) on delete cascade not null,
  check_date date not null,
  total_checks integer not null default 0,
  successful_checks integer not null default 0,
  failed_checks integer not null default 0,
  uptime_percentage numeric(5, 2) not null default 0,
  average_response_time_ms numeric(12, 2),
  min_response_time_ms integer,
  max_response_time_ms integer,
  total_downtime_minutes integer not null default 0,
  incident_count integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (monitor_id, check_date)
);

create index if not exists daily_stats_check_date_idx
  on public.daily_stats (check_date desc);

alter table public.daily_stats enable row level security;

drop policy if exists "Users can view own daily stats." on public.daily_stats;
create policy "Users can view own daily stats." on public.daily_stats
  for select using (
    monitor_id in (
      select m.id
      from public.monitors m
      join public.projects p on p.id = m.project_id
      where p.owner_id = auth.uid()
    )
  );

drop trigger if exists set_daily_stats_updated_at on public.daily_stats;
create trigger set_daily_stats_updated_at
  before update on public.daily_stats
  for each row execute procedure public.handle_updated_at();

-- Rebuilds a date range safely. The timezone is explicit so aggregation and
-- dashboard display cannot silently disagree about which calendar day a check
-- belongs to. UTC is the initial product default.
create or replace function public.rollup_daily_stats(
  p_start_date date,
  p_end_date date,
  p_timezone text default 'UTC'
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  rows_written integer;
begin
  with check_rollup as (
    select
      c.monitor_id,
      (c.created_at at time zone p_timezone)::date as check_date,
      count(*)::integer as total_checks,
      count(*) filter (where c.is_up)::integer as successful_checks,
      count(*) filter (where not c.is_up)::integer as failed_checks,
      round((count(*) filter (where c.is_up)::numeric / nullif(count(*), 0)) * 100, 2) as uptime_percentage,
      round(avg(c.response_time_ms), 2) as average_response_time_ms,
      min(c.response_time_ms) as min_response_time_ms,
      max(c.response_time_ms) as max_response_time_ms,
      coalesce(sum(case when not c.is_up then m.check_interval_minutes else 0 end), 0)::integer as total_downtime_minutes
    from public.checks c
    join public.monitors m on m.id = c.monitor_id
    where (c.created_at at time zone p_timezone)::date between p_start_date and p_end_date
    group by c.monitor_id, (c.created_at at time zone p_timezone)::date
  ), incident_rollup as (
    select
      i.monitor_id,
      (i.start_time at time zone p_timezone)::date as check_date,
      count(*)::integer as incident_count
    from public.incidents i
    where (i.start_time at time zone p_timezone)::date between p_start_date and p_end_date
    group by i.monitor_id, (i.start_time at time zone p_timezone)::date
  )
  insert into public.daily_stats (
    monitor_id,
    check_date,
    total_checks,
    successful_checks,
    failed_checks,
    uptime_percentage,
    average_response_time_ms,
    min_response_time_ms,
    max_response_time_ms,
    total_downtime_minutes,
    incident_count
  )
  select
    r.monitor_id,
    r.check_date,
    r.total_checks,
    r.successful_checks,
    r.failed_checks,
    r.uptime_percentage,
    r.average_response_time_ms,
    r.min_response_time_ms,
    r.max_response_time_ms,
    r.total_downtime_minutes,
    coalesce(i.incident_count, 0)
  from check_rollup r
  left join incident_rollup i using (monitor_id, check_date)
  on conflict (monitor_id, check_date) do update set
    total_checks = excluded.total_checks,
    successful_checks = excluded.successful_checks,
    failed_checks = excluded.failed_checks,
    uptime_percentage = excluded.uptime_percentage,
    average_response_time_ms = excluded.average_response_time_ms,
    min_response_time_ms = excluded.min_response_time_ms,
    max_response_time_ms = excluded.max_response_time_ms,
    total_downtime_minutes = excluded.total_downtime_minutes,
    incident_count = excluded.incident_count,
    updated_at = now();

  get diagnostics rows_written = row_count;
  return rows_written;
end;
$$;

-- Used by the dashboard for today's live block. It returns one bounded row per
-- monitor, regardless of how many raw checks occurred today.
create or replace function public.get_current_daily_stats(
  p_check_date date,
  p_timezone text default 'UTC'
)
returns table (
  monitor_id uuid,
  check_date date,
  total_checks integer,
  successful_checks integer,
  failed_checks integer,
  uptime_percentage numeric,
  average_response_time_ms numeric,
  min_response_time_ms integer,
  max_response_time_ms integer,
  total_downtime_minutes integer,
  incident_count integer
)
language sql
security invoker
set search_path = public
as $$
  select
    c.monitor_id,
    p_check_date,
    count(*)::integer,
    count(*) filter (where c.is_up)::integer,
    count(*) filter (where not c.is_up)::integer,
    round((count(*) filter (where c.is_up)::numeric / nullif(count(*), 0)) * 100, 2),
    round(avg(c.response_time_ms), 2),
    min(c.response_time_ms),
    max(c.response_time_ms),
    coalesce(sum(case when not c.is_up then m.check_interval_minutes else 0 end), 0)::integer,
    coalesce((
      select count(*)
      from public.incidents i
      where i.monitor_id = c.monitor_id
        and (i.start_time at time zone p_timezone)::date = p_check_date
    ), 0)::integer
  from public.checks c
  join public.monitors m on m.id = c.monitor_id
  join public.projects p on p.id = m.project_id
  where p.owner_id = auth.uid()
    and (c.created_at at time zone p_timezone)::date = p_check_date
  group by c.monitor_id;
$$;
