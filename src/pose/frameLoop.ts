/**
 * Boucle image par image : une détection par nouvelle image vidéo.
 * Utilise requestVideoFrameCallback si disponible (section 5), sinon requestAnimationFrame.
 *
 * Étape 1 : la source d'horodatage n'est utilisée que pour le diagnostic ;
 * elle sera reprise telle quelle pour la mesure des essais (étape 3).
 */

/** Source de l'horodatage d'image (enregistrée avec chaque séance). */
export type TimestampSource = 'captureTime' | 'expectedDisplayTime' | 'raf';

export interface FrameInfo {
  /** Horodatage de l'image (ms, horloge de performance.now()). */
  time: number;
  source: TimestampSource;
  /** Compteur d'images présentées (rVFC uniquement). */
  presentedFrames: number | null;
}

/** Choisit l'horodatage le plus proche de la capture (logique pure). */
export function pickFrameTime(meta: {
  captureTime?: number;
  expectedDisplayTime: number;
}): { time: number; source: TimestampSource } {
  if (typeof meta.captureTime === 'number' && meta.captureTime > 0) {
    return { time: meta.captureTime, source: 'captureTime' };
  }
  return { time: meta.expectedDisplayTime, source: 'expectedDisplayTime' };
}

export function supportsVideoFrameCallback(video: HTMLVideoElement): boolean {
  return typeof (video as HTMLVideoElement & { requestVideoFrameCallback?: unknown })
    .requestVideoFrameCallback === 'function';
}

/** Lance la boucle ; renvoie une fonction d'arrêt. */
export function startFrameLoop(
  video: HTMLVideoElement,
  onFrame: (frame: FrameInfo) => void,
): () => void {
  let stopped = false;

  if (supportsVideoFrameCallback(video)) {
    let handle = 0;
    const step = (_now: number, meta: VideoFrameCallbackMetadata): void => {
      if (stopped) return;
      const { time, source } = pickFrameTime(meta);
      onFrame({ time, source, presentedFrames: meta.presentedFrames });
      handle = video.requestVideoFrameCallback(step);
    };
    handle = video.requestVideoFrameCallback(step);
    return () => {
      stopped = true;
      video.cancelVideoFrameCallback(handle);
    };
  }

  // Repli : une détection par rafraîchissement d'écran si l'image a changé.
  let raf = 0;
  let lastMediaTime = -1;
  const step = (now: number): void => {
    if (stopped) return;
    if (video.currentTime !== lastMediaTime) {
      lastMediaTime = video.currentTime;
      onFrame({ time: now, source: 'raf', presentedFrames: null });
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
