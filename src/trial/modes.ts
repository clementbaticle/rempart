/** Modes de temps choisis avant chaque série (section 7). Logique pure. */
import type { Game } from '../core/sequence';

export type TimeMode = 'decouverte' | 'test' | 'entrainement';

export interface ModeChoice {
  mode: TimeMode;
  /** Niveau d'entraînement (1 = le plus facile), null hors entraînement. */
  level: number | null;
  /** Jeu (Découverte / Entraînement) ; en Test, la batterie enchaîne Classique puis Go / no-go. */
  game: Game;
}

export const GAME_LABELS: Record<Game, string> = { classique: 'Classique', gonogo: 'Go / no-go' };

export interface ModeParams {
  /** Découverte : pas de délai ; plafond de sécurité si la détection perd la joueuse (ms). */
  discoverySafetyMs: number;
  /** Test : délai fixe (ms). */
  testResponseMs: number;
  /** Entraînement : délai par niveau, du niveau 1 au dernier (ms). */
  trainingLevelsMs: readonly number[];
}

/** Délai pour atteindre la cible (ms) appliqué à la série. */
export function responseLimitMs(c: ModeChoice, p: ModeParams): number {
  switch (c.mode) {
    case 'decouverte':
      return p.discoverySafetyMs;
    case 'test':
      return p.testResponseMs;
    case 'entrainement': {
      const i = Math.min(Math.max((c.level ?? 1) - 1, 0), p.trainingLevelsMs.length - 1);
      return p.trainingLevelsMs[i]!;
    }
  }
}

/** Un délai dépassé est-il présenté comme une erreur à la joueuse ? (Non en Découverte.) */
export const missIsError = (c: ModeChoice): boolean => c.mode !== 'decouverte';

const seconds = (ms: number): string => `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;

/** Libellé lisible : « Découverte (sans limite) », « Test (2 s) », « Entraînement niv. 3 (1,3 s) ». */
export function modeLabel(c: ModeChoice, p: ModeParams): string {
  switch (c.mode) {
    case 'decouverte':
      return `${GAME_LABELS[c.game]} · Découverte (sans limite)`;
    case 'test':
      return `Batterie Test (${seconds(p.testResponseMs)})`;
    case 'entrainement':
      return `${GAME_LABELS[c.game]} · Entraînement niv. ${c.level ?? 1} (${seconds(responseLimitMs(c, p))})`;
  }
}
