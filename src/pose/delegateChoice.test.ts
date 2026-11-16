import { describe, expect, it } from 'vitest';
import { resolveDelegates } from './delegateChoice';

const DEFAULTS = ['GPU', 'CPU'] as const;

describe('resolveDelegates', () => {
  it('garde l’ordre par défaut sans paramètre', () => {
    expect(resolveDelegates('', DEFAULTS)).toEqual({ delegates: DEFAULTS, forced: false });
  });

  it('force le CPU ou le GPU (insensible à la casse)', () => {
    expect(resolveDelegates('?delegate=cpu', DEFAULTS)).toEqual({ delegates: ['CPU'], forced: true });
    expect(resolveDelegates('?x=1&delegate=GPU', DEFAULTS)).toEqual({ delegates: ['GPU'], forced: true });
  });

  it('ignore une valeur inconnue', () => {
    expect(resolveDelegates('?delegate=TPU', DEFAULTS).forced).toBe(false);
  });
});
