import { describe, expect, it } from 'vitest';
import {
  CameraFpsEstimator,
  DroppedFrameCounter,
  RollingStats,
  FpsCounter,
  classifyStreamFit,
  fpsLevel,
  orientationOf,
  parseCameraPosition,
} from './diagnostics';

describe('FpsCounter', () => {
  it('renvoie 0 avec moins de deux images', () => {
    const c = new FpsCounter(1000);
    expect(c.fps(0)).toBe(0);
    c.tick(0);
    expect(c.fps(0)).toBe(0);
  });

  it('mesure 30 i/s pour des images toutes les 33,33 ms', () => {
    const c = new FpsCounter(1000);
    for (let i = 0; i <= 30; i++) c.tick((i * 1000) / 30);
    expect(c.fps(1000)).toBeCloseTo(30, 5);
  });

  it('oublie les images sorties de la fenêtre', () => {
    const c = new FpsCounter(1000);
    for (let i = 0; i <= 60; i++) c.tick(i * (1000 / 60)); // 1 s à 60 i/s
    for (let i = 1; i <= 20; i++) c.tick(1000 + i * 50); // puis 1 s à 20 i/s
    expect(c.fps(2000)).toBeCloseTo(20, 0);
  });

  it('refuse une fenêtre nulle', () => {
    expect(() => new FpsCounter(0)).toThrow();
  });
});

describe('DroppedFrameCounter', () => {
  it('compte les sauts de presentedFrames', () => {
    const d = new DroppedFrameCounter();
    [1, 2, 3, 6, 7, 10].forEach((n) => d.update(n));
    expect(d.droppedFrames).toBe(4); // 4,5 puis 8,9
    expect(d.processedFrames).toBe(6);
    expect(d.droppedRatio).toBeCloseTo(0.4, 5);
  });

  it('ignore un compteur qui recule (flux redémarré)', () => {
    const d = new DroppedFrameCounter();
    [10, 11, 1, 2].forEach((n) => d.update(n));
    expect(d.droppedFrames).toBe(0);
  });
});

describe('CameraFpsEstimator', () => {
  it('mesure la cadence caméra même si peu d’images sont traitées', () => {
    // Caméra à 30 i/s, mais une image traitée sur 5 (calcul lent).
    const c = new CameraFpsEstimator(1000);
    for (let i = 0; i <= 6; i++) c.update(i * (5000 / 30), i * 5);
    expect(c.fps(1000)).toBeCloseTo(30, 5);
  });

  it('renvoie null sans données suffisantes', () => {
    const c = new CameraFpsEstimator(1000);
    expect(c.fps(0)).toBeNull();
    c.update(0, 1);
    expect(c.fps(0)).toBeNull();
  });

  it('repart de zéro si le compteur recule', () => {
    const c = new CameraFpsEstimator(1000);
    c.update(0, 100);
    c.update(100, 103);
    c.update(200, 1);
    c.update(300, 4);
    expect(c.fps(300)).toBeCloseTo(30, 5);
  });
});

describe('RollingStats', () => {
  it('moyenne et max sur les N dernières valeurs', () => {
    const s = new RollingStats(3);
    expect(s.mean).toBeNull();
    [100, 10, 20, 30].forEach((v) => s.push(v));
    expect(s.mean).toBeCloseTo(20);
    expect(s.max).toBe(30);
  });
});

describe('orientation et concordance du flux', () => {
  it('classe l’orientation', () => {
    expect(orientationOf(1280, 720)).toBe('paysage');
    expect(orientationOf(720, 1280)).toBe('portrait');
    expect(orientationOf(500, 500)).toBe('carré');
  });

  it('détecte un flux concordant ou tourné', () => {
    expect(classifyStreamFit(1280, 720, 1180, 820)).toBe('concordant');
    expect(classifyStreamFit(720, 1280, 1180, 820)).toBe('tourné');
    expect(classifyStreamFit(0, 0, 1180, 820)).toBe('indéterminé');
  });
});

describe('position de caméra', () => {
  it('lit une valeur mémorisée et retombe sur « inconnue »', () => {
    expect(parseCameraPosition('bord-long')).toBe('bord-long');
    expect(parseCameraPosition('bord-court')).toBe('bord-court');
    expect(parseCameraPosition('n’importe quoi')).toBe('inconnue');
    expect(parseCameraPosition(null)).toBe('inconnue');
  });
});

describe('fpsLevel', () => {
  it('applique les seuils 25 / 20', () => {
    expect(fpsLevel(30, 25, 20)).toBe('bon');
    expect(fpsLevel(25, 25, 20)).toBe('bon');
    expect(fpsLevel(22, 25, 20)).toBe('limite');
    expect(fpsLevel(19.9, 25, 20)).toBe('insuffisant');
  });
});
