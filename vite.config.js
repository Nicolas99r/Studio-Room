import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Build to root directory since this is a static site
  build: {
    outDir: '.',
    emptyOutDir: false,
    // Rollup options for simple static site
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        // Keep files separate instead of hashing
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]'
      }
    }
  },
  // Copy public folder to root during build
  publicDir: 'public'
});
