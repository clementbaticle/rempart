import { describe, expect, it } from 'vitest';
import { resolveFrameRate, resolveResolution } from './resolutionChoice';

const PRESETS = {
  '640': { width: 640, height: 480 },
  '1280': { width: 1280, height: 720 },
};
const FALLBACK = { width: 1280, height: 720 };

describe('resolveResolution', () => {
  it('résolution par défaut sans paramètre', () => {
    expect(resolveResolution('', PRESETS, FALLBACK)).toEqual({ resolution: FALLBACK, forced: false });
  });

  it('force une résolution connue, combinable avec ?delegate', () => {
    expect(resolveResolution('?delegate=CPU&res=640', PRESETS, FALLBACK)).toEqual({
      resolution: { width: 640, height: 480 },
      forced: true,
    });
  });

  it('ignore une valeur inconnue', () => {
    expect(resolveResolution('?res=4000', PRESETS, FALLBACK).forced).toBe(false);
  });
});

describe('resolveFrameRate', () => {
  it('cadence par défaut, forcée à 60, ou valeur inconnue ignorée', () => {
    expect(resolveFrameRate('', [30, 60], 30)).toEqual({ frameRate: 30, forced: false });
    expect(resolveFrameRate('?fps=60&res=640', [30, 60], 30)).toEqual({ frameRate: 60, forced: true });
    expect(resolveFrameRate('?fps=120', [30, 60], 30)).toEqual({ frameRate: 30, forced: false });
  });
});
