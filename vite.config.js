import { defineConfig } from 'vite';

export default defineConfig({
  root: 'ui',
  base: '/__studio/',
  build: {
    outDir: '../dist/ui',
    emptyOutDir: true,
    rollupOptions: { input: { main: 'ui/index.html', gltf: 'ui/gltf.html' } },
  },
});
