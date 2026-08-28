# WFRP Advance XP-Cost Calculator — Design

**Date:** 2026-06-22
**Backlog item:** #36
**Status:** Approved — implementation in progress
**Builds on:** #35 (characteristics detail view + advances field)

## Goal

Show the XP price of the *next* advance for characteristics and skills, using the
standard WFRP 4e cost table, and let the player step advances up/down. **Display only**
— there is no XP pool to spend from (WFRP characters have no `xp` field), so nothing is
deducted; the cost is informational.

## Cost table

The cost of the next advance depends on how many advances are *already* bought in that
line (characteristic or skill):

| Advances already bought | Next advance costs |
|---|---|
| 0–5   | 25 |
| 6–10  | 30 |
| 11–15 | 40 |
| 16–20 | 50 |
| 21–25 | 70 |
| 26–30 | 90 |
| 31–35 | 120 |
| 36–40 | 150 |
| 41–45 | 190 |
| 46+   | 230 |

## Confirmed decisions

- Applies to **both** characteristics (detail view) and skills.
- Cost is keyed on the *current* advances count: `next cost = advanceCost(advances)`.
- No XP is spent or tracked — the number is shown next to a step control only.

## §1 Helper — `src/types/wfrp4e.ts`

```ts
const ADVANCE_COST_BANDS: Array<{ max: number; cost: number }> = [
  { max: 5, cost: 25 },
  { max: 10, cost: 30 },
  { max: 15, cost: 40 },
  { max: 20, cost: 50 },
  { max: 25, cost: 70 },
  { max: 30, cost: 90 },
  { max: 35, cost: 120 },
  { max: 40, cost: 150 },
  { max: 45, cost: 190 },
];

/** XP cost of the NEXT advance, given how many advances are already bought. */
export function advanceCost(currentAdvances: number): number {
  const a = Math.max(0, currentAdvances);
  for (const band of ADVANCE_COST_BANDS) {
    if (a <= band.max) return band.cost;
  }
  return 230;
}
```

No schema change — this is a pure helper, no data shape touched.

## §2 Characteristics detail — `src/components/wfrp4e/CharacteristicsDetail.tsx`

Keep the four `EditableNumber` cells (Roll/Racial/Other/Adv) for direct entry. Add a
thin **sub-row** under each characteristic's cells showing the next advance cost and a
step control:

```
WS    [Roll] [Racial] [Other] [Adv]        = 31
                         next advance · 25 XP   [−] [+1]
```

- The label reads `next advance · {advanceCost(c.advances)} XP`.
- `[+1]` calls `setField(k, 'advances', c.advances + 1)`.
- `[−]` calls `setField(k, 'advances', Math.max(0, c.advances - 1))`.
- The cost label and Adv cell update as advances cross band boundaries.

## §3 Skills — `src/components/wfrp4e/WfrpSkills.tsx`

The skills row already has a `[−] +{advances} [+]` advance control. Replace the single
`+{advances}` text with a small stacked cell:

```
[−]   +{advances}      [+]
      {advanceCost(s.advances)} XP
```

- Top line: `+{s.advances}` (unchanged value).
- Second line (tiny, muted): `{advanceCost(s.advances)} XP`.
- The `[+]`/`[−]` buttons are unchanged (`setAdvances`); only the displayed cost is added.

## §4 Out of scope

- No XP pool / total-XP tracking or spending (separate future item).
- No "spent XP" running total.
- Species/career free advances or career-restricted advances are not modelled.

## §5 Testing — `src/types/__tests__/wfrp4e.test.ts`

`advanceCost` band boundaries:
- 0 → 25, 5 → 25, 6 → 30, 10 → 30, 11 → 40, 45 → 190, 46 → 230, 100 → 230.
- Negative input clamps: −3 → 25.

## Acceptance criteria

1. `advanceCost` returns the correct band cost at every boundary; tests pass.
2. The characteristics detail view shows `next advance · N XP` per characteristic, and
   `[+1]`/`[−]` change advances (cost + sum update live).
3. A skill row shows the next advance's XP cost under its advance count; `[+]`/`[−]`
   still work.
4. `tsc` clean.
