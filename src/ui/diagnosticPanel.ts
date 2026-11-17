import { CONFIG } from '../config';
import {
  CAMERA_POSITIONS,
  fpsLevel,
  type CameraPosition,
  type StreamFit,
} from '../camera/diagnostics';
import type { TimestampSource } from '../pose/frameLoop';
import type { PowerState } from './power';

function powerLabel(p: PowerState | null): string {
  if (!p) return 'inconnue';
  const pct = `${Math.round(p.level * 100)} %`;
  return p.charging ? `secteur (${pct})` : `batterie (${pct})`;
}

export interface DiagnosticData {
  videoWidth: number;
  videoHeight: number;
  /** Résolution forcée par `?res=` (null si résolution par défaut). */
  requestedResolution: string | null;
  /** Cadence forcée par `?fps=` (null si cadence par défaut). */
  requestedFrameRate: number | null;
  /** Réglage de fréquence annoncé par la piste (peut être absent). */
  trackFrameRate: number | null;
  /** i/s fournies par la caméra (null si non mesurable : pas de rVFC). */
  cameraFps: number | null;
  detectionFps: number;
  /** Temps de calcul d'une détection (ms), moyenne et max sur les 30 dernières. */
  detectionMsMean: number | null;
  detectionMsMax: number | null;
  droppedRatio: number;
  delegate: string;
  power: PowerState | null;
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
      [
        'Résolution vidéo',
        `${d.videoWidth} × ${d.videoHeight}${d.requestedResolution ? ` (forcée ${d.requestedResolution})` : ''}`,
      ],
      ['Flux', FIT_LABEL[d.streamFit], d.streamFit === 'tourné' ? 'warn' : undefined],
      ['Écran', `${d.screenWidth} × ${d.screenHeight}`],
      [
        'i/s caméra',
        `${d.cameraFps === null ? '—' : d.cameraFps.toFixed(1)}${d.trackFrameRate ? ` (annoncé ${d.trackFrameRate.toFixed(0)})` : ''}` +
          (d.requestedFrameRate ? ` — demandé ${d.requestedFrameRate}` : ''),
      ],
      [
        'i/s détection',
        `${d.detectionFps.toFixed(1)} — ${level}`,
        level === 'bon' ? 'ok' : level === 'limite' ? 'warn' : 'err',
      ],
      [
        'Calcul / image',
        d.detectionMsMean === null
          ? '—'
          : `${d.detectionMsMean.toFixed(0)} ms (max ${d.detectionMsMax!.toFixed(0)})`,
        // Au-delà de 40 ms par image, 25 i/s sont hors de portée.
        d.detectionMsMean !== null && d.detectionMsMean > 1000 / targetFps ? 'err' : undefined,
      ],
      ['Images non traitées', `${(d.droppedRatio * 100).toFixed(1)} %`],
      ['Délégué', d.delegate],
      ['Alimentation', powerLabel(d.power), d.power && !d.power.charging ? 'warn' : undefined],
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
