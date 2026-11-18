import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { missIsError, modeLabel, responseLimitMs } from './modes';

const P = CONFIG.modes;

describe('modes de temps', () => {
  it('délai appliqué selon le mode et le niveau', () => {
    expect(responseLimitMs({ mode: 'decouverte', level: null, game: 'classique' }, P)).toBe(10000);
    expect(responseLimitMs({ mode: 'test', level: null, game: 'classique' }, P)).toBe(2000);
    expect([1, 2, 3, 4, 5].map((level) => responseLimitMs({ mode: 'entrainement', level, game: 'classique' }, P))).toEqual([
      2000, 1600, 1300, 1100, 900,
    ]);
    expect(responseLimitMs({ mode: 'entrainement', level: 9, game: 'gonogo' }, P)).toBe(900); // borné au dernier niveau
  });

  it('le délai de Test reste celui de la mesure', () => {
    expect(P.testResponseMs).toBe(CONFIG.trial.responseMs);
  });

  it('libellés et erreurs', () => {
    expect(modeLabel({ mode: 'decouverte', level: null, game: 'classique' }, P)).toBe('Classique · Découverte (sans limite)');
    expect(modeLabel({ mode: 'test', level: null, game: 'classique' }, P)).toBe('Batterie Test (2 s)');
    expect(modeLabel({ mode: 'entrainement', level: 3, game: 'gonogo' }, P)).toBe('Go / no-go · Entraînement niv. 3 (1,3 s)');
    expect(missIsError({ mode: 'decouverte', level: null, game: 'classique' })).toBe(false);
    expect(missIsError({ mode: 'test', level: null, game: 'classique' })).toBe(true);
  });
});
