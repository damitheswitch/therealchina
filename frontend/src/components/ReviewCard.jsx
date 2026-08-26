import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { UpvoteButton } from './UpvoteButton'
import { CommentSection } from './CommentSection'
import { MediaGallery } from './MediaGallery'

// ReviewCard component
export const ReviewCard = ({ review }) => {
  const { id, rating, text, program, degree_level, media, created_at, user_id } = review

  const tags = [program, degree_level].filter(Boolean)
  const tagsHTML = tags.length > 0 && (
    <div className="review-tags">
      {tags.map((tag, i) => (
        <span key={i} className="review-tag">
          {tag}
        </span>
      ))}
    </div>
  )

  const date = new Date(created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="review-card fade-in">
      <div className="review-header">
        <StarRating rating={rating} />
        <div className="review-meta">
          {user_id && <SealBadge />}
          <span>{date}</span>
        </div>
      </div>
      <p className="review-text">{text}</p>
      {media && media.length > 0 && <MediaGallery media={media} />}
      {tagsHTML}
      <UpvoteButton reviewId={id} />
      <CommentSection reviewId={id} />
    </div>
  )
}
