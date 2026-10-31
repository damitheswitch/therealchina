import { Link } from 'react-router-dom'
import {
  useHomeLogos,
  useHomeStats,
  useLandingReviews,
  useOpenQuestions,
  useUpcomingFlights,
} from '../hooks/useHomeSections'
import { REWARD_UI_ENABLED } from '../lib/reviewReward'
import type { PublicFlightRow } from '../lib/flightListings'
import { Icons } from './Icons'
import { ReviewCarousel } from './ReviewCarousel'

// Homepage chapters. Each one is a full-width field of its own colour and
// always renders: while data loads it holds its space, and when there is
// nothing to show it says so in a line or two with a way in.

const formatCount = (n: number): string => n.toLocaleString('en-US')

// The red seal chop that marks each chapter, drawn as text so it stays crisp.
const Seal = ({ char, tone = 'red' }: { char: string; tone?: 'red' | 'rice' }) => (
  <span className={`home-seal home-seal--${tone}`} aria-hidden="true" lang="zh-Hans">
    {char}
  </span>
)

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

// Real campus logos, mirrored under /logos. Hidden when none are available.
export const HomeHeroLogos = () => {
  const logos = useHomeLogos()
  if (!logos || logos.length === 0) return null
  return (
    <ul className="home-logo-wall" aria-label="Universities students have reviewed">
      {logos.map((l) => (
        <li key={l.id}>
          <Link to={`/university/${l.slug}`} className="home-logo-tile" aria-label={l.name}>
            <img src={l.src} alt="" width={64} height={64} loading="lazy" decoding="async" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export const HomeSeamSeal = () => (
  <div className="home-seam-seal" aria-hidden="true">
    <span lang="zh-Hans">真</span>
  </div>
)

export const HomeStudentsSay = () => {
  const reviews = useLandingReviews()
  return (
    <section
      className="home-chapter home-chapter--paper"
      aria-labelledby="home-say-title"
      aria-busy={reviews === null}
    >
      <div className="container">
        <div className="home-section-head">
          <div className="home-section-heading">
            <Seal char="评" />
            <h2 id="home-say-title" className="home-section-title">
              What students say
            </h2>
          </div>
          <Link to="/reviews" className="home-section-link">
            See all reviews
          </Link>
        </div>
        {reviews === null && <div className="home-hold home-hold--tall" />}
        {reviews !== null && reviews.length > 0 && <ReviewCarousel reviews={reviews} />}
        {reviews !== null && reviews.length === 0 && (
          <p className="home-empty">
            <span>No reviews to show yet.</span>
            <Link to="/review" className="home-empty-link">
              Write the first one
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}

export const HomeStudentsAsking = () => {
  const questions = useOpenQuestions()
  return (
    <section
      className="home-chapter home-chapter--warm"
      aria-labelledby="home-asking-title"
      aria-busy={questions === null}
    >
      <div className="container">
        <div className="home-section-head">
          <div className="home-section-heading">
            <Seal char="问" />
            <h2 id="home-asking-title" className="home-section-title">
              Students are asking
            </h2>
          </div>
          <Link to="/community" className="home-section-link">
            Browse the community
          </Link>
        </div>
        {questions === null && <div className="home-hold" />}
        {questions !== null && questions.length > 0 && (
          <>
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
          </>
        )}
        {questions !== null && questions.length === 0 && (
          <p className="home-empty">
            <span>No open questions right now.</span>
            <Link to="/community/ask" className="home-empty-link">
              Ask one
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}

export const HomeContributorBand = () => (
  <section className="home-chapter home-chapter--red" aria-labelledby="home-band-title">
    <div className="container home-band-inner">
      <div className="home-band-copy">
        <Seal char="写" tone="rice" />
        <div>
          <h2 id="home-band-title" className="home-band-title">
            Studied in China?
          </h2>
          <p className="home-band-text">
            Your review helps the next student decide. It takes a few minutes.
            {REWARD_UI_ENABLED && ' Write a full one and we send you a free VPN as a thank you.'}
          </p>
        </div>
      </div>
      <Link to="/review" className="btn btn-lg home-band-btn">
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
  return (
    <section
      className="home-chapter home-chapter--ink"
      aria-labelledby="home-flights-title"
      aria-busy={flights === null}
    >
      <div className="container">
        <div className="home-section-head">
          <div className="home-section-heading">
            <Seal char="飞" />
            <h2 id="home-flights-title" className="home-section-title">
              Flights leaving soon
            </h2>
          </div>
          <Link to="/flights" className="home-section-link">
            See all flights
          </Link>
        </div>
        {flights === null && <div className="home-hold" />}
        {flights !== null && flights.length > 0 && (
          <>
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
          </>
        )}
        {flights !== null && flights.length === 0 && (
          <p className="home-empty">
            <span>No flights listed yet. Flying to or from China soon?</span>
            <Link to="/flights" className="home-empty-link">
              List your spare kilos
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
