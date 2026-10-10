import { defineConfig } from 'vite';

export default defineConfig({
  root: 'ui',
  base: '/__studio/',
  build: { outDir: '../dist/ui', emptyOutDir: true },
});
