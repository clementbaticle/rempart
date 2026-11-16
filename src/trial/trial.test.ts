import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { Point, Points } from '../calibration/geometry';
import { computeGrid } from '../calibration/grid';
import { measureGuard } from '../calibration/measures';
import { makePose } from '../calibration/testPose';
import { mulberry32 } from '../core/random';
import { bodySample, features, meanFeatures, movementCause, swayRatio } from './body';
import { classicOutcome, quantile, summarize } from './outcome';
import { TrialMachine, type MachineEvent } from './trialMachine';
import { firstTouch, guardOverlaps, handsInGuard } from './zones';

const P = CONFIG.trial;
const guard = measureGuard(makePose())!; // taille 400 px → seuil 20 px, rayon de garde 48 px
const grid = computeGrid(
  { heightPx: 400, pelvisX: 640, ankleY: 650, reachTopPx: 520, reachLeftPx: 320, reachRightPx: 320 },
  1280, 720, CONFIG.calibration.grid,
); // colonnes 352 / 640 / 928 ; rangées 182 / 416 / 650 ; rayon 36
const center = (zone: number): Point => grid.zones.find((z) => z.id === zone)!.center;

/** Déplace tout le corps (rebond, décalage). */
const shift = (p: Points, dx: number, dy: number): Points => p.map((q) => q && { x: q.x + dx, y: q.y + dy });
/** Place le poignet et l'index gauches en un point. */
function leftHandAt(p: Points, at: Point): Points {
  return p.map((q, i) => (i === 15 || i === 19 ? { ...at } : q));
}
function moveLeftHand(p: Points, dx: number, dy: number): Points {
  return p.map((q, i) => (q && (i === 15 || i === 19) ? { x: q.x + dx, y: q.y + dy } : q));
}

describe('critères de mouvement', () => {
  const base = features(bodySample(makePose()));

  it('un rebond du corps entier ne compte pas', () => {
    expect(movementCause(features(bodySample(shift(makePose(), 0, -30))), base, 20)).toBeNull();
  });

  it('un geste de la main par rapport aux épaules compte', () => {
    expect(movementCause(features(bodySample(moveLeftHand(makePose(), -25, 0))), base, 20)).toBe('main-gauche');
  });

  it('un déplacement latéral du corps compte (bassin)', () => {
    expect(movementCause(features(bodySample(shift(makePose(), 25, 0))), base, 20)).toBe('bassin');
  });

  it('un pied seul qui se décale compte', () => {
    const p = makePose().map((q, i) => (q && i === 28 ? { x: q.x + 30, y: q.y } : q));
    expect(movementCause(features(bodySample(p)), base, 20)).toBe('pied-droit');
  });

  it('référence moyenne et indice de balancement', () => {
    const a = features(bodySample(makePose()));
    const b = features(bodySample(moveLeftHand(makePose(), 10, 0)));
    expect(meanFeatures([a, b]).leftHandRel).toEqual({ x: -56, y: 90 });
    expect(swayRatio([a, a], 400)).toBe(0);
    expect(swayRatio([a, b], 400)).toBeCloseTo(((5 + 5 + 0 + 0) / 4) / 400);
  });
});

describe('zones', () => {
  it('mains en garde, y compris si la joueuse s’est décalée', () => {
    expect(handsInGuard(bodySample(makePose()), guard, 48)).toBe(true);
    expect(handsInGuard(bodySample(shift(makePose(), 80, 10)), guard, 48)).toBe(true);
    expect(handsInGuard(bodySample(makePose({ arms: 'spread' })), guard, 48)).toBe(false);
  });

  it('touche : la zone cible a priorité, sinon la zone touchée', () => {
    expect(firstTouch(leftHandAt(makePose(), center(4)), grid, 1, 4)).toEqual({ zone: 4, effector: 'main-gauche' });
    expect(firstTouch(leftHandAt(makePose(), center(4)), grid, 1, 1)).toEqual({ zone: 4, effector: 'main-gauche' });
    expect(firstTouch(makePose(), grid, 1, 1)).toBeNull();
  });

  it('chevauchement garde / cible', () => {
    // Mains de garde à (579, 410) et (701, 410) ; cible 5 en (640, 416) → chevauchement.
    expect(guardOverlaps(guard, grid, 48, 1)).toEqual([5]);
  });
});

describe('issues et statistiques', () => {
  it('ordre de priorité des issues', () => {
    const t = { zone: 1, effector: 'main-gauche' as const };
    expect(classicOutcome({ targetZone: 1, touch: t, rtMs: 100, anticipationMs: 150 })).toBe('anticipation');
    expect(classicOutcome({ targetZone: 1, touch: null, rtMs: 300, anticipationMs: 150 })).toBe('miss');
    expect(classicOutcome({ targetZone: 2, touch: t, rtMs: 300, anticipationMs: 150 })).toBe('wrong_zone');
    expect(classicOutcome({ targetZone: 1, touch: { zone: 1, effector: 'pied-gauche' }, rtMs: 300, anticipationMs: 150 })).toBe('wrong_effector');
    expect(classicOutcome({ targetZone: 7, touch: { zone: 7, effector: 'pied-gauche' }, rtMs: 300, anticipationMs: 150 })).toBe('hit');
  });

  it('quantiles type 7', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantile([], 0.5)).toBeNull();
  });

  it('résumé : médiane sur les réussites dans les bornes, exclusions comptées', () => {
    const s = summarize(
      [
        { outcome: 'hit', rtMs: 300, mtMs: 200, falseStarts: 0 },
        { outcome: 'hit', rtMs: 400, mtMs: 250, falseStarts: 1 },
        { outcome: 'hit', rtMs: 1700, mtMs: 100, falseStarts: 0 },
        { outcome: 'anticipation', rtMs: 90, mtMs: null, falseStarts: 0 },
        { outcome: 'miss', rtMs: null, mtMs: null, falseStarts: 0 },
      ],
      { minMs: 150, maxMs: 1500 },
    );
    expect(s).toMatchObject({
      trials: 5, hits: 3, hitRate: 0.6, anticipations: 1, misses: 1, falseStarts: 1,
      rtMedian: 350, rtIqr: 50, mtMedian: 225, rtIncluded: 2, rtExcluded: 1,
    });
  });
});

/** Pilote l'automate avec des images toutes les 40 ms (25 i/s). */
class Driver {
  t = 1000;
  frames = 0;
  events: MachineEvent[] = [];
  m: TrialMachine;
  constructor(zones: number[], foreperiodMs = 1000) {
    this.m = new TrialMachine(
      zones.map((zone) => ({ zone, foreperiodMs })),
      guard, grid, P, mulberry32(1), (e) => this.events.push(e),
    );
  }
  frame(points: Points): void {
    this.t += 40;
    this.frames += 1;
    this.m.onFrame({ t: this.t, points, presentedFrames: this.frames, visibility: 0.9 }, this.t + 30);
  }
  /** Images de garde jusqu'à la demande de cible, puis affichage 10 ms après la dernière image. */
  untilStimulus(pose: (i: number) => Points = () => makePose()): number {
    for (let i = 0; this.m.phase !== 'stimulus'; i++) {
      if (i > 500) throw new Error('pas de stimulus');
      this.frame(pose(i));
    }
    const tStim = this.t + 10;
    this.m.stimulusShown(tStim, tStim - 5);
    return tStim;
  }
}

describe('automate d’essai', () => {
  it('essai réussi : TR, temps de mouvement, temps total', () => {
    const d = new Driver([1]);
    const tStim = d.untilStimulus();
    d.frame(makePose()); // +30 ms : rien
    d.frame(makePose()); // +70
    d.frame(makePose()); // +110
    d.frame(makePose()); // +150
    d.frame(moveLeftHand(makePose(), -30, -10)); // +190 : départ
    d.frame(moveLeftHand(makePose(), -150, -150)); // +230
    d.frame(leftHandAt(makePose(), center(1))); // +270 : touche
    const r = d.m.records[0]!;
    expect(r.outcome).toBe('hit');
    expect(r.tStimulus).toBe(tStim);
    expect(r.rtMs).toBe(190 - 10 + 10);
    expect(r.totalMs).toBe(270);
    expect(r.mtMs).toBe(80);
    expect(r.initiationCause).toBe('main-gauche');
    expect(r.usedEffector).toBe('main-gauche');
    expect(r.falseStarts).toBe(0);
    expect(r.quality.droppedFrames).toBe(0);
    expect(r.quality.swayRatio).toBe(0);
    expect(r.trajectory.length).toBeGreaterThan(20);
    expect(d.m.phase).toBe('feedback');
  });

  it('garde en mouvement (rebonds) : ni faux départ ni initiation', () => {
    const d = new Driver([1]);
    const bounce = (i: number): Points => shift(makePose(), 0, 12 * Math.sin(i / 2));
    d.untilStimulus(bounce);
    for (let i = 0; i < 10; i++) d.frame(bounce(i));
    expect(d.m.phase).toBe('response');
    d.frame(leftHandAt(makePose(), center(1)));
    const r = d.m.records[0]!;
    expect(r.falseStarts).toBe(0);
    // Aucun départ détecté pendant les rebonds : l'initiation tombe sur l'image de la touche.
    expect(r.tInitiation).toBe(r.tTouch);
    expect(r.outcome).toBe('hit');
    expect(r.quality.swayRatio).toBe(0); // mains immobiles par rapport aux épaules
  });

  it('faux départ pendant l’avant-période : essai rejoué et compté', () => {
    const d = new Driver([1], 2000);
    for (let i = 0; i < 20; i++) d.frame(makePose()); // garde puis début d'avant-période
    expect(d.m.phase).toBe('foreperiod');
    d.frame(moveLeftHand(makePose(), -60, 0));
    expect(d.m.phase).toBe('waitGuard');
    expect(d.events.some((e) => e.type === 'falseStart')).toBe(true);
    d.untilStimulus();
    d.frame(leftHandAt(makePose(), center(1)));
    expect(d.m.records[0]!.falseStarts).toBe(1);
    expect(d.m.records[0]!.foreperiodPlannedMs).not.toBe(2000); // nouvelle avant-période tirée
  });

  it('pas de réponse : miss après le délai', () => {
    const d = new Driver([1]);
    d.untilStimulus();
    for (let i = 0; i < 60; i++) d.frame(makePose());
    expect(d.m.records[0]!.outcome).toBe('miss');
    expect(d.m.records[0]!.rtMs).toBeNull();
  });

  it('départ trop précoce : anticipation', () => {
    const d = new Driver([1]);
    d.untilStimulus();
    d.frame(moveLeftHand(makePose(), -40, 0)); // +30 ms
    d.frame(leftHandAt(makePose(), center(1)));
    expect(d.m.records[0]!.outcome).toBe('anticipation');
    expect(d.m.records[0]!.rtMs).toBe(30);
  });

  it('mauvaise zone touchée en premier', () => {
    const d = new Driver([1]);
    d.untilStimulus();
    for (let i = 0; i < 5; i++) d.frame(makePose());
    d.frame(leftHandAt(makePose(), center(4)));
    expect(d.m.records[0]!.outcome).toBe('wrong_zone');
    expect(d.m.records[0]!.touchedZone).toBe(4);
  });

  it('retour, intervalle puis essai suivant, puis fin', () => {
    const d = new Driver([1, 3]);
    d.untilStimulus();
    for (let i = 0; i < 5; i++) d.frame(makePose());
    d.frame(leftHandAt(makePose(), center(1)));
    for (let i = 0; i < 40; i++) d.frame(makePose()); // 1,6 s > retour + intervalle
    expect(d.m.index).toBe(1);
    d.untilStimulus();
    for (let i = 0; i < 5; i++) d.frame(makePose());
    d.frame(leftHandAt(makePose(), center(3)));
    for (let i = 0; i < 40; i++) d.frame(makePose());
    expect(d.m.phase).toBe('done');
    expect(d.m.records.map((r) => [r.index, r.zone, r.outcome])).toEqual([
      [1, 1, 'hit'],
      [2, 3, 'hit'],
    ]);
    expect(d.events.at(-1)).toEqual({ type: 'done' });
  });
});
