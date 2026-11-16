import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { normalizePseudonym, validatePlayer, type Player } from '../players/player';
import { computeGrid } from '../calibration/grid';
import { buildCalibrationRecord } from './calibrationRecord';
import {
  addPlayer, deletePlayerData, latestCalibration, listCalibrations, listPlayers, openDb, saveCalibration,
} from './db';

const LIMITS = CONFIG.player;

describe('profil joueuse', () => {
  const ok = { id: 'G1', category: 'pro', position: 'gardienne', laterality: 'droitiere', heightCm: 175 } as const;

  it('normalise le pseudonyme', () => {
    expect(normalizePseudonym('  g1 ')).toBe('G1');
  });

  it('valide un profil correct', () => {
    expect(validatePlayer(ok, LIMITS)).toEqual([]);
  });

  it('refuse un nom, un doublon, une taille aberrante', () => {
    expect(validatePlayer({ ...ok, id: 'MARIE DUPONT' }, LIMITS)).toHaveLength(1);
    expect(validatePlayer(ok, LIMITS, ['G1'])[0]).toMatch(/existe déjà/);
    expect(validatePlayer({ ...ok, heightCm: 17.5 }, LIMITS)[0]).toMatch(/Taille/);
    expect(validatePlayer({ ...ok, heightCm: Number.NaN }, LIMITS)).toHaveLength(1);
  });
});

const result = {
  guard: { heightPx: 400, faceTopY: 250, ankleY: 650, shoulderWidthPx: 100, pelvis: { x: 640, y: 450 } },
  spanPx: 440,
  reachTopPx: 520,
  left: { reachPx: 320, stepPx: 100 },
  right: { reachPx: 340, stepPx: 120 },
};

function record(id: string, playerId: string, date: string) {
  return buildCalibrationRecord({
    id,
    playerId,
    date: new Date(date),
    statureCm: 170,
    faceToAnkleOverStature: 0.9,
    video: { width: 1280, height: 720 },
    result,
    grid: computeGrid(
      { heightPx: 400, pelvisX: 640, ankleY: 650, reachTopPx: 520, reachLeftPx: 320, reachRightPx: 340 },
      1280, 720, CONFIG.calibration.grid,
    ),
    context: { appVersion: 'test', delegate: 'CPU', cameraPosition: 'bord-court', userAgent: 'vitest' },
  });
}

describe('enregistrement de calibration', () => {
  it('convertit les mesures en cm', () => {
    const r = record('c1', 'G1', '2026-11-16T18:00:00Z');
    // 400 px pour 170 × 0,9 = 153 cm → 2,614 px/cm.
    expect(r.pxPerCm).toBeCloseTo(2.614, 3);
    expect(r.cm.span).toBeCloseTo(168.3, 1);
    expect(r.cm.stepLeft).toBeCloseTo(38.3, 1);
    expect(r.date).toBe('2026-11-16T18:00:00.000Z');
  });
});

describe('IndexedDB', () => {
  const player = (id: string): Player => ({
    id, category: 'pro', position: 'gardienne', laterality: 'droitiere', heightCm: 170, active: true,
    createdAt: '2026-11-16T00:00:00Z',
  });

  it('joueuses, calibrations, dernière calibration et suppression', async () => {
    const db = await openDb(`test-${Math.random()}`);
    await addPlayer(db, player('G2'));
    await addPlayer(db, player('G10'));
    await addPlayer(db, player('G1'));
    await expect(addPlayer(db, player('G1'))).rejects.toBeDefined();
    expect((await listPlayers(db)).map((p) => p.id)).toEqual(['G1', 'G2', 'G10']);

    await saveCalibration(db, record('a', 'G1', '2026-11-10T10:00:00Z'));
    await saveCalibration(db, record('b', 'G1', '2026-11-16T10:00:00Z'));
    await saveCalibration(db, record('c', 'G2', '2026-11-12T10:00:00Z'));
    expect((await latestCalibration(db, 'G1'))?.id).toBe('b');
    expect(await listCalibrations(db, 'G1')).toHaveLength(2);

    await deletePlayerData(db, 'G1');
    expect((await listPlayers(db)).map((p) => p.id)).toEqual(['G2', 'G10']);
    expect(await listCalibrations(db, 'G1')).toHaveLength(0);
    expect(await listCalibrations(db, 'G2')).toHaveLength(1);
    db.close();
  });
});
