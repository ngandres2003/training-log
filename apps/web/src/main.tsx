import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Intro, shouldPlayIntro } from './app/intro/Intro'
import { createAppRouter } from './app/router'
import './features/workout/register'
import { captureInstallPrompt } from './pwa/install-prompt'
import { ensurePushSubscription } from './pwa/push'
import { registerServiceWorker } from './pwa/register'
import './ui/theme.css'
import { ThemeSync } from './ui/theme'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

captureInstallPrompt()
if (import.meta.env.PROD) {
  registerServiceWorker()
  // Re-registers this device's push subscription (no-op without permission or session).
  void ensurePushSubscription()
}

const router = createAppRouter()
const playIntro = shouldPlayIntro()

createRoot(root).render(
  <StrictMode>
    <ThemeSync />
    <RouterProvider router={router} />
    {playIntro && <Intro />}
  </StrictMode>,
)
