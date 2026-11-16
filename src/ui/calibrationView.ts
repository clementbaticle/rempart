/** Écran de calibration (fond neutre) : assistant en étapes, puis grille et mesures. */
import { CONFIG } from '../config';
import { toImagePoints } from '../calibration/geometry';
import { computeGrid, type Grid } from '../calibration/grid';
import { apparentSizeChange } from '../calibration/measures';
import {
  CalibrationWizard, STEP_INSTRUCTIONS, STEP_ORDER, type WizardResult, type WizardState,
} from '../calibration/wizard';
import type { Player } from '../players/player';
import { buildCalibrationRecord, type CalibrationRecord } from '../storage/calibrationRecord';
import { CameraStage } from './cameraStage';
import { drawGrid } from './gridDraw';
import { guardOverlaps } from '../trial/zones';

export interface CalibrationActions {
  previous: CalibrationRecord | undefined;
  save: (record: CalibrationRecord) => Promise<void>;
  onExit: () => void;
  /** Lance la série d'essais avec la calibration enregistrée. */
  onStart: (record: CalibrationRecord) => void;
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const fmt = (n: number): string => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

export function renderCalibration(root: HTMLElement, player: Player, a: CalibrationActions): () => void {
  const C = CONFIG.calibration;
  const wizard = new CalibrationWizard(C);
  let videoSize = { width: 0, height: 0 };
  let grid: Grid | null = null;
  let record: CalibrationRecord | null = null;

  const hud = document.createElement('div');
  hud.className = 'calib';
  hud.innerHTML = `
    <div class="calib__hud">
      <div class="calib__player"></div>
      <ol class="calib__steps"></ol>
      <div class="calib__instruction"></div>
      <div class="calib__feedback"></div>
      <div class="calib__progress"><div class="calib__progress-bar"></div></div>
    </div>
    <div class="calib__summary" hidden></div>
    <button class="live__back" type="button">← Accueil</button>`;
  const $ = <T extends HTMLElement>(s: string): T => hud.querySelector<T>(s)!;
  $('.calib__player').textContent = player.id;
  const stepsEl = $('.calib__steps');
  const labels = ['Cadrage', 'Garde', 'Envergure', 'Bras levés', 'Pas gauche', 'Pas droit'];
  stepsEl.innerHTML = labels.map((l) => `<li>${l}</li>`).join('');
  $('.live__back').addEventListener('click', a.onExit);

  const render = (s: WizardState): void => {
    const idx = STEP_ORDER.indexOf(s.step);
    stepsEl.querySelectorAll('li').forEach((li, i) => {
      li.className = i < idx ? 'is-done' : i === idx ? 'is-current' : '';
    });
    $('.calib__instruction').textContent = s.instruction;
    const fb = $('.calib__feedback');
    fb.textContent = s.feedback ?? (s.step === 'done' ? '' : 'Bien — ne bougez plus');
    fb.className = `calib__feedback ${s.valid ? 'is-ok' : 'is-error'}`;
    $('.calib__progress-bar').style.width = `${Math.round(s.progress * 100)}%`;
  };

  const stage = new CameraStage({
    diagnosticVisible: false,
    onPose: ({ frame, landmarks, videoWidth, videoHeight }) => {
      if (grid) return; // calibration terminée : affichage seul
      if (videoWidth !== videoSize.width || videoHeight !== videoSize.height) {
        videoSize = { width: videoWidth, height: videoHeight };
        wizard.reset(); // flux redimensionné (rotation) : on recommence
      }
      const pts = toImagePoints(landmarks, videoWidth, videoHeight, CONFIG.pose.visibilityThreshold);
      const state = wizard.update(frame.time, pts, videoWidth, videoHeight);
      render(state);
      const result = wizard.result;
      if (state.step === 'done' && result) finish(result);
    },
    drawExtra: (ctx, rect, video) => {
      if (grid) drawGrid(ctx, grid, video, rect);
    },
  });
  root.replaceChildren(stage.element);
  stage.element.append(hud);

  function finish(result: WizardResult): void {
    const g = computeGrid(
      {
        heightPx: result.guard.heightPx,
        pelvisX: result.guard.pelvis.x,
        ankleY: result.guard.ankleY,
        reachTopPx: result.reachTopPx,
        reachLeftPx: result.left.reachPx,
        reachRightPx: result.right.reachPx,
      },
      videoSize.width,
      videoSize.height,
      C.grid,
    );
    grid = g;
    record = buildCalibrationRecord({
      id: newId(),
      playerId: player.id,
      date: new Date(),
      statureCm: player.heightCm,
      faceToAnkleOverStature: C.faceToAnkleOverStature,
      video: { ...videoSize },
      result,
      grid: g,
      context: {
        appVersion: __APP_VERSION__,
        delegate: stage.delegate,
        cameraPosition: stage.cameraPosition,
        userAgent: navigator.userAgent,
      },
    });
    showSummary(record);
  }

  function showSummary(r: CalibrationRecord): void {
    const box = $('.calib__summary');
    const alerts: string[] = [];
    if (!r.grid.fits) {
      alerts.push(`Cibles hors de l’image (zones ${r.grid.overflowing.join(', ')}) : reculez le trépied et recommencez.`);
    }
    const overlaps = guardOverlaps(
      r.measures.guard,
      r.grid,
      CONFIG.trial.guardRadiusRatio * r.measures.guard.heightPx,
      CONFIG.trial.hitToleranceFactor,
    );
    if (overlaps.length) {
      alerts.push(
        `Cible${overlaps.length > 1 ? 's' : ''} ${overlaps.join(', ')} trop proche${overlaps.length > 1 ? 's' : ''} ` +
          'de la position de garde (zone trop facile) : recommencez avec votre garde habituelle, mains plus hautes.',
      );
    }
    if (a.previous) {
      const change = apparentSizeChange(
        { heightPx: r.measures.guard.heightPx, videoHeight: r.video.height },
        { heightPx: a.previous.measures.guard.heightPx, videoHeight: a.previous.video.height },
      );
      if (change > C.distanceAlertRatio) {
        alerts.push(
          `Taille apparente différente de ${Math.round(change * 100)} % par rapport à la calibration du ` +
            `${new Date(a.previous.date).toLocaleDateString('fr-FR')} : trépied pas à la même distance ?`,
        );
      }
    }
    const asym = r.cm.reachRight - r.cm.reachLeft;
    box.innerHTML = `
      <h2>Mesures (cm, approx.)</h2>
      <dl>
        <dt>Épaules</dt><dd>${fmt(r.cm.shoulderWidth)}</dd>
        <dt>Envergure</dt><dd>${fmt(r.cm.span)}</dd>
        <dt>Portée haute</dt><dd>${fmt(r.cm.reachTop)}</dd>
        <dt>Portée gauche / droite</dt><dd>${fmt(r.cm.reachLeft)} / ${fmt(r.cm.reachRight)}
          <small>(écart ${asym > 0 ? '+' : ''}${fmt(asym)})</small></dd>
        <dt>Pas gauche / droit</dt><dd>${fmt(r.cm.stepLeft)} / ${fmt(r.cm.stepRight)}</dd>
      </dl>
      <ul class="calib__alerts">${alerts.map(() => '<li></li>').join('')}</ul>
      <div class="calib__actions">
        <button class="btn btn--ghost" type="button" data-action="redo">Recommencer</button>
        <button class="btn btn--light" type="button" data-action="save">Enregistrer</button>
      </div>`;
    box.querySelectorAll('.calib__alerts li').forEach((li, i) => (li.textContent = alerts[i] ?? ''));
    box.hidden = false;
    box.querySelector('[data-action="redo"]')!.addEventListener('click', () => {
      grid = null;
      record = null;
      wizard.reset();
      box.hidden = true;
    });
    const saveBtn = box.querySelector<HTMLButtonElement>('[data-action="save"]')!;
    let saved: CalibrationRecord | null = null;
    saveBtn.addEventListener('click', async () => {
      if (saved) return a.onStart(saved); // déjà enregistrée : lancer la série
      if (!record) return;
      saveBtn.disabled = true;
      try {
        await a.save(record);
        saved = record;
        saveBtn.textContent = 'Commencer : Classique';
        saveBtn.disabled = false;
        box.querySelector<HTMLButtonElement>('[data-action="redo"]')!.hidden = true;
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Échec — réessayer';
        console.error(err);
      }
    });
  }

  render({ step: 'framing', instruction: STEP_INSTRUCTIONS.framing, feedback: null, valid: false, progress: 0 });
  $('.calib__feedback').textContent = '';
  void stage.start();
  return () => stage.stop();
}
