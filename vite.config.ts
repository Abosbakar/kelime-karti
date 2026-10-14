/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Göreli yollar: uygulama alt dizinde (ör. GitHub Pages) de çalışır. Yönlendirme hash ile.
  base: './',
  // Veriler tarayıcıda adrese (port dahil) bağlı saklanır; port kayarsa kartlar "kaybolmuş" görünür.
  // Bu yüzden portlar sabit, doluysa başka porta geçmek yerine hata verilir.
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      // Yeni sürüm hazır olunca kullanıcıya sorulur; çalışma oturumu ortasında sayfa kendiliğinden yenilenmez.
      registerType: 'prompt',
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kelime Kartı',
        short_name: 'Kelime Kartı',
        description: 'Aralıklı tekrarla İngilizce kelime öğrenme',
        lang: 'tr',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f5fb',
        theme_color: '#5b4ff5',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // Excel okuyucu (~365 KB) ilk açılışta inmesin: yalnızca Excel'den ekleme yapılınca indirilir ve
        // sonra önbellekten (çevrimdışı da) çalışır. Böylece ilk açılış hafifler.
        globIgnores: ['**/spreadsheet-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/spreadsheet-[\w-]+\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'excel-okuyucu', expiration: { maxEntries: 2 } },
          },
        ],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
