import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
      ],
      manifest: {
        name: 'The Real China',
        short_name: 'TRC',
        description: 'Authentic student reviews for universities in China.',
        theme_color: '#A6192E',
        background_color: '#FAF6EF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // No html: prerendered pages must be fetched fresh so metadata and
        // content never go stale behind the service worker.
        globPatterns: ['**/*.{js,css,svg,png,jpg,jpeg,webp,woff2}'],
        // Logos/OG/data payloads and CJK font slices are fetched on demand —
        // precaching hundreds of them would balloon install size.
        globIgnores: ['logos/**', 'og/**', 'data/**', 'media/**', 'assets/noto-serif-sc-*'],
        // No navigation fallback: unknown URLs must reach the server so real
        // 404s and generated redirects work.
        navigateFallback: null,
      },
      devOptions: {
        // Off by default: an active service worker in dev causes stale-cache
        // confusion. Enable temporarily only when intentionally debugging the SW.
        enabled: false,
      },
    }),
  ],
  // Prerender (vite-node): keep router packages in-process so StaticRouter
  // and the app's hooks share one module instance / context.
  ssr: {
    noExternal: ['react-router-dom', 'react-router', '@remix-run/router'],
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy /api requests to Supabase (using anon key via server-side)
      // Note: Supabase JS client is called directly from browser
      // This proxy is for any future edge functions or custom API
    },
  },
})
