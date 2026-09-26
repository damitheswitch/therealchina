import { useParams, Link } from 'react-router-dom'
import { guideBySlug } from '../lib/guides'
import { Seo } from '../components/Seo'
import { stringify, articleSchema, breadcrumbSchema } from '../lib/seo/jsonld'

// Editorial guides — /guide/:slug, content lives in src/lib/guides.ts and
// every guide is prerendered + indexable (registered in policy.ts and the
// generated route registry).
export const GuidePage = () => {
  const { slug } = useParams()
  const doc = guideBySlug(slug)

  if (!doc) {
    return (
      <div className="container">
        <Seo path={`/guide/${slug}`} title="Page not found" index={false} />
        <div className="empty-state" style={{ paddingTop: '6rem' }}>
          <h1>Page not found</h1>
          <Link to="/guides" className="btn btn-primary mt-2">
            All guides
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: '52rem' }}>
      <Seo
        path={`/guide/${doc.slug}`}
        title={doc.title}
        description={doc.description}
        type="article"
        published={doc.published}
        updated={doc.updated}
        jsonLd={[
          stringify(
            articleSchema({
              title: doc.title,
              description: doc.description,
              url: `/guide/${doc.slug}`,
              published: doc.published,
              updated: doc.updated,
              authorName: 'The Real China',
            })
          ),
          stringify(
            breadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Guides', url: '/guides' },
              { name: doc.title, url: `/guide/${doc.slug}` },
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
            {s.body?.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <section style={{ marginTop: 'var(--sp-5)' }}>
          <h2>Keep reading</h2>
          <ul>
            {doc.related.map((r) => (
              <li key={r.href}>
                <Link to={r.href}>{r.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
