import { Link } from 'react-router-dom'
import { GUIDES } from '../lib/guides'
import { Seo } from '../components/Seo'
import { stringify, breadcrumbSchema, itemListSchema } from '../lib/seo/jsonld'

// /guides — index of every editorial guide. Keeps guides out of orphan
// territory: crawlers and users reach them from here and the footer.
export const GuidesPage = () => (
  <div className="container" style={{ maxWidth: '52rem' }}>
    <Seo
      path="/guides"
      title="Guides"
      description="Practical guides to studying in China: applications, visas, scholarships, and vetting universities before you commit."
      jsonLd={[
        stringify(
          itemListSchema(
            GUIDES.map((g) => ({ name: g.title, url: `/guide/${g.slug}` })),
            'Guides'
          )
        ),
        stringify(
          breadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Guides', url: '/guides' },
          ])
        ),
      ]}
    />
    <div style={{ paddingTop: '2.5rem', paddingBottom: 'var(--sp-5)' }}>
      <h1>Guides</h1>
      <p className="muted">
        Practical notes on studying in China — applications, visas, and checking schools before you
        commit.
      </p>
      {GUIDES.map((g) => (
        <section key={g.slug} style={{ marginTop: 'var(--sp-5)' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>
            <Link to={`/guide/${g.slug}`}>{g.title}</Link>
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {g.description}
          </p>
        </section>
      ))}
    </div>
  </div>
)
