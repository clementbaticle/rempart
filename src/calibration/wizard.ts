/**
 * Déroulé de la calibration (logique pure, sans affichage) :
 * cadrage → garde → envergure → bras levés → pas à gauche → pas à droite → terminé.
 */
import { checkFraming, type FramingParams } from './framing';
import { POSTURE_POINTS, flatten, unflatten, present, HANDS, type Points } from './geometry';
import {
  isArmsRaised, isArmsSpread, isStepped, measureGuard, measureLateral, measureReachTop, measureSpan,
  type GuardMeasures, type LateralMeasures, type Side,
} from './measures';
import { StableHold } from './stability';

export type WizardStep = 'framing' | 'guard' | 'span' | 'raised' | 'stepLeft' | 'stepRight' | 'done';

export const STEP_ORDER: readonly WizardStep[] = ['framing', 'guard', 'span', 'raised', 'stepLeft', 'stepRight', 'done'];

export const STEP_INSTRUCTIONS: Record<WizardStep, string> = {
  framing: 'Placez-vous entièrement dans l’image',
  guard: 'Position de garde — ne bougez plus',
  span: 'Bras écartés à l’horizontale',
  raised: 'Bras levés au maximum',
  stepLeft: 'Un grand pas à gauche, bras écartés',
  stepRight: 'Un grand pas à droite, bras écartés',
  done: 'Calibration terminée',
};

const POSTURE_HINTS: Partial<Record<WizardStep, string>> = {
  guard: 'Restez immobile, tout le corps visible',
  span: 'Tendez les bras à hauteur d’épaules',
  raised: 'Levez les deux mains au-dessus de la tête',
  stepLeft: 'Faites un pas plus grand vers votre gauche',
  stepRight: 'Faites un pas plus grand vers votre droite',
};

export interface WizardParams {
  holdMs: number;
  framingOkMs: number;
  stabilityTolerance: number;
  defaultHeightRatio: number;
  framing: FramingParams;
  postures: { armsLevelTolerance: number; minStepRatio: number };
}

export interface WizardResult {
  guard: GuardMeasures;
  spanPx: number;
  reachTopPx: number;
  left: LateralMeasures;
  right: LateralMeasures;
}

export interface WizardState {
  step: WizardStep;
  instruction: string;
  /** Consigne corrective, ou null si la posture est correcte. */
  feedback: string | null;
  /** La posture demandée est correcte sur l'image courante. */
  valid: boolean;
  /** Avancement du maintien de l'étape courante (0 → 1). */
  progress: number;
}

export class CalibrationWizard {
  private stepIndex = 0;
  private readonly hold: StableHold;
  private framingSince: number | null = null;
  private guard: GuardMeasures | null = null;
  private spanPx: number | null = null;
  private reachTopPx: number | null = null;
  private left: LateralMeasures | null = null;
  private right: LateralMeasures | null = null;

  constructor(private readonly p: WizardParams) {
    this.hold = new StableHold(p.holdMs);
  }

  get step(): WizardStep {
    return STEP_ORDER[this.stepIndex]!;
  }

  get result(): WizardResult | null {
    const { guard, spanPx, reachTopPx, left, right } = this;
    if (!guard || spanPx === null || reachTopPx === null || !left || !right) return null;
    return { guard, spanPx, reachTopPx, left, right };
  }

  reset(): void {
    this.stepIndex = 0;
    this.hold.reset();
    this.framingSince = null;
    this.guard = this.left = this.right = null;
    this.spanPx = this.reachTopPx = null;
  }

  /** Traite une image ; `points` en pixels image (miroir). */
  update(t: number, points: Points, width: number, height: number): WizardState {
    const step = this.step;
    if (step === 'done') return this.state(true, null, 1);
    if (step === 'framing') return this.updateFraming(t, points, width, height);

    const heightRef = this.guard?.heightPx ?? this.p.defaultHeightRatio * height;
    // La garde est mesurée seulement si le cadrage reste correct.
    const valid =
      step === 'guard'
        ? checkFraming(points, width, height, this.p.framing).ok
        : this.isPostureValid(step, points, heightRef);
    const values = valid ? flatten(points, POSTURE_POINTS) : null;
    const hold = this.hold.push(t, values, this.p.stabilityTolerance * heightRef);

    let feedback: string | null = null;
    if (!valid) feedback = this.invalidFeedback(step, points);
    else if (values === null) feedback = 'Corps entier visible, s’il vous plaît';

    if (hold.done && this.measure(step, unflatten(this.hold.mean(), POSTURE_POINTS))) {
      this.advance();
      return this.state(true, null, 0);
    }
    return this.state(valid && values !== null, feedback, hold.progress);
  }

  private updateFraming(t: number, points: Points, w: number, h: number): WizardState {
    const f = checkFraming(points, w, h, this.p.framing);
    if (!f.ok) {
      this.framingSince = null;
      return this.state(false, f.message, 0);
    }
    this.framingSince ??= t;
    const progress = Math.min(1, (t - this.framingSince) / this.p.framingOkMs);
    if (progress >= 1) {
      this.advance();
      return this.state(true, null, 0);
    }
    return this.state(true, null, progress);
  }

  private isPostureValid(step: WizardStep, p: Points, heightRef: number): boolean {
    switch (step) {
      case 'span':
        return isArmsSpread(p, heightRef, this.p.postures.armsLevelTolerance);
      case 'raised':
        return isArmsRaised(p);
      case 'stepLeft':
      case 'stepRight':
        return (
          this.guard !== null &&
          isStepped(p, this.guard, step === 'stepLeft' ? 'left' : 'right', this.p.postures.minStepRatio)
        );
      default:
        return false;
    }
  }

  private invalidFeedback(step: WizardStep, p: Points): string {
    if (present(p, HANDS).length < HANDS.length) return 'Mains non visibles';
    return POSTURE_HINTS[step] ?? '';
  }

  /** Enregistre la mesure de l'étape ; false si elle est impossible (l'étape recommence). */
  private measure(step: WizardStep, mean: Points): boolean {
    switch (step) {
      case 'guard':
        this.guard = measureGuard(mean);
        return this.guard !== null;
      case 'span':
        this.spanPx = measureSpan(mean);
        return this.spanPx !== null;
      case 'raised':
        this.reachTopPx = this.guard ? measureReachTop(mean, this.guard) : null;
        return this.reachTopPx !== null;
      case 'stepLeft':
      case 'stepRight': {
        const side: Side = step === 'stepLeft' ? 'left' : 'right';
        const m = this.guard ? measureLateral(mean, this.guard, side) : null;
        if (side === 'left') this.left = m;
        else this.right = m;
        return m !== null;
      }
      default:
        return false;
    }
  }

  private advance(): void {
    this.stepIndex = Math.min(this.stepIndex + 1, STEP_ORDER.length - 1);
    this.hold.reset();
  }

  private state(valid: boolean, feedback: string | null, progress: number): WizardState {
    return { step: this.step, instruction: STEP_INSTRUCTIONS[this.step], feedback, valid, progress };
  }
}
