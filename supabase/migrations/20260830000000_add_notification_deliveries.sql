-- One delivery record per incident transition. This prevents intermediate checks
-- and worker retries from sending duplicate incident emails.
create table if not exists public.notification_deliveries (
  id uuid default uuid_generate_v4() primary key,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  event_type text not null check (event_type in ('incident_started', 'incident_resolved')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider text not null,
  provider_message_id text,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sent_at timestamp with time zone,
  unique (incident_id, event_type)
);

alter table public.notification_deliveries enable row level security;
