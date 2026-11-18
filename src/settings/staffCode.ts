/**
 * Code staff (4 chiffres) protégeant les réglages et l'export (section 10).
 * Seule l'empreinte SHA-256 est conservée sur l'appareil, jamais le code.
 */
import { CONFIG } from '../config';

export const isValidCode = (code: string): boolean => /^\d{4}$/.test(code);

export async function hashCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`rempart:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function storedHash(): string | null {
  try {
    return localStorage.getItem(CONFIG.storageKeys.staffCode);
  } catch {
    return null;
  }
}

export async function setCode(code: string): Promise<void> {
  if (!isValidCode(code)) throw new Error('Le code doit comporter 4 chiffres.');
  localStorage.setItem(CONFIG.storageKeys.staffCode, await hashCode(code));
}

export async function checkCode(code: string): Promise<boolean> {
  const h = storedHash();
  return h !== null && h === (await hashCode(code));
}
