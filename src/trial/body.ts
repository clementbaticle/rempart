/**
 * Échantillon corporel d'une image et critères de mouvement (section 5, point 4).
 * Coordonnées : pixels image, miroir.
 */
import { L_ANKLE, L_HIP, L_SHOULDER, R_ANKLE, R_HIP, R_SHOULDER, midpoint, type Point, type Points } from '../calibration/geometry';
import { handPoint } from '../calibration/measures';

export interface BodySample {
  shoulderCenter?: Point;
  pelvis?: Point;
  leftHand?: Point;
  rightHand?: Point;
  leftAnkle?: Point;
  rightAnkle?: Point;
}

export function bodySample(p: Points): BodySample {
  const ls = p[L_SHOULDER], rs = p[R_SHOULDER], lh = p[L_HIP], rh = p[R_HIP];
  const s: BodySample = {};
  if (ls && rs) s.shoulderCenter = midpoint(ls, rs);
  if (lh && rh) s.pelvis = midpoint(lh, rh);
  const l = handPoint(p, 'left');
  const r = handPoint(p, 'right');
  if (l) s.leftHand = l;
  if (r) s.rightHand = r;
  if (p[L_ANKLE]) s.leftAnkle = { ...p[L_ANKLE] };
  if (p[R_ANKLE]) s.rightAnkle = { ...p[R_ANKLE] };
  return s;
}

/**
 * Grandeurs surveillées pour l'initiation :
 * mains par rapport au centre des épaules (un rebond du corps entier ne compte pas),
 * bassin et chevilles en horizontal seulement.
 */
export interface Features {
  leftHandRel?: Point;
  rightHandRel?: Point;
  pelvisX?: number;
  leftAnkleX?: number;
  rightAnkleX?: number;
}

const rel = (a: Point, o: Point): Point => ({ x: a.x - o.x, y: a.y - o.y });

export function features(b: BodySample): Features {
  const f: Features = {};
  if (b.shoulderCenter && b.leftHand) f.leftHandRel = rel(b.leftHand, b.shoulderCenter);
  if (b.shoulderCenter && b.rightHand) f.rightHandRel = rel(b.rightHand, b.shoulderCenter);
  if (b.pelvis) f.pelvisX = b.pelvis.x;
  if (b.leftAnkle) f.leftAnkleX = b.leftAnkle.x;
  if (b.rightAnkle) f.rightAnkleX = b.rightAnkle.x;
  return f;
}

function meanOf(values: number[]): number | undefined {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : undefined;
}

function meanPoint(points: Point[]): Point | undefined {
  const x = meanOf(points.map((p) => p.x));
  const y = meanOf(points.map((p) => p.y));
  return x === undefined || y === undefined ? undefined : { x, y };
}

/** Référence : moyenne de chaque grandeur sur les échantillons où elle est présente. */
export function meanFeatures(list: readonly Features[]): Features {
  const pick = <T>(k: keyof Features): T[] =>
    list.map((f) => f[k]).filter((v): v is NonNullable<Features[typeof k]> => v !== undefined) as T[];
  const out: Features = {};
  const lh = meanPoint(pick<Point>('leftHandRel'));
  const rh = meanPoint(pick<Point>('rightHandRel'));
  const px = meanOf(pick<number>('pelvisX'));
  const lx = meanOf(pick<number>('leftAnkleX'));
  const rx = meanOf(pick<number>('rightAnkleX'));
  if (lh) out.leftHandRel = lh;
  if (rh) out.rightHandRel = rh;
  if (px !== undefined) out.pelvisX = px;
  if (lx !== undefined) out.leftAnkleX = lx;
  if (rx !== undefined) out.rightAnkleX = rx;
  return out;
}

export type InitiationCause = 'main-gauche' | 'main-droite' | 'bassin' | 'pied-gauche' | 'pied-droit' | 'touche';

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Premier critère dépassant le seuil (ordre : mains, bassin, pieds), ou null. */
export function movementCause(cur: Features, base: Features, thresholdPx: number): InitiationCause | null {
  if (cur.leftHandRel && base.leftHandRel && dist(cur.leftHandRel, base.leftHandRel) > thresholdPx) return 'main-gauche';
  if (cur.rightHandRel && base.rightHandRel && dist(cur.rightHandRel, base.rightHandRel) > thresholdPx) return 'main-droite';
  if (cur.pelvisX !== undefined && base.pelvisX !== undefined && Math.abs(cur.pelvisX - base.pelvisX) > thresholdPx) return 'bassin';
  if (cur.leftAnkleX !== undefined && base.leftAnkleX !== undefined && Math.abs(cur.leftAnkleX - base.leftAnkleX) > thresholdPx) return 'pied-gauche';
  if (cur.rightAnkleX !== undefined && base.rightAnkleX !== undefined && Math.abs(cur.rightAnkleX - base.rightAnkleX) > thresholdPx) return 'pied-droit';
  return null;
}

/**
 * Indice de balancement : écart moyen des mains (par rapport aux épaules) à leur position moyenne,
 * en proportion de la taille apparente. null sans données.
 */
export function swayRatio(list: readonly Features[], heightPx: number): number | null {
  const devs: number[] = [];
  for (const key of ['leftHandRel', 'rightHandRel'] as const) {
    const pts = list.map((f) => f[key]).filter((p): p is Point => p !== undefined);
    const m = meanPoint(pts);
    if (m) pts.forEach((p) => devs.push(dist(p, m)));
  }
  const mean = meanOf(devs);
  return mean === undefined || heightPx <= 0 ? null : mean / heightPx;
}
