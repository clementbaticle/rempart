import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Génère les icônes de l'app à partir du logo TMVH (fond transparent).
// Lancer : npm run icons (les fichiers produits sont versionnés dans public/brand/).
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0E1116' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0E1116' } },
  },
  images: ['public/brand/logo-tmvh.png'],
});
