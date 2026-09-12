import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

  it('marks the reported cost bucket on the stepped scale', () => {
    const summary = buildReviewSummary([
      review({ living_cost_range: '¥4k–¥8k', tuition_range: '¥20k–¥40k' }),
      review({ living_cost_range: '¥4k–¥8k' }),
    ])
    const { container } = render(<ReviewSummary summary={summary} />)

    const rows = container.querySelectorAll('.cost-row')
    expect(rows.length).toBe(2)
    const livingSegs = rows[0].querySelectorAll('.cost-seg')
    expect(livingSegs.length).toBe(4) // 4 living-cost buckets
    expect(livingSegs[2].classList.contains('on')).toBe(true) // '¥4k–¥8k' is index 2
    expect(livingSegs[0].classList.contains('filled')).toBe(true)
    expect(livingSegs[3].classList.contains('filled')).toBe(false)
    expect(screen.getByText('¥4k–¥8k/mo')).toBeInTheDocument()
    expect(screen.getByText('¥20k–¥40k/yr')).toBeInTheDocument()
  })

  it('renders the cost text without a highlighted segment for unknown buckets', () => {
    const summary = buildReviewSummary([
      review({ living_cost_range: 'Something custom', tuition_range: '¥20k–¥40k' }),
    ])
    const { container } = render(<ReviewSummary summary={summary} />)
    const livingRow = container.querySelector('.cost-row')
    expect(livingRow).not.toBeNull()
    expect(within(livingRow as HTMLElement).getByText('Something custom/mo')).toBeInTheDocument()
    expect(livingRow?.querySelector('.cost-seg.on')).toBeNull()
    // The known-bucket tuition row still highlights its segment.
    expect(container.querySelectorAll('.cost-seg.on')).toHaveLength(1)
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
