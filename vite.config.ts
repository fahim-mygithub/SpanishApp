import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from a GitHub Pages project site at /SpanishApp/ (same setup as WorkOutAppRefactor).
// For a root deploy (custom domain), set BASE to '/'.
const BASE = '/SpanishApp/'

export default defineConfig(({ command }) => ({
  base: BASE,
  esbuild: command === 'build' ? { drop: ['debugger'] } : {},
  plugins: [
    VitePWA({
      // Custom service worker so it can receive push reminders (src/sw.ts).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Hoy · Spanish',
        short_name: 'Hoy',
        description: 'Five minutes of Spanish a day.',
        theme_color: '#121826',
        background_color: '#121826',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}))
