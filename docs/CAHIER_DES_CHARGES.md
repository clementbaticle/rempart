# Rempart — Cahier des charges technique (v1)

Application d'entraînement et d'évaluation perceptivo-cognitive pour les gardiennes du TMVH (Toulon Métropole Var Handball).
Double finalité : **outil utile aux joueuses** et **instrument de mesure** pour une étude scientifique (mémoire de M1, plan expérimental en cas uniques).

---

## 1. Contexte et objectifs

- Utilisatrices : 5 gardiennes (2 pro, 1 centre de formation, 1-2 réserve), puis joueuses de champ (groupe de comparaison).
- Usage : séances de 15 min, 2 fois par semaine, quand la joueuse est « off » ; tablette sur trépied face à la gardienne, à 2-3 m, au gymnase.
- Principe : la gardienne se voit à l'écran (effet miroir) dans une **cage virtuelle de 9 zones** ; des cibles apparaissent ; elle les « touche » avec la main ou le pied, détectés par la caméra.
- Exigence scientifique : chaque essai est horodaté et enregistré en données brutes ; un **mode Test** rejoue toujours exactement la même séquence.

## 2. Contraintes matérielles et techniques

| Élément | Choix |
| --- | --- |
| Appareil | iPad (Safari / app installée sur l'écran d'accueil), orientation paysage, trépied. Modèle exact : *à compléter* |
| Socle | Vite + TypeScript, sans framework UI lourd |
| PWA | `vite-plugin-pwa` : installable, hors ligne (modèle MediaPipe mis en cache) |
| Caméra | `getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 } })` ; nécessite HTTPS |
| Détection | `@mediapipe/tasks-vision`, **PoseLandmarker lite**, mode `VIDEO`, délégué GPU avec repli CPU ; fichier `.task` auto-hébergé dans `public/models/` |
| Stockage | IndexedDB (via `idb`) |
| Export | CSV (format long, un essai par ligne) + sauvegarde JSON complète (export / import) |
| Hébergement | GitHub Pages via GitHub Actions |
| Tests | Vitest pour toute la logique pure (générateur pseudo-aléatoire, séquences, détection de touche, scores, CSV) |
| Écran | Plein écran, maintien de l'écran allumé (Wake Lock API si disponible), verrouillage paysage si possible |

Point à vérifier dès l'étape 1 : position de la caméra frontale selon le modèle d'iPad (bord long ou bord court en paysage) et fréquence d'images réelle de la détection (objectif ≥ 25 i/s).

- L'app doit fonctionner **quelle que soit la position de la caméra frontale** (bord long ou bord court en paysage) : aucune hypothèse codée en dur sur l'orientation du flux vidéo.
- Un **panneau de diagnostic** affiche à l'écran : résolution vidéo réelle, i/s de la vidéo et de la détection, position de caméra détectée (bord long / bord court / inconnue).

## 3. Repères du corps utilisés

PoseLandmarker (33 points). Effecteurs :
- Main gauche : poignet 15, index 19 ; main droite : poignet 16, index 20 (on prend le point le plus avancé des deux).
- Pied gauche : cheville 27, pointe 31 ; pied droit : cheville 28, pointe 32.
- Seuil de visibilité : 0,5 (paramétrable). Un repère sous le seuil est ignoré.
- L'image est affichée en miroir ; les coordonnées sont converties en conséquence (la « main droite » à l'écran doit être la main droite réelle de la joueuse).

## 4. Calibration (à chaque séance)

1. **Cadrage** : la joueuse doit être entièrement visible (tête et pieds). Indicateur vert/rouge et consignes de recul.
2. **Posture de base** (2 s, immobile, position de garde) : mesure de la hauteur (tête → chevilles), largeur d'épaules, position du bassin.
3. **Envergure** (2 s, bras écartés) : portée latérale.
4. Calcul de la **grille 3 × 3** proportionnée à la joueuse : rangée haute = portée bras levés, rangée basse = niveau chevilles, colonnes latérales = envergure + un pas (facteur paramétrable). Cibles de taille constante en proportion de la taille de la joueuse.
5. Sauvegarde de la calibration (horodatée) et rappel de la précédente pour vérifier une distance comparable (écart de taille apparente > 10 % → alerte « trépied pas à la même distance »).

## 5. Déroulé d'un essai (cœur scientifique)

1. **Position de départ** : l'essai ne commence que si les deux poignets sont dans la « zone de garde » (devant le buste) et stables 300 ms.
2. **Avant-période aléatoire** : 800 à 2 000 ms (uniforme), pour empêcher d'anticiper le moment d'apparition.
3. **Apparition du stimulus** : l'horodatage d'apparition est pris dans le `requestAnimationFrame` où la cible est dessinée (`performance.now()`).
4. **Détection**, image par image (`requestVideoFrameCallback` ; enregistrer `metadata.captureTime` si disponible, sinon `expectedDisplayTime`, et noter quelle source a été utilisée) :
   - **Initiation** : première image où l'effecteur quitte la zone de garde → *temps de réaction* (TR).
   - **Touche** : première image où un effecteur entre dans la zone cible → *temps total* ; *temps de mouvement* = total − TR.
5. **Issue** de l'essai : `hit` (bonne cible, bon effecteur), `wrong_effector`, `wrong_zone`, `miss` (délai dépassé), `commission` (mouvement sur un no-go), `correct_rejection` (no-go respecté), `anticipation` (initiation < 150 ms après le stimulus).
6. **Retour** à la joueuse : visuel bref (flash vert / rouge) et son facultatif, **après** la réponse uniquement.
7. Intervalle avant l'essai suivant : 1 000 ms + retour en position de garde.

Délais par défaut (paramétrables) : réponse 2 000 ms ; fenêtre no-go 1 500 ms.

## 6. Modes de jeu (v1)

| Mode | Règle | Processus visé |
| --- | --- | --- |
| **Classique** | Une cible verte dans une des 9 zones ; toucher avec n'importe quel effecteur (rangée basse : pied ou main) | Temps de réaction de choix |
| **Go / no-go** | Vert = toucher ; rouge = ne pas bouger. Proportion 70 % go / 30 % no-go | Inhibition (anti-feinte) |
| **Bon segment** | Couleur + symbole de la cible = effecteur imposé : orange « G » = main gauche, magenta « D » = main droite, blanc + icône de pied = pied (côté de la cible) — voir section 10 | Choix de réponse, coordination |

Prévu en v2 : leurre (cible qui glisse vers une autre zone en 100-200 ms), double cible, plots couleur, lecture de tir vidéo, scan périphérique.

## 7. Mode Test (mesure) et mode Entraînement (jeu)

### Mode Test — séquence figée
- Générateur pseudo-aléatoire à graine (ex. mulberry32) ; **graine et version de la batterie enregistrées** ; même séquence à chaque passage.
- Batterie v1 (≈ 7-8 min) :
  - Familiarisation : 6 essais classiques (non analysés).
  - Bloc 1 Classique : 36 essais (9 zones × 4, ordre contrebalancé, pas plus de 2 fois la même zone de suite).
  - Bloc 2 Go / no-go : 40 essais (28 go, 12 no-go).
  - Bloc 3 Bon segment : 36 essais.
  - Pause de 30 s entre les blocs.
- Aucun ajustement de difficulté ; pas de classement affiché pendant le test.

### Mode Entraînement — progression
- Mêmes jeux, séances de ~15 min, choix de l'entraîneur ou programme préréglé.
- Difficulté adaptative par escalier (2 réussites → plus dur, 1 échec → plus facile) sur : durée d'affichage de la cible, délai de réponse, proportion de no-go.
- Score, record personnel, série de séances, classement du groupe (désactivable).

## 8. Modèle de données

- `players` : id pseudonyme (G1…G5, C1…), poste, catégorie (pro / CF / réserve / champ), latéralité, actif.
- `sessions` : id, player_id, date-heure, mode (test / train), version de batterie, graine, appareil (user agent, dimensions vidéo), i/s moyen, % images perdues, source de l'horodatage, calibration_id, notes.
- `calibrations` : id, player_id, date, mesures (taille apparente, épaules, envergure), grille calculée.
- `trials` : session_id, bloc, n° d'essai, mode, zone (1-9), stimulus (couleur / type), go ou no-go, effecteur attendu, effecteur utilisé, avant-période (ms), t_stimulus, t_initiation, t_touche, TR (ms), temps de mouvement (ms), temps total (ms), issue, niveau de difficulté, qualité (visibilité moyenne, images perdues pendant l'essai).

Export CSV : un fichier `trials` en format long avec les colonnes de session répétées (prêt pour R / Python), plus un résumé par séance (TR médian, écart interquartile, % réussite, % commissions, % anticipations).

## 9. Qualité des mesures

- Afficher et enregistrer la fréquence réelle et les images perdues ; une séance sous 20 i/s est signalée « qualité insuffisante ».
- Le décalage caméra → détection est constant pour un même iPad : **toujours tester sur le même appareil**, même distance, même salle. Les résultats servent à comparer la joueuse à elle-même, pas à des normes publiées.
- Statistique par séance : **médiane** du TR (robuste), essais hors 150-1 500 ms exclus du calcul et comptés.
- Étude de fiabilité prévue : deux passages du mode Test dans la même séance → CCI, erreur type de mesure, plus petit changement détectable.

## 10. Interface

- Pensée pour être lue à 3 m : cibles et consignes très grandes, contrastes forts, peu de texte pendant le jeu.
- **Couleurs du TMVH** (extraites du logo) : bleu `#04A5DF`, jaune `#FBD427`. Toutes les couleurs de l'interface sont regroupées dans **un seul fichier de thème**.
- **Logo** : PNG à fond transparent dans `public/brand/` ; sert pour l'icône de l'app et l'écran d'accueil.
- **Règles de couleurs** :
  - Les couleurs TMVH servent **uniquement** aux menus, à l'accueil et aux résultats. **Pendant les exercices**, le fond est sombre et neutre, sans aucune couleur du club, pour ne pas créer de confusion avec les cibles.
  - Les couleurs des cibles sont **fixes, indépendantes du thème**, et toujours accompagnées d'un symbole (lisibles en cas de daltonisme) :

    | Cible | Couleur | Symbole |
    | --- | --- | --- |
    | Go | vert | ● |
    | No-go | rouge | ✕ |
    | Main gauche | orange | lettre G |
    | Main droite | magenta | lettre D |
    | Pied | blanc | icône de pied |

  - Ces couleurs remplacent le bleu, le jaune et le violet prévus au départ pour le mode Bon segment (section 6).
- Écrans : Accueil (choix joueuse) → Calibration → Choix du mode → Jeu / Test → Résultats de la séance → Historique joueuse → Réglages / Export (protégé par un code staff).
- Entièrement en français.

## 11. Confidentialité

- Aucune image ni vidéo enregistrée ou envoyée : la détection se fait sur l'iPad.
- Joueuses identifiées par pseudonyme ; la table de correspondance nom ↔ pseudonyme reste hors de l'app.
- Bouton de suppression de toutes les données d'une joueuse.

## 12. Étapes de développement (chacune validée avant la suivante)

1. **Socle** : projet Vite + TS + PWA, caméra en miroir, squelette MediaPipe dessiné par-dessus, compteur d'i/s. Déploiement GitHub Pages. → *Test sur l'iPad.*
2. **Calibration et grille** : cadrage, posture, envergure, grille 3 × 3 affichée.
3. **Mode Classique** : boucle d'essai complète (position de départ, avant-période, horodatages, issues), stockage IndexedDB.
4. **Go / no-go et Bon segment**, mode Test à graine, écran de résultats, export CSV / JSON.
5. **Habillage** (couleurs TMVH, sons, profils), mode Entraînement adaptatif. → *Test au gymnase et étude de fiabilité.*
