import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReviewSuccess } from './ReviewSuccess'
import { emptyReviewFieldValues } from '../../lib/reviewFlow'
import type { ReviewForm } from '../../hooks/useReviewForm'

// reviewFlow pulls in reviewDrafts → supabaseClient, which throws on import
// without env vars (CI has none). The test never touches the client; a stub
// module is enough.
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } },
}))

// The success screen reads auth + profile contexts only through
// PublishedReviewPreview (author name / seal) and the sign-up offer. Stub
// them per test; the meter itself needs none of them.
const authState = vi.hoisted(() => ({ user: null as { id: string } | null }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user }),
}))

vi.mock('../../contexts/ProfileContext', () => ({
  useProfileContext: () => ({ profile: null }),
}))

const openAuthModal = vi.hoisted(() => vi.fn())
vi.mock('../../contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuthModal }),
}))

const formWith = (values: Partial<typeof emptyReviewFieldValues>): ReviewForm =>
  ({
    values: { ...emptyReviewFieldValues, rating: 4, reviewText: 'Solid two years.', ...values },
    set: vi.fn(),
    applyValues: vi.fn(),
  }) as unknown as ReviewForm

const renderSuccess = ({
  values = {},
  isAnonymous = false,
  canBoost = true,
}: {
  values?: Partial<typeof emptyReviewFieldValues>
  isAnonymous?: boolean
  canBoost?: boolean
} = {}) =>
  render(
    <MemoryRouter>
      <ReviewSuccess
        form={formWith(values)}
        media={[]}
        publishedAt="2026-10-10T12:00:00Z"
        universitySlug="fudan-university"
        isAnonymous={isAnonymous}
        canBoost={canBoost}
        onBoost={vi.fn()}
        onDone={vi.fn()}
      />
    </MemoryRouter>
  )

describe('ReviewSuccess strength meter (author-only)', () => {
  it('renders the meter for a signed-in publisher with the true score', () => {
    authState.user = { id: 'u-1' }
    // program + 4 ratings + tags = 3 filled areas
    renderSuccess({
      values: {
        program: 'MBBS',
        subscores: {
          rating_academics: 4,
          rating_campus: 3,
          rating_cost: 5,
          rating_social: 4,
        },
        selectedTags: ['Worth it'],
      },
    })
    const meter = screen.getByRole('meter', { name: 'Review strength' })
    expect(meter).toHaveAttribute('aria-valuenow', '3')
    expect(meter).toHaveAttribute('aria-valuemax', '7')
    expect(screen.getByText('3 of 7')).toBeInTheDocument()
    expect(screen.getByText(/Gold highlight earned/)).toBeInTheDocument()
  })

  it('renders the meter for an anonymous publisher too — their only feedback surface', () => {
    authState.user = null
    renderSuccess({ isAnonymous: true, canBoost: true })
    const meter = screen.getByRole('meter', { name: 'Review strength' })
    // Publish-minimum review (rating + text) scores 0 of 7.
    expect(meter).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText(/0 or more|Still missing:/)).toBeInTheDocument()
  })

  it('keeps the score out of the public preview card — one meter total', () => {
    authState.user = { id: 'u-1' }
    const { container } = renderSuccess({
      values: { program: 'MBBS', selectedTags: ['Worth it'] },
    })
    // The preview card itself must not carry the meter or a visible score —
    // it renders exactly what the public sees.
    expect(container.querySelectorAll('.strength-meter')).toHaveLength(1)
    expect(container.querySelector('.review-card .strength-meter')).not.toBeInTheDocument()
  })

  it('shows the meter even when Boost is unavailable (capability not stored)', () => {
    authState.user = null
    renderSuccess({ isAnonymous: true, canBoost: false })
    expect(screen.getByRole('meter', { name: 'Review strength' })).toBeInTheDocument()
    expect(screen.queryByText('Make it more useful in 60 seconds?')).not.toBeInTheDocument()
  })
})
