import { useParams, Link } from 'react-router-dom'
import { trustDocBySlug } from '../lib/trustContent'
import { Seo } from '../components/Seo'
import { stringify, articleSchema, breadcrumbSchema } from '../lib/seo/jsonld'

// Trust/legal pages — about, contact, editorial-policy, how-we-verify,
// review-guidelines, data-sources, privacy, terms, disclaimer, report.
export const TrustPage = ({ slug }: { slug?: string }) => {
  const { page } = useParams()
  const doc = trustDocBySlug(slug ?? page)

  if (!doc) {
    return (
      <div className="container">
        <Seo path={`/${slug ?? page}`} title="Page not found" index={false} />
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <h1>Page not found</h1>
          <Link to="/" className="btn btn-primary mt-2">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: '52rem' }}>
      <Seo
        path={`/${doc.slug}`}
        title={doc.title}
        description={doc.description}
        type="article"
        updated={doc.updated}
        jsonLd={[
          stringify(
            articleSchema({
              title: doc.title,
              description: doc.description,
              url: `/${doc.slug}`,
              updated: doc.updated,
              authorName: 'The Real China',
            })
          ),
          stringify(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: doc.title, url: `/${doc.slug}` },
            ])
          ),
        ]}
      />
      <div style={{ paddingTop: '2.5rem', paddingBottom: 'var(--sp-5)' }}>
        <h1>{doc.title}</h1>
        <p className="muted">Last updated {doc.updated}</p>
        {doc.sections.map((s) => (
          <section key={s.h} style={{ marginTop: 'var(--sp-5)' }}>
            <h2>{s.h}</h2>
            {s.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
