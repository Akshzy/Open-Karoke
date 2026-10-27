import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const isolationHeaders = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
};
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg'],
            manifest: {
                name: 'OpenKaraoke Studio',
                short_name: 'OpenKaraoke',
                description: 'Private, local-first AI karaoke creator.',
                theme_color: '#171712',
                background_color: '#f3f0e6',
                display: 'standalone',
                start_url: '/',
                icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,woff2}'],
                navigateFallback: 'index.html',
                cleanupOutdatedCaches: true,
            },
        }),
    ],
    optimizeDeps: { exclude: ['onnxruntime-web'] },
    worker: { format: 'es' },
    server: { headers: isolationHeaders },
    preview: { headers: isolationHeaders },
    build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
