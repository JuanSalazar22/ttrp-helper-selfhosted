# Supabase backend

Schema lives in `migrations/`, captured from and applied to the project linked via
`supabase link`. Local development runs the full stack in Docker.

## Making a schema change

1. `npm run db:start` (if not already running)
2. Edit schema via the local Studio (`http://127.0.0.1:54323`) or raw SQL against the
   local Postgres instance.
3. `npx supabase db diff -f <descriptive-name>` — generates a migration file from
   what changed.
4. `npx supabase db reset` — replays every migration from empty against the local
   stack, verifying the new one works from a clean state, not just incrementally.
5. `npm run test:db` — pgTAP must still pass.
6. **Before the first push of the day:** `npx supabase db dump -f backup-$(date +%Y%m%d).sql`
   from the production side. The free tier has no point-in-time recovery, so this
   file is the only rollback path if a migration does something unexpected in prod.
7. `npx supabase db push` — applies the migration to production.

Note: default privileges auto-grant EXECUTE on new functions to anon/authenticated —
REVOKE explicitly if a function shouldn't be public-callable.

## Local stack URLs

If schema was changed directly in the Supabase dashboard (drift), pull it back with
`supabase db pull` before making further local changes, or the next push silently
overwrites the dashboard change.

- API: `http://127.0.0.1:54321`
- Studio: `http://127.0.0.1:54323`
- A physical device needs the host machine's LAN IP in place of `127.0.0.1`.
- The Android emulator needs `10.0.2.2` in place of `127.0.0.1`.
