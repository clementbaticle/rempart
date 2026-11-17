/**
 * Étalonnage individuel (section 4, point 4) : la gardienne en garde sur la ligne de but,
 * donc à la distance de la cage dont l'échelle est connue → hauteur de garde en cm.
 * Coordonnées : pixels image, miroir.
 */
import type { GoalCorners, GoalGeometry } from './goal';
import type { GuardMeasures } from './measures';

export interface ReferenceParams {
  ankleHeightCm: number;
  /** Écart toléré entre le sol sous les pieds et la ligne de but (cm). */
  lineToleranceCm: number;
  /** Bornes plausibles de la hauteur de garde, en proportion de la taille réelle. */
  minRatio: number;
  maxRatio: number;
}

export interface ReferenceResult {
  /** Hauteur de garde visage → chevilles (cm). */
  guardHeightCm: number;
  /** Proportion de la taille réelle. */
  ratio: number;
  /** Sol sous les pieds − ligne de but, en cm (> 0 : pieds devant la ligne). */
  lineOffsetCm: number;
  problems: string[];
}

/** Ordonnée de la ligne de but (pied des poteaux) à l'abscisse x, par interpolation. */
export function goalLineYAt(c: GoalCorners, x: number): number {
  const { bottomLeft: a, bottomRight: b } = c;
  if (b.x === a.x) return (a.y + b.y) / 2;
  return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
}

export function referenceCalibration(
  guard: GuardMeasures,
  corners: GoalCorners,
  goal: GoalGeometry,
  statureCm: number,
  p: ReferenceParams,
): ReferenceResult {
  const s = goal.pxPerCm;
  const guardHeightCm = guard.heightPx / s;
  const ratio = guardHeightCm / statureCm;
  const feetFloorY = guard.ankleY + p.ankleHeightCm * s;
  const lineOffsetCm = (feetFloorY - goalLineYAt(corners, guard.pelvis.x)) / s;
  const problems: string[] = [];
  if (Math.abs(lineOffsetCm) > p.lineToleranceCm) {
    problems.push(
      lineOffsetCm > 0
        ? `Pieds environ ${Math.round(lineOffsetCm)} cm devant la ligne de but : reculez sur la ligne.`
        : `Pieds environ ${Math.round(-lineOffsetCm)} cm derrière la ligne de but : avancez sur la ligne.`,
    );
  }
  if (ratio < p.minRatio || ratio > p.maxRatio) {
    problems.push(
      `Mesure peu plausible (${Math.round(guardHeightCm)} cm, soit ${Math.round(ratio * 100)} % de la taille) : ` +
        'vérifiez la taille du profil et les coins de la cage.',
    );
  }
  return { guardHeightCm, ratio, lineOffsetCm, problems };
}
