import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { UpvoteButton } from './UpvoteButton'
import { CommentSection } from './CommentSection'
import { MediaGallery } from './MediaGallery'
import { SealAvatar } from './SealAvatar'
import { supabase } from '../lib/supabaseClient'

// ReviewCard component
export const ReviewCard = ({ review }) => {
  const { id, rating, text, program, degree_level, media, created_at, user_id } = review
  const [authorProfile, setAuthorProfile] = useState(null)

  useEffect(() => {
    if (user_id) {
      fetchAuthorProfile()
    }
  }, [user_id])

  const fetchAuthorProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_public')
        .select('*')
        .eq('id', user_id)
        .single()

      if (error) throw error
      setAuthorProfile(data)
    } catch (error) {
      console.error('Error fetching author profile:', error)
    }
  }

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
          {authorProfile ? (
            <Link to={`/profile/${user_id}`} className="review-author-link">
              <SealAvatar displayName={authorProfile.display_name} size={24} />
              <span className="review-author-name">{authorProfile.display_name}</span>
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
