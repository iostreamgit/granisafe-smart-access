import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, monorepoRoot, '');
  const apiPort = env.API_PORT || process.env.API_PORT || '3000';
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@granisafe/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/health': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
