import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle, uniform } from './random';
import { CONFIG } from '../config';
import { classicBlock, familiarisationBlock, goNoGoBlock, longestRun, testBattery } from './sequence';

const P = { repeats: 2, maxInARow: 2, foreperiodMinMs: 600, foreperiodMaxMs: 1500 };
const T = CONFIG.trial;
const BATTERY = { ...CONFIG.battery, ...T, maxNoGoInARow: T.maxNoGoInARow };

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
  it('24 essais, 2 par zone (12 zones), jamais plus de 2 fois de suite la même zone', () => {
    for (const seed of [1, 2, 3, 999, 123456]) {
      const s = classicBlock(seed, P);
      expect(s).toHaveLength(24);
      for (let z = 1; z <= 12; z++) expect(s.filter((t) => t.zone === z)).toHaveLength(2);
      expect(longestRun(s.map((t) => t.zone))).toBeLessThanOrEqual(2);
      s.forEach((t) => {
        expect(t.foreperiodMs >= 600 && t.foreperiodMs <= 1500).toBe(true);
        expect([t.isGo, t.game, t.analyzed]).toEqual([true, 'classique', true]);
      });
    }
  });

  it('Go / no-go : 18 essais (12 go + 6 no-go), au plus 2 no-go de suite', () => {
    for (const seed of [1, 7, 42, 2026]) {
      const s = goNoGoBlock(seed, { ...P, noGoZones: T.noGoZones, maxNoGoInARow: 2 });
      expect(s).toHaveLength(18);
      expect(s.filter((t) => t.isGo)).toHaveLength(12);
      expect(new Set(s.filter((t) => t.isGo).map((t) => t.zone)).size).toBe(12);
      expect(s.filter((t) => !t.isGo).map((t) => t.zone).sort((a, b) => a - b)).toEqual([...T.noGoZones].sort((a, b) => a - b));
      let run = 0;
      let best = 0;
      for (const t of s) {
        run = t.isGo ? 0 : run + 1;
        best = Math.max(best, run);
      }
      expect(best).toBeLessThanOrEqual(2);
      expect(longestRun(s.map((t) => t.zone))).toBeLessThanOrEqual(2);
    }
  });

  it('zones no-go équilibrées : 2 par rangée, 3 par côté', () => {
    const rows = T.noGoZones.map((z) => Math.floor((z - 1) / 4));
    expect([0, 1, 2].map((r) => rows.filter((x) => x === r).length)).toEqual([2, 2, 2]);
    expect(T.noGoZones.filter((z) => (z - 1) % 4 < 2)).toHaveLength(3);
  });

  it('familiarisation : 6 zones différentes, non analysées', () => {
    const f = familiarisationBlock(5, 6, P);
    expect(f).toHaveLength(6);
    expect(new Set(f.map((t) => t.zone)).size).toBe(6);
    f.forEach((t) => expect([t.block, t.analyzed]).toEqual([0, false]));
  });

  it('batterie Test v1 : 6 + 24 + 18 = 48 essais, toujours identique', () => {
    const a = testBattery(BATTERY);
    expect(a).toHaveLength(48);
    expect(a.map((t) => t.block)).toEqual([...Array(6).fill(0), ...Array(24).fill(1), ...Array(18).fill(2)]);
    expect(testBattery(BATTERY)).toEqual(a);
    // Empreinte figée : si elle change, la séquence du mode Test a changé (changer aussi la version).
    expect(a.slice(0, 8).map((t) => `${t.zone}${t.isGo ? '' : 'x'}:${t.foreperiodMs}`).join(' ')).toMatchSnapshot();
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
