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
1. **Cage** (une fois par installation du trépied) : l'entraîneur touche à l'écran les **4 coins de la cage** (pied et haut de chaque poteau, dans n'importe quel ordre). Une **loupe** (image agrandie avec réticule) suit le doigt, et chaque coin peut être **déplacé** pour l'ajuster. Les coins sont mémorisés sur l'appareil ; si le trépied n'a pas bougé, il suffit de les confirmer (ou de les ajuster). Contrôle de cohérence (rapport largeur / hauteur proche de 3 / 2). Échelle de la cage : pixels par cm (3 m de large, 2 m de haut).
2. **Cadrage** : la joueuse, dans sa cage, doit être entièrement visible (tête et pieds). Indicateur vert/rouge et consignes (reculer, s'approcher, se décaler).
3. **Posture de garde** : consigne « Mettez-vous en garde », **2 s de préparation** (rien n'est mesuré), puis garde tenue **2 s immobile**. La garde n'est acceptée que si les deux mains sont **au-dessus du milieu du buste** (bras le long du corps refusés). Mesures : taille apparente (visage → chevilles), largeur d'épaules, centre du bassin, niveau des chevilles, position des mains et des chevilles (zones de garde).
4. **Échelle de la joueuse** (pixels par cm à sa distance) = taille apparente en garde / **taille de garde en cm** :
   - **Étalonnage individuel** (une fois par gardienne, à refaire si besoin) : la gardienne se tient **sur la ligne de but, entre les poteaux**, en garde (2 s de préparation, 2 s immobile). Elle est alors à la distance de la cage, dont l'échelle est connue : sa hauteur de garde visage → chevilles est mesurée en cm et enregistrée dans son profil (avec la date). Contrôles : pieds sur la ligne (chevilles au niveau du pied des poteaux, à ± 15 cm) et valeur plausible (entre 60 et 95 % de sa taille).
   - À défaut d'étalonnage : approximation 90 % de la taille réelle (repère haut = visage) ; elle surestime la hauteur de garde (genoux fléchis), donc place les cibles un peu trop près du centre. L'étalonnage est recommandé avant toute collecte de données.
   - La source de l'échelle (étalonnage ou taille) est enregistrée avec chaque calibration.
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
   - **Touche** : première image où un effecteur **autorisé** (poignet ou index ; cheville ou pointe de pied) **entre** dans le cercle de la **cible** : un effecteur déjà dans ce cercle au moment de l'apparition ne compte qu'après en être sorti puis y être revenu → *temps total* ; *temps de mouvement* = total − TR. Une touche sans initiation détectée auparavant fixe l'initiation à la même image.
   - **Zones traversées** : passer par d'autres zones pour atteindre la cible (ex. la jambe traverse la zone voisine pour aller en bas à droite) **n'est pas une erreur** ; ces zones sont seulement enregistrées, dans l'ordre, pour l'analyse des trajectoires.
   - **Trajectoires** : positions des mains, pieds, épaules et bassin enregistrées image par image (coordonnées seulement, aucune image), de l'avant-période à la fin de la réponse, pour pouvoir recalculer les TR avec un autre seuil. **Indice de balancement** par essai : amplitude moyenne des mouvements des mains (par rapport aux épaules) pendant l'avant-période, en proportion de la taille apparente.
5. **Issue** de l'essai :
   - essai **go** : `hit` (cible atteinte), `miss` (délai dépassé), `anticipation` (initiation < 150 ms après le stimulus) ;
   - essai **no-go** : `commission` = **vrai départ** détecté (même critère et même seuil que l'initiation d'un go, 5 % de la taille apparente) pendant la fenêtre de 1 500 ms, l'essai s'arrête alors ; `correct_rejection` = aucun départ pendant la fenêtre. L'**amplitude maximale du mouvement** pendant la fenêtre est enregistrée (pour pouvoir changer de critère après coup).
   - Il n'y a pas d'issue « mauvaise zone ».
6. **Retour** à la joueuse, **après** la réponse uniquement : **flash plein écran** vert (réussite) ou rouge (erreur) de 100 ms, et **son** (deux notes montantes / note grave), désactivable. La série commence par un **compte à rebours 3, 2, 1, GO** (bips) ; aucune mesure pendant celui-ci.
7. Intervalle avant l'essai suivant : 300 ms (le retour visuel de 300 ms s'y déroule) + retour en position de garde. Environ 2 s entre deux cibles. **Ces délais doivent être figés avant la collecte des données du mémoire.**

Délai de réponse selon le **mode de temps** choisi avant la série (section 7) : Découverte = aucun (plafond de sécurité de 10 s, sans retour d'erreur) ; Test = 2 000 ms ; Entraînement = niveaux 1 à 5 (2 000, 1 600, 1 300, 1 100, 900 ms). Fenêtre no-go : 1 500 ms. Le mode et le délai sont enregistrés avec la séance.

## 6. Modes de jeu (v1)

| Mode | Règle | Processus visé |
| --- | --- | --- |
| **Classique** | Une cible verte dans une des 12 zones ; l'atteindre avec **n'importe quel effecteur**, main ou pied, à toutes les hauteurs (des arrêts réels associent souvent pied et main en hauteur) | Temps de réaction de choix |
| **Go / no-go** | Vert ● = toucher ; rouge ✕ = ne pas bouger. Bloc de 18 essais : 12 go (chaque zone une fois) + 6 no-go (2 par rangée, 3 par côté), soit 67 % / 33 % ; au plus 2 no-go de suite | Inhibition (anti-feinte) |

**Bon segment retiré** : imposer une main par couleur (y compris croisée, main gauche pour un ballon à droite) ne correspond pas à la technique des gardiennes, qui parent avec le bras et / ou la jambe du côté du ballon ; restreint au côté du ballon, il ferait doublon avec le Classique. Piste v2 (entraînement, hors mesure) : choix du geste « main » / « pied », toujours du côté du ballon.

Prévu en v2 : leurre (cible qui glisse vers une autre zone en 100-200 ms), double cible, plots couleur, lecture de tir vidéo, scan périphérique.

## 7. Mode Test (mesure) et mode Entraînement (jeu)

### Modes de temps (choisis avant chaque série)
- **Découverte** : pas de délai, il faut atteindre la cible quel que soit le temps (apprentissage, échauffement).
- **Test** : délai fixe de 2 s, identique pour toutes ; seul mode utilisé pour les mesures du mémoire.
- **Entraînement** : niveaux 1 à 5 (délai de 2 s à 0,9 s), choisis à la main ; passage automatique de niveau à l'étape 5.

### Mode Test — séquence figée
- Générateur pseudo-aléatoire à graine (ex. mulberry32) ; **graine et version de la batterie enregistrées** ; même séquence à chaque passage.
- Batterie v1 (48 essais, ≈ 3 min) — graines fixes, avant-périodes comprises :
  - Familiarisation : 6 essais classiques (6 zones différentes, non analysés).
  - Bloc 1 Classique : 24 essais (12 zones × 2, pas plus de 2 fois la même zone de suite).
  - Bloc 2 Go / no-go : 18 essais (12 go + 6 no-go, au plus 2 no-go de suite).
  - Pause de 10 s entre les blocs (compte à rebours à l'écran).
- En Découverte et en Entraînement, on choisit le jeu (Classique ou Go / no-go) ; mêmes tailles de bloc, séquence tirée au hasard.
- Aucun ajustement de difficulté ; pas de classement affiché pendant le test.

### Mode Entraînement — progression
- Mêmes jeux, séances de ~15 min, choix de l'entraîneur ou programme préréglé.
- Difficulté adaptative par escalier (2 réussites → plus dur, 1 échec → plus facile) sur le délai de réponse (niveaux), éventuellement la proportion de no-go.
- Score, record personnel, série de séances, classement du groupe (désactivable).

## 8. Modèle de données

- `players` : id pseudonyme (G1…G5, C1…), poste, catégorie (pro / CF / réserve / champ), latéralité, taille réelle (cm), étalonnage individuel (hauteur de garde en cm et date), actif.
- `sessions` : id, player_id, date-heure, mode (découverte / test / entraînement), niveau, délai de réponse, version de batterie, graine, appareil (user agent, dimensions vidéo), i/s moyen, % images perdues, source de l'horodatage, calibration_id, notes.
- `calibrations` : id, player_id, date, dimensions vidéo, coins de la cage et échelle de la cage, mesures de garde (taille apparente, épaules, bassin, chevilles, mains), échelle de la joueuse (px/cm), rapport des échelles, grille calculée, contexte (version de l'app, délégué, position de caméra).
- `trials` : session_id, bloc, n° d'essai, mode, zone (1-12), stimulus (couleur / type), go ou no-go, effecteur attendu, effecteur utilisé, zones traversées, avant-période (ms), t_stimulus (et horodatage du rafraîchissement), t_initiation, critère d'initiation, t_touche, TR (ms), temps de mouvement (ms), temps total (ms), issue, nombre de faux départs, niveau de difficulté, qualité (visibilité moyenne, images perdues pendant l'essai, indice de balancement), trajectoires.
- Les `sessions` portent aussi : statut (terminée / interrompue), délégué, résolution, position de caméra, version de l'app.

Export CSV : un fichier `trials` en format long avec les colonnes de session répétées (prêt pour R / Python), plus un résumé par séance (TR médian, écart interquartile, % réussite, % commissions, % anticipations).

## 9. Qualité des mesures

- Afficher et enregistrer la fréquence réelle et les images perdues ; une séance sous 20 i/s est signalée « qualité insuffisante ». La cadence de caméra demandée est enregistrée avec chaque séance ; **une même étude doit garder la même cadence** (60 i/s) d'un bout à l'autre.
- Le décalage caméra → détection est constant pour un même iPad : **toujours tester sur le même appareil**, même distance, même salle. Les résultats servent à comparer la joueuse à elle-même, pas à des normes publiées.
- Statistique par séance : **médiane** du TR (robuste), essais hors 150-1 500 ms exclus du calcul et comptés.
- Étude de fiabilité prévue : deux passages du mode Test dans la même séance → CCI, erreur type de mesure, plus petit changement détectable.

## 10. Interface

- Pensée pour être lue à 3 m : cibles et consignes très grandes, contrastes forts, peu de texte pendant le jeu.
- **Zoom sur la zone de jeu** pendant la série : l'affichage est recadré sur la cage, les cibles et la joueuse (avec une légère marge) pour qu'elles apparaissent en grand. Affichage seulement : la détection travaille toujours sur l'image complète de la caméra.
- **Couleurs du TMVH** (extraites du logo) : bleu `#04A5DF`, jaune `#FBD427`. Toutes les couleurs de l'interface sont regroupées dans **un seul fichier de thème**.
- **Logo** : PNG à fond transparent dans `public/brand/` ; sert pour l'icône de l'app et l'écran d'accueil.
- **Règles de couleurs** :
  - Les couleurs TMVH servent **uniquement** aux menus, à l'accueil et aux résultats. **Pendant les exercices**, le fond est sombre et neutre, sans aucune couleur du club, pour ne pas créer de confusion avec les cibles.
  - Les couleurs des cibles sont **fixes, indépendantes du thème**, et toujours accompagnées d'un symbole (lisibles en cas de daltonisme) :

    | Cible | Couleur | Symbole |
    | --- | --- | --- |
    | Go | vert | ● |
    | No-go | rouge | ✕ |

  - Couleurs réservées pour une éventuelle v2 (ancien Bon segment, retiré) : orange « G », magenta « D », blanc + icône de pied.
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
4. **Go / no-go**, batterie Test figée (Classique + Go / no-go), écran de résultats et historique, réglages staff, export CSV / JSON.
5. **Habillage** (couleurs TMVH, sons, profils), mode Entraînement adaptatif. → *Test au gymnase et étude de fiabilité.*
