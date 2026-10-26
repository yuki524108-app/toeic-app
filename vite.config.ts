import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA化：ホーム画面に追加でき、一度開けばオフラインでも使える（学習データは元から端末内に保存されている）
    VitePWA({
      // 新しい版は、利用者が「更新する」を押したときに適用する。学習中・模試の受験中に、
      // 画面を開いたまま古い読み込み先が差し替わらないようにするため
      registerType: 'prompt',
      injectRegister: false, // 登録は src/main.tsx で行う
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TOEIC Drill',
        short_name: 'TOEIC Drill',
        description: 'TOEIC対策の学習アプリ。単語・文法・リスニング・読解・模試を、スキマ時間で。',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#16213E',
        background_color: '#EEF0F4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 画面（JS）・問題データ・CSS・アイコン・フォント（英数字の範囲）をあらかじめ保存し、オフラインで開けるようにする
        globPatterns: [
          '**/*.{js,css,html,svg,png,webmanifest}',
          'assets/*-latin-wght-normal-*.woff2',
          'assets/*-latin-opsz-normal-*.woff2',
        ],
        // 画面の移動はハッシュ（#/…）で行うため、開くページは常に index.html
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // 上記以外のフォントの範囲（ラテン拡張など）は、必要になったときに取得して保存する
        runtimeCaching: [
          {
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  build: {
    // 問題データ（読解・Part 1・単語など）は1ファイルが500kBを超えるが、該当の学習画面を開いたときだけ
    // 読み込まれる（ホーム画面は索引だけを使う）。最初に読み込まれるファイルは約300kBに収まっているため、
    // データのチャンクについては警告の基準を引き上げる。
    chunkSizeWarningLimit: 1200,
  },
  test: {
    // テストは tests/ に置く。画面のテストは各ファイルの先頭に `// @vitest-environment jsdom` を書いて実行する
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
  },
})
