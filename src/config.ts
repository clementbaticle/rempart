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
    /**
     * Résolutions pouvant être forcées par `?res=<largeur>` dans l'adresse (diagnostic).
     * Le modèle réduit l'image en interne : une résolution plus basse peut accélérer le calcul.
     */
    resolutionPresets: {
      '640': { width: 640, height: 480 },
      '960': { width: 960, height: 540 },
      '1280': { width: 1280, height: 720 },
    },
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

  calibration: {
    /** Durée d'immobilité exigée pour chaque posture (ms). */
    holdMs: 2000,
    /** Durée pendant laquelle le cadrage doit rester correct avant de passer à la garde (ms). */
    framingOkMs: 1000,
    /**
     * Tolérance d'immobilité : écart maximal de chaque repère à sa position moyenne,
     * en proportion de la taille apparente (indépendant de la distance).
     */
    stabilityTolerance: 0.04,
    /** Taille apparente utilisée pour la tolérance avant la mesure de garde (proportion de la hauteur d'image). */
    defaultHeightRatio: 0.6,
    framing: {
      /** Marge minimale entre les repères et les bords de l'image (proportion). */
      edgeMargin: 0.03,
      /** Taille apparente minimale / maximale (proportion de la hauteur d'image). */
      minHeightRatio: 0.35,
      maxHeightRatio: 0.85,
      /** Le centre du corps doit rester dans cette bande horizontale (proportions). */
      centerMin: 0.3,
      centerMax: 0.7,
    },
    postures: {
      /** Envergure : poignets à l'horizontale des épaules, à ± cette proportion de la taille. */
      armsLevelTolerance: 0.15,
      /** Pas latéral : déplacement minimal du bassin par rapport à la garde (proportion de la taille). */
      minStepRatio: 0.1,
    },
    grid: {
      /** Colonnes latérales à cette fraction de la portée latérale moyenne. */
      lateralFraction: 0.9,
      /** Rangée haute à cette fraction de la portée bras levés (mesurée depuis les chevilles). */
      topFraction: 0.9,
      /** Diamètre des cibles en proportion de la taille apparente. */
      targetDiameterRatio: 0.18,
    },
    /**
     * Rapport « visage → chevilles » / taille réelle, pour l'échelle px/cm (approximation :
     * le repère haut est le visage, pas le sommet du crâne).
     */
    faceToAnkleOverStature: 0.9,
    /** Écart de taille apparente avec la calibration précédente déclenchant l'alerte. */
    distanceAlertRatio: 0.1,
  },

  /**
   * Déroulé d'un essai (section 5). PARAMÈTRES DE MESURE : toute modification doit être
   * signalée et notée dans le journal des tests.
   */
  trial: {
    /** Zone de garde : rayon autour de la position de garde de chaque main (proportion de la taille apparente). */
    guardRadiusRatio: 0.12,
    /** Présence des deux mains dans la zone de garde exigée avant l'avant-période (ms). */
    guardPresenceMs: 300,
    foreperiodMinMs: 800,
    foreperiodMaxMs: 2000,
    /** Référence de position : moyenne sur cette durée avant l'apparition (ms). */
    baselineMs: 300,
    /** Référence glissante pour détecter un faux départ pendant l'avant-période (ms). */
    falseStartWindowMs: 500,
    /** Seuil d'initiation (proportion de la taille apparente). */
    initiationThresholdRatio: 0.05,
    /** Délai de réponse (ms). */
    responseMs: 2000,
    /** Fenêtre no-go (ms), utilisée à l'étape 4. */
    noGoWindowMs: 1500,
    /** Initiation plus précoce que ce délai après l'apparition = anticipation (ms). */
    anticipationMs: 150,
    /** Durée du retour visuel (ms). */
    feedbackMs: 300,
    /** Intervalle avant l'essai suivant (ms), puis retour en garde. */
    itiMs: 1000,
    /** Multiplicateur du rayon de cible pour la détection de touche. */
    hitToleranceFactor: 1,
    /** Bornes des TR retenus dans les statistiques (section 9). */
    validRtMinMs: 150,
    validRtMaxMs: 1500,
    /** Bloc Classique : nombre de passages par zone, répétitions consécutives maximales. */
    classicRepeatsPerZone: 4,
    maxSameZoneInARow: 2,
  },

  player: {
    minHeightCm: 120,
    maxHeightCm: 220,
  },

  storageKeys: {
    cameraPosition: 'rempart.cameraPosition',
  },
} as const;

export type Config = typeof CONFIG;
