/**
 * Maintien immobile d'une posture pendant une durée donnée.
 * Chaque image fournit un vecteur de coordonnées (pixels) ; si l'une s'écarte de sa moyenne
 * de plus que la tolérance, le chronomètre repart de zéro. Les échantillons retenus
 * servent ensuite à la mesure (moyenne), ce qui lisse le bruit de détection.
 */
export interface HoldState {
  /** 0 → 1 : avancement du maintien. */
  progress: number;
  done: boolean;
}

export class StableHold {
  private start: number | null = null;
  private samples: number[][] = [];
  private sums: number[] = [];

  constructor(private readonly durationMs: number) {
    if (!(durationMs > 0)) throw new Error('durationMs doit être > 0');
  }

  /**
   * @param values vecteur de coordonnées, ou null si la posture n'est pas valide sur cette image
   * @param tolerancePx écart maximal admis à la moyenne pour chaque coordonnée
   */
  push(t: number, values: readonly number[] | null, tolerancePx: number): HoldState {
    if (values === null) {
      this.reset();
      return { progress: 0, done: false };
    }
    if (this.start === null || values.length !== this.sums.length || this.deviates(values, tolerancePx)) {
      this.begin(t, values);
    } else {
      this.samples.push([...values]);
      values.forEach((v, i) => (this.sums[i]! += v));
    }
    const progress = Math.min(1, (t - this.start!) / this.durationMs);
    return { progress, done: progress >= 1 };
  }

  /** Moyenne des échantillons retenus (vide si aucun). */
  mean(): number[] {
    const n = this.samples.length;
    return n === 0 ? [] : this.sums.map((s) => s / n);
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  reset(): void {
    this.start = null;
    this.samples = [];
    this.sums = [];
  }

  private begin(t: number, values: readonly number[]): void {
    this.start = t;
    this.samples = [[...values]];
    this.sums = [...values];
  }

  private deviates(values: readonly number[], tol: number): boolean {
    const n = this.samples.length;
    return values.some((v, i) => Math.abs(v - this.sums[i]! / n) > tol);
  }
}
