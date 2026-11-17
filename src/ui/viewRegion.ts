/**
 * Zoom d'affichage sur la zone de jeu (logique pure). N'affecte PAS la mesure :
 * la détection travaille toujours sur l'image complète ; seul l'affichage est recadré.
 * Coordonnées : pixels image (miroir).
 */
import type { Point } from '../calibration/geometry';
import type { Rect } from '../pose/landmarks';

export interface ViewMargins {
  /** Marges en proportion de la largeur / hauteur de la zone de jeu. */
  side: number;
  top: number;
  bottom: number;
}

/** Rectangle englobant des points et des cercles (cibles). */
export function boundsOf(points: readonly Point[], circles: readonly { center: Point; radius: number }[] = []): Rect {
  const xs: number[] = [];
  const ys: number[] = [];
  points.forEach((p) => {
    xs.push(p.x);
    ys.push(p.y);
  });
  circles.forEach(({ center, radius }) => {
    xs.push(center.x - radius, center.x + radius);
    ys.push(center.y - radius, center.y + radius);
  });
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Région à afficher : zone de jeu + marges, élargie au format de l'écran,
 * puis ramenée dans l'image (jamais plus grande que l'image entière).
 */
export function viewRegion(
  play: Rect,
  margins: ViewMargins,
  video: { width: number; height: number },
  boxAspect: number,
): Rect {
  let x = play.x - margins.side * play.width;
  let y = play.y - margins.top * play.height;
  let w = play.width * (1 + 2 * margins.side);
  let h = play.height * (1 + margins.top + margins.bottom);
  // Format de l'écran : on élargit le côté trop court, autour du centre.
  if (w / h < boxAspect) {
    const nw = h * boxAspect;
    x -= (nw - w) / 2;
    w = nw;
  } else {
    const nh = w / boxAspect;
    y -= (nh - h) / 2;
    h = nh;
  }
  // Pas plus grand que l'image, puis recalé à l'intérieur.
  const scale = Math.min(1, video.width / w, video.height / h);
  if (scale < 1) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    w *= scale;
    h *= scale;
    x = cx - w / 2;
    y = cy - h / 2;
  }
  x = Math.min(Math.max(x, 0), video.width - w);
  y = Math.min(Math.max(y, 0), video.height - h);
  return { x, y, width: w, height: h };
}

/**
 * Rectangle d'affichage de l'image ENTIÈRE (pixels écran) tel que `region` remplisse la boîte
 * au mieux ; ce qui dépasse est masqué. Sans région : image entière contenue dans la boîte.
 */
export function displayRect(
  video: { width: number; height: number },
  box: { width: number; height: number },
  region: Rect | null,
): Rect {
  const r = region ?? { x: 0, y: 0, width: video.width, height: video.height };
  if (video.width <= 0 || video.height <= 0 || r.width <= 0 || r.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(box.width / r.width, box.height / r.height);
  return {
    x: box.width / 2 - (r.x + r.width / 2) * scale,
    y: box.height / 2 - (r.y + r.height / 2) * scale,
    width: video.width * scale,
    height: video.height * scale,
  };
}
