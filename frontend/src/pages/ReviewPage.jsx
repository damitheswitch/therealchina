import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { supabase } from '../lib/supabaseClient'
import { submitReview } from '../lib/reviewSubmit'
import { StarInput } from '../components/StarInput'
import { Icons } from '../components/Icons'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { RegistrationNudge } from '../components/RegistrationNudge'
import { ProgramAutocomplete } from '../components/ProgramAutocomplete'
import { UniversityAutocomplete } from '../components/UniversityAutocomplete'
import { MediaUploader } from '../components/MediaUploader'
import { SealStampOverlay } from '../components/SealStampOverlay'

// ReviewPage component
export const ReviewPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { openAuthModal } = useAuthModal()

  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [selectedUni, setSelectedUni] = useState(searchParams.get('uni') || '')
  const [selectedUniName, setSelectedUniName] = useState('')
  const [showNotListed, setShowNotListed] = useState(false)
  const [newUniName, setNewUniName] = useState('')
  const [newUniCity, setNewUniCity] = useState('')
  const [program, setProgram] = useState('')
  const [degreeLevel, setDegreeLevel] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  // Media uploads start the moment files are picked; this mirrors their state
  const [mediaState, setMediaState] = useState({ media: [], uploading: false, errorCount: 0 })
  const [loading, setLoading] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  // Stash the post-stamp action (navigate or open auth modal) so it fires
  // after the celebration animation completes.
  const [pendingSuccess, setPendingSuccess] = useState(null)

  // Anonymous submissions are gated by a Turnstile challenge (server-verified
  // inside the review-submit Edge Function). Logged-in users skip it.
  const reviewTurnstileRef = useRef(null)
  const [reviewTurnstileReady, setReviewTurnstileReady] = useState(false)

  // Re-open the anonymous-review thank-you modal if the user is still signing up
  useEffect(() => {
    if (user) return
    const submitted = sessionStorage.getItem('trc_anon_review_submitted')
    if (!submitted) return
    openAuthModal('register', {
      title: 'Thanks for your review!',
      subtitle:
        'Please log in or create a free account to view your review and engage with other students.',
      closable: false,
    })
  }, [user, openAuthModal])

  // Pre-fill the university name when arriving with ?uni=<slug>.
  // Depend on the primitive value, not the searchParams object (a new object
  // identity every render would refire this effect constantly).
  const uniSlug = searchParams.get('uni')
  useEffect(() => {
    if (!uniSlug) return

    const controller = new AbortController()
    const loadUniversity = async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('name, slug')
        .eq('slug', uniSlug)
        .abortSignal(controller.signal)
        .single()

      if (error) {
        if (error?.name !== 'AbortError') console.error('Error loading university:', error)
        return
      }

      if (data) {
        setSelectedUni(data.slug || '')
        setSelectedUniName(data.name || '')
      }
    }

    loadUniversity()
    return () => controller.abort()
  }, [uniSlug])

  const handleUniversityChange = (value) => {
    setSelectedUniName(value)
    setSelectedUni('')
    setShowNotListed(false)
  }

  const handleUniversitySelect = (option) => {
    const data = option?.data || option
    setSelectedUniName(data?.name || option?.value || '')
    setSelectedUni(data?.slug || option?.key || '')
    setShowNotListed(false)
  }

  const handleNotListed = () => {
    setSelectedUniName("My university isn't listed")
    setSelectedUni('__not_listed')
    setShowNotListed(true)
  }

  const handleStampComplete = () => {
    setShowStamp(false)
    if (pendingSuccess) {
      pendingSuccess()
      setPendingSuccess(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!rating) {
      showToast('Please select a star rating', 'error')
      return
    }

    if (!selectedUni) {
      showToast('Please select a university', 'error')
      return
    }

    if (!reviewText.trim()) {
      showToast('Please write your review', 'error')
      return
    }

    if (mediaState.uploading) {
      showToast('Please wait for your media to finish uploading', 'error')
      return
    }

    if (mediaState.errorCount > 0) {
      showToast('Please retry or remove failed media attachments', 'error')
      return
    }

    setLoading(true)

    try {
      // Anonymous reviewers must solve the Turnstile challenge; the token is
      // verified server-side inside the review-submit Edge Function.
      let cfToken
      if (!user) {
        if (!reviewTurnstileRef.current) {
          throw new Error('Verification is still loading. Please wait a moment and try again.')
        }
        cfToken = await reviewTurnstileRef.current.getResponsePromise(30000, 250)
        if (!cfToken) {
          throw new Error('Verification failed. Please refresh and try again.')
        }
      }

      const isNotListed = selectedUni === '__not_listed'
      if (isNotListed && (!newUniName.trim() || !newUniCity.trim())) {
        showToast('Please enter university name and city', 'error')
        return
      }

      // The Edge Function resolves/creates the university (server-side slug),
      // validates the payload, and writes the review with the service role.
      const result = await submitReview({
        cfToken,
        universitySlug: !isNotListed && selectedUni ? selectedUni : undefined,
        universityName:
          !isNotListed && !selectedUni && selectedUniName.trim()
            ? selectedUniName.trim()
            : undefined,
        newUniversity: isNotListed
          ? { name: newUniName.trim(), city: newUniCity.trim() }
          : undefined,
        rating,
        text: reviewText.trim(),
        program: program.trim() || undefined,
        degreeLevel: degreeLevel || undefined,
        media: mediaState.media,
      })

      showToast('Review submitted! Thank you.', 'success')

      // Newly created universities keep the original behavior: redirect home.
      const redirectSlug = result.universityCreated ? null : result.universitySlug

      // Play the seal-stamp celebration, then run the post-submit action
      // (open the auth modal for anon users, or navigate for logged-in users).
      if (!user) {
        sessionStorage.setItem('trc_anon_review_submitted', 'true')
        sessionStorage.setItem('trc_anon_review_redirect', redirectSlug || '')
        setPendingSuccess(
          () => () =>
            openAuthModal('register', {
              title: 'Thanks for your review!',
              subtitle:
                'Please log in or create a free account to view your review and engage with other students.',
              closable: false,
            })
        )
      } else {
        const target = redirectSlug ? `/university/${redirectSlug}` : '/'
        setPendingSuccess(() => () => navigate(target))
      }
      setShowStamp(true)
    } catch (error) {
      console.error('Error submitting review:', error)
      showToast(error.message || 'Failed to submit review', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: '700px' }}>
      <div className="section">
        <Link to="/" className="btn btn-outline" style={{ marginBottom: 'var(--sp-2)' }}>
          <Icons.ArrowLeft /> Back
        </Link>
        <h1 className="section-title">Leave a Review</h1>
        <p className="muted mb-3">Share your authentic experience. Photos & videos welcome!</p>

        <form
          id="review-form"
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}
        >
          {/* Star Rating */}
          <div className="form-group">
            <label className="form-label">Your rating</label>
            <StarInput value={rating} onChange={setRating} />
          </div>

          {/* University */}
          <div className="form-group">
            <label className="form-label" htmlFor="uni-select">
              University
            </label>
            <UniversityAutocomplete
              id="uni-select"
              value={selectedUniName}
              placeholder="Start typing a university..."
              onChange={handleUniversityChange}
              onSelect={handleUniversitySelect}
              onNotListed={handleNotListed}
              allowNotListed={true}
            />
          </div>

          {/* Inline fields for unlisted university */}
          {showNotListed && (
            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="new-uni-name">
                  University name
                </label>
                <input
                  type="text"
                  id="new-uni-name"
                  className="form-input"
                  placeholder="e.g. East China Normal University"
                  value={newUniName}
                  onChange={(e) => setNewUniName(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                <label className="form-label" htmlFor="new-uni-city">
                  City
                </label>
                <input
                  type="text"
                  id="new-uni-city"
                  className="form-input"
                  placeholder="e.g. Shanghai"
                  value={newUniCity}
                  onChange={(e) => setNewUniCity(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Review Text */}
          <div className="form-group">
            <label className="form-label" htmlFor="review-text">
              Your review
            </label>
            <textarea
              id="review-text"
              className="form-textarea"
              placeholder="Tell other students about your experience — academics, campus life, dormitories, the city, anything that matters..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
          </div>

          {/* Collapsible optional details */}
          <div>
            <button
              type="button"
              className={`collapse-trigger ${detailsOpen ? 'open' : ''}`}
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              <span>Add more detail (optional)</span>
              <Icons.Chevron />
            </button>
            <div className={`collapse-content ${detailsOpen ? 'open' : ''}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="form-label" htmlFor="program">
                      Program
                    </label>
                    <ProgramAutocomplete
                      id="program"
                      placeholder="e.g. Computer Science"
                      value={program}
                      onChange={setProgram}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                    <label className="form-label" htmlFor="degree-level">
                      Degree level
                    </label>
                    <select
                      id="degree-level"
                      className="form-select"
                      value={degreeLevel}
                      onChange={(e) => setDegreeLevel(e.target.value)}
                    >
                      <option value="">Select...</option>
                      <option value="Bachelor">Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="PhD">PhD</option>
                      <option value="Certificate">Certificate</option>
                      <option value="Exchange">Exchange</option>
                      <option value="Language Course">Language Course</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <MediaUploader onStateChange={setMediaState} disabled={loading} />
              </div>
            </div>
          </div>

          {/* Anonymous reviewers must pass a Turnstile challenge before submitting */}
          {!user && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Turnstile
                ref={reviewTurnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
                onWidgetLoad={() => setReviewTurnstileReady(true)}
                onError={(error) => {
                  console.error('[Turnstile] review widget error:', error)
                  showToast('Verification challenge error. Please refresh and try again.', 'error')
                }}
                onExpire={() => reviewTurnstileRef.current?.reset()}
                options={{
                  execution: 'render',
                  size: 'normal',
                  appearance: 'interaction-only',
                  action: 'review-submit',
                }}
              />
            </div>
          )}

          {/* Submit */}
          <div className="form-submit-row">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || mediaState.uploading || (!user && !reviewTurnstileReady)}
            >
              {loading
                ? 'Submitting...'
                : mediaState.uploading
                  ? 'Processing media...'
                  : !user && !reviewTurnstileReady
                    ? 'Verifying you are human...'
                    : 'Submit Review'}
            </button>
            <span className="form-hint">By submitting, you agree to share honest content.</span>
          </div>
        </form>
      </div>

      <RegistrationNudge />

      {showStamp && <SealStampOverlay onComplete={handleStampComplete} />}
    </div>
  )
}
