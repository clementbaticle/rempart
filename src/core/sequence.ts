/** Séquences d'essais pré-tirées à partir d'une graine (zones + avant-périodes). */
import { ZONE_COUNT } from '../calibration/grid';
import { mulberry32, shuffle, uniform } from './random';

export interface PlannedTrial {
  /** Zone cible (1 à 12). */
  zone: number;
  /** Avant-période (ms), arrondie à la ms. */
  foreperiodMs: number;
}

/** Plus longue suite de valeurs identiques consécutives. */
export function longestRun(values: readonly number[]): number {
  let best = 0;
  let run = 0;
  values.forEach((v, i) => {
    run = i > 0 && values[i - 1] === v ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/**
 * Bloc Classique : chaque zone `repeats` fois, au plus `maxInARow` fois de suite la même zone.
 * Tirage par rejet, entièrement déterminé par la graine.
 */
export function classicBlock(
  seed: number,
  p: { repeats: number; maxInARow: number; foreperiodMinMs: number; foreperiodMaxMs: number },
): PlannedTrial[] {
  const rng = mulberry32(seed);
  const pool = Array.from({ length: ZONE_COUNT * p.repeats }, (_, i) => (i % ZONE_COUNT) + 1);
  let zones = shuffle(rng, pool);
  for (let attempt = 0; longestRun(zones) > p.maxInARow; attempt++) {
    if (attempt > 10000) throw new Error('Séquence impossible avec ces contraintes');
    zones = shuffle(rng, pool);
  }
  return zones.map((zone) => ({
    zone,
    foreperiodMs: Math.round(uniform(rng, p.foreperiodMinMs, p.foreperiodMaxMs)),
  }));
}
