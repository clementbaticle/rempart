/** Enregistrements de séance et d'essai (section 8). */
import type { SessionSummary } from '../trial/outcome';
import type { TrialParams, TrialRecord } from '../trial/trialMachine';

export interface SessionRecord {
  id: string;
  playerId: string;
  /** Début de séance, ISO 8601. */
  date: string;
  endDate: string;
  /** test (étape 4) ou entraînement. */
  mode: 'test' | 'train';
  game: 'classique';
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
  summary: SessionSummary;
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
