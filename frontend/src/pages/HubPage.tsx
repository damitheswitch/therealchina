import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHubData, type HubPageData } from '../hooks/useHubData'
import { hubBySlug, normalizeProgram } from '../lib/seo/programs'
import { degreeHubBySlug, normalizeDegree } from '../lib/seo/degrees'
import { indexableByReviews } from '../lib/seo/indexable'
import { UniversityCard } from '../components/UniversityCard'
import { ReviewCard } from '../components/ReviewCard'
import { Seo } from '../components/Seo'
import { stringify, itemListSchema, breadcrumbSchema } from '../lib/seo/jsonld'
import type { Tables } from '../types/database.types'
import type { HubDef } from '../lib/seo/programs'

// Shared page for /program/:slug and /degree/:slug hubs.
const HubPage = ({
  kind,
  lookup,
  resolve,
}: {
  kind: 'program' | 'degree'
  lookup: (slug: string) => HubDef | null
  resolve: (review: Tables<'reviews'>) => string | null
}) => {
  const { slug } = useParams()
  const { user } = useAuth()
  const { hub, universities, reviews, authors, upvoteCounts, upvotedMine, loading, resolved } =
    useHubData(kind, slug, lookup, resolve, user?.id)

  if (loading) {
    return (
      <div className="container">
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (resolved && !hub) {
    return (
      <div className="container">
        <Seo path={`/${kind}/${slug}`} title="Not found" index={false} />
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <h1>{kind === 'program' ? 'Program' : 'Degree'} not found</h1>
          <p>We don&apos;t have a page for this yet.</p>
          <Link to="/universities/" className="btn btn-primary mt-2">
            Browse all universities
          </Link>
        </div>
      </div>
    )
  }

  const indexable = indexableByReviews(reviews)

  return (
    <div className="container">
      <Seo
        path={`/${kind}/${slug}`}
        title={kind === 'program' ? `${hub?.label} Programs in China` : `${hub?.label} in China`}
        description={`${hub?.blurb} ${reviews.length} review${reviews.length === 1 ? '' : 's'} across ${universities.length} universit${universities.length === 1 ? 'y' : 'ies'}.`}
        index={indexable}
        jsonLd={[
          stringify(
            itemListSchema(
              universities.map((u) => ({ name: u.name, url: `/university/${u.slug}` })),
              hub?.label ?? ''
            )
          ),
          stringify(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Universities', url: '/universities' },
              { name: hub?.label ?? '', url: `/${kind}/${slug}` },
            ])
          ),
        ]}
      />
      <div style={{ paddingTop: '2.5rem' }}>
        <Link
          to="/universities/"
          className="btn btn-outline"
          style={{ marginBottom: 'var(--sp-3)' }}
        >
          ← All universities
        </Link>
        <h1>{hub?.label}</h1>
        <p className="muted" style={{ maxWidth: '46rem' }}>
          {hub?.blurb}
        </p>
        <p className="muted">
          {reviews.length} review{reviews.length === 1 ? '' : 's'} · {universities.length} universit
          {universities.length === 1 ? 'y' : 'ies'}
        </p>
      </div>

      {universities.length > 0 && (
        <>
          <h2 style={{ marginTop: 'var(--sp-5)' }}>Universities offering {hub?.label}</h2>
          <div className="uni-grid" style={{ marginTop: 'var(--sp-3)' }}>
            {universities.map((university) => (
              <UniversityCard key={university.id} university={university} />
            ))}
          </div>
        </>
      )}

      {reviews.length > 0 && (
        <>
          <h2 style={{ marginTop: 'var(--sp-5)' }}>Reviews mentioning {hub?.label}</h2>
          <div className="reviews-list" style={{ marginTop: 'var(--sp-3)' }}>
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                author={(authors as HubPageData['authors'])?.[review.user_id ?? '']}
                upvote={{
                  count: upvoteCounts[review.id] ?? 0,
                  ...(user ? { upvoted: upvotedMine.has(review.id) } : {}),
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export const ProgramHubPage = () => (
  <HubPage kind="program" lookup={hubBySlug} resolve={(r) => normalizeProgram(r.program)} />
)

export const DegreeHubPage = () => (
  <HubPage
    kind="degree"
    lookup={degreeHubBySlug}
    resolve={(r) => normalizeDegree(r.degree_level)}
  />
)
