/** Libellé lisible d'une séance enregistrée (jeu + mode de temps). */
import type { SessionRecord } from '../storage/sessionRecord';

const GAME: Record<string, string> = { classique: 'Classique', gonogo: 'Go / no-go', batterie: 'Batterie Test' };
const MODE: Record<string, string> = { decouverte: 'Découverte', test: 'Test', entrainement: 'Entraînement', train: 'Entraînement' };

export function sessionLabel(s: SessionRecord): string {
  if (s.game === 'batterie') return `Batterie Test ${s.batteryVersion ?? ''}`.trim();
  const level = s.mode === 'entrainement' && s.level ? ` niv. ${s.level}` : '';
  return `${GAME[s.game] ?? s.game} · ${MODE[s.mode] ?? s.mode}${level}`;
}
