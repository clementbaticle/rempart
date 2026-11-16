/**
 * Espace de calibration : pixels de l'image vidéo, **en miroir** (comme à l'écran).
 * La main gauche réelle de la joueuse apparaît donc à gauche : x croissant = vers sa droite.
 */
import { isVisible, type Landmark } from '../pose/landmarks';

export interface Point {
  x: number;
  y: number;
}

/** Repères indexés (33 cases) ; `undefined` = absent ou sous le seuil de visibilité. */
export type Points = readonly (Point | undefined)[];

export const NOSE = 0;
export const LEFT_EYE = 2;
export const RIGHT_EYE = 5;
export const L_SHOULDER = 11;
export const R_SHOULDER = 12;
export const L_WRIST = 15;
export const R_WRIST = 16;
export const L_INDEX = 19;
export const R_INDEX = 20;
export const L_HIP = 23;
export const R_HIP = 24;
export const L_ANKLE = 27;
export const R_ANKLE = 28;
export const L_FOOT = 31;
export const R_FOOT = 32;

export const FACE_TOP = [NOSE, LEFT_EYE, RIGHT_EYE] as const;
export const LEFT_HAND = [L_WRIST, L_INDEX] as const;
export const RIGHT_HAND = [R_WRIST, R_INDEX] as const;
export const HANDS = [...LEFT_HAND, ...RIGHT_HAND] as const;

/** Repères suivis pendant les postures (immobilité et mesures). */
export const POSTURE_POINTS = [
  NOSE, LEFT_EYE, RIGHT_EYE,
  L_SHOULDER, R_SHOULDER,
  L_WRIST, R_WRIST, L_INDEX, R_INDEX,
  L_HIP, R_HIP,
  L_ANKLE, R_ANKLE,
] as const;

/** Convertit les repères normalisés en pixels image, en miroir, en ignorant les repères peu visibles. */
export function toImagePoints(
  landmarks: readonly Landmark[] | undefined,
  width: number,
  height: number,
  threshold: number,
): Points {
  const out: (Point | undefined)[] = new Array(33).fill(undefined);
  if (!landmarks) return out;
  landmarks.forEach((lm, i) => {
    if (i < 33 && isVisible(lm, threshold)) out[i] = { x: (1 - lm.x) * width, y: lm.y * height };
  });
  return out;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Points présents parmi les indices demandés. */
export function present(points: Points, indices: readonly number[]): Point[] {
  return indices.map((i) => points[i]).filter((p): p is Point => p !== undefined);
}

/** Tous les indices sont présents. */
export function allPresent(points: Points, indices: readonly number[]): boolean {
  return indices.every((i) => points[i] !== undefined);
}

/** Aplatit les repères demandés en vecteur [x0, y0, x1, y1…] ; null s'il en manque un. */
export function flatten(points: Points, indices: readonly number[]): number[] | null {
  const out: number[] = [];
  for (const i of indices) {
    const p = points[i];
    if (!p) return null;
    out.push(p.x, p.y);
  }
  return out;
}

/** Inverse de `flatten` : reconstruit un tableau de repères (33 cases). */
export function unflatten(values: readonly number[], indices: readonly number[]): Points {
  const out: (Point | undefined)[] = new Array(33).fill(undefined);
  indices.forEach((idx, k) => {
    const x = values[2 * k];
    const y = values[2 * k + 1];
    if (x !== undefined && y !== undefined) out[idx] = { x, y };
  });
  return out;
}

/** Taille apparente : du haut du visage au milieu des chevilles (pixels). */
export function apparentHeight(points: Points): number | null {
  const face = present(points, FACE_TOP);
  const la = points[L_ANKLE];
  const ra = points[R_ANKLE];
  if (face.length === 0 || !la || !ra) return null;
  const top = Math.min(...face.map((p) => p.y));
  return (la.y + ra.y) / 2 - top;
}
