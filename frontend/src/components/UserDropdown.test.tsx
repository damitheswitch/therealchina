import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { ProfileProvider, useProfileContext } from '../contexts/ProfileContext'
import type { Profile } from '../hooks/useProfile'
import { UserDropdown } from './UserDropdown'

// Controllable supabase mock: useProfile calls
// supabase.from('profiles').select(...).eq('id', userId).single().
// `setCurrent` swaps the row returned by subsequent queries so we can simulate
// a profile save + refetch updating the header.
const supabaseMock = vi.hoisted(() => {
  let current: Profile | null = null
  const single = vi.fn(async () => ({ data: current, error: null }))
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  // `from` is typed as a rest-parameter function so it can accept a spread
  // of `unknown[]` when forwarded from the supabaseClient mock below.
  const from = vi.fn((..._args: unknown[]) => ({ select }))
  return {
    from,
    single,
    setCurrent: (p: Profile | null) => {
      current = p
    },
  }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => supabaseMock.from(...args) },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    // user_metadata.display_name is the STALE value that the header used to show.
    user: {
      id: 'user-1',
      email: 'tester@example.com',
      user_metadata: { display_name: 'StaleAuthName' },
    },
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('../contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuthModal: vi.fn() }),
}))

const profileRow = (display_name: string): Profile => ({
  display_name,
  bio: null,
  location: null,
  university: null,
  program: null,
  social_handles: null,
  social_platform: null,
  social_handle: null,
  show_social_handle: true,
  is_discoverable: true,
  onboarding_completed: true,
})

// Captures the live ProfileContext value (incl. refetch) from the same provider
// instance that wraps UserDropdown, so we can drive a refetch and assert the
// header re-renders with the new name.
let capturedRefetch: (() => Promise<Profile | null>) | null = null
const CtxProbe = () => {
  const { refetch } = useProfileContext()
  useEffect(() => {
    capturedRefetch = refetch
  }, [refetch])
  return null
}

const renderDropdown = () =>
  render(
    <MemoryRouter>
      <ProfileProvider>
        <CtxProbe />
        <UserDropdown />
      </ProfileProvider>
    </MemoryRouter>
  )

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'User menu' }))

describe('UserDropdown display-name sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedRefetch = null
    supabaseMock.setCurrent(profileRow('ProfileName'))
  })

  it('renders the profiles record display_name, not stale auth user_metadata', async () => {
    renderDropdown()
    openMenu()
    // The profiles row wins over the stale auth metadata value.
    await waitFor(() => expect(screen.getByText('ProfileName')).toBeInTheDocument())
    expect(screen.queryByText('StaleAuthName')).not.toBeInTheDocument()
  })

  it('updates the header immediately after a profile save refetch', async () => {
    renderDropdown()
    openMenu()
    await waitFor(() => expect(screen.getByText('ProfileName')).toBeInTheDocument())

    // Simulate a successful profile save: the profiles row changes and the
    // save flow calls refetch() to refresh the app-wide profile record.
    supabaseMock.setCurrent(profileRow('UpdatedName'))
    await act(async () => {
      await capturedRefetch?.()
    })

    await waitFor(() => expect(screen.getByText('UpdatedName')).toBeInTheDocument())
    expect(screen.queryByText('ProfileName')).not.toBeInTheDocument()
    expect(screen.queryByText('StaleAuthName')).not.toBeInTheDocument()
  })
})
