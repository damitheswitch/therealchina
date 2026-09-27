import { Link } from 'react-router-dom'
import { GUIDES, guideReadTime } from '../lib/guides'
import { Seo } from '../components/Seo'
import { Icons } from '../components/Icons'
import { stringify, breadcrumbSchema, itemListSchema } from '../lib/seo/jsonld'

// /guides — index of every editorial guide. Keeps guides out of orphan
// territory: crawlers and users reach them from here and the footer.
export const GuidesPage = () => (
  <div className="container guides-page">
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
    <header className="guides-head">
      <p className="guides-eyebrow">指南 · Field notes</p>
      <h1>Guides</h1>
      <p className="guides-sub">
        Practical notes on studying in China: applications, visas, and checking schools before you
        commit.
      </p>
    </header>
    <ol className="guide-card-list">
      {GUIDES.map((g, i) => (
        <li key={g.slug}>
          <Link to={`/guide/${g.slug}`} className="guide-card">
            <span className="guide-card-num" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="guide-card-body">
              {g.tag && <span className="guide-tag">{g.tag}</span>}
              <span className="guide-card-title">{g.title}</span>
              <span className="guide-card-desc">{g.description}</span>
              <span className="guide-card-meta">
                Updated {g.updated} · {guideReadTime(g)} min read
              </span>
            </span>
            <span className="guide-card-arrow" aria-hidden="true">
              <Icons.ArrowRight />
            </span>
          </Link>
        </li>
      ))}
    </ol>
    <p className="guides-foot">More guides as we write them.</p>
  </div>
)
