import { describe, expect, it } from 'vitest';
import { pickFrameTime } from './frameLoop';

describe('pickFrameTime', () => {
  it('préfère captureTime quand il est fourni', () => {
    expect(pickFrameTime({ captureTime: 1000, expectedDisplayTime: 1030 })).toEqual({
      time: 1000,
      source: 'captureTime',
    });
  });

  it('se rabat sur expectedDisplayTime sinon', () => {
    expect(pickFrameTime({ expectedDisplayTime: 1030 })).toEqual({
      time: 1030,
      source: 'expectedDisplayTime',
    });
    expect(pickFrameTime({ captureTime: 0, expectedDisplayTime: 1030 }).source).toBe(
      'expectedDisplayTime',
    );
  });
});
