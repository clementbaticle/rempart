/**
 * Grille de 12 zones (4 colonnes × 3 rangées) proportionnée à la joueuse (section 4).
 * Pas de colonne centrale : une cible sur le corps se toucherait sans bouger.
 * Coordonnées : pixels image, miroir.
 */
import type { Point } from './geometry';

export const GRID_COLUMNS = 4;
export const GRID_ROWS = 3;
export const ZONE_COUNT = GRID_COLUMNS * GRID_ROWS;

export interface GridInput {
  heightPx: number;
  pelvisX: number;
  ankleY: number;
  reachTopPx: number;
  reachLeftPx: number;
  reachRightPx: number;
}

export interface GridParams {
  /** Colonnes proches : fraction de la portée latérale moyenne. */
  nearFraction: number;
  /** Colonnes lointaines : fraction de la portée latérale moyenne. */
  farFraction: number;
  topFraction: number;
  targetDiameterRatio: number;
}

export type Row = 0 | 1 | 2;
export type Col = 0 | 1 | 2 | 3;

export interface GridZone {
  /** 1 à 12, de gauche à droite puis de haut en bas, tel que vu à l'écran (miroir). */
  id: number;
  row: Row;
  col: Col;
  /** Côté de la joueuse (vue miroir : gauche de l'écran = sa gauche). */
  side: 'left' | 'right';
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

/** Rangée (0 haut, 1 milieu, 2 bas) et colonne d'une zone 1-12. */
export const rowOf = (zone: number): Row => Math.floor((zone - 1) / GRID_COLUMNS) as Row;
export const colOf = (zone: number): Col => ((zone - 1) % GRID_COLUMNS) as Col;

export function computeGrid(m: GridInput, width: number, height: number, p: GridParams): Grid {
  const reach = (m.reachLeftPx + m.reachRightPx) / 2;
  const near = p.nearFraction * reach;
  const far = p.farFraction * reach;
  const top = m.ankleY - p.topFraction * m.reachTopPx;
  const bottom = m.ankleY;
  const xs = [m.pelvisX - far, m.pelvisX - near, m.pelvisX + near, m.pelvisX + far];
  const ys = [top, (top + bottom) / 2, bottom];
  const cellW = far - near;
  const cellH = (bottom - top) / 2;
  const radius = (p.targetDiameterRatio * m.heightPx) / 2;

  const zones: GridZone[] = [];
  const overflowing: number[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLUMNS; col++) {
      const center = { x: xs[col]!, y: ys[row]! };
      const id = row * GRID_COLUMNS + col + 1;
      zones.push({
        id,
        row: row as Row,
        col: col as Col,
        side: col < GRID_COLUMNS / 2 ? 'left' : 'right',
        center,
        rect: { x: center.x - cellW / 2, y: center.y - cellH / 2, width: cellW, height: cellH },
      });
      const out =
        center.x - radius < 0 || center.x + radius > width || center.y - radius < 0 || center.y + radius > height;
      if (out) overflowing.push(id);
    }
  }
  return { zones, targetRadiusPx: radius, fits: overflowing.length === 0, overflowing };
}
