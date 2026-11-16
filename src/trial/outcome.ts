/** Issues des essais (section 5, point 5) et statistiques de séance (section 9). */
import { rowOf } from '../calibration/grid';
import { isFoot, type Touch } from './zones';

export type Outcome =
  | 'hit'
  | 'wrong_effector'
  | 'wrong_zone'
  | 'miss'
  | 'commission'
  | 'correct_rejection'
  | 'anticipation';

/**
 * Mode Classique : n'importe quel effecteur, sauf un pied sur les rangées haute et du milieu.
 * Priorité : anticipation > miss > wrong_zone > wrong_effector > hit.
 */
export function classicOutcome(args: {
  targetZone: number;
  touch: Touch | null;
  rtMs: number | null;
  anticipationMs: number;
}): Outcome {
  if (args.rtMs !== null && args.rtMs < args.anticipationMs) return 'anticipation';
  if (!args.touch) return 'miss';
  if (args.touch.zone !== args.targetZone) return 'wrong_zone';
  if (isFoot(args.touch.effector) && rowOf(args.targetZone) < 2) return 'wrong_effector';
  return 'hit';
}

/** Quantile (méthode linéaire, type 7 de R). */
export function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export interface TrialForStats {
  outcome: Outcome;
  rtMs: number | null;
  mtMs: number | null;
  falseStarts: number;
}

export interface SessionSummary {
  trials: number;
  hits: number;
  hitRate: number;
  anticipations: number;
  anticipationRate: number;
  misses: number;
  wrongZone: number;
  wrongEffector: number;
  falseStarts: number;
  /** TR des essais réussis, dans les bornes [min, max]. */
  rtMedian: number | null;
  rtIqr: number | null;
  mtMedian: number | null;
  rtIncluded: number;
  /** Essais réussis hors bornes, exclus du calcul. */
  rtExcluded: number;
}

export function summarize(trials: readonly TrialForStats[], bounds: { minMs: number; maxMs: number }): SessionSummary {
  const n = trials.length;
  const count = (o: Outcome): number => trials.filter((t) => t.outcome === o).length;
  const hits = trials.filter((t) => t.outcome === 'hit' && t.rtMs !== null);
  const valid = hits.filter((t) => t.rtMs! >= bounds.minMs && t.rtMs! <= bounds.maxMs);
  const rts = valid.map((t) => t.rtMs!).sort((a, b) => a - b);
  const mts = valid.map((t) => t.mtMs).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const q1 = quantile(rts, 0.25);
  const q3 = quantile(rts, 0.75);
  const nh = count('hit');
  const na = count('anticipation');
  return {
    trials: n,
    hits: nh,
    hitRate: n ? nh / n : 0,
    anticipations: na,
    anticipationRate: n ? na / n : 0,
    misses: count('miss'),
    wrongZone: count('wrong_zone'),
    wrongEffector: count('wrong_effector'),
    falseStarts: trials.reduce((s, t) => s + t.falseStarts, 0),
    rtMedian: quantile(rts, 0.5),
    rtIqr: q1 === null || q3 === null ? null : q3 - q1,
    mtMedian: quantile(mts, 0.5),
    rtIncluded: rts.length,
    rtExcluded: hits.length - valid.length,
  };
}
