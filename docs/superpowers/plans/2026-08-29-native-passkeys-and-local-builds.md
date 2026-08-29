# Native Passkeys + Local Device Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (NOT subagent-driven-development — see note below). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install this app on real iOS and Android devices via fully local tooling (no paid developer accounts), and make passkey login/registration/device-linking actually work on native, backed by the already-live `ttrp-helper.duckdns.org` backend.

**Architecture:** `react-native-passkeys` (Expo module, autolinked, no plugin of its own) slots into the native branch of the existing `src/auth/webauthn.ts` wrapper — `AuthProvider.tsx` and `AccountSheet.tsx` need zero changes. Two new static files under `public/.well-known/` prove domain ownership to iOS/Android so the OS lets the app act as a WebAuthn authenticator for `ttrp-helper.duckdns.org`. Both platforms build via `npx expo run:<platform> --device` — no EAS, no store accounts.

**Tech Stack:** `react-native-passkeys` (native WebAuthn client), `expo-build-properties` (config plugin for iOS deployment target / Android compileSdkVersion), Xcode (already installed), Android Studio (installed in this plan).

**⚠️ Why NOT subagent-driven-development:** roughly half these tasks require the user's own hands — signing into Xcode with their Apple ID, running Android Studio's interactive setup wizard, plugging in a physical phone and tapping "Trust This Computer," and completing a real Face ID/Touch ID/fingerprint prompt. A subagent cannot do any of that. Execute this plan **inline, in conversation with the user**, pausing at every step marked **👤 USER ACTION** rather than trying to delegate or automate around them.

**Reference doc:** [2026-08-29-native-passkeys-and-local-builds-design.md](../specs/2026-08-29-native-passkeys-and-local-builds-design.md)

**Working directory:** `/Users/juan.salazar/Repos/ttrp-helper-selfhosted` (this is a config/tooling change on top of already-shipped, already-reviewed code — no new worktree needed; work directly on `main`, small frequent commits).

---

## Task 1: App identity — new bundle ID, package, and display name

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Edit `app.json`**

Change:
```json
    "name": "TTRP Helper",
```
to:
```json
    "name": "TTRP Helper (Self-Hosted)",
```

Change:
```json
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.juanjose220397.ttrphelper"
    },
```
to:
```json
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.juanjose220397.ttrphelperselfhosted"
    },
```

Change:
```json
    "android": {
      "package": "com.juanjose220397.ttrphelper",
```
to:
```json
    "android": {
      "package": "com.juanjose220397.ttrphelperselfhosted",
```

- [ ] **Step 2: Verify the config resolves correctly**

```bash
npx expo config --json | grep -E '"name"|"bundleIdentifier"|"package"'
```

Expected: `"name": "TTRP Helper (Self-Hosted)"`, `"bundleIdentifier": "com.juanjose220397.ttrphelperselfhosted"`, `"package": "com.juanjose220397.ttrphelperselfhosted"`.

- [ ] **Step 3: Commit**

```bash
git add app.json
git commit -m "chore: distinct bundle ID/package/name so this fork can coexist with the original app on one device"
```

---

## Task 2: 👤 USER ACTION — get the iOS Team ID

No files changed in this task — it produces one value (the Team ID) needed by Task 5.

- [ ] **Step 1: Ask the user to open Xcode, sign in with their Apple ID, and read off the Team ID**

Tell the user:

> Open Xcode → Settings (⌘,) → Accounts. If your Apple ID isn't listed, click **+** and sign in with any Apple ID (a free one is fine, no paid Developer Program needed). Once signed in, select your Apple ID in the left list, and your **Team** will show as "Your Name (Personal Team)" with a **Team ID** next to it — a 10-character code like `A1B2C3D4E5`. Tell me that Team ID.

- [ ] **Step 2: Record the value**

Once the user replies with their Team ID, hold onto it for Task 5 — do not proceed with Task 5 until you have it.

---

## Task 3: 👤 USER ACTION — install Android Studio and the Android SDK

**Files:** none — this is host machine setup.

- [ ] **Step 1: Install Android Studio**

```bash
brew install --cask android-studio
```

- [ ] **Step 2: Tell the user to complete the first-run setup wizard**

Tell the user:

> Open Android Studio from Applications (first launch only). Its Setup Wizard will ask you to install the Android SDK, SDK Platform-Tools, and an emulator image — accept the defaults and let it finish (it downloads several GB, may take a while). When it's done, open **More Actions → SDK Manager** once just to confirm it shows an installed SDK Platform. Let me know when that's done.

This step needs the user's own click-through — the wizard's license-acceptance dialogs aren't scriptable from here.

- [ ] **Step 3: Once the user confirms, verify the SDK is discoverable from the shell**

```bash
ls "$HOME/Library/Android/sdk" 2>&1
echo $ANDROID_HOME
```

Expected: the SDK directory listing shows folders like `platform-tools`, `platforms`, `build-tools`. If `$ANDROID_HOME` is empty, add to the user's shell profile (`~/.zshrc` — this is a Mac, per the environment) and re-source:

```bash
echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zshrc
echo 'export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"' >> ~/.zshrc
source ~/.zshrc
```

- [ ] **Step 4: Confirm `adb` works**

```bash
adb version
```

Expected: prints an Android Debug Bridge version string, not "command not found".

---

## Task 4: Extract the Android debug keystore's SHA256 fingerprint

**Files:** none — this produces one value needed by Task 5.

- [ ] **Step 1: Run keytool against the standard debug keystore**

Every Android dev machine has an auto-generated debug keystore at a fixed path with fixed, publicly-documented credentials (this is not a secret — it's identical on every machine by design, meant only for local development signing):

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android 2>&1 | grep "SHA256:"
```

If `~/.android/debug.keystore` doesn't exist yet, it's created the first time you build an Android app (Task 9 creates it if this file is missing) — in that case, come back to this step after Task 9's first build attempt.

Expected: a line like `SHA256: AB:CD:EF:...` (32 colon-separated hex pairs).

- [ ] **Step 2: Record the value**

Hold onto this fingerprint (with or without colons — Task 5 needs the colon-free lowercase form, so strip colons and lowercase it, e.g. `AB:CD:EF...` → `abcdef...`) for Task 5.

---

## Task 5: Associated-domain files

**Files:**
- Create: `public/.well-known/apple-app-site-association`
- Create: `public/.well-known/assetlinks.json`

Requires the Team ID from Task 2 and the SHA256 fingerprint from Task 4 — do not start this task without both values in hand.

- [ ] **Step 1: Create `public/.well-known/apple-app-site-association`**

No file extension. Replace `TEAMID` with the actual value from Task 2 (e.g. if the Team ID is `A1B2C3D4E5`, the app identifier becomes `A1B2C3D4E5.com.juanjose220397.ttrphelperselfhosted`):

```json
{
  "webcredentials": {
    "apps": ["TEAMID.com.juanjose220397.ttrphelperselfhosted"]
  }
}
```

- [ ] **Step 2: Create `public/.well-known/assetlinks.json`**

Replace `SHA256_FINGERPRINT_NO_COLONS_LOWERCASE` with the actual value from Task 4 (colons stripped, lowercase — `keytool` prints uppercase with colons, e.g. `AB:CD:EF:12` becomes `abcdef12`):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.juanjose220397.ttrphelperselfhosted",
      "sha256_cert_fingerprints": ["SHA256_FINGERPRINT_NO_COLONS_LOWERCASE"]
    }
  }
]
```

- [ ] **Step 3: Verify both files are valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('public/.well-known/apple-app-site-association'))" && echo "AASA OK"
node -e "JSON.parse(require('fs').readFileSync('public/.well-known/assetlinks.json'))" && echo "assetlinks OK"
```

Expected: both print their `OK` line, no JSON parse errors.

- [ ] **Step 4: Commit**

```bash
git add public/.well-known/
git commit -m "feat: associated-domain files for native passkeys (AASA + assetlinks.json)"
```

- [ ] **Step 5: Rebuild and redeploy the web build so these files are actually served**

These files only take effect once they're part of the deployed `dist/` — the live site at `ttrp-helper.duckdns.org` won't have them until you rebuild and redeploy:

```bash
ssh -i ~/Downloads/ssh-key-2026-08-24.key ubuntu@138.2.221.39 'cd ~/ttrp-helper-selfhosted && git pull && sudo docker compose up -d --build'
```

- [ ] **Step 6: Verify they're actually reachable**

```bash
curl -s https://ttrp-helper.duckdns.org/.well-known/apple-app-site-association
echo
curl -s https://ttrp-helper.duckdns.org/.well-known/assetlinks.json
```

Expected: both print the JSON content from Steps 1–2 (with real values substituted), not a 404.

---

## Task 6: Install `react-native-passkeys` and update `webauthn.ts`

**Files:**
- Modify: `package.json` (adds `react-native-passkeys`, `expo-build-properties`)
- Modify: `app.json` (adds the `expo-build-properties` plugin config and `ios.associatedDomains`)
- Modify: `src/auth/webauthn.ts`

- [ ] **Step 1: Install the packages via `expo install` (resolves versions compatible with this project's Expo SDK, unlike plain `npm install`)**

```bash
npx expo install react-native-passkeys expo-build-properties
```

- [ ] **Step 2: Add the plugin config and associated domains to `app.json`**

Change:
```json
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.juanjose220397.ttrphelperselfhosted"
    },
```
to:
```json
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.juanjose220397.ttrphelperselfhosted",
      "associatedDomains": ["webcredentials:ttrp-helper.duckdns.org"]
    },
```

Change:
```json
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-sharing"
    ],
```
to:
```json
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-sharing",
      [
        "expo-build-properties",
        {
          "ios": { "deploymentTarget": "15.0" },
          "android": { "compileSdkVersion": 34 }
        }
      ]
    ],
```

- [ ] **Step 3: Rewrite `src/auth/webauthn.ts`**

```typescript
import { Platform } from 'react-native';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { create as createNativePasskey, get as getNativePasskey } from 'react-native-passkeys';

/** Thin wrapper so AuthProvider doesn't import a WebAuthn client library directly —
 *  keeps the platform-specific shapes in one place. Web uses the browser's
 *  navigator.credentials API via @simplewebauthn/browser; native (iOS/Android) uses
 *  react-native-passkeys (ASAuthorization / Android Credential Manager under the hood). */
export async function createPasskey(options: any) {
  if (Platform.OS === 'web') return startRegistration({ optionsJSON: options });
  const result = await createNativePasskey(options);
  if (!result) throw new Error('Passkey creation was cancelled');
  return result;
}

export async function getPasskey(options: any) {
  if (Platform.OS === 'web') return startAuthentication({ optionsJSON: options });
  const result = await getNativePasskey(options);
  if (!result) throw new Error('Passkey sign-in was cancelled');
  return result;
}
```

- [ ] **Step 4: Verify the web path is unaffected**

```bash
npm run typecheck
npx jest src/auth
```

Expected: typecheck clean; no auth test files exist to run (jest reports "No tests found" for that path, same as before this change — `AuthProvider`/`webauthn.ts` have no dedicated test files in this codebase).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json src/auth/webauthn.ts
git commit -m "feat(auth): native passkeys via react-native-passkeys, branched in webauthn.ts"
```

---

## Task 7: Remove native Account-UI gating

**Files:**
- Modify: `app/(tabs)/settings.tsx`
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Un-gate the Account section in `app/(tabs)/settings.tsx`**

Change:
```typescript
      {Platform.OS === 'web' && (
        <>
          <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.account.title')}</Text>
          <TouchableOpacity
            style={[styles.row, { borderColor: t.colors.border }]}
            onPress={() => setShowAccount(true)}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={t.colors.accent} />
            ) : (
              <Text style={[styles.rowLabel, { color: t.colors.text }]} numberOfLines={1}>
                {session
                  ? tr('settings.account.signedInAs', { name: session.user.name })
                  : tr('settings.account.signInWithPasskey')}
              </Text>
            )}
            <ChevronRight size={18} color={t.colors.textMuted} />
          </TouchableOpacity>
          <AccountSheet visible={showAccount} onClose={() => setShowAccount(false)} />
        </>
      )}
```
to:
```typescript
      <Text style={[styles.section, { color: t.colors.textSecondary }]}>{tr('settings.account.title')}</Text>
      <TouchableOpacity
        style={[styles.row, { borderColor: t.colors.border }]}
        onPress={() => setShowAccount(true)}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator color={t.colors.accent} />
        ) : (
          <Text style={[styles.rowLabel, { color: t.colors.text }]} numberOfLines={1}>
            {session
              ? tr('settings.account.signedInAs', { name: session.user.name })
              : tr('settings.account.signInWithPasskey')}
          </Text>
        )}
        <ChevronRight size={18} color={t.colors.textMuted} />
      </TouchableOpacity>
      <AccountSheet visible={showAccount} onClose={() => setShowAccount(false)} />
```

`Platform` stays imported in this file — it's still used elsewhere (the `useDb`/`getSettingFn`/`setSettingFn` guards near the top of the file).

- [ ] **Step 2: Un-gate the account button in `app/(tabs)/index.tsx`**

Change:
```typescript
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: t.colors.backgroundSecondary }]}
              onPress={() => setShowAccount(true)}
              activeOpacity={0.8}
            >
              {session && displayName ? (
                <View style={[styles.avatarBadge, { backgroundColor: t.colors.accent }]}>
                  <Text style={[styles.avatarChar, { color: t.colors.accentText }]}>
                    {(displayName ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
              ) : (
                <User size={18} color={t.colors.accent} />
              )}
            </TouchableOpacity>
          )}
```
to:
```typescript
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: t.colors.backgroundSecondary }]}
            onPress={() => setShowAccount(true)}
            activeOpacity={0.8}
          >
            {session && displayName ? (
              <View style={[styles.avatarBadge, { backgroundColor: t.colors.accent }]}>
                <Text style={[styles.avatarChar, { color: t.colors.accentText }]}>
                  {(displayName ?? '?')[0].toUpperCase()}
                </Text>
              </View>
            ) : (
              <User size={18} color={t.colors.accent} />
            )}
          </TouchableOpacity>
```

`Platform` is now unused in this file (this was its only usage) — remove it from the import line:

Change:
```typescript
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator, Platform } from 'react-native';
```
to:
```typescript
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
grep -n "Platform" "app/(tabs)/index.tsx"
```

Expected: typecheck clean; the grep returns nothing (confirming the unused import is fully gone, not just its one call site).

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/settings.tsx" "app/(tabs)/index.tsx"
git commit -m "feat: show Account UI on native now that native passkeys work"
```

---

## Task 8: 👤 USER ACTION — first iOS device build

**Files:** none (generates gitignored `ios/` via prebuild).

- [ ] **Step 1: Tell the user to connect their iPhone**

> Plug your iPhone into this Mac via USB (or make sure it's on the same Wi-Fi if you've set up wireless debugging before). If a "Trust This Computer?" prompt appears on the phone, tap Trust and enter your passcode.

- [ ] **Step 2: Run the build**

```bash
npx expo run:ios --device
```

This prebuilds a native `ios/` project (first run only; picks up the new bundle ID, associated domains, and the `react-native-passkeys` native module) and installs it on the connected device. Expect this to take several minutes on first run (CocoaPods install + full Xcode build).

- [ ] **Step 3: 👤 USER ACTION — trust the developer certificate on-device**

> The first launch may show "Untrusted Developer" on the phone. Go to Settings → General → VPN & Device Management → (your Apple ID) → **Trust**. Then relaunch the app from the home screen.

- [ ] **Step 4: Verify the app launches and core functionality still works**

Ask the user to confirm: the app opens to the Characters tab, they can create a character (tap **+**, pick a system, name it, Create), and it appears in the list. This exercises native `expo-sqlite` (a different code path from the web build's `wa-sqlite`) — a regression check, not new functionality.

---

## Task 9: 👤 USER ACTION — first Android device build

**Files:** none (generates gitignored `android/` via prebuild).

- [ ] **Step 1: Tell the user to connect their Android phone**

> Enable Developer Options and USB debugging on your Android phone (Settings → About Phone → tap Build Number 7 times, then Settings → Developer Options → USB debugging: on). Plug it in via USB, and tap "Allow" on the "Allow USB debugging?" prompt that appears on the phone.

- [ ] **Step 2: Confirm the device is visible**

```bash
adb devices
```

Expected: lists the phone with status `device` (not `unauthorized` — if unauthorized, check the phone for the debugging prompt and tap Allow).

- [ ] **Step 3: Run the build**

```bash
npx expo run:android --device
```

First run generates the debug keystore at `~/.android/debug.keystore` if Task 4 hadn't already triggered it — if Task 4 was skipped earlier for this reason, go back and run Task 4 now that the keystore exists, then redo Task 5 with the real fingerprint before continuing.

- [ ] **Step 4: Verify the app launches and core functionality still works**

Same check as Task 8 Step 4, on the Android device.

---

## Task 10: 👤 USER ACTION — real passkey registration on iOS

**Files:** none — this is a live verification against the deployed backend.

- [ ] **Step 1: Register a passkey on the iOS device**

> In the app on your iPhone, go to Settings → Account → "Create account with passkey," enter a name, and tap through. You should see the native "Save a Passkey?" / Face ID / Touch ID prompt — complete it.

- [ ] **Step 2: If it fails, debug systematically rather than guessing**

Common failure points, in likely order:
- **"Passkey creation was cancelled" immediately, no prompt at all:** the associated domain isn't verified — re-check Task 5's `apple-app-site-association` is reachable (`curl https://ttrp-helper.duckdns.org/.well-known/apple-app-site-association`) and that the Team ID substituted into it is exactly right (case-sensitive, no typos). iOS caches AASA lookups per-device; a fresh install of the app on-device forces a re-fetch.
- **Prompt appears, completes, but the app shows a server error:** the credential response shape from `react-native-passkeys` may not exactly match what `@simplewebauthn/server`'s `verifyRegistrationResponse` expects (this is the one genuinely unverified integration point called out in the design doc). Check the actual error via `ssh -i ~/Downloads/ssh-key-2026-08-24.key ubuntu@138.2.221.39 'sudo docker compose -f ~/ttrp-helper-selfhosted/docker-compose.yml logs api --tail 30'` on the server, and compare the shape of what was sent (add a temporary `console.log(JSON.stringify(credential))` in `AuthProvider.tsx`'s `registerPasskey` if needed) against what `verifyRegistrationResponse` in `api/server.js` expects (`id`, `rawId`, `type`, `response.attestationObject`, `response.clientDataJSON`, all base64url strings). Fix by mapping any mismatched field names in `webauthn.ts`'s native branch — do not change the backend, which is already correct and already proven against the web client.

- [ ] **Step 3: Once registration succeeds, verify on the server**

```bash
ssh -i ~/Downloads/ssh-key-2026-08-24.key ubuntu@138.2.221.39 'sudo cat ~/ttrp-helper-selfhosted/data/db.json'
```

Expected: shows the new user + credential entry.

---

## Task 11: 👤 USER ACTION — real passkey registration on Android

**Files:** none.

- [ ] **Step 1: Register a passkey on the Android device**

> Same as Task 10, on the Android device. You should see Android's Credential Manager / fingerprint prompt.

- [ ] **Step 2: If it fails, use the same debugging approach as Task 10 Step 2**

Additional Android-specific check: if the OS silently does nothing (no prompt, no error), re-verify `assetlinks.json`'s `sha256_cert_fingerprints` matches the ACTUAL signing key of the installed build — re-run Task 4's `keytool` command and diff against what's in `public/.well-known/assetlinks.json` on the deployed site; a mismatch here fails silently on Android by design (per the library's own docs), which is the most likely culprit if nothing visibly happens.

- [ ] **Step 3: Verify on the server**, same command as Task 10 Step 3 — confirm a second credential (or second user, if tested independently) shows up correctly.

---

## Task 12: Cross-device verification and final commit

**Files:** none — verification only, unless Task 10/11 required source fixes (in which case those are already committed in their own tasks).

- [ ] **Step 1: Sync round-trip**

Create a character on the iOS device (signed in). On the web build (`https://ttrp-helper.duckdns.org`, signed into the *same* account — link the device first per Step 2 below if it's a fresh session), confirm the character appears after a refresh/re-open.

- [ ] **Step 2: Device-linking between native and web**

On the iOS (or Android) device, signed in: Account → "Add this device," note the 6-digit code. On the web build in a browser, choose "I have a code from another device," enter it, complete the passkey prompt there. Confirm both surfaces now show the same account/characters.

- [ ] **Step 3: Update the design spec's status**

Edit `docs/superpowers/specs/2026-08-29-native-passkeys-and-local-builds-design.md`, changing the `**Status:**` line from "Approved design (brainstorming) → ready for implementation plan" to "Implemented — verified on \<iOS device model\> and \<Android device model\>, 2026-08-29" (fill in the actual device models used).

- [ ] **Step 4: Commit and push**

```bash
git add docs/superpowers/specs/2026-08-29-native-passkeys-and-local-builds-design.md
git commit -m "docs: mark native passkeys + local builds spec as implemented and verified"
git push
```
