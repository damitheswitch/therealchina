import { Link } from 'react-router-dom'
import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { Icons } from './Icons'

// UniversityCard component
export const UniversityCard = ({ university }) => {
  const { name, name_zh, city, slug, logo_url, avg_rating, review_count, is_verified } = university

  const ratingDisplay =
    review_count > 0 ? (
      <div className="uni-card-rating">
        <StarRating rating={avg_rating} />
        <span className="num">{avg_rating?.toFixed(1) || '0.0'}</span>
      </div>
    ) : (
      <span className="uni-card-no-reviews">No reviews yet</span>
    )

  return (
    <Link to={`/university/${slug}`} className="uni-card fade-in">
      <img src={logo_url} alt={`${name} campus`} className="uni-card-img" loading="lazy" />
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
          {review_count > 0 && (
            <span className="text-xs muted">
              {review_count} review{review_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
