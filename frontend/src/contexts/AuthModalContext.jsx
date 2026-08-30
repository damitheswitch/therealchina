import { createContext, useContext, useState, useCallback } from 'react'

const AuthModalContext = createContext({
  isOpen: false,
  initialMode: 'login',
  config: {},
  openAuthModal: () => {},
  closeAuthModal: () => {},
})

export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext)
  if (!ctx) {
    throw new Error('useAuthModal must be used within an AuthModalProvider')
  }
  return ctx
}

export const AuthModalProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [initialMode, setInitialMode] = useState('login')
  const [config, setConfig] = useState({})

  const openAuthModal = useCallback((mode = 'login', nextConfig = {}) => {
    setInitialMode(mode)
    setConfig(nextConfig)
    setIsOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsOpen(false)
    setConfig({})
  }, [])

  return (
    <AuthModalContext.Provider value={{ isOpen, initialMode, config, openAuthModal, closeAuthModal }}>
      {children}
    </AuthModalContext.Provider>
  )
}
