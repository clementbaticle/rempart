/**
 * Écran d'essais, mode Classique (fond neutre). La cible est dessinée dans un
 * requestAnimationFrame, où est pris l'horodatage d'apparition (section 5, point 3).
 */
import { CONFIG } from '../config';
import { toImagePoints, type Points } from '../calibration/geometry';
import { mulberry32, randomSeed } from '../core/random';
import { classicBlock } from '../core/sequence';
import { summarize, type SessionSummary } from '../trial/outcome';
import { TrialMachine, type MachineEvent } from '../trial/trialMachine';
import type { Player } from '../players/player';
import type { CalibrationRecord } from '../storage/calibrationRecord';
import { toTrialRow, type SessionRecord, type TrialRow } from '../storage/sessionRecord';
import { CameraStage } from './cameraStage';
import { drawEffectorMarkers, drawTarget } from './targetDraw';

export interface TrialViewActions {
  save: (session: SessionRecord, trials: TrialRow[]) => Promise<void>;
  onExit: () => void;
}

const EFFECTOR_LANDMARKS = [15, 16, 19, 20, 27, 28, 31, 32];

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const ms = (v: number | null): string => (v === null ? '—' : `${Math.round(v)} ms`);
const pct = (v: number): string => `${Math.round(v * 100)} %`;

export function renderTrials(
  root: HTMLElement,
  player: Player,
  calibration: CalibrationRecord,
  a: TrialViewActions,
): () => void {
  const T = CONFIG.trial;
  const seed = randomSeed();
  const plan = classicBlock(seed, {
    repeats: T.classicRepeatsPerZone,
    maxInARow: T.maxSameZoneInARow,
    foreperiodMinMs: T.foreperiodMinMs,
    foreperiodMaxMs: T.foreperiodMaxMs,
  });
  const startDate = new Date();
  const video = calibration.video;
  let lastPoints: Points = [];
  let finished = false;
  let messageUntil = 0;

  const hud = document.createElement('div');
  hud.className = 'trial';
  hud.innerHTML = `
    <div class="trial__flash"></div>
    <div class="trial__counter"></div>
    <div class="trial__message"></div>
    <div class="trial__summary" hidden></div>
    <button class="trial__stop" type="button">Arrêter</button>`;
  const $ = <T extends HTMLElement>(s: string): T => hud.querySelector<T>(s)!;

  const onEvent = (e: MachineEvent): void => {
    if (e.type === 'falseStart') {
      $('.trial__message').textContent = 'Faux départ';
      messageUntil = performance.now() + 900;
    } else if (e.type === 'outcome') {
      const flash = $('.trial__flash');
      flash.className = `trial__flash ${e.record.outcome === 'hit' ? 'is-ok' : 'is-error'}`;
      window.setTimeout(() => (flash.className = 'trial__flash'), T.feedbackMs);
    } else if (e.type === 'done') {
      void finish('completed');
    }
  };

  const machine = new TrialMachine(
    plan,
    calibration.measures.guard,
    calibration.grid,
    T,
    mulberry32((seed ^ 0x9e3779b9) >>> 0),
    onEvent,
  );

  const stage = new CameraStage({
    diagnosticVisible: false,
    skeleton: false,
    onPose: ({ frame, landmarks, videoWidth, videoHeight }) => {
      if (finished) return;
      if (videoWidth !== video.width || videoHeight !== video.height) {
        $('.trial__message').textContent = 'Image modifiée (rotation ?) : recalibrer';
        messageUntil = Infinity;
        return;
      }
      lastPoints = toImagePoints(landmarks, videoWidth, videoHeight, CONFIG.pose.visibilityThreshold);
      const vis = landmarks
        ? EFFECTOR_LANDMARKS.reduce((s, i) => s + (landmarks[i]?.visibility ?? 0), 0) / EFFECTOR_LANDMARKS.length
        : 0;
      machine.onFrame(
        { t: frame.time, points: lastPoints, presentedFrames: frame.presentedFrames, visibility: vis },
        performance.now(),
      );
    },
    drawExtra: (ctx, rect, v) => drawEffectorMarkers(ctx, lastPoints, v, rect),
  });
  root.replaceChildren(stage.element);
  stage.element.append(hud);
  const layer = stage.addLayer();

  // Boucle d'affichage : la cible est dessinée ici et son apparition horodatée ici.
  let raf = 0;
  let targetDrawn = false;
  let waitSince: number | null = null;
  const loop = (rafTs: number): void => {
    const now = performance.now();
    machine.tick(now);
    const phase = machine.phase;
    if (phase === 'stimulus' && !targetDrawn) {
      const zone = calibration.grid.zones.find((z) => z.id === machine.currentZone)!;
      layer.clear();
      drawTarget(layer.ctx, zone.center, calibration.grid.targetRadiusPx, 'go', video, layer.rect);
      targetDrawn = true;
      machine.stimulusShown(performance.now(), rafTs);
    } else if (targetDrawn && phase !== 'stimulus' && phase !== 'response') {
      layer.clear();
      targetDrawn = false;
    }

    $('.trial__counter').textContent = `Essai ${Math.min(machine.index + 1, plan.length)} / ${plan.length}`;
    waitSince = phase === 'waitGuard' ? (waitSince ?? now) : null;
    const msg = $('.trial__message');
    if (now > messageUntil) {
      msg.textContent = waitSince !== null && now - waitSince > 1500 ? 'Mettez-vous en garde' : '';
    }
    if (!finished) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  $('.trial__stop').addEventListener('click', () => {
    if (finished) return a.onExit();
    if (window.confirm('Arrêter la série ? Les essais déjà faits seront enregistrés.')) void finish('interrupted');
  });

  async function finish(status: SessionRecord['status']): Promise<void> {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    layer.clear();
    const st = stage.stats();
    const summary = summarize(machine.records, { minMs: T.validRtMinMs, maxMs: T.validRtMaxMs });
    const session: SessionRecord = {
      id: newId(),
      playerId: player.id,
      date: startDate.toISOString(),
      endDate: new Date().toISOString(),
      mode: 'train',
      game: 'classique',
      status,
      batteryVersion: null,
      seed,
      calibrationId: calibration.id,
      device: { userAgent: navigator.userAgent, videoWidth: st.videoWidth, videoHeight: st.videoHeight },
      meanDetectionFps: st.meanDetectionFps,
      droppedFrameRatio: st.droppedRatio,
      timestampSource: st.timestampSource,
      delegate: stage.delegate,
      resolution: st.resolution,
      cameraPosition: stage.cameraPosition,
      appVersion: __APP_VERSION__,
      lowQuality: st.meanDetectionFps !== null && st.meanDetectionFps < CONFIG.quality.minFps,
      params: { ...T },
      summary,
      notes: '',
    };
    const rows = machine.records.map((r) => toTrialRow(session.id, player.id, r));
    let saved = true;
    try {
      await a.save(session, rows);
    } catch (err) {
      saved = false;
      console.error(err);
    }
    showSummary(summary, session, saved);
  }

  function showSummary(s: SessionSummary, session: SessionRecord, saved: boolean): void {
    $('.trial__message').textContent = '';
    $('.trial__counter').textContent = '';
    const box = $('.trial__summary');
    box.innerHTML = `
      <h2>${session.status === 'completed' ? 'Série terminée' : 'Série interrompue'} — ${player.id}</h2>
      <dl>
        <dt>Essais</dt><dd>${s.trials}</dd>
        <dt>Réussites</dt><dd>${s.hits} (${pct(s.hitRate)})</dd>
        <dt>TR médian</dt><dd>${ms(s.rtMedian)}</dd>
        <dt>Écart interquartile</dt><dd>${ms(s.rtIqr)}</dd>
        <dt>Temps de mouvement médian</dt><dd>${ms(s.mtMedian)}</dd>
        <dt>Anticipations</dt><dd>${s.anticipations} (${pct(s.anticipationRate)})</dd>
        <dt>Mauvaise zone / sans réponse</dt><dd>${s.wrongZone} / ${s.misses}</dd>
        <dt>Faux départs</dt><dd>${s.falseStarts}</dd>
        <dt>TR exclus (hors ${T.validRtMinMs}-${T.validRtMaxMs} ms)</dt><dd>${s.rtExcluded}</dd>
        <dt>Détection</dt><dd>${session.meanDetectionFps === null ? '—' : `${session.meanDetectionFps.toFixed(1)} i/s`}</dd>
      </dl>
      <p class="trial__warn" ${session.lowQuality ? '' : 'hidden'}>Qualité insuffisante (moins de ${CONFIG.quality.minFps} i/s) : résultats peu fiables.</p>
      <p class="trial__warn" ${saved ? 'hidden' : ''}>Échec de l’enregistrement.</p>
      <div class="calib__actions"><button class="btn btn--light" type="button">Accueil</button></div>`;
    box.querySelector('button')!.addEventListener('click', a.onExit);
    box.hidden = false;
    $('.trial__stop').hidden = true;
  }

  void stage.start();
  return () => {
    finished = true;
    cancelAnimationFrame(raf);
    stage.stop();
  };
}
