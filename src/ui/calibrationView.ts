/**
 * Écran de calibration (fond neutre) :
 * 1. coins de la cage touchés à l'écran (ou confirmés) ; 2. cadrage + garde de la joueuse ;
 * 3. grille calée sur la cage, alertes, enregistrement, lancement de la série.
 */
import { CONFIG } from '../config';
import { toImagePoints, type Point } from '../calibration/geometry';
import { checkGoal, goalGeometry, orderCorners, type GoalCorners } from '../calibration/goal';
import type { Grid } from '../calibration/grid';
import { apparentSizeChange } from '../calibration/measures';
import {
  CalibrationWizard, STEP_INSTRUCTIONS, type WizardResult, type WizardState, type WizardStep,
} from '../calibration/wizard';
import type { Player } from '../players/player';
import { buildCalibrationRecord, type CalibrationRecord } from '../storage/calibrationRecord';
import { guardOverlaps } from '../trial/zones';
import { EXERCISE } from '../theme';
import { CameraStage } from './cameraStage';
import { drawGrid, imageToScreen } from './gridDraw';

export interface CalibrationActions {
  previous: CalibrationRecord | undefined;
  save: (record: CalibrationRecord) => Promise<void>;
  onExit: () => void;
  /** Lance la série d'essais avec la calibration enregistrée. */
  onStart: (record: CalibrationRecord) => void;
}

interface StoredGoal {
  video: { width: number; height: number };
  corners: GoalCorners;
}

function loadGoal(): StoredGoal | null {
  try {
    const raw = localStorage.getItem(CONFIG.storageKeys.goalCorners);
    return raw ? (JSON.parse(raw) as StoredGoal) : null;
  } catch {
    return null;
  }
}

function storeGoal(g: StoredGoal): void {
  try {
    localStorage.setItem(CONFIG.storageKeys.goalCorners, JSON.stringify(g));
  } catch {
    /* stockage indisponible : coins gardés pour cette séance */
  }
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type Phase = 'goal' | 'player' | 'summary';

export function renderCalibration(root: HTMLElement, player: Player, a: CalibrationActions): () => void {
  const C = CONFIG.calibration;
  const wizard = new CalibrationWizard(C);
  let phase: Phase = 'goal';
  let videoSize = { width: 0, height: 0 };
  let taps: Point[] = [];
  let corners: GoalCorners | null = null;
  let grid: Grid | null = null;
  let record: CalibrationRecord | null = null;

  const hud = document.createElement('div');
  hud.className = 'calib';
  hud.innerHTML = `
    <div class="calib__hud">
      <div class="calib__player"></div>
      <ol class="calib__steps"><li>Cage</li><li>Cadrage</li><li>Garde</li></ol>
      <div class="calib__instruction"></div>
      <div class="calib__feedback"></div>
      <div class="calib__progress"><div class="calib__progress-bar"></div></div>
      <div class="calib__goal-actions"></div>
    </div>
    <div class="calib__summary" hidden></div>
    <button class="live__back" type="button">← Accueil</button>`;
  const $ = <T extends HTMLElement>(s: string): T => hud.querySelector<T>(s)!;
  $('.calib__player').textContent = player.id;
  $('.live__back').addEventListener('click', a.onExit);

  const setSteps = (current: number): void => {
    $('.calib__steps').querySelectorAll('li').forEach((li, i) => {
      li.className = i < current ? 'is-done' : i === current ? 'is-current' : '';
    });
  };
  const setText = (instruction: string, feedback: string, ok: boolean, progress: number): void => {
    $('.calib__instruction').textContent = instruction;
    const fb = $('.calib__feedback');
    fb.textContent = feedback;
    fb.className = `calib__feedback ${ok ? 'is-ok' : 'is-error'}`;
    $('.calib__progress-bar').style.width = `${Math.round(progress * 100)}%`;
  };

  // ---------- 1. Cage ----------
  const goalButtons = (buttons: [string, () => void][]): void => {
    const box = $('.calib__goal-actions');
    box.replaceChildren(
      ...buttons.map(([label, fn]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn--light';
        b.textContent = label;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
        return b;
      }),
    );
  };

  const showGoalStep = (): void => {
    phase = 'goal';
    hud.classList.add('calib--goal');
    setSteps(0);
    const stored = loadGoal();
    const sameVideo = stored && stored.video.width === videoSize.width && stored.video.height === videoSize.height;
    if (sameVideo && taps.length === 0 && !corners) {
      corners = stored.corners;
      setText('Cage mémorisée', 'Si le trépied n’a pas bougé, gardez ces coins.', true, 0);
      goalButtons([
        ['Refaire', () => resetGoal()],
        ['Garder ces coins', () => validateGoal()],
      ]);
      return;
    }
    resetGoal();
  };

  const resetGoal = (): void => {
    taps = [];
    corners = null;
    setText('Touchez les 4 coins de la cage', 'Pied et haut de chaque poteau, dans n’importe quel ordre (0 / 4)', true, 0);
    goalButtons([]);
  };

  const onTap = (e: PointerEvent): void => {
    if (phase !== 'goal' || corners || !videoSize.width) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, select, .diag')) return;
    const rect = stage.videoRect();
    const box = stage.element.getBoundingClientRect();
    const sx = e.clientX - box.left;
    const sy = e.clientY - box.top;
    if (sx < rect.x || sx > rect.x + rect.width || sy < rect.y || sy > rect.y + rect.height) return;
    taps.push({
      x: ((sx - rect.x) / rect.width) * videoSize.width,
      y: ((sy - rect.y) / rect.height) * videoSize.height,
    });
    if (taps.length < 4) {
      setText('Touchez les 4 coins de la cage', `Pied et haut de chaque poteau (${taps.length} / 4)`, true, taps.length / 4);
      goalButtons([['Effacer', () => resetGoal()]]);
      return;
    }
    corners = orderCorners(taps);
    const problems = checkGoal(
      goalGeometry(corners!, C.goal.widthCm, C.goal.heightCm),
      C.goal.widthCm / C.goal.heightCm,
      C.goal.aspectTolerance,
    );
    setText('Cage saisie', problems[0] ?? 'Vérifiez le cadre dessiné, puis validez.', problems.length === 0, 1);
    goalButtons([
      ['Refaire', () => resetGoal()],
      ['Valider la cage', () => validateGoal()],
    ]);
  };

  const validateGoal = (): void => {
    if (!corners) return;
    storeGoal({ video: { ...videoSize }, corners });
    goalButtons([]);
    hud.classList.remove('calib--goal');
    phase = 'player';
    wizard.reset();
    renderWizard({ step: 'framing', instruction: STEP_INSTRUCTIONS.framing, feedback: null, valid: false, progress: 0 });
  };

  // ---------- 2. Joueuse ----------
  const renderWizard = (s: WizardState): void => {
    // Liste affichée : Cage (0), Cadrage (1), Garde (2, préparation comprise), terminé (3).
    const shown: Record<WizardStep, number> = { framing: 1, prepare: 2, guard: 2, done: 3 };
    setSteps(shown[s.step]);
    setText(s.instruction, s.feedback ?? (s.valid ? 'Bien — ne bougez plus' : ''), s.valid, s.progress);
  };

  const drawGoal = (ctx: CanvasRenderingContext2D, rect: ReturnType<CameraStage['videoRect']>): void => {
    const video = videoSize;
    ctx.save();
    ctx.strokeStyle = EXERCISE.landmark;
    ctx.fillStyle = EXERCISE.landmark;
    ctx.lineWidth = 3;
    if (corners) {
      const pts = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].map((p) =>
        imageToScreen(p, video, rect),
      );
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const p of corners ? [] : taps) {
      const s = imageToScreen(p, video, rect);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const stage = new CameraStage({
    diagnosticVisible: false,
    onPose: ({ frame, landmarks, videoWidth, videoHeight }) => {
      if (videoWidth !== videoSize.width || videoHeight !== videoSize.height) {
        const first = videoSize.width === 0;
        videoSize = { width: videoWidth, height: videoHeight };
        grid = null;
        record = null;
        corners = null;
        taps = [];
        $('.calib__summary').hidden = true;
        showGoalStep(); // flux redimensionné (rotation) ou premier affichage : on (re)commence par la cage
        if (!first) setText('Image modifiée : recommencez', 'Touchez les 4 coins de la cage', false, 0);
        return;
      }
      if (phase !== 'player') return;
      const pts = toImagePoints(landmarks, videoWidth, videoHeight, CONFIG.pose.visibilityThreshold);
      const state = wizard.update(frame.time, pts, videoWidth, videoHeight);
      renderWizard(state);
      const result = wizard.result;
      if (state.step === 'done' && result) finish(result);
    },
    drawExtra: (ctx, rect) => {
      if (videoSize.width) drawGoal(ctx, rect);
      if (grid) drawGrid(ctx, grid, videoSize, rect);
    },
  });
  root.replaceChildren(stage.element);
  stage.element.append(hud);
  stage.element.addEventListener('pointerup', onTap);

  // ---------- 3. Grille et résumé ----------
  function finish(result: WizardResult): void {
    phase = 'summary';
    record = buildCalibrationRecord({
      id: newId(),
      playerId: player.id,
      date: new Date(),
      statureCm: player.heightCm,
      faceToAnkleOverStature: C.faceToAnkleOverStature,
      ankleHeightCm: C.ankleHeightCm,
      goalSizeCm: { width: C.goal.widthCm, height: C.goal.heightCm },
      gridParams: C.grid,
      video: { ...videoSize },
      corners: corners!,
      result,
      context: {
        appVersion: __APP_VERSION__,
        delegate: stage.delegate,
        cameraPosition: stage.cameraPosition,
        userAgent: navigator.userAgent,
      },
    });
    grid = record.grid;
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
          'de la position de garde (zone trop facile) : recommencez avec votre garde habituelle.',
      );
    }
    if (r.depthRatio < 0.95) {
      alerts.push('La joueuse paraît plus loin que la cage : coins de la cage ou taille du profil à vérifier.');
    }
    const prevGoal = a.previous?.goal;
    if (prevGoal) {
      const change = apparentSizeChange(
        { sizePx: r.goal.geometry.widthPx, videoHeight: r.video.height },
        { sizePx: prevGoal.geometry.widthPx, videoHeight: a.previous!.video.height },
      );
      if (change > C.distanceAlertRatio) {
        alerts.push(
          `Cage ${Math.round(change * 100)} % plus ${r.goal.geometry.widthPx / r.video.height > prevGoal.geometry.widthPx / a.previous!.video.height ? 'grande' : 'petite'} ` +
            `qu’à la calibration du ${new Date(a.previous!.date).toLocaleDateString('fr-FR')} : trépied pas à la même distance ?`,
        );
      }
    }
    box.innerHTML = `
      <h2>Calibration</h2>
      <dl>
        <dt>Cage à l’image</dt><dd>${Math.round(r.goal.geometry.widthPx)} × ${Math.round(r.goal.geometry.heightPx)} px</dd>
        <dt>Épaules</dt><dd>${Math.round(r.cm.shoulderWidth)} cm (approx.)</dd>
        <dt>Joueuse / cage</dt><dd>× ${r.depthRatio.toFixed(2)}</dd>
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
      box.hidden = true;
      phase = 'player';
      wizard.reset();
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

  setSteps(0);
  setText('Ouverture de la caméra…', '', true, 0);
  void stage.start();
  return () => stage.stop();
}
