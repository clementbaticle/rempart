/** Grille 3 × 3 proportionnée à la joueuse (section 4). Coordonnées : pixels image, miroir. */
import type { Point } from './geometry';

export interface GridInput {
  heightPx: number;
  pelvisX: number;
  ankleY: number;
  reachTopPx: number;
  reachLeftPx: number;
  reachRightPx: number;
}

export interface GridParams {
  lateralFraction: number;
  topFraction: number;
  targetDiameterRatio: number;
}

export interface GridZone {
  /** 1 à 9, de gauche à droite puis de haut en bas, tel que vu à l'écran (miroir). */
  id: number;
  row: 0 | 1 | 2;
  col: 0 | 1 | 2;
  center: Point;
  rect: { x: number; y: number; width: number; height: number };
}

export interface Grid {
  zones: GridZone[];
  targetRadiusPx: number;
  /** Toutes les cibles sont entièrement dans l'image. */
  fits: boolean;
  /** Zones dont la cible déborde de l'image. */
  overflowing: number[];
}

export function computeGrid(m: GridInput, width: number, height: number, p: GridParams): Grid {
  const lateral = p.lateralFraction * ((m.reachLeftPx + m.reachRightPx) / 2);
  const top = m.ankleY - p.topFraction * m.reachTopPx;
  const bottom = m.ankleY;
  const xs = [m.pelvisX - lateral, m.pelvisX, m.pelvisX + lateral];
  const ys = [top, (top + bottom) / 2, bottom];
  const dx = lateral;
  const dy = (bottom - top) / 2;
  const radius = (p.targetDiameterRatio * m.heightPx) / 2;

  const zones: GridZone[] = [];
  const overflowing: number[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const center = { x: xs[col]!, y: ys[row]! };
      const id = row * 3 + col + 1;
      zones.push({
        id,
        row: row as 0 | 1 | 2,
        col: col as 0 | 1 | 2,
        center,
        rect: { x: center.x - dx / 2, y: center.y - dy / 2, width: dx, height: dy },
      });
      const out =
        center.x - radius < 0 || center.x + radius > width || center.y - radius < 0 || center.y + radius > height;
      if (out) overflowing.push(id);
    }
  }
  return { zones, targetRadiusPx: radius, fits: overflowing.length === 0, overflowing };
}
