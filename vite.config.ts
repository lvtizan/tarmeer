import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const VERSION = readFileSync('VERSION', 'utf8').trim();
const COMMIT = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'dev'; }
})();
const BUILD_TIME = new Date().toISOString();

const versionPlugin = {
  name: 'tarmeer-version-html',
  transformIndexHtml(html: string) {
    return html
      .replace(/%VITE_APP_VERSION%/g, VERSION)
      .replace(/%VITE_APP_COMMIT%/g, COMMIT)
      .replace(/%VITE_APP_BUILD_TIME%/g, BUILD_TIME);
  },
};

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), versionPlugin],
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
    __APP_COMMIT__: JSON.stringify(COMMIT),
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
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
