/** Enregistrements de séance et d'essai (section 8). */
import type { TimeMode } from '../trial/modes';
import type { SessionSummary } from '../trial/outcome';
import type { TrialParams, TrialRecord } from '../trial/trialMachine';

export interface SessionRecord {
  id: string;
  playerId: string;
  /** Début de séance, ISO 8601. */
  date: string;
  endDate: string;
  /** test (étape 4) ou entraînement. */
  /** Mode de temps (les séances antérieures à la v0.4 portent 'train'). */
  mode: TimeMode | 'train';
  /** Niveau d'entraînement, null hors entraînement. */
  level: number | null;
  /** Délai pour atteindre la cible appliqué à la série (ms ; plafond de sécurité en Découverte). */
  responseLimitMs: number;
  /** Jeu de la série ; 'batterie' = mode Test (familiarisation + Classique + Go / no-go). */
  game: 'classique' | 'gonogo' | 'batterie';
  status: 'completed' | 'interrupted';
  batteryVersion: string | null;
  seed: number;
  calibrationId: string;
  device: { userAgent: string; videoWidth: number; videoHeight: number };
  meanDetectionFps: number | null;
  droppedFrameRatio: number;
  timestampSource: string;
  delegate: string;
  resolution: string;
  cameraPosition: string;
  appVersion: string;
  /** Séance sous le seuil d'i/s (section 9). */
  lowQuality: boolean;
  /** Paramètres de mesure utilisés (copie, pour la traçabilité). */
  params: TrialParams & { validRtMinMs: number; validRtMaxMs: number };
  /** Résumé global (essais analysés) et par jeu. */
  summary: SessionSummary;
  byGame?: Record<string, SessionSummary>;
  notes: string;
}

export interface TrialRow extends TrialRecord {
  /** `${sessionId}:${index}` */
  id: string;
  sessionId: string;
  playerId: string;
}

export function toTrialRow(sessionId: string, playerId: string, r: TrialRecord): TrialRow {
  return { ...r, id: `${sessionId}:${r.index}`, sessionId, playerId };
}
