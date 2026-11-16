/**
 * Grille de 12 zones (4 colonnes × 3 rangées) à des positions réelles dans la cage (section 4, point 5).
 * Pas de colonne centrale : une cible sur le corps se toucherait sans bouger.
 * Les positions réelles sont ramenées au plan de la gardienne (parallaxe) : centre horizontal = centre
 * de la cage à l'image, sol = niveau de ses chevilles, cm convertis avec l'échelle de la joueuse.
 * Coordonnées : pixels image, miroir.
 */
import type { Point } from './geometry';

export const GRID_COLUMNS = 4;
export const GRID_ROWS = 3;
export const ZONE_COUNT = GRID_COLUMNS * GRID_ROWS;

export interface GridInput {
  /** Échelle de la joueuse (px / cm). */
  playerPxPerCm: number;
  /** Centre horizontal de la cage à l'image. */
  centerX: number;
  /** Niveau du sol sous la joueuse à l'image (px). */
  floorY: number;
}

export interface GridParams {
  /** Abscisses réelles des 4 colonnes par rapport au centre de la cage (cm, gauche → droite). */
  columnsCm: readonly number[];
  /** Hauteurs réelles des 3 rangées au-dessus du sol (cm, haut → bas). */
  rowHeightsCm: readonly number[];
  targetDiameterCm: number;
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
  /** Position réelle dans la cage (cm). */
  realCm: { x: number; height: number };
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
  if (p.columnsCm.length !== GRID_COLUMNS || p.rowHeightsCm.length !== GRID_ROWS) {
    throw new Error('Grille : 4 colonnes et 3 rangées attendues');
  }
  const s = m.playerPxPerCm;
  const radius = (p.targetDiameterCm * s) / 2;
  // Taille des cellules (dessin seulement) : écart entre colonnes / rangées voisines.
  const cellW = Math.abs(p.columnsCm[1]! - p.columnsCm[0]!) * s;
  const cellH = Math.abs(p.rowHeightsCm[0]! - p.rowHeightsCm[1]!) * s;

  const zones: GridZone[] = [];
  const overflowing: number[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLUMNS; col++) {
      const realCm = { x: p.columnsCm[col]!, height: p.rowHeightsCm[row]! };
      const center = { x: m.centerX + realCm.x * s, y: m.floorY - realCm.height * s };
      const id = row * GRID_COLUMNS + col + 1;
      zones.push({
        id,
        row: row as Row,
        col: col as Col,
        side: realCm.x < 0 ? 'left' : 'right',
        realCm,
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
