/** Dessin des cibles et des repères d'effecteurs (couleurs fixes, section 10). */
import type { Point, Points } from '../calibration/geometry';
import { L_ANKLE, L_WRIST, R_ANKLE, R_WRIST } from '../calibration/geometry';
import type { Rect } from '../pose/landmarks';
import { EXERCISE, TARGETS, type TargetKind } from '../theme';
import { imageToScreen } from './gridDraw';

/** Cible pleine de sa couleur, avec son symbole au centre. */
export function drawTarget(
  ctx: CanvasRenderingContext2D,
  centerImg: Point,
  radiusImg: number,
  kind: TargetKind,
  video: { width: number; height: number },
  rect: Rect,
): void {
  const c = imageToScreen(centerImg, video, rect);
  const r = radiusImg * (rect.width / video.width);
  const t = TARGETS[kind];
  ctx.save();
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  if (t.symbol !== 'foot-icon') {
    ctx.fillStyle = EXERCISE.background;
    ctx.font = `900 ${Math.round(r * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.symbol, c.x, c.y + r * 0.05);
  }
  ctx.restore();
}

/** Petits repères neutres sur les mains et les pieds (sans squelette complet). */
export function drawEffectorMarkers(
  ctx: CanvasRenderingContext2D,
  points: Points,
  video: { width: number; height: number },
  rect: Rect,
): void {
  ctx.save();
  ctx.strokeStyle = EXERCISE.landmark;
  ctx.lineWidth = 3;
  for (const i of [L_WRIST, R_WRIST, L_ANKLE, R_ANKLE]) {
    const p = points[i];
    if (!p) continue;
    const s = imageToScreen(p, video, rect);
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
