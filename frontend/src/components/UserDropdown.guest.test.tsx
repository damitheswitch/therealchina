import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProfileProvider } from '../contexts/ProfileContext'
import { UserDropdown } from './UserDropdown'

// Logged-out state: useProfile never fires (no user id), so the supabase mock
// only needs to satisfy the import — the profiles table is never queried.
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}))

const openAuthModalMock = vi.hoisted(() => vi.fn())
vi.mock('../contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuthModal: openAuthModalMock }),
}))

const renderDropdown = () =>
  render(
    <MemoryRouter>
      <ProfileProvider>
        <UserDropdown />
      </ProfileProvider>
    </MemoryRouter>
  )

describe('UserDropdown guest state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the seal trigger (我) instead of the bare person icon', () => {
    renderDropdown()
    const trigger = screen.getByRole('button', { name: 'Menu' })
    expect(trigger).toHaveClass('user-dropdown-trigger--guest')
    expect(screen.getByText('我')).toBeInTheDocument()
  })

  it('opens the redesigned guest menu: brand mark, welcome copy, stacked CTAs', async () => {
    renderDropdown()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))

    expect(await screen.findByText('Welcome to The Real China')).toBeInTheDocument()
    expect(screen.getByText('Sign in to review & connect with students')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create free account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    // Nav links still present for guests (primary nav on mobile).
    expect(screen.getByRole('link', { name: /Universities/ })).toBeInTheDocument()
  })

  it('routes CTAs to the auth modal and closes the menu', async () => {
    renderDropdown()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Create free account' }))
    expect(openAuthModalMock).toHaveBeenCalledWith('register')
    expect(screen.queryByText('Welcome to The Real China')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(openAuthModalMock).toHaveBeenCalledWith('login')
  })
})
