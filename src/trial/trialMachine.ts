/**
 * Automate d'essai (section 5) — CŒUR DE LA MESURE. Logique pure, pilotée image par image.
 *
 * Horloges : `t` des images = horodatage de capture (captureTime / expectedDisplayTime),
 * `now` = performance.now() ; les deux sont sur la même échelle (ms).
 *
 * attente de garde → avant-période → (cible demandée) stimulus → réponse → retour → intervalle → essai suivant
 */
import type { Points } from '../calibration/geometry';
import type { Grid } from '../calibration/grid';
import type { GuardMeasures } from '../calibration/measures';
import { uniform, type Rng } from '../core/random';
import type { PlannedTrial } from '../core/sequence';
import { bodySample, features, meanFeatures, movementAmplitude, movementCause, swayRatio, type BodySample, type Features, type InitiationCause } from './body';
import { classicOutcome, noGoOutcome, type Outcome } from './outcome';
import type { Game } from '../core/sequence';
import { handsInGuard, targetTouch, touchKey, touches, type Effector, type Touch } from './zones';

export interface TrialParams {
  guardRadiusRatio: number;
  guardPresenceMs: number;
  settleMs: number;
  settleToleranceRatio: number;
  foreperiodMinMs: number;
  foreperiodMaxMs: number;
  baselineMs: number;
  falseStartWindowMs: number;
  falseStartThresholdRatio: number;
  falseStartFrames: number;
  initiationThresholdRatio: number;
  /** Délai pour atteindre la cible (ms) ; en mode Découverte, plafond de sécurité. */
  responseMs: number;
  /** Fenêtre d'observation d'un essai no-go (ms). */
  noGoWindowMs: number;
  anticipationMs: number;
  feedbackMs: number;
  itiMs: number;
  hitToleranceFactor: number;
}

/**
 * stimulus : cible demandée (dessinée au prochain rafraîchissement) ;
 * cue : cible blanche affichée (Go / no-go préparé) ; colorPending : couleur demandée ;
 * response : cible colorée affichée, réponse attendue.
 */
export type Phase = 'waitGuard' | 'foreperiod' | 'stimulus' | 'cue' | 'colorPending' | 'response' | 'feedback' | 'iti' | 'done';

export interface FrameInput {
  /** Horodatage de capture de l'image (ms). */
  t: number;
  points: Points;
  presentedFrames: number | null;
  /** Visibilité moyenne des effecteurs sur l'image (0-1). */
  visibility: number;
}

/** Colonnes d'une ligne de trajectoire (pixels image, miroir ; null = absent). */
export const TRAJECTORY_FIELDS = [
  't', 'shoulderX', 'shoulderY', 'pelvisX', 'pelvisY',
  'leftHandX', 'leftHandY', 'rightHandX', 'rightHandY',
  'leftAnkleX', 'leftAnkleY', 'rightAnkleX', 'rightAnkleY',
] as const;

export type TrajectoryRow = (number | null)[];

export interface TrialRecord {
  index: number;
  block: number;
  /** Faux pour la familiarisation (essai non analysé). */
  analyzed: boolean;
  game: Game;
  zone: number;
  stimulus: 'go' | 'nogo';
  isGo: boolean;
  /** Essai précédé d'une cible blanche (blanc → vert / blanc → rouge). */
  cued: boolean;
  /** Durée prévue de la cible blanche (ms), null sans blanc. */
  cueMsPlanned: number | null;
  /** Apparition de la cible blanche (horloge performance), null sans blanc. */
  tCue: number | null;
  /** Délai réel blanc → couleur (ms). */
  cueActualMs: number | null;
  /** Départ mesuré depuis l'apparition de la cible blanche (ms). */
  initFromCueMs: number | null;
  expectedEffector: 'any';
  usedEffector: Effector | null;
  /** Autres zones traversées avant d'atteindre la cible, dans l'ordre (pas des erreurs). */
  crossedZones: number[];
  /** Délai de réponse appliqué (ms). */
  responseLimitMs: number;
  foreperiodPlannedMs: number;
  /** Délai réel entre le début de l'avant-période et l'apparition. */
  foreperiodActualMs: number;
  /** Apparition de la couleur (cible verte / rouge) ; null si l'essai s'arrête pendant le blanc. */
  tStimulus: number | null;
  tStimulusRaf: number | null;
  tInitiation: number | null;
  initiationCause: InitiationCause | null;
  tTouch: number | null;
  rtMs: number | null;
  mtMs: number | null;
  totalMs: number | null;
  outcome: Outcome;
  falseStarts: number;
  difficulty: null;
  quality: {
    meanVisibility: number | null;
    droppedFrames: number;
    responseFrames: number;
    swayRatio: number | null;
  };
  /** Amplitude maximale du mouvement après l'apparition, en proportion de la taille apparente. */
  maxMovementRatio: number;
  trajectory: TrajectoryRow[];
}

export type MachineEvent =
  | { type: 'falseStart'; index: number }
  | { type: 'stimulusRequested'; index: number; zone: number }
  | { type: 'outcome'; record: TrialRecord }
  | { type: 'done' };

interface Timed {
  t: number;
  f: Features;
}

const r1 = (v: number | undefined): number | null => (v === undefined ? null : Math.round(v * 10) / 10);

function trajectoryRow(t: number, b: BodySample): TrajectoryRow {
  return [
    Math.round(t * 10) / 10,
    r1(b.shoulderCenter?.x), r1(b.shoulderCenter?.y), r1(b.pelvis?.x), r1(b.pelvis?.y),
    r1(b.leftHand?.x), r1(b.leftHand?.y), r1(b.rightHand?.x), r1(b.rightHand?.y),
    r1(b.leftAnkle?.x), r1(b.leftAnkle?.y), r1(b.rightAnkle?.x), r1(b.rightAnkle?.y),
  ];
}

export class TrialMachine {
  phase: Phase = 'waitGuard';
  index = 0;
  readonly records: TrialRecord[] = [];

  private readonly thresholdPx: number;
  private readonly falseStartPx: number;
  private readonly guardRadiusPx: number;
  /** Images consécutives au-delà du seuil de faux départ. */
  private falseStartStreak = 0;
  /** Échantillons récents (toutes phases) pour les références de position. */
  private recent: Timed[] = [];
  private guardSince: number | null = null;
  private falseStarts = 0;
  private foreperiodStart = 0;
  private foreperiodMs = 0;
  private foreperiodSamples: Features[] = [];
  private trajectory: TrajectoryRow[] = [];
  private tStim = 0;
  private tStimRaf = 0;
  private baseline: Features = {};
  private tInit: number | null = null;
  private initCause: InitiationCause | null = null;
  private lastPresented: number | null = null;
  private dropped = 0;
  private responseFrames = 0;
  private visSum = 0;
  private phaseUntil = 0;
  /** Fin de l'intervalle (compté depuis la réponse, retour visuel compris). */
  private itiUntil = 0;
  /** Points de la dernière image capturée avant l'apparition. */
  private lastPrePoints: Points = [];
  /**
   * Couples zone/effecteur déjà en contact à l'apparition : ils ne comptent qu'après être
   * sortis du cercle puis y être revenus (la touche est une ENTRÉE dans la cible).
   */
  private blocked = new Set<string>();
  private crossed: number[] = [];
  private maxMovementPx = 0;
  private tCue: number | null = null;

  constructor(
    private readonly plan: readonly PlannedTrial[],
    private readonly guard: GuardMeasures,
    private readonly grid: Grid,
    private readonly p: TrialParams,
    /** Générateur séparé pour les avant-périodes des essais rejoués (ne décale pas la séquence). */
    private readonly replayRng: Rng,
    private readonly emit: (e: MachineEvent) => void = () => {},
  ) {
    this.thresholdPx = p.initiationThresholdRatio * guard.heightPx;
    this.falseStartPx = p.falseStartThresholdRatio * guard.heightPx;
    this.guardRadiusPx = p.guardRadiusRatio * guard.heightPx;
    if (plan.length === 0) this.phase = 'done';
  }

  get currentZone(): number | null {
    return this.plan[this.index]?.zone ?? null;
  }

  /** Essai en cours : go (cible verte) ou no-go (cible rouge). */
  get isGo(): boolean {
    return this.plan[this.index]?.isGo ?? true;
  }

  /** Durée de la cible blanche de l'essai en cours, null = couleur immédiate. */
  get cueMs(): number | null {
    return this.plan[this.index]?.cueMs ?? null;
  }

  get currentTrial(): PlannedTrial | null {
    return this.plan[this.index] ?? null;
  }

  onFrame(fr: FrameInput, now: number): void {
    const body = bodySample(fr.points);
    const f = features(body);
    if (this.phase !== 'response' || fr.t < this.tStim) this.lastPrePoints = fr.points;

    switch (this.phase) {
      case 'waitGuard':
        this.remember(fr.t, f);
        if (handsInGuard(body, this.guard, this.guardRadiusPx)) {
          this.guardSince ??= fr.t;
          // Mains en garde depuis assez longtemps ET garde stabilisée (fin du retour en garde).
          const inGuardMs = fr.t - this.guardSince;
          if (inGuardMs >= Math.max(this.p.guardPresenceMs, this.p.settleMs) && this.isSettled(fr.t)) {
            this.startForeperiod(fr.t);
          }
        } else {
          this.guardSince = null;
        }
        break;

      case 'foreperiod':
      case 'stimulus':
        if (this.isFalseStart(fr.t, f)) {
          this.falseStarts += 1;
          this.phase = 'waitGuard';
          this.guardSince = null;
          this.remember(fr.t, f);
          this.emit({ type: 'falseStart', index: this.index });
          break;
        }
        this.remember(fr.t, f);
        this.foreperiodSamples.push(f);
        this.trajectory.push(trajectoryRow(fr.t, body));
        if (this.phase === 'foreperiod' && fr.t - this.foreperiodStart >= this.foreperiodMs) {
          this.phase = 'stimulus';
          this.emit({ type: 'stimulusRequested', index: this.index, zone: this.currentZone! });
        }
        break;

      case 'cue':
      case 'colorPending':
        // Cible blanche : la gardienne se prépare, mais un vrai départ est déjà mesuré.
        this.trajectory.push(trajectoryRow(fr.t, body));
        if (fr.t < (this.tCue ?? Infinity)) {
          this.remember(fr.t, f);
          break;
        }
        this.maxMovementPx = Math.max(this.maxMovementPx, movementAmplitude(f, this.baseline));
        if (this.tInit === null) {
          const cause = movementCause(f, this.baseline, this.thresholdPx);
          if (cause) {
            this.tInit = fr.t;
            this.initCause = cause;
          }
        }
        // Blanc → rouge : partir pendant le blanc, c'est déjà prendre la feinte.
        if (!this.isGo && this.tInit !== null) this.finish(null, null, now);
        break;

      case 'response':
        this.trajectory.push(trajectoryRow(fr.t, body));
        if (fr.t < this.tStim) {
          this.remember(fr.t, f); // image capturée avant l'apparition
          this.blocked = new Set(touches(fr.points, this.grid, this.p.hitToleranceFactor).map(touchKey));
          break;
        }
        this.responseFrames += 1;
        this.visSum += fr.visibility;
        if (fr.presentedFrames !== null) {
          if (this.lastPresented !== null && fr.presentedFrames > this.lastPresented) {
            this.dropped += fr.presentedFrames - this.lastPresented - 1;
          }
          this.lastPresented = fr.presentedFrames;
        }
        this.maxMovementPx = Math.max(this.maxMovementPx, movementAmplitude(f, this.baseline));
        if (this.tInit === null) {
          const cause = movementCause(f, this.baseline, this.thresholdPx);
          if (cause) {
            this.tInit = fr.t;
            this.initCause = cause;
          }
        }
        if (!this.isGo) {
          // No-go : un vrai départ (même critère que l'initiation) = commission, immédiatement.
          if (this.tInit !== null) this.finish(null, null, now);
          else if (fr.t - this.tStim > this.p.noGoWindowMs) this.finish(null, null, now);
          break;
        }
        {
          const all = touches(fr.points, this.grid, this.p.hitToleranceFactor);
          const current = new Set(all.map(touchKey));
          for (const k of this.blocked) if (!current.has(k)) this.blocked.delete(k); // sorti du cercle
          const fresh = all.filter((t) => !this.blocked.has(touchKey(t)));
          for (const t of fresh) {
            if (t.zone !== this.currentZone && !this.crossed.includes(t.zone)) this.crossed.push(t.zone);
          }
          const touch = targetTouch(fresh, this.currentZone!);
          if (touch) {
            if (this.tInit === null) {
              this.tInit = fr.t;
              this.initCause = 'touche';
            }
            this.finish(touch, fr.t, now);
          } else if (fr.t - this.tStim > this.p.responseMs) {
            this.finish(null, null, now);
          }
        }
        break;

      default:
        break;
    }
    this.tick(now);
  }

  /** Appelé dans le requestAnimationFrame qui dessine la cible. */
  stimulusShown(tPerf: number, tRaf: number): void {
    if (this.phase !== 'stimulus') return;
    const cued = this.cueMs !== null;
    // Avec cible blanche : la couleur viendra plus tard (colorShown) ; la référence de position
    // reste celle d'avant la cible blanche.
    this.tCue = cued ? tPerf : null;
    this.tStim = cued ? Number.NaN : tPerf;
    this.tStimRaf = cued ? Number.NaN : tRaf;
    const window = this.recent.filter((s) => s.t >= tPerf - this.p.baselineMs && s.t < tPerf);
    const base = window.length ? window : this.recent.slice(-1);
    this.baseline = meanFeatures(base.map((s) => s.f));
    this.blocked = new Set(touches(this.lastPrePoints, this.grid, this.p.hitToleranceFactor).map(touchKey));
    this.crossed = [];
    this.maxMovementPx = 0;
    this.tInit = null;
    this.initCause = null;
    this.lastPresented = null;
    this.dropped = 0;
    this.responseFrames = 0;
    this.visSum = 0;
    this.phase = cued ? 'cue' : 'response';
  }

  /** Appelé dans le requestAnimationFrame qui colore la cible blanche (vert ou rouge). */
  colorShown(tPerf: number, tRaf: number): void {
    if (this.phase !== 'colorPending') return;
    this.tStim = tPerf;
    this.tStimRaf = tRaf;
    this.blocked = new Set(touches(this.lastPrePoints, this.grid, this.p.hitToleranceFactor).map(touchKey));
    this.phase = 'response';
  }

  /** Minuteries (retour, intervalle, délai de réponse sans image). */
  tick(now: number): void {
    const limit = this.isGo ? this.p.responseMs : this.p.noGoWindowMs;
    if (this.phase === 'cue' && this.tCue !== null && now - this.tCue >= (this.cueMs ?? 0)) {
      this.phase = 'colorPending'; // la vue colore la cible au prochain rafraîchissement
    } else if (this.phase === 'response' && now - this.tStim > limit + 500) {
      this.finish(null, null, now); // plus aucune image : délai dépassé
    } else if (this.phase === 'feedback' && now >= this.phaseUntil) {
      this.phase = 'iti';
    } else if (this.phase === 'iti' && now >= this.itiUntil) {
      this.index += 1;
      this.falseStarts = 0;
      this.guardSince = null;
      if (this.index >= this.plan.length) {
        this.phase = 'done';
        this.emit({ type: 'done' });
      } else {
        this.phase = 'waitGuard';
      }
    }
  }

  private remember(t: number, f: Features): void {
    this.recent.push({ t, f });
    const keep = Math.max(this.p.falseStartWindowMs, this.p.baselineMs) + 200;
    while (this.recent.length && this.recent[0]!.t < t - keep) this.recent.shift();
  }

  /**
   * Faux départ : écart à la référence glissante au-delà du seuil (plus large que celui d'initiation)
   * sur `falseStartFrames` images consécutives. La référence ne contient que des images de
   * l'avant-période en cours (pas le retour en garde qui la précède).
   */
  private isFalseStart(t: number, f: Features): boolean {
    const from = Math.max(t - this.p.falseStartWindowMs, this.foreperiodStart);
    const win = this.recent.filter((s) => s.t >= from && s.t < t);
    const moved = win.length >= 3 && movementCause(f, meanFeatures(win.map((s) => s.f)), this.falseStartPx) !== null;
    this.falseStartStreak = moved ? this.falseStartStreak + 1 : 0;
    if (this.falseStartStreak < this.p.falseStartFrames) return false;
    this.falseStartStreak = 0;
    return true;
  }

  /** Garde stabilisée : sur les `settleMs` dernières ms, plus aucun mouvement notable. */
  private isSettled(t: number): boolean {
    const win = this.recent.filter((s) => s.t >= t - this.p.settleMs && s.t <= t);
    if (win.length < 3) return false;
    const mean = meanFeatures(win.map((s) => s.f));
    const tol = this.p.settleToleranceRatio * this.guard.heightPx;
    return win.every((s) => movementAmplitude(s.f, mean) <= tol);
  }

  private startForeperiod(t: number): void {
    const planned = this.plan[this.index]!;
    this.foreperiodStart = t;
    this.foreperiodMs =
      this.falseStarts === 0
        ? planned.foreperiodMs
        : Math.round(uniform(this.replayRng, this.p.foreperiodMinMs, this.p.foreperiodMaxMs));
    this.foreperiodSamples = [];
    this.trajectory = [];
    this.falseStartStreak = 0;
    this.phase = 'foreperiod';
  }

  private finish(touch: Touch | null, tTouch: number | null, now: number): void {
    const planned = this.plan[this.index]!;
    const colorShownAt = Number.isNaN(this.tStim) ? null : this.tStim;
    // TR mesuré depuis la couleur ; négatif si départ pendant le blanc ; null si la couleur n'est jamais venue.
    const rt = this.tInit === null || colorShownAt === null ? null : this.tInit - colorShownAt;
    const total = tTouch === null || colorShownAt === null ? null : tTouch - colorShownAt;
    const outcome = planned.isGo
      ? classicOutcome({ targetZone: planned.zone, touch, rtMs: rt, anticipationMs: this.p.anticipationMs })
      : noGoOutcome(this.tInit !== null);
    const cueStart = this.tCue;
    const record: TrialRecord = {
      index: this.index + 1,
      block: planned.block,
      analyzed: planned.analyzed,
      game: planned.game,
      zone: planned.zone,
      stimulus: planned.isGo ? 'go' : 'nogo',
      isGo: planned.isGo,
      cued: planned.cueMs !== null,
      cueMsPlanned: planned.cueMs,
      tCue: cueStart,
      cueActualMs: cueStart !== null && colorShownAt !== null ? colorShownAt - cueStart : null,
      initFromCueMs: cueStart !== null && this.tInit !== null ? this.tInit - cueStart : null,
      expectedEffector: 'any',
      usedEffector: touch?.effector ?? null,
      crossedZones: [...this.crossed],
      responseLimitMs: planned.isGo ? this.p.responseMs : this.p.noGoWindowMs,
      foreperiodPlannedMs: this.foreperiodMs,
      foreperiodActualMs: this.tStim - this.foreperiodStart,
      tStimulus: colorShownAt,
      tStimulusRaf: Number.isNaN(this.tStimRaf) ? null : this.tStimRaf,
      tInitiation: this.tInit,
      initiationCause: this.initCause,
      tTouch,
      rtMs: rt,
      mtMs: rt !== null && total !== null ? total - rt : null,
      totalMs: total,
      outcome,
      falseStarts: this.falseStarts,
      difficulty: null,
      quality: {
        meanVisibility: this.responseFrames ? this.visSum / this.responseFrames : null,
        droppedFrames: this.dropped,
        responseFrames: this.responseFrames,
        swayRatio: swayRatio(this.foreperiodSamples, this.guard.heightPx),
      },
      maxMovementRatio: this.guard.heightPx > 0 ? this.maxMovementPx / this.guard.heightPx : 0,
      trajectory: this.trajectory,
    };
    this.records.push(record);
    this.phase = 'feedback';
    this.phaseUntil = now + this.p.feedbackMs;
    this.itiUntil = now + Math.max(this.p.itiMs, this.p.feedbackMs);
    this.emit({ type: 'outcome', record });
  }
}
