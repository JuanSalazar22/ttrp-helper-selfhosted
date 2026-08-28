-- supabase/tests/rls_characters.sql
begin;
select plan(12);

-- RLS is on
select ok(
  (select relrowsecurity from pg_class where oid = 'public.characters'::regclass),
  'RLS is enabled on public.characters'
);

-- Fixture: two auth users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.dev');

-- As Alice: full CRUD on her own row
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ insert into public.characters (id, user_id, system, data)
     values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'wfrp4e', '{}') $$,
  'owner can insert their own row'
);

select is(
  (select count(*)::int from public.characters where id = 'a0000000-0000-0000-0000-000000000001'),
  1,
  'owner can select their own row'
);

select lives_ok(
  $$ update public.characters set data = '{"hp":1}' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'owner can update their own row'
);

-- As Bob: zero visibility into Alice's row
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.characters where id = 'a0000000-0000-0000-0000-000000000001'),
  0,
  'non-owner cannot select another user''s row'
);

with updated as (
  update public.characters set data = '{"hacked":true}'
  where id = 'a0000000-0000-0000-0000-000000000001'
  returning 1
)
select is(
  (select count(*)::int from updated),
  0,
  'non-owner update affects zero rows'
);

with deleted as (
  delete from public.characters
  where id = 'a0000000-0000-0000-0000-000000000001'
  returning 1
)
select is(
  (select count(*)::int from deleted),
  0,
  'non-owner delete affects zero rows'
);

-- Insert impersonation: Bob cannot stamp a row as Alice's
select throws_ok(
  $$ insert into public.characters (id, user_id, system, data)
     values ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'wfrp4e', '{}') $$,
  '42501',
  null,
  'non-owner cannot insert a row impersonating another user'
);

-- As anon: no access at all
set local role anon;
reset request.jwt.claims;

select is(
  (select count(*)::int from public.characters),
  0,
  'anonymous role sees zero rows'
);

select throws_ok(
  $$ insert into public.characters (id, user_id, system, data)
     values ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'wfrp4e', '{}') $$,
  '42501',
  null,
  'anonymous role cannot insert'
);

-- Cleanup: Alice deletes her own row (proves owner-delete works, closes the loop)
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Update impersonation: Alice cannot reassign her own row to another user
select throws_ok(
  $$ update public.characters set user_id = '22222222-2222-2222-2222-222222222222'
     where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'owner cannot reassign a row to another user via update'
);

select lives_ok(
  $$ delete from public.characters where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'owner can delete their own row'
);

select * from finish();
rollback;
