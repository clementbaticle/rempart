# Rempart — consignes pour Claude Code

Application web (PWA) d'entraînement et d'évaluation perceptivo-cognitive pour les gardiennes du TMVH.
La référence fonctionnelle est `docs/CAHIER_DES_CHARGES.md` : la lire avant toute tâche.

## Façon de travailler
- Répondre et commenter en français, de façon concise.
- **Avant de coder** : présenter le plan de l'étape (fichiers touchés, choix techniques) et attendre la validation.
- Avancer étape par étape (section 12 du cahier des charges) ; ne pas commencer l'étape suivante sans validation.
- Un commit par sous-tâche cohérente ; une étiquette git (`v0.1`, `v0.2`…) à chaque étape validée, pour pouvoir revenir à une version stable.
- Ne jamais modifier la logique de mesure (horodatage, issues des essais, séquences du mode Test) sans le signaler explicitement : elle conditionne la validité scientifique.

## Règles techniques
- Vite + TypeScript strict, sans framework UI lourd.
- Logique pure (génération des séquences, détection de touche, calcul des issues, scores, CSV) séparée de l'affichage et couverte par des tests Vitest.
- Tous les paramètres (délais, seuils, proportions, graine) dans un fichier de configuration unique.
- Le modèle MediaPipe est auto-hébergé dans `public/models/` (fonctionnement hors ligne).
- Aucune image ou vidéo n'est enregistrée ni envoyée.

## Commandes
- `npm run dev` : serveur local (tester la caméra sur l'iPad nécessite HTTPS : utiliser la version déployée ou `vite --host` avec certificat).
- `npm test` : tests.
- `npm run build` : version de production (déployée sur GitHub Pages par GitHub Actions).
