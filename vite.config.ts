import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // 允许内网访问
    port: 5180,
    headers: { 'Cache-Control': 'no-cache' },
    proxy: {
      // /api/uploads must come before /api so vite matches it first.
      // Local backend serves uploads from server/public/uploads/ (primary)
      // and falls back to CRM shared uploads — matches production behavior.
      '/api/uploads': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
    },
    fs: {
      allow: ['.'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          animations: ['framer-motion'],
        },
      },
    },
  },
});
