import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { goalGeometry, orderCorners } from './goal';
import { measureGuard } from './measures';
import { goalLineYAt, referenceCalibration } from './reference';
import { makePose } from './testPose';

const P = { ankleHeightCm: 8, ...CONFIG.calibration.reference };

// Cage 600 × 400 px (2 px/cm) dont le pied des poteaux est à y = 666 (= chevilles 650 + 8 cm × 2).
const corners = orderCorners([
  { x: 340, y: 266 }, { x: 940, y: 266 }, { x: 340, y: 666 }, { x: 940, y: 666 },
])!;
const goal = goalGeometry(corners, 300, 200);

describe('étalonnage individuel', () => {
  it('ligne de but interpolée entre les pieds des poteaux', () => {
    const tilted = orderCorners([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 200 }, { x: 100, y: 220 }])!;
    expect(goalLineYAt(tilted, 50)).toBe(210);
  });

  it('gardienne sur la ligne : hauteur de garde en cm, aucun problème', () => {
    const r = referenceCalibration(measureGuard(makePose({ arms: 'high' }))!, corners, goal, 250, P);
    expect(r.guardHeightCm).toBe(200); // 400 px / 2 px/cm
    expect(r.lineOffsetCm).toBe(0);
    expect(r.ratio).toBe(0.8);
    expect(r.problems).toEqual([]);
  });

  it('pieds devant la ligne et mesure peu plausible', () => {
    const pose = makePose({ arms: 'high' }).map((q) => q && { x: q.x, y: q.y + 40 }); // 20 cm plus bas à l'image
    const r = referenceCalibration(measureGuard(pose)!, corners, goal, 180, P);
    expect(r.lineOffsetCm).toBe(20);
    expect(r.problems[0]).toMatch(/devant la ligne/);
    expect(r.problems[1]).toMatch(/peu plausible/); // 200 / 180 > 95 %
  });
});
