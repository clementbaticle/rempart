/** Zones de garde et détection de touche (section 5). Coordonnées : pixels image, miroir. */
import { LEFT_HAND, L_ANKLE, L_FOOT, RIGHT_HAND, R_ANKLE, R_FOOT, present, type Point, type Points } from '../calibration/geometry';
import type { Grid } from '../calibration/grid';
import type { GuardMeasures } from '../calibration/measures';
import type { BodySample } from './body';

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Les deux mains sont dans leur zone de garde (position relative au centre des épaules). */
export function handsInGuard(b: BodySample, g: GuardMeasures, radiusPx: number): boolean {
  if (!b.shoulderCenter || !b.leftHand || !b.rightHand) return false;
  const sc = b.shoulderCenter;
  const expectedL = { x: sc.x + (g.leftHand.x - g.shoulderCenter.x), y: sc.y + (g.leftHand.y - g.shoulderCenter.y) };
  const expectedR = { x: sc.x + (g.rightHand.x - g.shoulderCenter.x), y: sc.y + (g.rightHand.y - g.shoulderCenter.y) };
  return dist(b.leftHand, expectedL) <= radiusPx && dist(b.rightHand, expectedR) <= radiusPx;
}

/** Zones dont la cible chevauche une zone de garde (position de calibration). */
export function guardOverlaps(g: GuardMeasures, grid: Grid, guardRadiusPx: number, hitFactor: number): number[] {
  const reach = grid.targetRadiusPx * hitFactor + guardRadiusPx;
  return grid.zones
    .filter((z) => dist(z.center, g.leftHand) < reach || dist(z.center, g.rightHand) < reach)
    .map((z) => z.id);
}

export type Effector = 'main-gauche' | 'main-droite' | 'pied-gauche' | 'pied-droit';

const EFFECTOR_POINTS: Record<Effector, readonly number[]> = {
  'main-gauche': LEFT_HAND,
  'main-droite': RIGHT_HAND,
  'pied-gauche': [L_ANKLE, L_FOOT],
  'pied-droit': [R_ANKLE, R_FOOT],
};

export const isFoot = (e: Effector): boolean => e === 'pied-gauche' || e === 'pied-droit';

export interface Touch {
  zone: number;
  effector: Effector;
}

/** Toutes les touches de l'image : effecteur dont un point est dans le cercle d'une cible. */
export function touches(p: Points, grid: Grid, hitFactor: number): Touch[] {
  const r = grid.targetRadiusPx * hitFactor;
  const out: Touch[] = [];
  for (const z of grid.zones) {
    for (const [effector, idx] of Object.entries(EFFECTOR_POINTS) as [Effector, readonly number[]][]) {
      if (present(p, idx).some((q) => dist(q, z.center) <= r)) out.push({ zone: z.id, effector });
    }
  }
  return out;
}

export const touchKey = (t: Touch): string => `${t.zone}:${t.effector}`;

/**
 * Mode Classique : n'importe quel effecteur (main ou pied) sur n'importe quelle cible —
 * des arrêts réels associent souvent pied et main en hauteur.
 */
export const allowedClassic = (_zone: number, _effector: Effector): boolean => true;

/**
 * Touche de la CIBLE par un effecteur autorisé (main de préférence), ou null.
 * Les autres zones touchées sont ignorées : les traverser pour atteindre la cible n'est pas une erreur.
 */
export function targetTouch(all: readonly Touch[], targetZone: number): Touch | null {
  const onTarget = all.filter((t) => t.zone === targetZone && allowedClassic(t.zone, t.effector));
  return onTarget.find((t) => !isFoot(t.effector)) ?? onTarget[0] ?? null;
}
