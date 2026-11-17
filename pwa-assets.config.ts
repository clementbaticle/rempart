import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Icônes de l'app : les 12 zones de la cage, une cible allumée (jaune), sur le bleu TMVH (fond inclus dans le SVG).
// Lancer : npm run icons (les fichiers produits sont versionnés dans public/brand/).
const NAVY = '#06182C';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: NAVY } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: NAVY } },
  },
  images: ['public/brand/rempart-mark.svg'],
});
