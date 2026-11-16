/** Base locale IndexedDB (section 2) : tables `players` et `calibrations` (étape 2). */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Player } from '../players/player';
import type { CalibrationRecord } from './calibrationRecord';

interface RempartDB extends DBSchema {
  players: { key: string; value: Player };
  calibrations: {
    key: string;
    value: CalibrationRecord;
    indexes: { by_player: string };
  };
}

export const DB_NAME = 'rempart';
export const DB_VERSION = 1;

export type Db = IDBPDatabase<RempartDB>;

export function openDb(name: string = DB_NAME): Promise<Db> {
  return openDB<RempartDB>(name, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('players', { keyPath: 'id' });
      const cal = db.createObjectStore('calibrations', { keyPath: 'id' });
      cal.createIndex('by_player', 'playerId');
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
  const tx = db.transaction(['players', 'calibrations'], 'readwrite');
  const players = tx.objectStore('players');
  if (!(await players.get(previousId))) throw new Error(`Profil ${previousId} introuvable.`);
  if (player.id !== previousId) {
    if (await players.get(player.id)) throw new Error(`Le pseudonyme ${player.id} existe déjà.`);
    const cals = tx.objectStore('calibrations');
    const linked = await cals.index('by_player').getAll(previousId);
    for (const c of linked) await cals.put({ ...c, playerId: player.id });
    await players.delete(previousId);
  }
  await players.put(player);
  await tx.done;
}

/** Supprime une joueuse et toutes ses données (section 11). */
export async function deletePlayerData(db: Db, playerId: string): Promise<void> {
  const tx = db.transaction(['players', 'calibrations'], 'readwrite');
  const cals = await tx.objectStore('calibrations').index('by_player').getAllKeys(playerId);
  await Promise.all([
    ...cals.map((k) => tx.objectStore('calibrations').delete(k)),
    tx.objectStore('players').delete(playerId),
  ]);
  await tx.done;
}
