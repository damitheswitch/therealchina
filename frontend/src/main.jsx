import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthModalProvider } from './contexts/AuthModalContext'
import { ProfileProvider } from './contexts/ProfileContext'
import { ErrorBoundary } from './components/ErrorBoundary'
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

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <ProfileProvider>
            <ToastProvider>
              <AuthModalProvider>
                <App />
              </AuthModalProvider>
            </ToastProvider>
          </ProfileProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
)
