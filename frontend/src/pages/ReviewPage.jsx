import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { StarInput } from '../components/StarInput'
import { Icons } from '../components/Icons'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { RegistrationNudge } from '../components/RegistrationNudge'
import { ProgramAutocomplete } from '../components/ProgramAutocomplete'
import { MediaUploader } from '../components/MediaUploader'

// ReviewPage component
export const ReviewPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [universities, setUniversities] = useState([])
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [selectedUni, setSelectedUni] = useState(searchParams.get('uni') || '')
  const [showNotListed, setShowNotListed] = useState(false)
  const [newUniName, setNewUniName] = useState('')
  const [newUniCity, setNewUniCity] = useState('')
  const [program, setProgram] = useState('')
  const [degreeLevel, setDegreeLevel] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  // Media uploads start the moment files are picked; this mirrors their state
  const [mediaState, setMediaState] = useState({ media: [], uploading: false, errorCount: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUniversities()
  }, [])

  const fetchUniversities = async () => {
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching universities:', error)
      return
    }

    setUniversities(data || [])
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
      } else if (selectedUni) {
        const uni = universities.find((u) => u.slug === selectedUni)
        universityId = uni?.id
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

      // Redirect to university page or home
      setTimeout(() => {
        if (universityId && selectedUni !== '__not_listed') {
          navigate(`/university/${selectedUni}`)
        } else {
          navigate('/')
        }
      }, 1200)
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
            <select
              id="uni-select"
              className="form-select"
              value={selectedUni}
              onChange={(e) => {
                setSelectedUni(e.target.value)
                setShowNotListed(e.target.value === '__not_listed')
              }}
            >
              <option value="">Select a university...</option>
              {universities.map((u) => (
                <option key={u.id} value={u.slug}>
                  {u.name} — {u.city}
                </option>
              ))}
              <option value="__not_listed">My university isn't listed</option>
            </select>
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
          <div style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'center' }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading || mediaState.uploading}>
              {loading ? 'Submitting...' : mediaState.uploading ? 'Processing media...' : 'Submit Review'}
            </button>
            <span className="form-hint">By submitting, you agree to share honest content.</span>
          </div>
        </form>
      </div>

      <RegistrationNudge />
    </div>
  )
}
