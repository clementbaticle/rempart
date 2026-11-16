import { CONFIG } from '../config';
import { EXERCISE } from '../theme';
import { isVisible, toScreen, type Landmark, type Rect } from '../pose/landmarks';
import { POSE_CONNECTIONS } from '../pose/poseDetector';

/** Canvas superposé à la vidéo ; dessine le squelette en miroir. */
export class SkeletonOverlay {
  private readonly ctx: CanvasRenderingContext2D;
  private rect: Rect = { x: 0, y: 0, width: 0, height: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  /** Adapte le canvas au conteneur (pixels physiques) et mémorise le rectangle vidéo. */
  resize(cssWidth: number, cssHeight: number, videoRect: Rect): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rect = videoRect;
  }

  /** Contexte 2D (pixels CSS) pour les dessins supplémentaires. */
  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(landmarks: readonly Landmark[] | undefined): void {
    this.clear();
    if (!landmarks || landmarks.length === 0) return;
    const { ctx, rect } = this;
    const threshold = CONFIG.pose.visibilityThreshold;
    const scale = Math.max(rect.height, 1) / 720;

    ctx.lineWidth = Math.max(2, 4 * scale);
    ctx.lineCap = 'round';
    ctx.strokeStyle = EXERCISE.skeleton;
    ctx.beginPath();
    for (const { start, end } of POSE_CONNECTIONS) {
      const a = landmarks[start];
      const b = landmarks[end];
      if (!isVisible(a, threshold) || !isVisible(b, threshold)) continue;
      const pa = toScreen(a, rect, true);
      const pb = toScreen(b, rect, true);
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    }
    ctx.stroke();

    ctx.fillStyle = EXERCISE.landmark;
    const r = Math.max(3, 6 * scale);
    for (const lm of landmarks) {
      if (!isVisible(lm, threshold)) continue;
      const p = toScreen(lm, rect, true);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
