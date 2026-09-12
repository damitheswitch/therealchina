import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UniversityCard } from './UniversityCard'

const uni = (overrides: Record<string, unknown> = {}) => ({
  name: 'Tsinghua University',
  name_zh: '清华大学',
  slug: 'tsinghua',
  city: 'Beijing',
  logo_url: 'https://example.com/logo.jpg',
  avg_rating: 4.5,
  review_count: 8,
  is_verified: false,
  recommendYesPct: 75,
  recommendAnswered: 4,
  ...overrides,
})

const renderCard = (u: ReturnType<typeof uni>) =>
  render(
    <MemoryRouter>
      <UniversityCard university={u} />
    </MemoryRouter>
  )

describe('UniversityCard', () => {
  it('shows "No reviews yet" and no count when review_count is 0', () => {
    renderCard(uni({ review_count: 0, avg_rating: null, recommendAnswered: 0 }))
    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
    expect(screen.queryByText(/reviews?$/)).not.toBeInTheDocument()
  })

  it('renders the review count inside the rating group', () => {
    const { container } = renderCard(uni())
    const rating = container.querySelector('.uni-card-rating')
    expect(rating?.querySelector('.uni-card-count')?.textContent).toBe('8 reviews')
  })

  it('uses singular "review" for a count of 1', () => {
    const { container } = renderCard(uni({ review_count: 1, recommendAnswered: 0 }))
    expect(container.querySelector('.uni-card-count')?.textContent).toBe('1 review')
  })
})

describe('UniversityCard recommend pill', () => {
  it('is hidden when fewer than 2 reviewers answered recommend', () => {
    const { container } = renderCard(uni({ recommendYesPct: 100, recommendAnswered: 1 }))
    expect(container.querySelector('.review-recommend')).toBeNull()
  })

  it('renders with the yes tier and a response-count title at >=2 answers', () => {
    const { container } = renderCard(uni({ recommendYesPct: 75, recommendAnswered: 4 }))
    const pill = container.querySelector('.review-recommend')
    expect(pill).toHaveTextContent('👍 75%')
    expect(pill).toHaveClass('rec-yes')
    expect(pill).toHaveAttribute('title', 'Based on 4 responses')
    // sr-only context for screen readers / keyboard users
    expect(pill).toHaveTextContent('of 4 reviewers recommend')
  })

  it.each([
    [60, 'rec-yes', '👍'],
    [40, 'rec-maybe', '🤔'],
    [39, 'rec-no', '👎'],
    [0, 'rec-no', '👎'],
  ])('pins tier boundary %i%% -> %s', (pct, tier, emoji) => {
    const { container } = renderCard(uni({ recommendYesPct: pct, recommendAnswered: 5 }))
    const pill = container.querySelector('.review-recommend')
    expect(pill).toHaveClass(tier)
    expect(pill).toHaveTextContent(`${emoji} ${pct}%`)
  })
})
