import { useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { trustDocBySlug } from '../lib/trustContent'
import { Seo } from '../components/Seo'
import { stringify, articleSchema, breadcrumbSchema } from '../lib/seo/jsonld'

// Trust/legal pages — about (incl. contact + report), editorial-policy
// (incl. verification, guidelines, data sources), privacy, terms (incl.
// disclaimer). Sections carry anchors; retired slugs 301 to them.
export const TrustPage = ({ slug }: { slug?: string }) => {
  const { page } = useParams()
  const { hash } = useLocation()
  const doc = trustDocBySlug(slug ?? page)

  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

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
        {doc.sections.length > 2 && (
          <nav aria-label="On this page" style={{ marginTop: 'var(--sp-4)' }}>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.h}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {doc.sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            style={{ marginTop: 'var(--sp-5)', scrollMarginTop: '5rem' }}
          >
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
