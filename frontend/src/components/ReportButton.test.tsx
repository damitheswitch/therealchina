import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportButton } from './ReportButton'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  openAuthModal: vi.fn(),
  showToast: vi.fn(),
  user: null as { id: string } | null,
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuthModal: mocks.openAuthModal }),
}))
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.openAuthModal.mockReset()
  mocks.showToast.mockReset()
  mocks.user = null
})

describe('ReportButton', () => {
  it('asks signed-out visitors to sign in instead of reporting', async () => {
    render(<ReportButton targetType="review" targetId="r1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Report this review' }))
    expect(mocks.openAuthModal).toHaveBeenCalledWith('login')
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('sends the report through content-report and locks the button', async () => {
    mocks.user = { id: 'u1' }
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })
    render(<ReportButton targetType="comment" targetId="c1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Report this comment' }))

    expect(mocks.invoke).toHaveBeenCalledWith('content-report', {
      body: { targetType: 'comment', targetId: 'c1' },
    })
    const done = await screen.findByRole('button', { name: 'Report this comment: reported' })
    expect(done).toBeDisabled()
    expect(mocks.showToast).toHaveBeenCalledWith(expect.any(String), 'success')
  })

  it('re-enables the button when the report fails', async () => {
    mocks.user = { id: 'u1' }
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('boom') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ReportButton targetType="review" targetId="r1" />)

    await userEvent.click(screen.getByRole('button', { name: 'Report this review' }))

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith(expect.any(String), 'error'))
    expect(screen.getByRole('button', { name: 'Report this review' })).toBeEnabled()
  })
})
