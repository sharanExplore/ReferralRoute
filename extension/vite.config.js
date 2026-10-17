import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets use relative paths for Chrome extensions
  build: {
    outDir: 'dist',
  },
});
