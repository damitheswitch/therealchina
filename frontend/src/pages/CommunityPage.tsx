import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Icons } from '../components/Icons'
import { COMMUNITY_CATEGORIES, categoryLabel } from '../lib/community'
import { useCommunityQuestions } from '../hooks/useCommunity'

type View = 'newest' | 'unanswered' | 'top'

const VIEWS: { id: View; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'top', label: 'Top' },
]

const viewFromParam = (v: string | null): View => (v === 'unanswered' || v === 'top' ? v : 'newest')

// /community — Q&A feed backed by qa_questions_public. Layout follows the
// SO/Discourse convention: left nav for views + categories, main feed
// column, right rail for utility cards. On narrow screens the nav collapses
// into a filter drawer (Discourse hamburger).
export const CommunityPage = () => {
  const [params, setParams] = useSearchParams()
  const view = viewFromParam(params.get('tab'))
  const cat = params.get('c')
  const [catsOpen, setCatsOpen] = useState(true)
  const [navOpen, setNavOpen] = useState(false)
  const { questions: allQuestions, loading, error, refetch } = useCommunityQuestions()

  const catCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of allQuestions) m.set(q.category, (m.get(q.category) ?? 0) + 1)
    return m
  }, [allQuestions])
  const unansweredTotal = useMemo(
    () => allQuestions.filter((q) => q.answerCount === 0).length,
    [allQuestions]
  )
  const needsAnswers = useMemo(
    () =>
      allQuestions
        .filter((q) => q.answerCount === 0)
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, 3),
    [allQuestions]
  )

  const questions = useMemo(() => {
    const list = allQuestions.filter((q) => !cat || q.category === cat)
    if (view === 'unanswered')
      return list.filter((q) => q.answerCount === 0).sort((a, b) => b.upvotes - a.upvotes)
    if (view === 'top') return [...list].sort((a, b) => b.upvotes - a.upvotes)
    return [...list].sort((a, b) => a.postedHoursAgo - b.postedHoursAgo)
  }, [allQuestions, view, cat])

  const go = (updates: { tab?: string | null; c?: string | null }) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
    setNavOpen(false)
  }

  const activeLabel = `${VIEWS.find((v) => v.id === view)?.label} · ${
    cat ? categoryLabel(cat) : 'All categories'
  }`

  return (
    <div className="container community-page">
      <Seo
        path="/community"
        title="Community"
        description="Questions from students in China, answered by people who have been through it: visas, banking, housing, daily life."
      />
      <div className="community-layout">
        <aside className="community-nav-wrap">
          <button
            type="button"
            className="community-nav-toggle"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <Icons.Filter />
            <span className="community-nav-toggle-label">{activeLabel}</span>
            <Icons.Chevron />
          </button>
          <div className={`community-nav-body${navOpen ? ' open' : ''}`}>
            <nav className="community-nav" aria-label="Feeds">
              {VIEWS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  className={`community-nav-item${view === id ? ' active' : ''}`}
                  onClick={() => go({ tab: id === 'newest' ? null : id })}
                >
                  <span>{label}</span>
                  {id === 'unanswered' && (
                    <span className="community-nav-count">{unansweredTotal}</span>
                  )}
                </button>
              ))}
            </nav>
            <button
              type="button"
              className="community-nav-section"
              aria-expanded={catsOpen}
              onClick={() => setCatsOpen((v) => !v)}
            >
              Categories
              <Icons.Chevron />
            </button>
            {catsOpen && (
              <nav className="community-nav" aria-label="Categories">
                <button
                  type="button"
                  aria-pressed={!cat}
                  className={`community-nav-item${!cat ? ' active' : ''}`}
                  onClick={() => go({ c: null })}
                >
                  <span>All categories</span>
                  <span className="community-nav-count">{allQuestions.length}</span>
                </button>
                {COMMUNITY_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={cat === c.id}
                    title={c.blurb}
                    className={`community-nav-item${cat === c.id ? ' active' : ''}`}
                    onClick={() => go({ c: cat === c.id ? null : c.id })}
                  >
                    <span>{c.label}</span>
                    <span className="community-nav-count">{catCounts.get(c.id) ?? 0}</span>
                  </button>
                ))}
              </nav>
            )}
          </div>
        </aside>

        <div className="community-main">
          <header className="community-head">
            <div className="community-head-text">
              <p className="community-eyebrow">问答 · Community</p>
              <h1>Community</h1>
              <p className="community-sub">
                Ask what the guides do not cover. Answers come from students who have been through
                it.
              </p>
            </div>
            <Link to="/community/ask" className="btn btn-primary">
              <Icons.Pen /> Ask a question
            </Link>
          </header>

          {loading ? (
            <div className="empty-state">
              <p>Loading questions…</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <p>Could not load questions right now.</p>
              <button type="button" className="btn btn-outline" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          ) : questions.length === 0 ? (
            <div className="empty-state">
              <p>No questions here yet.</p>
              <Link to="/community/ask" className="btn btn-outline">
                Be the first to ask
              </Link>
            </div>
          ) : (
            <ol className="qa-list">
              {questions.map((q) => (
                <li key={q.slug}>
                  <Link to={`/community/q/${q.slug}`} className="q-card">
                    <span className="q-card-stats" aria-hidden="true">
                      <span className="q-stat">
                        <span className="q-stat-num">{q.upvotes}</span>
                        <span>votes</span>
                      </span>
                      <span className={`q-stat${q.acceptedAnswerId ? ' answered' : ''}`}>
                        <span className="q-stat-num">
                          {q.acceptedAnswerId ? <Icons.Check size={15} /> : q.answerCount}
                        </span>
                        <span>{q.acceptedAnswerId ? 'answered' : 'answers'}</span>
                      </span>
                    </span>
                    <span className="q-card-main">
                      <span className="guide-tag">{categoryLabel(q.category)}</span>
                      <span className="q-card-title">{q.title}</span>
                      <span className="q-card-excerpt">{q.excerpt}</span>
                      <span className="q-card-meta">
                        <span>{q.author?.displayName ?? 'Anonymous'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{q.ago}</span>
                        {q.city && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{q.city}</span>
                          </>
                        )}
                        {q.university && (
                          <span className="q-uni">
                            <Icons.Book /> {q.university.name}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="guide-card-arrow" aria-hidden="true">
                      <Icons.ArrowRight />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="community-rail">
          <div className="rail-card">
            <h3>Needs answers</h3>
            {needsAnswers.map((q) => (
              <Link key={q.slug} to={`/community/q/${q.slug}`} className="rail-item">
                <span className="rail-item-title">{q.title}</span>
                <span className="rail-item-meta">👍 {q.upvotes}</span>
              </Link>
            ))}
            {needsAnswers.length === 0 && !loading && (
              <p className="rail-blurb">Nothing waiting on answers right now.</p>
            )}
            <Link to="/community?tab=unanswered" className="rail-more">
              All unanswered <Icons.ArrowRight />
            </Link>
          </div>
          <div className="rail-card">
            <h3>About</h3>
            <p className="rail-blurb">
              Answers from students in China, not agents. Post under your name or anonymously.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
