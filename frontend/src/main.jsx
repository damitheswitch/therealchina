import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AppProviders } from './components/AppProviders'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/700.css'
import '@fontsource/noto-serif-sc/900.css'
import './styles/global.css'

registerSW({ immediate: true })

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
