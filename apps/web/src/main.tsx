import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { captureInstallPrompt } from './pwa/install-prompt'
import { registerServiceWorker } from './pwa/register'
import './ui/theme.css'

const root = document.getElementById('root')
if (!root) throw new Error('root element missing')

captureInstallPrompt()
if (import.meta.env.PROD) registerServiceWorker()

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
