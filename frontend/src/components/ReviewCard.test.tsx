import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReviewCard } from './ReviewCard'

// Chainable supabase stub: every query method returns the same chain, and
// awaiting it resolves to an empty result ({data: null, error: null,
// count: 0}) — enough for UpvoteButton's mount effects. `then` must stay
// undefined or the await machinery would treat the chain as a thenable and
// hang forever.
const supabaseMock = vi.hoisted(() => {
  const chain = new Proxy(
    { data: null, error: null, count: 0 },
    {
      get(target, prop) {
        if (prop === 'then') return undefined
        if (prop in target) return target[prop as keyof typeof target]
        return vi.fn(() => chain)
      },
    }
  )
  return {
    chain,
    from: vi.fn(() => chain),
    rpc: vi.fn(async () => ({ data: [{ upvoted: false, upvote_count: 0 }], error: null })),
  }
})

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: supabaseMock.from, rpc: supabaseMock.rpc },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../hooks/useComments', () => ({
  useComments: () => ({
    comments: [],
    authorProfiles: {},
    loaded: true,
    refetch: vi.fn(),
  }),
}))

const baseReview = {
  id: 'rev-1',
  university_id: 'uni-1',
  user_id: null,
  rating: 4,
  text: 'Short and sweet.',
  media: null,
  created_at: '2024-03-01T00:00:00Z',
  enrollment_status: null,
  start_year: null,
  end_year: null,
  language_of_instruction: null,
  tuition_range: null,
  living_cost_range: null,
  funding_type: null,
  funding_coverage: null,
  recommend: null,
  program: null,
  degree_level: null,
  pros: null,
  cons: null,
  tags: null,
  rating_academics: null,
  rating_campus: null,
  rating_accommodation: null,
  rating_cost: null,
  rating_intl_office: null,
  rating_social: null,
  rating_extracurricular: null,
  rating_career: null,
}

const renderCard = (review: object, author: object | null = null) =>
  render(
    <MemoryRouter>
      <ReviewCard review={review} author={author} upvote={undefined} />
    </MemoryRouter>
  )

// Attribution rules: user_id NULL renders "Anonymous" and no Verified seal —
// that covers both never-claimed reviews and ones claimed anonymously (the
// private owner link never reaches the public row). A present user_id links
// to the author and earns the seal.
describe('ReviewCard attribution', () => {
  it('shows "Anonymous" and no Verified seal when user_id is null', () => {
    renderCard(baseReview)
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })

  it('links the author and shows the Verified seal when user_id is set', () => {
    renderCard({ ...baseReview, user_id: 'u-1' }, { display_name: 'Alex (SHU)', avatar_url: null })
    expect(screen.getByText('Alex (SHU)')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.queryByText('Anonymous')).not.toBeInTheDocument()
  })

  it('falls back to "Former member" for a deleted/missing profile', () => {
    renderCard({ ...baseReview, user_id: 'u-gone' }, null)
    expect(screen.getByText('Former member')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
  })
})

// jsdom reports 0 for scrollHeight/getComputedStyle dimensions, so the
// text-overflow collapse path can't be exercised here without property
// mocks — these tests cover the extras-driven path (the teaser chips and
// the expanded region).
describe('ReviewCard collapsible behaviour', () => {
  it('renders a short review with no extras exactly as before — no expand button', () => {
    renderCard(baseReview)
    expect(screen.getByText('Short and sweet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /full review/i })).not.toBeInTheDocument()
    expect(document.querySelector('.review-teaser')).not.toBeInTheDocument()
    expect(document.querySelector('.teaser-chip')).not.toBeInTheDocument()
  })

  it('shows teaser chips and hides extras until expanded', () => {
    renderCard({
      ...baseReview,
      pros: 'Great campus food',
      cons: 'Dorm wifi is slow',
      rating_academics: 5,
      rating_social: 4,
      tags: ['safe', 'friendly'],
    })

    // Collapsed: teaser advertises the hidden sections, extras stay hidden.
    expect(screen.getByText('Pros & cons')).toBeInTheDocument()
    expect(screen.getByText('2 category ratings')).toBeInTheDocument()
    expect(screen.getByText('2 tags')).toBeInTheDocument()
    expect(screen.queryByText('Great campus food')).not.toBeInTheDocument()
    expect(screen.queryByText('Academics')).not.toBeInTheDocument()
    expect(screen.queryByText('safe')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Read full review' }))

    expect(screen.getByText('Great campus food')).toBeInTheDocument()
    expect(screen.getByText('Dorm wifi is slow')).toBeInTheDocument()
    expect(screen.getByText('Academics')).toBeInTheDocument()
    expect(screen.getByText('safe')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Show less' })).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('button', { name: 'Show less' })[0])
    expect(screen.queryByText('Great campus food')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Read full review' })).toBeInTheDocument()
  })

  it('announces photos in the teaser and reveals the gallery on expand', () => {
    renderCard({
      ...baseReview,
      media: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    })

    expect(screen.getByText('2 photos')).toBeInTheDocument()
    expect(document.querySelector('.review-media-gallery')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Read full review' }))
    expect(document.querySelector('.review-media-gallery')).toBeInTheDocument()
  })
})

// The Phase 4 "Detailed" mark (lib/reviewDetail): 3+ filled detail areas
// carry a gold accent on the card and the expand pill's halo — glow only,
// no badge, and a screen-reader label so the mark isn't sighted-only.
describe('ReviewCard detailed mark', () => {
  // 3 areas without any photos: program + costs + pros.
  const detailedReview = {
    ...baseReview,
    program: 'Computer Science',
    tuition_range: '¥20k-¥40k',
    pros: 'Great campus food',
  }

  it('marks a detailed review with the gold accent and an sr-only label', () => {
    renderCard(detailedReview)
    expect(document.querySelector('.review-card.detailed')).toBeInTheDocument()
    expect(screen.getByText('Detailed review')).toBeInTheDocument()
  })

  it('leaves a publish-minimum review unmarked', () => {
    renderCard(baseReview)
    expect(document.querySelector('.review-card.detailed')).not.toBeInTheDocument()
    expect(screen.queryByText('Detailed review')).not.toBeInTheDocument()
  })

  it('glows the collapsed expand pill on detailed reviews', () => {
    renderCard(detailedReview)
    expect(document.querySelector('.review-expand-btn.rich')).toBeInTheDocument()
  })

  it('keeps the Verified seal distinct — no gold mark comes from user_id alone', () => {
    renderCard({ ...baseReview, user_id: 'u-1' }, { display_name: 'Alex', avatar_url: null })
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(document.querySelector('.review-card.detailed')).not.toBeInTheDocument()
    expect(screen.queryByText('Detailed review')).not.toBeInTheDocument()
  })
})
