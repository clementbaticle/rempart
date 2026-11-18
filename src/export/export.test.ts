import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { csvCell, makeBackup, parseBackup, sessionsCsv, toCsv, trajectoriesCsv, trialsCsv, type ExportData } from './csv';
import { addPlayer, exportAll, importAll, openDb, saveSession } from '../storage/db';
import type { SessionRecord, TrialRow } from '../storage/sessionRecord';
import type { Player } from '../players/player';

const player: Player = {
  id: 'G1', category: 'pro', position: 'gardienne', laterality: 'droitiere', heightCm: 175, active: true, createdAt: '2026-11-18T00:00:00Z',
};
const session = {
  id: 's1', playerId: 'G1', date: '2026-11-18T10:00:00Z', mode: 'test', level: null, game: 'batterie', batteryVersion: 'v1',
  seed: 1, responseLimitMs: 2000, status: 'completed', calibrationId: 'c1', meanDetectionFps: 57.7, droppedFrameRatio: 0.02,
  summary: { trials: 2, hitRate: 0.5, rtMedian: 412.345 }, byGame: { gonogo: { commissions: 1 } },
} as unknown as SessionRecord;
const trial = (index: number, extra: Partial<TrialRow> = {}): TrialRow => ({
  id: `s1:${index}`, sessionId: 's1', playerId: 'G1', index, block: 1, analyzed: true, game: 'classique', zone: 3,
  stimulus: 'go', isGo: true, outcome: 'hit', rtMs: 400, crossedZones: [2, 6], falseStarts: 0,
  trajectory: [[1000, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]], quality: { meanVisibility: 0.9, droppedFrames: 0, responseFrames: 10, swayRatio: 0.01 },
  ...extra,
}) as TrialRow;
const data: ExportData = { players: [player], calibrations: [], sessions: [session], trials: [trial(2), trial(1, { outcome: 'miss', rtMs: null })] };

describe('CSV', () => {
  it('cellules : nombres au point, vides, guillemets', () => {
    expect(csvCell(412.3456)).toBe('412.346');
    expect(csvCell(null)).toBe('');
    expect(csvCell(true)).toBe('1');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('dit "non"')).toBe('"dit ""non"""');
    expect(toCsv(['a', 'b'], [[1, 'x']])).toBe('a,b\n1,x\n');
  });

  it('essais : format long, colonnes de séance répétées, ordre des essais', () => {
    const lines = trialsCsv(data).trim().split('\n');
    expect(lines).toHaveLength(3);
    const head = lines[0]!.split(',');
    const row = (i: number) => Object.fromEntries(lines[i]!.split(',').map((v, k) => [head[k], v]));
    expect(row(1)).toMatchObject({ session_id: 's1', joueuse: 'G1', categorie: 'pro', mode: 'test', jeu: 'batterie', essai: '1', issue: 'miss', tr_ms: '' });
    expect(row(2)).toMatchObject({ essai: '2', zone: '3', tr_ms: '400', zones_traversees: '2;6', go: '1' });
  });

  it('séances et trajectoires', () => {
    const s = sessionsCsv(data).trim().split('\n');
    expect(s[0]).toContain('tr_median_ms');
    expect(s[0]).toContain('gonogo_commissions');
    expect(s[1]).toContain('412.345');
    const t = trajectoriesCsv(data).trim().split('\n');
    expect(t).toHaveLength(3);
    expect(t[0]!.startsWith('session_id,joueuse,essai,t,')).toBe(true);
  });

  it('sauvegarde JSON : aller-retour et refus d’un autre fichier', () => {
    const b = makeBackup(data, '0.4.0', new Date('2026-11-18T12:00:00Z'));
    expect(parseBackup(JSON.stringify(b)).sessions).toHaveLength(1);
    expect(() => parseBackup('{"a":1}')).toThrow(/sauvegarde Rempart/);
    expect(() => parseBackup('pas du json')).toThrow(/illisible/);
  });
});

describe('import sans écraser', () => {
  it('ajoute le nouveau, ignore l’existant', async () => {
    const db = await openDb(`test-${Math.random()}`);
    await addPlayer(db, player);
    await saveSession(db, session, [trial(1)]);
    const counts = await importAll(db, {
      players: [player, { ...player, id: 'G2' }], calibrations: [], sessions: [session, { ...session, id: 's2' }],
      trials: [trial(1), { ...trial(1), id: 's2:1', sessionId: 's2' }],
    });
    expect(counts).toEqual({ players: 1, calibrations: 0, sessions: 1, trials: 1, skipped: 3 });
    const all = await exportAll(db);
    expect([all.players.length, all.sessions.length, all.trials.length]).toEqual([2, 2, 2]);
    db.close();
  });
});
