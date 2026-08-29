import { createContext, useContext, useState, useCallback } from 'react'

const AuthModalContext = createContext({
  isOpen: false,
  initialMode: 'login',
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

  const openAuthModal = useCallback((mode = 'login') => {
    setInitialMode(mode)
    setIsOpen(true)
  }, [])

  const closeAuthModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <AuthModalContext.Provider value={{ isOpen, initialMode, openAuthModal, closeAuthModal }}>
      {children}
    </AuthModalContext.Provider>
  )
}
