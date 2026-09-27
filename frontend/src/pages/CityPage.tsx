import { useParams, Link } from 'react-router-dom'
import { useCityData } from '../hooks/useCityData'
import { UniversityCard } from '../components/UniversityCard'
import { Seo } from '../components/Seo'
import { stringify, itemListSchema, breadcrumbSchema } from '../lib/seo/jsonld'

// /city/:slug — a city hub: every university there + review counts.
// Indexable only with substance (≥3 unis or ≥3 reviews) — keeps tiny
// one-uni towns out of the index without hiding them from users.
export const CityPage = () => {
  const { slug } = useParams()
  const { city, universities, reviewCount, loading, resolved } = useCityData(slug)

  if (loading) {
    return (
      <div className="container">
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (resolved && !city) {
    return (
      <div className="container">
        <Seo path={`/city/${slug}`} title="City not found" index={false} />
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <h1>City not found</h1>
          <p>We don&apos;t have any universities in this city yet.</p>
          <Link to="/universities/" className="btn btn-primary mt-2">
            Browse all universities
          </Link>
        </div>
      </div>
    )
  }

  const indexable = universities.length >= 3 || reviewCount >= 3

  return (
    <div className="container">
      <Seo
        path={`/city/${slug}`}
        title={`Universities in ${city}`}
        description={`${universities.length} universit${universities.length === 1 ? 'y' : 'ies'} in ${city}, China — honest reviews by international students on costs, programs and campus life.`}
        index={indexable}
        jsonLd={[
          stringify(
            itemListSchema(
              universities.map((u) => ({ name: u.name, url: `/university/${u.slug}` })),
              `Universities in ${city}`
            )
          ),
          stringify(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Universities', url: '/universities' },
              { name: city ?? '', url: `/city/${slug}` },
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
        <h1>Universities in {city}</h1>
        <p className="muted" style={{ maxWidth: '46rem' }}>
          {universities.length} universit{universities.length === 1 ? 'y' : 'ies'} · {reviewCount}{' '}
          review{reviewCount === 1 ? '' : 's'} from international students.
        </p>
      </div>

      <div className="uni-grid" style={{ marginTop: 'var(--sp-4)' }}>
        {universities.map((university) => (
          <UniversityCard key={university.id} university={university} />
        ))}
      </div>
    </div>
  )
}
