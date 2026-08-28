# Email + Password Authentication — Design

Replaces magic-link sign-in with email + password. Email confirmation required on sign-up. Password reset via the same email mechanism. Magic link is removed (clean break, not preserved as a fallback).

## Decisions

| Area | Decision |
|---|---|
| Identifier | Email only — no separate username. Display name (already shipped) is the visible identity. |
| Auth methods | Email + password only. Magic link is removed. |
| Email confirmation | Required on sign-up (Supabase dashboard setting: **Confirm email = on**). Until confirmed, sign-in fails with `"Email not confirmed"`. |
| Password reset | Supabase's built-in `resetPasswordForEmail` → recovery link → new route updates the password. |
| Password rules | Minimum 8 chars client-side. Supabase enforces its own minimum server-side. |
| Form structure | Sign-in primary, "Create account" as a secondary link inside the same sheet (Approach B from brainstorm). |
| Architecture | Everything inside AccountSheet (5 states). One new route for the password-reset deep link. |

## Architecture

### `src/auth/AuthProvider.tsx`

`signIn(email)` is removed. Three new methods replace it:

```ts
signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
```

- `signInWithPassword` calls `supabase.auth.signInWithPassword({ email, password })`. Returns the supabase-js error message verbatim (already user-facing — e.g. `"Invalid login credentials"`, `"Email not confirmed"`).
- `signUp` calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: <auth/callback> } })`. `needsConfirmation` is `true` when the response `session` is `null` (the normal case when email-confirmation is enabled).
- `sendPasswordReset` calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <auth/reset-password> })`.

Existing `signOut`, `displayName`, `updateDisplayName`, `configured`, `loading`, `session` — unchanged.

The redirect URL is built with `Linking.createURL(...)` exactly like the current sign-in does.

### `src/components/ui/AccountSheet.tsx`

A `mode` state variable controls the rendered form. Five modes:

| Mode | Triggered by | Fields | Primary action | Secondary actions |
|---|---|---|---|---|
| `signIn` | Default when signed out, or "Back to sign in" | email, password | Sign in | "Forgot password?" → `forgot`; "New here? Create account →" → `signUp` |
| `signUp` | "Create account →" link | email, password, confirmPassword | Create account | "Back to sign in" → `signIn` |
| `forgot` | "Forgot password?" link | email | Send reset link | "Back to sign in" → `signIn` |
| `emailSent` | After `signUp` returns `needsConfirmation:true`, or after `forgot` succeeds | (none) | Close | (none) |
| `signedIn` | Session exists | avatar, email, display name input | Save name · Sign out | (none) |

Sheet close (`onClose`) resets mode back to `signIn` so the next open starts clean. `emailSent` carries a `kind: 'signUp' | 'reset'` so the message can say "check your email for a confirmation link" vs "for a password-reset link".

Client-side validation:
- Email format — existing `isValidEmail`.
- Password — `length >= 8`.
- Confirm password — must equal password (sign-up only).

Server-side errors surface in the same red-text error spot the current sign-in form uses.

### `app/auth/reset-password.tsx` (new route)

Why a route, not a sheet: the user arrives from an email link, possibly with the app not running. A route handles cold-start deep links cleanly; a sheet only makes sense over existing app content.

Flow:
1. Supabase emails `<app-url>/auth/reset-password?token_hash=…&type=recovery`.
2. Web client (`detectSessionInUrl: true`, already configured) exchanges the token automatically; emits `PASSWORD_RECOVERY` via `onAuthStateChange`. Native deep-link handling in `AuthProvider` already runs `exchangeCodeForSession` for `?code=…` query params, which Supabase uses on native too.
3. Route renders two password fields (new + confirm) + Submit.
4. Submit calls `supabase.auth.updateUser({ password })`. On success, `router.replace('/(tabs)/')`. On error, render the message.
5. If the user lands here without a valid recovery session (e.g. expired link), show "This link has expired" + a back-to-sign-in button.

### Existing `app/auth/callback.tsx`

Unchanged. Continues to handle the email-confirmation link from sign-up (and the password reset return on web, via `detectSessionInUrl`). The current code redirects to `/(tabs)/settings` after sign-in succeeds — fine for sign-up too.

## Supabase dashboard configuration

Required, **manual** step (the app cannot do this):
1. **Authentication → Sign-in/Sign-up → Email** — leave enabled.
2. **Authentication → Sign-in/Sign-up → Confirm email** — set **on**.
3. **Authentication → URL Configuration → Redirect URLs** — confirm the existing entries cover `/auth/callback` and add `/auth/reset-password` for both web origin(s) and the native scheme.

The magic-link template can be left untouched (we're not removing it from Supabase, just not calling it).

## i18n keys (new)

Added under `settings.account`:

| Key | English |
|---|---|
| `password` | Password |
| `passwordPlaceholder` | Your password |
| `confirmPassword` | Confirm password |
| `signIn` | Sign in |
| `createAccount` | Create account |
| `createAccountLink` | New here? Create account → |
| `backToSignIn` | Back to sign in |
| `forgotPassword` | Forgot password? |
| `sendResetLink` | Send reset link |
| `confirmEmailSent` | Check your email for a confirmation link. |
| `resetEmailSent` | Check your email for a password-reset link. |
| `passwordTooShort` | Password must be at least 8 characters. |
| `passwordMismatch` | Passwords do not match. |
| `newPassword` | New password |
| `updatePassword` | Update password |
| `passwordUpdated` | Password updated. |
| `linkExpiredReset` | This password-reset link has expired or was already used. Request a new one. |

Existing keys removed: `sendLink`, `sending`, `linkSent`, `signingIn` (magic-link wording — replaced).

## Tests

Pure logic only — there's no headless React Native test harness configured:

- `src/auth/__tests__/password.test.ts` (new) — `isValidPassword(p): boolean` ≥ 8 chars. Trivial but documents the rule.
- Existing `email.test.ts` still applies.

Component / integration testing is manual on device + web preview, same as Phase 1.

## Out of scope

- Social sign-in (Google, Apple).
- Username login (decided: email is identifier; display name covers identity).
- 2FA / MFA.
- Email-change flow.
- Removing magic-link from Supabase (just unused).

## Migration

No data migration. Users created via magic link have no password. On their next sign-in attempt, `signInWithPassword` will fail with `"Invalid login credentials"` — the same error any wrong password gives. They use "Forgot password?" to set one. This is acceptable for the current user count.
