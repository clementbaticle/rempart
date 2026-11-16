import { CONFIG } from '../config';
import { currentSettings, startCamera, stopCamera } from '../camera/camera';
import {
  CameraFpsEstimator,
  DroppedFrameCounter,
  FpsCounter,
  RollingStats,
  classifyStreamFit,
  parseCameraPosition,
  type CameraPosition,
} from '../camera/diagnostics';
import { fitContain } from '../pose/landmarks';
import { createPoseDetector, type PoseDetector } from '../pose/poseDetector';
import { startFrameLoop, type TimestampSource } from '../pose/frameLoop';
import { SkeletonOverlay } from './overlay';
import { DiagnosticPanel } from './diagnosticPanel';
import { keepScreenAwake, requestFullscreen } from './screen';
import { watchPower, type PowerState } from './power';
import { resolveDelegates } from '../pose/delegateChoice';

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

/** Écran d'exercice (fond neutre) : vidéo en miroir, squelette, diagnostic. */
export async function renderLiveView(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <main class="live">
      <div class="live__stage">
        <video class="live__video" autoplay muted playsinline></video>
        <canvas class="live__overlay"></canvas>
      </div>
      <div class="live__status">Ouverture de la caméra…</div>
      <button class="live__diag-toggle" type="button" aria-label="Afficher ou masquer le diagnostic">i</button>
    </main>`;
  const stage = root.querySelector<HTMLElement>('.live__stage')!;
  const video = root.querySelector<HTMLVideoElement>('video')!;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const status = root.querySelector<HTMLElement>('.live__status')!;

  void requestFullscreen();
  void keepScreenAwake();

  let cameraPosition = readCameraPosition();
  const panel = new DiagnosticPanel(cameraPosition, (p) => {
    cameraPosition = p;
    saveCameraPosition(p);
  });
  root.querySelector('.live')!.append(panel.element);
  root.querySelector('.live__diag-toggle')!.addEventListener('click', () => panel.toggle());

  let power: PowerState | null = null;
  void watchPower((s) => {
    power = s;
  });

  const delegateChoice = resolveDelegates(window.location.search, CONFIG.pose.delegates);
  let stream: MediaStream | null = null;
  let detector: PoseDetector;
  try {
    const cam = await startCamera(video);
    stream = cam.stream;
    status.textContent = 'Chargement du modèle de détection…';
    detector = await createPoseDetector(delegateChoice.delegates);
    status.hidden = true;
  } catch (err) {
    stopCamera(stream);
    status.textContent = err instanceof Error ? err.message : String(err);
    status.classList.add('is-error');
    return;
  }

  const overlay = new SkeletonOverlay(canvas);
  const layout = (): void => {
    const box = stage.getBoundingClientRect();
    overlay.resize(box.width, box.height, fitContain(video.videoWidth, video.videoHeight, box.width, box.height));
  };
  layout();
  window.addEventListener('resize', layout);
  video.addEventListener('resize', layout); // dimensions du flux modifiées (rotation)

  const cameraFps = new CameraFpsEstimator(CONFIG.quality.fpsWindowMs);
  const detectionFps = new FpsCounter(CONFIG.quality.fpsWindowMs);
  const detectionMs = new RollingStats(30);
  const dropped = new DroppedFrameCounter();
  let lastSource: TimestampSource | '—' = '—';
  let lastTimestamp = -Infinity;
  let poseDetected = false;

  startFrameLoop(video, (frame) => {
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
    overlay.draw(pose);
  });

  const refresh = (): void => {
    const now = performance.now();
    const s = stream ? currentSettings(stream) : {};
    panel.update({
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      trackFrameRate: typeof s.frameRate === 'number' ? s.frameRate : null,
      cameraFps: cameraFps.fps(now),
      detectionFps: detectionFps.fps(now),
      detectionMsMean: detectionMs.mean,
      detectionMsMax: detectionMs.max,
      droppedRatio: dropped.droppedRatio,
      delegate: `${detector.delegate}${delegateChoice.forced ? ' (forcé)' : ''}`,
      power,
      timestampSource: lastSource,
      streamFit: classifyStreamFit(video.videoWidth, video.videoHeight, window.innerWidth, window.innerHeight),
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      cameraPosition,
      poseDetected,
    });
  };
  refresh();
  window.setInterval(refresh, CONFIG.diagnostic.refreshMs);
}
