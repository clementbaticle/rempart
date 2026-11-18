/**
 * Écran d'essais, mode Classique (fond neutre). La cible est dessinée dans un
 * requestAnimationFrame, où est pris l'horodatage d'apparition (section 5, point 3).
 */
import { CONFIG } from '../config';
import { toImagePoints, type Points } from '../calibration/geometry';
import { mulberry32, randomSeed } from '../core/random';
import { classicBlock, goNoGoBlock, testBattery, type PlannedTrial } from '../core/sequence';
import { summarize, summarizeByGame } from '../trial/outcome';
import { TrialMachine, type MachineEvent } from '../trial/trialMachine';
import type { Player } from '../players/player';
import type { CalibrationRecord } from '../storage/calibrationRecord';
import { toTrialRow, type SessionRecord, type TrialRow } from '../storage/sessionRecord';
import { CameraStage } from './cameraStage';
import { GAME_LABELS, missIsError, responseLimitMs, type ModeChoice } from '../trial/modes';
import { Sounds } from './sound';
import { drawEffectorMarkers, drawTarget } from './targetDraw';
import { boundsOf, viewRegion } from './viewRegion';

function readSoundPref(): boolean {
  try {
    const v = localStorage.getItem(CONFIG.storageKeys.sound);
    return v === null ? CONFIG.feedback.sound : v === '1';
  } catch {
    return CONFIG.feedback.sound;
  }
}

function writeSoundPref(on: boolean): void {
  try {
    localStorage.setItem(CONFIG.storageKeys.sound, on ? '1' : '0');
  } catch {
    /* préférence non mémorisée */
  }
}

export interface TrialViewActions {
  save: (session: SessionRecord, trials: TrialRow[]) => Promise<void>;
  onExit: () => void;
  /** Série terminée ou interrompue, enregistrée (ou non) : afficher les résultats. */
  onDone: (session: SessionRecord, trials: TrialRow[], saved: boolean) => void;
}

const EFFECTOR_LANDMARKS = [15, 16, 19, 20, 27, 28, 31, 32];

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}


export function renderTrials(
  root: HTMLElement,
  player: Player,
  calibration: CalibrationRecord,
  choice: ModeChoice,
  a: TrialViewActions,
): () => void {
  // Délai pour atteindre la cible selon le mode choisi (plafond de sécurité en Découverte).
  const T = { ...CONFIG.trial, responseMs: responseLimitMs(choice, CONFIG.modes) };
  // Test : batterie figée (graines fixes) ; sinon le jeu choisi, tiré au hasard.
  const isBattery = choice.mode === 'test';
  const seed = isBattery ? CONFIG.battery.seeds.classique : randomSeed();
  const fp = { foreperiodMinMs: T.foreperiodMinMs, foreperiodMaxMs: T.foreperiodMaxMs };
  const plan: PlannedTrial[] = isBattery
    ? testBattery({ ...CONFIG.battery, ...fp, classicRepeatsPerZone: T.classicRepeatsPerZone, noGoZones: T.noGoZones,
        maxSameZoneInARow: T.maxSameZoneInARow, maxNoGoInARow: T.maxNoGoInARow })
    : choice.game === 'gonogo'
      ? goNoGoBlock(seed, { ...fp, noGoZones: T.noGoZones, maxInARow: T.maxSameZoneInARow, maxNoGoInARow: T.maxNoGoInARow })
      : classicBlock(seed, { ...fp, repeats: T.classicRepeatsPerZone, maxInARow: T.maxSameZoneInARow });
  const blockSizes = new Map<number, number>();
  plan.forEach((t) => blockSizes.set(t.block, (blockSizes.get(t.block) ?? 0) + 1));
  const startDate = new Date();
  const video = calibration.video;
  let lastPoints: Points = [];
  let finished = false;
  let messageUntil = 0;
  /** La série démarre après le compte à rebours. */
  let started = false;
  // Créé pendant le geste « Commencer » : nécessaire pour que l'iPad autorise le son.
  const sounds = new Sounds(readSoundPref());

  const hud = document.createElement('div');
  hud.className = 'trial';
  hud.innerHTML = `
    <div class="trial__flash"></div>
    <div class="trial__countdown" hidden></div>
    <div class="trial__counter"></div>
    <div class="trial__message"></div>
    <div class="trial__buttons">
      <button class="trial__sound" type="button"></button>
      <button class="trial__stop" type="button">Arrêter</button>
    </div>`;
  const $ = <T extends HTMLElement>(s: string): T => hud.querySelector<T>(s)!;

  const onEvent = (e: MachineEvent): void => {
    if (e.type === 'falseStart') {
      $('.trial__message').textContent = 'Faux départ';
      messageUntil = performance.now() + 900;
    } else if (e.type === 'outcome') {
      // Changement de bloc (batterie Test) : pause après cet essai.
      const next = plan[e.record.index];
      if (next && next.block !== e.record.block) blockPause(next);
      // Retour APRÈS la réponse : flash plein écran bref + son.
      // En Découverte, un délai dépassé (plafond de sécurité) n'est pas présenté comme une erreur.
      const ok = e.record.outcome === 'hit' || e.record.outcome === 'correct_rejection';
      if (!ok && e.record.outcome === 'miss' && !missIsError(choice)) return;
      const flash = $('.trial__flash');
      flash.className = `trial__flash ${ok ? 'is-ok' : 'is-error'}`;
      window.setTimeout(() => (flash.className = 'trial__flash'), CONFIG.feedback.flashMs);
      if (ok) sounds.success();
      else sounds.error();
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
      if (!started) return; // compte à rebours en cours : repères affichés, aucune mesure
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
    if (!started) {
      if (!finished) raf = requestAnimationFrame(loop);
      return;
    }
    const now = performance.now();
    machine.tick(now);
    const phase = machine.phase;
    if (phase === 'stimulus' && !targetDrawn) {
      const zone = calibration.grid.zones.find((z) => z.id === machine.currentZone)!;
      layer.clear();
      drawTarget(layer.ctx, zone.center, calibration.grid.targetRadiusPx, machine.isGo ? 'go' : 'noGo', video, layer.rect);
      targetDrawn = true;
      machine.stimulusShown(performance.now(), rafTs);
    } else if (targetDrawn && phase !== 'stimulus' && phase !== 'response') {
      layer.clear();
      targetDrawn = false;
    }

    $('.trial__counter').textContent = counterLabel();
    waitSince = phase === 'waitGuard' ? (waitSince ?? now) : null;
    const msg = $('.trial__message');
    if (now > messageUntil) {
      msg.textContent = waitSince !== null && now - waitSince > 1500 ? 'Mettez-vous en garde' : '';
    }
    if (!finished) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const soundBtn = $<HTMLButtonElement>('.trial__sound');
  const renderSoundBtn = (): void => {
    soundBtn.textContent = sounds.enabled ? 'Son : oui' : 'Son : non';
  };
  renderSoundBtn();
  soundBtn.addEventListener('click', () => {
    sounds.enabled = !sounds.enabled;
    writeSoundPref(sounds.enabled);
    renderSoundBtn();
  });

  /** Zoom d'affichage sur la cage, les cibles et la joueuse (affichage seulement). */
  const zoomOnPlayArea = (): void => {
    if (!CONFIG.display.zoomOnPlayArea) return;
    const c = calibration.goal.corners;
    const g = calibration.measures.guard;
    const play = boundsOf(
      [c.topLeft, c.topRight, c.bottomLeft, c.bottomRight,
        { x: g.pelvis.x, y: g.faceTopY }, g.leftAnkle, g.rightAnkle, g.leftHand, g.rightHand],
      calibration.grid.zones.map((z) => ({ center: z.center, radius: calibration.grid.targetRadiusPx })),
    );
    const box = stage.element.getBoundingClientRect();
    stage.setViewRegion(viewRegion(play, CONFIG.display.margins, video, box.width / Math.max(box.height, 1)));
  };

  /** Compte à rebours 3, 2, 1, GO (avec bips), puis démarrage de la série. */
  const countdown = (): void => {
    const el = $('.trial__countdown');
    el.hidden = false;
    let n = CONFIG.feedback.countdownFrom;
    const step = (): void => {
      if (finished) return;
      if (n > 0) {
        el.textContent = String(n);
        sounds.tick();
        n -= 1;
        window.setTimeout(step, 1000);
      } else {
        el.textContent = 'GO';
        sounds.go();
        window.setTimeout(() => {
          el.hidden = true;
          started = true;
        }, CONFIG.feedback.goMs);
      }
    };
    step();
  };

  $('.trial__stop').addEventListener('click', () => {
    if (finished) return;
    if (window.confirm('Arrêter la série ? Les essais déjà faits seront enregistrés.')) void finish('interrupted');
  });

  async function finish(status: SessionRecord['status']): Promise<void> {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    layer.clear();
    const st = stage.stats();
    const bounds = { minMs: T.validRtMinMs, maxMs: T.validRtMaxMs };
    const summary = summarize(machine.records, bounds);
    const byGame = summarizeByGame(machine.records, bounds);
    const session: SessionRecord = {
      id: newId(),
      playerId: player.id,
      date: startDate.toISOString(),
      endDate: new Date().toISOString(),
      mode: choice.mode,
      level: choice.level,
      responseLimitMs: T.responseMs,
      game: isBattery ? 'batterie' : choice.game,
      status,
      batteryVersion: isBattery ? CONFIG.battery.version : null,
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
      byGame,
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
    stage.setViewRegion(null);
    a.onDone(session, rows, saved);
  }

  /** Libellé du compteur : bloc et essai (batterie), sinon essai. */
  function counterLabel(): string {
    const cur = machine.currentTrial ?? plan[plan.length - 1]!;
    const inBlock = plan.slice(0, machine.index + 1).filter((t) => t.block === cur.block).length;
    const size = blockSizes.get(cur.block) ?? plan.length;
    if (!isBattery) return `Essai ${Math.min(inBlock, size)} / ${size}`;
    if (cur.block === 0) return `Familiarisation ${inBlock} / ${size}`;
    return `Bloc ${cur.block} · ${GAME_LABELS[cur.game]} ${inBlock} / ${size}`;
  }

  /** Pause entre deux blocs : la série est suspendue, compte à rebours, puis reprise. */
  function blockPause(next: PlannedTrial): void {
    started = false;
    const el = $('.trial__countdown');
    const end = performance.now() + CONFIG.battery.pauseMs;
    const title = `Pause — bloc ${next.block} : ${GAME_LABELS[next.game]}`;
    const hint = next.game === 'gonogo' ? 'Vert ● : touche · Rouge ✕ : ne bouge pas' : '';
    el.hidden = false;
    el.classList.add('is-pause');
    let lastBeep = -1;
    const step = (): void => {
      if (finished) return;
      const left = Math.ceil((end - performance.now()) / 1000);
      if (left <= 0) {
        el.hidden = true;
        el.classList.remove('is-pause');
        sounds.go();
        started = true;
        return;
      }
      el.innerHTML = '';
      const t = document.createElement('div');
      t.className = 'trial__pause-title';
      t.textContent = title;
      const n = document.createElement('div');
      n.textContent = String(left);
      const h = document.createElement('div');
      h.className = 'trial__pause-hint';
      h.textContent = hint;
      el.append(t, n, h);
      if (left <= 3 && left !== lastBeep) {
        sounds.tick();
        lastBeep = left;
      }
      window.setTimeout(step, 200);
    };
    window.setTimeout(step, CONFIG.feedback.flashMs);
  }

  void stage.start().then((ok) => {
    if (!ok) return;
    zoomOnPlayArea();
    countdown();
  });
  return () => {
    finished = true;
    cancelAnimationFrame(raf);
    stage.stop();
    sounds.close();
  };
}
