/** Cadrage (section 4, étape 1) : la joueuse est-elle entièrement et correctement visible ? */
import {
  FACE_TOP, L_ANKLE, L_FOOT, L_HIP, L_SHOULDER, L_WRIST, R_ANKLE, R_FOOT, R_HIP, R_SHOULDER, R_WRIST,
  apparentHeight, present, type Point, type Points,
} from './geometry';

export type FramingIssue =
  | 'no-pose'
  | 'feet'
  | 'head'
  | 'hands'
  | 'too-close'
  | 'too-far'
  | 'move-right'
  | 'move-left';

export interface FramingParams {
  edgeMargin: number;
  minHeightRatio: number;
  maxHeightRatio: number;
  centerMin: number;
  centerMax: number;
}

export interface FramingResult {
  ok: boolean;
  issue: FramingIssue | null;
  message: string;
  heightPx: number | null;
}

export const FRAMING_MESSAGES: Record<FramingIssue | 'ok', string> = {
  ok: 'Cadrage correct',
  'no-pose': 'Placez-vous face à la tablette',
  feet: 'Pieds non visibles : reculez ou baissez la tablette',
  head: 'Tête hors champ : reculez',
  hands: 'Mains hors champ : reculez',
  'too-close': 'Trop près : reculez',
  'too-far': 'Trop loin : approchez-vous',
  'move-right': 'Décalez-vous vers votre droite',
  'move-left': 'Décalez-vous vers votre gauche',
};

function inside(p: Point | undefined, w: number, h: number, margin: number): boolean {
  if (!p) return false;
  const mx = margin * w;
  const my = margin * h;
  return p.x >= mx && p.x <= w - mx && p.y >= my && p.y <= h - my;
}

function result(issue: FramingIssue | null, heightPx: number | null): FramingResult {
  return { ok: issue === null, issue, message: FRAMING_MESSAGES[issue ?? 'ok'], heightPx };
}

export function checkFraming(points: Points, width: number, height: number, p: FramingParams): FramingResult {
  const torso = [points[L_SHOULDER], points[R_SHOULDER], points[L_HIP], points[R_HIP]];
  if (torso.some((q) => !q)) return result('no-pose', null);

  const m = p.edgeMargin;
  const feet = [L_ANKLE, R_ANKLE, L_FOOT, R_FOOT].map((i) => points[i]);
  if (!feet.every((q) => inside(q, width, height, m))) return result('feet', null);

  const face = present(points, FACE_TOP);
  if (face.length === 0 || !face.every((q) => inside(q, width, height, m))) return result('head', null);

  if (![points[L_WRIST], points[R_WRIST]].every((q) => inside(q, width, height, m))) {
    return result('hands', null);
  }

  const h = apparentHeight(points);
  if (h === null) return result('no-pose', null);
  if (h > p.maxHeightRatio * height) return result('too-close', h);
  if (h < p.minHeightRatio * height) return result('too-far', h);

  // Image en miroir : apparaître trop à gauche → se décaler vers sa droite.
  const cx = (points[L_HIP]!.x + points[R_HIP]!.x) / 2 / width;
  if (cx < p.centerMin) return result('move-right', h);
  if (cx > p.centerMax) return result('move-left', h);

  return result(null, h);
}
