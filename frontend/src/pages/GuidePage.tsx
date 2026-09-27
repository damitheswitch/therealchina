import { useParams, Link } from 'react-router-dom'
import { guideBySlug, guideReadTime } from '../lib/guides'
import { Seo } from '../components/Seo'
import { Icons } from '../components/Icons'
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
    <div className="container guide-page">
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
      <nav className="guide-crumb" aria-label="Back to guides">
        <Link to="/guides">
          <Icons.ArrowLeft /> All guides
        </Link>
      </nav>
      <header className="guide-head">
        {doc.tag && <p className="guides-eyebrow">{doc.tag}</p>}
        <h1>{doc.title}</h1>
        <p className="guide-lede">{doc.description}</p>
        <p className="guide-meta">
          Updated {doc.updated} · {guideReadTime(doc)} min read
        </p>
      </header>
      {doc.sections.length > 2 && (
        <nav className="guide-toc" aria-label="On this page">
          <p className="guide-toc-title">On this page</p>
          <ol>
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.h}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="guide-prose">
        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} className="guide-section">
            <h2>{s.h}</h2>
            {s.body?.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {s.list && (
              <ul className="guide-items">
                {s.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
            {s.links && (
              <ul className="guide-links">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label} <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <section className="guide-more" aria-labelledby="guide-more-title">
        <h2 id="guide-more-title">Keep reading</h2>
        <div className="guide-more-grid">
          {doc.related.map((r) => (
            <Link key={r.href} to={r.href} className="guide-more-card">
              <span>{r.label}</span>
              <span className="guide-card-arrow" aria-hidden="true">
                <Icons.ArrowRight />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
