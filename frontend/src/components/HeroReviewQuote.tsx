import { Link } from 'react-router-dom'
import { useHeroReview } from '../hooks/useHeroReview'
import { truncateQuote } from '../lib/reviewQuote'
import { StarRating } from './StarRating'

// One real recent review under the hero search. Renders nothing until one loads.
export const HeroReviewQuote = () => {
  const review = useHeroReview()
  if (!review) return null

  return (
    <figure className="hero-quote">
      <StarRating rating={review.rating} />
      <blockquote>&ldquo;{truncateQuote(review.text, 140)}&rdquo;</blockquote>
      <figcaption>
        <Link to={`/university/${review.universitySlug}`}>{review.universityName}</Link>
      </figcaption>
    </figure>
  )
}
