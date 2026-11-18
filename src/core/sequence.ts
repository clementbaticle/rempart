/**
 * Séquences d'essais pré-tirées à partir d'une graine (zones, go / no-go, avant-périodes).
 * Même graine → même séquence : c'est la base du mode Test (section 7).
 */
import { ZONE_COUNT } from '../calibration/grid';
import { mulberry32, shuffle, uniform, type Rng } from './random';

export type Game = 'classique' | 'gonogo';

export interface PlannedTrial {
  /** Zone cible (1 à 12). */
  zone: number;
  /** Avant-période (ms), arrondie à la ms. */
  foreperiodMs: number;
  /** Cible go (verte, à toucher) ou no-go (rouge, ne pas bouger). */
  isGo: boolean;
  game: Game;
  /** N° de bloc dans la séance (0 = familiarisation). */
  block: number;
  /** Essai pris en compte dans les résultats (faux pour la familiarisation). */
  analyzed: boolean;
}

export interface ForeperiodParams {
  foreperiodMinMs: number;
  foreperiodMaxMs: number;
}

/** Plus longue suite de valeurs identiques consécutives. */
export function longestRun(values: readonly unknown[]): number {
  let best = 0;
  let run = 0;
  values.forEach((v, i) => {
    run = i > 0 && values[i - 1] === v ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Mélange par rejet jusqu'à respecter `ok` ; entièrement déterminé par le générateur. */
function shuffleUntil<T>(rng: Rng, pool: readonly T[], ok: (s: T[]) => boolean): T[] {
  let s = shuffle(rng, pool);
  for (let attempt = 0; !ok(s); attempt++) {
    if (attempt > 20000) throw new Error('Séquence impossible avec ces contraintes');
    s = shuffle(rng, pool);
  }
  return s;
}

const foreperiod = (rng: Rng, p: ForeperiodParams): number => Math.round(uniform(rng, p.foreperiodMinMs, p.foreperiodMaxMs));

/**
 * Bloc Classique : chaque zone `repeats` fois, au plus `maxInARow` fois de suite la même zone.
 */
export function classicBlock(
  seed: number,
  p: ForeperiodParams & { repeats: number; maxInARow: number },
  block = 1,
): PlannedTrial[] {
  const rng = mulberry32(seed);
  const pool = Array.from({ length: ZONE_COUNT * p.repeats }, (_, i) => (i % ZONE_COUNT) + 1);
  const zones = shuffleUntil(rng, pool, (s) => longestRun(s) <= p.maxInARow);
  return zones.map((zone) => ({ zone, foreperiodMs: foreperiod(rng, p), isGo: true, game: 'classique', block, analyzed: true }));
}

/**
 * Bloc Go / no-go : chaque zone une fois en go + les zones `noGoZones` en no-go ;
 * au plus `maxInARow` fois de suite la même zone et `maxNoGoInARow` no-go de suite.
 */
export function goNoGoBlock(
  seed: number,
  p: ForeperiodParams & { noGoZones: readonly number[]; maxInARow: number; maxNoGoInARow: number },
  block = 1,
): PlannedTrial[] {
  const rng = mulberry32(seed);
  const pool = [
    ...Array.from({ length: ZONE_COUNT }, (_, i) => ({ zone: i + 1, isGo: true })),
    ...p.noGoZones.map((zone) => ({ zone, isGo: false })),
  ];
  const items = shuffleUntil(
    rng,
    pool,
    (s) => longestRun(s.map((t) => t.zone)) <= p.maxInARow && longestNoGo(s) <= p.maxNoGoInARow,
  );
  return items.map(({ zone, isGo }) => ({ zone, foreperiodMs: foreperiod(rng, p), isGo, game: 'gonogo', block, analyzed: true }));
}

function longestNoGo(s: readonly { isGo: boolean }[]): number {
  let best = 0;
  let run = 0;
  for (const t of s) {
    run = t.isGo ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Familiarisation : `count` zones différentes, en Classique, non analysées. */
export function familiarisationBlock(seed: number, count: number, p: ForeperiodParams): PlannedTrial[] {
  const rng = mulberry32(seed);
  const zones = shuffle(rng, Array.from({ length: ZONE_COUNT }, (_, i) => i + 1)).slice(0, count);
  return zones.map((zone) => ({ zone, foreperiodMs: foreperiod(rng, p), isGo: true, game: 'classique', block: 0, analyzed: false }));
}

export interface BatteryDef extends ForeperiodParams {
  version: string;
  familiarisation: number;
  seeds: { familiarisation: number; classique: number; gonogo: number };
  classicRepeatsPerZone: number;
  noGoZones: readonly number[];
  maxSameZoneInARow: number;
  maxNoGoInARow: number;
}

/** Batterie du mode Test : familiarisation, bloc 1 Classique, bloc 2 Go / no-go (toujours identique). */
export function testBattery(d: BatteryDef): PlannedTrial[] {
  return [
    ...familiarisationBlock(d.seeds.familiarisation, d.familiarisation, d),
    ...classicBlock(d.seeds.classique, { ...d, repeats: d.classicRepeatsPerZone, maxInARow: d.maxSameZoneInARow }, 1),
    ...goNoGoBlock(d.seeds.gonogo, { ...d, maxInARow: d.maxSameZoneInARow }, 2),
  ];
}
