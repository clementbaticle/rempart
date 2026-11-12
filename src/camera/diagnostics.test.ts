import { describe, expect, it } from 'vitest';
import {
  DroppedFrameCounter,
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
