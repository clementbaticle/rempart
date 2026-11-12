import { CONFIG } from '../config';
import {
  CAMERA_POSITIONS,
  fpsLevel,
  type CameraPosition,
  type StreamFit,
} from '../camera/diagnostics';
import type { TimestampSource } from '../pose/frameLoop';

export interface DiagnosticData {
  videoWidth: number;
  videoHeight: number;
  /** Réglage de fréquence annoncé par la piste (peut être absent). */
  trackFrameRate: number | null;
  videoFps: number;
  detectionFps: number;
  droppedRatio: number;
  delegate: string;
  timestampSource: TimestampSource | '—';
  streamFit: StreamFit;
  screenWidth: number;
  screenHeight: number;
  cameraPosition: CameraPosition;
  poseDetected: boolean;
}

const POSITION_LABEL: Record<CameraPosition, string> = {
  'bord-long': 'bord long',
  'bord-court': 'bord court',
  inconnue: 'inconnue',
};

const FIT_LABEL: Record<StreamFit, string> = {
  concordant: 'concordant avec l’écran',
  tourné: 'tourné par rapport à l’écran',
  indéterminé: 'indéterminé',
};

/** Panneau de diagnostic affiché par-dessus l'écran d'exercice. */
export class DiagnosticPanel {
  readonly element: HTMLElement;
  private readonly body: HTMLElement;
  private readonly select: HTMLSelectElement;

  constructor(
    initialPosition: CameraPosition,
    private readonly onPositionChange: (p: CameraPosition) => void,
  ) {
    this.element = document.createElement('aside');
    this.element.className = 'diag';
    this.element.innerHTML = `
      <div class="diag__title">Diagnostic</div>
      <dl class="diag__body"></dl>
      <label class="diag__field">Caméra frontale (iPad en paysage)
        <select></select>
      </label>`;
    this.body = this.element.querySelector('.diag__body')!;
    this.select = this.element.querySelector('select')!;
    for (const p of CAMERA_POSITIONS) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = POSITION_LABEL[p];
      this.select.append(opt);
    }
    this.select.value = initialPosition;
    this.select.addEventListener('change', () => {
      this.onPositionChange(this.select.value as CameraPosition);
    });
    if (!CONFIG.diagnostic.visibleByDefault) this.toggle(false);
  }

  toggle(force?: boolean): void {
    this.element.hidden = force === undefined ? !this.element.hidden : !force;
  }

  update(d: DiagnosticData): void {
    const { targetFps, minFps } = CONFIG.quality;
    const level = fpsLevel(d.detectionFps, targetFps, minFps);
    const rows: [string, string, string?][] = [
      ['Résolution vidéo', `${d.videoWidth} × ${d.videoHeight}`],
      ['Flux', FIT_LABEL[d.streamFit], d.streamFit === 'tourné' ? 'warn' : undefined],
      ['Écran', `${d.screenWidth} × ${d.screenHeight}`],
      ['i/s vidéo', `${d.videoFps.toFixed(1)}${d.trackFrameRate ? ` (annoncé ${d.trackFrameRate.toFixed(0)})` : ''}`],
      [
        'i/s détection',
        `${d.detectionFps.toFixed(1)} — ${level}`,
        level === 'bon' ? 'ok' : level === 'limite' ? 'warn' : 'err',
      ],
      ['Images perdues', `${(d.droppedRatio * 100).toFixed(1)} %`],
      ['Délégué', d.delegate],
      ['Horodatage', d.timestampSource],
      [
        'Position caméra',
        `${POSITION_LABEL[d.cameraPosition]} (${d.cameraPosition === 'inconnue' ? 'à déclarer' : 'déclarée'})`,
        d.cameraPosition === 'inconnue' ? 'warn' : undefined,
      ],
      ['Joueuse détectée', d.poseDetected ? 'oui' : 'non', d.poseDetected ? 'ok' : 'warn'],
    ];
    this.body.replaceChildren(
      ...rows.flatMap(([k, v, cls]) => {
        const dt = document.createElement('dt');
        dt.textContent = k;
        const dd = document.createElement('dd');
        dd.textContent = v;
        if (cls) dd.className = `is-${cls}`;
        return [dt, dd];
      }),
    );
  }
}
