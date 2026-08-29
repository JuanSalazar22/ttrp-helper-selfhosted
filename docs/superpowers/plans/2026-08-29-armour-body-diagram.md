# Armour Body Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only body-silhouette diagram in WFRP4e's Combat/Armour section where each of the 6 body-part armour locations glows brighter with more Armour Points, sitting alongside the existing editable AP number grid (which is untouched).

**Architecture:** Body geometry is adapted once (a one-off extraction, not a runtime dependency) from opengym's MIT-licensed muscle-atlas art into a static `armourBodyPaths.ts` data file grouped into WFRP4e's 6 armour zones. A separate `ArmourBodyMap.tsx` renderer consumes that fixed `{viewBox, regions}` shape via `react-native-svg`, computes a glow level per region from `armourPoints`, and overlays the AP number — the renderer never knows where the geometry came from, so replacing the art later is a one-file swap.

**Tech Stack:** `react-native-svg` (already a dependency, no install needed), plain Node for the one-off extraction script (not committed).

**Reference doc:** [2026-08-29-armour-body-diagram-design.md](../specs/2026-08-29-armour-body-diagram-design.md)

**Working directory:** `/Users/juan.salazar/Repos/ttrp-helper-selfhosted`. This is additive UI work with no backend/auth implications — work directly on `main` with frequent small commits (no worktree needed; nothing here touches the passkey work sitting on `feat/native-passkeys`).

---

## Task 1: Extract and group the body geometry

**Files:**
- Create: `src/data/wfrp-content/armourBodyPaths.ts`

This is the one task in the plan that needs a visual judgment call partway through (confirming which side of the source art is the character's own left vs right) — do not skip Step 4's visual check or guess at the answer.

- [ ] **Step 1: Confirm the source file exists and inspect its shape**

```bash
node -e "import('/Users/juan.salazar/Repos/opengym/frontend/src/lib/body-paths.js').then(m => { const v = m.default.male.front; console.log('viewBox:', v.vb); console.log('slugs:', Object.keys(v.p)); })"
```

Expected: prints a `viewBox` string (four numbers) and a list of ~25 slugs including `head`, `chest`, `biceps`, `quadriceps`, etc.

- [ ] **Step 2: Write and run the one-off extraction script (do NOT commit this script — it's a scratch tool, not a runtime dependency)**

Save this to `/tmp/extract-armour-paths.mjs`:

```javascript
import fs from 'node:fs';

const src = await import('/Users/juan.salazar/Repos/opengym/frontend/src/lib/body-paths.js');
const view = src.default.male.front; // { vb: string, p: Record<string, string[]> }

const [minX] = view.vb.split(/\s+/).map(Number);
const w = view.vb.split(/\s+/).map(Number)[2];
const midX = minX + w / 2;

// Every SVG path's `d` string starts with an absolute "M x,y" moveto — using that
// as each path's anchor point is a simple, deterministic way to guess which half
// of the body it's on. This produces a PROVISIONAL left/right split labeled
// screenLeft/screenRight (viewer's left/right) — Step 4 confirms which of those
// is actually the character's own left vs right before anything is renamed.
function anchorX(d) {
  const m = /^[Mm]\s*(-?[\d.]+)/.exec(d.trim());
  return m ? parseFloat(m[1]) : midX;
}

function splitScreenLeftRight(slugs) {
  const left = [];
  const right = [];
  for (const slug of slugs) {
    for (const d of view.p[slug] ?? []) {
      (anchorX(d) < midX ? left : right).push(d);
    }
  }
  return { left, right };
}

const BODY_SLUGS = ['chest', 'upper-back', 'abs', 'obliques', 'lower-back', 'serratus', 'trapezius', 'deltoids'];
const ARM_SLUGS = ['biceps', 'triceps', 'forearm'];
const LEG_SLUGS = ['gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors', 'calves', 'tibialis'];

const head = view.p['head'] ?? [];
const body = BODY_SLUGS.flatMap(s => view.p[s] ?? []);
const arms = splitScreenLeftRight(ARM_SLUGS);
const legs = splitScreenLeftRight(LEG_SLUGS);

const out = {
  vb: view.vb,
  head, body,
  screenLeftArm: arms.left, screenRightArm: arms.right,
  screenLeftLeg: legs.left, screenRightLeg: legs.right,
};

fs.writeFileSync('/tmp/armour-regions.json', JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) {
  if (Array.isArray(v)) console.log(k, v.length, 'paths');
}
console.log('wrote /tmp/armour-regions.json, viewBox:', view.vb);
```

Run it:

```bash
node /tmp/extract-armour-paths.mjs
```

Expected: prints a path count for each of `head`, `body`, `screenLeftArm`, `screenRightArm`, `screenLeftLeg`, `screenRightLeg` (all non-zero), and confirms `/tmp/armour-regions.json` was written.

- [ ] **Step 3: Build a standalone HTML preview to look at the extracted regions**

Save to `/tmp/armour-preview.html` (reads the JSON written above; adjust the `fetch` path if needed or inline the JSON directly if opening as a `file://` URL causes a fetch/CORS issue — in that case, paste the contents of `/tmp/armour-regions.json` directly in place of the `fetch(...)` call):

```html
<!DOCTYPE html>
<html>
<body style="background:#222">
  <svg id="svg" width="600" height="900" style="background:#333"></svg>
  <script type="module">
    const data = await fetch('/tmp/armour-regions.json').then(r => r.json());
    const svg = document.getElementById('svg');
    svg.setAttribute('viewBox', data.vb);
    const colors = {
      head: '#e74c3c', body: '#3498db',
      screenLeftArm: '#2ecc71', screenRightArm: '#f1c40f',
      screenLeftLeg: '#9b59b6', screenRightLeg: '#e67e22',
    };
    for (const [region, color] of Object.entries(colors)) {
      for (const d of data[region]) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', color);
        svg.appendChild(path);
      }
    }
  </script>
</body>
</html>
```

Open it in the Browser pane (`preview_start` with this file's `file://` path, or serve `/tmp` briefly) and take a screenshot.

- [ ] **Step 4: 👤 VISUAL CHECK — confirm the left/right mapping (do not assume)**

Look at the rendered image: green (`screenLeftArm`) is on one side, yellow (`screenRightArm`) on the other, similarly purple/orange for legs. Front-facing anatomical illustrations conventionally mirror the subject — the character's own right arm typically renders on the *viewer's left* — but confirm this from the image rather than assuming it. Also check for obviously misplaced shapes (a stray piece of one arm rendered on the wrong side, or a disconnected fragment) — the anchor-point heuristic in Step 2 can misclassify a path whose `M` happens to start near the midline.

Record which screen-side is which body-side, and note any specific misplaced path(s) (by index/shape) to move manually in the next step.

- [ ] **Step 5: Write the final `src/data/wfrp-content/armourBodyPaths.ts`**

Using `/tmp/armour-regions.json`'s data, mapped to the correct body sides per Step 4 (swap `screenLeftArm`→`rightArm`/`leftArm` etc. as the visual check determined — do not assume screen-left = character's-left), and with any misplaced paths from Step 4 moved to their correct array:

```typescript
import type { ArmourLocation } from '@/types/wfrp4e';

/** Front-view body silhouette split into WFRP4e's 6 body-part armour zones (shield
 *  isn't a body part, so it's not here — see ArmourBodyMap's separate badge).
 *  Geometry adapted from opengym's body-paths.js (itself derived from MuscleMap by
 *  Melih Colpan, MIT licensed — see NOTICE.md), regrouped from ~18 muscle regions
 *  into these 6 armour locations. Swap this file's contents to replace the art —
 *  ArmourBodyMap.tsx only depends on this exact shape, nothing else about the art. */
export const ARMOUR_BODY_VIEWBOX = '<paste the vb string from the JSON>';

export const ARMOUR_BODY_REGIONS: Record<Exclude<ArmourLocation, 'shield'>, string[]> = {
  head: [/* paste head array */],
  body: [/* paste body array */],
  leftArm: [/* paste the array Step 4 identified as the character's left arm */],
  rightArm: [/* paste the array Step 4 identified as the character's right arm */],
  leftLeg: [/* paste the array Step 4 identified as the character's left leg */],
  rightLeg: [/* paste the array Step 4 identified as the character's right leg */],
};
```

- [ ] **Step 6: Verify it parses and type-checks**

```bash
npm run typecheck
```

Expected: no errors from this new file (it's not imported anywhere yet, so this mainly checks syntax validity).

- [ ] **Step 7: Clean up scratch files (never committed)**

```bash
rm -f /tmp/extract-armour-paths.mjs /tmp/armour-regions.json /tmp/armour-preview.html
```

- [ ] **Step 8: Commit**

```bash
git add src/data/wfrp-content/armourBodyPaths.ts
git commit -m "feat(wfrp): armour body diagram geometry, adapted from opengym's muscle atlas"
```

---

## Task 2: MIT attribution in NOTICE.md

**Files:**
- Create: `NOTICE.md`

- [ ] **Step 1: Create `NOTICE.md`**

```markdown
# Third-Party Notices

## Armour body diagram geometry

The body silhouette the WFRP4e armour diagram is drawn from
(`src/data/wfrp-content/armourBodyPaths.ts`) is adapted from
[**MuscleMap**](https://github.com/melihcolpan/MuscleMap) by Melih Colpan, used under the
**MIT License** and reproduced below. MuscleMap ships its path data as Swift source rather than
`.svg` files; the paths were converted to a JSON/TypeScript module (via
[openGym](https://github.com/JuanSalazar22/opengym)'s own prior conversion of the same
artwork), regrouped from muscle regions into WFRP4e's 6 body-part armour zones, and nothing
else about the artwork was changed.

```
MIT License

Copyright (c) 2026 Melih Colpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
```

- [ ] **Step 2: Commit**

```bash
git add NOTICE.md
git commit -m "docs: MIT attribution for the armour diagram's body geometry"
```

---

## Task 3: `apLevel()` — pure glow-level function, TDD

**Files:**
- Create: `src/components/wfrp4e/armourGlow.ts`
- Test: `src/components/wfrp4e/__tests__/armourGlow.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/wfrp4e/__tests__/armourGlow.test.ts
import { apLevel, GLOW_ALPHA } from '../armourGlow';

describe('apLevel', () => {
  it('maps 0 AP to level 0', () => {
    expect(apLevel(0)).toBe(0);
  });

  it('maps increasing AP to increasing levels', () => {
    expect(apLevel(1)).toBe(1);
    expect(apLevel(2)).toBe(1);
    expect(apLevel(3)).toBe(2);
    expect(apLevel(4)).toBe(3);
  });

  it('caps at the max level for high AP', () => {
    expect(apLevel(5)).toBe(4);
    expect(apLevel(20)).toBe(4);
  });

  it('treats negative AP as 0 (defensive — AP is never negative in practice)', () => {
    expect(apLevel(-3)).toBe(0);
  });
});

describe('GLOW_ALPHA', () => {
  it('has one alpha suffix per level, strictly increasing', () => {
    expect(GLOW_ALPHA).toHaveLength(5);
    const asInt = (hex: string) => parseInt(hex, 16);
    for (let i = 1; i < GLOW_ALPHA.length; i++) {
      expect(asInt(GLOW_ALPHA[i])).toBeGreaterThan(asInt(GLOW_ALPHA[i - 1]));
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx jest src/components/wfrp4e/__tests__/armourGlow.test.ts
```

Expected: FAIL — `Cannot find module '../armourGlow'`.

- [ ] **Step 3: Write `src/components/wfrp4e/armourGlow.ts`**

```typescript
/** AP → glow level (0-4), mirroring opengym's 5-step L0-L4 shading. WFRP armour
 *  rarely exceeds 4-5 AP at one location even with layering, so the scale tops
 *  out there rather than needing a wider range. */
export function apLevel(ap: number): 0 | 1 | 2 | 3 | 4 {
  const clamped = Math.max(0, ap);
  if (clamped <= 0) return 0;
  if (clamped <= 2) return 1;
  if (clamped === 3) return 2;
  if (clamped === 4) return 3;
  return 4;
}

/** Hex alpha suffixes appended to the theme accent color, one per level — matches
 *  this codebase's existing `color + 'NN'` translucency pattern (see AccountSheet's
 *  avatar background) rather than pulling in a color-math library for 5 fixed steps. */
export const GLOW_ALPHA = ['14', '33', '66', '99', 'ff'] as const;
```

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx jest src/components/wfrp4e/__tests__/armourGlow.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/wfrp4e/armourGlow.ts src/components/wfrp4e/__tests__/armourGlow.test.ts
git commit -m "feat(wfrp): apLevel() — AP-to-glow-level mapping for the armour diagram"
```

---

## Task 4: `ArmourBodyMap.tsx` renderer

**Files:**
- Create: `src/components/wfrp4e/ArmourBodyMap.tsx`

- [ ] **Step 1: Write the component**

```typescript
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/i18n';
import { ARMOUR_BODY_VIEWBOX, ARMOUR_BODY_REGIONS } from '@/data/wfrp-content/armourBodyPaths';
import { apLevel, GLOW_ALPHA } from './armourGlow';
import type { Wfrp4eCharacter, ArmourLocation } from '@/types/wfrp4e';

type Props = { armourPoints: Wfrp4eCharacter['armourPoints'] };

// Roughly where each region's label reads best, as a fraction of the viewBox
// (0,0 = top-left, 1,1 = bottom-right) — tuned once against the actual geometry
// in Task 1, not derived from it, since label placement is a readability choice
// independent of the exact path shapes.
const LABEL_POSITION: Record<Exclude<ArmourLocation, 'shield'>, { x: number; y: number }> = {
  head: { x: 0.5, y: 0.08 },
  body: { x: 0.5, y: 0.35 },
  leftArm: { x: 0.78, y: 0.4 },
  rightArm: { x: 0.22, y: 0.4 },
  leftLeg: { x: 0.6, y: 0.75 },
  rightLeg: { x: 0.4, y: 0.75 },
};

export function ArmourBodyMap({ armourPoints }: Props) {
  const t = useTheme();
  const tr = useTranslation();
  const [minX, minY, w, h] = ARMOUR_BODY_VIEWBOX.split(/\s+/).map(Number);

  const locations = Object.keys(ARMOUR_BODY_REGIONS) as Exclude<ArmourLocation, 'shield'>[];

  return (
    <View style={styles.wrap}>
      <Svg viewBox={ARMOUR_BODY_VIEWBOX} width="100%" height={220}>
        {locations.map((loc) => {
          const level = apLevel(armourPoints[loc]);
          const fill = level === 0 ? t.colors.border : t.colors.accent + GLOW_ALPHA[level];
          return ARMOUR_BODY_REGIONS[loc].map((d, i) => (
            <Path key={`${loc}-${i}`} d={d} fill={fill} stroke={t.colors.border} strokeWidth={1} />
          ));
        })}
        {locations.map((loc) => {
          const pos = LABEL_POSITION[loc];
          return (
            <SvgText
              key={`${loc}-label`}
              x={minX + pos.x * w}
              y={minY + pos.y * h}
              fontSize={w * 0.03}
              fill={t.colors.text}
              textAnchor="middle"
              fontWeight="bold"
            >
              {armourPoints[loc]}
            </SvgText>
          );
        })}
      </Svg>
      <View style={[styles.shieldBadge, { borderColor: t.colors.border, backgroundColor: t.colors.backgroundSecondary }]}>
        <Text style={[styles.shieldLabel, { color: t.colors.textSecondary }]}>{tr('wfrp.combat.loc.shield')}</Text>
        <Text style={[styles.shieldValue, { color: t.colors.text }]}>{armourPoints.shield}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 12 },
  shieldBadge: {
    position: 'absolute', top: 4, right: 4,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  shieldLabel: { fontSize: 11, fontWeight: '600' },
  shieldValue: { fontSize: 13, fontWeight: '700' },
});
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean (this file isn't wired into `Combat.tsx` yet, so this only checks the file itself is internally consistent — imports of `ARMOUR_BODY_VIEWBOX`/`ARMOUR_BODY_REGIONS` from Task 1 must resolve, so Task 1 must be done first).

- [ ] **Step 3: Commit**

```bash
git add src/components/wfrp4e/ArmourBodyMap.tsx
git commit -m "feat(wfrp): ArmourBodyMap renderer component"
```

---

## Task 5: Wire into `Combat.tsx`

**Files:**
- Modify: `src/components/wfrp4e/Combat.tsx`

- [ ] **Step 1: Add the import**

Add alongside the other `@/components/wfrp4e/*` imports near the top of the file:

```typescript
import { ArmourBodyMap } from '@/components/wfrp4e/ArmourBodyMap';
```

- [ ] **Step 2: Render it above the existing AP grid**

Change:
```typescript
      {/* ── Armour ─────────────────────────────────────────────────────── */}
      <Section title={tr('wfrp.combat.armour')}>
        {/* Armour Points — editable per hit location, laid out anatomically like the sheet */}
        <View style={styles.apBlock}>
```
to:
```typescript
      {/* ── Armour ─────────────────────────────────────────────────────── */}
      <Section title={tr('wfrp.combat.armour')}>
        <ArmourBodyMap armourPoints={ap} />

        {/* Armour Points — editable per hit location, laid out anatomically like the sheet */}
        <View style={styles.apBlock}>
```

(`ap` is `character.armourPoints`, already defined earlier in the component via `const ap = character.armourPoints;` — no new variable needed.)

- [ ] **Step 3: Typecheck and test**

```bash
npm run typecheck
npm test
```

Expected: both clean/passing — this is a purely additive JSX change, nothing else in `Combat.tsx` is touched.

- [ ] **Step 4: Commit**

```bash
git add src/components/wfrp4e/Combat.tsx
git commit -m "feat(wfrp): show the armour body diagram above the AP grid in Combat.tsx"
```

---

## Task 6: Manual verification in the running app

No new files — this exercises Tasks 1-5 together.

- [ ] **Step 1: Start the app**

```bash
npx expo start --web
```

Open a WFRP4e character with non-zero AP in several locations (or set some via the existing "auto-fill from equipped armour" button, or type values directly into the existing grid).

- [ ] **Step 2: Visually confirm**

- The diagram renders above the existing AP grid, doesn't overlap or crowd it.
- Each of the 6 regions glows brighter for higher AP, dim/outline-only at 0 AP.
- The AP number is readable on each region.
- The shield badge shows its own number, separate from the body diagram.
- Editing a value in the existing grid below updates the diagram's corresponding region (same `armourPoints` object, so this should be automatic — confirm it actually is).
- Switching to a D&D 5e character doesn't show this component at all (it's only rendered inside WFRP4e's `Combat.tsx`, which D&D characters don't use — confirm no crash/stray import issue).

- [ ] **Step 3: If the geometry looks wrong (e.g., a region's shape doesn't read as that body part, or the left/right mapping from Task 1 Step 4 turns out to be backwards once seen in the actual app UI, not just the debug preview)**

Per the design's explicit goal, this is a one-file fix: edit `src/data/wfrp-content/armourBodyPaths.ts` only — swap arrays between `leftArm`/`rightArm` (or `leftLeg`/`rightLeg`) if the mapping is backwards, or adjust which paths belong to which region. Nothing in `ArmourBodyMap.tsx` should need to change for this kind of fix.

- [ ] **Step 4: Final commit if Step 3 required changes**

```bash
git add src/data/wfrp-content/armourBodyPaths.ts
git commit -m "fix: correct armour body diagram region mapping after visual check"
git push
```

If no changes were needed, just push what's already committed:

```bash
git push
```
