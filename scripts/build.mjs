import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, rmSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');
const alias = { '@': resolve(root, 'src') };

// Clean output
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Copy static files
cpSync(resolve(root, 'public/manifest.json'), resolve(dist, 'manifest.json'));

console.log('Building popup...');
await build({
  root: resolve(root, 'src/popup'),
  configFile: false,
  base: './',
  build: {
    outDir: resolve(dist, 'popup'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: { alias },
  publicDir: false,
  logLevel: 'warn',
});

console.log('✅ Build complete → dist/');
