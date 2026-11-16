# Journal des tests

## Étape 1 — Socle (v0.1)

### 16/11/2026, 16 h 40 — gymnase, ordinateur (Asus, Chrome), sur batterie
- Ordinateur posé sur une chaise, sur la ligne des 3 m ; gardienne dans la cage : corps entier largement visible.
- Éclairage bon ; aucune influence apparente du fond (cage, filets, murs).
- Squelette : bras levés, pas latéral, jambe basse, mouvements rapides globalement bien suivis ; légère latence.
- Effet miroir correct.
- 1280 × 720, GPU : 5,5 à 6,8 i/s (ancien panneau : « i/s vidéo » comptait en fait les images traitées).

### 16/11/2026, soir — domicile, même ordinateur, mêmes conditions (panneau corrigé)

| Cas | i/s caméra | i/s détection | Calcul / image (moy. / max) | Images non traitées |
| --- | --- | --- | --- | --- |
| GPU, secteur | 15,2 | 8,7 | 98 / 111 ms | 65,4 % |
| CPU, secteur | 15,0 | 13,2 | 52 / 66 ms | 13,0 % |
| GPU, batterie | 15,2 | 5,9 | 157 / 235 ms | 73,9 % |
| CPU, batterie | 15,0 | 9,6 | 104 / 162 ms | 42,8 % |

Horodatage : `captureTime` dans tous les cas.

**Conclusions**
- La webcam plafonne à 15 i/s (30 annoncées) : limite matérielle de cet ordinateur.
- Sur cet ordinateur, le CPU est environ 2 fois plus rapide que le GPU ; la batterie ralentit d'environ 50 %.
- Fonctionnement de l'étape 1 validé sur ordinateur. **Performance à valider sur l'iPad** (objectif ≥ 25 i/s) :
  comparer `?res=640` / défaut et `?delegate=CPU` / défaut.

### Test iPad (9e génération) — à venir

## Étape 2 — Profils, calibration et grille (v0.2.0)

### 16/11/2026 — domicile, ordinateur (Asus, Chrome, CPU forcé, secteur)
- Calibration menée jusqu'au bout sans blocage ; consignes compréhensibles.
- 1er essai : cibles des zones 1-2-3 (rangée haute) hors de l'image → alerte affichée, calibration refaite.
- Mesures (cm, approx.) : épaules 35 ; envergure 170 ; portée haute 212 ; portée gauche / droite 174 / 184 ;
  pas gauche / droit 83 / 93.
- Cohérence interne : demi-envergure + pas ≈ portée latérale (85 + 83 = 168 vs 174 ; 85 + 93 = 178 vs 184).
- Zones jugées atteignables. Alerte de distance déclenchée correctement.
- Envergure non vérifiée au mètre. Taille déclarée au profil : 183 cm.
- 2e essai : ordinateur reculé. Maintien immobile de 2 s jugé facile.
- Écart attendu sur les valeurs en cm : envergure mesurée 170 pour 183 cm de taille. Les points de main
  de PoseLandmarker (19/20) sont proches des phalanges, pas du bout des doigts (≈ 2 × 10 cm en moins),
  et l'échelle repose sur l'approximation visage → chevilles = 0,9 × taille. Les valeurs en cm servent
  à comparer une joueuse à elle-même, pas à une mesure anthropométrique.
