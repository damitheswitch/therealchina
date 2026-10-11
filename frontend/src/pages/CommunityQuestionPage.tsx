import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Icons } from '../components/Icons'
import { VotePill } from '../components/community/VotePill'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { useToast } from '../contexts/ToastContext'
import { useCommunityQuestion } from '../hooks/useCommunity'
import {
  setAcceptedAnswer,
  setQuestionNotify,
  submitAnswer,
  submitReport,
} from '../lib/communityApi'
import { categoryLabel, type CommunityAnswer, type CommunityQuestion } from '../lib/community'

// /community/q/:slug — question + answers, all persisted in qa_* tables via
// the qa_*_public views, community-submit, and the vote/accept RPCs.
export const CommunityQuestionPage = () => {
  const { slug } = useParams<{ slug: string }>()
  const { question, answers, loading, notFound, error, refetch } = useCommunityQuestion(slug)

  if (loading) {
    return (
      <div className="container qa-detail">
        <div className="empty-state">
          <p>Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container qa-detail">
        <div className="empty-state">
          <p>Could not load that question right now.</p>
          <button type="button" className="btn btn-outline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (notFound || !question) {
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
  return (
    <QuestionView key={question.slug} question={question} answers={answers} refetch={refetch} />
  )
}

const QuestionView = ({
  question,
  answers,
  refetch,
}: {
  question: CommunityQuestion
  answers: CommunityAnswer[]
  refetch: () => Promise<void>
}) => {
  const { showToast } = useToast()
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()

  const [acceptedId, setAcceptedId] = useState<string | null>(question.acceptedAnswerId)
  const [notifyOn, setNotifyOn] = useState(question.notifyOnAnswer ?? true)
  const [draft, setDraft] = useState('')
  const [postAnon, setPostAnon] = useState(false)
  const [posting, setPosting] = useState(false)
  const [reported, setReported] = useState<Set<string>>(new Set())

  const sorted = useMemo(
    () =>
      [...answers].sort((a, b) => {
        if (a.id === acceptedId) return -1
        if (b.id === acceptedId) return 1
        return b.upvotes - a.upvotes
      }),
    [answers, acceptedId]
  )

  const report = async (targetType: 'question' | 'answer', targetId: string) => {
    if (!user) {
      openAuthModal('login')
      return
    }
    try {
      await submitReport({ targetType, targetId })
      setReported((prev) => new Set(prev).add(`${targetType}:${targetId}`))
      showToast('Report noted. Our team will take a look.', 'success')
    } catch (err) {
      console.error('Report failed:', err)
      showToast('Could not send that report. Try again.', 'error')
    }
  }

  const accept = async (a: CommunityAnswer) => {
    if (!question.mine) return
    try {
      await setAcceptedAnswer(question.id, a.id)
      setAcceptedId(a.id)
      showToast('Marked as the accepted answer.', 'success')
    } catch (err) {
      console.error('Accept failed:', err)
      showToast('Could not mark that. Try again.', 'error')
    }
  }

  const toggleNotify = async (enabled: boolean) => {
    setNotifyOn(enabled)
    try {
      await setQuestionNotify(question.id, enabled)
    } catch (err) {
      console.error('Notify toggle failed:', err)
      setNotifyOn(!enabled)
      showToast('Could not save that. Try again.', 'error')
    }
  }

  const postAnswer = async () => {
    const text = draft.trim()
    if (!text) return
    if (!user) {
      openAuthModal('login')
      return
    }
    if (posting) return
    setPosting(true)
    try {
      await submitAnswer({ questionSlug: question.slug, body: text, anonymous: postAnon })
      setDraft('')
      setPostAnon(false)
      showToast('Answer posted.', 'success')
      // Reload from the database — what renders is what persisted.
      await refetch()
    } catch (err) {
      console.error('Answer post failed:', err)
      showToast(err instanceof Error ? err.message : 'Could not post that. Try again.', 'error')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="container qa-detail">
      <Seo
        path={`/community/q/${question.slug}`}
        title={question.title}
        description={question.body[0]?.slice(0, 155) ?? question.excerpt}
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
        {question.body.map((p, i) => (
          <p key={`${i}-${p.slice(0, 16)}`}>{p}</p>
        ))}
      </div>

      <div className="qa-actions">
        <VotePill
          targetType="question"
          targetId={question.id}
          count={question.upvotes}
          initialUpvoted={question.viewerUpvoted}
          label="Me too"
        />
        {question.mine && question.notifyOnAnswer !== undefined && (
          <label className="form-checkbox-label qa-notify-toggle">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={notifyOn}
              onChange={(e) => toggleNotify(e.target.checked)}
            />
            Email me when someone answers
          </label>
        )}
        <button
          type="button"
          className="flag-btn"
          onClick={() => report('question', question.id)}
          disabled={reported.has(`question:${question.id}`)}
        >
          <Icons.Flag /> {reported.has(`question:${question.id}`) ? 'Reported' : 'Report'}
        </button>
      </div>

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
              {a.body.map((p, i) => (
                <p key={`${i}-${p.slice(0, 16)}`}>{p}</p>
              ))}
            </div>
            <div className="a-foot">
              <VotePill
                targetType="answer"
                targetId={a.id}
                count={a.upvotes}
                initialUpvoted={a.viewerUpvoted}
              />
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
                onClick={() => report('answer', a.id)}
                disabled={reported.has(`answer:${a.id}`)}
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={postAnswer}
                disabled={posting}
              >
                {posting ? 'Posting…' : 'Post answer'}
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
