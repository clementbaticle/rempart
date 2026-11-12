import { describe, expect, it } from 'vitest';
import {
  EFFECTOR_POINTS,
  fitContain,
  isVisible,
  meanVisibility,
  mirrorX,
  toScreen,
} from './landmarks';

describe('effecteurs', () => {
  it('utilise les indices du cahier des charges', () => {
    expect(EFFECTOR_POINTS.leftHand).toEqual([15, 19]);
    expect(EFFECTOR_POINTS.rightHand).toEqual([16, 20]);
    expect(EFFECTOR_POINTS.leftFoot).toEqual([27, 31]);
    expect(EFFECTOR_POINTS.rightFoot).toEqual([28, 32]);
  });
});

describe('isVisible', () => {
  it('applique le seuil de visibilité', () => {
    expect(isVisible({ x: 0, y: 0, visibility: 0.6 }, 0.5)).toBe(true);
    expect(isVisible({ x: 0, y: 0, visibility: 0.5 }, 0.5)).toBe(true);
    expect(isVisible({ x: 0, y: 0, visibility: 0.49 }, 0.5)).toBe(false);
    expect(isVisible(undefined, 0.5)).toBe(false);
  });
});

describe('miroir', () => {
  it('retourne x et conserve le reste', () => {
    expect(mirrorX({ x: 0.2, y: 0.3, visibility: 0.9 })).toEqual({ x: 0.8, y: 0.3, visibility: 0.9 });
  });

  it('la main droite réelle (x image faible) apparaît à droite de l’écran', () => {
    // Caméra frontale : la main droite de la joueuse est à gauche de l'image brute.
    const rightWrist = { x: 0.25, y: 0.5 };
    const rect = { x: 0, y: 0, width: 1000, height: 500 };
    expect(toScreen(rightWrist, rect, true).x).toBe(750);
    expect(toScreen(rightWrist, rect, false).x).toBe(250);
  });
});

describe('fitContain', () => {
  it('flux paysage dans un écran paysage plus large : bandes latérales', () => {
    const r = fitContain(1280, 720, 1366, 1024);
    expect(r.width).toBeCloseTo(1366);
    expect(r.height).toBeCloseTo(768.375);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo((1024 - 768.375) / 2);
  });

  it('flux portrait (caméra tournée) dans un écran paysage : image entière centrée', () => {
    const r = fitContain(720, 1280, 1180, 820);
    expect(r.height).toBeCloseTo(820);
    expect(r.width).toBeCloseTo(461.25);
    expect(r.x).toBeCloseTo((1180 - 461.25) / 2);
    expect(r.y).toBeCloseTo(0);
  });

  it('dimensions nulles : rectangle vide', () => {
    expect(fitContain(0, 720, 100, 100)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('toScreen tient compte du décalage du rectangle', () => {
    const rect = { x: 100, y: 50, width: 400, height: 300 };
    expect(toScreen({ x: 0.5, y: 0.5 }, rect, true)).toEqual({ x: 300, y: 200 });
  });
});

describe('meanVisibility', () => {
  it('moyenne, avec 1 par défaut', () => {
    expect(meanVisibility([{ x: 0, y: 0, visibility: 0.5 }, { x: 0, y: 0 }])).toBeCloseTo(0.75);
    expect(meanVisibility([])).toBe(0);
  });
});
