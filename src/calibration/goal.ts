/**
 * Cage réelle (section 4, point 1) : 4 coins touchés à l'écran par l'entraîneur.
 * Coordonnées : pixels image, miroir (comme à l'écran).
 */
import type { Point } from './geometry';

export interface GoalCorners {
  topLeft: Point;
  topRight: Point;
  bottomLeft: Point;
  bottomRight: Point;
}

/** Range 4 points touchés dans n'importe quel ordre : les 2 plus à gauche = poteau gauche, etc. */
export function orderCorners(points: readonly Point[]): GoalCorners | null {
  if (points.length !== 4) return null;
  const byX = [...points].sort((a, b) => a.x - b.x);
  const [l1, l2, r1, r2] = byX as [Point, Point, Point, Point];
  const [topLeft, bottomLeft] = l1.y <= l2.y ? [l1, l2] : [l2, l1];
  const [topRight, bottomRight] = r1.y <= r2.y ? [r1, r2] : [r2, r1];
  return { topLeft, topRight, bottomLeft, bottomRight };
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export interface GoalGeometry {
  /** Largeur et hauteur moyennes de la cage à l'image (px). */
  widthPx: number;
  heightPx: number;
  /** Échelle de la cage (px / cm). */
  pxPerCm: number;
  /** Centre horizontal de la cage à l'image. */
  centerX: number;
  /** Rapport largeur / hauteur mesuré (3 / 2 attendu). */
  aspect: number;
}

export function goalGeometry(c: GoalCorners, widthCm: number, heightCm: number): GoalGeometry {
  const widthPx = (dist(c.topLeft, c.topRight) + dist(c.bottomLeft, c.bottomRight)) / 2;
  const heightPx = (dist(c.topLeft, c.bottomLeft) + dist(c.topRight, c.bottomRight)) / 2;
  return {
    widthPx,
    heightPx,
    pxPerCm: (widthPx / widthCm + heightPx / heightCm) / 2,
    centerX: (c.topLeft.x + c.topRight.x + c.bottomLeft.x + c.bottomRight.x) / 4,
    aspect: heightPx > 0 ? widthPx / heightPx : 0,
  };
}

/** Problèmes de saisie des coins (liste vide si la cage paraît correcte). */
export function checkGoal(g: GoalGeometry, expectedAspect: number, tolerance: number): string[] {
  const problems: string[] = [];
  if (g.widthPx < 20 || g.heightPx < 20) problems.push('Cage trop petite à l’image : coins mal placés ?');
  else if (Math.abs(g.aspect - expectedAspect) / expectedAspect > tolerance) {
    problems.push(
      `Forme inattendue (largeur / hauteur = ${g.aspect.toFixed(2)} au lieu de ${expectedAspect.toFixed(2)}) : ` +
        'vérifiez les coins ou placez la tablette face au centre de la cage.',
    );
  }
  return problems;
}
