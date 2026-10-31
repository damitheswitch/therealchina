import { Link } from 'react-router-dom'
import {
  useHomeStats,
  useLandingReviews,
  useOpenQuestions,
  useUpcomingFlights,
} from '../hooks/useHomeSections'
import { reviewContextParts } from '../lib/homeSections'
import { REWARD_UI_ENABLED } from '../lib/reviewReward'
import type { PublicFlightRow } from '../lib/flightListings'
import { Icons } from './Icons'
import { StarRating } from './StarRating'

// Live sections of the home page. Each renders nothing until it has real data,
// so a quiet database never shows an empty heading.

const formatCount = (n: number): string => n.toLocaleString('en-US')

// One honest line under the hero search.
export const HomeStatLine = () => {
  const stats = useHomeStats()
  if (!stats || stats.universities < 1) return null
  const unis = `${formatCount(stats.universities)} ${stats.universities === 1 ? 'university' : 'universities'}`
  return (
    <p className="home-stat-line">
      {unis}
      {stats.reviews >= 1 && (
        <>
          {' · '}
          {formatCount(stats.reviews)} student {stats.reviews === 1 ? 'review' : 'reviews'}
        </>
      )}
    </p>
  )
}

export const HomeStudentsSay = () => {
  const reviews = useLandingReviews()
  if (!reviews) return null
  return (
    <section className="home-section" aria-labelledby="home-say-title">
      <div className="container">
        <div className="home-section-head">
          <h2 id="home-say-title" className="home-section-title">
            What students say
          </h2>
          <Link to="/reviews" className="home-section-link">
            See all reviews
          </Link>
        </div>
        <ul className="home-review-row">
          {reviews.map(({ row, body, universityName, universitySlug }) => {
            const context = reviewContextParts(row)
            return (
              <li key={row.id} className="home-review-card">
                <StarRating rating={row.rating} />
                <p className="home-review-text">{body}</p>
                <div className="home-review-meta">
                  <Link to={`/university/${universitySlug}`} className="home-review-uni">
                    {universityName}
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
      </div>
    </section>
  )
}

export const HomeStudentsAsking = () => {
  const questions = useOpenQuestions()
  if (!questions) return null
  return (
    <section className="home-section" aria-labelledby="home-asking-title">
      <div className="container">
        <div className="home-section-head">
          <h2 id="home-asking-title" className="home-section-title">
            Students are asking
          </h2>
          <Link to="/community" className="home-section-link">
            Browse the community
          </Link>
        </div>
        <p className="home-section-sub">
          Nobody has answered these yet. If you know, you can reply without an account.
        </p>
        <ul className="home-ask-list">
          {questions.map((q) => {
            const where = q.university_name ?? q.city
            return (
              <li key={q.id} className="home-ask-row">
                <div className="home-ask-body">
                  <Link to={`/community/q/${q.slug}`} className="home-ask-title">
                    {q.title}
                  </Link>
                  {where && <span className="home-ask-where">{where}</span>}
                </div>
                <Link
                  to={`/community/q/${q.slug}`}
                  className="btn btn-outline home-ask-action"
                  aria-label={`Answer: ${q.title}`}
                >
                  Answer
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export const HomeContributorBand = () => (
  <section className="home-band" aria-labelledby="home-band-title">
    <div className="container home-band-inner">
      <div>
        <h2 id="home-band-title" className="home-band-title">
          Studied in China?
        </h2>
        <p className="home-band-text">
          Your review helps the next student decide. It takes a few minutes.
          {REWARD_UI_ENABLED && ' Write a full one and we send you a free VPN as a thank you.'}
        </p>
      </div>
      <Link to="/review" className="btn btn-primary btn-lg">
        <Icons.Pen /> Leave a Review
      </Link>
    </div>
  </section>
)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Parse YYYY-MM-DD directly so the shown day never shifts with the timezone.
const formatDay = (iso: string | null): string => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]} ${y}`
}

const routeOf = (f: PublicFlightRow): string => {
  const from = f.departure_city || f.departure_country || 'Origin'
  const to = f.arrival_city || f.arrival_country || 'Destination'
  return `${from} to ${to}`
}

const flightFacts = (f: PublicFlightRow): string[] => {
  const parts = [formatDay(f.departure_date)]
  if (f.available_kgs != null) parts.push(`${f.available_kgs} kg free`)
  if (f.price_per_kg != null) parts.push(`${f.price_per_kg} ${f.currency ?? ''}`.trim() + '/kg')
  return parts.filter(Boolean)
}

export const HomeFlights = () => {
  const flights = useUpcomingFlights()
  if (!flights) return null
  return (
    <section className="home-section" aria-labelledby="home-flights-title">
      <div className="container">
        <div className="home-section-head">
          <h2 id="home-flights-title" className="home-section-title">
            Flights leaving soon
          </h2>
          <Link to="/flights" className="home-section-link">
            See all flights
          </Link>
        </div>
        <p className="home-section-sub">
          Students with spare luggage space on the way to or from China.
        </p>
        <ul className="home-flight-list">
          {flights.map((f) => (
            <li key={f.id ?? routeOf(f) + f.departure_date}>
              <Link to="/flights" className="home-flight-card">
                <span className="home-flight-route">{routeOf(f)}</span>
                <span className="home-flight-facts">
                  {flightFacts(f).map((fact) => (
                    <span key={fact}>{fact}</span>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
