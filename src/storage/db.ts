/**
 * Base locale IndexedDB (section 2).
 * v1 : `players`, `calibrations` (étape 2) ; v2 : `sessions`, `trials` (étape 3).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Player } from '../players/player';
import type { CalibrationRecord } from './calibrationRecord';
import type { SessionRecord, TrialRow } from './sessionRecord';

interface RempartDB extends DBSchema {
  players: { key: string; value: Player };
  calibrations: {
    key: string;
    value: CalibrationRecord;
    indexes: { by_player: string };
  };
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { by_player: string };
  };
  trials: {
    key: string;
    value: TrialRow;
    indexes: { by_session: string; by_player: string };
  };
}

export const DB_NAME = 'rempart';
export const DB_VERSION = 2;

export type Db = IDBPDatabase<RempartDB>;

export function openDb(name: string = DB_NAME): Promise<Db> {
  return openDB<RempartDB>(name, DB_VERSION, {
    // Migrations successives : les données existantes sont conservées.
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('players', { keyPath: 'id' });
        const cal = db.createObjectStore('calibrations', { keyPath: 'id' });
        cal.createIndex('by_player', 'playerId');
      }
      if (oldVersion < 2) {
        const ses = db.createObjectStore('sessions', { keyPath: 'id' });
        ses.createIndex('by_player', 'playerId');
        const tri = db.createObjectStore('trials', { keyPath: 'id' });
        tri.createIndex('by_session', 'sessionId');
        tri.createIndex('by_player', 'playerId');
      }
    },
  });
}

export async function listPlayers(db: Db): Promise<Player[]> {
  const all = await db.getAll('players');
  return all.sort((a, b) => a.id.localeCompare(b.id, 'fr', { numeric: true }));
}

export async function addPlayer(db: Db, player: Player): Promise<void> {
  await db.add('players', player); // échoue si le pseudonyme existe déjà
}

export async function getPlayer(db: Db, id: string): Promise<Player | undefined> {
  return db.get('players', id);
}

export async function saveCalibration(db: Db, record: CalibrationRecord): Promise<void> {
  await db.put('calibrations', record);
}

/** Calibrations d'une joueuse, de la plus récente à la plus ancienne. */
export async function listCalibrations(db: Db, playerId: string): Promise<CalibrationRecord[]> {
  const all = await db.getAllFromIndex('calibrations', 'by_player', playerId);
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function latestCalibration(db: Db, playerId: string): Promise<CalibrationRecord | undefined> {
  return (await listCalibrations(db, playerId))[0];
}

/**
 * Modifie un profil. Si le pseudonyme change, ses calibrations sont rattachées au nouveau
 * pseudonyme dans la même transaction (tout ou rien). Les calibrations passées gardent
 * l'échelle px/cm calculée avec la taille connue au moment de la calibration.
 */
export async function updatePlayer(db: Db, previousId: string, player: Player): Promise<void> {
  const tx = db.transaction(['players', 'calibrations', 'sessions', 'trials'], 'readwrite');
  const players = tx.objectStore('players');
  if (!(await players.get(previousId))) throw new Error(`Profil ${previousId} introuvable.`);
  if (player.id !== previousId) {
    if (await players.get(player.id)) throw new Error(`Le pseudonyme ${player.id} existe déjà.`);
    const cals = tx.objectStore('calibrations');
    for (const c of await cals.index('by_player').getAll(previousId)) await cals.put({ ...c, playerId: player.id });
    const ses = tx.objectStore('sessions');
    for (const x of await ses.index('by_player').getAll(previousId)) await ses.put({ ...x, playerId: player.id });
    const tri = tx.objectStore('trials');
    for (const x of await tri.index('by_player').getAll(previousId)) await tri.put({ ...x, playerId: player.id });
    await players.delete(previousId);
  }
  await players.put(player);
  await tx.done;
}

/** Supprime une joueuse et toutes ses données (section 11). */
export async function deletePlayerData(db: Db, playerId: string): Promise<void> {
  const tx = db.transaction(['players', 'calibrations', 'sessions', 'trials'], 'readwrite');
  const cals = await tx.objectStore('calibrations').index('by_player').getAllKeys(playerId);
  const ses = await tx.objectStore('sessions').index('by_player').getAllKeys(playerId);
  const tri = await tx.objectStore('trials').index('by_player').getAllKeys(playerId);
  await Promise.all([
    ...cals.map((k) => tx.objectStore('calibrations').delete(k)),
    ...ses.map((k) => tx.objectStore('sessions').delete(k)),
    ...tri.map((k) => tx.objectStore('trials').delete(k)),
    tx.objectStore('players').delete(playerId),
  ]);
  await tx.done;
}

/** Enregistre une séance et ses essais dans une seule transaction. */
export async function saveSession(db: Db, session: SessionRecord, trials: readonly TrialRow[]): Promise<void> {
  const tx = db.transaction(['sessions', 'trials'], 'readwrite');
  await Promise.all([tx.objectStore('sessions').put(session), ...trials.map((t) => tx.objectStore('trials').put(t))]);
  await tx.done;
}

export async function listSessions(db: Db, playerId: string): Promise<SessionRecord[]> {
  const all = await db.getAllFromIndex('sessions', 'by_player', playerId);
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function listTrials(db: Db, sessionId: string): Promise<TrialRow[]> {
  const all = await db.getAllFromIndex('trials', 'by_session', sessionId);
  return all.sort((a, b) => a.index - b.index);
}

/** Toutes les données (export). */
export async function exportAll(db: Db): Promise<{
  players: Player[];
  calibrations: CalibrationRecord[];
  sessions: SessionRecord[];
  trials: TrialRow[];
}> {
  const [players, calibrations, sessions, trials] = await Promise.all([
    db.getAll('players'),
    db.getAll('calibrations'),
    db.getAll('sessions'),
    db.getAll('trials'),
  ]);
  return { players, calibrations, sessions, trials };
}

export interface ImportCounts {
  players: number;
  calibrations: number;
  sessions: number;
  trials: number;
  skipped: number;
}

/** Importe une sauvegarde SANS écraser : les éléments déjà présents (même identifiant) sont ignorés. */
export async function importAll(
  db: Db,
  data: {
    players: readonly Player[];
    calibrations: readonly CalibrationRecord[];
    sessions: readonly SessionRecord[];
    trials: readonly TrialRow[];
  },
): Promise<ImportCounts> {
  const counts: ImportCounts = { players: 0, calibrations: 0, sessions: 0, trials: 0, skipped: 0 };
  const tx = db.transaction(['players', 'calibrations', 'sessions', 'trials'], 'readwrite');
  for (const store of ['players', 'calibrations', 'sessions', 'trials'] as const) {
    const os = tx.objectStore(store);
    for (const item of data[store] as readonly { id: string }[]) {
      if (await os.getKey(item.id)) counts.skipped += 1;
      else {
        await (os as unknown as { add: (v: unknown) => Promise<unknown> }).add(item);
        counts[store] += 1;
      }
    }
  }
  await tx.done;
  return counts;
}
