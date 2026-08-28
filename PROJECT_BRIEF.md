# PROJECT BRIEF — RPG Character Tracker

> **For the AI agent reading this:** This file is the complete handoff. You have everything you need here. Do not ask the user to re-explain the project, the stack, or past decisions — they're documented below. If something is ambiguous, default to the constraints in Section 0 before asking.

---

## 0. Context for the Agent (read this first)

### Who the user is
- Solo developer working a few hours per week on this as a side project.
- Comfortable coding. Not a designer. Not a team. No budget for contractors.
- Lives in Colombia (Spanish-speaking; English is fine for code/comments).
- Plays TTRPGs and understands both D&D 5e and WFRP 4e mechanics.

### What this app is
A mobile-first, offline-first character sheet app for tabletop RPGs. Launches with **D&D 5e** and **Warhammer Fantasy Roleplay 4e** (WFRP 4e). Designed to be used **at the table during a session** — fast HP edits, integrated dice, no login required.

Competitive position: D&D Beyond dominates 5e but is expensive, online-only, and locked to 5e. WFRP 4e has almost no quality mobile tooling. The wedge is **polish + multi-system support + offline-first**.

### Hard constraints (do NOT propose changes to these)
- **No backend.** No servers, no auth, no sync, no real-time. Local-only.
- **No subscriptions.** One-time IAP only ($7.99 lifetime). TTRPG audience rejects subs.
- **No bundled copyrighted content.** D&D 5e SRD material is OK. WFRP 4e is owned by Cubicle 7 — ship the sheet structure as a blank framework where users enter their own talents/spells/careers. Frame this as "homebrew-friendly."
- **Two systems only at launch.** Pathfinder 2e, Call of Cthulhu, Shadowdark, Mörk Borg are explicitly deferred to post-launch.
- **No character creation wizard in v1.** Users fill blank sheets manually.
- **Side-project pace.** Do not propose CI/CD, team workflows, or anything that assumes >1 developer.

### Architectural decisions already made
- **Stack:** React Native + Expo, TypeScript, expo-sqlite, RevenueCat for IAP.
- **Data model:** Thin SQLite shell + a `data` JSON column per character. The `system` column discriminates between system-specific JSON shapes. (See Section 8.)
- **Approach for multi-system:** Separate sheet templates per system, NOT a generic adaptive sheet. Each system feels native.
- **Platform priority:** Mobile (iOS + Android via Expo). Web/PWA deferred.

### Tone for working with the user
Direct, opinionated, concrete. The user prefers code-level specifics over abstract advice. When suggesting options, give a recommendation, not a menu. If you disagree with a request, say so with reasoning.

---

## 1. Product Vision

A polished, mobile-first character sheet app that respects the differences between TTRPG systems instead of forcing them into a generic template. Built for use **at the table** — fast HP adjustments, integrated dice, works offline, no login required.

**Launch systems:**
- **D&D 5e** — the funnel. Largest audience, validates demand.
- **WFRP 4e** — the wedge. Passionate, underserved community. Shipped as a structural framework where users enter their own content (homebrew-friendly).

---

## 2. Feature List

### Core features (v1, must-have)

**Character management**
- Multiple characters per user, grouped by system
- Create / duplicate / delete / rename
- Character portrait (optional, local image)

**D&D 5e sheet**
- Ability scores (STR, DEX, CON, INT, WIS, CHA) with auto-calculated modifiers
- Saving throws with proficiency toggle
- Skills with proficiency / expertise toggles
- AC, initiative, speed, proficiency bonus
- HP (current, max, temp) with hit dice
- Attacks with custom modifiers and damage dice
- Spellcasting: slots (level 1–9) and prepared/known spells (free-text)
- Inventory with weight tracking
- Features & traits (free-text blocks)
- Conditions tracker (blinded, poisoned, exhaustion levels, etc.)

**WFRP 4e sheet**
- 10 Characteristics (WS, BS, S, T, I, Ag, Dex, Int, WP, Fel) with base + advances + total
- Skills as percentile values with characteristic links
- Talents (free-text entries, user-managed)
- Career path with current career and rank
- Wounds (current / max), with toughness bonus calculation
- Fate / Fortune (with spend/recover buttons)
- Resilience / Resolve
- Corruption and Sin trackers
- Ammunition tracker
- Encumbrance with strength bonus calc
- Spells / prayers as free-text entries

**Dice roller**
- Tap any rollable stat to roll it
- D&D 5e: d20 with advantage/disadvantage toggle, crit detection, modifier shown
- WFRP 4e: percentile rolls with success-level calculation, opposed test mode
- Roll history drawer (last 50 rolls)
- Satisfying animations and haptic feedback

**Utility**
- Notes per character (markdown-light)
- Export character as JSON file (share via system share sheet)
- Import character from JSON
- Dark mode (mandatory — most play happens in dim rooms)
- Light mode
- Offline-first; works at the table with no signal

### Paid tier (the monetization wall)

Free tier ships with **1 character total** across systems. Paid unlocks:
- Unlimited characters
- Custom dice macros (named rolls like "Sneak Attack" → 1d20+7, +2d6+4 sneak)
- iCloud / Google Drive backup
- Character portrait upload (free tier shows a default avatar)
- Multiple inventory presets (combat / town / downtime loadouts)
- PDF export of character sheet
- Future systems

**Pricing:** $7.99 one-time, lifetime. No subscriptions.

### Deferred (post-launch — do NOT build in v1)

- Character creation wizard
- Bundled spell/talent databases (licensing complications)
- Party view / GM tools
- Cross-device sync (would require a backend)
- Apple Watch companion
- Web version (PWA)
- Additional systems: Pathfinder 2e, Call of Cthulhu, Shadowdark, Mörk Borg
- Token-based VTT export

---

## 3. Build Plan (Phased)

### Phase 0 — Setup (1 weekend)
- Initialize Expo project with TypeScript
- React Navigation (stack + tabs)
- expo-sqlite for local storage
- Design tokens: color palette (parchment light + dark), typography pairing, spacing scale
- Pick icon set (Lucide or Phosphor)
- Set up RevenueCat sandbox account (no IAP wiring yet)

**Deliverable:** Empty app that builds and runs on iOS simulator and Android emulator.

### Phase 1 — D&D 5e sheet, read-only (1 weekend)
- Hardcode one example character in JSON
- Build the full 5e sheet UI: stats block, skills list, combat panel, inventory, spells
- No editing yet — get layout, hierarchy, and visual rhythm right
- This is ~80% of the design work for the whole app

**Deliverable:** A pixel-perfect, scrollable 5e sheet for one fake character.

### Phase 2 — D&D 5e editing + persistence (1–2 weekends)
- Tap any field to edit (HP, ability scores, inventory, attacks)
- Add / remove inventory rows, attacks, spells
- Persist changes to SQLite
- Character list screen with create / delete / duplicate
- Onboarding skipped for now; just a "New character" button

**Deliverable:** A real, editable, persisted 5e character sheet.

### Phase 3 — Dice roller (1 weekend)
- Tap to roll on any ability check, save, skill, attack, damage field
- Roll result modal with breakdown ("18 + 5 = 23")
- Roll history drawer
- Advantage / disadvantage toggle for 5e
- Crit detection
- Haptic feedback + a satisfying animation

**Deliverable:** Dice rolling that feels good enough that users *want* to use it.

### Phase 4 — WFRP 4e sheet (2 weekends)
- New sheet template with characteristics, advances, percentile skills
- WFRP dice logic: roll under target, calculate success levels (SL)
- Opposed test mode (player vs target SL)
- Wounds, Fate/Fortune, Resilience/Resolve, Corruption tracking
- Career/talents as free-text entries (no Cubicle 7 content bundled)
- System switcher in character creation

**Deliverable:** Two complete systems working side by side.

### Phase 5 — Polish + paid tier (1–2 weekends)
- Onboarding flow (3 screens max: "pick system", "name character", "start")
- RevenueCat integration; gate features behind paid tier
- Settings screen: theme, haptics, about, restore purchases
- Export/import UI
- Empty states, error states, loading states
- App icon, splash screen
- Accessibility pass: dynamic font sizes, screen reader labels

**Deliverable:** Shippable app with a paywall.

### Phase 6 — Beta + launch (2 weekends)
- TestFlight + Google Play internal testing
- Recruit 20–30 beta testers from r/dndnext and r/warhammerfantasyrpg
- Run a session at a real table using the app (critical)
- Iterate based on feedback (priority order: data loss bugs > at-table usability > polish)
- App Store listing: screenshots, description, keywords
- Launch posts on the two target subreddits
- Submit to TTRPG newsletter directories

**Deliverable:** Live in App Store and Google Play.

---

## 4. Total Timeline

**~10–12 weekends of focused work.** At a few hours per week, plan on 4–6 months calendar time. This is normal and healthy. The biggest risk is scope creep, not pace.

---

## 5. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope creep (new systems, homebrew engines, party tools) | Hard freeze on features after Phase 4. Ship first, expand on revenue. |
| 5e sheet feels generic / loses to free apps | Spend extra time on Phase 1 design. Polish is the wedge. |
| Bugs lose user data | SQLite migrations from day 1. Auto-backup JSON snapshots on every save. |
| Cubicle 7 licensing concern (WFRP) | Ship structural sheet only. No copyrighted content bundled. Market as "homebrew-friendly". |
| Two-sided design (D&D players don't care about WFRP, vice versa) | Sheet selector on first launch. System filter on character list. |
| Distribution / no one finds it | Subreddit launch posts, content in WFRP community (very tight-knit), Discord presence. |

---

## 6. Success Metrics (first 90 days post-launch)

- **500 installs total** (modest but realistic for a solo TTRPG app launch)
- **5% paid conversion** = 25 paying users
- **At $7.99 net ~$5.50 after stores** = ~$135 revenue
- **Real signal:** retention at day 30. If people are still opening the app a month later, push distribution.

Slow-burn, long-tail product, not a viral hit.

---

## 7. Data Model — Design Principle

Different TTRPG systems have wildly different sheet shapes. A unified relational schema would either be huge (every field for every system) or generic (and feel terrible).

**Solution:** A thin relational shell with a JSON blob per character. Each system has its own TypeScript type for the JSON shape and its own renderer.

This gives:
- Type safety per system (TS discriminated unions)
- Easy to add new systems (new type + new renderer; no migration)
- Easy export/import (the JSON is already the export format)
- Tiny SQLite footprint
- Migrations are per-system, not global

---

## 8. SQLite Schema

```sql
CREATE TABLE characters (
  id           TEXT PRIMARY KEY,        -- uuid
  system       TEXT NOT NULL,           -- 'dnd5e' | 'wfrp4e' (enum in TS)
  name         TEXT NOT NULL,
  portrait_uri TEXT,                    -- local file URI, optional
  data         TEXT NOT NULL,           -- JSON blob, shape depends on system
  schema_ver   INTEGER NOT NULL,        -- per-system schema version
  created_at   INTEGER NOT NULL,        -- unix ms
  updated_at   INTEGER NOT NULL         -- unix ms
);

CREATE INDEX idx_characters_system ON characters(system);
CREATE INDEX idx_characters_updated ON characters(updated_at DESC);

CREATE TABLE roll_history (
  id           TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,           -- "Stealth check", "Longsword attack"
  expression   TEXT NOT NULL,           -- "1d20+5"
  result       INTEGER NOT NULL,
  breakdown    TEXT NOT NULL,           -- JSON: individual dice, modifiers
  rolled_at    INTEGER NOT NULL
);

CREATE INDEX idx_rolls_character ON roll_history(character_id, rolled_at DESC);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Stores: theme, haptics_enabled, last_opened_character_id, paid_tier_unlocked, etc.

CREATE TABLE dice_macros (
  id           TEXT PRIMARY KEY,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,           -- "Sneak Attack"
  expression   TEXT NOT NULL,           -- "1d20+7;2d6+4"
  created_at   INTEGER NOT NULL
);
```

---

## 9. TypeScript Types

### D&D 5e

```typescript
type Dnd5eCharacter = {
  system: 'dnd5e';
  schemaVer: 1;

  // Bio
  name: string;
  class: string;          // free text, e.g. "Rogue 3 / Fighter 2"
  race: string;
  background: string;
  alignment: string;
  level: number;
  xp: number;

  // Core stats
  abilities: {
    str: number;          // 1-30
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };

  proficiencyBonus: number;

  // Saves: proficiency flag only; total is calculated
  saves: Record<keyof Dnd5eCharacter['abilities'], { proficient: boolean }>;

  // Skills
  skills: Record<string, {                       // "acrobatics", "stealth", etc.
    ability: keyof Dnd5eCharacter['abilities'];
    proficient: boolean;
    expertise: boolean;
    miscBonus: number;
  }>;

  // Combat
  ac: number;
  initiativeBonus: number;
  speed: number;
  hp: { current: number; max: number; temp: number };
  hitDice: { current: number; max: number; die: 'd6'|'d8'|'d10'|'d12' };
  deathSaves: { successes: number; failures: number };

  attacks: Array<{
    id: string;
    name: string;
    attackBonus: number;
    damage: string;          // "1d8+3 slashing"
    notes?: string;
  }>;

  // Spellcasting (optional - non-casters won't have it)
  spellcasting?: {
    ability: keyof Dnd5eCharacter['abilities'];
    slots: Record<1|2|3|4|5|6|7|8|9, { current: number; max: number }>;
    spells: Array<{
      id: string;
      name: string;
      level: number;
      prepared: boolean;
      notes?: string;
    }>;
  };

  // Inventory
  inventory: Array<{
    id: string;
    name: string;
    qty: number;
    weight: number;
    equipped?: boolean;
    notes?: string;
  }>;
  currency: { cp: number; sp: number; ep: number; gp: number; pp: number };

  // Free-text blocks
  featuresAndTraits: string;       // markdown
  proficienciesAndLanguages: string;
  backstory: string;

  // Status
  conditions: Array<{ name: string; notes?: string }>;
  exhaustionLevel: number;         // 0-6
};
```

### WFRP 4e

```typescript
type Wfrp4eCharacter = {
  system: 'wfrp4e';
  schemaVer: 1;

  // Bio
  name: string;
  species: string;
  currentCareer: string;
  careerPath: string[];           // ordered history of careers
  careerRank: 1 | 2 | 3 | 4;
  status: { tier: 'Brass' | 'Silver' | 'Gold'; standing: number };
  age: number;
  height: string;

  // Characteristics: 10 stats
  characteristics: {
    ws: { base: number; advances: number };   // Weapon Skill
    bs: { base: number; advances: number };   // Ballistic Skill
    s:  { base: number; advances: number };   // Strength
    t:  { base: number; advances: number };   // Toughness
    i:  { base: number; advances: number };   // Initiative
    ag: { base: number; advances: number };   // Agility
    dex:{ base: number; advances: number };   // Dexterity
    int:{ base: number; advances: number };   // Intelligence
    wp: { base: number; advances: number };   // Willpower
    fel:{ base: number; advances: number };   // Fellowship
  };
  // total = base + advances; calculated, not stored

  // Skills (user enters their own; not bundled)
  skills: Array<{
    id: string;
    name: string;
    characteristic: keyof Wfrp4eCharacter['characteristics'];
    advances: number;
    isAdvanced: boolean;            // requires advances to use
  }>;

  // Talents (free text per WFRP licensing)
  talents: Array<{
    id: string;
    name: string;
    timesTaken: number;
    description: string;
    tests?: string;                 // any associated test
  }>;

  // Combat / resources
  wounds: { current: number; max: number };       // max is calculated but stored too
  fate:     { current: number; max: number };
  fortune:  { current: number; max: number };
  resilience:{ current: number; max: number };
  resolve:  { current: number; max: number };

  // Sin & Corruption
  corruption: { current: number; threshold: number };
  sin: number;
  mutations: Array<{ id: string; name: string; type: 'physical' | 'mental' }>;

  // Encumbrance
  encumbranceMax: number;

  // Weapons (free entries)
  weapons: Array<{
    id: string;
    name: string;
    group: string;                  // "Basic", "Cavalry", "Flail", etc.
    encumbrance: number;
    range: string;
    damage: string;                 // "SB+4"
    qualities: string;
    notes?: string;
  }>;

  // Armour
  armour: Array<{
    id: string;
    name: string;
    locations: string[];            // "Head", "Body", "Arms", "Legs"
    encumbrance: number;
    ap: number;                     // armour points
    qualities: string;
  }>;
  armourPoints: { head: number; body: number; arms: number; legs: number };

  // Trappings (general inventory)
  trappings: Array<{
    id: string;
    name: string;
    encumbrance: number;
    qty: number;
    notes?: string;
  }>;
  wealth: { brass: number; silver: number; gold: number };

  // Spells / prayers (free text)
  spells: Array<{
    id: string;
    name: string;
    lore: string;                   // "Fire", "Beasts", etc. - user-entered
    castingNumber: number;
    range: string;
    target: string;
    duration: string;
    effect: string;
  }>;
  prayers: Array<{
    id: string;
    name: string;
    god: string;
    range: string;
    target: string;
    duration: string;
    effect: string;
  }>;

  // Free text
  ambitions: { shortTerm: string; longTerm: string };
  partyAmbition: { shortTerm: string; longTerm: string };
  psychology: string;
  notes: string;
};
```

### Discriminated union

```typescript
type Character = Dnd5eCharacter | Wfrp4eCharacter;

function renderSheet(c: Character) {
  switch (c.system) {
    case 'dnd5e':  return <Dnd5eSheet character={c} />;
    case 'wfrp4e': return <Wfrp4eSheet character={c} />;
  }
}
```

The `system` field is the discriminator. TS narrows the type automatically inside each case.

---

## 10. What This Design Does NOT Do

- **No multi-device sync.** Requires a backend. Out of scope for v1.
- **No multi-user accounts.** Single-user, single-device.
- **No real-time updates.** Local DB writes only.
- **No partial JSON queries.** If you need to filter on a field inside `data`, add a computed column or denormalize. v1 doesn't need this.

---

## 11. Next Concrete Step

The user is currently at: **starting Phase 0 (Setup)**.

The first task is to scaffold the Expo project. The next decisions to confirm with the user are:
1. Design tokens (color palette specifics, font choice)
2. Icon set: Lucide vs Phosphor
3. Whether to use a navigation library wrapper (React Navigation directly vs Expo Router)

Do not proceed with any phase beyond Phase 0 until the user confirms.
