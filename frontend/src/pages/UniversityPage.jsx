import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { StarRating } from '../components/StarRating'
import { SealBadge } from '../components/SealBadge'
import { ReviewCard } from '../components/ReviewCard'
import { RegistrationNudge } from '../components/RegistrationNudge'
import { Icons } from '../components/Icons'

// UniversityPage component
export const UniversityPage = () => {
  const { slug } = useParams()
  const [university, setUniversity] = useState(null)
  const [reviews, setReviews] = useState([])
  // Author profiles keyed by user id; missing entry means no public profile.
  const [authors, setAuthors] = useState({})
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch university
        const { data: uniData, error: uniError } = await supabase
          .from('universities')
          .select('id, name, name_zh, city, slug, logo_url, is_verified')
          .eq('slug', slug)
          .abortSignal(controller.signal)
          .single()

        if (uniError) throw uniError
        setUniversity(uniData)

        // Fetch reviews
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select(
            'id, university_id, user_id, rating, text, program, degree_level, media, created_at'
          )
          .eq('university_id', uniData.id)
          .abortSignal(controller.signal)
          .order('created_at', { ascending: false })

        if (reviewsError) throw reviewsError
        setReviews(reviewsData || [])

        // Batch-fetch author profiles in one query instead of one per card.
        const authorIds = [...new Set((reviewsData || []).map((r) => r.user_id).filter(Boolean))]
        if (authorIds.length > 0) {
          const { data: authorsData, error: authorsError } = await supabase
            .from('profile_public')
            .select('id, display_name, avatar_url')
            .in('id', authorIds)
            .abortSignal(controller.signal)

          if (authorsError) throw authorsError
          setAuthors(Object.fromEntries((authorsData || []).map((p) => [p.id, p])))
        } else {
          setAuthors({})
        }

        // Fetch stats
        const { data: statsData, error: statsError } = await supabase
          .from('university_stats')
          .select('avg_rating, review_count, has_verified_review')
          .eq('university_id', uniData.id)
          .abortSignal(controller.signal)
          .single()

        if (statsError && statsError.code !== 'PGRST116') throw statsError
        setStats(statsData)
      } catch (error) {
        if (error?.name !== 'AbortError') console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [slug])

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
          <div className="uni-profile-name-block">
            <div className="uni-profile-city">
              <Icons.MapPin /> {university.city}
            </div>
            <h1>{university.name}</h1>
            <div className="uni-profile-name-zh">{university.name_zh}</div>
          </div>
          <Link to={`/review?uni=${university.slug}`} className="btn btn-primary btn-lg">
            <Icons.Pen /> Leave a Review
          </Link>
        </div>
        {ratingBlock}
      </div>

      <div className="section" style={{ paddingTop: 'var(--sp-2)' }}>
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

      <RegistrationNudge />
    </div>
  )
}
