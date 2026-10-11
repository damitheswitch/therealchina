import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AppProviders } from './components/AppProviders'
import { isProdSite, isInstalledPwa, unregisterServiceWorkers, prodUrlFor } from './lib/pwa'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/700.css'
import '@fontsource/noto-serif-sc/900.css'
import './styles/global.css'

if (isProdSite()) {
  registerSW({
    immediate: true,
    onRegisteredSW: (_swUrl, registration) => {
      // Keep the installed app identical to prod: besides the update check
      // on load, re-check on every foreground and hourly while running.
      if (!registration) return
      const checkForUpdate = () => registration.update().catch(() => {})
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      setInterval(checkForUpdate, 60 * 60 * 1000)
    },
  })
} else {
  // Non-prod origins (staging, deploy previews, local) must never be
  // installable or cached: an installed PWA stays bound to its origin, so
  // a preview install would serve that build forever. Drop any leftover
  // registration, then send an existing non-prod install back to prod.
  unregisterServiceWorkers()
  // A SW registered before this gate existed can still satisfy installability
  // until unregister finishes — suppress the browser's own install UI.
  window.addEventListener('beforeinstallprompt', (event) => event.preventDefault())
  if (isInstalledPwa()) {
    window.location.replace(prodUrlFor(window.location.pathname, window.location.search))
  }
}

const container = document.getElementById('app')
const app = (
  <React.StrictMode>
    <BrowserRouter>
      <AppProviders prerenderData={window.__PRERENDERED_DATA__}>
        <App />
      </AppProviders>
    </BrowserRouter>
  </React.StrictMode>
)

// Prerendered pages ship HTML inside #app — hydrate it so the markup (and the
// embedded data) is reused. Bare pages (dev, SPA fallback) mount normally.
if (container.innerHTML.trim().length > 0) {
  ReactDOM.hydrateRoot(container, app)
} else {
  ReactDOM.createRoot(container).render(app)
}
