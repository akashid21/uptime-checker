-- Ticket 2.2: pg_cron Scheduling Setup
--
-- Run this after applying migrations and creating the two Vault secrets below.
-- Keeping these values in Vault lets the cron job avoid hardcoded secrets in
-- source control while storing sensitive values encrypted at rest.
--
-- Example setup, run with your real values:
--   select vault.create_secret(
--     'https://<project-id>.supabase.co',
--     'pulsecheck_project_url',
--     'PulseCheck Supabase project URL'
--   );
--
--   select vault.create_secret(
--     '<SERVICE_ROLE_KEY>',
--     'pulsecheck_service_role_key',
--     'PulseCheck scheduler service-role key'
--   );

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'pulsecheck_project_url'
  ) then
    raise exception
      'Missing Vault secret pulsecheck_project_url. Create it with vault.create_secret before scheduling.';
  end if;

  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'pulsecheck_service_role_key'
  ) then
    raise exception
      'Missing Vault secret pulsecheck_service_role_key. Create it with vault.create_secret before scheduling.';
  end if;
end $$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pulsecheck-scheduler') then
    perform cron.unschedule('pulsecheck-scheduler');
  end if;
end $$;

select cron.schedule(
  'pulsecheck-scheduler',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'pulsecheck_project_url'
      ) || '/functions/v1/run-checks',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'pulsecheck_service_role_key'
        ),
        'Content-Type',
        'application/json'
      ),
      timeout_milliseconds := 30000
    ) as request_id;
  $cron$
);
