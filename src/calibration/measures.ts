/**
 * Validité des postures et mesures (section 4). Entrées : repères moyens en pixels image (miroir).
 */
import {
  LEFT_HAND, L_HIP, L_SHOULDER, RIGHT_HAND, R_HIP, R_SHOULDER, L_ANKLE, R_ANKLE,
  apparentHeight, midpoint, present, type Point, type Points,
} from './geometry';

export type Side = 'left' | 'right';

export interface GuardMeasures {
  /** Taille apparente visage → chevilles (px). */
  heightPx: number;
  faceTopY: number;
  ankleY: number;
  shoulderWidthPx: number;
  pelvis: Point;
  /** Centre des épaules (référence des zones de garde). */
  shoulderCenter: Point;
  /** Position de garde de chaque main (milieu poignet / index). */
  leftHand: Point;
  rightHand: Point;
  leftAnkle: Point;
  rightAnkle: Point;
}

/** Point représentatif d'une main : milieu du poignet et de l'index (ou celui des deux présent). */
export function handPoint(p: Points, side: Side): Point | null {
  const pts = present(p, side === 'left' ? LEFT_HAND : RIGHT_HAND);
  if (pts.length === 0) return null;
  return { x: pts.reduce((s, q) => s + q.x, 0) / pts.length, y: pts.reduce((s, q) => s + q.y, 0) / pts.length };
}

export function measureGuard(p: Points): GuardMeasures | null {
  const h = apparentHeight(p);
  const ls = p[L_SHOULDER], rs = p[R_SHOULDER], lh = p[L_HIP], rh = p[R_HIP];
  const la = p[L_ANKLE], ra = p[R_ANKLE];
  const lHand = handPoint(p, 'left'), rHand = handPoint(p, 'right');
  if (h === null || h <= 0 || !ls || !rs || !lh || !rh || !la || !ra || !lHand || !rHand) return null;
  const ankleY = (la.y + ra.y) / 2;
  return {
    heightPx: h,
    faceTopY: ankleY - h,
    ankleY,
    shoulderWidthPx: Math.abs(rs.x - ls.x),
    pelvis: midpoint(lh, rh),
    shoulderCenter: midpoint(ls, rs),
    leftHand: lHand,
    rightHand: rHand,
    leftAnkle: { ...la },
    rightAnkle: { ...ra },
  };
}

/**
 * Garde valide : les deux mains au-dessus d'un niveau du buste
 * (`maxLevel` : 0 = épaules, 1 = bassin). Bras le long du corps → false.
 */
export function isGuardPosture(p: Points, maxLevel: number): boolean {
  const ls = p[L_SHOULDER], rs = p[R_SHOULDER], lh = p[L_HIP], rh = p[R_HIP];
  const l = handPoint(p, 'left'), r = handPoint(p, 'right');
  if (!ls || !rs || !lh || !rh || !l || !r) return false;
  const shoulderY = (ls.y + rs.y) / 2;
  const limit = shoulderY + maxLevel * ((lh.y + rh.y) / 2 - shoulderY);
  return l.y < limit && r.y < limit;
}

/** Échelle px/cm à partir de la taille réelle (approximation visage → chevilles). */
export function pixelsPerCm(heightPx: number, statureCm: number, faceToAnkleOverStature: number): number {
  return heightPx / (statureCm * faceToAnkleOverStature);
}

/**
 * Comparaison à la calibration précédente : écart relatif d'une taille à l'image (cage),
 * rapportée à la hauteur d'image (robuste à un changement de résolution).
 */
export function apparentSizeChange(
  current: { sizePx: number; videoHeight: number },
  previous: { sizePx: number; videoHeight: number },
): number {
  const a = current.sizePx / current.videoHeight;
  const b = previous.sizePx / previous.videoHeight;
  return Math.abs(a - b) / b;
}
