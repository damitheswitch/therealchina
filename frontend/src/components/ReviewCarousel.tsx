import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LandingReview } from '../hooks/useHomeSections'
import {
  CAROUSEL_INTERVAL_MS,
  nearestSlide,
  reviewContextParts,
  slideStops,
  stepIndex,
} from '../lib/homeSections'
import { StarRating } from './StarRating'
import { UniversityLogo } from './UniversityLogo'

// Review slider: native scroll-snap (swipe works everywhere), prev/next
// buttons and dots on top, and a slow autoplay that backs off whenever the
// visitor is looking at, pointing at or touching it, or has asked the system
// for reduced motion. Everything browser-only lives in effects.

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

const useTabHidden = (): boolean => {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === 'hidden')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return hidden
}

const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const ReviewCarousel = ({ reviews }: { reviews: LandingReview[] }) => {
  const trackRef = useRef<HTMLUListElement>(null)
  const frameRef = useRef(0)
  const [stops, setStops] = useState<number[]>([0])
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touching, setTouching] = useState(false)
  const reduced = usePrefersReducedMotion()
  const tabHidden = useTabHidden()

  const count = stops.length
  const paused = hovered || focused || touching || tabHidden || reduced

  // Measure the scroll stops now and whenever the track or its slides resize.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0
      const offsets = Array.from(track.children).map((c) => (c as HTMLElement).offsetLeft - pad)
      const next = slideStops(offsets, track.scrollWidth - track.clientWidth)
      setStops((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next
      )
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(track)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [reviews.length])

  // Only the scroll position decides the current slide, so smooth scrolling
  // never makes the dots flicker back and forth.
  const onScroll = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      const track = trackRef.current
      if (!track) return
      setIndex(nearestSlide(track.scrollLeft, track.scrollWidth - track.clientWidth, stops))
    })
  }, [stops])

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    },
    []
  )

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current
      const left = stops[i]
      if (!track || left === undefined) return
      track.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' })
    },
    [stops, reduced]
  )

  // Autoplay. The timer restarts on every slide change, so a swipe or click
  // always gets a full interval before the next move.
  useEffect(() => {
    if (paused || count < 2) return
    const timer = window.setInterval(() => goTo(stepIndex(index, 1, count)), CAROUSEL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [paused, count, index, goTo])

  return (
    <div
      className="home-carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={() => setTouching(false)}
      onTouchCancel={() => setTouching(false)}
    >
      <ul
        ref={trackRef}
        className="home-review-row"
        onScroll={onScroll}
        aria-label="Student reviews"
        aria-live={paused ? 'polite' : 'off'}
      >
        {reviews.map(({ row, body, universityName, universitySlug, universityLogoUrl }) => {
          const context = reviewContextParts(row)
          return (
            <li key={row.id} className="home-review-card">
              <StarRating rating={row.rating} />
              <p className="home-review-text">{body}</p>
              <div className="home-review-meta">
                <Link to={`/university/${universitySlug}`} className="home-review-uni">
                  <span className="home-review-logo" aria-hidden="true">
                    <UniversityLogo name={universityName} logoUrl={universityLogoUrl} size={40} />
                  </span>
                  <span>{universityName}</span>
                </Link>
                {context.length > 0 && (
                  <span className="home-review-context">
                    {context.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {count > 1 && (
        <div className="home-carousel-controls">
          <button
            type="button"
            className="home-carousel-btn"
            aria-label="Previous review"
            onClick={() => goTo(stepIndex(index, -1, count))}
          >
            <Chevron dir="left" />
          </button>
          <div className="home-carousel-dots">
            {stops.map((stop, i) => (
              <button
                key={stop}
                type="button"
                className="home-carousel-dot"
                aria-label={`Show review ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="home-carousel-btn"
            aria-label="Next review"
            onClick={() => goTo(stepIndex(index, 1, count))}
          >
            <Chevron dir="right" />
          </button>
        </div>
      )}
    </div>
  )
}
