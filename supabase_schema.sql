-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Profiles Table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on RLS for profiles
alter table public.profiles enable row level security;
create policy "Users can view own profile." on profiles for select using (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. Projects Table
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;
create policy "Users can CRUD own projects." on projects for all using (auth.uid() = owner_id);


-- 4. Monitors Table
create table public.monitors (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  url text not null,
  check_interval_minutes integer not null default 5,
  type text not null default 'http',
  status text not null default 'unmonitored',
  is_active boolean not null default true,
  last_checked_at timestamp with time zone,
  next_check_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.monitors enable row level security;
create policy "Users can CRUD own monitors." on monitors for all
  using (project_id in (select id from public.projects where owner_id = auth.uid()));


-- 5. Checks Table (High volume logs)
create table public.checks (
  id uuid default uuid_generate_v4() primary key,
  monitor_id uuid references public.monitors(id) on delete cascade not null,
  status_code integer,
  response_time_ms integer,
  is_up boolean not null,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.checks enable row level security;
-- Users can view their own checks. (Insertions happen via Edge Function using Service Role, bypassing RLS)
create policy "Users can view own checks." on checks for select
  using (monitor_id in (select id from public.monitors where project_id in (select id from public.projects where owner_id = auth.uid())));


-- 6. Incidents Table
create table public.incidents (
  id uuid default uuid_generate_v4() primary key,
  monitor_id uuid references public.monitors(id) on delete cascade not null,
  start_time timestamp with time zone not null default timezone('utc'::text, now()),
  end_time timestamp with time zone,
  duration_minutes integer,
  resolution_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.incidents enable row level security;
create policy "Users can view own incidents." on incidents for select
  using (monitor_id in (select id from public.monitors where project_id in (select id from public.projects where owner_id = auth.uid())));


-- 7. Audit Logs Table (For tracking background worker executions)
create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  actor text not null,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.audit_logs enable row level security;
-- Only viewable by system for MVP. Service role inserts bypass RLS.


-- 8. Helper: Trigger to auto-update 'updated_at' columns
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.handle_updated_at();

create trigger set_monitors_updated_at
  before update on public.monitors
  for each row execute procedure public.handle_updated_at();

