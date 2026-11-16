/** Dessin de la grille 3 × 3 (couleurs neutres, aucune couleur de cible ni du club). */
import type { Grid } from '../calibration/grid';
import type { Point } from '../calibration/geometry';
import type { Rect } from '../pose/landmarks';
import { EXERCISE } from '../theme';

/** Pixels image (déjà en miroir) → pixels écran. */
export function imageToScreen(p: Point, video: { width: number; height: number }, rect: Rect): Point {
  return { x: rect.x + (p.x / video.width) * rect.width, y: rect.y + (p.y / video.height) * rect.height };
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  video: { width: number; height: number },
  rect: Rect,
): void {
  const scale = rect.width / video.width;
  ctx.save();
  ctx.lineWidth = 2;
  for (const z of grid.zones) {
    const tl = imageToScreen({ x: z.rect.x, y: z.rect.y }, video, rect);
    ctx.strokeStyle = EXERCISE.gridLine;
    ctx.strokeRect(tl.x, tl.y, z.rect.width * scale, z.rect.height * scale);

    const c = imageToScreen(z.center, video, rect);
    const r = grid.targetRadiusPx * scale;
    const out = grid.overflowing.includes(z.id);
    ctx.strokeStyle = out ? EXERCISE.error : EXERCISE.landmark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;

    ctx.fillStyle = out ? EXERCISE.error : EXERCISE.text;
    ctx.font = `700 ${Math.max(16, r * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(z.id), c.x, c.y);
  }
  ctx.restore();
}
