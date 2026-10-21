import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiPort = Number(env.PORT || 3000);
  return {
    plugins: [react()],
    server: { proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
    build: {
      // LiveKit is isolated in a voice-only chunk and loaded only when Voice is opened.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'voice-transport': ['livekit-client'],
          },
        },
      },
    },
  };
});
