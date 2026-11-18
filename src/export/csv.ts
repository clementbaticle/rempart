/**
 * Export des données (section 8) — logique pure.
 * CSV : séparateur virgule, point décimal, UTF-8, une ligne d'en-tête (prêt pour R / Python).
 */
import type { CalibrationRecord } from '../storage/calibrationRecord';
import type { SessionRecord, TrialRow } from '../storage/sessionRecord';
import type { Player } from '../players/player';
import { TRAJECTORY_FIELDS } from '../trial/trialMachine';
import type { SessionSummary } from '../trial/outcome';

export type Cell = string | number | boolean | null | undefined;

/** Valeur CSV (RFC 4180) : vide pour null, guillemets si nécessaire, nombres en notation point. */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(columns: readonly string[], rows: readonly (readonly Cell[])[]): string {
  return [columns.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n';
}

const SESSION_COLUMNS = [
  'session_id', 'joueuse', 'categorie', 'poste', 'lateralite', 'taille_cm',
  'date', 'mode', 'niveau', 'jeu', 'version_batterie', 'graine', 'delai_reponse_ms', 'statut',
  'fps_detection', 'images_non_traitees', 'source_horodatage', 'delegue', 'resolution', 'position_camera',
  'version_app', 'calibration_id', 'echelle_source', 'hauteur_garde_cm', 'qualite_insuffisante',
] as const;

function sessionCells(s: SessionRecord, p: Player | undefined, c: CalibrationRecord | undefined): Cell[] {
  return [
    s.id, s.playerId, p?.category, p?.position, p?.laterality, p?.heightCm,
    s.date, s.mode, s.level, s.game, s.batteryVersion, s.seed, s.responseLimitMs, s.status,
    s.meanDetectionFps, s.droppedFrameRatio, s.timestampSource, s.delegate, s.resolution, s.cameraPosition,
    s.appVersion, s.calibrationId, c?.scaleSource, c?.guardHeightCm, s.lowQuality,
  ];
}

const TRIAL_COLUMNS = [
  'essai', 'bloc', 'analyse', 'jeu_essai', 'zone', 'stimulus', 'go',
  'cible_blanche', 'blanc_prevu_ms', 'blanc_reel_ms', 't_blanc', 'depart_depuis_blanc_ms',
  'avant_periode_prevue_ms', 'avant_periode_reelle_ms', 't_stimulus', 't_stimulus_raf',
  't_initiation', 'cause_initiation', 't_touche', 'tr_ms', 'tm_ms', 'total_ms', 'issue',
  'effecteur', 'zones_traversees', 'faux_departs', 'amplitude_max', 'visibilite_moy', 'images_perdues', 'balancement',
] as const;

function trialCells(t: TrialRow): Cell[] {
  return [
    t.index, t.block, t.analyzed ?? true, t.game ?? 'classique', t.zone, t.stimulus, t.isGo,
    t.cued ?? false, t.cueMsPlanned, t.cueActualMs, t.tCue, t.initFromCueMs,
    t.foreperiodPlannedMs, t.foreperiodActualMs, t.tStimulus, t.tStimulusRaf,
    t.tInitiation, t.initiationCause, t.tTouch, t.rtMs, t.mtMs, t.totalMs, t.outcome,
    t.usedEffector, (t.crossedZones ?? []).join(';'), t.falseStarts, t.maxMovementRatio,
    t.quality?.meanVisibility, t.quality?.droppedFrames, t.quality?.swayRatio,
  ];
}

export interface ExportData {
  players: readonly Player[];
  calibrations: readonly CalibrationRecord[];
  sessions: readonly SessionRecord[];
  trials: readonly TrialRow[];
}

/** Un essai par ligne, colonnes de la séance répétées (format long). */
export function trialsCsv(d: ExportData): string {
  const players = new Map(d.players.map((p) => [p.id, p]));
  const cals = new Map(d.calibrations.map((c) => [c.id, c]));
  const sessions = new Map(d.sessions.map((s) => [s.id, s]));
  const rows = [...d.trials]
    .filter((t) => sessions.has(t.sessionId))
    .sort((a, b) => (a.sessionId === b.sessionId ? a.index - b.index : sessions.get(a.sessionId)!.date.localeCompare(sessions.get(b.sessionId)!.date)))
    .map((t) => {
      const s = sessions.get(t.sessionId)!;
      return [...sessionCells(s, players.get(s.playerId), cals.get(s.calibrationId)), ...trialCells(t)];
    });
  return toCsv([...SESSION_COLUMNS, ...TRIAL_COLUMNS], rows);
}

const SUMMARY_FIELDS = [
  ['essais', 'trials'], ['essais_go', 'goTrials'], ['reussites', 'hits'], ['taux_reussite', 'hitRate'],
  ['anticipations', 'anticipations'], ['non_atteintes', 'misses'], ['essais_nogo', 'noGoTrials'],
  ['commissions', 'commissions'], ['taux_commission', 'commissionRate'], ['faux_departs', 'falseStarts'],
  ['tr_median_ms', 'rtMedian'], ['tr_eiq_ms', 'rtIqr'], ['tm_median_ms', 'mtMedian'],
  ['tr_median_vert_direct_ms', 'rtMedianDirect'], ['tr_median_blanc_vert_ms', 'rtMedianCued'],
  ['tr_retenus', 'rtIncluded'], ['tr_exclus', 'rtExcluded'],
] as const;

function summaryCells(s: SessionSummary | undefined): Cell[] {
  return SUMMARY_FIELDS.map(([, k]) => (s ? (s[k as keyof SessionSummary] as Cell) : null));
}

/** Une ligne par séance : résumé global, Classique et Go / no-go. */
export function sessionsCsv(d: ExportData): string {
  const players = new Map(d.players.map((p) => [p.id, p]));
  const cals = new Map(d.calibrations.map((c) => [c.id, c]));
  const cols = [
    ...SESSION_COLUMNS,
    ...SUMMARY_FIELDS.map(([n]) => n),
    ...SUMMARY_FIELDS.map(([n]) => `classique_${n}`),
    ...SUMMARY_FIELDS.map(([n]) => `gonogo_${n}`),
  ];
  const rows = [...d.sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => [
      ...sessionCells(s, players.get(s.playerId), cals.get(s.calibrationId)),
      ...summaryCells(s.summary),
      ...summaryCells(s.byGame?.classique),
      ...summaryCells(s.byGame?.gonogo),
    ]);
  return toCsv(cols, rows);
}

/** Trajectoires image par image (pour recalculer les TR avec un autre seuil). */
export function trajectoriesCsv(d: ExportData): string {
  const rows: Cell[][] = [];
  for (const t of d.trials) {
    for (const r of t.trajectory ?? []) rows.push([t.sessionId, t.playerId, t.index, ...r]);
  }
  return toCsv(['session_id', 'joueuse', 'essai', ...TRAJECTORY_FIELDS], rows);
}

/** Sauvegarde complète (JSON), réimportable. */
export interface Backup extends ExportData {
  format: 'rempart-sauvegarde';
  version: 1;
  exportedAt: string;
  appVersion: string;
}

export function makeBackup(d: ExportData, appVersion: string, now: Date): Backup {
  return { format: 'rempart-sauvegarde', version: 1, exportedAt: now.toISOString(), appVersion, ...d };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fichier illisible (JSON invalide).');
  }
  const b = data as Partial<Backup>;
  if (b?.format !== 'rempart-sauvegarde' || b.version !== 1) throw new Error('Ce fichier n’est pas une sauvegarde Rempart.');
  for (const k of ['players', 'calibrations', 'sessions', 'trials'] as const) {
    if (!Array.isArray(b[k])) throw new Error(`Sauvegarde incomplète (${k} manquant).`);
  }
  return b as Backup;
}
