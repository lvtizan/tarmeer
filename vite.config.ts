import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0', // 允许内网访问
    port: 5173,
    headers: { 'Cache-Control': 'no-cache' },
    proxy: {
      '/api': {
        target: 'http://47.91.108.104:3002',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://47.91.108.104:3002',
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
