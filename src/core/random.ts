/**
 * Générateur pseudo-aléatoire à graine (mulberry32) : même graine → même suite.
 * Sert aux séquences reproductibles (section 7).
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Réel uniforme dans [min, max). */
export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}

/** Entier uniforme dans [0, n). */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Mélange de Fisher-Yates (copie). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Graine 32 bits tirée au hasard (séances d'entraînement). */
export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}
