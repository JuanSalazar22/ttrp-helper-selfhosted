# Cloud Sync — Phase 1: Magic-Link Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, secure magic-link sign-in (Supabase Auth) to the app without changing any existing offline behavior — the foundation the later sync phases build on.

**Architecture:** The app talks to Supabase directly with the public **anon** key. Sign-in is passwordless (email magic link, PKCE flow). The session is persisted in `expo-secure-store` on native (chunked to dodge the size cap) and `localStorage` on web. An `AuthProvider` exposes session state app-wide. The app stays fully usable signed-out; if Supabase keys are absent, the Account UI simply hides (offline-first preserved).

**Tech Stack:** Expo SDK 56 · TypeScript (strict) · `@supabase/supabase-js` v2 · `expo-secure-store` · `expo-linking` · `react-native-url-polyfill` · jest-expo. Verify: `npm run typecheck`, `npm test`.

**Spec:** `docs/superpowers/specs/2026-06-29-cloud-sync-and-accounts-design.md`

**Sequence:** This is Plan 1 of 4. Later plans: Phase 2 (one-way backup), Phase 3 (two-way sync), Phase 4 (harden). The `characters` table SQL is created here (Task 1) so the dashboard is set up once, but it is not exercised until Phase 2.

---

## File map

| File | Change |
|---|---|
| `.env`, `.env.example` | Create — Supabase URL + anon key (`.env` gitignored) |
| `src/lib/config.ts` | Create — read `EXPO_PUBLIC_*` keys; `enabled` flag |
| `src/lib/secureStorage.ts` | Create — chunked `expo-secure-store` adapter (native) / localStorage (web) |
| `src/lib/__tests__/secureStorage.test.ts` | Create — chunk round-trip + delete |
| `src/lib/supabase.ts` | Create — Supabase client (PKCE, persisted session) |
| `src/auth/email.ts` | Create — `isValidEmail` pure helper |
| `src/auth/__tests__/email.test.ts` | Create — validation cases |
| `src/auth/AuthProvider.tsx` | Create — session context + magic-link sign-in + deep-link exchange |
| `app/_layout.tsx` | Modify — mount `AuthProvider` |
| `app.json` | Modify — ensure `scheme` for deep links |
| `app/(tabs)/settings.tsx` | Modify — add Account (sign in / out) section |
| `src/i18n/en.ts`, `src/i18n/es.ts` | Modify — `settings.account.*` keys |

---

## Task 1: Supabase project + dashboard setup (manual)

No app code. Done once by a human in the Supabase dashboard. Record two values for Task 2.

- [ ] **Step 1: Create the project**

Go to https://supabase.com → New project (free tier). Pick a region near you. After it provisions, open **Project Settings → API** and copy:
- **Project URL** (e.g. `https://abcd1234.supabase.co`)
- **anon public** key (the long `eyJ…` JWT). *Never copy the `service_role` key into the app.*

- [ ] **Step 2: Enable magic-link email auth**

**Authentication → Providers → Email**: enable it; turn **Confirm email** ON; magic links are enabled by default. **Authentication → URL Configuration → Redirect URLs**, add:
- `ttrphelper://auth/callback` (native deep link)
- `http://localhost:8082/**` (local web dev)
- your Cloudflare web domain, e.g. `https://ttrp-helper.pages.dev/**` (production web)

- [ ] **Step 3: Create the `characters` table + RLS** (used from Phase 2; set up now)

**SQL Editor → New query**, run:

```sql
create table public.characters (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  system text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.characters enable row level security;

create policy "owner can read"   on public.characters for select using (auth.uid() = user_id);
create policy "owner can insert" on public.characters for insert with check (auth.uid() = user_id);
create policy "owner can update" on public.characters for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner can delete" on public.characters for delete using (auth.uid() = user_id);
```

- [ ] **Step 4: Verify RLS is on**

In **Table Editor → characters**, confirm the shield/"RLS enabled" badge shows. If a table ever shows "RLS disabled", stop and fix before storing data.

---

## Task 2: Install deps + config module

**Files:**
- Create: `.env`, `.env.example`, `src/lib/config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npx expo install @supabase/supabase-js expo-secure-store expo-linking react-native-url-polyfill
```
Expected: packages added to `package.json`; no peer-dep errors.

- [ ] **Step 2: Create `.env.example` (committed) and `.env` (gitignored)**

`.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```
Copy it to `.env` and fill in the two values from Task 1. (`EXPO_PUBLIC_*` vars are inlined into the client bundle by Expo — the anon key is meant to be public and is safe there; RLS protects the data.)

- [ ] **Step 3: Gitignore `.env`**

Add to `.gitignore`:
```
.env
```

- [ ] **Step 4: Create `src/lib/config.ts`**

```ts
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase connection config. `enabled` is false when keys are absent, so the app
 *  degrades to fully-local (the Account UI hides) instead of crashing. */
export const supabaseConfig = {
  url,
  anonKey,
  enabled: Boolean(url && anonKey),
};
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore src/lib/config.ts
git commit -m "feat(auth): add supabase deps and config module"
```

---

## Task 3: Chunked secure-storage adapter (TDD)

`expo-secure-store` caps values (~2 KB on Android); a Supabase session can exceed that. The adapter chunks large values across keys.

**Files:**
- Create: `src/lib/secureStorage.ts`
- Test: `src/lib/__tests__/secureStorage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { makeSecureStoreAdapter } from '../secureStorage';

// In-memory mock of expo-secure-store
const store = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (k: string) => Promise.resolve(store.has(k) ? store.get(k)! : null),
  setItemAsync: (k: string, v: string) => { store.set(k, v); return Promise.resolve(); },
  deleteItemAsync: (k: string) => { store.delete(k); return Promise.resolve(); },
}));

beforeEach(() => store.clear());

describe('secure store adapter', () => {
  const a = makeSecureStoreAdapter();

  it('round-trips a small value', async () => {
    await a.setItem('k', 'hello');
    expect(await a.getItem('k')).toBe('hello');
  });

  it('round-trips a value larger than one chunk', async () => {
    const big = 'x'.repeat(5000);
    await a.setItem('sess', big);
    expect(await a.getItem('sess')).toBe(big);
    expect(store.size).toBeGreaterThan(1); // stored as multiple chunks
  });

  it('removeItem clears all chunks', async () => {
    await a.setItem('sess', 'y'.repeat(5000));
    await a.removeItem('sess');
    expect(await a.getItem('sess')).toBeNull();
    expect(store.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- secureStorage`
Expected: FAIL — `makeSecureStoreAdapter` is not defined.

- [ ] **Step 3: Implement `src/lib/secureStorage.ts`**

```ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const HEAD = '__chunks__:';

async function getItem(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(key);
  if (head == null) return null;
  if (!head.startsWith(HEAD)) return head;
  const count = parseInt(head.slice(HEAD.length), 10);
  let out = '';
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part == null) return null;
    out += part;
  }
  return out;
}

async function setItem(key: string, value: string): Promise<void> {
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const count = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(key, `${HEAD}${count}`);
  for (let i = 0; i < count; i++) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

async function removeItem(key: string): Promise<void> {
  const head = await SecureStore.getItemAsync(key);
  if (head?.startsWith(HEAD)) {
    const count = parseInt(head.slice(HEAD.length), 10);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(key);
}

/** supabase-js auth storage interface, backed by chunked SecureStore. */
export function makeSecureStoreAdapter() {
  return { getItem, setItem, removeItem };
}

// On web, returning undefined lets supabase-js fall back to localStorage.
export const authStorage = Platform.OS === 'web' ? undefined : makeSecureStoreAdapter();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- secureStorage`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/secureStorage.ts src/lib/__tests__/secureStorage.test.ts
git commit -m "feat(auth): chunked secure-store session adapter"
```

---

## Task 4: Supabase client

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Implement the client**

```ts
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config';
import { authStorage } from '@/lib/secureStorage';

// Falls back to harmless placeholders when unconfigured so imports never throw;
// `supabaseConfig.enabled` gates all real use.
export const supabase = createClient(
  supabaseConfig.url ?? 'http://localhost',
  supabaseConfig.anonKey ?? 'anon-placeholder',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  }
);
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(auth): supabase client (pkce, persisted session)"
```

---

## Task 5: Email helper (TDD)

**Files:**
- Create: `src/auth/email.ts`
- Test: `src/auth/__tests__/email.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { isValidEmail } from '../email';

describe('isValidEmail', () => {
  it.each(['a@b.co', ' user@example.com '])('accepts %p', (v) => {
    expect(isValidEmail(v)).toBe(true);
  });
  it.each(['', 'nope', 'a@b', 'a@b.', '@b.co'])('rejects %p', (v) => {
    expect(isValidEmail(v)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- email`
Expected: FAIL — `isValidEmail` not defined.

- [ ] **Step 3: Implement `src/auth/email.ts`**

```ts
/** Pragmatic email check for gating the "send link" button (not RFC-complete). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- email`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/auth/email.ts src/auth/__tests__/email.test.ts
git commit -m "feat(auth): email validation helper"
```

---

## Task 6: AuthProvider (session + sign-in + deep-link exchange)

**Files:**
- Create: `src/auth/AuthProvider.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { supabaseConfig } from '@/lib/config';

type AuthState = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore + subscribe to session changes.
  useEffect(() => {
    if (!supabaseConfig.enabled) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Native: turn the magic-link redirect (?code=…) into a session. Web is handled by
  // detectSessionInUrl in the client config.
  useEffect(() => {
    if (!supabaseConfig.enabled || Platform.OS === 'web') return;
    const handle = async (url: string | null) => {
      if (!url) return;
      const code = Linking.parse(url).queryParams?.code;
      if (typeof code === 'string') await supabase.auth.exchangeCodeForSession(code);
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  const signIn = useCallback(async (email: string) => {
    const emailRedirectTo = Linking.createURL('auth/callback');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo, shouldCreateUser: true },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return (
    <AuthContext.Provider value={{ session, loading, configured: supabaseConfig.enabled, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/auth/AuthProvider.tsx
git commit -m "feat(auth): AuthProvider with magic-link sign-in"
```

---

## Task 7: Mount provider + deep-link scheme

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app.json`

- [ ] **Step 1: Ensure the URL scheme**

In `app.json`, confirm the Expo config has a `scheme` (deep links use it). If missing, add under `"expo"`:
```json
"scheme": "ttrphelper",
```
(The redirect URLs in Task 1 Step 2 must match this scheme: `ttrphelper://auth/callback`.)

- [ ] **Step 2: Wrap the app with `AuthProvider`**

In `app/_layout.tsx`, import the provider and wrap the existing tree (place it just inside the outermost provider, alongside `ThemeProvider`/`LocaleProvider`):
```tsx
import { AuthProvider } from '@/auth/AuthProvider';
```
Wrap the existing children:
```tsx
<AuthProvider>
  {/* …existing providers / Stack… */}
</AuthProvider>
```
Match the file's current provider nesting; do not reorder the existing providers.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck` → no errors.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app.json
git commit -m "feat(auth): mount AuthProvider and deep-link scheme"
```

---

## Task 8: Account UI in Settings + i18n

**Files:**
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts`
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: Add i18n keys**

In `src/i18n/en.ts`, inside the `settings` object, add:
```ts
    account: {
      title: 'Account',
      subtitle: 'Sign in to sync and back up your characters.',
      emailPlaceholder: 'you@example.com',
      sendLink: 'Send magic link',
      sending: 'Sending…',
      linkSent: 'Check your email for a sign-in link.',
      signedInAs: 'Signed in as {email}',
      signOut: 'Sign out',
      invalidEmail: 'Enter a valid email.',
      error: 'Could not send the link. Try again.',
    },
```
In `src/i18n/es.ts`, inside `settings`, add the same keys translated:
```ts
    account: {
      title: 'Cuenta',
      subtitle: 'Inicia sesión para sincronizar y respaldar tus personajes.',
      emailPlaceholder: 'tu@ejemplo.com',
      sendLink: 'Enviar enlace mágico',
      sending: 'Enviando…',
      linkSent: 'Revisa tu correo para el enlace de acceso.',
      signedInAs: 'Sesión iniciada como {email}',
      signOut: 'Cerrar sesión',
      invalidEmail: 'Introduce un correo válido.',
      error: 'No se pudo enviar el enlace. Inténtalo de nuevo.',
    },
```

- [ ] **Step 2: Add the Account section to `settings.tsx`**

Add imports near the top. `useState` is **already** imported from `react` in this file — don't re-add it. Extend the existing `react-native` import line with `TextInput, ActivityIndicator`, and add:
```tsx
import { useAuth } from '@/auth/AuthProvider';
import { isValidEmail } from '@/auth/email';
```
Inside the component, add state + handler:
```tsx
const { session, loading, configured, signIn, signOut } = useAuth();
const [email, setEmail] = useState('');
const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

async function onSend() {
  if (!isValidEmail(email)) { setStatus('error'); return; }
  setStatus('sending');
  const { error } = await signIn(email);
  setStatus(error ? 'error' : 'sent');
}
```
Render the section (place it above the `about` section). Reuse the existing `styles.section` label and `styles.row` patterns already in the file:
```tsx
{configured && (
  <>
    <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.account.title')}</Text>
    {loading ? (
      <View style={[styles.row, { borderColor: t.colors.border }]}><ActivityIndicator color={t.colors.accent} /></View>
    ) : session ? (
      <View style={[styles.row, { borderColor: t.colors.border }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]} numberOfLines={1}>
          {tr('settings.account.signedInAs', { email: session.user.email ?? '' })}
        </Text>
        <TouchableOpacity onPress={signOut}><Text style={{ color: t.colors.accent, fontWeight: '600' }}>{tr('settings.account.signOut')}</Text></TouchableOpacity>
      </View>
    ) : status === 'sent' ? (
      <View style={[styles.row, { borderColor: t.colors.border }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]}>{tr('settings.account.linkSent')}</Text>
      </View>
    ) : (
      <View style={{ gap: 8 }}>
        <TextInput
          style={[styles.row, { borderColor: t.colors.border, color: t.colors.text }]}
          value={email}
          onChangeText={(v) => { setEmail(v); if (status === 'error') setStatus('idle'); }}
          placeholder={tr('settings.account.emailPlaceholder')}
          placeholderTextColor={t.colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          inputMode="email"
        />
        <TouchableOpacity
          style={[styles.segBtn, { borderColor: t.colors.accent, backgroundColor: t.colors.accent + '18', opacity: status === 'sending' ? 0.6 : 1 }]}
          disabled={status === 'sending'}
          onPress={onSend}
        >
          <Text style={[styles.segText, { color: t.colors.accent }]}>
            {status === 'sending' ? tr('settings.account.sending') : tr('settings.account.sendLink')}
          </Text>
        </TouchableOpacity>
        {status === 'error' && (
          <Text style={{ color: t.colors.danger, fontSize: 12 }}>
            {isValidEmail(email) ? tr('settings.account.error') : tr('settings.account.invalidEmail')}
          </Text>
        )}
      </View>
    )}
  </>
)}
```
(If `styles.segBtn` / `styles.segText` differ in this file, reuse whatever button style the file already defines for segmented controls.)

- [ ] **Step 3: Typecheck + test**

Run: `npm run typecheck` → no errors.
Run: `npm test` → all green (existing suites + new `email`/`secureStorage`).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/es.ts "app/(tabs)/settings.tsx"
git commit -m "feat(auth): account sign-in/out section in settings"
```

---

## Task 9: Manual end-to-end verification

Auth's real flow needs a live project + email and can't be unit-tested. Verify by hand.

- [ ] **Step 1: Web sign-in**

With `.env` filled, run `npx expo start --web` (port 8082). Settings → Account → enter your email → "Send magic link" → UI shows "Check your email". Open the emailed link → it returns to the web app **signed in**; Settings now shows "Signed in as …". Reload → still signed in (session persisted).

- [ ] **Step 2: Native sign-in (deep link)**

Run on a device/simulator (`npx expo start`, press `i`/`a`). Repeat sign-in; tapping the email link should deep-link back into the app and land signed in. (If it doesn't, re-check the `ttrphelper://auth/callback` redirect URL in Task 1 Step 2 and the `scheme` in `app.json`.)

- [ ] **Step 2.5: Sign out**

Tap "Sign out" → returns to the email-entry state; reload → still signed out.

- [ ] **Step 3: Offline-first regression**

Temporarily blank the `.env` values (or run a build without them) → the Account section is **hidden** and every existing screen (character list, both sheets, dice, settings) works exactly as before. Restore `.env` after.

- [ ] **Step 4: Final checks**

Run: `npm run typecheck` (clean) and `npm test` (green). Confirm no `service_role` key appears anywhere in the repo: `grep -ri "service_role" src app .env.example` returns nothing.

---

## Definition of done (Phase 1)

- A user can sign in via magic link on web and native, and the session persists across reloads/restarts.
- Sign-out works.
- With Supabase keys absent, the app is byte-for-byte the offline-first app it is today (Account UI hidden, no crashes).
- `npm run typecheck` clean; `npm test` green (incl. new `email` + `secureStorage` suites).
- No `service_role` key anywhere; only the anon key is shipped.

## Not in this plan (later phases)

- **Phase 2 — Backup (one-way):** on save, upsert the character row to the `characters` table; on sign-in, pull rows into local. (Table + RLS already created in Task 1.)
- **Phase 3 — Two-way sync:** `last_synced_at`, pull-changed-on-open, last-write-wins per character, tombstone reconciliation, offline push queue.
- **Phase 4 — Harden:** session-refresh edge cases, "syncing…" indicator, account + data deletion, privacy policy.
