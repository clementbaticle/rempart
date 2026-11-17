/**
 * Écran de calibration (fond neutre) :
 * 1. cage : 4 coins touchés à l'écran (loupe, coins déplaçables) ou confirmés ;
 * 2. étalonnage individuel sur la ligne de but (une fois par gardienne, ou à la demande) ;
 * 3. cadrage + garde à la position de jeu ;
 * 4. grille calée sur la cage, alertes, enregistrement, lancement de la série.
 */
import { CONFIG } from '../config';
import { toImagePoints, type Point } from '../calibration/geometry';
import { checkGoal, goalGeometry, orderCorners, type GoalCorners } from '../calibration/goal';
import type { Grid } from '../calibration/grid';
import { apparentSizeChange } from '../calibration/measures';
import { referenceCalibration, type ReferenceResult } from '../calibration/reference';
import { CalibrationWizard, type WizardResult, type WizardState, type WizardStep } from '../calibration/wizard';
import type { Player } from '../players/player';
import { buildCalibrationRecord, type CalibrationRecord } from '../storage/calibrationRecord';
import { guardOverlaps } from '../trial/zones';
import { EXERCISE } from '../theme';
import { CameraStage } from './cameraStage';
import { drawGrid, imageToScreen } from './gridDraw';

export interface CalibrationActions {
  previous: CalibrationRecord | undefined;
  save: (record: CalibrationRecord) => Promise<void>;
  /** Enregistre l'étalonnage individuel dans le profil ; renvoie le profil mis à jour. */
  saveReference: (guardHeightCm: number) => Promise<Player>;
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

type Phase = 'goal' | 'reference' | 'referenceResult' | 'player' | 'summary';

/** Liste d'étapes affichée en haut. */
const STEP_LABELS = ['Cage', 'Étalonnage', 'Cadrage', 'Garde'];

const LOUPE_SIZE = 180; // px CSS
const LOUPE_ZOOM = 3;
const GRAB_RADIUS = 44; // px CSS : distance pour attraper un coin existant

export function renderCalibration(root: HTMLElement, initialPlayer: Player, a: CalibrationActions): () => void {
  const C = CONFIG.calibration;
  let player = initialPlayer;
  let wizard = new CalibrationWizard(C);
  let phase: Phase = 'goal';
  let videoSize = { width: 0, height: 0 };
  /** Coins de la cage en cours de saisie (pixels image, miroir). */
  let taps: Point[] = [];
  let dragIndex: number | null = null;
  let corners: GoalCorners | null = null;
  let grid: Grid | null = null;
  let record: CalibrationRecord | null = null;
  let reference: ReferenceResult | null = null;

  const hud = document.createElement('div');
  hud.className = 'calib';
  hud.innerHTML = `
    <div class="calib__hud">
      <div class="calib__player"></div>
      <ol class="calib__steps">${STEP_LABELS.map((l) => `<li>${l}</li>`).join('')}</ol>
      <div class="calib__instruction"></div>
      <div class="calib__feedback"></div>
      <div class="calib__progress"><div class="calib__progress-bar"></div></div>
      <div class="calib__goal-actions"></div>
    </div>
    <canvas class="calib__loupe" hidden></canvas>
    <div class="calib__summary" hidden></div>
    <button class="live__back" type="button">← Accueil</button>`;
  const $ = <T extends HTMLElement>(s: string): T => hud.querySelector<T>(s)!;
  $('.calib__player').textContent = player.id;
  $('.live__back').addEventListener('click', a.onExit);
  const loupe = $<HTMLCanvasElement>('.calib__loupe');

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
  const actions = (buttons: [string, () => void][]): void => {
    $('.calib__goal-actions').replaceChildren(
      ...buttons.map(([label, fn]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn--light';
        b.textContent = label;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
        return b;
      }),
    );
  };

  // ---------- 1. Cage ----------
  const startGoal = (): void => {
    phase = 'goal';
    hud.classList.add('calib--goal');
    $('.calib__summary').hidden = true;
    grid = null;
    record = null;
    setSteps(0);
    const stored = loadGoal();
    const sameVideo = stored && stored.video.width === videoSize.width && stored.video.height === videoSize.height;
    if (sameVideo) {
      const c = stored.corners;
      taps = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft].map((p) => ({ ...p }));
      corners = c;
      setText('Cage mémorisée', 'Si le trépied n’a pas bougé, gardez ces coins (ou faites-les glisser pour ajuster).', true, 1);
      actions([
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
    updateGoalStatus();
  };

  const updateGoalStatus = (): void => {
    if (taps.length < 4) {
      corners = null;
      setText(
        'Touchez les 4 coins de la cage',
        `Pied et haut de chaque poteau, dans n’importe quel ordre — maintenez et glissez pour ajuster (${taps.length} / 4)`,
        true,
        taps.length / 4,
      );
      actions(taps.length ? [['Effacer', () => resetGoal()]] : []);
      return;
    }
    corners = orderCorners(taps);
    const problems = checkGoal(
      goalGeometry(corners!, C.goal.widthCm, C.goal.heightCm),
      C.goal.widthCm / C.goal.heightCm,
      C.goal.aspectTolerance,
    );
    setText('Cage saisie', problems[0] ?? 'Faites glisser un coin pour l’ajuster, puis validez.', problems.length === 0, 1);
    actions([
      ['Refaire', () => resetGoal()],
      ['Valider la cage', () => validateGoal()],
    ]);
  };

  const validateGoal = (): void => {
    if (!corners) return;
    storeGoal({ video: { ...videoSize }, corners });
    hud.classList.remove('calib--goal');
    if (player.guardHeightCm === undefined) startReference();
    else startPlayer();
  };

  /** Position écran (px CSS dans la scène) → pixels image ; null hors de la vidéo. */
  const screenToImage = (e: PointerEvent): { img: Point; sx: number; sy: number } | null => {
    const rect = stage.videoRect();
    const box = stage.element.getBoundingClientRect();
    const sx = e.clientX - box.left;
    const sy = e.clientY - box.top;
    if (sx < rect.x || sx > rect.x + rect.width || sy < rect.y || sy > rect.y + rect.height) return null;
    return {
      img: { x: ((sx - rect.x) / rect.width) * videoSize.width, y: ((sy - rect.y) / rect.height) * videoSize.height },
      sx,
      sy,
    };
  };

  const showLoupe = (img: Point, sx: number, sy: number): void => {
    const dpr = window.devicePixelRatio || 1;
    if (loupe.width !== LOUPE_SIZE * dpr) {
      loupe.width = LOUPE_SIZE * dpr;
      loupe.height = LOUPE_SIZE * dpr;
      loupe.style.width = `${LOUPE_SIZE}px`;
      loupe.style.height = `${LOUPE_SIZE}px`;
    }
    const box = stage.element.getBoundingClientRect();
    // Au-dessus du doigt (décalée vers le centre de l'écran), sans sortir de la scène.
    const left = Math.min(Math.max(sx - LOUPE_SIZE / 2, 8), box.width - LOUPE_SIZE - 8);
    const top = sy - LOUPE_SIZE - 40 < 8 ? sy + 40 : sy - LOUPE_SIZE - 40;
    loupe.style.left = `${left}px`;
    loupe.style.top = `${top}px`;
    loupe.hidden = false;

    const ctx = loupe.getContext('2d')!;
    const rect = stage.videoRect();
    const videoPerCss = videoSize.width / rect.width;
    const src = (LOUPE_SIZE / LOUPE_ZOOM) * videoPerCss; // taille de la zone source (px vidéo)
    const rawX = videoSize.width - img.x; // image affichée en miroir
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = EXERCISE.background;
    ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.translate(LOUPE_SIZE, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(stage.videoElement, rawX - src / 2, img.y - src / 2, src, src, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.restore();
    ctx.strokeStyle = EXERCISE.error;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(LOUPE_SIZE / 2, 10);
    ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE - 10);
    ctx.moveTo(10, LOUPE_SIZE / 2);
    ctx.lineTo(LOUPE_SIZE - 10, LOUPE_SIZE / 2);
    ctx.stroke();
    ctx.strokeStyle = EXERCISE.landmark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (phase !== 'goal' || !videoSize.width) return;
    if ((e.target as HTMLElement).closest('button, select, .diag')) return;
    const pos = screenToImage(e);
    if (!pos) return;
    const rect = stage.videoRect();
    let nearest = -1;
    let best = GRAB_RADIUS;
    taps.forEach((p, i) => {
      const s = imageToScreen(p, videoSize, rect);
      const d = Math.hypot(s.x - pos.sx, s.y - pos.sy);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    if (nearest >= 0) dragIndex = nearest;
    else if (taps.length < 4) {
      taps.push(pos.img);
      dragIndex = taps.length - 1;
    } else return;
    try {
      stage.element.setPointerCapture(e.pointerId); // suivre le doigt même hors de la scène
    } catch {
      /* capture indisponible : sans effet */
    }
    taps[dragIndex] = pos.img;
    showLoupe(pos.img, pos.sx, pos.sy);
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (dragIndex === null) return;
    const pos = screenToImage(e);
    if (!pos) return;
    taps[dragIndex] = pos.img;
    showLoupe(pos.img, pos.sx, pos.sy);
  };

  const onPointerUp = (): void => {
    if (dragIndex === null) return;
    dragIndex = null;
    loupe.hidden = true;
    updateGoalStatus();
  };

  // ---------- 2. Étalonnage individuel ----------
  const startReference = (): void => {
    phase = 'reference';
    wizard = new CalibrationWizard(C);
    reference = null;
    setSteps(1);
    setText('Étalonnage : placez-vous SUR la ligne de but, entre les poteaux', '', true, 0);
    actions(player.guardHeightCm !== undefined ? [['Annuler', () => startPlayer()]] : []);
  };

  const finishReference = (result: WizardResult): void => {
    phase = 'referenceResult';
    const geometry = goalGeometry(corners!, C.goal.widthCm, C.goal.heightCm);
    reference = referenceCalibration(result.guard, corners!, geometry, player.heightCm, {
      ankleHeightCm: C.ankleHeightCm,
      ...C.reference,
    });
    const r = reference;
    const ok = r.problems.length === 0;
    setText(
      `Hauteur de garde : ${Math.round(r.guardHeightCm)} cm (${Math.round(r.ratio * 100)} % de la taille)`,
      ok ? 'Étalonnage correct.' : r.problems.join(' '),
      ok,
      1,
    );
    actions([
      ['Recommencer', () => startReference()],
      [
        ok ? 'Valider' : 'Valider quand même',
        async () => {
          player = await a.saveReference(r.guardHeightCm);
          startPlayer();
        },
      ],
    ]);
  };

  // ---------- 3. Joueuse à sa position de jeu ----------
  const startPlayer = (): void => {
    phase = 'player';
    wizard = new CalibrationWizard(C);
    const done = player.guardHeightDate ? new Date(player.guardHeightDate).toLocaleDateString('fr-FR') : null;
    renderWizard({ step: 'framing', instruction: 'Placez-vous à votre position de jeu, entièrement visible', feedback: null, valid: false, progress: 0 });
    actions([[done ? `Refaire l’étalonnage (fait le ${done})` : 'Étalonner', () => startReference()]]);
  };

  const renderWizard = (s: WizardState): void => {
    // Liste affichée : Cage (0), Étalonnage (1), Cadrage (2), Garde (3, préparation comprise), terminé (4).
    const shown: Record<WizardStep, number> = { framing: 2, prepare: 3, guard: 3, done: 4 };
    if (phase === 'reference') setSteps(1);
    else setSteps(shown[s.step]);
    const instruction =
      phase === 'reference' && s.step === 'framing'
        ? 'Étalonnage : placez-vous SUR la ligne de but, entre les poteaux'
        : phase === 'player' && s.step === 'framing'
          ? 'Placez-vous à votre position de jeu, entièrement visible'
          : s.instruction;
    setText(instruction, s.feedback ?? (s.valid ? 'Bien — ne bougez plus' : ''), s.valid, s.progress);
  };

  const drawGoal = (ctx: CanvasRenderingContext2D, rect: ReturnType<CameraStage['videoRect']>): void => {
    ctx.save();
    ctx.strokeStyle = EXERCISE.landmark;
    ctx.lineWidth = 3;
    if (taps.length === 4) {
      const c = orderCorners(taps)!;
      const pts = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft].map((p) => imageToScreen(p, videoSize, rect));
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (phase === 'goal') {
      taps.forEach((p, i) => {
        const s = imageToScreen(p, videoSize, rect);
        ctx.beginPath();
        ctx.arc(s.x, s.y, i === dragIndex ? 16 : 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = EXERCISE.landmark;
        ctx.fill();
      });
    }
    ctx.restore();
  };

  const stage = new CameraStage({
    diagnosticVisible: false,
    onPose: ({ frame, landmarks, videoWidth, videoHeight }) => {
      if (videoWidth !== videoSize.width || videoHeight !== videoSize.height) {
        const first = videoSize.width === 0;
        videoSize = { width: videoWidth, height: videoHeight };
        startGoal(); // premier affichage ou flux redimensionné (rotation) : on (re)commence par la cage
        if (!first) setText('Image modifiée : recommencez', 'Touchez les 4 coins de la cage', false, 0);
        return;
      }
      if (phase !== 'reference' && phase !== 'player') return;
      const pts = toImagePoints(landmarks, videoWidth, videoHeight, CONFIG.pose.visibilityThreshold);
      const state = wizard.update(frame.time, pts, videoWidth, videoHeight);
      renderWizard(state);
      const result = wizard.result;
      if (state.step === 'done' && result) {
        if (phase === 'reference') finishReference(result);
        else finish(result);
      }
    },
    drawExtra: (ctx, rect) => {
      if (videoSize.width) drawGoal(ctx, rect);
      if (grid) drawGrid(ctx, grid, videoSize, rect);
    },
  });
  root.replaceChildren(stage.element);
  stage.element.append(hud);
  stage.element.style.touchAction = 'none';
  stage.element.addEventListener('pointerdown', onPointerDown);
  stage.element.addEventListener('pointermove', onPointerMove);
  stage.element.addEventListener('pointerup', onPointerUp);
  stage.element.addEventListener('pointercancel', onPointerUp);

  // ---------- 4. Grille et résumé ----------
  function finish(result: WizardResult): void {
    phase = 'summary';
    actions([]);
    record = buildCalibrationRecord({
      id: newId(),
      playerId: player.id,
      date: new Date(),
      statureCm: player.heightCm,
      faceToAnkleOverStature: C.faceToAnkleOverStature,
      guardHeightCm: player.guardHeightCm,
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
    if (r.scaleSource === 'taille') {
      alerts.push('Pas d’étalonnage individuel : cibles placées par approximation (taille). Étalonnez avant toute collecte de données.');
    }
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
      alerts.push('La joueuse paraît plus loin que la cage : coins de la cage ou étalonnage à vérifier.');
    }
    const prev = a.previous;
    if (prev?.goal) {
      const change = apparentSizeChange(
        { sizePx: r.goal.geometry.widthPx, videoHeight: r.video.height },
        { sizePx: prev.goal.geometry.widthPx, videoHeight: prev.video.height },
      );
      if (change > C.distanceAlertRatio) {
        const bigger = r.goal.geometry.widthPx / r.video.height > prev.goal.geometry.widthPx / prev.video.height;
        alerts.push(
          `Cage ${Math.round(change * 100)} % plus ${bigger ? 'grande' : 'petite'} qu’à la calibration du ` +
            `${new Date(prev.date).toLocaleDateString('fr-FR')} : trépied pas à la même distance ?`,
        );
      }
    }
    box.innerHTML = `
      <h2>Calibration</h2>
      <dl>
        <dt>Cage à l’image</dt><dd>${Math.round(r.goal.geometry.widthPx)} × ${Math.round(r.goal.geometry.heightPx)} px</dd>
        <dt>Échelle</dt><dd>${r.scaleSource === 'etalonnage' ? 'étalonnage individuel' : 'taille (approximation)'}</dd>
        <dt>Hauteur de garde</dt><dd>${Math.round(r.guardHeightCm)} cm</dd>
        <dt>Joueuse / cage</dt><dd>× ${r.depthRatio.toFixed(2)}</dd>
      </dl>
      <ul class="calib__alerts">${alerts.map(() => '<li></li>').join('')}</ul>
      <div class="calib__actions">
        <button class="btn btn--ghost" type="button" data-action="redo">Recommencer</button>
        <button class="btn btn--light" type="button" data-action="save">Enregistrer</button>
      </div>`;
    box.querySelectorAll('.calib__alerts li').forEach((li, i) => (li.textContent = alerts[i] ?? ''));
    box.hidden = false;
    box.addEventListener('pointerdown', (e) => e.stopPropagation());
    box.querySelector('[data-action="redo"]')!.addEventListener('click', () => {
      grid = null;
      record = null;
      box.hidden = true;
      startPlayer();
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
