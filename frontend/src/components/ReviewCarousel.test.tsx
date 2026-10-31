import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

import { ReviewCarousel } from './ReviewCarousel'
import type { LandingReview } from '../hooks/useHomeSections'

const review = (id: string): LandingReview => ({
  row: {
    id,
    university_id: `u-${id}`,
    rating: 5,
    text: 'x',
    pros: null,
    cons: null,
    tags: null,
    upvote_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    degree_level: null,
    start_year: null,
    end_year: null,
  },
  body: `Review body ${id}`,
  universityName: `Uni ${id}`,
  universitySlug: `uni-${id}`,
  universityLogoUrl: null,
})

const reviews = ['a', 'b', 'c'].map(review)

// jsdom has no layout, so give the track three 300px slides in a 300px frame.
const stubLayout = () => {
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get() {
      const li = this as HTMLElement
      return li.tagName === 'LI'
        ? Array.from(li.parentElement?.children ?? []).indexOf(li) * 300
        : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).tagName === 'UL' ? 900 : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return (this as HTMLElement).tagName === 'UL' ? 300 : 0
    },
  })
}

const stubMatchMedia = (reduced: boolean) => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const mount = () =>
  render(
    <MemoryRouter>
      <ReviewCarousel reviews={reviews} />
    </MemoryRouter>
  )

describe('ReviewCarousel', () => {
  let scrollTo: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    stubLayout()
    stubMatchMedia(false)
    scrollTo = vi.fn()
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances on its own every five seconds', () => {
    mount()
    expect(scrollTo).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' })
  })

  it('pauses while hovered and resumes after', () => {
    const { container } = mount()
    const root = container.querySelector('.home-carousel') as HTMLElement
    fireEvent.mouseEnter(root)
    act(() => {
      vi.advanceTimersByTime(12000)
    })
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.mouseLeave(root)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('pauses on keyboard focus and on touch', () => {
    const { container } = mount()
    const root = container.querySelector('.home-carousel') as HTMLElement
    fireEvent.focus(screen.getByRole('button', { name: 'Next review' }))
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(scrollTo).not.toHaveBeenCalled()
    fireEvent.blur(screen.getByRole('button', { name: 'Next review' }))
    fireEvent.touchStart(root)
    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does not autoplay when reduced motion is requested', () => {
    stubMatchMedia(true)
    mount()
    act(() => {
      vi.advanceTimersByTime(15000)
    })
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('has labelled buttons and a dot for each slide, with the current one marked', () => {
    mount()
    expect(screen.getByRole('button', { name: 'Previous review' })).toBeTruthy()
    const dots = screen.getAllByRole('button', { name: /Show review/ })
    expect(dots).toHaveLength(3)
    expect(dots[0].getAttribute('aria-current')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Next review' }))
    expect(scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' })
  })
})
