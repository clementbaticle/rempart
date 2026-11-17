import { describe, expect, it } from 'vitest';
import { fitContain } from '../pose/landmarks';
import { boundsOf, displayRect, viewRegion } from './viewRegion';

const VIDEO = { width: 1280, height: 720 };

describe('zoom sur la zone de jeu', () => {
  it('rectangle englobant points et cibles', () => {
    expect(boundsOf([{ x: 100, y: 50 }, { x: 300, y: 200 }], [{ center: { x: 320, y: 100 }, radius: 30 }])).toEqual({
      x: 100, y: 50, width: 250, height: 150,
    });
  });

  it('marges puis format de l’écran (élargissement autour du centre)', () => {
    const r = viewRegion({ x: 340, y: 266, width: 600, height: 400 }, { side: 0, top: 0.1, bottom: 0 }, VIDEO, 3 / 2);
    // 600 × 440 → élargi à 660 × 440 (format 3/2), centré sur x = 640.
    expect(r.width).toBeCloseTo(660);
    expect(r.height).toBeCloseTo(440);
    expect(r.x).toBeCloseTo(310);
    expect(r.y).toBeCloseTo(226);
  });

  it('jamais plus grande que l’image, et recalée à l’intérieur', () => {
    const r = viewRegion({ x: -100, y: 0, width: 1500, height: 700 }, { side: 0.1, top: 0.1, bottom: 0.1 }, VIDEO, 16 / 9);
    expect(r.width).toBeLessThanOrEqual(1280);
    expect(r.height).toBeLessThanOrEqual(720);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it('sans région : identique à l’image entière contenue', () => {
    expect(displayRect(VIDEO, { width: 1080, height: 712 }, null)).toEqual(fitContain(1280, 720, 1080, 712));
  });

  it('avec région : la région remplit l’écran', () => {
    const box = { width: 1080, height: 720 };
    const region = { x: 310, y: 226, width: 660, height: 440 };
    const d = displayRect(VIDEO, box, region);
    const scale = d.width / 1280; // 1080 / 660
    expect(scale).toBeCloseTo(1080 / 660);
    // Le coin haut gauche de la région arrive en (0, 0) de l'écran.
    expect(d.x + region.x * scale).toBeCloseTo(0);
    expect(d.y + region.y * scale).toBeCloseTo(0);
  });
});
