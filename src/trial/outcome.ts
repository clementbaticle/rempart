/** Issues des essais (section 5, point 5) et statistiques de séance (section 9). */
import type { Touch } from './zones';

export type Outcome =
  | 'hit'
  | 'wrong_effector'
  | 'wrong_zone'
  | 'miss'
  | 'commission'
  | 'correct_rejection'
  | 'anticipation';

/**
 * Mode Classique : seule la cible compte (`touch` = touche de la cible par un effecteur autorisé ;
 * les zones traversées ne sont pas des erreurs). Priorité : anticipation > miss > hit.
 */
/** Essai no-go : un vrai départ pendant la fenêtre = commission, sinon rejet correct. */
export function noGoOutcome(moved: boolean): Outcome {
  return moved ? 'commission' : 'correct_rejection';
}

export function classicOutcome(args: {
  targetZone: number;
  touch: Touch | null;
  rtMs: number | null;
  anticipationMs: number;
}): Outcome {
  if (args.rtMs !== null && args.rtMs < args.anticipationMs) return 'anticipation';
  if (!args.touch || args.touch.zone !== args.targetZone) return 'miss';
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
  /** Absent = essai go (séances antérieures). */
  isGo?: boolean;
  /** Absent = analysé. Les essais de familiarisation (false) sont exclus du résumé. */
  analyzed?: boolean;
  game?: string;
  /** Essai précédé d'une cible blanche. */
  cued?: boolean;
}

export interface SessionSummary {
  /** Essais analysés (go + no-go). */
  trials: number;
  goTrials: number;
  hits: number;
  /** Réussites / essais go. */
  hitRate: number;
  anticipations: number;
  /** Anticipations / essais go. */
  anticipationRate: number;
  misses: number;
  noGoTrials: number;
  commissions: number;
  /** Commissions / essais no-go (null sans no-go). */
  commissionRate: number | null;
  correctRejections: number;
  falseStarts: number;
  /** TR des essais go réussis, dans les bornes [min, max]. */
  rtMedian: number | null;
  rtIqr: number | null;
  mtMedian: number | null;
  /** Go / no-go : TR médian des verts directs et des blanc → vert (coût de l'incertitude). */
  rtMedianDirect: number | null;
  rtMedianCued: number | null;
  rtIncluded: number;
  /** Essais réussis hors bornes, exclus du calcul. */
  rtExcluded: number;
}

/** Résumé d'une série (essais de familiarisation exclus). */
export function summarize(all: readonly TrialForStats[], bounds: { minMs: number; maxMs: number }): SessionSummary {
  const trials = all.filter((t) => t.analyzed !== false);
  const go = trials.filter((t) => t.isGo !== false);
  const noGo = trials.filter((t) => t.isGo === false);
  const count = (list: readonly TrialForStats[], o: Outcome): number => list.filter((t) => t.outcome === o).length;
  const hits = go.filter((t) => t.outcome === 'hit' && t.rtMs !== null);
  const valid = hits.filter((t) => t.rtMs! >= bounds.minMs && t.rtMs! <= bounds.maxMs);
  const rts = valid.map((t) => t.rtMs!).sort((a, b) => a - b);
  const mts = valid.map((t) => t.mtMs).filter((v): v is number => v !== null).sort((a, b) => a - b);
  const q1 = quantile(rts, 0.25);
  const q3 = quantile(rts, 0.75);
  const nh = count(go, 'hit');
  const na = count(go, 'anticipation');
  const nc = count(noGo, 'commission');
  return {
    trials: trials.length,
    goTrials: go.length,
    hits: nh,
    hitRate: go.length ? nh / go.length : 0,
    anticipations: na,
    anticipationRate: go.length ? na / go.length : 0,
    misses: count(go, 'miss'),
    noGoTrials: noGo.length,
    commissions: nc,
    commissionRate: noGo.length ? nc / noGo.length : null,
    correctRejections: count(noGo, 'correct_rejection'),
    falseStarts: trials.reduce((s, t) => s + t.falseStarts, 0),
    rtMedian: quantile(rts, 0.5),
    rtIqr: q1 === null || q3 === null ? null : q3 - q1,
    mtMedian: quantile(mts, 0.5),
    rtMedianDirect: quantile(valid.filter((t) => !t.cued).map((t) => t.rtMs!).sort((a, b) => a - b), 0.5),
    rtMedianCued: quantile(valid.filter((t) => t.cued).map((t) => t.rtMs!).sort((a, b) => a - b), 0.5),
    rtIncluded: rts.length,
    rtExcluded: hits.length - valid.length,
  };
}

/** Résumés par jeu (Classique, Go / no-go), essais de familiarisation exclus. */
export function summarizeByGame(
  all: readonly TrialForStats[],
  bounds: { minMs: number; maxMs: number },
): Record<string, SessionSummary> {
  const out: Record<string, SessionSummary> = {};
  const games = [...new Set(all.filter((t) => t.analyzed !== false).map((t) => t.game ?? 'classique'))];
  for (const g of games) out[g] = summarize(all.filter((t) => (t.game ?? 'classique') === g), bounds);
  return out;
}

export interface ZoneStat {
  zone: number;
  /** TR médian des essais go réussis sur cette zone (dans les bornes), null sans réussite. */
  rtMedian: number | null;
  hits: number;
  goTrials: number;
}

/** TR médian et réussites par zone (essais go analysés). */
export function zoneStats(
  all: readonly (TrialForStats & { zone: number })[],
  zoneCount: number,
  bounds: { minMs: number; maxMs: number },
): ZoneStat[] {
  const go = all.filter((t) => t.analyzed !== false && t.isGo !== false);
  return Array.from({ length: zoneCount }, (_, i) => {
    const zone = i + 1;
    const z = go.filter((t) => t.zone === zone);
    const rts = z
      .filter((t) => t.outcome === 'hit' && t.rtMs !== null && t.rtMs >= bounds.minMs && t.rtMs <= bounds.maxMs)
      .map((t) => t.rtMs!)
      .sort((a, b) => a - b);
    return { zone, rtMedian: quantile(rts, 0.5), hits: z.filter((t) => t.outcome === 'hit').length, goTrials: z.length };
  });
}
