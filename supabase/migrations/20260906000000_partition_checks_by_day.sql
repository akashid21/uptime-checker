-- Ticket 3.3: partition checks by UTC calendar day.
--
-- This migration keeps the original table as checks_legacy_20260905 so the
-- conversion can be verified before the backup is removed. It is intended to
-- run once during a maintenance window because renaming and copying the table
-- briefly locks the checks write path.

begin;

-- Keep production aligned with the development schema, which uses
-- uuid_generate_v4() from the uuid-ossp extension.
create schema if not exists extensions;
create extension if not exists "uuid-ossp";
set local search_path = public, extensions, pg_catalog;

alter table public.checks rename to checks_legacy_20260905;

create table public.checks (
  id uuid default uuid_generate_v4() not null,
  monitor_id uuid references public.monitors(id) on delete cascade not null,
  status_code integer,
  response_time_ms integer,
  is_up boolean not null,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (id, created_at)
) partition by range (created_at);

alter table public.checks enable row level security;

create policy "Users can view own checks." on public.checks for select
  using (monitor_id in (
    select m.id
    from public.monitors m
    join public.projects p on p.id = m.project_id
    where p.owner_id = auth.uid()
  ));

create index checks_monitor_created_at_idx
  on public.checks (monitor_id, created_at desc);

create index checks_created_at_idx
  on public.checks (created_at desc);

grant select on public.checks to anon, authenticated;

-- Create partitions for all existing data plus 31 days ahead. UTC is used for
-- both the partition bounds and daily_stats.check_date.
do $$
declare
  first_day date;
  last_day date;
  partition_day date;
  partition_name text;
begin
  select
    coalesce(min((created_at at time zone 'UTC')::date), current_date - 1),
    coalesce(max((created_at at time zone 'UTC')::date), current_date)
  into first_day, last_day
  from public.checks_legacy_20260905;

  first_day := least(first_day, current_date - 1);
  last_day := greatest(last_day, current_date + 31);
  partition_day := first_day;

  while partition_day <= last_day loop
    partition_name := format('checks_%s', to_char(partition_day, 'YYYYMMDD'));
    execute format(
      'create table public.%I partition of public.checks for values from (%L) to (%L)',
      partition_name,
      partition_day::text || ' 00:00:00+00',
      (partition_day + 1)::text || ' 00:00:00+00'
    );
    partition_day := partition_day + 1;
  end loop;
end;
$$;

insert into public.checks (id, monitor_id, status_code, response_time_ms, is_up, error_message, created_at)
select id, monitor_id, status_code, response_time_ms, is_up, error_message, created_at
from public.checks_legacy_20260905;

-- Creates future UTC partitions before the worker needs them. The function is
-- idempotent and may also be run manually after a failed scheduler execution.
create or replace function public.ensure_checks_partitions(
  p_start_date date default current_date,
  p_days_ahead integer default 31
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  partition_day date := p_start_date;
  created_count integer := 0;
  partition_name text;
begin
  if p_days_ahead < 0 or p_days_ahead > 366 then
    raise exception 'p_days_ahead must be between 0 and 366';
  end if;

  while partition_day <= p_start_date + p_days_ahead loop
    partition_name := format('checks_%s', to_char(partition_day, 'YYYYMMDD'));
    if to_regclass(format('public.%I', partition_name)) is null then
      execute format(
        'create table public.%I partition of public.checks for values from (%L) to (%L)',
        partition_name,
        partition_day::text || ' 00:00:00+00',
        (partition_day + 1)::text || ' 00:00:00+00'
      );
      created_count := created_count + 1;
    end if;
    partition_day := partition_day + 1;
  end loop;

  return created_count;
end;
$$;

revoke all on function public.ensure_checks_partitions(date, integer) from public;
grant execute on function public.ensure_checks_partitions(date, integer) to service_role;

commit;
