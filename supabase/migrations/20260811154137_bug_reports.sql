create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('bug', 'content', 'suggestion')),
  message text not null check (char_length(message) between 1 and 5000),
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  system text check (system is null or system in ('dnd5e', 'wfrp4e')),
  app_version text check (app_version is null or char_length(app_version) <= 32),
  platform text check (platform is null or platform in ('ios', 'android', 'web')),
  locale text check (locale is null or char_length(locale) <= 16),
  created_at timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

-- A DEFAULT does not protect a column: Postgres skips it whenever the client supplies
-- the column, and PostgREST forwards whatever JSON the client sends. So the policy —
-- not the default — is what stops a caller stamping a report with someone else's id.
-- Anonymous reports (user_id null) stay allowed, including from signed-in users who
-- deliberately omit it.
create policy "submit own or anonymous"
  on public.bug_reports for insert
  with check (user_id is null or user_id = auth.uid());

-- ALTER DEFAULT PRIVILEGES in the baseline migration auto-grants
-- SELECT/INSERT/UPDATE/DELETE on every new public table to anon and authenticated.
-- No explicit revoke here — RLS alone makes the table write-only in practice, the
-- same pattern already proven on public.characters. Revoking table-level SELECT or
-- UPDATE/DELETE grants doesn't just close reads: it changes the *error mode*. With
-- the grant present and RLS blocking, a SELECT with no matching policy returns zero
-- rows silently; an UPDATE/DELETE with no matching policy runs and affects zero rows.
-- Without the grant, those same statements throw "permission denied" before RLS is
-- ever consulted. That's a real behavior difference, not a cosmetic one, and it's
-- what broke assertions 7 and 8 in bug_reports.sql — do not reintroduce a revoke here.
