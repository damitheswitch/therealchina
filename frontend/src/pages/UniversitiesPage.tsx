import { UniversityDirectory } from '../components/UniversityDirectory'
import { usePrerenderData } from '../lib/prerenderData'
import type { UniversitiesPageData } from '../hooks/useUniversities'
import { Seo } from '../components/Seo'
import { stringify, itemListSchema, breadcrumbSchema } from '../lib/seo/jsonld'

// Canonical /universities index — the crawlable directory of every university
// in the database. Same grid as the homepage; distinct URL + title so both
// rank for their own intent.
export const UniversitiesPage = () => {
  // The grid below owns the live query — here we only need the baked-in list
  // for the ItemList schema + result count (no second fetch on the client).
  const pd = usePrerenderData<UniversitiesPageData>('universitiesPage')
  const totalCount = pd?.totalCount
  const rows = pd?.rows ?? []

  return (
    <>
      <Seo
        path="/universities"
        title="All Chinese Universities"
        description={
          totalCount
            ? `Browse ${totalCount} universities across China with honest reviews by international students — rankings, costs, programs and campus life.`
            : 'Browse universities across China with honest reviews by international students — rankings, costs, programs and campus life.'
        }
        jsonLd={[
          stringify(
            itemListSchema(
              rows.map((u) => ({ name: u.name, url: `/university/${u.slug}` })),
              'Universities in China'
            )
          ),
          stringify(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Universities', url: '/universities' },
            ])
          ),
        ]}
      />
      <section className="section" style={{ paddingTop: '2.5rem', paddingBottom: 0 }}>
        <div className="container">
          <h1>Universities in China</h1>
          <p className="muted" style={{ maxWidth: '46rem' }}>
            Every university international students have reviewed or can review — ranked, searchable
            and filterable by city and category.
          </p>
        </div>
      </section>
      <UniversityDirectory />
    </>
  )
}
