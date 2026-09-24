import { Link } from 'react-router-dom'
import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { Icons } from './Icons'
import { UniversityLogo } from './UniversityLogo'
import { getRecommendMeta } from '../lib/reviewDisplay'

// UniversityCard component
export const UniversityCard = ({ university }) => {
  const {
    name,
    name_zh,
    city,
    slug,
    logo_url,
    avg_rating,
    review_count,
    is_verified,
    recommendYesPct,
    recommendAnswered,
  } = university

  // Hidden below 2 answers — a lone "yes" rendering as "👍 100%" is noise.
  const recTier =
    (recommendYesPct ?? 0) >= 60 ? 'rec-yes' : (recommendYesPct ?? 0) >= 40 ? 'rec-maybe' : 'rec-no'
  // Emoji follows the tier so "0% recommend" doesn't carry a thumbs-up.
  const recEmoji = getRecommendMeta(recTier.replace('rec-', ''))?.emoji ?? '👍'

  const ratingDisplay =
    review_count > 0 ? (
      <div className="uni-card-rating">
        <StarRating rating={avg_rating} />
        <span className="num">{avg_rating?.toFixed(1) || '0.0'}</span>
        <span className="uni-card-count">
          {review_count} review{review_count !== 1 ? 's' : ''}
        </span>
      </div>
    ) : (
      <span className="uni-card-no-reviews">No reviews yet</span>
    )

  return (
    <Link to={`/university/${slug}/`} className="uni-card fade-in">
      <UniversityLogo name={name} logoUrl={logo_url} size={160} className="uni-card-img" />
      <div className="uni-card-body">
        <div>
          <div className="uni-card-name">{name}</div>
          <div className="uni-card-name-zh">{name_zh}</div>
        </div>
        <div className="uni-card-meta">
          <span className="uni-card-city">
            <Icons.MapPin /> {city}
          </span>
          {is_verified && <SealBadge />}
        </div>
        <div className="uni-card-meta">
          {ratingDisplay}
          {recommendAnswered >= 2 && (
            <span
              className={`review-recommend ${recTier}`}
              title={`Based on ${recommendAnswered} responses`}
            >
              <span aria-hidden="true">{recEmoji}</span> {recommendYesPct}%
              <span className="sr-only">
                {' '}
                of {recommendAnswered} reviewers recommend this university
              </span>
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
