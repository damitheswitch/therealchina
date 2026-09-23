import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUniversity } from '../hooks/useUniversity'
import { useUniversityReviews } from '../hooks/useUniversityReviews'
import { useUniversityStats } from '../hooks/useUniversityStats'
import { buildReviewSummary } from '../lib/reviewSummary'
import { buildUniversityExtras } from '../lib/universityExtras'
import { StarRating } from '../components/StarRating'
import { SealBadge } from '../components/SealBadge'
import { ReviewCard } from '../components/ReviewCard'
import { ReviewSummary } from '../components/ReviewSummary'
import {
  UniversityPrograms,
  UniversityFunding,
  UniversityPhotoStrip,
} from '../components/UniversityExtras'
import { RegistrationNudge } from '../components/RegistrationNudge'
import { Icons } from '../components/Icons'

// ShanghaiRanking 软科 category tokens → display labels
const CATEGORY_LABELS = {
  comprehensive: 'Comprehensive',
  stem: 'Science & Tech',
  normal: 'Normal',
  agriculture: 'Agricultural',
  forestry: 'Forestry',
  medicine: 'Medical',
  finance: 'Finance & Economics',
  language: 'Language',
  politics: 'Politics & Law',
  ethnic: 'Minzu',
  sports: 'Sports',
  arts: 'Arts',
  tcm: 'TCM',
  cooperative: 'Cooperative',
}

// UniversityPage component
export const UniversityPage = () => {
  const { slug } = useParams()
  const { university, loading: uniLoading } = useUniversity(slug)
  const universityId = university?.id
  const { reviews, authors, loading: reviewsLoading } = useUniversityReviews(universityId)
  const { stats, loading: statsLoading } = useUniversityStats(universityId)
  // Hooks must sit before the early returns below; reviews defaults to [] so
  // both builders are safe no-ops during loading.
  const summary = useMemo(() => buildReviewSummary(reviews), [reviews])
  const extras = useMemo(() => buildUniversityExtras(reviews), [reviews])

  // Reviews and stats only fire after the university row resolves, so the
  // page is considered loading until the university is done AND (if it was
  // found) the dependent queries are done too.
  const loading = uniLoading || (university ? reviewsLoading || statsLoading : false)

  if (loading) {
    return (
      <div className="container">
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!university) {
    return (
      <div className="container">
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <h1>University not found</h1>
          <p>This university doesn&apos;t exist in our database.</p>
          <Link to="/" className="btn btn-primary mt-2">
            <Icons.ArrowLeft /> Back to all universities
          </Link>
        </div>
      </div>
    )
  }

  const avgRating = stats?.avg_rating || 0
  const reviewCount = stats?.review_count || 0
  const hasVerified = stats?.has_verified_review || false
  // municipalities are their own province — don't render "Beijing, Beijing"
  const location = [
    university.city,
    university.province && university.province !== university.city ? university.province : null,
    university.country,
  ]
    .filter(Boolean)
    .join(', ')
  const categoryLabel = CATEGORY_LABELS[university.uni_category] ?? null
  const rankings =
    university.rankings &&
    typeof university.rankings === 'object' &&
    !Array.isArray(university.rankings)
      ? university.rankings
      : {}
  const rankNational =
    typeof rankings.shanghai_national === 'number' ? rankings.shanghai_national : null
  const rankWorld = typeof rankings.arwu_world === 'number' ? rankings.arwu_world : null
  const shanghaiScore = typeof rankings.shanghai_score === 'number' ? rankings.shanghai_score : null
  const rankUrl =
    typeof rankings.shanghai_url === 'string'
      ? rankings.shanghai_url
      : 'https://www.shanghairanking.cn/rankings/bcur'

  const ratingBlock =
    reviewCount > 0 ? (
      <div className="uni-profile-rating-block">
        <span className="rating-number">{avgRating.toFixed(1)}</span>
        <div className="rating-info">
          <StarRating rating={avgRating} sizeClass="stars-lg" />
          <span className="count">
            Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}
          </span>
        </div>
        {hasVerified && <SealBadge large={true} />}
      </div>
    ) : (
      <div className="uni-profile-rating-block">
        <span className="rating-number">—</span>
        <div className="rating-info">
          <StarRating rating={0} sizeClass="stars-lg" />
          <span className="count">No reviews yet — be the first!</span>
        </div>
      </div>
    )

  return (
    <div className="container">
      <Link to="/" className="btn btn-outline mt-3" style={{ marginBottom: 0 }}>
        <Icons.ArrowLeft /> All universities
      </Link>

      <div className="uni-profile-header">
        <div className="uni-profile-top">
          <div className="uni-profile-identity">
            {university.logo_url && (
              <img
                src={university.logo_url}
                alt={`${university.name} campus`}
                className="uni-profile-logo"
              />
            )}
            <div className="uni-profile-name-block">
              <div className="uni-profile-city">
                <Icons.MapPin /> {location}
              </div>
              <h1>{university.name}</h1>
              <div className="uni-profile-name-zh">{university.name_zh}</div>
              <div className="uni-profile-badges">
                {rankNational !== null && (
                  <a
                    className="uni-rank-chip"
                    href={rankUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View this university's current ranking on ShanghaiRanking (软科)"
                  >
                    #{rankNational} in China · ShanghaiRanking <span aria-hidden="true">↗</span>
                  </a>
                )}
                {rankWorld !== null && (
                  <span className="uni-rank-chip" title="Academic Ranking of World Universities">
                    #{rankWorld} worldwide · ARWU
                  </span>
                )}
                {categoryLabel && (
                  <span className="uni-cat-chip" title="University category (软科)">
                    {categoryLabel}
                  </span>
                )}
                {shanghaiScore !== null && (
                  <span className="uni-meta-text" title="ShanghaiRanking total score">
                    Score {shanghaiScore}
                  </span>
                )}
                {extras.programCount > 0 && (
                  <span className="uni-meta-text">
                    {extras.programCount} program{extras.programCount === 1 ? '' : 's'} reviewed
                  </span>
                )}
                {university.website && (
                  <a
                    href={university.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="uni-site-link"
                  >
                    Official website <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          <Link to={`/review?uni=${university.slug}`} className="btn btn-primary btn-lg">
            <Icons.Pen /> Leave a Review
          </Link>
        </div>
        {ratingBlock}
      </div>

      <div className="uni-profile-layout">
        <div className="uni-photos-cell">
          <UniversityPhotoStrip extras={extras} />
        </div>
        <div className="uni-verdict-cell">
          <ReviewSummary summary={summary} />
        </div>
        <aside className="uni-profile-aside">
          <UniversityFunding extras={extras} />
          <UniversityPrograms extras={extras} />
        </aside>
        <div className="uni-reviews-cell">
          <div className="section" style={{ paddingTop: 'var(--sp-1)' }}>
            <h2 className="section-title">Student Reviews</h2>
            <div className="review-list">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    author={authors[review.user_id] ?? null}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <h3>No reviews yet</h3>
                  <p>Be the first to share your experience at {university.name}.</p>
                  <Link to={`/review?uni=${university.slug}`} className="btn btn-primary mt-2">
                    <Icons.Pen /> Leave a Review
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <RegistrationNudge />
    </div>
  )
}
