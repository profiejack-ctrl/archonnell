import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const gateway = env.VITE_GATEWAY_URL || 'http://localhost:4000';

    return {
        base: './',
        plugins: [react()],
        build: {
            outDir: '../app',
            emptyOutDir: true,
            sourcemap: false,
            rollupOptions: {
                input: {
                    // HRMS (login, dashboard, every module): app/index.html
                    main: 'index.html',
                    // Public website + applicant portal: app/public.html
                    public: 'public.html',
                },
            },
        },
        server: {
            port: 5173,
            strictPort: true,
            // The shared stylesheets and logo live in the project root
            fs: { allow: ['..'] },
            proxy: {
                '/api': { target: gateway, changeOrigin: true },
            },
        },
    };
});
