import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config';

export type Delegate = (typeof CONFIG.pose.delegates)[number];

export interface PoseDetector {
  landmarker: PoseLandmarker;
  delegate: Delegate;
}

/** Résout un chemin relatif à la base de l'app (GitHub Pages : /<dépôt>/). */
function assetUrl(path: string): string {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href;
}

/**
 * Charge PoseLandmarker lite (mode VIDEO) à partir des fichiers auto-hébergés,
 * en essayant le GPU puis le CPU.
 */
export async function createPoseDetector(
  delegates: readonly Delegate[] = CONFIG.pose.delegates,
): Promise<PoseDetector> {
  const fileset = await FilesetResolver.forVisionTasks(assetUrl(CONFIG.pose.wasmPath), false);
  const p = CONFIG.pose;
  let lastError: unknown = null;
  for (const delegate of delegates) {
    try {
      const landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: assetUrl(p.modelPath), delegate },
        runningMode: 'VIDEO',
        numPoses: p.numPoses,
        minPoseDetectionConfidence: p.minPoseDetectionConfidence,
        minPosePresenceConfidence: p.minPosePresenceConfidence,
        minTrackingConfidence: p.minTrackingConfidence,
        outputSegmentationMasks: false,
      });
      return { landmarker, delegate };
    } catch (err) {
      console.warn(`[pose] délégué ${delegate} indisponible`, err);
      lastError = err;
    }
  }
  throw new Error(`Chargement du modèle de pose impossible : ${String(lastError)}`);
}

export const POSE_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS;
