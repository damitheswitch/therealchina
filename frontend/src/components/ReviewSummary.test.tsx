import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewSummary } from './ReviewSummary'
import { buildReviewSummary } from '../lib/reviewSummary'
import type { ReviewDisplayData } from '../lib/reviewDisplay'

type ReviewInput = ReviewDisplayData & { rating: number }

const base: ReviewInput = {
  rating: 4,
  program: null,
  degree_level: null,
  enrollment_status: null,
  start_year: null,
  end_year: null,
  language_of_instruction: null,
  tuition_range: null,
  living_cost_range: null,
  funding_type: null,
  funding_coverage: null,
  recommend: null,
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

const review = (overrides: Partial<ReviewInput>): ReviewInput => ({ ...base, ...overrides })

describe('ReviewSummary', () => {
  it('renders nothing when there are no reviews', () => {
    const { container } = render(<ReviewSummary summary={buildReviewSummary([])} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows histogram counts and percentages over answered only', () => {
    const summary = buildReviewSummary([
      review({ rating: 5, recommend: 'yes' }),
      review({ rating: 5, recommend: 'yes' }),
      review({ rating: 3 }),
      review({ rating: 1 }),
    ])
    const { container } = render(<ReviewSummary summary={summary} />)

    const counts = [...container.querySelectorAll('.hist-count')].map((el) => el.textContent)
    expect(counts).toEqual(['2', '0', '1', '0', '1'])
    // Both answered "yes" → 100%; the two legacy NULLs are excluded.
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows "No recommendation data yet" when nobody answered recommend', () => {
    render(<ReviewSummary summary={buildReviewSummary([review({}), review({})])} />)
    expect(screen.getByText('No recommendation data yet')).toBeInTheDocument()
  })

  it('shows the early-data note for 1–4 reviews and hides it at 5+', () => {
    const { unmount } = render(<ReviewSummary summary={buildReviewSummary([review({})])} />)
    expect(screen.getByText(/Early data/)).toBeInTheDocument()
    unmount()

    const five = Array.from({ length: 5 }, () => review({}))
    render(<ReviewSummary summary={buildReviewSummary(five)} />)
    expect(screen.queryByText(/Early data/)).not.toBeInTheDocument()
  })
})
