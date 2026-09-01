import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { SealAvatar } from './SealAvatar'
import { StarRating } from './StarRating'
import { SealBadge } from './SealBadge'
import { UpvoteButton } from './UpvoteButton'
import { CommentSection } from './CommentSection'
import { MediaGallery } from './MediaGallery'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { socialPlatforms } from '../lib/socialPlatforms'
import { getSocialHandles } from '../lib/socialHandles'

// Simple review card for profile view (reused logic)
const ProfileReviewCard = ({ review }) => {
  const { id, rating, text, program, degree_level, media, created_at } = review

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
          <SealBadge />
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

// ProfileView component - Read-only profile view for other users
export const ProfileView = ({ userId }) => {
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchProfileData = async () => {
    setLoading(true)
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('member_profiles')
        .select('*, social_handles')
        .eq('id', userId)
        .single()

      if (profileError) throw profileError
      setProfile(profileData)

      // Fetch user's reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('*, universities(name, city, slug)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (reviewsError) throw reviewsError
      setReviews(reviewsData || [])
    } catch (error) {
      console.error('Error fetching profile data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchProfileData()
    } else {
      setLoading(false)
    }
  }, [userId, user])

  if (loading) {
    return <div className="loading">Loading profile...</div>
  }

  if (!user) {
    return (
      <div className="empty-state">
        <Icons.User size={48} />
        <h1>Meet the community</h1>
        <p>
          Join The Real China to view member profiles and connect with students in your city or
          university. Sign in or create a free account.
        </p>
        <div
          style={{
            marginTop: '1rem',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button onClick={() => openAuthModal('register')} className="btn btn-primary">
            Create account
          </button>
          <button onClick={() => openAuthModal('login')} className="btn btn-outline">
            Sign in
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="loading">Loading profile...</div>
  }

  if (!profile) {
    return (
      <div className="empty-state">
        <h3>Profile not found</h3>
        <p>This user profile doesn&apos;t exist or is not accessible.</p>
        <Link to="/" className="btn btn-primary mt-2">
          <Icons.ArrowLeft /> Back to universities
        </Link>
      </div>
    )
  }

  const socialHandles = getSocialHandles(profile)
  const hasSocialHandles = socialHandles.some((sh) => sh.handle && sh.handle.trim())
  const displaySocialHandles = profile.show_social_handle !== false && hasSocialHandles

  return (
    <div className="profile-view-container">
      <div className="profile-header">
        <div className="profile-avatar-large">
          <SealAvatar displayName={profile.display_name} size={80} />
        </div>
        <div className="profile-info">
          <h1 className="profile-name">{profile.display_name}</h1>
          {profile.location && (
            <div className="profile-location">
              <Icons.MapPin /> {profile.location}
            </div>
          )}
        </div>
      </div>

      <div className="profile-content">
        {profile.bio && (
          <div className="profile-section">
            <h3 className="profile-section-title">About</h3>
            <p className="profile-bio">{profile.bio}</p>
          </div>
        )}

        {(profile.university || profile.program) && (
          <div className="profile-section">
            <h3 className="profile-section-title">Academic</h3>
            {profile.university && (
              <div className="profile-detail">
                <strong>University:</strong> {profile.university}
              </div>
            )}
            {profile.program && (
              <div className="profile-detail">
                <strong>Program:</strong> {profile.program}
              </div>
            )}
          </div>
        )}

        {displaySocialHandles && (
          <div className="profile-section">
            <h3 className="profile-section-title">Social</h3>
            <div className="profile-social-list">
              {socialHandles
                .filter((sh) => sh.handle)
                .map((social, index) => {
                  const platformData = socialPlatforms[social.platform] || socialPlatforms.other
                  return (
                    <div key={index} className="profile-social">
                      <span className="profile-social-platform">{platformData.label}</span>
                      <span className="profile-social-handle">{social.handle}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        <div className="profile-section">
          <h3 className="profile-section-title">Reviews ({reviews.length})</h3>
          {reviews.length > 0 ? (
            <div className="profile-reviews">
              {reviews.map((review) => (
                <div key={review.id} className="profile-review-item">
                  {review.universities && (
                    <Link
                      to={`/university/${review.universities.slug}`}
                      className="profile-review-university"
                    >
                      <Icons.Book /> {review.universities.name} — {review.universities.city}
                    </Link>
                  )}
                  <ProfileReviewCard review={review} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No reviews yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
