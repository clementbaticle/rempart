# Rempart — Cahier des charges technique (v1)

Application d'entraînement et d'évaluation perceptivo-cognitive pour les gardiennes du TMVH (Toulon Métropole Var Handball).
Double finalité : **outil utile aux joueuses** et **instrument de mesure** pour une étude scientifique (mémoire de M1, plan expérimental en cas uniques).

---

## 1. Contexte et objectifs

- Utilisatrices : 5 gardiennes (2 pro, 1 centre de formation, 1-2 réserve), puis joueuses de champ (groupe de comparaison).
- Usage : séances de 15 min, 2 fois par semaine, quand la joueuse est « off » ; tablette sur trépied face à la gardienne, à 2-3 m, au gymnase.
- Principe : la gardienne se voit à l'écran (effet miroir) dans une **cage virtuelle de 12 zones** (4 colonnes × 3 rangées, aucune sur le corps de la joueuse) ; des cibles apparaissent ; elle les « touche » avec la main ou le pied, détectés par la caméra.
- Exigence scientifique : chaque essai est horodaté et enregistré en données brutes ; un **mode Test** rejoue toujours exactement la même séquence.

## 2. Contraintes matérielles et techniques

| Élément | Choix |
| --- | --- |
| Appareil | iPad (Safari / app installée sur l'écran d'accueil), orientation paysage, trépied. Modèle : **iPad 9e génération (2021), 10,2 pouces, Wi-Fi, 64 Go** (puce A13 Bionic ; caméra frontale ultra grand-angle 12 Mpx avec Cadre centré, située sur le **bord court** en paysage) |
| Socle | Vite + TypeScript, sans framework UI lourd |
| PWA | `vite-plugin-pwa` : installable, hors ligne (modèle MediaPipe mis en cache) |
| Caméra | `getUserMedia({ video: { facingMode: "user", width: 1280, height: 720, frameRate: 60 } })` ; nécessite HTTPS. **60 i/s par défaut** (iPad 9e génération : ≈ 57 i/s caméra, ≈ 54 i/s de détection, précision ≈ 18 ms) ; `?fps=30` pour revenir à 30 i/s |
| Détection | `@mediapipe/tasks-vision`, **PoseLandmarker lite**, mode `VIDEO`, délégué GPU avec repli CPU ; fichier `.task` auto-hébergé dans `public/models/` |
| Stockage | IndexedDB (via `idb`) |
| Export | CSV (format long, un essai par ligne) + sauvegarde JSON complète (export / import) |
| Hébergement | GitHub Pages via GitHub Actions |
| Tests | Vitest pour toute la logique pure (générateur pseudo-aléatoire, séquences, détection de touche, scores, CSV) |
| Écran | Plein écran, maintien de l'écran allumé (Wake Lock API si disponible), verrouillage paysage si possible |

Point à vérifier dès l'étape 1 : position de la caméra frontale selon le modèle d'iPad (bord long ou bord court en paysage) et fréquence d'images réelle de la détection (objectif ≥ 25 i/s).

- L'app doit fonctionner **quelle que soit la position de la caméra frontale** (bord long ou bord court en paysage) : aucune hypothèse codée en dur sur l'orientation du flux vidéo.
- **Cadre centré (Center Stage) à désactiver** pendant l'utilisation (Centre de contrôle → Effets vidéo, caméra active) : ce recadrage automatique change la taille apparente de la joueuse et fausserait la calibration et la comparaison entre séances. À vérifier lors du test de l'étape 1.
- Un **panneau de diagnostic** affiche à l'écran : résolution vidéo réelle, i/s de la vidéo et de la détection, position de caméra détectée (bord long / bord court / inconnue).

## 3. Repères du corps utilisés

PoseLandmarker (33 points). Effecteurs :
- Main gauche : poignet 15, index 19 ; main droite : poignet 16, index 20 (on prend le point le plus avancé des deux).
- Pied gauche : cheville 27, pointe 31 ; pied droit : cheville 28, pointe 32.
- Seuil de visibilité : 0,5 (paramétrable). Un repère sous le seuil est ignoré.
- L'image est affichée en miroir ; les coordonnées sont converties en conséquence (la « main droite » à l'écran doit être la main droite réelle de la joueuse).

## 4. Calibration (à chaque séance)

La grille est calée sur la **vraie cage** (3 m × 2 m), filmée de face par la tablette placée dans l'axe de la cage.

0. **Profil** (créé une fois) : pseudonyme, catégorie, poste, latéralité et **taille réelle (cm)**. Aucun nom dans l'app (section 11).
1. **Cage** (une fois par installation du trépied) : l'entraîneur touche à l'écran les **4 coins de la cage** (pied et haut de chaque poteau, dans n'importe quel ordre). Les coins sont mémorisés sur l'appareil ; si le trépied n'a pas bougé, il suffit de les confirmer. Contrôle de cohérence (rapport largeur / hauteur proche de 3 / 2). Échelle de la cage : pixels par cm (3 m de large, 2 m de haut).
2. **Cadrage** : la joueuse, dans sa cage, doit être entièrement visible (tête et pieds). Indicateur vert/rouge et consignes (reculer, s'approcher, se décaler).
3. **Posture de garde** : consigne « Mettez-vous en garde », **2 s de préparation** (rien n'est mesuré), puis garde tenue **2 s immobile**. La garde n'est acceptée que si les deux mains sont **au-dessus du milieu du buste** (bras le long du corps refusés). Mesures : taille apparente (visage → chevilles), largeur d'épaules, centre du bassin, niveau des chevilles, position des mains et des chevilles (zones de garde).
4. **Échelle de la joueuse** : taille apparente rapportée à la taille réelle (pixels par cm ; approximation : le repère haut est le visage, pas le sommet du crâne).
5. **Grille de 12 zones (4 colonnes × 3 rangées)**, **sans colonne centrale** (une cible sur le corps se toucherait sans bouger), à des **positions réelles dans la cage** : colonnes à 60 cm du centre et à 25 cm à l'intérieur de chaque poteau (± 125 cm) ; rangées à 40 cm, 1 m et 1,65 m du sol ; cibles de 30 cm de diamètre (paramétrables). Zones numérotées de 1 à 12, de gauche à droite puis de haut en bas (vue miroir).
   - **Parallaxe** : la gardienne se tient devant sa ligne, donc plus près de la caméra que la cage. Les cibles sont placées à leur position réelle **ramenée au plan de la gardienne** : centre horizontal = centre de la cage à l'image, sol = niveau de ses chevilles (+ 8 cm), distances converties avec l'échelle de la joueuse. Toucher la cible « du poteau » à l'écran correspond ainsi à aller réellement au poteau. Rapport échelle joueuse / échelle cage enregistré (contrôle : la joueuse doit être devant la cage).
   - Alertes : cible hors de l'image ; cible chevauchant une zone de garde.
6. Sauvegarde de la calibration (horodatée) et rappel de la précédente pour vérifier une distance comparable : écart de taille de la cage à l'image > 10 % → alerte « trépied pas à la même distance ».

## 5. Déroulé d'un essai (cœur scientifique)

La garde d'une gardienne n'est pas statique (petits rebonds, mains qui bougent) : les règles ci-dessous distinguent un vrai départ d'un balancement.

1. **Position de départ** : l'essai ne commence que si les deux mains sont dans leur « zone de garde » pendant 150 ms (présence, sans exigence d'immobilité). Zone de garde = cercle autour de la position de chaque main **par rapport au centre des épaules**, mesurée pendant la posture de garde de la calibration (sa garde habituelle) ; elle suit donc la joueuse si elle se décale. Alerte à la calibration si une cible chevauche une zone de garde.
2. **Avant-période aléatoire** : 600 à 1 500 ms (uniforme), pour empêcher d'anticiper le moment d'apparition. Les avant-périodes font partie de la séquence pré-tirée (graine).
   - **Faux départ** : mouvement par rapport à une référence **glissante** (moyenne des 500 dernières ms) pendant l'avant-période, avec les critères du point 4 mais un **seuil plus large (8 % de la taille apparente)** et **sur 2 images consécutives** (les petits mouvements de garde et les sauts isolés de la détection ne comptent pas) → essai annulé et rejoué (nouvelle avant-période tirée d'un générateur séparé, pour ne pas décaler la séquence) ; le nombre de faux départs est enregistré avec l'essai.
3. **Apparition du stimulus** : l'horodatage d'apparition est pris dans le `requestAnimationFrame` où la cible est dessinée (`performance.now()`, plus l'horodatage du rafraîchissement pour contrôle). Biais connu et constant pour un même appareil : affichage réel ≈ 1 rafraîchissement plus tard, latence de la caméra.
4. **Détection**, image par image (`requestVideoFrameCallback` ; enregistrer `metadata.captureTime` si disponible, sinon `expectedDisplayTime`, et noter quelle source a été utilisée) :
   - **Référence** : moyenne des positions sur les 300 ms précédant l'apparition.
   - **Initiation** : première image (capturée après l'apparition) où l'un des critères dépasse le seuil (5 % de la taille apparente par défaut, paramétrable) → *temps de réaction* (TR) :
     - main : déplacement **par rapport au centre des épaules** (un rebond du corps entier ne compte pas) ;
     - bassin : déplacement **horizontal** (pas, plongeon) ;
     - pied : déplacement **horizontal** d'une cheville.
   - **Touche** : première image où un effecteur (poignet ou index ; cheville ou pointe de pied) **entre** dans le cercle d'une cible : un effecteur déjà dans un cercle au moment de l'apparition ne compte pour ce cercle qu'après en être sorti puis y être revenu → *temps total* ; *temps de mouvement* = total − TR. La **première** zone touchée fait foi. Une touche sans initiation détectée auparavant fixe l'initiation à la même image.
   - **Trajectoires** : positions des mains, pieds, épaules et bassin enregistrées image par image (coordonnées seulement, aucune image), de l'avant-période à la fin de la réponse, pour pouvoir recalculer les TR avec un autre seuil. **Indice de balancement** par essai : amplitude moyenne des mouvements des mains (par rapport aux épaules) pendant l'avant-période, en proportion de la taille apparente.
5. **Issue** de l'essai : `hit` (bonne cible, bon effecteur), `wrong_effector`, `wrong_zone`, `miss` (délai dépassé), `commission` (mouvement sur un no-go), `correct_rejection` (no-go respecté), `anticipation` (initiation < 150 ms après le stimulus).
6. **Retour** à la joueuse : visuel bref (flash vert / rouge) et son facultatif, **après** la réponse uniquement.
7. Intervalle avant l'essai suivant : 300 ms (le retour visuel de 300 ms s'y déroule) + retour en position de garde. Environ 2 s entre deux cibles. **Ces délais doivent être figés avant la collecte des données du mémoire.**

Délais par défaut (paramétrables) : réponse 2 000 ms ; fenêtre no-go 1 500 ms.

## 6. Modes de jeu (v1)

| Mode | Règle | Processus visé |
| --- | --- | --- |
| **Classique** | Une cible verte dans une des 12 zones ; toucher avec n'importe quel effecteur (rangée basse : pied ou main) | Temps de réaction de choix |
| **Go / no-go** | Vert = toucher ; rouge = ne pas bouger. Proportion 70 % go / 30 % no-go | Inhibition (anti-feinte) |
| **Bon segment** | Couleur + symbole de la cible = effecteur imposé : orange « G » = main gauche, magenta « D » = main droite, blanc + icône de pied = pied (côté de la cible) — voir section 10 | Choix de réponse, coordination |

Prévu en v2 : leurre (cible qui glisse vers une autre zone en 100-200 ms), double cible, plots couleur, lecture de tir vidéo, scan périphérique.

## 7. Mode Test (mesure) et mode Entraînement (jeu)

### Mode Test — séquence figée
- Générateur pseudo-aléatoire à graine (ex. mulberry32) ; **graine et version de la batterie enregistrées** ; même séquence à chaque passage.
- Batterie v1 (≈ 7-8 min) :
  - Familiarisation : 6 essais classiques (non analysés).
  - Bloc 1 Classique : 36 essais (12 zones × 3, ordre contrebalancé, pas plus de 2 fois la même zone de suite).
  - Bloc 2 Go / no-go : 40 essais (28 go, 12 no-go).
  - Bloc 3 Bon segment : 36 essais (12 zones × 3).
  - Pause de 30 s entre les blocs.
- Aucun ajustement de difficulté ; pas de classement affiché pendant le test.

### Mode Entraînement — progression
- Mêmes jeux, séances de ~15 min, choix de l'entraîneur ou programme préréglé.
- Difficulté adaptative par escalier (2 réussites → plus dur, 1 échec → plus facile) sur : durée d'affichage de la cible, délai de réponse, proportion de no-go.
- Score, record personnel, série de séances, classement du groupe (désactivable).

## 8. Modèle de données

- `players` : id pseudonyme (G1…G5, C1…), poste, catégorie (pro / CF / réserve / champ), latéralité, taille réelle (cm), actif.
- `sessions` : id, player_id, date-heure, mode (test / train), version de batterie, graine, appareil (user agent, dimensions vidéo), i/s moyen, % images perdues, source de l'horodatage, calibration_id, notes.
- `calibrations` : id, player_id, date, dimensions vidéo, coins de la cage et échelle de la cage, mesures de garde (taille apparente, épaules, bassin, chevilles, mains), échelle de la joueuse (px/cm), rapport des échelles, grille calculée, contexte (version de l'app, délégué, position de caméra).
- `trials` : session_id, bloc, n° d'essai, mode, zone (1-12), stimulus (couleur / type), go ou no-go, effecteur attendu, effecteur utilisé, zone touchée, avant-période (ms), t_stimulus (et horodatage du rafraîchissement), t_initiation, critère d'initiation, t_touche, TR (ms), temps de mouvement (ms), temps total (ms), issue, nombre de faux départs, niveau de difficulté, qualité (visibilité moyenne, images perdues pendant l'essai, indice de balancement), trajectoires.
- Les `sessions` portent aussi : statut (terminée / interrompue), délégué, résolution, position de caméra, version de l'app.

Export CSV : un fichier `trials` en format long avec les colonnes de session répétées (prêt pour R / Python), plus un résumé par séance (TR médian, écart interquartile, % réussite, % commissions, % anticipations).

## 9. Qualité des mesures

- Afficher et enregistrer la fréquence réelle et les images perdues ; une séance sous 20 i/s est signalée « qualité insuffisante ». La cadence de caméra demandée est enregistrée avec chaque séance ; **une même étude doit garder la même cadence** (60 i/s) d'un bout à l'autre.
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
2. **Profils, calibration et grille** : profils joueuses (pseudonyme + taille), coins de la cage, cadrage, garde, grille de 12 zones calée sur la cage ; tables IndexedDB `players` et `calibrations`.
3. **Mode Classique** : boucle d'essai complète (position de départ, avant-période, horodatages, issues), tables IndexedDB `sessions` et `trials`.
4. **Go / no-go et Bon segment**, mode Test à graine, écran de résultats, export CSV / JSON.
5. **Habillage** (couleurs TMVH, sons, profils), mode Entraînement adaptatif. → *Test au gymnase et étude de fiabilité.*
