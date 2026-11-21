import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite config. `server.host: 0.0.0.0` makes the dev server reachable from the
// platform's live preview proxy. Replace `/api` with a real backend later.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // `server.host: 0.0.0.0` makes the dev server reachable from the platform's
  // live preview proxy; `allowedHosts: true` permits the e2b.app preview host.
  server: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  // Same for the production preview server (`npm run preview`) so the
  // e2b.app proxy host is allowed to reach it.
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    // The full app bundle is large (chemistry tools, virtual lab, studio), so
    // raise the size threshold above the actual bundle to avoid the warning.
    chunkSizeWarningLimit: 900,
  },
});
