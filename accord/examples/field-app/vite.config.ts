import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Use the Accord packages' TypeScript sources directly: no build step needed for the demo.
  resolve: { conditions: ['@accordsync/source'] },
  server: {
    port: 5173,
    // The sync server from `docker compose up` (same origin for the browser: no CORS needed).
    proxy: { '/v1': 'http://localhost:8080', '/health': 'http://localhost:8080' },
  },
});
