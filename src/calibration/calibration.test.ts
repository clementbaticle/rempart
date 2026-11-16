import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { apparentHeight, flatten, toImagePoints, unflatten, POSTURE_POINTS } from './geometry';
import { checkFraming } from './framing';
import { StableHold } from './stability';
import { apparentSizeChange, isGuardPosture, measureGuard, pixelsPerCm } from './measures';
import { checkGoal, goalGeometry, orderCorners } from './goal';
import { colOf, computeGrid, rowOf } from './grid';
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

describe('mesures de garde', () => {
  it('posture de garde : mains au-dessus du milieu du buste', () => {
    // Épaules à 320, bassin à 450 → limite à 385.
    expect(isGuardPosture(makePose({ arms: 'high' }), 0.5)).toBe(true);
    expect(isGuardPosture(makePose({ arms: 'down' }), 0.5)).toBe(false);
    expect(isGuardPosture(makePose(), 0.5)).toBe(false); // mains à 410 (poitrine basse)
    expect(isGuardPosture(makePose(), 0.8)).toBe(true);
  });

  it('garde : taille, épaules, bassin, mains, chevilles', () => {
    expect(measureGuard(makePose())).toEqual({
      heightPx: 400, faceTopY: 250, ankleY: 650, shoulderWidthPx: 100, pelvis: { x: 640, y: 450 },
      shoulderCenter: { x: 640, y: 320 }, leftHand: { x: 579, y: 410 }, rightHand: { x: 701, y: 410 },
      leftAnkle: { x: 600, y: 650 }, rightAnkle: { x: 680, y: 650 },
    });
    expect(measureGuard(withMissing(makePose(), 15, 19))).toBeNull();
  });

  it('échelle et comparaison de distance', () => {
    expect(pixelsPerCm(400, 170, 0.9)).toBeCloseTo(400 / 153);
    expect(apparentSizeChange({ sizePx: 660, videoHeight: 720 }, { sizePx: 600, videoHeight: 720 })).toBeCloseTo(0.1);
    // Même distance, résolution différente : aucun écart.
    expect(apparentSizeChange({ sizePx: 400, videoHeight: 480 }, { sizePx: 600, videoHeight: 720 })).toBeCloseTo(0, 6);
  });
});

describe('cage', () => {
  const TL = { x: 340, y: 300 }, TR = { x: 940, y: 300 }, BL = { x: 340, y: 700 }, BR = { x: 940, y: 700 };

  it('range les 4 coins touchés dans n’importe quel ordre', () => {
    expect(orderCorners([BR, TL, BL, TR])).toEqual({ topLeft: TL, topRight: TR, bottomLeft: BL, bottomRight: BR });
    expect(orderCorners([TL, TR, BL])).toBeNull();
  });

  it('géométrie : échelle 2 px/cm pour 600 × 400 px', () => {
    const g = goalGeometry(orderCorners([TL, TR, BL, BR])!, 300, 200);
    expect(g).toEqual({ widthPx: 600, heightPx: 400, pxPerCm: 2, centerX: 640, aspect: 1.5 });
    expect(checkGoal(g, 1.5, 0.25)).toEqual([]);
  });

  it('signale une forme incohérente', () => {
    const g = goalGeometry(orderCorners([TL, TR, { x: 340, y: 900 }, { x: 940, y: 900 }])!, 300, 200);
    expect(checkGoal(g, 1.5, 0.25)[0]).toMatch(/Forme inattendue/);
  });
});

describe('grille dans la cage', () => {
  const input = { playerPxPerCm: 2, centerX: 640, floorY: 680 };

  it('12 zones à leurs positions réelles, sans colonne centrale', () => {
    const g = computeGrid(input, W, H, C.grid);
    expect(g.zones).toHaveLength(12);
    const z = (id: number) => g.zones.find((q) => q.id === id)!;
    // Colonnes ± 125 et ± 60 cm, rangées 165 / 100 / 40 cm, 2 px/cm, sol à 680.
    expect(z(1).center).toEqual({ x: 390, y: 350 });
    expect(z(2).center).toEqual({ x: 520, y: 350 });
    expect(z(7).center).toEqual({ x: 760, y: 480 });
    expect(z(12).center).toEqual({ x: 890, y: 600 });
    expect(z(12).realCm).toEqual({ x: 125, height: 40 });
    expect([z(2).side, z(3).side]).toEqual(['left', 'right']);
    expect(g.zones.some((q) => q.center.x === 640)).toBe(false);
    expect(g.targetRadiusPx).toBe(30);
    expect(g.fits).toBe(true);
  });

  it('rangée et colonne d’une zone', () => {
    expect([rowOf(1), rowOf(4), rowOf(5), rowOf(12)]).toEqual([0, 0, 1, 2]);
    expect([colOf(1), colOf(4), colOf(5), colOf(12)]).toEqual([0, 3, 0, 3]);
  });

  it('signale les cibles qui sortent de l’image', () => {
    const g = computeGrid({ playerPxPerCm: 3, centerX: 400, floorY: 700 }, W, H, C.grid);
    expect(g.overflowing).toEqual([1, 5, 9]); // 400 − 375 − 45 < 0
    expect(g.fits).toBe(false);
  });
});

describe('CalibrationWizard', () => {
  function run(w: CalibrationWizard, t0: number, pose: ReturnType<typeof makePose>, ms: number): number {
    let t = t0;
    for (; t <= t0 + ms; t += 50) w.update(t, pose, W, H);
    return t;
  }

  it('cadrage → préparation 2 s → garde immobile → mesures de garde', () => {
    const w = new CalibrationWizard(C);
    let t = run(w, 0, makePose({ arms: 'down' }), 1100);
    expect(w.step).toBe('prepare');
    // Pendant la préparation, rien n'est mesuré, même bras le long du corps.
    const s = w.update(t, makePose({ arms: 'down' }), W, H);
    expect(s.feedback).toMatch(/Mesure dans 2 s/);
    t = run(w, t, makePose({ arms: 'down' }), 2100);
    expect(w.step).toBe('guard');
    t = run(w, t, makePose({ arms: 'high' }), 2100);
    expect(w.step).toBe('done');
    expect(w.result?.guard.leftHand).toEqual({ x: 559, y: 292.5 });
  });

  it('bras le long du corps : garde refusée', () => {
    const w = new CalibrationWizard(C);
    let t = run(w, 0, makePose(), 1100);
    t = run(w, t, makePose(), 2100);
    expect(w.step).toBe('guard');
    const s = w.update(t, makePose({ arms: 'down' }), W, H);
    expect(s.valid).toBe(false);
    expect(s.feedback).toMatch(/Levez les mains/);
    run(w, t, makePose({ arms: 'down' }), 3000);
    expect(w.step).toBe('guard');
  });

  it('cadrage incorrect : consigne et pas d’avancée', () => {
    const w = new CalibrationWizard(C);
    const s = w.update(0, withMissing(makePose(), 31), W, H);
    expect(s.valid).toBe(false);
    expect(s.feedback).toMatch(/Pieds/);
    run(w, 0, withMissing(makePose(), 31), 3000);
    expect(w.step).toBe('framing');
  });

  it('un mouvement pendant la garde remet le chronomètre à zéro', () => {
    const w = new CalibrationWizard(C);
    let t = run(w, 0, makePose(), 1100);
    t = run(w, t, makePose(), 2100); // préparation
    t = run(w, t, makePose({ arms: 'high' }), 1500);
    const s = w.update(t, makePose({ arms: 'high', jitter: 40 }), W, H); // 40 px > 4 % de 400
    expect(s.progress).toBe(0);
    expect(w.step).toBe('guard');
  });
});
