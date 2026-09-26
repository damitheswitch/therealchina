import { Fragment, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUniversity } from '../hooks/useUniversity'
import { useUniversityReviewSummary } from '../hooks/useUniversityReviewSummary'
import { useUniversityStats } from '../hooks/useUniversityStats'
import { buildReviewSummary } from '../lib/reviewSummary'
import { buildUniversityExtras } from '../lib/universityExtras'
import { StarRating } from '../components/StarRating'
import { SealBadge } from '../components/SealBadge'
import { ReviewSummary } from '../components/ReviewSummary'
import { UniversityReviews } from '../components/UniversityReviews'
import {
  UniversityPrograms,
  UniversityFunding,
  UniversityPhotoStrip,
  RankingIndicatorList,
} from '../components/UniversityExtras'
import { RegistrationNudge } from '../components/RegistrationNudge'
import { UniversityLogo } from '../components/UniversityLogo'
import { Seo } from '../components/Seo'
import { firstPartyLogo } from '../lib/logo'
import { indexableByReviews } from '../lib/seo/indexable'
import { cityPath } from '../lib/seo/slugify'
import { stringify, universitySchema, breadcrumbSchema } from '../lib/seo/jsonld'
import { Icons } from '../components/Icons'

// UniversityPage component
export const UniversityPage = () => {
  const { slug } = useParams()
  const { university, loading: uniLoading } = useUniversity(slug)
  const universityId = university?.id
  const { summaryRows, loadedUniversityId, hydratedReviews, hydratedAuthors } =
    useUniversityReviewSummary(universityId)
  const { stats, loading: statsLoading } = useUniversityStats(universityId)
  // Hooks must sit before the early returns below; summaryRows defaults to []
  // so both builders are safe no-ops during loading.
  const summary = useMemo(() => buildReviewSummary(summaryRows), [summaryRows])
  const extras = useMemo(() => buildUniversityExtras(summaryRows), [summaryRows])
  const [rankingDetailsOpen, setRankingDetailsOpen] = useState(false)

  useEffect(() => {
    setRankingDetailsOpen(false)
  }, [slug])

  // The verdict/extras aggregates are only "ready" once the hook reports rows
  // fetched for THIS university — that flag flips on every terminal path
  // (success, error, empty), so the gate clears even when the fetch fails.
  // The review list itself lives in its own keyed section below, so a review
  // page change can never blank the whole page.
  const summaryReady = loadedUniversityId === universityId
  const loading = uniLoading || (university ? statsLoading || !summaryReady : false)

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
        <Seo path={`/university/${slug}`} title="University not found" index={false} />
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
  // municipalities are their own province — don't render "Beijing, Beijing"
  const location = [
    university.city,
    university.province && university.province !== university.city ? university.province : null,
    university.country,
  ]
    .filter(Boolean)
    .join(', ')
  const rankings =
    university.rankings &&
    typeof university.rankings === 'object' &&
    !Array.isArray(university.rankings)
      ? university.rankings
      : {}
  const rankNational =
    typeof rankings.shanghai_national === 'number' ? rankings.shanghai_national : null
  const rankWorld = typeof rankings.arwu_world === 'number' ? rankings.arwu_world : null
  const shanghaiScore = typeof rankings.shanghai_score === 'number' ? rankings.shanghai_score : null
  const prestigeTags = Array.isArray(rankings.shanghai_tags) ? rankings.shanghai_tags : []
  const indicators =
    rankings.shanghai_indicators && typeof rankings.shanghai_indicators === 'object'
      ? rankings.shanghai_indicators
      : null
  const hasRankingDetails =
    indicators !== null && Object.values(indicators).some((value) => typeof value === 'number')
  const rankUrl =
    typeof rankings.shanghai_url === 'string'
      ? rankings.shanghai_url
      : 'https://www.shanghairanking.cn/rankings/bcur'

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
        {extras.programCount > 0 && (
          <span className="rating-programs">
            {extras.programCount} program{extras.programCount === 1 ? '' : 's'} represented
          </span>
        )}
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

  const seoTitle = `${university.name} Reviews`
  const seoDescription =
    reviewCount > 0
      ? `${university.name} in ${location}: rated ${avgRating.toFixed(1)}/5 by ${reviewCount} international student${reviewCount !== 1 ? 's' : ''}. Honest reviews on academics, costs, campus life and support.`
      : `${university.name} in ${location}. Honest reviews by international students — academics, costs, campus life and support.`

  // SEO sources: hydrated pages carry every review (with text) in the
  // prerender payload, so schema markup + the indexable rule stay exact there.
  // On client-side navigations there is no payload — the count-based half of
  // indexableByReviews still works off the slim aggregate rows, and review
  // markup is simply omitted rather than fabricated.
  const indexable = indexableByReviews(hydratedReviews ?? summaryRows)
  const schemaReviews = (hydratedReviews ?? [])
    .filter((r) => (r.text?.trim().length ?? 0) >= 200)
    .slice(0, 5)
    .map((r) => ({
      author: (r.user_id ? hydratedAuthors[r.user_id]?.display_name : null) ?? 'Anonymous',
      rating: r.rating,
      text: (r.text ?? '').slice(0, 500),
      date: (r.created_at ?? '').slice(0, 10),
    }))

  return (
    <div className="container">
      <Seo
        path={`/university/${university.slug}`}
        title={seoTitle}
        description={seoDescription}
        image={firstPartyLogo(university.logo_url) ?? undefined}
        index={indexable}
        jsonLd={[
          stringify(
            universitySchema({
              name: university.name,
              slug: university.slug,
              city: university.city,
              logo: firstPartyLogo(university.logo_url),
              website: university.website,
              rating: reviewCount >= 2 ? { value: avgRating, count: reviewCount } : null,
              // Embed the first substantive reviews — only text visible on
              // this page may become Review markup.
              reviews: schemaReviews,
            })
          ),
          stringify(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Universities', url: '/universities' },
              { name: university.name, url: `/university/${university.slug}` },
            ])
          ),
        ]}
      />
      <Link to="/universities/" className="btn btn-outline mt-3" style={{ marginBottom: 0 }}>
        <Icons.ArrowLeft /> All universities
      </Link>

      <div className="uni-profile-header has-logo">
        <div className="uni-profile-top">
          <div className="uni-profile-identity">
            <UniversityLogo
              name={university.name}
              logoUrl={university.logo_url}
              size={78}
              className="uni-profile-logo"
              eager
            />
            <div className="uni-profile-name-block">
              <div className="uni-profile-city">
                <Icons.MapPin />{' '}
                {university.city ? (
                  <Link to={cityPath(university.city)} className="review-author-link">
                    {location}
                  </Link>
                ) : (
                  location
                )}
              </div>
              <h1>{university.name}</h1>
              <div className="uni-profile-name-zh">{university.name_zh}</div>

              {(rankNational !== null ||
                rankWorld !== null ||
                shanghaiScore !== null ||
                prestigeTags.length > 0) && (
                <div className="uni-profile-facts">
                  {(rankNational !== null || rankWorld !== null || shanghaiScore !== null) && (
                    <div className="uni-profile-fact">
                      <span className="uni-profile-fact-label">National ranking</span>
                      <div className="uni-profile-ranks">
                        {rankNational !== null && (
                          <span className="uni-profile-rank">
                            <strong>#{rankNational}</strong> in China
                          </span>
                        )}
                        {rankWorld !== null && (
                          <span className="uni-profile-rank">
                            <strong>#{rankWorld}</strong> worldwide
                          </span>
                        )}
                      </div>
                      {shanghaiScore !== null &&
                        (hasRankingDetails ? (
                          <button
                            type="button"
                            className="uni-profile-score-toggle"
                            onClick={() => setRankingDetailsOpen((open) => !open)}
                            aria-expanded={rankingDetailsOpen}
                            aria-controls="uni-ranking-details"
                          >
                            <span>Ranking score</span>
                            <strong>{shanghaiScore}</strong>
                            <span className="uni-profile-score-hint">
                              {rankingDetailsOpen ? 'Hide breakdown' : 'View breakdown'}
                            </span>
                            <span className="uni-profile-score-icon" aria-hidden="true">
                              <Icons.Chevron />
                            </span>
                          </button>
                        ) : (
                          <span className="uni-profile-score-static">
                            <span>Ranking score</span>
                            <strong>{shanghaiScore}</strong>
                          </span>
                        ))}
                    </div>
                  )}
                  {prestigeTags.length > 0 && (
                    <div className="uni-profile-fact">
                      <span className="uni-profile-fact-label">National distinctions</span>
                      <div className="uni-profile-distinctions">
                        {prestigeTags.map((tag, index) => (
                          <Fragment key={tag}>
                            {index > 0 && (
                              <span className="uni-profile-distinction-sep" aria-hidden="true">
                                ·
                              </span>
                            )}
                            <span
                              className="uni-profile-distinction"
                              title={
                                tag === '双一流'
                                  ? 'Double First-Class initiative'
                                  : `Project ${tag}`
                              }
                            >
                              {tag === '双一流' ? 'Double First-Class' : tag}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasRankingDetails && (
                    <div
                      className="uni-profile-rank-details"
                      id="uni-ranking-details"
                      hidden={!rankingDetailsOpen}
                    >
                      <div className="uni-profile-rank-details-head">
                        <span>ShanghaiRanking breakdown</span>
                      </div>
                      <RankingIndicatorList indicators={indicators} />
                    </div>
                  )}
                </div>
              )}

              {(university.website ||
                rankNational !== null ||
                rankWorld !== null ||
                shanghaiScore !== null) && (
                <div className="uni-profile-links">
                  {university.website && (
                    <a
                      href={university.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="uni-profile-link"
                    >
                      Official website <span aria-hidden="true">↗</span>
                    </a>
                  )}
                  {(rankNational !== null || rankWorld !== null || shanghaiScore !== null) && (
                    <a
                      href={rankUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="uni-profile-link"
                    >
                      ShanghaiRanking profile <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <Link to={`/review?uni=${university.slug}`} className="btn btn-primary btn-lg">
            <Icons.Pen /> Leave a Review
          </Link>
        </div>
        {ratingBlock}
        <Link
          to={`/review?uni=${university.slug}`}
          className="btn btn-primary btn-lg uni-profile-mobile-cta"
        >
          <Icons.Pen /> Leave a Review
        </Link>
      </div>

      <div className="uni-profile-layout">
        <div className="uni-photos-cell">
          <UniversityPhotoStrip extras={extras} />
        </div>
        <div className="uni-verdict-cell">
          <ReviewSummary summary={summary} />
        </div>
        <aside className="uni-profile-aside">
          <UniversityFunding extras={extras} />
          <UniversityPrograms extras={extras} />
        </aside>
        <div className="uni-reviews-cell">
          <UniversityReviews key={university.id} university={university} />
        </div>
      </div>

      <RegistrationNudge />
    </div>
  )
}
