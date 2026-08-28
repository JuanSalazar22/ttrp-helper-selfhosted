import { evaluateWfrpTest, flairOf } from '../wfrp';

describe('evaluateWfrpTest', () => {
  test('success when roll <= target', () => {
    const r = evaluateWfrpTest(34, 45);
    expect(r.success).toBe(true);
    expect(r.effectiveTarget).toBe(45);
  });

  test('failure when roll > target', () => {
    const r = evaluateWfrpTest(67, 45);
    expect(r.success).toBe(false);
  });

  test('SL = tens(target) - tens(roll)', () => {
    expect(evaluateWfrpTest(23, 45).sl).toBe(2);
    expect(evaluateWfrpTest(67, 45).sl).toBe(-2);
  });

  test('difficulty shifts the target before comparison', () => {
    const easy = evaluateWfrpTest(60, 45, 20);
    expect(easy.success).toBe(true);
    expect(easy.effectiveTarget).toBe(65);
    const hard = evaluateWfrpTest(60, 45, -20);
    expect(hard.success).toBe(false);
  });

  test('double on success is a crit', () => {
    const r = evaluateWfrpTest(33, 45);
    expect(r.isCrit).toBe(true);
    expect(r.isFumble).toBe(false);
  });

  test('double on failure is a fumble', () => {
    const r = evaluateWfrpTest(88, 45);
    expect(r.isFumble).toBe(true);
    expect(r.isCrit).toBe(false);
  });

  test('100 is always a fumble (auto-failure + double)', () => {
    expect(evaluateWfrpTest(100, 45).isFumble).toBe(true);
    expect(evaluateWfrpTest(100, 120).isFumble).toBe(true);
  });

  test('01-05 always succeeds even above target', () => {
    const r = evaluateWfrpTest(3, 1);
    expect(r.success).toBe(true);
  });

  test('96-00 always fails even below target', () => {
    const r = evaluateWfrpTest(97, 120);
    expect(r.success).toBe(false);
  });

  test('99 on a high target is still a fumble (auto-failure + double)', () => {
    const r = evaluateWfrpTest(99, 120);
    expect(r.isFumble).toBe(true);
    expect(r.isCrit).toBe(false);
  });

  test('non-double roll is neither crit nor fumble', () => {
    const r = evaluateWfrpTest(34, 45);
    expect(r.isCrit).toBe(false);
    expect(r.isFumble).toBe(false);
  });
});

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
