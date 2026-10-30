import { useMemo, useRef, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
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
  const [justPostedAnswer, setJustPostedAnswer] = useState<string | null>(null)
  const [copiedShare, setCopiedShare] = useState(false)
  // Guest answers: the Turnstile widget mounts on first keystroke, so visitors
  // who only read never load it.
  const guestTurnstileRef = useRef<TurnstileInstance | undefined>(undefined)
  const [guestTurnstileReady, setGuestTurnstileReady] = useState(false)
  const [guestInviteOpen, setGuestInviteOpen] = useState(false)

  const buildConvertReviewUrl = (answerText?: string) => {
    if (!question.university) return '/review'
    const params = new URLSearchParams()
    params.set('uni', question.university.slug)
    params.set('prompt', question.title)
    params.set('qSlug', question.slug)
    if (answerText) params.set('answer', answerText)
    return `/review?${params.toString()}`
  }

  const copyGroupShare = async () => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://therealchina.org'
    const targetUrl = question.university
      ? `${origin}${buildConvertReviewUrl()}`
      : `${origin}/community/q/${question.slug}`
    const prefix = question.university
      ? `Anyone studying at ${question.university.name}? Quick question: "${question.title}"`
      : `Quick question for students in China: "${question.title}"`
    try {
      await navigator.clipboard.writeText(`${prefix}\n\nAnswer here: ${targetUrl}`)
      setCopiedShare(true)
      showToast('Copied question for WeChat / WhatsApp groups.', 'success')
      setTimeout(() => setCopiedShare(false), 2500)
    } catch {
      showToast('Could not copy link.', 'error')
    }
  }

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
    if (posting) return
    setPosting(true)
    try {
      let cfToken: string | undefined
      if (!user) {
        if (!guestTurnstileRef.current) {
          throw new Error('The verification check is still loading. Try again in a moment.')
        }
        cfToken = await guestTurnstileRef.current.getResponsePromise(30000, 250)
        if (!cfToken) throw new Error('Verification failed. Please try again.')
      }
      await submitAnswer({
        questionSlug: question.slug,
        body: text,
        anonymous: postAnon,
        cfToken,
      })
      setJustPostedAnswer(text)
      setDraft('')
      setPostAnon(false)
      if (!user) {
        // Tokens are single use.
        guestTurnstileRef.current?.reset()
        setGuestInviteOpen(true)
      }
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
        <button type="button" className="btn btn-outline btn-sm" onClick={copyGroupShare}>
          <Icons.WeChat size={14} /> {copiedShare ? 'Copied for group!' : 'Share in student group'}
        </button>
        {question.university && (
          <Link to={buildConvertReviewUrl()} className="btn btn-ghost btn-sm">
            <Icons.Pen /> Answer as a review
          </Link>
        )}
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
              {a.mine && question.university && (
                <Link
                  to={buildConvertReviewUrl(a.body.join('\n\n'))}
                  className="accept-btn"
                  style={{ color: 'var(--seal-red)', borderColor: 'var(--seal-red)' }}
                >
                  <Icons.Pen /> Turn answer into a {question.university.name} review
                </Link>
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

      {justPostedAnswer && question.university && (
        <div className="convert-review-banner">
          <div>
            <strong>Thanks for answering!</strong> Turn your reply into a review for{' '}
            {question.university.name} in one click (your answer is already filled in).
          </div>
          <Link to={buildConvertReviewUrl(justPostedAnswer)} className="btn btn-primary btn-sm">
            <Icons.Pen /> Convert to review
          </Link>
        </div>
      )}

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
            <p className="form-hint">
              You can answer without an account. It will show as Anonymous.
            </p>
            {draft.trim().length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Turnstile
                  ref={guestTurnstileRef}
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
                  onWidgetLoad={() => setGuestTurnstileReady(true)}
                  onError={(error) => {
                    console.error('[Turnstile] answer widget error:', error)
                    showToast(
                      'Verification challenge error. Please refresh and try again.',
                      'error'
                    )
                  }}
                  onExpire={() => guestTurnstileRef.current?.reset()}
                  options={{
                    execution: 'render',
                    size: 'normal',
                    appearance: 'interaction-only',
                    action: 'community-answer',
                  }}
                />
              </div>
            )}
            <div className="answer-form-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={postAnswer}
                disabled={posting || !guestTurnstileReady}
              >
                {posting ? 'Posting…' : 'Post answer'}
              </button>
            </div>
            {guestInviteOpen && (
              <div className="convert-review-banner" role="status">
                <div>
                  <strong>Answer posted.</strong> Create a free account to ask your own questions
                  and get an email when a student answers.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    openAuthModal('register', {
                      title: 'Create your free account',
                      subtitle:
                        'Ask your own questions and get an email when a student answers. Your earlier answer stays anonymous.',
                      closable: true,
                    })
                  }
                >
                  Create free account
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setGuestInviteOpen(false)}
                  aria-label="Close this message"
                >
                  Close
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
