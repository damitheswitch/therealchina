import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Icons } from '../components/Icons'
import { VotePill } from '../components/community/VotePill'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { useProfileContext } from '../contexts/ProfileContext'
import { useToast } from '../contexts/ToastContext'
import { categoryLabel, type CommunityAnswer, type CommunityQuestion } from '../lib/community'
import { MOCK_QUESTIONS } from '../lib/communityMock'

// /community/q/:slug — question + answers. PROTOTYPE: communityMock.ts only,
// votes/accepts/posts mutate local state and nothing is persisted.
export const CommunityQuestionPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const question = MOCK_QUESTIONS.find((q) => q.slug === slug)

  if (!question) {
    return (
      <div className="container qa-detail">
        <div className="empty-state">
          <p>That question does not exist.</p>
          <Link to="/community" className="btn btn-outline">
            Back to Community
          </Link>
        </div>
      </div>
    )
  }

  // key remounts the view per slug — router reuses this route for any
  // /community/q/* navigation, so answers/draft must not bleed across.
  return <QuestionView key={question.slug} question={question} />
}

const QuestionView = ({ question }: { question: CommunityQuestion }) => {
  const { showToast } = useToast()
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { profile } = useProfileContext()

  const [answers, setAnswers] = useState<CommunityAnswer[]>(question.answers)
  const [acceptedId, setAcceptedId] = useState<string | null>(question.acceptedAnswerId)
  const [draft, setDraft] = useState('')
  const [postAnon, setPostAnon] = useState(false)

  const sorted = useMemo(
    () =>
      [...answers].sort((a, b) => {
        if (a.id === acceptedId) return -1
        if (b.id === acceptedId) return 1
        return b.upvotes - a.upvotes
      }),
    [answers, acceptedId]
  )

  const flag = () => showToast('Report noted. Our team will take a look.', 'success')

  const accept = (a: CommunityAnswer) => {
    setAcceptedId(a.id)
    showToast('Marked as the accepted answer.', 'success')
  }

  const postAnswer = () => {
    const text = draft.trim()
    if (!text) return
    if (!user) {
      openAuthModal('login')
      return
    }
    setAnswers((prev) => [
      ...prev,
      {
        id: `a-new-${prev.length}`,
        author: postAnon
          ? null
          : { id: user.id, displayName: profile?.display_name ?? 'Anonymous' },
        body: [text],
        upvotes: 0,
        ago: 'just now',
      },
    ])
    setDraft('')
    setPostAnon(false)
    showToast('Answer posted. Preview only, nothing was saved.', 'success')
  }

  return (
    <div className="container qa-detail">
      <Seo
        path={`/community/q/${question.slug}`}
        title={question.title}
        description={question.body[0].slice(0, 155)}
        type="article"
      />
      <nav className="qa-crumb" aria-label="Breadcrumb">
        <Link to="/community">
          <Icons.ArrowLeft /> Community
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/community?c=${question.category}`}>{categoryLabel(question.category)}</Link>
      </nav>

      <header className="qa-qhead">
        <span className="guide-tag">{categoryLabel(question.category)}</span>
        <h1 className="qa-title">{question.title}</h1>
        <p className="qa-meta">
          asked by <strong>{question.author?.displayName ?? 'Anonymous'}</strong> · {question.ago}
          {question.city && <> · {question.city}</>}
          {question.university && (
            <>
              {' '}
              ·{' '}
              <Link className="qa-uni" to={`/university/${question.university.slug}`}>
                <Icons.Book /> {question.university.name}
              </Link>
            </>
          )}
        </p>
      </header>

      <div className="qa-body">
        {question.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      <div className="qa-actions">
        <VotePill count={question.upvotes} label="Me too" />
        <button type="button" className="flag-btn" onClick={flag}>
          <Icons.Flag /> Report
        </button>
      </div>

      {question.relatedGuide && (
        <Link className="qa-guide-chip" to={`/guide/${question.relatedGuide.slug}`}>
          <Icons.Book />
          <span>
            Related guide: <strong>{question.relatedGuide.title}</strong>
          </span>
          <Icons.ArrowRight />
        </Link>
      )}

      <section className="answers" aria-label="Answers">
        <h2 className="answers-head">
          {sorted.length} {sorted.length === 1 ? 'answer' : 'answers'}
        </h2>
        {sorted.length === 0 && (
          <div className="qa-empty">
            No answers yet. If you have been through this, your experience helps.
          </div>
        )}
        {sorted.map((a) => (
          <article key={a.id} className={`a-card${a.id === acceptedId ? ' accepted' : ''}`}>
            {a.id === acceptedId && (
              <div className="a-accepted-band">
                <Icons.Check size={15} /> Accepted answer
              </div>
            )}
            <div className="a-body">
              {a.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="a-foot">
              <VotePill count={a.upvotes} />
              <span className="a-author">{a.author?.displayName ?? 'Anonymous'}</span>
              <span aria-hidden="true">·</span>
              <span>{a.ago}</span>
              {question.mine && a.id !== acceptedId && (
                <button type="button" className="accept-btn" onClick={() => accept(a)}>
                  <Icons.Check size={14} /> Mark as accepted
                </button>
              )}
              <button
                type="button"
                className="flag-btn icon-only"
                onClick={flag}
                aria-label="Report this answer"
              >
                <Icons.Flag />
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="answer-form" aria-label="Write an answer">
        <h2 className="answer-form-title">Your answer</h2>
        {user ? (
          <>
            <label htmlFor="answer-draft" className="sr-only">
              Your answer
            </label>
            <textarea
              id="answer-draft"
              className="form-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Been through this? Share what actually happened: steps, costs, office names, what you would do differently."
            />
            <div className="answer-form-row">
              <label className="form-checkbox-label" htmlFor="answer-anon">
                <input
                  id="answer-anon"
                  type="checkbox"
                  className="form-checkbox"
                  checked={postAnon}
                  onChange={(e) => setPostAnon(e.target.checked)}
                />
                Post anonymously
              </label>
              <button type="button" className="btn btn-primary" onClick={postAnswer}>
                Post answer
              </button>
            </div>
            {postAnon && (
              <p className="form-hint">
                Your name is hidden from everyone. Moderators can still trace abuse.
              </p>
            )}
          </>
        ) : (
          <div className="qa-empty answer-login">
            <span>Been through this? Sign in to share what happened.</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => openAuthModal('login')}
            >
              Sign in to answer
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
