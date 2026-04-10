module.exports = {
  apps: [{
    name: 'tarmeer-prerender',
    script: 'index.js',
    cwd: __dirname,
    instances: 1,
    max_memory_restart: '512M',
    env: {
      PORT: 3003,
      CACHE_DIR: '/tarmeer/prerender-cache',
      CACHE_TTL_MS: 24 * 60 * 60 * 1000,
      RENDER_TIMEOUT_MS: 15000,
      TARGET_HOST: 'http://127.0.0.1:80',
    },
  }],
};
