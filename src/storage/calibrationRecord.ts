/** Enregistrement d'une calibration (section 8) et sa construction (logique pure). */
import type { Grid } from '../calibration/grid';
import type { WizardResult } from '../calibration/wizard';
import { pixelsPerCm } from '../calibration/measures';

export interface CalibrationRecord {
  id: string;
  playerId: string;
  /** Date-heure ISO 8601. */
  date: string;
  video: { width: number; height: number };
  /** Mesures en pixels image (miroir). */
  measures: WizardResult;
  /** Pixels par cm (approximation, voir config). */
  pxPerCm: number;
  /** Mesures converties en cm (approximation). */
  cm: {
    shoulderWidth: number;
    span: number;
    reachTop: number;
    reachLeft: number;
    reachRight: number;
    stepLeft: number;
    stepRight: number;
  };
  grid: Grid;
  context: {
    appVersion: string;
    delegate: string;
    cameraPosition: string;
    userAgent: string;
  };
}

export function buildCalibrationRecord(args: {
  id: string;
  playerId: string;
  date: Date;
  statureCm: number;
  faceToAnkleOverStature: number;
  video: { width: number; height: number };
  result: WizardResult;
  grid: Grid;
  context: CalibrationRecord['context'];
}): CalibrationRecord {
  const r = args.result;
  const pxPerCm = pixelsPerCm(r.guard.heightPx, args.statureCm, args.faceToAnkleOverStature);
  const cm = (px: number): number => Math.round((px / pxPerCm) * 10) / 10;
  return {
    id: args.id,
    playerId: args.playerId,
    date: args.date.toISOString(),
    video: args.video,
    measures: r,
    pxPerCm,
    cm: {
      shoulderWidth: cm(r.guard.shoulderWidthPx),
      span: cm(r.spanPx),
      reachTop: cm(r.reachTopPx),
      reachLeft: cm(r.left.reachPx),
      reachRight: cm(r.right.reachPx),
      stepLeft: cm(r.left.stepPx),
      stepRight: cm(r.right.stepPx),
    },
    grid: args.grid,
    context: args.context,
  };
}
