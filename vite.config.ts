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
      '/api/uploads': {
        target: 'https://www.tarmeer.com',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'https://www.tarmeer.com',
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
