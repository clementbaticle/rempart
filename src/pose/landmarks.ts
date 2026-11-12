/**
 * Logique pure des repères du corps (section 3) : indices des effecteurs,
 * filtre de visibilité, conversion miroir et passage en coordonnées écran.
 */

/** Repère normalisé (0-1) tel que fourni par PoseLandmarker. */
export interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Indices PoseLandmarker (33 points). Les côtés sont anatomiques (ceux de la joueuse). */
export const LANDMARK = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftIndex: 19,
  rightIndex: 20,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export type Effector = 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot';

/** Points composant chaque effecteur (section 3). */
export const EFFECTOR_POINTS: Readonly<Record<Effector, readonly number[]>> = {
  leftHand: [LANDMARK.leftWrist, LANDMARK.leftIndex],
  rightHand: [LANDMARK.rightWrist, LANDMARK.rightIndex],
  leftFoot: [LANDMARK.leftAnkle, LANDMARK.leftFootIndex],
  rightFoot: [LANDMARK.rightAnkle, LANDMARK.rightFootIndex],
};

export function isVisible(lm: Landmark | undefined, threshold: number): lm is Landmark {
  if (!lm) return false;
  // Absence de visibilité = considéré visible (certains modèles ne la fournissent pas).
  return lm.visibility === undefined || lm.visibility >= threshold;
}

/**
 * Conversion miroir : l'image est affichée retournée horizontalement,
 * la main droite réelle de la joueuse apparaît donc à droite de l'écran.
 */
export function mirrorX(lm: Landmark): Landmark {
  return { ...lm, x: 1 - lm.x };
}

/** Rectangle d'affichage de la vidéo dans son conteneur (pixels). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rectangle occupé par une vidéo affichée en « contain » (image entière, sans recadrage),
 * quelle que soit l'orientation du flux.
 */
export function fitContain(
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
): Rect {
  if (videoWidth <= 0 || videoHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(boxWidth / videoWidth, boxHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}

/** Position écran (pixels) d'un repère normalisé, avec miroir optionnel. */
export function toScreen(lm: Landmark, rect: Rect, mirrored: boolean): { x: number; y: number } {
  const nx = mirrored ? 1 - lm.x : lm.x;
  return { x: rect.x + nx * rect.width, y: rect.y + lm.y * rect.height };
}

/** Visibilité moyenne d'un ensemble de repères (indicateur de qualité). */
export function meanVisibility(landmarks: readonly Landmark[]): number {
  if (landmarks.length === 0) return 0;
  let sum = 0;
  for (const lm of landmarks) sum += lm.visibility ?? 1;
  return sum / landmarks.length;
}
