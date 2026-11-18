import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import https from 'node:https';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gateway = env.VITE_GATEWAY_URL || 'https://api.archonnellincorporated.com';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5175,
      proxy: {
        '/api': {
          target: gateway,
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ family: 4 })
        }
      }
    }
  };
});
