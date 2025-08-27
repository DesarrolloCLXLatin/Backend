import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: [''],
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:30500',
        changeOrigin: true,
      }
    }
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  }
});
