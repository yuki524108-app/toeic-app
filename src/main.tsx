import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { registerSW } from 'virtual:pwa-register'
import { markUpdateAvailable } from './lib/appUpdate.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 最後の砦：アプリ全体（読み込み直後の処理など）でエラーが起きても、真っ白にならないようにする */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Service Worker を登録する（オフライン対応）。新しい版が用意できたら、利用者に更新を案内する
const updateServiceWorker = registerSW({
  onNeedRefresh() {
    markUpdateAvailable(() => updateServiceWorker(true));
  },
});
