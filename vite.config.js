import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

// Proxies all development API calls to the Central Gateway at port 4000
export default defineConfig({
  plugins: [react(), tailwindcss(), buildVersionFile()],
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
