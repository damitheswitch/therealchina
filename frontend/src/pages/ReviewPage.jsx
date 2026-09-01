import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
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

  // Pre-fill the university name when arriving with ?uni=<slug>
  useEffect(() => {
    const slug = searchParams.get('uni')
    if (!slug) return

    const loadUniversity = async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('name, slug')
        .eq('slug', slug)
        .single()

      if (error) {
        console.error('Error loading university:', error)
        return
      }

      if (data) {
        setSelectedUni(data.slug || '')
        setSelectedUniName(data.name || '')
      }
    }

    loadUniversity()
  }, [searchParams])

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
      let universityId = null
      let redirectSlug = selectedUni

      // Handle "not listed" university creation
      if (selectedUni === '__not_listed') {
        if (!newUniName.trim() || !newUniCity.trim()) {
          showToast('Please enter university name and city', 'error')
          setLoading(false)
          return
        }

        // Create slug from name
        const slug = newUniName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')

        // Insert new university
        const { data: newUni, error: uniError } = await supabase
          .from('universities')
          .insert({
            name: newUniName.trim(),
            city: newUniCity.trim(),
            slug,
          })
          .select()
          .single()

        if (uniError) throw uniError
        universityId = newUni.id
        redirectSlug = null // Original behavior: new universities redirect home
      } else if (selectedUni) {
        const { data: uni, error: uniError } = await supabase
          .from('universities')
          .select('id, slug')
          .eq('slug', selectedUni)
          .single()

        if (uniError) throw uniError
        universityId = uni.id
      } else if (selectedUniName.trim()) {
        // User typed a name without selecting from the list; try to resolve it.
        const { data: uni, error: uniError } = await supabase
          .from('universities')
          .select('id, slug')
          .ilike('name', selectedUniName.trim())
          .single()

        if (uniError) {
          if (uniError.code !== 'PGRST116') throw uniError
          showToast('Please select a university from the list', 'error')
          setLoading(false)
          return
        }

        universityId = uni.id
        redirectSlug = uni.slug
      }

      if (!universityId) {
        showToast('Please select a university', 'error')
        setLoading(false)
        return
      }

      // Media has already been uploaded while the user filled out the form.
      const { error: reviewError } = await supabase.from('reviews').insert({
        university_id: universityId,
        user_id: user?.id || null,
        rating,
        text: reviewText.trim(),
        program: program.trim() || null,
        degree_level: degreeLevel || null,
        media: mediaState.media,
      })

      if (reviewError) throw reviewError

      showToast('Review submitted! Thank you.', 'success')

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
        const target = universityId && redirectSlug ? `/university/${redirectSlug}` : '/'
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

          {/* Submit */}
          <div className="form-submit-row">
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || mediaState.uploading}
            >
              {loading
                ? 'Submitting...'
                : mediaState.uploading
                  ? 'Processing media...'
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
