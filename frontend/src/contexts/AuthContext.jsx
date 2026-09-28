import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { resetRedirectTo } from '../lib/passwordReset'
import { validateDisplayName } from '../lib/validateDisplayName'

/**
 * @typedef {import('@supabase/supabase-js').User} User
 * @typedef {import('@supabase/supabase-js').Session} Session
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {User | null} user
 * @property {Session | null} session
 * @property {boolean} loading
 * @property {(email: string, password: string, displayName: string) => Promise<unknown>} signUp
 * @property {(email: string, password: string) => Promise<unknown>} signIn
 * @property {() => Promise<unknown>} signInWithGoogle
 * @property {(email: string) => Promise<unknown>} resetPassword
 * @property {(password: string) => Promise<unknown>} updatePassword
 * @property {() => Promise<void>} signOut
 * @property {boolean} passwordRecovery — true once a PASSWORD_RECOVERY event
 *   arrives (recovery link landed); reset on sign-out.
 */

/**
 * @type {import('react').Context<AuthContextValue>}
 */
const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
  signOut: async () => {},
  passwordRecovery: false,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  /** @type {[User | null, (u: User | null) => void]} */
  const [user, setUser] = useState(null)
  /** @type {[Session | null, (s: Session | null) => void]} */
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, displayName) => {
    const { valid, error, normalized } = validateDisplayName(displayName)
    if (!valid) throw new Error(error)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: normalized,
        },
      },
    })

    if (signUpError) throw signUpError
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) throw error
    return data
  }

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectTo(),
    })

    if (error) throw error
    return data
  }

  const updatePassword = async (password) => {
    const { data, error } = await supabase.auth.updateUser({ password })

    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  /** @type {AuthContextValue} */
  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    resetPassword,
    updatePassword,
    signOut,
    passwordRecovery,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
