import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthModalProvider } from './contexts/AuthModalContext'
import './styles/global.css'

registerSW({
  immediate: true,
  onOfflineReady() {
    console.log('The Real China is ready to work offline.')
  },
})

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AuthModalProvider>
            <App />
          </AuthModalProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
