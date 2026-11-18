import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import https from 'https'

const BUILD_ID = new Date().toISOString();

function buildVersionFile() {
  return {
    name: 'build-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const gateway = env.VITE_GATEWAY_URL || 'https://api.archonnellincorporated.com';

  return {
    plugins: [react(), tailwindcss(), buildVersionFile()],
    define: {
      __APP_BUILD__: JSON.stringify(BUILD_ID),
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: gateway,
          changeOrigin: true,
          secure: false,
          agent: new https.Agent({ family: 4, keepAlive: true }),
        },
      },
    },
  };
});
