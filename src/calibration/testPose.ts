/**
 * Squelettes synthétiques pour les tests (pixels image 1280 × 720, miroir).
 * Taille apparente visage → chevilles = 400 px ; chevilles à y = 650.
 */
import type { Point, Points } from './geometry';

/** guard : mains à hauteur de poitrine ; high : garde haute de gardienne ; down : bras le long du corps. */
export type Arms = 'guard' | 'high' | 'down' | 'spread' | 'raised';

export function makePose(opts: { cx?: number; arms?: Arms; jitter?: number } = {}): Points {
  const cx = opts.cx ?? 640;
  const arms = opts.arms ?? 'guard';
  const j = opts.jitter ?? 0;
  const pts: (Point | undefined)[] = new Array(33).fill(undefined);
  const set = (i: number, x: number, y: number): void => {
    pts[i] = { x: x + j, y: y + j };
  };
  set(0, cx, 260); // nez
  set(2, cx - 10, 250); // œil gauche (à gauche à l'écran, miroir)
  set(5, cx + 10, 250);
  set(11, cx - 50, 320); // épaules
  set(12, cx + 50, 320);
  set(23, cx - 30, 450); // hanches
  set(24, cx + 30, 450);
  set(27, cx - 40, 650); // chevilles
  set(28, cx + 40, 650);
  set(31, cx - 55, 665); // pointes de pied
  set(32, cx + 55, 665);
  if (arms === 'guard') {
    set(15, cx - 60, 400); set(16, cx + 60, 400);
    set(19, cx - 62, 420); set(20, cx + 62, 420);
  } else if (arms === 'high') {
    set(15, cx - 80, 300); set(16, cx + 80, 300);
    set(19, cx - 82, 285); set(20, cx + 82, 285);
  } else if (arms === 'down') {
    set(15, cx - 70, 470); set(16, cx + 70, 470);
    set(19, cx - 72, 490); set(20, cx + 72, 490);
  } else if (arms === 'spread') {
    set(15, cx - 200, 322); set(16, cx + 200, 322);
    set(19, cx - 220, 322); set(20, cx + 220, 322);
  } else {
    set(15, cx - 40, 150); set(16, cx + 40, 150);
    set(19, cx - 40, 130); set(20, cx + 40, 130);
  }
  return pts;
}

export function withMissing(p: Points, ...indices: number[]): Points {
  return p.map((q, i) => (indices.includes(i) ? undefined : q));
}
