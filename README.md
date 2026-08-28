# TTRP Helper

A mobile-first, **offline-first** character sheet app for tabletop RPGs — built to be used **at the table** during a session. Fast HP edits, integrated dice, no login required (optional cloud sync if you want it).

Ships with two systems:

- **D&D 5e** — full sheet (abilities, saves, skills, combat, spells, inventory).
- **Warhammer Fantasy Roleplay 4e** — full sheet with a searchable library of official WFRP 4e content (skills, talents, spells, prayers, careers), bundled with permission for this non-commercial project; homebrew entries are supported too.

Runs on **iOS, Android, and the web** from one codebase.

Backlog, known issues, and deferred work live in [TODO.md](TODO.md).

## Features

**Character management**
- Create / duplicate / delete characters, grouped by system
- Inline rename + edit (name, header fields)
- Character search + tags across both systems
- Export & import a character as JSON (system share sheet on native, file on web)

**D&D 5e sheet**
- Ability scores with auto-calculated modifiers
- Saving throws (proficiency toggle)
- Skills (proficiency / expertise toggles)
- AC, initiative, speed, proficiency bonus
- HP (current / max / temp), hit dice, death saves
- Attacks (custom modifiers + damage dice)
- Spellcasting — slots (1–9) + prepared/known spells (free-text)
- Inventory with weight tracking
- Features & traits
- Conditions tracker

**WFRP 4e sheet**
- 10 Characteristics (base + advances + total)
- Skills (percentile, characteristic-linked)
- Talents with description-on-grant
- Career path + rank, editable status tier + standing, advance picker
- Species / race + origin system (pickers, editors, auto-grants)
- XP & advance-cost calculator
- Multi-effect buffs & debuffs — each buff carries a list of `{target, value}` effects; targets are any characteristic or movement
- Encumbered debuff derived automatically from carried encumbrance (synthetic, read-only card)
- Wounds (current / max, derived from SB / TB / WPB coefficients + modifier)
- Fate / Fortune, Resilience / Resolve
- Corruption (threshold derived from TB + WB + mod) & Sin trackers
- Armour by 6 locations + shield, editable AP grid with auto-fill from equipped armour
- Equippable weapons / armour / trappings; equipped items count −1 encumbrance
- Magic — spells / prayers (free-text)
- Character details panel (lore / description / relations)
- Wiki popup — tap a talent/skill/spell to read its (user-entered) description
- "Search the book" autocomplete for skills / talents / spells / prayers / trappings / careers

**Dice**
- Tap any rollable stat to roll it
- D&D d20 with advantage / disadvantage + crit detection
- WFRP d100 roll-under with Success Levels + difficulty picker
- Standalone dice roller (d4–d100, modifier, custom expression)
- Haptic feedback (toggleable)

**Platform & UX**
- iOS / Android / Web from one codebase
- SQLite persistence (native + `wa-sqlite` on web, survives reloads)
- Self-hosted (Docker) web deploy
- Light / dark / system theme, haptics toggle
- Landscape / wide-layout responsive columns with character portrait
- Internationalization — full EN/ES UI + Spanish WFRP content names
- Readability pass — WCAG AA contrast tokens + semantic text roles

**Cloud sync & accounts** *(optional — app works fully offline without signing in)*
- Passkey (WebAuthn) sign-in with device-linking, via the self-hosted backend
- User display name (account profile), header sign-in entry point + signed-in profile chip
- Automatic cloud backup — characters pushed to the self-hosted backend on every save
- Two-way cross-device sync — pull on sign-in, push on save, server-authoritative clock
- Sync status badge (syncing / backed up / offline / error) in character list
- Soft-delete propagation — deleting on one device removes from others
- Offline push queue — edits made offline retry automatically on reconnect

## Technical decisions

Why these choices — each one exists because the app has to render two very different rule systems, run offline at a game table, and stay maintainable as a solo side project.

- **Thin SQLite shell + JSON blob per character.** One row per character in `characters(id, system, name, portrait_uri, data, schema_ver, created_at, updated_at)`. The `data` column holds a system-specific JSON shape; the `system` column discriminates. A unified relational schema would be either huge (every field for every system) or generic (and feel terrible). JSON is also the export format, so no separate serializer.
- **Discriminated union in TypeScript.** `Character = Dnd5eCharacter | Wfrp4eCharacter`; the `system` field narrows the type in each render branch. Each system has its own type file + renderer under `src/components/<system>/`. Adding a system is a new type + renderer, no migration.
- **Per-system schema versioning + read-time migration.** Every character JSON carries a monotonic `schemaVer`. On load, a per-system `migrate*Character` normalizer folds older shapes into the current one. Data-shape changes never require a SQLite migration. Buff schema is currently at **v9** (multi-effect `{target, value}[]`); the migrator rewrites legacy `{characteristic, value}` buffs and is idempotent.
- **Derived state over stored state.** Wounds max, corruption threshold, encumbrance level, characteristic bonuses, effective movement, and the Encumbered debuff are all computed at read time from stored inputs. No state churn on rule changes, always in sync with base values. `buffTotal` flows through `displayBuffs` so manual buffs and the synthetic Encumbered stack through the same code path; `baseCharacteristicBonus` (stored-only path) breaks the derivation cycle at the encumbrance-max boundary.
- **Offline-first, cloud-optional.** All writes go local first (SQLite). The self-hosted backend is a layer on top: push on save, pull on sign-in, last-writer-wins by server-authoritative clock, tombstones for deletes, offline push queue that retries on reconnect. The app is fully functional without an account. (The original "no backend, ever" constraint was intentionally lifted in mid-2026 once local persistence was mature.)
- **i18n with typed `tr()`.** EN is the source of truth. ES is a `DeepPartial` overlay — missing keys fall through to EN. Placeholders use `{name}` interpolation. Content names (skills, talents, spells) are translated separately from UI copy.
- **Web via `wa-sqlite` + OPFS.** Requires cross-origin isolation (COOP/COEP). Dev headers are in `metro.config.js`; production headers ship via `web/nginx.conf.template` in this self-hosted deploy. `.wasm` assets are wired as extra Metro asset extensions.
- **Path alias `@/` → `src/`.** Wired in `tsconfig.json` and `babel.config.js`.
- **Typecheck raises the Node stack.** `npm run typecheck` sets `--stack-size=16000` — bare `tsc --noEmit` overflows on this codebase.

## Architecture

```
app/                     Expo Router routes
  (tabs)/                Characters · Dice · Settings
  character/[id].tsx     Sheet loader — branches on character.system
src/
  components/dnd5e/      D&D 5e sheet sections
  components/wfrp4e/     WFRP 4e sheet sections (Buffs, Combat, Resources, Trappings, WikiModal, …)
  components/ui/         Shared primitives (Section, Stepper, EditableNumber, modals, …)
  types/                 dnd5e.ts · wfrp4e.ts — types + migrators + derived helpers
  db/                    schema.ts · queries.ts — local SQLite (native + wa-sqlite on web)
  sync/                  Self-hosted backend push/pull, offline queue, reconcile
  auth/                  Passkey/WebAuthn wiring + AuthProvider
  lib/                   src/lib/api.ts (self-hosted backend client), config
  hooks/                 useCharacter, useCharacterList, useRoll, useWfrpRoll, useTheme, useWideLayout, useWfrpLibrary
  dice/                  engine.ts (d20) · wfrp.ts (d100 + Success Levels)
  i18n/                  en.ts (source) · es.ts (DeepPartial overlay) · tr()
  data/wfrp-content/     bundled WFRP library (skills / talents / spells / prayers / careers)
  tokens/                colors · spacing · typography
docs/superpowers/        design specs (specs/) + implementation plans (plans/)
json_book_information/   raw content source (pre-processed into src/data/wfrp-content)
```

**WFRP derived-state flow.** Stored characteristic advances → `baseCharacteristicBonus` → `encumbranceMaxValue` → `encumbranceLevel` → `encumberedBuff` (synthetic) → `displayBuffs` → `buffTotal` → `characteristicBonus` and `effectiveMovement` → Resources / Combat UI. The `baseCharacteristicBonus` step reads only stored buffs, which is what breaks the otherwise-circular derivation.

**Sync flow.** Local write → SQLite → push to the self-hosted backend (or queue if offline). Sign-in → pull → reconcile against local by server-authoritative `updated_at`. Delete → local tombstone → propagated on next sync.

## Getting started

```bash
npm install
npx expo start
```

Then:

- **iOS** — press `i` (needs Xcode + an installed simulator runtime), or scan the QR with **Expo Go**.
- **Android** — press `a` (needs Android Studio + an emulator), or scan the QR with **Expo Go**.
- **Web** — press `w`, or `npx expo start --web` → open the printed `localhost` URL.

> Expo Go must match **SDK 56**. expo-sqlite works in Expo Go, so the full app (incl. the WFRP sheet) runs there.

Cloud sync needs the self-hosted backend running — `docker compose up` per [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

### Web notes

Web uses `wa-sqlite`, which needs cross-origin isolation — handled in `metro.config.js` (`.wasm` assets + COOP/COEP headers) in dev. When **deploying** a web build, the host must send those same headers or the database won't initialize.

**Deploy:** this fork deploys via Docker Compose — `docker compose up -d --build` builds and serves the app (nginx + the self-hosted API), with the COOP/COEP headers shipped in [`web/nginx.conf.template`](web/nginx.conf.template). Step-by-step in [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Scripts

```bash
npm test                 # jest — dice + WFRP derived helpers + migrators + sync reconcile
npm run typecheck        # tsc --noEmit with raised Node stack
npm run build:web        # web bundle for deploy
npm run serve:web        # serve production web build locally with COOP/COEP headers
npx expo export -p ios   # verify the native bundle compiles
```

## Content & licensing

Built on the D&D 5e SRD and the WFRP 4e ruleset. The app bundles a searchable library of WFRP 4e content (careers, talents, skills, spells, prayers) **used with permission from Cubicle 7 for this non-commercial project**; you can also add your own homebrew. Warhammer Fantasy Roleplay is © Cubicle 7; D&D is © Wizards of the Coast.

Personal project — not affiliated with or endorsed by either publisher.
