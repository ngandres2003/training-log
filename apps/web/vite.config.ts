import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // KTD13: custom worker in injectManifest mode. Registration is done by src/pwa/register.ts.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'prompt',
      manifest: {
        // Provisional: the product name is undecided.
        name: 'Training Log',
        short_name: 'Training Log',
        description: 'Registra tus entrenos sin conexión.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e0e0c',
        theme_color: '#0e0e0c',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // The shell, plus the catalog JSON from public/catalog (added by U9). A pattern
        // that matches nothing only logs a warning, so the build works before it exists.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,webmanifest}', 'catalog/exercises.es.v1.json'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Same origin in dev as in production: /api goes to the local Express process.
    // `vite preview` inherits this; the e2e suite points it at its own API with API_PROXY_TARGET.
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001' },
  },
})
