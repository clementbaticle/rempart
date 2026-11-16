/**
 * Scène caméra commune aux écrans d'exercice : vidéo en miroir, détection image par image,
 * canvas superposé, panneau de diagnostic. (Reprise telle quelle de l'écran de l'étape 1 :
 * boucle d'images et horodatage inchangés.)
 */
import { CONFIG } from '../config';
import { currentSettings, startCamera, stopCamera } from '../camera/camera';
import {
  CameraFpsEstimator, DroppedFrameCounter, FpsCounter, RollingStats, classifyStreamFit, parseCameraPosition,
  type CameraPosition,
} from '../camera/diagnostics';
import { resolveResolution } from '../camera/resolutionChoice';
import { fitContain, type Landmark, type Rect } from '../pose/landmarks';
import { createPoseDetector, type PoseDetector } from '../pose/poseDetector';
import { startFrameLoop, type FrameInfo, type TimestampSource } from '../pose/frameLoop';
import { resolveDelegates } from '../pose/delegateChoice';
import { SkeletonOverlay } from './overlay';
import { DiagnosticPanel } from './diagnosticPanel';
import { keepScreenAwake, requestFullscreen } from './screen';
import { watchPower, type PowerState } from './power';

function readCameraPosition(): CameraPosition {
  try {
    return parseCameraPosition(localStorage.getItem(CONFIG.storageKeys.cameraPosition));
  } catch {
    return 'inconnue';
  }
}

function saveCameraPosition(p: CameraPosition): void {
  try {
    localStorage.setItem(CONFIG.storageKeys.cameraPosition, p);
  } catch {
    /* stockage indisponible : valeur gardée pour la séance seulement */
  }
}

export interface PoseFrame {
  frame: FrameInfo;
  /** Repères normalisés de la joueuse (non miroir), ou undefined si personne. */
  landmarks: readonly Landmark[] | undefined;
  videoWidth: number;
  videoHeight: number;
}

export interface CameraStageOptions {
  diagnosticVisible?: boolean;
  /** Appelé après chaque détection, avant le dessin. */
  onPose?: (p: PoseFrame) => void;
  /** Dessin supplémentaire par-dessus le squelette (contexte en pixels CSS). */
  drawExtra?: (ctx: CanvasRenderingContext2D, videoRect: Rect, video: { width: number; height: number }) => void;
}

export class CameraStage {
  readonly element: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly status: HTMLElement;
  private readonly panel: DiagnosticPanel;
  private stream: MediaStream | null = null;
  private detector: PoseDetector | null = null;
  private stopLoop: (() => void) | null = null;
  private refreshTimer = 0;
  private readonly cleanups: (() => void)[] = [];
  private cameraPositionValue = readCameraPosition();
  private readonly delegateChoice = resolveDelegates(window.location.search, CONFIG.pose.delegates);

  constructor(private readonly opts: CameraStageOptions = {}) {
    this.element = document.createElement('div');
    this.element.className = 'live';
    this.element.innerHTML = `
      <div class="live__stage">
        <video class="live__video" autoplay muted playsinline></video>
        <canvas class="live__overlay"></canvas>
      </div>
      <div class="live__status">Ouverture de la caméra…</div>
      <button class="live__diag-toggle" type="button" aria-label="Afficher ou masquer le diagnostic">i</button>`;
    this.video = this.element.querySelector('video')!;
    this.canvas = this.element.querySelector('canvas')!;
    this.status = this.element.querySelector('.live__status')!;
    this.panel = new DiagnosticPanel(this.cameraPositionValue, (p) => {
      this.cameraPositionValue = p;
      saveCameraPosition(p);
    });
    this.panel.toggle(opts.diagnosticVisible ?? CONFIG.diagnostic.visibleByDefault);
    this.element.append(this.panel.element);
    this.element.querySelector('.live__diag-toggle')!.addEventListener('click', () => this.panel.toggle());
  }

  get cameraPosition(): CameraPosition {
    return this.cameraPositionValue;
  }

  get delegate(): string {
    return this.detector?.delegate ?? '—';
  }

  /** Démarre caméra et détection ; renvoie false (message affiché) en cas d'échec. */
  async start(): Promise<boolean> {
    void requestFullscreen();
    void keepScreenAwake();

    let power: PowerState | null = null;
    void watchPower((s) => {
      power = s;
    });

    const resolutionChoice = resolveResolution(
      window.location.search,
      CONFIG.camera.resolutionPresets,
      { width: CONFIG.camera.idealWidth, height: CONFIG.camera.idealHeight },
    );
    const { video, status } = this;
    try {
      const cam = await startCamera(video, resolutionChoice.resolution);
      this.stream = cam.stream;
      status.textContent = 'Chargement du modèle de détection…';
      this.detector = await createPoseDetector(this.delegateChoice.delegates);
      status.hidden = true;
    } catch (err) {
      stopCamera(this.stream);
      this.stream = null;
      status.textContent = err instanceof Error ? err.message : String(err);
      status.classList.add('is-error');
      return false;
    }
    const detector = this.detector;

    const overlay = new SkeletonOverlay(this.canvas);
    const stage = this.element.querySelector<HTMLElement>('.live__stage')!;
    let rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
    const layout = (): void => {
      const box = stage.getBoundingClientRect();
      rect = fitContain(video.videoWidth, video.videoHeight, box.width, box.height);
      overlay.resize(box.width, box.height, rect);
    };
    layout();
    window.addEventListener('resize', layout);
    video.addEventListener('resize', layout); // dimensions du flux modifiées (rotation)
    this.cleanups.push(() => {
      window.removeEventListener('resize', layout);
      video.removeEventListener('resize', layout);
    });

    const cameraFps = new CameraFpsEstimator(CONFIG.quality.fpsWindowMs);
    const detectionFps = new FpsCounter(CONFIG.quality.fpsWindowMs);
    const detectionMs = new RollingStats(30);
    const dropped = new DroppedFrameCounter();
    let lastSource: TimestampSource | '—' = '—';
    let lastTimestamp = -Infinity;
    let poseDetected = false;

    this.stopLoop = startFrameLoop(video, (frame) => {
      if (frame.presentedFrames !== null) {
        dropped.update(frame.presentedFrames);
        cameraFps.update(performance.now(), frame.presentedFrames);
      }
      lastSource = frame.source;
      // MediaPipe exige des horodatages strictement croissants.
      const ts = Math.max(frame.time, lastTimestamp + 0.001);
      lastTimestamp = ts;
      const t0 = performance.now();
      const result = detector.landmarker.detectForVideo(video, ts);
      const t1 = performance.now();
      detectionMs.push(t1 - t0);
      detectionFps.tick(t1);
      const pose = result.landmarks[0];
      poseDetected = !!pose && pose.length > 0;
      this.opts.onPose?.({ frame, landmarks: pose, videoWidth: video.videoWidth, videoHeight: video.videoHeight });
      overlay.draw(pose);
      this.opts.drawExtra?.(overlay.context, rect, { width: video.videoWidth, height: video.videoHeight });
    });

    const refresh = (): void => {
      const now = performance.now();
      const s = this.stream ? currentSettings(this.stream) : {};
      this.panel.update({
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        requestedResolution: resolutionChoice.forced
          ? `${resolutionChoice.resolution.width} × ${resolutionChoice.resolution.height}`
          : null,
        trackFrameRate: typeof s.frameRate === 'number' ? s.frameRate : null,
        cameraFps: cameraFps.fps(now),
        detectionFps: detectionFps.fps(now),
        detectionMsMean: detectionMs.mean,
        detectionMsMax: detectionMs.max,
        droppedRatio: dropped.droppedRatio,
        delegate: `${detector.delegate}${this.delegateChoice.forced ? ' (forcé)' : ''}`,
        power,
        timestampSource: lastSource,
        streamFit: classifyStreamFit(video.videoWidth, video.videoHeight, window.innerWidth, window.innerHeight),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        cameraPosition: this.cameraPositionValue,
        poseDetected,
      });
    };
    refresh();
    this.refreshTimer = window.setInterval(refresh, CONFIG.diagnostic.refreshMs);
    return true;
  }

  /** Arrête la boucle, la détection et la caméra. */
  stop(): void {
    this.stopLoop?.();
    this.stopLoop = null;
    window.clearInterval(this.refreshTimer);
    this.cleanups.splice(0).forEach((f) => f());
    stopCamera(this.stream);
    this.stream = null;
    this.detector?.landmarker.close();
    this.detector = null;
  }
}
