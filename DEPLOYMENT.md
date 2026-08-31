# UptimeBoard Deployment Checklist

Use this checklist for a new Supabase project and a new UptimeBoard deployment.

## 1. Create the Supabase project

- [ ] Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
- [ ] Choose the organization, project name, database password, and region.
- [ ] Wait until the project is ready.
- [ ] Copy the project URL and the publishable/anon key from **Project Settings → API**.

## 2. Configure the local application

- [ ] Copy `.env.local.example` to `.env.local`.
- [ ] Set these values:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
  ```

- [ ] Keep service-role keys, Brevo keys, and sender configuration out of browser-exposed variables.
- [ ] Run `npm install` and start the app with `npm run dev`.

## 3. Link the Supabase CLI to the new project

- [ ] Install the Supabase CLI if it is not installed.
- [ ] Authenticate:

  ```bash
  supabase login
  ```

- [ ] Link this repository to the new project:

  ```bash
  supabase link --project-ref <project-ref>
  ```

## 4. Apply the database schema and migrations

- [ ] Push the migrations:

  ```bash
  supabase db push
  ```

- [ ] Confirm the following exist in the new project:
  - [ ] `profiles`
  - [ ] `projects`
  - [ ] `monitors`
  - [ ] `checks`
  - [ ] `incidents`
  - [ ] `audit_logs`
  - [ ] `notification_deliveries`
  - [ ] `pg_cron`, `pg_net`, and Vault extensions

- [ ] If the schema was created from `supabase_schema.sql` manually, run the notification-delivery migration SQL as well.

## 5. Configure Brevo

- [ ] Create or use a Brevo account.
- [ ] Add and verify a sender address, or authenticate the sending domain.
- [ ] Create a Brevo API key with transactional email access.
- [ ] Confirm `NOTIFICATION_FROM_EMAIL` exactly matches the verified sender.

## 6. Deploy the Edge Function

- [ ] Deploy the renamed function:

  ```bash
  supabase functions deploy uptimeboard-run-checks
  ```

- [ ] Set the Edge Function secrets on the new Supabase project:

  ```bash
  supabase secrets set \
    EMAIL_PROVIDER=brevo \
    BREVO_API_KEY=<brevo-api-key> \
    NOTIFICATION_FROM_EMAIL=alerts@your-domain.com \
    NOTIFICATION_FROM_NAME=UptimeBoard
  ```

- [ ] Confirm the secrets with `supabase secrets list`. Do not print secret values or commit them.

## 7. Configure the scheduler

- [ ] In the Supabase SQL Editor, create the two Vault secrets using values for this project:

  ```sql
  select vault.create_secret(
    'https://<project-ref>.supabase.co',
    'uptimeboard_project_url',
    'UptimeBoard Supabase project URL'
  );

  select vault.create_secret(
    '<service-role-key>',
    'uptimeboard_service_role_key',
    'UptimeBoard scheduler service-role key'
  );
  ```

- [ ] Run `supabase/sql/uptimeboard_scheduler.sql` in the SQL Editor.
- [ ] Verify the job:

  ```sql
  select jobid, jobname, schedule, active
  from cron.job
  where jobname = 'uptimeboard-scheduler';
  ```

- [ ] Verify recent requests:

  ```sql
  select *
  from net._http_response
  order by created desc
  limit 10;
  ```

## 8. Configure Auth URLs

- [ ] In **Authentication → URL Configuration**, set the production Site URL.
- [ ] Add the production app URL to the redirect allow list.
- [ ] For local development, keep `http://localhost:3000` allowed.

## 9. Run the end-to-end test

- [ ] Create a user and sign in.
- [ ] Create a project and an active monitor pointing to a known healthy URL.
- [ ] Confirm the monitor becomes `up` after the first scheduled check.
- [ ] Point the monitor to a controlled failing URL, or temporarily use a test endpoint that returns an error.
- [ ] Confirm exactly one `incident_started` row appears in `notification_deliveries`.
- [ ] Confirm Brevo shows the failure email with status `sent`.
- [ ] Restore the monitor URL.
- [ ] Confirm exactly one `incident_resolved` row appears for the same incident.
- [ ] Confirm no additional email is sent during intermediate checks.
- [ ] Check Edge Function logs and `audit_logs` if any step fails.

## 10. Production build

- [ ] Set the production environment variables in the hosting provider.
- [ ] Run `npm run build`.
- [ ] Deploy the Next.js application.
- [ ] Recheck login, dashboard polling, monitor checks, incident emails, and sign-out in production.
