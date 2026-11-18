import { describe, expect, it } from 'vitest';
import { hashCode, isValidCode } from './staffCode';

describe('code staff', () => {
  it('4 chiffres exactement', () => {
    expect(isValidCode('1234')).toBe(true);
    expect(isValidCode('123')).toBe(false);
    expect(isValidCode('12a4')).toBe(false);
    expect(isValidCode('12345')).toBe(false);
  });

  it('empreinte stable, différente selon le code, sans le code en clair', async () => {
    const a = await hashCode('1234');
    expect(a).toHaveLength(64);
    expect(await hashCode('1234')).toBe(a);
    expect(await hashCode('4321')).not.toBe(a);
    expect(a).not.toContain('1234');
  });
});
