# WFRP Roll Special Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Themed special effects on WFRP roll results — the modal card crumbles into falling shards on fumble/auto-failure (and failed 88s), a golden halo floats over critical/auto successes, purple chaos flames burn behind any 88 — plus a silent, settings-gated sound architecture ready for future audio.

**Architecture:** Effects are pure presentation layered onto the existing `WfrpRollModal` flair system (shipped in PR #56). The crumble is code-only Reanimated (card-colored shard Views falling away — the *actual UI* breaking, no assets). Halo and flames are Lottie overlays played by `lottie-react-native` (native) / its `@lottiefiles/dotlottie-react` web bridge, using two small hand-authored Lottie JSONs checked into the repo (our own IP — swappable later for prettier LottieFiles assets without code changes). `flairOf` moves from the modal into the dice engine so both UI and the new `playRollSound` stub can share it. Sound ships silent: `src/lib/sound.ts` mirrors the `haptics.ts` pattern (module flag + no-op play call), with a Settings toggle and `sound_enabled` persistence wired end-to-end so future audio is a one-file change.

**Tech Stack:** react-native-reanimated 4 (already installed), lottie-react-native + @lottiefiles/dotlottie-react (new), expo-sqlite settings table, typed `tr()` i18n.

**User-approved decisions (from brainstorming):**
1. Hybrid approach: Reanimated crumble + Lottie overlays. Skia rejected (2MB WASM, COOP/COEP friction).
2. Crumble applies to `fumble`, `autoFailure`, and `chaos` **only when the roll failed**. A successful 88 gets flames but no destruction ("flames mark the chaotic number, not the outcome").
3. Halo (angel-wings/halo/victorious feel) applies to `crit` and `autoSuccess`.
4. No audio files yet — sound architecture only, disabled/enabled via a new Settings toggle.
5. The two Lottie JSONs in this plan are minimal hand-authored placeholders (gold halo ring, purple flame blobs). The user may later replace the files at the same paths with licensed LottieFiles assets — no code change needed.

**Repo state notes:** Work starts from `main` (post-PR #56). `CLAUDE.md` must NEVER be committed — never use `git add -A`; always add files by name. `src/data/wfrp-content.zip` is untracked scratch; leave it.

**Web caveat to watch:** the dotlottie web player loads a small WASM renderer, by default from a CDN. The deployed site serves COOP/COEP headers (`public/_headers`, `scripts/serve-dist.mjs`), which can block cross-origin WASM. Task 6 verifies this under `serve:web` and includes the self-hosting contingency.

---

## File map

- Create: `src/lib/sound.ts` — silent sound stub, mirrors `src/lib/haptics.ts`
- Create: `src/components/ui/CrumbleOverlay.tsx` — Reanimated shard overlay
- Create: `src/assets/lottie/halo.json`, `src/assets/lottie/flames.json` — hand-authored Lottie placeholders
- Modify: `src/dice/wfrp.ts` — add `WfrpFlair` + `flairOf` (moved from modal)
- Modify: `src/dice/__tests__/wfrp.test.ts` — flairOf tests
- Modify: `src/hooks/useWfrpRoll.ts` — call `playRollSound`
- Modify: `src/components/ui/WfrpRollModal.tsx` — import flairOf, wire crumble + Lottie overlays
- Modify: `app/(tabs)/settings.tsx` — Sound Effects toggle
- Modify: `app/_layout.tsx` — load `sound_enabled` in `PrefLoader`
- Modify: `src/i18n/en.ts`, `src/i18n/es.ts` — `settings.sound`
- Modify: `package.json` — new deps
- Contingency-create (Task 6 only if needed): `src/lib/lottieWasm.web.ts` + `src/lib/lottieWasm.ts`

---

### Task 0: Branch

- [ ] **Step 1: Create branch from up-to-date main**

```bash
cd /Users/juan.salazar/Repos/TTRP-helper
git checkout main && git pull
git checkout -b feat/wfrp-roll-fx
```

- [ ] **Step 2: Confirm clean tree**

Run: `git status --short`
Expected: only `?? CLAUDE.md`, `?? src/data/wfrp-content.zip`, and this plan file.

---

### Task 1: Move `flairOf` into the dice engine (TDD)

`flairOf` currently lives privately in `WfrpRollModal.tsx:19-29`. Both the modal and the sound stub need it, so it moves to `src/dice/wfrp.ts` as an exported pure helper. The modal keeps working via import (rewired in Task 5; this task only adds the engine copy + tests — the modal's private copy stays until Task 5 deletes it, which is harmless duplication for a few commits).

**Files:**
- Modify: `src/dice/wfrp.ts` (append at end)
- Test: `src/dice/__tests__/wfrp.test.ts` (append at end)

- [ ] **Step 1: Write failing tests**

Append to `src/dice/__tests__/wfrp.test.ts` (outside the existing `describe('evaluateWfrpTest')` block), and extend the import at the top of the file from `import { evaluateWfrpTest } from '../wfrp';` to `import { evaluateWfrpTest, flairOf } from '../wfrp';`:

```typescript
describe('flairOf', () => {
  test('88 is chaos even though it is also a double', () => {
    expect(flairOf(evaluateWfrpTest(88, 45))).toBe('chaos');
    expect(flairOf(evaluateWfrpTest(88, 120))).toBe('chaos');
  });

  test('doubles map to crit or fumble by outcome', () => {
    expect(flairOf(evaluateWfrpTest(33, 45))).toBe('crit');
    expect(flairOf(evaluateWfrpTest(99, 45))).toBe('fumble');
  });

  test('auto bands without doubles', () => {
    expect(flairOf(evaluateWfrpTest(3, 1))).toBe('autoSuccess');
    expect(flairOf(evaluateWfrpTest(97, 120))).toBe('autoFailure');
  });

  test('ordinary rolls have no flair', () => {
    expect(flairOf(evaluateWfrpTest(34, 45))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/dice/__tests__/wfrp.test.ts 2>&1 | tail -5`
Expected: FAIL — `flairOf` is not exported.

- [ ] **Step 3: Implement**

Append to `src/dice/wfrp.ts`:

```typescript
export type WfrpFlair = 'chaos' | 'crit' | 'fumble' | 'autoSuccess' | 'autoFailure' | null;

// Presentation tier for special rolls. Priority: 88 is Chaos-flavored above all;
// doubles crit/fumble; then RAW auto bands.
export function flairOf(r: WfrpRollResult): WfrpFlair {
  if (r.roll === 88) return 'chaos';
  if (r.isCrit) return 'crit';
  if (r.isFumble) return 'fumble';
  if (r.roll <= 5) return 'autoSuccess';
  if (r.roll >= 96) return 'autoFailure';
  return null;
}
```

(`WfrpRollResult` is already imported at the top of the file.)

- [ ] **Step 4: Run tests**

Run: `npx jest src/dice/__tests__/wfrp.test.ts 2>&1 | tail -5`
Expected: all PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dice/wfrp.ts src/dice/__tests__/wfrp.test.ts
git commit -m "feat(wfrp4e): export flairOf special-roll classifier from dice engine"
```

---

### Task 2: Silent sound architecture + Settings toggle

**Files:**
- Create: `src/lib/sound.ts`
- Modify: `src/hooks/useWfrpRoll.ts:1-19`
- Modify: `app/(tabs)/settings.tsx` (imports, state, one new row)
- Modify: `app/_layout.tsx:29-45` (`PrefLoader`)
- Modify: `src/i18n/en.ts` (~line 89, after `haptics`), `src/i18n/es.ts` (~line 90)

- [ ] **Step 1: Create `src/lib/sound.ts`**

```typescript
import type { WfrpFlair } from '@/dice/wfrp';

let enabled = true;
export function setSoundEnabled(value: boolean) {
  enabled = value;
}

// Roll SFX stub — architecture only, no audio shipped yet. When sounds land
// (expo-audio + bundled clips), map each flair to its clip here; every call
// site and the Settings toggle are already wired.
export async function playRollSound(flair: WfrpFlair) {
  if (!enabled || !flair) return;
}
```

- [ ] **Step 2: Call it from `useWfrpRoll`**

In `src/hooks/useWfrpRoll.ts`, change the imports and `apply`:

```typescript
import { rollWfrpTest, evaluateWfrpTest, flairOf } from '@/dice/wfrp';
import { haptic, hapticHeavy } from '@/lib/haptics';
import { playRollSound } from '@/lib/sound';
```

```typescript
  const apply = useCallback((r: WfrpRollResult) => {
    last.current = { roll: r.roll, target: r.baseTarget, label: r.label, difficulty: r.difficulty };
    if (r.isCrit || r.isFumble) hapticHeavy(); else haptic();
    playRollSound(flairOf(r));
    setResult(r);
  }, []);
```

- [ ] **Step 3: i18n keys**

In `src/i18n/en.ts`, directly under `haptics: 'Haptics',`:

```typescript
    sound: 'Sound Effects',
```

In `src/i18n/es.ts`, directly under `haptics: 'Vibración',`:

```typescript
    sound: 'Efectos de sonido',
```

- [ ] **Step 4: Settings toggle**

In `app/(tabs)/settings.tsx`:

Add import: `import { setSoundEnabled } from '@/lib/sound';` (next to the `setHapticsEnabled` import).

Add state + loader + handler (mirror the haptics trio exactly):

```typescript
  const [sound, setSound] = useState(true);

  useEffect(() => {
    if (db && getSettingFn) getSettingFn(db, 'sound_enabled').then(s => setSound(s !== 'false'));
  }, [db]);

  function toggleSound(v: boolean) {
    setSound(v);
    setSoundEnabled(v);
    if (db && setSettingFn) setSettingFn(db, 'sound_enabled', v ? 'true' : 'false');
  }
```

Add the row directly below the Haptics row (inside the same Feedback section):

```tsx
      <View style={[styles.row, { borderColor: t.colors.border, marginTop: 8 }]}>
        <Text style={[styles.rowLabel, { color: t.colors.text }]}>{tr('settings.sound')}</Text>
        <Switch value={sound} onValueChange={toggleSound} />
      </View>
```

- [ ] **Step 5: Load on startup**

In `app/_layout.tsx`: add `import { setSoundEnabled } from '@/lib/sound';` next to the haptics import, and in `PrefLoader`'s async block, after the `haptics_enabled` lines:

```typescript
      const snd = await getSetting(db, 'sound_enabled');
      setSoundEnabled(snd !== 'false');
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npx jest 2>&1 | tail -5`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sound.ts src/hooks/useWfrpRoll.ts "app/(tabs)/settings.tsx" app/_layout.tsx src/i18n/en.ts src/i18n/es.ts
git commit -m "feat(wfrp4e): silent roll-sound architecture with settings toggle"
```

---

### Task 3: Lottie dependency + placeholder assets

**Files:**
- Modify: `package.json` (via install commands)
- Create: `src/assets/lottie/halo.json`
- Create: `src/assets/lottie/flames.json`

- [ ] **Step 1: Install**

```bash
npx expo install lottie-react-native
npm install @lottiefiles/dotlottie-react
```

Expected: `lottie-react-native` at the Expo-SDK-56-compatible version; both added to `package.json` dependencies.

- [ ] **Step 2: Create `src/assets/lottie/halo.json`**

Hand-authored: a gold ellipse ring bobbing gently with a soft glow, 3s loop. Our own IP — replaceable later.

```json
{
  "v": "5.7.4", "fr": 30, "ip": 0, "op": 90, "w": 300, "h": 160, "nm": "halo", "ddd": 0, "assets": [],
  "layers": [
    {
      "ddd": 0, "ind": 1, "ty": 4, "nm": "ring", "sr": 1,
      "ks": {
        "o": { "a": 1, "k": [
          { "i": { "x": [0.55], "y": [1] }, "o": { "x": [0.45], "y": [0] }, "t": 0, "s": [65], "e": [100] },
          { "i": { "x": [0.55], "y": [1] }, "o": { "x": [0.45], "y": [0] }, "t": 45, "s": [100], "e": [65] },
          { "t": 90 }
        ] },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 1, "k": [
          { "i": { "x": 0.55, "y": 1 }, "o": { "x": 0.45, "y": 0 }, "t": 0, "s": [150, 90, 0], "e": [150, 74, 0], "to": [0, 0, 0], "ti": [0, 0, 0] },
          { "i": { "x": 0.55, "y": 1 }, "o": { "x": 0.45, "y": 0 }, "t": 45, "s": [150, 74, 0], "e": [150, 90, 0], "to": [0, 0, 0], "ti": [0, 0, 0] },
          { "t": 90 }
        ] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 0, "k": [100, 100, 100] }
      },
      "ao": 0,
      "shapes": [
        { "ty": "gr", "nm": "halo-ring", "it": [
          { "ty": "el", "p": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [190, 56] } },
          { "ty": "st", "c": { "a": 0, "k": [0.831, 0.686, 0.216, 1] }, "o": { "a": 0, "k": 100 }, "w": { "a": 0, "k": 10 }, "lc": 2, "lj": 2 },
          { "ty": "tr", "p": { "a": 0, "k": [0, 0] }, "a": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [100, 100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
        ] },
        { "ty": "gr", "nm": "halo-glow", "it": [
          { "ty": "el", "p": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [220, 80] } },
          { "ty": "fl", "c": { "a": 0, "k": [0.831, 0.686, 0.216, 1] }, "o": { "a": 0, "k": 18 } },
          { "ty": "tr", "p": { "a": 0, "k": [0, 0] }, "a": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [100, 100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
        ] }
      ],
      "ip": 0, "op": 90, "st": 0
    }
  ]
}
```

- [ ] **Step 3: Create `src/assets/lottie/flames.json`**

Three purple flame blobs licking upward with staggered phases, 2s loop. Each layer anchors at its base so the vertical scale stretches upward.

```json
{
  "v": "5.7.4", "fr": 30, "ip": 0, "op": 60, "w": 300, "h": 200, "nm": "chaos-flames", "ddd": 0, "assets": [],
  "layers": [
    {
      "ddd": 0, "ind": 1, "ty": 4, "nm": "flame-left", "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 75 },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 0, "k": [80, 200, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 1, "k": [
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 0, "s": [100, 82, 100], "e": [100, 120, 100] },
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 30, "s": [100, 120, 100], "e": [100, 82, 100] },
          { "t": 60 }
        ] }
      },
      "ao": 0,
      "shapes": [
        { "ty": "gr", "nm": "blob", "it": [
          { "ty": "el", "p": { "a": 0, "k": [0, -55] }, "s": { "a": 0, "k": [52, 110] } },
          { "ty": "fl", "c": { "a": 0, "k": [0.545, 0.188, 0.788, 1] }, "o": { "a": 0, "k": 100 } },
          { "ty": "tr", "p": { "a": 0, "k": [0, 0] }, "a": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [100, 100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
        ] }
      ],
      "ip": 0, "op": 60, "st": 0
    },
    {
      "ddd": 0, "ind": 2, "ty": 4, "nm": "flame-mid", "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 95 },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 0, "k": [150, 200, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 1, "k": [
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 0, "s": [100, 112, 100], "e": [100, 84, 100] },
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 22, "s": [100, 84, 100], "e": [100, 128, 100] },
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 44, "s": [100, 128, 100], "e": [100, 112, 100] },
          { "t": 60 }
        ] }
      },
      "ao": 0,
      "shapes": [
        { "ty": "gr", "nm": "blob", "it": [
          { "ty": "el", "p": { "a": 0, "k": [0, -70] }, "s": { "a": 0, "k": [60, 140] } },
          { "ty": "fl", "c": { "a": 0, "k": [0.545, 0.188, 0.788, 1] }, "o": { "a": 0, "k": 100 } },
          { "ty": "tr", "p": { "a": 0, "k": [0, 0] }, "a": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [100, 100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
        ] }
      ],
      "ip": 0, "op": 60, "st": 0
    },
    {
      "ddd": 0, "ind": 3, "ty": 4, "nm": "flame-right", "sr": 1,
      "ks": {
        "o": { "a": 0, "k": 75 },
        "r": { "a": 0, "k": 0 },
        "p": { "a": 0, "k": [220, 200, 0] },
        "a": { "a": 0, "k": [0, 0, 0] },
        "s": { "a": 1, "k": [
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 0, "s": [100, 95, 100], "e": [100, 118, 100] },
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 18, "s": [100, 118, 100], "e": [100, 78, 100] },
          { "i": { "x": [0.55, 0.55], "y": [1, 1] }, "o": { "x": [0.45, 0.45], "y": [0, 0] }, "t": 40, "s": [100, 78, 100], "e": [100, 95, 100] },
          { "t": 60 }
        ] }
      },
      "ao": 0,
      "shapes": [
        { "ty": "gr", "nm": "blob", "it": [
          { "ty": "el", "p": { "a": 0, "k": [0, -50] }, "s": { "a": 0, "k": [48, 100] } },
          { "ty": "fl", "c": { "a": 0, "k": [0.545, 0.188, 0.788, 1] }, "o": { "a": 0, "k": 100 } },
          { "ty": "tr", "p": { "a": 0, "k": [0, 0] }, "a": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [100, 100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
        ] }
      ],
      "ip": 0, "op": 60, "st": 0
    }
  ]
}
```

- [ ] **Step 4: Sanity check both files parse**

Run: `node -e "['halo','flames'].forEach(f => JSON.parse(require('fs').readFileSync('src/assets/lottie/'+f+'.json','utf8')) && console.log(f, 'ok'))"`
Expected: `halo ok` / `flames ok`.

- [ ] **Step 5: Typecheck + tests still green**

Run: `npm run typecheck && npx jest 2>&1 | tail -3`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/assets/lottie/halo.json src/assets/lottie/flames.json
git commit -m "feat(wfrp4e): add lottie-react-native + hand-authored halo/flames assets"
```

---

### Task 4: CrumbleOverlay component

Card-colored shards that pop over the card and fall away with rotation and gravity easing — reads as the card face breaking apart. Pure Reanimated, deterministic per-shard randomness (stable across renders), driven by one shared `progress` value.

**Files:**
- Create: `src/components/ui/CrumbleOverlay.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing, interpolate,
  type SharedValue,
} from 'react-native-reanimated';

const COLS = 4;
const ROWS = 3;

// Deterministic per-shard pseudo-random in [0, 1) — keeps renders stable.
const hash = (i: number) => ((i * 2654435761) % 97) / 97;

type ShardProps = {
  i: number;
  progress: SharedValue<number>;
  color: string;
  borderColor: string;
};

function Shard({ i, progress, color, borderColor }: ShardProps) {
  const h1 = hash(i), h2 = hash(i + 13), h3 = hash(i + 29);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 1], [0, 0.9, 0]),
    transform: [
      { translateX: progress.value * (h1 - 0.5) * 140 },
      { translateY: progress.value * (60 + h2 * 160) },
      { rotate: `${progress.value * (h3 - 0.5) * 90}deg` },
    ],
  }));
  const col = i % COLS, row = Math.floor(i / COLS);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.shard, style, {
        left: `${(col / COLS) * 100}%`,
        top: `${(row / ROWS) * 100}%`,
        width: `${100 / COLS}%`,
        height: `${100 / ROWS}%`,
        backgroundColor: color,
        borderColor,
      }]}
    />
  );
}

type Props = {
  trigger: number;      // 0 = idle; increment to (re)play the crumble
  color: string;        // shard fill — match the card background
  borderColor: string;  // hairline crack color — match the card's head color
};

/** Card-colored shards that pop over the card and fall away — the roll "breaking" the UI. */
export function CrumbleOverlay({ trigger, color, borderColor }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0) return;
    progress.value = 0;
    progress.value = withDelay(200, withTiming(1, { duration: 750, easing: Easing.in(Easing.quad) }));
  }, [trigger]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: COLS * ROWS }, (_, i) => (
        <Shard key={i} i={i} progress={progress} color={color} borderColor={borderColor} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shard: { position: 'absolute', borderWidth: StyleSheet.hairlineWidth },
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean. (No unit test — project convention: React components are verified manually in the browser; jest covers engines/derivation/migration only.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CrumbleOverlay.tsx
git commit -m "feat(wfrp4e): CrumbleOverlay shard-break effect component"
```

---

### Task 5: Wire everything into WfrpRollModal

Replace the modal's private `flairOf` with the engine import; add the crumble trigger (fumble / autoFailure / failed chaos → strong shake + shards; successful chaos keeps the light shake), the halo overlay (crit / autoSuccess), and the flames overlay (any chaos).

**Files:**
- Modify: `src/components/ui/WfrpRollModal.tsx` (full replacement below)

- [ ] **Step 1: Replace the file contents entirely with:**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { WFRP_DIFFICULTIES } from '@/dice/types';
import { flairOf, type WfrpFlair } from '@/dice/wfrp';
import type { WfrpRollResult } from '@/dice/types';
import { CrumbleOverlay } from '@/components/ui/CrumbleOverlay';

type Props = {
  result: WfrpRollResult | null;
  onClose: () => void;
  onReroll: () => void;
  onDifficulty: (mod: number) => void;
  onManualRoll: (roll: number) => void;
};

const GOLD = '#d4af37';
const CHAOS_PURPLE = '#8b30c9';

const FLAIR_CAPTION = {
  chaos: 'ui.wfrpRoll.flairChaos',
  autoSuccess: 'ui.wfrpRoll.flairAutoSuccess',
  autoFailure: 'ui.wfrpRoll.flairAutoFailure',
} as const;

// The card breaks on any failed special roll; a successful 88 keeps its flames
// but nothing crumbles.
function isCrumble(flair: WfrpFlair, success: boolean): boolean {
  if (flair === 'fumble' || flair === 'autoFailure') return true;
  return flair === 'chaos' && !success;
}

export function WfrpRollModal({ result, onClose, onReroll, onDifficulty, onManualRoll }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const bounce = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [crumbleKey, setCrumbleKey] = useState(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: scale.value * bounce.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (result) {
      setEditing(false);
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 150 });
      const flair = flairOf(result);
      const crumble = isCrumble(flair, result.success);
      setCrumbleKey(k => (crumble ? k + 1 : 0));
      if (flair === 'crit' || flair === 'autoSuccess') {
        bounce.value = withSequence(
          withTiming(1.18, { duration: 110 }),
          withSpring(1, { damping: 8, stiffness: 260 }),
        );
      } else {
        bounce.value = withSequence(
          withTiming(1.12, { duration: 100 }),
          withSpring(1, { damping: 12, stiffness: 300 }),
        );
      }
      if (crumble) {
        shakeX.value = withSequence(
          withTiming(-16, { duration: 45 }), withTiming(14, { duration: 45 }),
          withTiming(-10, { duration: 45 }), withTiming(8, { duration: 45 }),
          withTiming(-4, { duration: 45 }), withTiming(0, { duration: 45 }),
        );
      } else if (flair === 'chaos') {
        shakeX.value = withSequence(
          withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }),
          withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
      } else {
        shakeX.value = 0;
      }
    } else {
      setCrumbleKey(0);
      scale.value = withTiming(0.5, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
    }
  }, [result]);

  if (!result) return null;

  function startEditing() {
    setDraft(String(result!.roll));
    setEditing(true);
  }

  function commitEdit() {
    const n = parseInt(draft, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 100) onManualRoll(n);
    setEditing(false);
  }

  const flair = flairOf(result);
  const crit = result.isCrit;
  const fumble = result.isFumble;
  const headColor = flair === 'chaos' ? CHAOS_PURPLE
    : crit ? GOLD
    : fumble ? t.colors.danger
    : result.success ? t.colors.success : t.colors.danger;
  const headLabel = crit ? 'CRITICAL!' : fumble ? 'FUMBLE!'
    : result.success ? 'SUCCESS' : 'FAILURE';
  const slStr = result.sl >= 0 ? `+${result.sl}` : `${result.sl}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View
          style={[styles.card, { backgroundColor: t.colors.card, borderColor: headColor }, animStyle]}
        >
          {flair === 'chaos' && (
            <View pointerEvents="none" style={styles.flames}>
              <LottieView
                source={require('@/assets/lottie/flames.json')}
                autoPlay
                loop
                style={styles.flamesLottie}
                webStyle={{ width: '100%', height: '100%' }}
              />
            </View>
          )}
          <TouchableOpacity activeOpacity={1}>
            <Text style={[styles.label, { color: t.colors.textSecondary }]} numberOfLines={1}>
              {result.label}
            </Text>
            <Text style={[styles.head, { color: headColor }]}>{headLabel}</Text>

            {editing ? (
              <TextInput
                style={[styles.roll, styles.rollInput, { color: t.colors.text, borderColor: headColor, fontFamily: t.fontFamily.serif }]}
                value={draft}
                onChangeText={setDraft}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                maxLength={3}
                onSubmitEditing={commitEdit}
                onBlur={commitEdit}
              />
            ) : (
              <TouchableOpacity onPress={startEditing} accessibilityLabel={tr('ui.wfrpRoll.editRoll')}>
                <Text style={[styles.roll, { color: t.colors.text, fontFamily: t.fontFamily.serif }]}>
                  {result.roll}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={[styles.vs, { color: t.colors.textSecondary }]}>
              vs {result.effectiveTarget}
              {result.difficulty !== 0
                ? ` (${result.baseTarget}${result.difficulty > 0 ? '+' : ''}${result.difficulty})`
                : ''}
            </Text>

            <View style={[styles.slBadge, { borderColor: headColor, backgroundColor: headColor + '18' }]}>
              <Text style={[styles.slText, { color: headColor }]}>{slStr} SL</Text>
            </View>

            {flair && flair in FLAIR_CAPTION && (
              <Text style={[styles.flair, { color: headColor }]}>
                {tr(FLAIR_CAPTION[flair as keyof typeof FLAIR_CAPTION])}
              </Text>
            )}

            <View style={styles.diffRow}>
              {WFRP_DIFFICULTIES.map(d => {
                const active = d.mod === result.difficulty;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[styles.diffChip, {
                      borderColor: active ? t.colors.accent : t.colors.border,
                      backgroundColor: active ? t.colors.accent + '18' : t.colors.backgroundSecondary,
                    }]}
                    onPress={() => onDifficulty(d.mod)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.diffText, { color: active ? t.colors.accent : t.colors.textMuted }]}>
                      {d.mod > 0 ? `+${d.mod}` : d.mod}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, { borderColor: t.colors.border }]} onPress={onReroll}>
                <Text style={[styles.btnText, { color: t.colors.accent }]}>{tr('ui.wfrpRoll.rollAgain')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnClose, { backgroundColor: t.colors.accent }]} onPress={onClose}>
                <Text style={[styles.btnText, { color: t.colors.accentText }]}>{tr('ui.wfrpRoll.done')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {(flair === 'crit' || flair === 'autoSuccess') && (
            <View pointerEvents="none" style={styles.halo}>
              <LottieView
                source={require('@/assets/lottie/halo.json')}
                autoPlay
                loop
                style={styles.haloLottie}
                webStyle={{ width: '100%', height: '100%' }}
              />
            </View>
          )}

          {crumbleKey > 0 && (
            <CrumbleOverlay trigger={crumbleKey} color={t.colors.card} borderColor={headColor} />
          )}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, borderWidth: 1.5, padding: 24, alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  head: { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  roll: { fontSize: 72, fontWeight: '700', lineHeight: 80, textAlign: 'center' },
  rollInput: { alignSelf: 'center', width: 160, borderBottomWidth: 2 },
  vs: { fontSize: 14 },
  flair: { fontSize: 12, fontStyle: 'italic', marginTop: 2, textAlign: 'center' },
  slBadge: { borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  slText: { fontSize: 18, fontWeight: '700' },
  diffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 12 },
  diffChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minWidth: 40, alignItems: 'center' },
  diffText: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  btnClose: { borderWidth: 0 },
  btnText: { fontSize: 15, fontWeight: '600' },
  flames: { ...StyleSheet.absoluteFillObject, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end' },
  flamesLottie: { width: '100%', height: 150 },
  halo: { position: 'absolute', top: -58, alignSelf: 'center', width: 190, height: 100 },
  haloLottie: { width: '100%', height: '100%' },
});
```

Layout notes baked into the code above (do not change casually):
- Flames render **first** inside the card (underneath content) and clip to the card's rounded corners (`overflow: 'hidden'`).
- Halo renders **after** content, absolutely positioned floating above the card's top edge (`top: -58`); RN default overflow lets it poke outside the card.
- CrumbleOverlay renders **last** (on top) so shards visually break the card face.
- All effect layers are `pointerEvents="none"` — the difficulty chips, edit-roll tap, and buttons stay tappable during effects.

- [ ] **Step 2: Typecheck + full suite**

Run: `npm run typecheck && npx jest 2>&1 | tail -5`
Expected: clean, all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/WfrpRollModal.tsx
git commit -m "feat(wfrp4e): crumble, halo, and chaos-flame effects in roll modal"
```

---

### Task 6: Browser verification (dev + COOP/COEP production build)

- [ ] **Step 1: Dev-server walkthrough**

Start the dev server via `.claude/launch.json` config `ttrp-web` (port 8082). Open a WFRP character (create one if the DB is empty — "+" → WFRP 4e → name → Create). Tap a characteristic to roll, then tap the big number to type each roll:

| Type | Expect |
|---|---|
| `97` | strong shake + card-colored shards falling away (crumble), caption "96–00 always fails" |
| `100` | red FUMBLE! + crumble |
| `88` (vs low target → failure) | purple card, flames at the card's base, **and** crumble |
| `88` then tap `+60` so it succeeds | purple SUCCESS, flames still burning, **no** crumble |
| `03` | green SUCCESS + gold halo floating above the card, big bounce |
| `44` vs target ≥44 (tap `+60`) | gold CRITICAL! + halo |
| `34` vs 45-ish | plain result — no shards, no lottie, normal entry animation |

Also check `read_console_messages` for Lottie/dotlottie errors (a broken hand-authored JSON shows up as `onAnimationFailure`/console errors — if the animation doesn't render, fix the JSON keyframes before proceeding).

Check Settings: "Sound Effects" toggle appears under Feedback (EN) / "Efectos de sonido" (ES), flips and persists across reload (native persistence; web is in-memory, same as Haptics).

- [ ] **Step 2: Production web build under COOP/COEP**

```bash
npm run build:web && npm run serve:web
```

Open the served URL (port 8083), repeat the `88` and `03` checks, and watch the console for WASM/CORS errors from the dotlottie web player (it loads its renderer WASM from a CDN by default; COEP `require-corp` may block it).

**If (and only if) the WASM load is blocked:** self-host it —

1. `cp node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm public/dotlottie-player.wasm`
2. Create `src/lib/lottieWasm.web.ts`:
   ```typescript
   // COEP require-corp blocks the default CDN-hosted dotlottie renderer WASM;
   // serve it same-origin instead. Imported for side effect from app/_layout.tsx.
   import { setWasmUrl } from '@lottiefiles/dotlottie-react';
   setWasmUrl('/dotlottie-player.wasm');
   ```
3. Create `src/lib/lottieWasm.ts` (native no-op twin):
   ```typescript
   // Native uses lottie-react-native's own renderer — nothing to configure.
   export {};
   ```
4. In `app/_layout.tsx`, add `import '@/lib/lottieWasm';` after the other imports (Metro resolves the `.web.ts` variant on web).
5. Rebuild (`npm run build:web && npm run serve:web`) and re-verify, then commit:
   ```bash
   git add public/dotlottie-player.wasm src/lib/lottieWasm.web.ts src/lib/lottieWasm.ts app/_layout.tsx
   git commit -m "fix(web): self-host dotlottie renderer wasm for COOP/COEP"
   ```

- [ ] **Step 3: Native bundle sanity**

Run: `npx expo export -p ios 2>&1 | tail -3`
Expected: bundle succeeds (verifies the lottie native module + JSON assets resolve outside web).

---

### Task 7: TODO update + ship

- [ ] **Step 1: Full suite one last time**

Run: `npm test 2>&1 | tail -5 && npm run typecheck`
Expected: all green.

- [ ] **Step 2: Update `TODO.md`**

Add under "Near-term features", following the existing `- [x] **Title.** description` style:

```markdown
- [x] **WFRP special-roll effects.** Fumble/auto-failure (and failed 88s) crumble the roll card into falling shards (Reanimated, code-only); crit/auto-success float a golden halo above the card; any 88 burns purple chaos flames behind the content (flames mark the number, not the outcome — a successful 88 doesn't crumble). Lottie overlays use hand-authored placeholder JSONs in `src/assets/lottie/` — swap the files to upgrade the art, no code change. Sound architecture shipped silent: `src/lib/sound.ts` stub + `sound_enabled` setting + Settings toggle, wired end-to-end for future expo-audio clips.
```

- [ ] **Step 3: Push, open PR, merge (user standing preference: always merge)**

```bash
git add TODO.md docs/superpowers/plans/2026-07-14-wfrp-roll-fx.md
git commit -m "docs: TODO update + plan for WFRP roll effects"
git push -u origin feat/wfrp-roll-fx
gh pr create --title "feat(wfrp4e): roll special effects — crumble, halo, chaos flames + silent sound architecture" --body "$(cat <<'EOF'
- feat: roll card crumbles into falling shards on fumble / auto-failure / failed 88 (Reanimated, no assets)
- feat: golden halo overlay on critical / auto success (Lottie)
- feat: purple chaos flames behind any 88 — flames mark the number, successful 88s don't crumble (Lottie)
- feat: silent sound architecture — src/lib/sound.ts stub, flair-keyed playRollSound, sound_enabled setting + Settings toggle (EN/ES), loaded at startup
- chore: flairOf moved from WfrpRollModal into src/dice/wfrp.ts (shared by UI + sound), with unit tests
- deps: lottie-react-native + @lottiefiles/dotlottie-react; hand-authored placeholder halo/flames JSONs (own IP, swappable)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr merge --squash --delete-branch
```

Expected: PR merged into `main`.
