import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Icônes de l'app : monogramme « R » blanc sur bleu marine (fond inclus dans le SVG, pleine page).
// Lancer : npm run icons (les fichiers produits sont versionnés dans public/brand/).
const NAVY = '#06131F';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: NAVY } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: NAVY } },
  },
  images: ['public/brand/rempart-mark.svg'],
});
