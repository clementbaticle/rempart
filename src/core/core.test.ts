import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle, uniform } from './random';
import { classicBlock, longestRun } from './sequence';

const P = { repeats: 3, maxInARow: 2, foreperiodMinMs: 800, foreperiodMaxMs: 2000 };

describe('mulberry32', () => {
  it('même graine → même suite ; graines différentes → suites différentes', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    sa.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
  });

  it('valeurs de référence figées (régression : la séquence du mode Test ne doit jamais changer)', () => {
    const r = mulberry32(12345);
    expect([r(), r(), r()].map((v) => v.toFixed(8))).toEqual(['0.97972827', '0.30675226', '0.48420542']);
  });

  it('uniforme dans les bornes', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = uniform(r, 800, 2000);
      expect(v >= 800 && v < 2000).toBe(true);
    }
  });

  it('shuffle conserve les éléments', () => {
    expect(shuffle(mulberry32(7), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('séquence Classique', () => {
  it('36 essais, 3 par zone (12 zones), jamais plus de 2 fois de suite la même zone', () => {
    for (const seed of [1, 2, 3, 999, 123456]) {
      const s = classicBlock(seed, P);
      expect(s).toHaveLength(36);
      for (let z = 1; z <= 12; z++) expect(s.filter((t) => t.zone === z)).toHaveLength(3);
      expect(longestRun(s.map((t) => t.zone))).toBeLessThanOrEqual(2);
      s.forEach((t) => expect(t.foreperiodMs >= 800 && t.foreperiodMs <= 2000).toBe(true));
    }
  });

  it('reproductible avec la même graine', () => {
    expect(classicBlock(2026, P)).toEqual(classicBlock(2026, P));
    expect(classicBlock(2026, P)).not.toEqual(classicBlock(2027, P));
  });

  it('longestRun', () => {
    expect(longestRun([1, 1, 2, 2, 2, 3])).toBe(3);
    expect(longestRun([])).toBe(0);
  });
});
