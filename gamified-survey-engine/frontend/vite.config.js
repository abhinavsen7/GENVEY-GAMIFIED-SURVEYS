import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    watch: {
      ignored: ['**/public/**', '**/node_modules/**', '**/.git/**', '**/custom_asset_packs/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/custom_assets': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
});
