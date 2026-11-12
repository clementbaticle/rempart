/**
 * Fichier de configuration unique : tous les paramètres réglables de l'app.
 * Toute modification d'un paramètre de mesure doit être signalée (validité scientifique).
 */
export const CONFIG = {
  camera: {
    facingMode: 'user' as const,
    /** Résolution demandée ; la résolution réelle est lue sur la piste et affichée. */
    idealWidth: 1280,
    idealHeight: 720,
    idealFrameRate: 30,
  },

  pose: {
    /** Chemins relatifs à la base de l'app (fonctionnement hors ligne). */
    modelPath: 'models/pose_landmarker_lite.task',
    wasmPath: 'wasm',
    /** Ordre d'essai des délégués : GPU d'abord, repli CPU. */
    delegates: ['GPU', 'CPU'] as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    /** Un repère dont la visibilité est sous ce seuil est ignoré (section 3). */
    visibilityThreshold: 0.5,
  },

  quality: {
    /** Fenêtre glissante de calcul des i/s (ms). */
    fpsWindowMs: 1000,
    /** Objectif de fréquence de détection (section 2). */
    targetFps: 25,
    /** En dessous : séance signalée « qualité insuffisante » (section 9). */
    minFps: 20,
  },

  diagnostic: {
    /** Fréquence de rafraîchissement du panneau (ms). */
    refreshMs: 250,
    /** Panneau visible au démarrage. */
    visibleByDefault: true,
  },

  storageKeys: {
    cameraPosition: 'rempart.cameraPosition',
  },
} as const;

export type Config = typeof CONFIG;
