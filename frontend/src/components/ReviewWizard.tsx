import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import { submitReview, type MediaItem, type SubScores } from '../lib/reviewSubmit'
import { useUniversity } from '../hooks/useUniversity'
import { StarInput } from './StarInput'
import { Icons } from './Icons'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { RegistrationNudge } from './RegistrationNudge'
import { ProgramAutocomplete } from './ProgramAutocomplete'
import { UniversityAutocomplete } from './UniversityAutocomplete'
import { MediaUploader } from './MediaUploader'
import { SealStampOverlay } from './SealStampOverlay'

// ---- Constants ----------------------------------------------------------------

const TOTAL_STEPS = 5

const SUBSCORE_FIELDS: { key: keyof SubScores; label: string }[] = [
  { key: 'rating_academics', label: 'Academics / teaching' },
  { key: 'rating_campus', label: 'Campus & facilities' },
  { key: 'rating_accommodation', label: 'Accommodation / dorms' },
  { key: 'rating_cost', label: 'Cost of living in the city' },
  { key: 'rating_intl_office', label: 'International office support' },
  { key: 'rating_social', label: 'Social life / community' },
  { key: 'rating_extracurricular', label: 'Extracurricular activities' },
  { key: 'rating_career', label: 'Career & job support' },
]

const POPULAR_TAGS = [
  'Strong academics',
  'Great food',
  'Expensive city',
  'Easy visa',
  'Good dorms',
  'Crowded',
  'Strong CS',
  'International-friendly',
  'Beautiful campus',
  'Good nightlife',
  'Safe',
  'Cheap city',
]

const MORE_TAGS = [
  'Strong engineering',
  'Good language program',
  'Research opportunities',
  'Modern campus',
  'Old campus',
  'Quiet',
  'Bad dorms',
  'Bad food',
  'Active clubs',
  'Isolating',
  'Hard bureaucracy',
  'Good career support',
  'Unsafe',
  'Diverse',
  'Hard grading',
  'Easy grading',
]

const COUNTRIES: string[] = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Angola',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahrain',
  'Bangladesh',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Korea (North)',
  'Korea (South)',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macau',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Samoa',
  'San Marino',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
]

const LANGUAGES = [
  'English',
  'Mandarin Chinese',
  'English + Mandarin',
  'English + another language',
  'Mandarin + another language',
  'French',
  'Spanish',
  'Arabic',
  'Russian',
  'Portuguese',
  'Hindi / Urdu',
  'Bengali',
  'Indonesian',
  'Thai',
  'Vietnamese',
  'Korean',
  'Japanese',
  'Turkish',
  'Persian / Farsi',
  'Hausa',
  'Swahili',
  'Other',
]

const MONTHLY_BUDGETS = ['Under ¥2k', '¥2k–¥4k', '¥4k–¥8k', '¥8k–¥15k', 'Over ¥15k']
const TUITION_RANGES = ['Under ¥20k', '¥20k–¥40k', '¥40k–¥80k', '¥80k–¥150k', 'Over ¥150k']
const LIVING_COSTS = ['Under ¥2k', '¥2k–¥4k', '¥4k–¥8k', 'Over ¥8k']
const DEGREE_LEVELS = [
  'Bachelor',
  'Master',
  'PhD',
  'Certificate',
  'Exchange',
  'Language Course',
  'Other',
]
const INSTRUCTION_LANGS = ['English', 'Chinese (Mandarin)', 'Bilingual', 'Other']
const ENROLLMENT_STATUSES = [
  { value: 'current', label: 'Current student' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'exchange', label: 'Exchange' },
  { value: 'applicant', label: 'Applicant' },
]
const FUNDING_TYPES = [
  { value: 'self', label: 'Self-funded' },
  { value: 'csc', label: 'CSC / Government' },
  { value: 'school', label: 'School' },
  { value: 'province', label: 'Provincial' },
]
const RECOMMEND_OPTIONS = [
  { value: 'yes', label: 'Yes, definitely', emoji: '👍' },
  { value: 'no', label: 'No', emoji: '👎' },
  { value: 'maybe', label: 'It depends', emoji: '🤔' },
]

// ---- Component -----------------------------------------------------------------

interface MediaState {
  media: MediaItem[]
  uploading: boolean
  errorCount: number
}

export const ReviewWizard = ({ searchParams }: { searchParams: URLSearchParams }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { openAuthModal } = useAuthModal()

  // Step state
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basics
  const [rating, setRating] = useState(0)
  const [recommend, setRecommend] = useState<string>('')
  const [selectedUni, setSelectedUni] = useState(searchParams.get('uni') || '')
  const [selectedUniName, setSelectedUniName] = useState('')
  const [showNotListed, setShowNotListed] = useState(false)
  const [newUniName, setNewUniName] = useState('')
  const [newUniCity, setNewUniCity] = useState('')

  // Step 2: Sub-scores
  const [subscores, setSubscores] = useState<Record<string, number>>({})

  // Step 3: Details
  const [enrollmentStatus, setEnrollmentStatus] = useState('current')
  const [startYear, setStartYear] = useState<number | ''>('')
  const [endYear, setEndYear] = useState<number | ''>('')
  const [languageOfInstruction, setLanguageOfInstruction] = useState('')
  const [degreeLevel, setDegreeLevel] = useState('')
  const [tuitionRange, setTuitionRange] = useState('')
  const [livingCostRange, setLivingCostRange] = useState('')
  const [fundingType, setFundingType] = useState('self')
  const [fundingCoverage, setFundingCoverage] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showMoreTags, setShowMoreTags] = useState(false)

  // Step 4: Story
  const [pros, setPros] = useState('')
  const [cons, setCons] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [program, setProgram] = useState('')
  const [mediaState, setMediaState] = useState<MediaState>({
    media: [],
    uploading: false,
    errorCount: 0,
  })

  // Step 5: About you
  const [homeCountry, setHomeCountry] = useState('')
  const [journeyStage, setJourneyStage] = useState('')
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [languagesSpoken, setLanguagesSpoken] = useState('')
  const [emailConsent, setEmailConsent] = useState(false)

  // Submit state
  const [loading, setLoading] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  const [pendingSuccess, setPendingSuccess] = useState<(() => void) | null>(null)

  // Turnstile (anonymous)
  // The Turnstile widget ref exposes getResponsePromise and reset.
  const reviewTurnstileRef = useRef<{
    getResponsePromise: (timeout?: number, interval?: number) => Promise<string>
    reset: () => void
  } | null>(null)
  const [reviewTurnstileReady, setReviewTurnstileReady] = useState(false)

  // Pre-fill university from ?uni=<slug>
  const uniSlug = searchParams.get('uni')
  const { university: prefilledUni } = useUniversity(uniSlug || undefined)

  // Sync resolved university into form state once
  useEffect(() => {
    if (prefilledUni) {
      setSelectedUni(prefilledUni.slug || '')
      setSelectedUniName(prefilledUni.name || '')
    }
  }, [prefilledUni])

  // ---- Handlers ----

  const handleUniversityChange = (value: string) => {
    setSelectedUniName(value)
    setSelectedUni('')
    setShowNotListed(false)
  }

  const handleUniversitySelect = (
    option: { data?: { name?: string; slug?: string }; value?: string; key?: string } | null
  ) => {
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const setSubscore = (key: string, value: number) => {
    setSubscores((prev) => ({ ...prev, [key]: value }))
  }

  const clearError = useCallback(() => setError(null), [])

  // ---- Validation ----

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 1: {
        if (!selectedUni)
          return "Which university? Other students can't find your review without it."
        if (showNotListed && (!newUniName.trim() || !newUniCity.trim()))
          return 'Please enter the university name and city.'
        if (!rating) return "Pick a star rating. It's the first thing every student looks at."
        if (!recommend) return 'Would you recommend this university? It helps everyone.'
        return null
      }
      case 3: {
        if (!startYear)
          return 'When did you start? Future students need to know if your experience is still relevant.'
        if (endYear && endYear < startYear)
          return "Your end year can't be before your start year — double-check your dates."
        return null
      }
      case 4: {
        if (reviewText.trim().length < 10)
          return 'Your story matters. Write at least a sentence so others know what to expect.'
        if (!program.trim())
          return "What's your program? Students searching for your major won't find this review without it."
        if (mediaState.uploading) return 'Please wait for your media to finish uploading.'
        if (mediaState.errorCount > 0) return 'Please retry or remove failed media attachments.'
        return null
      }
      default:
        return null
    }
  }

  const goNext = () => {
    const err = validateStep(step)
    if (err) {
      setError(err)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    clearError()
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    clearError()
    setStep((s) => Math.max(s - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---- Submit ----

  const handleStampComplete = () => {
    setShowStamp(false)
    if (pendingSuccess) {
      pendingSuccess()
      setPendingSuccess(null)
    }
  }

  const handleSubmit = async () => {
    const err = validateStep(4)
    if (err) {
      setError(err)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Also validate step 5 has no issues (all optional, so just proceed)
    clearError()
    setLoading(true)

    try {
      let cfToken: string | undefined
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
        subscores: subscores as SubScores,
        enrollmentStatus: enrollmentStatus || undefined,
        startYear: startYear || undefined,
        endYear: endYear || undefined,
        languageOfInstruction: languageOfInstruction || undefined,
        tuitionRange: tuitionRange || undefined,
        livingCostRange: livingCostRange || undefined,
        fundingType: fundingType || undefined,
        fundingCoverage: fundingType !== 'self' ? fundingCoverage || undefined : undefined,
        recommend: recommend || undefined,
        pros: pros.trim() || undefined,
        cons: cons.trim() || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
      })

      // Update profile fields for logged-in users (step 5 data). The review
      // is already saved at this point — a profile failure must not surface
      // as a submit error, or the user may resubmit and create a duplicate.
      if (user && (homeCountry || journeyStage || monthlyBudget || languagesSpoken)) {
        try {
          const { supabase } = await import('../lib/supabaseClient')
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              home_country: homeCountry || null,
              journey_stage: journeyStage || null,
              monthly_budget: monthlyBudget || null,
              languages_spoken: languagesSpoken || null,
              email_consent: emailConsent,
            })
            .eq('id', user.id)
          if (profileError)
            console.error('Profile update failed after review submit:', profileError)
        } catch (profileErr) {
          console.error('Profile update failed after review submit:', profileErr)
        }
      }

      showToast('Review submitted! Thank you.', 'success')

      const redirectSlug = result.universityCreated ? null : result.universitySlug

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

  // ---- Year options ----
  const currentYear = new Date().getFullYear()
  const yearOptions: number[] = []
  for (let y = currentYear + 1; y >= 1990; y--) yearOptions.push(y)

  // ---- Render ----

  const stepLabels = ['Basics', 'Ratings', 'Details', 'Your story', 'About you']

  return (
    <div className="container" style={{ maxWidth: '700px' }}>
      <div className="section">
        <Link to="/" className="btn btn-outline" style={{ marginBottom: 'var(--sp-2)' }}>
          <Icons.ArrowLeft /> Back
        </Link>
        <h1 className="section-title">Leave a Review</h1>

        {/* Progress bar */}
        <div className="wizard-progress">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`progress-step ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}
            />
          ))}
        </div>
        <div className="step-labels">
          {stepLabels.map((label, i) => (
            <span key={label} className={`step-label ${i + 1 === step ? 'current' : ''}`}>
              {label}
            </span>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="error-banner show">
            <span className="eb-icon">⚠</span>
            <span className="eb-msg">{error}</span>
          </div>
        )}

        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="wizard-step active">
            <div className="step-tagline">The essentials. What every student needs to know.</div>

            <div className="form-group">
              <label className="form-label" htmlFor="uni-select">
                University <span className="req-dot">*</span>
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

            <div className="form-group">
              <label className="form-label">
                Your overall rating <span className="req-dot">*</span>
              </label>
              <StarInput value={rating} onChange={setRating} />
            </div>

            <div className="form-group">
              <label className="form-label">
                Would you recommend this university to a friend? <span className="req-dot">*</span>
              </label>
              <div className="recommend-row">
                {RECOMMEND_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`recommend-btn ${recommend === opt.value ? 'selected' : ''}`}
                    onClick={() => setRecommend(opt.value)}
                  >
                    <span className="emoji">{opt.emoji}</span>
                    <span className="lbl">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
                ← Back
              </button>
              <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Sub-scores */}
        {step === 2 && (
          <div className="wizard-step active">
            <h2 className="step-title">Rate the details</h2>
            <p className="step-sub">How does this university do on each aspect?</p>

            <div className="subscore-grid">
              {SUBSCORE_FIELDS.map((field) => (
                <div className="subscore" key={field.key}>
                  <div className="subscore-head">
                    <span className="subscore-name">{field.label}</span>
                    <span className="subscore-val">
                      {subscores[field.key] ? `${subscores[field.key]}/5` : 'not rated'}
                    </span>
                  </div>
                  <StarInput
                    value={subscores[field.key] || 0}
                    onChange={(v: number) => setSubscore(field.key, v)}
                  />
                </div>
              ))}
            </div>

            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back
              </button>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    clearError()
                    setStep(3)
                  }}
                >
                  Skip
                </button>
                <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="wizard-step active">
            <h2 className="step-title">Some context</h2>
            <p className="step-sub">This helps other students compare.</p>

            <div className="field-card">
              <div className="field-card-title">Your status</div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Enrollment status</label>
                <div className="segmented">
                  {ENROLLMENT_STATUSES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`seg ${enrollmentStatus === opt.value ? 'selected' : ''}`}
                      onClick={() => setEnrollmentStatus(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                <label className="form-label" htmlFor="start-year">
                  Start year <span className="req-dot">*</span>
                </label>
                <select
                  id="start-year"
                  className="form-select"
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select...</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                <label className="form-label" htmlFor="end-year">
                  End year <span className="form-hint-inline">if alumni</span>
                </label>
                <select
                  id="end-year"
                  className="form-select"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Still studying</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                <label className="form-label" htmlFor="instruction-lang">
                  Language of instruction
                </label>
                <select
                  id="instruction-lang"
                  className="form-select"
                  value={languageOfInstruction}
                  onChange={(e) => setLanguageOfInstruction(e.target.value)}
                >
                  <option value="">Select...</option>
                  {INSTRUCTION_LANGS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
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
                  {DEGREE_LEVELS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-card">
              <div className="field-card-title">💰 Cost (per year)</div>
              <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                  <label className="form-label" htmlFor="tuition">
                    Tuition you paid
                  </label>
                  <select
                    id="tuition"
                    className="form-select"
                    value={tuitionRange}
                    onChange={(e) => setTuitionRange(e.target.value)}
                  >
                    <option value="">Prefer not to say</option>
                    {TUITION_RANGES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
                  <label className="form-label" htmlFor="living-cost">
                    Monthly living cost
                  </label>
                  <select
                    id="living-cost"
                    className="form-select"
                    value={livingCostRange}
                    onChange={(e) => setLivingCostRange(e.target.value)}
                  >
                    <option value="">Prefer not to say</option>
                    {LIVING_COSTS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Funding</label>
                <div className="segmented">
                  {FUNDING_TYPES.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`seg ${fundingType === opt.value ? 'selected' : ''}`}
                      onClick={() => {
                        setFundingType(opt.value)
                        if (opt.value === 'self') setFundingCoverage('')
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {fundingType !== 'self' && (
                  <div style={{ marginTop: '.6rem' }}>
                    <label className="form-label" style={{ marginBottom: '.3rem' }}>
                      Coverage
                    </label>
                    <div className="segmented">
                      <button
                        type="button"
                        className={`seg ${fundingCoverage === 'partial' ? 'selected' : ''}`}
                        onClick={() => setFundingCoverage('partial')}
                      >
                        Partial
                      </button>
                      <button
                        type="button"
                        className={`seg ${fundingCoverage === 'full' ? 'selected' : ''}`}
                        onClick={() => setFundingCoverage('full')}
                      >
                        Full
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Tags <span className="form-hint-inline">pick any</span>
              </label>
              <div className="chip-row">
                {POPULAR_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip ${selectedTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {showMoreTags && (
                <div className="chip-row" style={{ marginTop: '.5rem' }}>
                  {MORE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`chip ${selectedTags.includes(tag) ? 'selected' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '.3rem 0', fontSize: '.8rem' }}
                onClick={() => setShowMoreTags(!showMoreTags)}
              >
                {showMoreTags ? '← Fewer tags' : 'More tags →'}
              </button>
            </div>

            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back
              </button>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    clearError()
                    setStep(4)
                  }}
                >
                  Skip
                </button>
                <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Story */}
        {step === 4 && (
          <div className="wizard-step active">
            <h2 className="step-title">Tell your story</h2>
            <p className="step-sub">The pros, the cons, and anything else worth knowing.</p>

            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="pros">
                  What did you love? <span className="form-hint-inline">pros</span>
                </label>
                <textarea
                  id="pros"
                  className="form-textarea"
                  placeholder="e.g. Great professors, beautiful campus, cheap canteen..."
                  value={pros}
                  onChange={(e) => setPros(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="cons">
                  What could be better? <span className="form-hint-inline">cons</span>
                </label>
                <textarea
                  id="cons"
                  className="form-textarea"
                  placeholder="e.g. Bureaucratic admin, crowded dorms, hard language barrier..."
                  value={cons}
                  onChange={(e) => setCons(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="review-text">
                Your review <span className="req-dot">*</span>
              </label>
              <textarea
                id="review-text"
                className="form-textarea"
                placeholder="Tell other students about your experience. Academics, campus life, dormitories, the city, anything that matters..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
              <span className="form-hint">Min 10 characters. Be honest and specific.</span>
            </div>

            <div className="form-group">
              <label className="form-label">
                Show the real life <span className="form-hint-inline">up to 5</span>
              </label>
              <MediaUploader onStateChange={setMediaState} disabled={loading} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="program">
                Program <span className="req-dot">*</span>
              </label>
              <ProgramAutocomplete
                id="program"
                placeholder="e.g. Computer Science"
                value={program}
                onChange={setProgram}
              />
              <span className="form-hint">Your major / program name.</span>
            </div>

            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back
              </button>
              <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: About you */}
        {step === 5 && (
          <div className="wizard-step active">
            <h2 className="step-title">A bit about you</h2>
            <p className="step-sub">So other students like you can find your review.</p>

            <div className="info-callout">
              <span className="ic">🌍</span>
              <span>
                We ask everyone the same questions, whether you&apos;re logged in or not. Your home
                country helps students from the same place find relevant reviews and flights.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="home-country">
                  Home country
                </label>
                <select
                  id="home-country"
                  className="form-select"
                  value={homeCountry}
                  onChange={(e) => setHomeCountry(e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="journey-stage">
                  Where are you in your journey?
                </label>
                <select
                  id="journey-stage"
                  className="form-select"
                  value={journeyStage}
                  onChange={(e) => setJourneyStage(e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  <option value="researching">Researching options</option>
                  <option value="applying">Applying now</option>
                  <option value="admitted">Admitted</option>
                  <option value="enrolled">Currently studying</option>
                  <option value="alumni">Alumni</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="monthly-budget">
                  Monthly living budget
                </label>
                <select
                  id="monthly-budget"
                  className="form-select"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  {MONTHLY_BUDGETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="languages">
                  Languages you speak
                </label>
                <select
                  id="languages"
                  className="form-select"
                  value={languagesSpoken}
                  onChange={(e) => setLanguagesSpoken(e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Want early access & updates?</label>
              <div className="segmented">
                <button
                  type="button"
                  className={`seg ${!emailConsent ? 'selected' : ''}`}
                  onClick={() => setEmailConsent(false)}
                >
                  No thanks
                </button>
                <button
                  type="button"
                  className={`seg ${emailConsent ? 'selected' : ''}`}
                  onClick={() => setEmailConsent(true)}
                >
                  Yes, sign me up
                </button>
              </div>
              <span className="form-hint">
                Get the newsletter. Scholarships, new features, and early access before everyone
                else.
              </span>
            </div>

            {/* Anonymous Turnstile */}
            {!user && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Turnstile
                  ref={reviewTurnstileRef}
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
                  onWidgetLoad={() => setReviewTurnstileReady(true)}
                  onError={(error) => {
                    console.error('[Turnstile] review widget error:', error)
                    showToast(
                      'Verification challenge error. Please refresh and try again.',
                      'error'
                    )
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

            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={loading || mediaState.uploading || (!user && !reviewTurnstileReady)}
                onClick={handleSubmit}
              >
                {loading
                  ? 'Submitting...'
                  : mediaState.uploading
                    ? 'Processing media...'
                    : !user && !reviewTurnstileReady
                      ? 'Verifying you are human...'
                      : 'Submit review 📜'}
              </button>
            </div>
          </div>
        )}
      </div>

      <RegistrationNudge />

      {showStamp && <SealStampOverlay onComplete={handleStampComplete} />}
    </div>
  )
}
