import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { apparentHeight, flatten, toImagePoints, unflatten, POSTURE_POINTS } from './geometry';
import { checkFraming } from './framing';
import { StableHold } from './stability';
import {
  apparentSizeChange, isArmsRaised, isArmsSpread, isStepped, measureGuard, measureLateral,
  measureReachTop, measureSpan, pixelsPerCm,
} from './measures';
import { computeGrid } from './grid';
import { CalibrationWizard } from './wizard';
import { makePose, withMissing } from './testPose';

const W = 1280;
const H = 720;
const C = CONFIG.calibration;

describe('geometry', () => {
  it('convertit en pixels miroir et ignore les repères peu visibles', () => {
    const lms = Array.from({ length: 33 }, () => ({ x: 0.25, y: 0.5, visibility: 0.9 }));
    lms[3] = { x: 0.25, y: 0.5, visibility: 0.1 };
    const p = toImagePoints(lms, W, H, 0.5);
    expect(p[0]).toEqual({ x: 960, y: 360 });
    expect(p[3]).toBeUndefined();
  });

  it('flatten / unflatten aller-retour', () => {
    const p = makePose();
    const v = flatten(p, POSTURE_POINTS)!;
    expect(unflatten(v, POSTURE_POINTS)[11]).toEqual(p[11]);
    expect(flatten(withMissing(p, 15), POSTURE_POINTS)).toBeNull();
  });

  it('taille apparente visage → chevilles', () => {
    expect(apparentHeight(makePose())).toBe(400);
  });
});

describe('cadrage', () => {
  it('accepte une joueuse centrée et entière', () => {
    const r = checkFraming(makePose(), W, H, C.framing);
    expect(r.ok).toBe(true);
    expect(r.heightPx).toBe(400);
  });

  it('pieds absents → consigne de recul', () => {
    expect(checkFraming(withMissing(makePose(), 31), W, H, C.framing).issue).toBe('feet');
  });

  it('trop loin si la taille apparente est faible', () => {
    // Même pose dans une image deux fois plus haute : 400 / 1440 < 35 %.
    const p = makePose().map((q) => q && { x: q.x, y: q.y + 400 });
    expect(checkFraming(p, W, 1440, C.framing).issue).toBe('too-far');
  });

  it('décalée à gauche de l’écran → se décaler vers sa droite', () => {
    expect(checkFraming(makePose({ cx: 300 }), W, H, C.framing).issue).toBe('move-right');
    expect(checkFraming(makePose({ cx: 1000 }), W, H, C.framing).issue).toBe('move-left');
  });

  it('pas de buste → pas de pose', () => {
    expect(checkFraming(withMissing(makePose(), 11), W, H, C.framing).issue).toBe('no-pose');
  });
});

describe('StableHold', () => {
  it('termine après la durée si les valeurs restent stables', () => {
    const h = new StableHold(2000);
    expect(h.push(0, [10, 10], 5).done).toBe(false);
    expect(h.push(1000, [12, 9], 5).progress).toBeCloseTo(0.5);
    const s = h.push(2000, [11, 11], 5);
    expect(s.done).toBe(true);
    expect(h.mean()).toEqual([11, 10]);
  });

  it('repart de zéro sur un mouvement ou une posture invalide', () => {
    const h = new StableHold(2000);
    h.push(0, [10, 10], 5);
    expect(h.push(1500, [30, 10], 5).progress).toBe(0);
    expect(h.push(1600, null, 5).progress).toBe(0);
    expect(h.sampleCount).toBe(0);
  });
});

describe('mesures', () => {
  const guard = measureGuard(makePose())!;

  it('garde', () => {
    expect(guard).toEqual({
      heightPx: 400, faceTopY: 250, ankleY: 650, shoulderWidthPx: 100, pelvis: { x: 640, y: 450 },
      shoulderCenter: { x: 640, y: 320 }, leftHand: { x: 579, y: 410 }, rightHand: { x: 701, y: 410 },
      leftAnkle: { x: 600, y: 650 }, rightAnkle: { x: 680, y: 650 },
    });
  });

  it('postures reconnues', () => {
    expect(isArmsSpread(makePose({ arms: 'spread' }), 400, 0.15)).toBe(true);
    expect(isArmsSpread(makePose(), 400, 0.15)).toBe(false);
    expect(isArmsRaised(makePose({ arms: 'raised' }))).toBe(true);
    expect(isArmsRaised(makePose({ arms: 'spread' }))).toBe(false);
    expect(isStepped(makePose({ cx: 540 }), guard, 'left', 0.1)).toBe(true); // 100 px ≥ 40
    expect(isStepped(makePose({ cx: 540 }), guard, 'right', 0.1)).toBe(false);
    expect(isStepped(makePose({ cx: 630 }), guard, 'left', 0.1)).toBe(false);
  });

  it('envergure, portée haute, portées latérales', () => {
    expect(measureSpan(makePose({ arms: 'spread' }))).toBe(440);
    expect(measureReachTop(makePose({ arms: 'raised' }), guard)).toBe(520);
    expect(measureLateral(makePose({ cx: 540, arms: 'spread' }), guard, 'left')).toEqual({
      reachPx: 320,
      stepPx: 100,
    });
    expect(measureLateral(makePose({ cx: 760, arms: 'spread' }), guard, 'right')).toEqual({
      reachPx: 340,
      stepPx: 120,
    });
  });

  it('échelle et comparaison de distance', () => {
    expect(pixelsPerCm(400, 170, 0.9)).toBeCloseTo(400 / 153);
    expect(apparentSizeChange({ heightPx: 440, videoHeight: 720 }, { heightPx: 400, videoHeight: 720 })).toBeCloseTo(0.1);
    // Même distance, résolution différente : aucun écart.
    expect(apparentSizeChange({ heightPx: 266.67, videoHeight: 480 }, { heightPx: 400, videoHeight: 720 })).toBeCloseTo(0, 3);
  });
});

describe('grille', () => {
  const input = { heightPx: 400, pelvisX: 640, ankleY: 650, reachTopPx: 500, reachLeftPx: 300, reachRightPx: 340 };

  it('place les 9 zones symétriquement autour du bassin', () => {
    const g = computeGrid(input, W, H, C.grid);
    expect(g.zones).toHaveLength(9);
    const z = (id: number) => g.zones.find((q) => q.id === id)!.center;
    // Portée latérale moyenne 320 × 0,9 = 288.
    expect(z(1)).toEqual({ x: 352, y: 200 }); // haut gauche : 650 − 0,9 × 500
    expect(z(5)).toEqual({ x: 640, y: 425 });
    expect(z(9)).toEqual({ x: 928, y: 650 });
    expect(g.targetRadiusPx).toBeCloseTo(36);
  });

  it('signale les cibles qui sortent de l’image', () => {
    expect(computeGrid(input, W, H, C.grid).fits).toBe(true);
    const g = computeGrid({ ...input, ankleY: 700 }, W, H, C.grid);
    expect(g.fits).toBe(false); // rangée basse : 700 + 36 > 720
    expect(g.overflowing).toEqual([7, 8, 9]);
    const wide = computeGrid({ ...input, reachLeftPx: 800, reachRightPx: 800 }, W, H, C.grid);
    expect(wide.overflowing).toEqual([1, 3, 4, 6, 7, 9]);
  });
});

describe('CalibrationWizard', () => {
  function run(w: CalibrationWizard, t0: number, pose: ReturnType<typeof makePose>, ms: number): number {
    let t = t0;
    for (; t <= t0 + ms; t += 50) w.update(t, pose, W, H);
    return t;
  }

  it('enchaîne toutes les étapes et produit les mesures', () => {
    const w = new CalibrationWizard(C);
    let t = run(w, 0, makePose(), 1100);
    expect(w.step).toBe('guard');
    t = run(w, t, makePose(), 2100);
    expect(w.step).toBe('span');
    t = run(w, t, makePose({ arms: 'spread' }), 2100);
    expect(w.step).toBe('raised');
    t = run(w, t, makePose({ arms: 'raised' }), 2100);
    expect(w.step).toBe('stepLeft');
    t = run(w, t, makePose({ cx: 540, arms: 'spread' }), 2100);
    expect(w.step).toBe('stepRight');
    run(w, t, makePose({ cx: 760, arms: 'spread' }), 2100);
    expect(w.step).toBe('done');
    expect(w.result).toEqual({
      guard: {
  heightPx: 400, faceTopY: 250, ankleY: 650, shoulderWidthPx: 100, pelvis: { x: 640, y: 450 },
  shoulderCenter: { x: 640, y: 320 }, leftHand: { x: 579, y: 410 }, rightHand: { x: 701, y: 410 },
  leftAnkle: { x: 600, y: 650 }, rightAnkle: { x: 680, y: 650 },
},
      spanPx: 440,
      reachTopPx: 520,
      left: { reachPx: 320, stepPx: 100 },
      right: { reachPx: 340, stepPx: 120 },
    });
  });

  it('n’avance pas si la posture demandée n’est pas tenue', () => {
    const w = new CalibrationWizard(C);
    let t = run(w, 0, makePose(), 1100);
    t = run(w, t, makePose(), 2100);
    const s = w.update(t, makePose(), W, H); // bras non écartés
    expect(s.step).toBe('span');
    expect(s.valid).toBe(false);
    expect(s.feedback).toMatch(/hauteur d’épaules/);
    run(w, t, makePose(), 3000);
    expect(w.step).toBe('span');
  });

  it('un mouvement remet le chronomètre à zéro', () => {
    const w = new CalibrationWizard(C);
    let t = run(w, 0, makePose(), 1100);
    t = run(w, t, makePose(), 1500);
    const s = w.update(t, makePose({ jitter: 40 }), W, H); // 40 px > 4 % de 400
    expect(s.progress).toBe(0);
    expect(w.step).toBe('guard');
  });
});
