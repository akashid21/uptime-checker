-- Ticket 2.2: pg_cron Scheduling Setup
--
-- pg_cron runs the recurring scheduler job from Postgres.
-- pg_net provides net.http_post, which pg_cron uses to invoke the Edge Function.
-- Supabase Vault stores the project URL and service-role token for the job.

create schema if not exists extensions;
create schema if not exists vault;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault cascade;
