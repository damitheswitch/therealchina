import { Link } from 'react-router-dom'
import { useRecentReviews } from '../hooks/useRecentReviews'
import { ReviewCard } from '../components/ReviewCard'
import { Seo } from '../components/Seo'
import { stringify, itemListSchema, breadcrumbSchema } from '../lib/seo/jsonld'

// /reviews — every review across all universities, newest first. The
// collection page reviewers and crawlers use to see the corpus.
export const ReviewsPage = () => {
  const { reviews, universities, authors, loading } = useRecentReviews()

  return (
    <div className="container">
      <Seo
        path="/reviews"
        title="Student Reviews"
        description="Every university review on The Real China — unfiltered experiences from international students across China."
        jsonLd={[
          stringify(
            itemListSchema(
              reviews
                .filter((r) => universities[r.university_id])
                .map((r) => ({
                  name: `${universities[r.university_id].name} review`,
                  url: `/university/${universities[r.university_id].slug}#review-${r.id}`,
                })),
              'University reviews'
            )
          ),
          stringify(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Reviews', url: '/reviews' },
            ])
          ),
        ]}
      />
      <div style={{ paddingTop: '2.5rem' }}>
        <h1>Latest reviews</h1>
        <p className="muted" style={{ maxWidth: '46rem' }}>
          Unfiltered reviews from international students — what the brochures don&apos;t tell you
          about studying in China.
        </p>
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="empty-state">
          <h3>No reviews yet</h3>
          <p>Be the first to share your experience.</p>
        </div>
      ) : (
        <div className="reviews-list" style={{ marginTop: 'var(--sp-4)' }}>
          {reviews.map((review) => {
            const uni = universities[review.university_id]
            return (
              <div key={review.id}>
                {uni && (
                  <p className="muted" style={{ marginBottom: 'var(--sp-1)' }}>
                    <Link to={`/university/${uni.slug}`} className="review-author-link">
                      {uni.name}
                    </Link>
                  </p>
                )}
                <ReviewCard review={review} author={authors[review.user_id ?? '']} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
