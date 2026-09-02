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
