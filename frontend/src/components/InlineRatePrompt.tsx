import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StarInput } from './StarInput'
import { RATING_VIBE } from '../lib/reviewFlow'
import type { Tables } from '../types/database.types'

type UniversityRef = Pick<Tables<'universities'>, 'id' | 'name' | 'slug'>

const QUICK_VERDICTS: {
  value: 'yes' | 'maybe' | 'no'
  emoji: string
  label: string
  defaultRating: number
}[] = [
  { value: 'yes', emoji: '👍', label: 'Recommend', defaultRating: 5 },
  { value: 'maybe', emoji: '🤔', label: 'Mixed', defaultRating: 3 },
  { value: 'no', emoji: '👎', label: 'Avoid', defaultRating: 2 },
]

const inferRecommend = (rating: number): 'yes' | 'maybe' | 'no' => {
  if (rating >= 4) return 'yes'
  if (rating === 3) return 'maybe'
  return 'no'
}

export const InlineRatePrompt = ({ university }: { university: UniversityRef }) => {
  const navigate = useNavigate()
  const [rating, setRating] = useState<number>(0)
  const [recommend, setRecommend] = useState<'yes' | 'maybe' | 'no' | ''>('')
  const [recommendTouched, setRecommendTouched] = useState(false)
  const [text, setText] = useState('')

  const expanded = rating > 0
  const vibe = RATING_VIBE[rating]

  const handleStarChange = (nextRating: number) => {
    setRating(nextRating)
    if (!recommendTouched) {
      setRecommend(inferRecommend(nextRating))
    }
  }

  const handleVerdictClick = (v: (typeof QUICK_VERDICTS)[number]) => {
    setRecommendTouched(true)
    if (recommend === v.value && expanded) {
      setRecommend('')
      return
    }
    setRecommend(v.value)
    if (rating === 0) {
      setRating(v.defaultRating)
    }
  }

  const handleContinue = () => {
    if (!rating) return
    const params = new URLSearchParams()
    params.set('uni', university.slug)
    params.set('rating', String(rating))
    if (recommend) params.set('recommend', recommend)
    const trimmed = text.trim()
    if (trimmed) params.set('text', trimmed)
    navigate(`/review?${params.toString()}`)
  }

  return (
    <section
      className={`inline-rate-card${expanded ? ' expanded' : ''}`}
      aria-label={`Quick rate ${university.name}`}
    >
      <div className="inline-rate-top">
        <div className="inline-rate-copy">
          <span className="inline-rate-eyebrow">Studying or studied here?</span>
          <h3 className="inline-rate-title">Rate {university.name} in one tap</h3>
          <p className="inline-rate-sub">
            🔒 100% anonymous by default. Tap a star or verdict to start.
          </p>
        </div>

        <div className="inline-rate-controls">
          <StarInput value={rating} onChange={handleStarChange} />
          <div
            className="inline-rate-verdicts"
            role="group"
            aria-label="Would you recommend this university?"
          >
            {QUICK_VERDICTS.map((v) => (
              <button
                key={v.value}
                type="button"
                className={`inline-verdict-pill${recommend === v.value ? ' selected' : ''}`}
                aria-pressed={recommend === v.value}
                onClick={() => handleVerdictClick(v)}
              >
                <span aria-hidden="true">{v.emoji}</span>
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="inline-rate-drawer fade-in">
          {vibe && (
            <div className="inline-rate-vibe" aria-live="polite">
              <span className="vibe-emoji" key={rating}>
                {vibe.emoji}
              </span>
              <span>{vibe.text}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor={`inline-rate-text-${university.id}`}>
              Got 20 seconds to tell future students why?{' '}
              <span className="form-hint-inline">optional</span>
            </label>
            <textarea
              id={`inline-rate-text-${university.id}`}
              className="form-textarea inline-rate-textarea"
              rows={2}
              maxLength={5000}
              placeholder="One honest sentence about dorms, classes, stipends, or city life..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="inline-rate-footer">
            <span className="form-hint">
              Next: tap at least 2 things that stood out, then publish. No account required.
            </span>
            <button type="button" className="btn btn-primary" onClick={handleContinue}>
              Continue to publish →
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
