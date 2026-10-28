import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Shared mock data and contracts from Agent C live in ../src/data.
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('../src/data/index.ts', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fake OCTA Coach',
        short_name: 'Fake OCTA Coach',
        description: 'Safer driving, explained: a transparent driving score, one tip a week, and an illustrative OCTA estimate.',
        lang: 'en',
        theme_color: '#ff6d45',
        background_color: '#f8f9fb',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
