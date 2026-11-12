/**
 * Logique pure de diagnostic : fréquence d'images, images perdues, orientation du flux,
 * position de la caméra. Aucune dépendance au DOM (testée par Vitest).
 */

/** Compteur d'images par seconde sur une fenêtre glissante. */
export class FpsCounter {
  private readonly stamps: number[] = [];

  constructor(private readonly windowMs: number) {
    if (!(windowMs > 0)) throw new Error('windowMs doit être > 0');
  }

  /** Enregistre une image à l'instant `t` (ms, horloge monotone). */
  tick(t: number): void {
    this.stamps.push(t);
    this.prune(t);
  }

  /** i/s mesurées sur la fenêtre se terminant à `now` ; 0 si moins de 2 images. */
  fps(now: number): number {
    this.prune(now);
    const n = this.stamps.length;
    if (n < 2) return 0;
    const first = this.stamps[0]!;
    const last = this.stamps[n - 1]!;
    const span = last - first;
    return span > 0 ? ((n - 1) * 1000) / span : 0;
  }

  reset(): void {
    this.stamps.length = 0;
  }

  private prune(now: number): void {
    const limit = now - this.windowMs;
    while (this.stamps.length > 0 && this.stamps[0]! < limit) this.stamps.shift();
  }
}

/**
 * Compte les images perdues à partir du compteur `presentedFrames`
 * fourni par requestVideoFrameCallback (un saut > 1 = images non traitées).
 */
export class DroppedFrameCounter {
  private last: number | null = null;
  private dropped = 0;
  private seen = 0;

  update(presentedFrames: number): void {
    if (this.last !== null && presentedFrames > this.last) {
      this.dropped += presentedFrames - this.last - 1;
    }
    this.last = presentedFrames;
    this.seen += 1;
  }

  get droppedFrames(): number {
    return this.dropped;
  }

  get processedFrames(): number {
    return this.seen;
  }

  /** Proportion d'images perdues (0 à 1). */
  get droppedRatio(): number {
    const total = this.dropped + this.seen;
    return total > 0 ? this.dropped / total : 0;
  }

  reset(): void {
    this.last = null;
    this.dropped = 0;
    this.seen = 0;
  }
}

export type Orientation = 'paysage' | 'portrait' | 'carré';

export function orientationOf(width: number, height: number): Orientation {
  if (width > height) return 'paysage';
  if (height > width) return 'portrait';
  return 'carré';
}

/**
 * Compare l'orientation du flux vidéo à celle de l'écran.
 * `concordant` : le flux est dans le même sens que l'écran (cas attendu).
 * `tourné` : le flux est perpendiculaire à l'écran ; l'image reste affichée
 *  entière (letterbox), mais le cadrage sera moins bon.
 */
export type StreamFit = 'concordant' | 'tourné' | 'indéterminé';

export function classifyStreamFit(
  videoWidth: number,
  videoHeight: number,
  screenWidth: number,
  screenHeight: number,
): StreamFit {
  if (videoWidth <= 0 || videoHeight <= 0 || screenWidth <= 0 || screenHeight <= 0) {
    return 'indéterminé';
  }
  const v = orientationOf(videoWidth, videoHeight);
  const s = orientationOf(screenWidth, screenHeight);
  if (v === 'carré' || s === 'carré') return 'indéterminé';
  return v === s ? 'concordant' : 'tourné';
}

/**
 * Position de la caméra frontale quand l'iPad est en paysage.
 * Aucune API web ne la fournit : elle est déclarée par l'utilisateur
 * (panneau de diagnostic) et mémorisée sur l'appareil.
 */
export type CameraPosition = 'bord-long' | 'bord-court' | 'inconnue';

export const CAMERA_POSITIONS: readonly CameraPosition[] = ['bord-long', 'bord-court', 'inconnue'];

export function parseCameraPosition(value: string | null | undefined): CameraPosition {
  return CAMERA_POSITIONS.includes(value as CameraPosition) ? (value as CameraPosition) : 'inconnue';
}

/** Niveau de qualité de la détection (sections 2 et 9). */
export type FpsLevel = 'bon' | 'limite' | 'insuffisant';

export function fpsLevel(fps: number, targetFps: number, minFps: number): FpsLevel {
  if (fps >= targetFps) return 'bon';
  if (fps >= minFps) return 'limite';
  return 'insuffisant';
}
