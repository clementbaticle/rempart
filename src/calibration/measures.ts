/**
 * Validité des postures et mesures (section 4). Entrées : repères moyens en pixels image (miroir).
 */
import {
  HANDS, LEFT_HAND, L_HIP, L_SHOULDER, L_WRIST, RIGHT_HAND, R_HIP, R_SHOULDER, R_WRIST,
  FACE_TOP, L_ANKLE, R_ANKLE,
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
}

export function measureGuard(p: Points): GuardMeasures | null {
  const h = apparentHeight(p);
  const ls = p[L_SHOULDER], rs = p[R_SHOULDER], lh = p[L_HIP], rh = p[R_HIP];
  const la = p[L_ANKLE], ra = p[R_ANKLE];
  if (h === null || h <= 0 || !ls || !rs || !lh || !rh || !la || !ra) return null;
  const ankleY = (la.y + ra.y) / 2;
  return {
    heightPx: h,
    faceTopY: ankleY - h,
    ankleY,
    shoulderWidthPx: Math.abs(rs.x - ls.x),
    pelvis: midpoint(lh, rh),
  };
}

/** Bras écartés : poignets à hauteur d'épaules et à l'extérieur de celles-ci. */
export function isArmsSpread(p: Points, heightPx: number, levelTolerance: number): boolean {
  const ls = p[L_SHOULDER], rs = p[R_SHOULDER], lw = p[L_WRIST], rw = p[R_WRIST];
  if (!ls || !rs || !lw || !rw) return false;
  const tol = levelTolerance * heightPx;
  return (
    Math.abs(lw.y - ls.y) <= tol &&
    Math.abs(rw.y - rs.y) <= tol &&
    lw.x < ls.x && // main gauche à gauche de l'épaule gauche (miroir)
    rw.x > rs.x
  );
}

/** Bras levés : les deux poignets au-dessus du visage. */
export function isArmsRaised(p: Points): boolean {
  const face = present(p, FACE_TOP);
  const lw = p[L_WRIST], rw = p[R_WRIST];
  if (face.length === 0 || !lw || !rw) return false;
  const top = Math.min(...face.map((q) => q.y));
  return lw.y < top && rw.y < top;
}

function pelvisOf(p: Points): Point | null {
  const lh = p[L_HIP], rh = p[R_HIP];
  return lh && rh ? midpoint(lh, rh) : null;
}

/** Pas latéral effectué : le bassin s'est déplacé du côté demandé d'au moins `minRatio` × taille. */
export function isStepped(p: Points, guard: GuardMeasures, side: Side, minRatio: number): boolean {
  const pelvis = pelvisOf(p);
  if (!pelvis) return false;
  const shift = pelvis.x - guard.pelvis.x; // > 0 : vers la droite de la joueuse
  const min = minRatio * guard.heightPx;
  return side === 'left' ? shift <= -min : shift >= min;
}

/** Envergure : de la main gauche la plus éloignée à la main droite la plus éloignée (px). */
export function measureSpan(p: Points): number | null {
  const l = present(p, LEFT_HAND), r = present(p, RIGHT_HAND);
  if (l.length === 0 || r.length === 0) return null;
  return Math.max(...r.map((q) => q.x)) - Math.min(...l.map((q) => q.x));
}

/** Portée haute : des chevilles (garde) au point de main le plus haut (px). */
export function measureReachTop(p: Points, guard: GuardMeasures): number | null {
  const hands = present(p, HANDS);
  if (hands.length === 0) return null;
  return guard.ankleY - Math.min(...hands.map((q) => q.y));
}

export interface LateralMeasures {
  /** Du centre du bassin en garde à la main la plus éloignée du côté du pas (px). */
  reachPx: number;
  /** Déplacement du bassin (px). */
  stepPx: number;
}

export function measureLateral(p: Points, guard: GuardMeasures, side: Side): LateralMeasures | null {
  const hands = present(p, HANDS);
  const pelvis = pelvisOf(p);
  if (hands.length === 0 || !pelvis) return null;
  const xs = hands.map((q) => q.x);
  const cx = guard.pelvis.x;
  return side === 'left'
    ? { reachPx: cx - Math.min(...xs), stepPx: cx - pelvis.x }
    : { reachPx: Math.max(...xs) - cx, stepPx: pelvis.x - cx };
}

/** Échelle px/cm à partir de la taille réelle (approximation visage → chevilles). */
export function pixelsPerCm(heightPx: number, statureCm: number, faceToAnkleOverStature: number): number {
  return heightPx / (statureCm * faceToAnkleOverStature);
}

/**
 * Comparaison à la calibration précédente : écart relatif de taille apparente,
 * rapportée à la hauteur d'image (robuste à un changement de résolution).
 */
export function apparentSizeChange(
  current: { heightPx: number; videoHeight: number },
  previous: { heightPx: number; videoHeight: number },
): number {
  const a = current.heightPx / current.videoHeight;
  const b = previous.heightPx / previous.videoHeight;
  return Math.abs(a - b) / b;
}
