// Copie les fichiers WASM de MediaPipe dans public/wasm/ (auto-hébergement, hors ligne).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = join(root, 'public', 'wasm');

if (!existsSync(src)) {
  console.warn('[copy-wasm] @mediapipe/tasks-vision absent, copie ignorée.');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
// Seule la variante non-module est utilisée (FilesetResolver.forVisionTasks(base, false)).
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  cpSync(join(src, f), join(dest, f));
}
console.log('[copy-wasm] WASM MediaPipe copiés dans public/wasm/');
