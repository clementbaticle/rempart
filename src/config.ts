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
    /**
     * Cadence demandée (i/s). PARAMÈTRE DE MESURE : 60 i/s validés sur l'iPad 9e génération
     * (≈ 54 i/s de détection, précision ≈ 18 ms). Garder la même valeur pendant toute une étude.
     */
    idealFrameRate: 60,
    /** Cadences pouvant être forcées par `?fps=<i/s>` dans l'adresse (diagnostic). */
    frameRatePresets: [30, 60],
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
    /** Temps laissé pour se mettre en garde avant la mesure (ms), sans rien enregistrer. */
    guardPrepareMs: 2000,
    /**
     * Garde valide : les deux mains au-dessus de ce point du buste
     * (0 = niveau des épaules, 1 = niveau du bassin).
     */
    guardMaxHandLevel: 0.5,
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
    /** Cage de handball réelle (section 4, point 1). */
    goal: {
      widthCm: 300,
      heightCm: 200,
      /** Écart toléré du rapport largeur / hauteur mesuré par rapport à 3 / 2 (proportion). */
      aspectTolerance: 0.25,
    },
    /** Grille de 12 zones à des positions réelles dans la cage (section 4, point 5). */
    grid: {
      /** Colonnes : 25 cm à l'intérieur de chaque poteau (± 125) et à 60 cm du centre (cm). */
      columnsCm: [-125, -60, 60, 125],
      /** Rangées : hauteur au-dessus du sol, de haut en bas (cm). */
      rowHeightsCm: [165, 100, 40],
      targetDiameterCm: 30,
    },
    /** Hauteur moyenne des chevilles au-dessus du sol (cm), pour placer le sol sous la joueuse. */
    ankleHeightCm: 8,
    /**
     * Rapport « visage → chevilles » / taille réelle, pour l'échelle px/cm (approximation :
     * le repère haut est le visage, pas le sommet du crâne).
     */
    faceToAnkleOverStature: 0.9,
    /** Écart de taille de la cage à l'image avec la calibration précédente déclenchant l'alerte. */
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
    guardPresenceMs: 150,
    foreperiodMinMs: 600,
    foreperiodMaxMs: 1500,
    /** Référence de position : moyenne sur cette durée avant l'apparition (ms). */
    baselineMs: 300,
    /** Référence glissante pour détecter un faux départ pendant l'avant-période (ms). */
    falseStartWindowMs: 500,
    /** Seuil de faux départ (proportion de la taille apparente), plus large que le seuil d'initiation. */
    falseStartThresholdRatio: 0.08,
    /** Nombre d'images consécutives au-delà du seuil pour un faux départ. */
    falseStartFrames: 2,
    /** Seuil d'initiation (proportion de la taille apparente). */
    initiationThresholdRatio: 0.05,
    /** Délai de réponse (ms). */
    responseMs: 2000,
    /** Fenêtre no-go (ms), utilisée à l'étape 4. */
    noGoWindowMs: 1500,
    /** Initiation plus précoce que ce délai après l'apparition = anticipation (ms). */
    anticipationMs: 150,
    /** Durée du retour visuel (ms), comprise dans l'intervalle. */
    feedbackMs: 300,
    /** Intervalle entre la réponse et l'essai suivant (ms), retour visuel compris ; puis retour en garde. */
    itiMs: 300,
    /** Multiplicateur du rayon de cible pour la détection de touche. */
    hitToleranceFactor: 1,
    /** Bornes des TR retenus dans les statistiques (section 9). */
    validRtMinMs: 150,
    validRtMaxMs: 1500,
    /** Bloc Classique : nombre de passages par zone (12 zones × 3 = 36), répétitions consécutives maximales. */
    classicRepeatsPerZone: 3,
    maxSameZoneInARow: 2,
  },

  player: {
    minHeightCm: 120,
    maxHeightCm: 220,
  },

  storageKeys: {
    cameraPosition: 'rempart.cameraPosition',
    goalCorners: 'rempart.goalCorners',
  },
} as const;

export type Config = typeof CONFIG;
