-- supabase/tests/bug_reports.sql
begin;
select plan(13);

-- 1. RLS is on
select ok(
  (select relrowsecurity from pg_class where oid = 'public.bug_reports'::regclass),
  'RLS is enabled on public.bug_reports'
);

-- Fixture: two auth users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

-- 2. anon can submit an anonymous report
set local role anon;
reset request.jwt.claims;

select lives_ok(
  $$ insert into public.bug_reports (category, message) values ('bug', 'anon report') $$,
  'anon can submit a report'
);

-- 3. anon cannot forge a user_id
select throws_ok(
  $$ insert into public.bug_reports (category, message, user_id)
     values ('bug', 'forged by anon', '11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  'anon cannot submit with a forged user_id'
);

-- 4. authenticated user can submit
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select lives_ok(
  $$ insert into public.bug_reports (category, message) values ('bug', 'bob report') $$,
  'authenticated user can submit a report'
);

-- 5. that submission was stamped with the real auth.uid()
--    (read as superuser — there is no select policy, so no client role can verify this)
reset role;
select is(
  (select user_id::text from public.bug_reports where message = 'bob report'),
  '22222222-2222-2222-2222-222222222222',
  'authenticated submission is stamped with the real auth.uid()'
);

-- 6. authenticated user cannot forge another user's id
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select throws_ok(
  $$ insert into public.bug_reports (category, message, user_id)
     values ('bug', 'forged by bob', '11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  'authenticated user cannot submit with another user''s user_id'
);

-- 7. authenticated user reads zero rows
select is(
  (select count(*)::int from public.bug_reports),
  0,
  'authenticated user cannot read any reports'
);

-- 8. anon reads zero rows
set local role anon;
reset request.jwt.claims;

select is(
  (select count(*)::int from public.bug_reports),
  0,
  'anon cannot read any reports'
);

-- 9. invalid category is rejected by the check constraint
select throws_ok(
  $$ insert into public.bug_reports (category, message) values ('nonsense', 'bad category') $$,
  '23514',
  null,
  'invalid category is rejected by the check constraint'
);

-- 10. invalid system is rejected by the check constraint
select throws_ok(
  $$ insert into public.bug_reports (category, message, system) values ('bug', 'bad system', 'pathfinder') $$,
  '23514',
  null,
  'invalid system is rejected by the check constraint'
);

-- 11. invalid platform is rejected by the check constraint
select throws_ok(
  $$ insert into public.bug_reports (category, message, platform) values ('bug', 'bad platform', 'windows') $$,
  '23514',
  null,
  'invalid platform is rejected by the check constraint'
);

-- 12. message over 5000 chars is rejected by the check constraint
select throws_ok(
  $$ insert into public.bug_reports (category, message) values ('bug', repeat('x', 5001)) $$,
  '23514',
  null,
  'message over 5000 characters is rejected by the check constraint'
);

-- 13. deleting the auth user orphans their reports (user_id -> null) rather than
--     cascading the delete or erroring — proven live during review, now regression-tested
reset role;
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';

select is(
  (select user_id from public.bug_reports where message = 'bob report'),
  null,
  'deleting the auth user sets user_id to null on their existing reports (FK on delete set null)'
);

select * from finish();
rollback;
