import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icons } from './Icons'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { useToast } from '../contexts/ToastContext'
import { useUniversityQuestions } from '../hooks/useCommunity'
import { submitQuestion } from '../lib/communityApi'
import { COMMUNITY_CATEGORIES, categoryLabel } from '../lib/community'
import type { Tables } from '../types/database.types'

type UniversityRef = Pick<Tables<'universities'>, 'id' | 'name' | 'slug'> & {
  city?: string | null
}

const buildPromptTemplates = (uniName: string) => [
  {
    id: 'housing',
    category: 'housing',
    chip: 'Dorms & housing',
    question: `How are the dorms at ${uniName}?`,
    body: `Looking for honest details from current students at ${uniName} on single vs shared rooms, bathroom setup, curfews, and monthly rent.`,
  },
  {
    id: 'academics',
    category: 'academics',
    chip: 'Faculty & classes',
    question: `How are the faculty and classes at ${uniName}?`,
    body: `Wondering about class quality at ${uniName}: are professors approachable, are English-taught courses actually in English, and how are exams run?`,
  },
  {
    id: 'money',
    category: 'money',
    chip: 'Monthly living cost',
    question: `What is a realistic monthly budget for a student at ${uniName}?`,
    body: `Trying to budget for canteen food, dorm utilities, and daily expenses around ${uniName}. What do you spend in a typical month?`,
  },
  {
    id: 'scholarships',
    category: 'academics',
    chip: 'Scholarships',
    question: `What scholarships can international students get at ${uniName}?`,
    body: `Asking about CSC, university, or provincial scholarships at ${uniName}: what they cover, and how hard they are to get.`,
  },
  {
    id: 'life',
    category: 'life',
    chip: 'International office & visas',
    question: `How helpful is the international student office at ${uniName}?`,
    body: `How smooth is registration, residence permit renewal, and dealing with admin staff at ${uniName}?`,
  },
]

export const AskStudentBox = ({ university }: { university: UniversityRef }) => {
  const { user } = useAuth()
  const { openAuthModal } = useAuthModal()
  const { showToast } = useToast()
  const { questions, loading, refetch } = useUniversityQuestions(university.id)

  const templates = buildPromptTemplates(university.name)
  const [questionText, setQuestionText] = useState('')
  const [detailsText, setDetailsText] = useState('')
  const [category, setCategory] = useState('housing')
  const [showDetails, setShowDetails] = useState(false)
  const [postAnon, setPostAnon] = useState(false)
  const [posting, setPosting] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const pickTemplate = (t: (typeof templates)[number]) => {
    setQuestionText(t.question)
    setDetailsText(t.body)
    setCategory(t.category)
  }

  const copyShareSnippet = async (qTitle: string, targetUrl: string, key: string) => {
    const text = `Anyone studying at ${university.name}? Quick question: "${qTitle}"\n\nAnswer or share your experience here: ${targetUrl}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      showToast('Copied message for WeChat / WhatsApp groups.', 'success')
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev))
      }, 2500)
    } catch {
      showToast('Could not copy link. Try copying from the address bar.', 'error')
    }
  }

  const buildAnswerAsReviewUrl = (qTitle: string, qSlug?: string) => {
    const params = new URLSearchParams()
    params.set('uni', university.slug)
    params.set('prompt', qTitle)
    if (qSlug) params.set('qSlug', qSlug)
    return `/review?${params.toString()}`
  }

  const handleAskSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const title = questionText.trim()
    if (title.length < 10) {
      showToast('Write a specific question (at least 10 characters).', 'error')
      return
    }
    if (!user) {
      openAuthModal('login')
      return
    }
    if (posting) return

    const body =
      detailsText.trim().length >= 20
        ? detailsText.trim()
        : `${title} Looking for first-hand experience from current or past students at ${university.name}.`

    setPosting(true)
    try {
      await submitQuestion({
        title,
        body,
        category,
        city: university.city || undefined,
        universitySlug: university.slug,
        anonymous: postAnon,
        notifyOnAnswer: true,
      })
      setQuestionText('')
      setDetailsText('')
      setShowDetails(false)
      showToast('Question posted! Share it in a student group to get answers fast.', 'success')
      await refetch()
    } catch (err) {
      console.error('Failed to post university question:', err)
      showToast(err instanceof Error ? err.message : 'Could not post question.', 'error')
    } finally {
      setPosting(false)
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://therealchina.org'

  return (
    <div className="ask-student-wrap" id="ask-student">
      <div className="ask-student-card">
        <div className="ask-student-head">
          <span className="ask-student-eyebrow">No reviews yet, ask a peer</span>
          <h3 className="ask-student-title">Ask a student at {university.name}</h3>
          <p className="ask-student-sub">
            Students rarely wake up wanting to write a full review, but they gladly answer a
            specific question. Ask yours below, or share a prompt in a student group.
          </p>
        </div>

        <div className="ask-student-chips-block">
          <span className="ask-student-chips-label">Tap a common question or write your own:</span>
          <div className="chip-row">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip ${questionText === t.question ? 'selected' : ''}`}
                onClick={() => pickTemplate(t)}
              >
                {t.chip}
              </button>
            ))}
          </div>
        </div>

        <form className="ask-student-form" onSubmit={handleAskSubmit}>
          <div className="ask-student-input-row">
            <label htmlFor="ask-uni-question" className="sr-only">
              Ask a question about {university.name}
            </label>
            <input
              id="ask-uni-question"
              type="text"
              className="form-input"
              placeholder={`e.g. How are the dorms at ${university.name}?`}
              value={questionText}
              maxLength={160}
              onChange={(e) => setQuestionText(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary ask-student-send"
              aria-label="Ask question"
              disabled={posting}
            >
              <span className="ask-student-send-label">
                {posting ? 'Posting...' : 'Ask question'}
              </span>
              <Icons.ArrowRight />
            </button>
          </div>

          <div className="ask-student-meta-row">
            <label htmlFor="ask-uni-category" className="sr-only">
              Topic
            </label>
            <select
              id="ask-uni-category"
              className="form-select ask-student-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {COMMUNITY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowDetails((s) => !s)}
            >
              {showDetails ? 'Hide extra context' : '+ Add context'}
            </button>
            <label className="form-checkbox-label" htmlFor="ask-uni-anon">
              <input
                id="ask-uni-anon"
                type="checkbox"
                className="form-checkbox"
                checked={postAnon}
                onChange={(e) => setPostAnon(e.target.checked)}
              />
              Ask anonymously
            </label>
          </div>

          {showDetails && (
            <div className="form-group ask-student-details">
              <label htmlFor="ask-uni-details" className="form-label">
                Extra details <span className="form-hint-inline">optional</span>
              </label>
              <textarea
                id="ask-uni-details"
                className="form-textarea"
                rows={2}
                placeholder="Any specific program, scholarship, or intake year?"
                value={detailsText}
                onChange={(e) => setDetailsText(e.target.value)}
              />
            </div>
          )}
        </form>

        {questionText.trim().length >= 10 && (
          <div className="ask-student-share-strip">
            <span>Share or answer:</span>
            <div className="ask-student-quick-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() =>
                  copyShareSnippet(
                    questionText.trim(),
                    `${origin}${buildAnswerAsReviewUrl(questionText.trim())}`,
                    'draft'
                  )
                }
              >
                <Icons.WeChat size={15} />{' '}
                {copiedKey === 'draft' ? 'Copied for group!' : 'Copy to share in student group'}
              </button>
              <Link
                to={buildAnswerAsReviewUrl(questionText.trim())}
                className="btn btn-ghost btn-sm"
              >
                Study here? Answer this as a review <Icons.ArrowRight />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Questions waiting for a student answer (live DB questions + starter prompts if none yet) */}
      <div className="ask-student-questions">
        <div className="ask-student-questions-head">
          <h4>
            {questions.length > 0
              ? `Questions about ${university.name} (${questions.length})`
              : `Questions students are asking about ${university.name}`}
          </h4>
          <span>Study or studied here? Answering a question publishes your experience.</span>
        </div>

        {loading ? (
          <p className="form-hint">Loading questions...</p>
        ) : questions.length > 0 ? (
          <ul className="ask-student-q-list">
            {questions.map((q) => {
              const reviewUrl = buildAnswerAsReviewUrl(q.title, q.slug)
              const shareUrl = `${origin}${reviewUrl}`
              return (
                <li key={q.id} className="ask-student-q-item">
                  <div className="ask-student-q-main">
                    <div className="ask-student-q-top">
                      <span className="guide-tag">{categoryLabel(q.category)}</span>
                      <span className="ask-student-q-meta">
                        asked by {q.author?.displayName ?? 'Anonymous'} · {q.ago}
                      </span>
                    </div>
                    <Link to={`/community/q/${q.slug}`} className="ask-student-q-title">
                      {q.title}
                    </Link>
                    <p className="ask-student-q-excerpt">{q.excerpt}</p>
                  </div>
                  <div className="ask-student-q-actions">
                    <Link to={reviewUrl} className="btn btn-primary btn-sm">
                      <Icons.Pen /> Answer &amp; turn into review
                    </Link>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-label={copiedKey === q.id ? 'Copied' : 'Share in student group'}
                      onClick={() => copyShareSnippet(q.title, shareUrl, q.id)}
                    >
                      <Icons.WeChat size={14} />{' '}
                      <span className="ask-student-share-text">
                        {copiedKey === q.id ? 'Copied!' : 'Share in group'}
                      </span>
                    </button>
                    <Link to={`/community/q/${q.slug}`} className="ask-student-q-replies">
                      {q.answerCount > 0
                        ? `${q.answerCount} ${q.answerCount === 1 ? 'reply' : 'replies'}, view thread`
                        : 'View thread'}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="ask-student-q-list">
            {templates.slice(0, 3).map((t) => {
              const reviewUrl = buildAnswerAsReviewUrl(t.question)
              const shareUrl = `${origin}${reviewUrl}`
              return (
                <li key={t.id} className="ask-student-q-item">
                  <div className="ask-student-q-main">
                    <div className="ask-student-q-top">
                      <span className="guide-tag">{categoryLabel(t.category)}</span>
                      <span className="ask-student-q-meta">Suggested prompt</span>
                    </div>
                    <span className="ask-student-q-title">{t.question}</span>
                    <p className="ask-student-q-excerpt">{t.body}</p>
                  </div>
                  <div className="ask-student-q-actions">
                    <Link to={reviewUrl} className="btn btn-primary btn-sm">
                      <Icons.Pen /> Answer as a student
                    </Link>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-label={copiedKey === t.id ? 'Copied' : 'Share in student group'}
                      onClick={() => copyShareSnippet(t.question, shareUrl, t.id)}
                    >
                      <Icons.WeChat size={14} />{' '}
                      <span className="ask-student-share-text">
                        {copiedKey === t.id ? 'Copied!' : 'Share in group'}
                      </span>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
