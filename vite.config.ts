/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/ (fourni par le workflow).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/*.png', 'brand/favicon.ico'],
      manifest: {
        name: 'Rempart — TMVH',
        short_name: 'Rempart',
        description: 'Entraînement et évaluation perceptivo-cognitive des gardiennes du TMVH',
        lang: 'fr',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#06182C',
        theme_color: '#06182C',
        icons: [
          { src: 'brand/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'brand/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'brand/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Le modèle (.task) et le moteur (.wasm) sont mis en cache pour le hors-ligne.
        globPatterns: ['**/*.{js,css,html,png,ico,svg,wasm,task,woff2}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
