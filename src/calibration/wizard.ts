/**
 * Déroulé de la calibration de la joueuse (logique pure, sans affichage) :
 * cadrage → préparation de la garde (2 s, rien n'est mesuré) → garde immobile → terminé.
 * (La cage est calée avant, par ses 4 coins.)
 */
import { checkFraming, type FramingParams } from './framing';
import { POSTURE_POINTS, flatten, unflatten, type Points } from './geometry';
import { isGuardPosture, measureGuard, type GuardMeasures } from './measures';
import { StableHold } from './stability';

export type WizardStep = 'framing' | 'prepare' | 'guard' | 'done';

export const STEP_ORDER: readonly WizardStep[] = ['framing', 'prepare', 'guard', 'done'];

export const STEP_INSTRUCTIONS: Record<WizardStep, string> = {
  framing: 'Placez-vous dans la cage, entièrement visible',
  prepare: 'Mettez-vous en garde',
  guard: 'En garde — ne bougez plus',
  done: 'Calibration terminée',
};

export interface WizardParams {
  holdMs: number;
  framingOkMs: number;
  guardPrepareMs: number;
  guardMaxHandLevel: number;
  stabilityTolerance: number;
  defaultHeightRatio: number;
  framing: FramingParams;
}

export interface WizardResult {
  guard: GuardMeasures;
}

export interface WizardState {
  step: WizardStep;
  instruction: string;
  /** Consigne corrective, ou null si la posture est correcte. */
  feedback: string | null;
  /** La posture demandée est correcte sur l'image courante. */
  valid: boolean;
  /** Avancement de l'étape courante (0 → 1). */
  progress: number;
}

export class CalibrationWizard {
  private stepIndex = 0;
  private readonly hold: StableHold;
  private framingSince: number | null = null;
  private prepareSince: number | null = null;
  private guard: GuardMeasures | null = null;

  constructor(private readonly p: WizardParams) {
    this.hold = new StableHold(p.holdMs);
  }

  get step(): WizardStep {
    return STEP_ORDER[this.stepIndex]!;
  }

  get result(): WizardResult | null {
    return this.guard ? { guard: this.guard } : null;
  }

  reset(): void {
    this.stepIndex = 0;
    this.hold.reset();
    this.framingSince = null;
    this.prepareSince = null;
    this.guard = null;
  }

  /** Traite une image ; `points` en pixels image (miroir). */
  update(t: number, points: Points, width: number, height: number): WizardState {
    if (this.step === 'done') return this.state(true, null, 1);

    const framing = checkFraming(points, width, height, this.p.framing);
    if (this.step === 'framing') {
      if (!framing.ok) {
        this.framingSince = null;
        return this.state(false, framing.message, 0);
      }
      this.framingSince ??= t;
      const progress = Math.min(1, (t - this.framingSince) / this.p.framingOkMs);
      if (progress < 1) return this.state(true, null, progress);
      this.advance();
      return this.state(true, null, 0);
    }

    if (this.step === 'prepare') {
      // Temps pour prendre sa garde : rien n'est mesuré.
      this.prepareSince ??= t;
      const left = this.p.guardPrepareMs - (t - this.prepareSince);
      if (left > 0) {
        return this.state(true, `Mesure dans ${Math.ceil(left / 1000)} s`, 1 - left / this.p.guardPrepareMs);
      }
      this.advance();
      return this.state(true, null, 0);
    }

    // Garde : cadrage correct, mains en garde, immobilité pendant holdMs ; mesure sur la moyenne.
    const heightRef = framing.heightPx ?? this.p.defaultHeightRatio * height;
    const inGuard = isGuardPosture(points, this.p.guardMaxHandLevel);
    const values = framing.ok && inGuard ? flatten(points, POSTURE_POINTS) : null;
    const hold = this.hold.push(t, values, this.p.stabilityTolerance * heightRef);
    if (hold.done) {
      this.guard = measureGuard(unflatten(this.hold.mean(), POSTURE_POINTS));
      if (this.guard) {
        this.advance();
        return this.state(true, null, 1);
      }
      this.hold.reset();
    }
    const feedback = !framing.ok ? framing.message : !inGuard ? 'Levez les mains en position de garde' : null;
    return this.state(values !== null, feedback, hold.progress);
  }

  private advance(): void {
    this.stepIndex = Math.min(this.stepIndex + 1, STEP_ORDER.length - 1);
    this.hold.reset();
  }

  private state(valid: boolean, feedback: string | null, progress: number): WizardState {
    return { step: this.step, instruction: STEP_INSTRUCTIONS[this.step], feedback, valid, progress };
  }
}
