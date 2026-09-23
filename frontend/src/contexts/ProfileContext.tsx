import { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'
import { useProfile, type Profile } from '../hooks/useProfile'

type ProfileContextValue = {
  profile: Profile | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<Profile | null>
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

export const useProfileContext = (): ProfileContextValue => {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfileContext must be used within a ProfileProvider')
  }
  return context
}

// ProfileProvider - app-wide access to the current user's profiles record.
// The profiles table is the single source of truth for display_name and other
// profile fields. Auth user_metadata is only a seed/fallback, never a live store.
export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth()
  const { profile, loading, error, refetch } = useProfile(user?.id)

  const value: ProfileContextValue = { profile, loading, error, refetch }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
