import { CONFIG } from '../config';

export interface CameraInfo {
  stream: MediaStream;
  /** Réglages réellement appliqués par le navigateur. */
  settings: MediaTrackSettings;
  label: string;
}

export class CameraError extends Error {}

/** Ouvre la caméra frontale et l'attache à l'élément vidéo. */
export async function startCamera(
  video: HTMLVideoElement,
  resolution: { width: number; height: number } = {
    width: CONFIG.camera.idealWidth,
    height: CONFIG.camera.idealHeight,
  },
  frameRate: number = CONFIG.camera.idealFrameRate,
): Promise<CameraInfo> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError(
      'Caméra indisponible : ouvrir l’app en HTTPS (version déployée) dans Safari.',
    );
  }
  const { facingMode } = CONFIG.camera;
  const { width: idealWidth, height: idealHeight } = resolution;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode,
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
        frameRate: { ideal: frameRate },
      },
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError') {
      throw new CameraError('Accès à la caméra refusé. Autoriser la caméra dans les réglages de Safari.');
    }
    throw new CameraError(`Impossible d’ouvrir la caméra (${name || String(err)}).`);
  }

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  await waitForDimensions(video);

  const track = stream.getVideoTracks()[0];
  return { stream, settings: track?.getSettings() ?? {}, label: track?.label ?? '' };
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Lit les réglages courants (ils peuvent changer après une rotation). */
export function currentSettings(stream: MediaStream): MediaTrackSettings {
  return stream.getVideoTracks()[0]?.getSettings() ?? {};
}

function waitForDimensions(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
  });
}
