import { Link } from 'react-router-dom'
import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { UpvoteButton } from './UpvoteButton'
import { CommentSection } from './CommentSection'
import { MediaGallery } from './MediaGallery'
import { SealAvatar } from './SealAvatar'

// ReviewCard component. The author profile is looked up and batched by the
// parent page to avoid one profile query per card (N+1).
export const ReviewCard = ({ review, author }) => {
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

      {user_id && (
        <div className="review-author">
          {author ? (
            <Link to={`/profile/${user_id}`} className="review-author-link">
              <SealAvatar displayName={author.display_name} size={24} />
              <span className="review-author-name">{author.display_name}</span>
            </Link>
          ) : (
            <span className="review-author-name muted">Former member</span>
          )}
        </div>
      )}

      <p className="review-text">{text}</p>
      {media && media.length > 0 && <MediaGallery media={media} />}
      {tagsHTML}
      <UpvoteButton reviewId={id} />
      <CommentSection reviewId={id} />
    </div>
  )
}
