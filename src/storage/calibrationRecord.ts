/** Enregistrement d'une calibration (section 8) et sa construction (logique pure). */
import { goalGeometry, type GoalCorners, type GoalGeometry } from '../calibration/goal';
import { computeGrid, type Grid, type GridParams } from '../calibration/grid';
import { pixelsPerCm } from '../calibration/measures';
import type { WizardResult } from '../calibration/wizard';

export interface CalibrationRecord {
  id: string;
  playerId: string;
  /** Date-heure ISO 8601. */
  date: string;
  video: { width: number; height: number };
  goal: { corners: GoalCorners; geometry: GoalGeometry };
  /** Mesures de garde en pixels image (miroir). */
  measures: WizardResult;
  /** Échelle de la joueuse à sa distance (px / cm). */
  pxPerCm: number;
  /** Origine de l'échelle : étalonnage individuel ou approximation par la taille. */
  scaleSource: 'etalonnage' | 'taille';
  /** Hauteur de garde (cm) utilisée pour l'échelle. */
  guardHeightCm: number;
  /** Échelle joueuse / échelle cage (> 1 : la joueuse est devant la cage). */
  depthRatio: number;
  cm: { shoulderWidth: number };
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
  /** Étalonnage individuel (cm), s'il existe. */
  guardHeightCm?: number | undefined;
  ankleHeightCm: number;
  goalSizeCm: { width: number; height: number };
  gridParams: GridParams;
  video: { width: number; height: number };
  corners: GoalCorners;
  result: WizardResult;
  context: CalibrationRecord['context'];
}): CalibrationRecord {
  const g = args.result.guard;
  const geometry = goalGeometry(args.corners, args.goalSizeCm.width, args.goalSizeCm.height);
  const calibrated = args.guardHeightCm !== undefined && args.guardHeightCm > 0;
  const guardHeightCm = calibrated ? args.guardHeightCm! : args.statureCm * args.faceToAnkleOverStature;
  const pxPerCm = calibrated
    ? g.heightPx / guardHeightCm
    : pixelsPerCm(g.heightPx, args.statureCm, args.faceToAnkleOverStature);
  const grid = computeGrid(
    { playerPxPerCm: pxPerCm, centerX: geometry.centerX, floorY: g.ankleY + args.ankleHeightCm * pxPerCm },
    args.video.width,
    args.video.height,
    args.gridParams,
  );
  return {
    id: args.id,
    playerId: args.playerId,
    date: args.date.toISOString(),
    video: args.video,
    goal: { corners: args.corners, geometry },
    measures: args.result,
    pxPerCm,
    scaleSource: calibrated ? 'etalonnage' : 'taille',
    guardHeightCm,
    depthRatio: pxPerCm / geometry.pxPerCm,
    cm: { shoulderWidth: Math.round((g.shoulderWidthPx / pxPerCm) * 10) / 10 },
    grid,
    context: args.context,
  };
}
