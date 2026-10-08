import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import {
  submitReview,
  ReviewSubmitError,
  type MediaItem,
  type SubScores,
} from '../lib/reviewSubmit'
import {
  classifyReviewSubmitFailure,
  publishDurationBand,
  resolveReviewEntry,
  trackReviewEvent,
  type ReviewAuth,
  type ReviewEntry,
  type ReviewEventName,
  type ReviewStage,
  type ReviewStep,
} from '../lib/analytics'
import { getOrCreateClaimToken } from '../lib/reviewClaim'
import { updateReview } from '../lib/reviewManage'
import { reviewToWizardState, type EditableReview } from '../lib/reviewEdit'
import { ConfirmDialog } from './ConfirmDialog'
import { supabase } from '../lib/supabaseClient'
import {
  saveReviewDraft,
  getReviewDraft,
  deleteReviewDraft,
  deleteReviewDraftForUniversity,
  loadLocalDraft,
  saveLocalDraft,
  clearLocalDraft,
  isDraftWorthSaving,
  type ReviewDraftPayload,
} from '../lib/reviewDrafts'
import type { TablesUpdate } from '../types/database.types'
import {
  COUNTRIES,
  LANGUAGES,
  CURRENT_STATUSES,
  TUITION_RANGES,
  LIVING_COSTS,
  canonicalCountryName,
} from '../lib/constants'
import { ENROLLMENT_OPTIONS, FUNDING_OPTIONS } from '../lib/reviewDisplay'
import { useUniversity } from '../hooks/useUniversity'
import { useProfileContext } from '../contexts/ProfileContext'
import { StarInput } from './StarInput'
import { Icons } from './Icons'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useAuthModal } from '../contexts/AuthModalContext'
import { ProfileSavePrompt, type ProfileSaveItem } from './ProfileSavePrompt'
import { RegistrationNudge } from './RegistrationNudge'
import { ProgramAutocomplete } from './ProgramAutocomplete'
import { UniversityAutocomplete } from './UniversityAutocomplete'
import { ProvinceCityPicker } from './ProvinceCityPicker'
import { formatLocation } from '../lib/chinaDivisions'
import { MediaUploader } from './MediaUploader'
import { SealStampOverlay } from './SealStampOverlay'

// ---- Constants ----------------------------------------------------------------

const TOTAL_STEPS = 5

const REVIEW_STEP_EVENTS: Record<ReviewStep, ReviewEventName> = {
  1: 'review_step_1_viewed',
  2: 'review_step_2_viewed',
  3: 'review_step_3_viewed',
  4: 'review_step_4_viewed',
  5: 'review_step_5_viewed',
}

const REVIEW_STEP_STAGES: Record<ReviewStep, ReviewStage> = {
  1: 'basics',
  2: 'ratings',
  3: 'details',
  4: 'story',
  5: 'about_you',
}

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
const RECOMMEND_OPTIONS = [
  { value: 'yes', label: 'Yes, definitely', emoji: '👍' },
  { value: 'no', label: 'No', emoji: '👎' },
  { value: 'maybe', label: 'It depends', emoji: '🤔' },
]

// What the save prompt shows the user: friendly labels for the raw
// profiles column names and values about to be written.
const promptItems = (updates: Record<string, unknown>): ProfileSaveItem[] => {
  const items: ProfileSaveItem[] = []
  if (updates.home_country)
    items.push({ label: 'Home country', value: String(updates.home_country) })
  if (updates.current_status) {
    const label =
      CURRENT_STATUSES.find((s) => s.value === updates.current_status)?.label ??
      String(updates.current_status)
    items.push({ label: 'Right now', value: label })
  }
  if (Array.isArray(updates.languages_spoken) && updates.languages_spoken.length > 0) {
    items.push({ label: 'Languages', value: updates.languages_spoken.join(', ') })
  }
  if (updates.email_consent === true) items.push({ label: 'Early access', value: 'Yes' })
  return items
}

// ---- Component -----------------------------------------------------------------

interface MediaState {
  media: MediaItem[]
  uploading: boolean
  errorCount: number
}

export const ReviewWizard = ({
  searchParams,
  editReview,
  onDone,
}: {
  searchParams: URLSearchParams
  // Edit mode: mount with the stored row and the wizard edits it in place.
  // onDone(changed) fires on cancel (false) and after a saved update (true).
  editReview?: EditableReview
  onDone?: (changed: boolean) => void
}) => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { profile, refetch: refetchProfile } = useProfileContext()
  const { showToast } = useToast()
  const { openAuthModal } = useAuthModal()

  const editMode = !!editReview
  // Stored values mapped once at mount — the wizard is only opened for edit
  // with the row already in hand, so lazy initializers are safe.
  const [initial] = useState(() => (editReview ? reviewToWizardState(editReview) : null))

  // Resume a saved draft: ?draft=<id> for signed-in users, or the anonymous
  // localStorage fallback for everyone else.
  const draftParam = searchParams.get('draft')
  const uniParam = searchParams.get('uni')
  const [draftId, setDraftId] = useState<string | null>(draftParam)
  const [draftLoading, setDraftLoading] = useState(!editMode)
  const [draftMedia, setDraftMedia] = useState<MediaItem[]>([])
  const [draftUniversityId, setDraftUniversityId] = useState<string | null>(null)

  // Step state
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [reviewEntry, setReviewEntry] = useState<ReviewEntry>('unknown')

  // Step 1: Basics
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [recommend, setRecommend] = useState<string>(initial?.recommend ?? '')
  const [selectedUni, setSelectedUni] = useState(searchParams.get('uni') || '')
  const [selectedUniName, setSelectedUniName] = useState('')
  const [showNotListed, setShowNotListed] = useState(false)
  const [newUniName, setNewUniName] = useState('')
  const [newUniProvince, setNewUniProvince] = useState('')
  const [newUniCity, setNewUniCity] = useState('')

  // Step 2: Sub-scores
  const [subscores, setSubscores] = useState<Record<string, number>>(initial?.subscores ?? {})

  // Step 3: Details — no preselected values: a skipped field must stay NULL,
  // not write a fabricated "current student" / "self-funded" onto the review.
  const [enrollmentStatus, setEnrollmentStatus] = useState(initial?.enrollmentStatus ?? '')
  const [startYear, setStartYear] = useState<number | ''>(initial?.startYear ?? '')
  const [endYear, setEndYear] = useState<number | ''>(initial?.endYear ?? '')
  const [languageOfInstruction, setLanguageOfInstruction] = useState(
    initial?.languageOfInstruction ?? ''
  )
  const [degreeLevel, setDegreeLevel] = useState(initial?.degreeLevel ?? '')
  const [tuitionRange, setTuitionRange] = useState(initial?.tuitionRange ?? '')
  const [livingCostRange, setLivingCostRange] = useState(initial?.livingCostRange ?? '')
  const [fundingType, setFundingType] = useState(initial?.fundingType ?? '')
  const [fundingCoverage, setFundingCoverage] = useState(initial?.fundingCoverage ?? '')
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags ?? [])
  const [showMoreTags, setShowMoreTags] = useState(false)

  // Step 4: Story
  const [pros, setPros] = useState(initial?.pros ?? '')
  const [cons, setCons] = useState(initial?.cons ?? '')
  const [reviewText, setReviewText] = useState(initial?.reviewText ?? '')
  const [program, setProgram] = useState(initial?.program ?? '')
  const [mediaState, setMediaState] = useState<MediaState>({
    media: initial?.media ?? [],
    uploading: false,
    errorCount: 0,
  })

  // Update-confirm dialog (edit mode only)
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false)

  // Step 5: About you
  const [homeCountry, setHomeCountry] = useState('')
  const [currentStatus, setCurrentStatus] = useState('')
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([])
  const [emailConsent, setEmailConsent] = useState(false)
  const [anonEmail, setAnonEmail] = useState('')

  // Submit state
  const [loading, setLoading] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  const [pendingSuccess, setPendingSuccess] = useState<(() => void) | null>(null)

  // Post-submit profile prompt (logged-in users only)
  const [showProfilePrompt, setShowProfilePrompt] = useState(false)
  const [profileUpdates, setProfileUpdates] = useState<TablesUpdate<'profiles'> | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Turnstile (anonymous)
  // The Turnstile widget ref exposes getResponsePromise and reset.
  const reviewTurnstileRef = useRef<TurnstileInstance | undefined>(undefined)
  const [reviewTurnstileReady, setReviewTurnstileReady] = useState(false)

  // ---- Draft persistence -----------------------------------------------------
  // One serializable snapshot of the whole form. Autosave and manual load
  // read/write this shape; the DB row stores it in `review_drafts.payload`.

  const draftPayload = useMemo<ReviewDraftPayload>(
    () => ({
      step,
      selectedUni,
      selectedUniName,
      showNotListed,
      newUniName,
      newUniProvince,
      newUniCity,
      rating,
      recommend,
      program,
      subscores,
      enrollmentStatus,
      startYear,
      endYear,
      languageOfInstruction,
      degreeLevel,
      tuitionRange,
      livingCostRange,
      fundingType,
      fundingCoverage,
      selectedTags,
      pros,
      cons,
      reviewText,
      media: mediaState.media,
      homeCountry,
      currentStatus,
      languagesSpoken,
      emailConsent,
      anonEmail,
    }),
    [
      step,
      selectedUni,
      selectedUniName,
      showNotListed,
      newUniName,
      newUniProvince,
      newUniCity,
      rating,
      recommend,
      program,
      subscores,
      enrollmentStatus,
      startYear,
      endYear,
      languageOfInstruction,
      degreeLevel,
      tuitionRange,
      livingCostRange,
      fundingType,
      fundingCoverage,
      selectedTags,
      pros,
      cons,
      reviewText,
      mediaState.media,
      homeCountry,
      currentStatus,
      languagesSpoken,
      emailConsent,
      anonEmail,
    ]
  )

  const draftIdRef = useRef<string | null>(draftParam)
  const lastSavedPayloadRef = useRef<ReviewDraftPayload | null>(null)
  const draftPayloadRef = useRef<ReviewDraftPayload>(draftPayload)
  const reviewStartedRef = useRef(false)
  const attemptStartedAtRef = useRef<number | null>(null)
  const viewedStepsRef = useRef(new Set<number>())
  const storyViewedRef = useRef(false)
  const reportedValidationStepsRef = useRef(new Set<number>())
  const submitInFlightRef = useRef(false)

  useEffect(() => {
    draftIdRef.current = draftId
  }, [draftId])

  useEffect(() => {
    draftPayloadRef.current = draftPayload
  }, [draftPayload])

  const applyDraftPayload = useCallback((p: ReviewDraftPayload) => {
    setStep(p.step && p.step >= 1 ? Math.min(p.step, TOTAL_STEPS) : 1)
    setRating(p.rating ?? 0)
    setRecommend(p.recommend ?? '')
    setSelectedUni(p.selectedUni ?? '')
    setSelectedUniName(p.selectedUniName ?? '')
    setShowNotListed(p.showNotListed ?? false)
    setNewUniName(p.newUniName ?? '')
    setNewUniProvince(p.newUniProvince ?? '')
    setNewUniCity(p.newUniCity ?? '')
    setProgram(p.program ?? '')
    setSubscores((p.subscores ?? {}) as Record<string, number>)
    setEnrollmentStatus(p.enrollmentStatus ?? '')
    setStartYear(p.startYear ?? '')
    setEndYear(p.endYear ?? '')
    setLanguageOfInstruction(p.languageOfInstruction ?? '')
    setDegreeLevel(p.degreeLevel ?? '')
    setTuitionRange(p.tuitionRange ?? '')
    setLivingCostRange(p.livingCostRange ?? '')
    setFundingType(p.fundingType ?? '')
    setFundingCoverage(p.fundingCoverage ?? '')
    setSelectedTags(p.selectedTags ?? [])
    setPros(p.pros ?? '')
    setCons(p.cons ?? '')
    setReviewText(p.reviewText ?? '')
    setDraftMedia(p.media ?? [])
    setMediaState({ media: p.media ?? [], uploading: false, errorCount: 0 })
    setHomeCountry(p.homeCountry ?? '')
    setCurrentStatus(p.currentStatus ?? '')
    setLanguagesSpoken(p.languagesSpoken ?? [])
    setEmailConsent(p.emailConsent ?? false)
    setAnonEmail(p.anonEmail ?? '')
    lastSavedPayloadRef.current = p
  }, [])

  // Load the draft once auth is ready. Signed-in users pull by ?draft=<id>, or
  // by ?uni=<slug> when a draft already exists for that university (so the
  // wizard resumes instead of overwriting it on the first autosave). Anonymous
  // visitors fall back to the localStorage draft when the slug matches.
  useEffect(() => {
    if (editMode || authLoading) return

    const controller = new AbortController()
    const run = async () => {
      let loaded = false
      let lookupFailed = false
      try {
        if (user && draftParam) {
          const d = await getReviewDraft(draftParam, user.id)
          if (controller.signal.aborted) return
          if (d) {
            const payload = d.payload as unknown as ReviewDraftPayload
            applyDraftPayload(payload)
            setDraftUniversityId(d.university_id)
            loaded = true
          } else {
            lookupFailed = true
            showToast('That draft could not be found.', 'error')
          }
        } else if (user && uniParam) {
          // A draft for this slug may already exist — resume it so autosave
          // updates the saved row instead of clobbering it with a fresh one.
          const { data: uni, error: uniError } = await supabase
            .from('universities')
            .select('id')
            .eq('slug', uniParam)
            .abortSignal(controller.signal)
            .maybeSingle()
          if (uniError) throw uniError
          if (uni?.id) {
            const { data: d, error: draftError } = await supabase
              .from('review_drafts')
              .select('id, payload, university_id')
              .eq('user_id', user.id)
              .eq('university_id', uni.id)
              .abortSignal(controller.signal)
              .maybeSingle()
            if (draftError) throw draftError
            if (d) {
              setDraftId(d.id)
              const payload = d.payload as unknown as ReviewDraftPayload
              applyDraftPayload(payload)
              setDraftUniversityId(d.university_id)
              loaded = true
            }
          }
        } else if (!user) {
          const local = loadLocalDraft()
          if (local && isDraftWorthSaving(local)) {
            const sameUni = !uniParam || local.selectedUni === uniParam
            if (sameUni) {
              applyDraftPayload(local)
              loaded = true
            }
          }
        }

        // Anonymous progress survives login: if the visitor just signed in and
        // no server draft was loaded, pick up the localStorage draft and let
        // autosave promote it to their account.
        if (user && !draftParam && !loaded && !controller.signal.aborted) {
          const local = loadLocalDraft()
          if (local && isDraftWorthSaving(local)) {
            const sameUni = !uniParam || local.selectedUni === uniParam
            if (sameUni) {
              applyDraftPayload(local)
              clearLocalDraft()
              loaded = true
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        lookupFailed = true
        console.error('Error loading draft:', err)
      } finally {
        if (!controller.signal.aborted) {
          setReviewEntry(
            resolveReviewEntry({ loaded, requested: Boolean(draftParam), lookupFailed })
          )
          setDraftLoading(false)
        }
      }
    }

    run()
    return () => controller.abort()
  }, [editMode, authLoading, user, draftParam, uniParam, applyDraftPayload, showToast])

  const reviewAuth: ReviewAuth = user ? 'signed_in' : 'anonymous'

  const beginReviewAttempt = useCallback(() => {
    if (reviewStartedRef.current) return
    reviewStartedRef.current = true
    attemptStartedAtRef.current = Date.now()
    void trackReviewEvent({
      name: 'review_started',
      data: { flow: 'legacy_5', entry: reviewEntry, auth: reviewAuth },
    })
  }, [reviewEntry, reviewAuth])

  useEffect(() => {
    if (editMode || authLoading || draftLoading) return
    beginReviewAttempt()
    const currentStep = step as ReviewStep
    if (!viewedStepsRef.current.has(currentStep)) {
      viewedStepsRef.current.add(currentStep)
      void trackReviewEvent({
        name: REVIEW_STEP_EVENTS[currentStep],
        data: {
          flow: 'legacy_5',
          entry: reviewEntry,
          auth: reviewAuth,
          step: currentStep,
          stage: REVIEW_STEP_STAGES[currentStep],
        },
      })
    }
    if (currentStep === 4 && !storyViewedRef.current) {
      storyViewedRef.current = true
      void trackReviewEvent({
        name: 'review_story_viewed',
        data: { flow: 'legacy_5', entry: reviewEntry, auth: reviewAuth },
      })
    }
  }, [authLoading, beginReviewAttempt, draftLoading, editMode, reviewAuth, reviewEntry, step])

  // Resolve the current university slug to an id for the draft row. Optional —
  // drafts for "not listed" universities stay linked by payload only.
  useEffect(() => {
    if (editMode || !selectedUni || selectedUni === '__not_listed') {
      setDraftUniversityId(null)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      const { data } = await supabase
        .from('universities')
        .select('id')
        .eq('slug', selectedUni)
        .abortSignal(controller.signal)
        .maybeSingle()
      if (!controller.signal.aborted) setDraftUniversityId(data?.id ?? null)
    }
    run()
    return () => controller.abort()
  }, [editMode, selectedUni])

  // Autosave once something worth keeping exists. Debounced so typing doesn't
  // create a write per keystroke.
  useEffect(() => {
    if (editMode || draftLoading) return
    if (!isDraftWorthSaving(draftPayload)) return
    if (JSON.stringify(draftPayload) === JSON.stringify(lastSavedPayloadRef.current)) return

    const timer = setTimeout(async () => {
      try {
        if (user) {
          const savedId = await saveReviewDraft({
            userId: user.id,
            draftId: draftIdRef.current,
            universityId: draftUniversityId,
            payload: draftPayload,
            progress: draftPayload.step,
          })
          setDraftId(savedId)
          lastSavedPayloadRef.current = draftPayload
        } else {
          saveLocalDraft(draftPayload)
          lastSavedPayloadRef.current = draftPayload
        }
      } catch (err) {
        console.error('Draft save failed:', err)
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [user, editMode, draftLoading, draftPayload, draftUniversityId])

  // Warn before closing the tab when there is unsaved progress. The autosave
  // runs every 1.5s, so this only guards the narrow window after a change.
  useEffect(() => {
    if (editMode || draftLoading) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const current = draftPayloadRef.current
      if (!isDraftWorthSaving(current)) return
      if (JSON.stringify(current) === JSON.stringify(lastSavedPayloadRef.current)) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [editMode, draftLoading])

  // Pre-fill university from ?uni=<slug>
  const uniSlug = uniParam
  const { university: prefilledUni } = useUniversity(uniSlug || undefined)

  // Sync resolved university into form state once. Drafts already carry their
  // own university — don't let the ?uni prefill overwrite a loaded draft.
  useEffect(() => {
    if (prefilledUni && !editMode && !draftParam) {
      setSelectedUni(prefilledUni.slug || '')
      setSelectedUniName(prefilledUni.name || '')
    }
  }, [prefilledUni, editMode, draftParam])

  // Pre-fill from the user's profile once it loads. Functional setState only
  // fills fields that are still empty, so a user who typed before the profile
  // arrived never loses input. Also prevents the save-prompt from offering to
  // write back values the profile already has.
  // Skipped in edit mode: the review row is the source of truth — a field the
  // original review left empty must stay empty, not inherit profile values.
  useEffect(() => {
    if (!profile || editMode) return
    setProgram((v) => v || profile.program || '')
    setSelectedUniName((v) => v || profile.university || '')
    setHomeCountry((v) => v || profile.home_country || '')
    setCurrentStatus((v) => v || profile.current_status || '')
    setLanguagesSpoken((v) => (v.length > 0 ? v : (profile.languages_spoken ?? [])))
    setEmailConsent((v) => v || profile.email_consent === true)
  }, [profile, editMode])

  // ---- Handlers ----

  const handleUniversityChange = (value: string) => {
    setSelectedUniName(value)
    setSelectedUni('')
    setShowNotListed(false)
  }

  const handleUniversitySelect = (
    option: { data?: { name?: string; slug?: string }; value?: string; key?: string } | null
  ) => {
    const data = option?.data
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

  const reportValidationFailure = useCallback(
    (s: number) => {
      const failedStep = s as ReviewStep
      if (reportedValidationStepsRef.current.has(failedStep)) return
      reportedValidationStepsRef.current.add(failedStep)
      void trackReviewEvent({
        name: 'review_validation_failed',
        data: {
          flow: 'legacy_5',
          auth: reviewAuth,
          step: failedStep,
          stage: REVIEW_STEP_STAGES[failedStep],
        },
      })
    },
    [reviewAuth]
  )

  // ---- Validation ----

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 1: {
        // A slug is ideal, but a typed name also works — the edge function
        // resolves it (ilike) the same way the old form did. In edit mode the
        // university is fixed — it never needs re-validating.
        if (!editMode && !selectedUni && !selectedUniName.trim())
          return "Which university? Other students can't find your review without it."
        if (showNotListed && (!newUniName.trim() || !newUniCity.trim()))
          return 'Please enter the university name and city.'
        if (!program.trim())
          return "What's your program? Students searching for your major won't find this review without it."
        if (!rating) return "Pick a star rating. It's the first thing every student looks at."
        if (!recommend) return 'Would you recommend this university? It helps everyone.'
        return null
      }
      case 3: {
        if (!startYear)
          return 'Just your start year — everything else here is optional, takes 2 seconds. Future students need to know if your experience is still relevant.'
        if (endYear && endYear < startYear)
          return "Your end year can't be before your start year — double-check your dates."
        return null
      }
      case 4: {
        if (reviewText.trim().length < 10)
          return 'Your story matters. Write at least a sentence so others know what to expect.'
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
      reportValidationFailure(step)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    clearError()
    setStep((s) => Math.min(s + 1, totalSteps))
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
    // Logged-in users who gave us new "about you" answers get the opt-in
    // prompt before navigating; everyone else goes straight on.
    if (profileUpdates && Object.keys(profileUpdates).length > 0) {
      setShowProfilePrompt(true)
      return
    }
    if (pendingSuccess) {
      pendingSuccess()
      setPendingSuccess(null)
    }
  }

  const finishAfterPrompt = () => {
    if (pendingSuccess) {
      pendingSuccess()
      setPendingSuccess(null)
    }
  }

  const handleProfileSave = async () => {
    if (!user || !profileUpdates) return
    setSavingProfile(true)
    try {
      const { supabase } = await import('../lib/supabaseClient')
      const { error: saveError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', user.id)
      if (saveError) {
        console.error('Profile save after review failed:', saveError)
        showToast(
          "Couldn't save to your profile — you can update it later from your profile page.",
          'error'
        )
      } else {
        await refetchProfile()
        showToast('Done! You can always update these in your profile.', 'success')
      }
    } catch (err) {
      console.error('Profile save after review failed:', err)
      showToast(
        "Couldn't save to your profile — you can update it later from your profile page.",
        'error'
      )
    } finally {
      setSavingProfile(false)
      setShowProfilePrompt(false)
      finishAfterPrompt()
    }
  }

  const handleProfileSkip = () => {
    setShowProfilePrompt(false)
    finishAfterPrompt()
  }

  const handleSubmit = async () => {
    if (submitInFlightRef.current) return
    beginReviewAttempt()
    const err = validateStep(4)
    if (err) {
      setError(err)
      reportValidationFailure(4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Also validate step 5 has no issues (all optional, so just proceed)
    clearError()
    setLoading(true)
    submitInFlightRef.current = true
    void trackReviewEvent({
      name: 'review_submit_attempted',
      data: { flow: 'legacy_5', entry: reviewEntry, auth: reviewAuth },
    })

    let turnstileClientFailed = false
    let submissionSucceeded = false
    try {
      let cfToken: string | undefined
      if (!user) {
        try {
          if (!reviewTurnstileRef.current) {
            throw new Error('Verification is still loading. Please wait a moment and try again.')
          }
          cfToken = await reviewTurnstileRef.current.getResponsePromise(30000, 250)
          if (!cfToken) {
            throw new Error('Verification failed. Please refresh and try again.')
          }
        } catch (turnstileError) {
          turnstileClientFailed = true
          throw turnstileError
        }
      }

      const isNotListed = selectedUni === '__not_listed'

      const result = await submitReview({
        cfToken,
        claimToken: !user ? (getOrCreateClaimToken() ?? undefined) : undefined,
        universitySlug: !isNotListed && selectedUni ? selectedUni : undefined,
        universityName:
          !isNotListed && !selectedUni && selectedUniName.trim()
            ? selectedUniName.trim()
            : undefined,
        newUniversity: isNotListed
          ? {
              name: newUniName.trim(),
              city: newUniCity.trim(),
              province: newUniProvince || undefined,
            }
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
        reviewerContext: !user
          ? {
              email: anonEmail.trim() || undefined,
              emailConsent,
              homeCountry: homeCountry || undefined,
              currentStatus: currentStatus || undefined,
              languagesSpoken: languagesSpoken.length > 0 ? languagesSpoken : undefined,
            }
          : undefined,
      })

      submissionSucceeded = true
      void trackReviewEvent({
        name: 'review_published',
        data: {
          flow: 'legacy_5',
          entry: reviewEntry,
          auth: reviewAuth,
          duration_band: publishDurationBand(attemptStartedAtRef.current),
        },
      })

      // For logged-in users, figure out which step-5 answers the profile
      // doesn't already have. Only provided-and-different values are offered
      // to the save prompt — never nulls, and email_consent can only be
      // upgraded to true here (revoking happens in profile settings).
      if (user) {
        const updates: TablesUpdate<'profiles'> = {}
        if (homeCountry && homeCountry !== (profile?.home_country ?? '')) {
          updates.home_country = canonicalCountryName(homeCountry) ?? homeCountry
        }
        if (currentStatus && currentStatus !== (profile?.current_status ?? '')) {
          updates.current_status = currentStatus
        }
        const existingLangs = [...(profile?.languages_spoken ?? [])].sort().join(',')
        if (languagesSpoken.length > 0 && [...languagesSpoken].sort().join(',') !== existingLangs) {
          updates.languages_spoken = languagesSpoken
        }
        if (emailConsent && profile?.email_consent !== true) {
          updates.email_consent = true
        }
        setProfileUpdates(Object.keys(updates).length > 0 ? updates : null)
      }

      showToast('Review submitted! Thank you.', 'success')

      // The review is live — the draft it came from is done. Server drafts are
      // deleted by id (or by university when the row was created earlier);
      // anonymous progress lives in localStorage and is cleared the same way.
      if (user) {
        try {
          if (draftIdRef.current) {
            await deleteReviewDraft(draftIdRef.current, user.id)
          } else if (draftUniversityId) {
            await deleteReviewDraftForUniversity(user.id, draftUniversityId)
          }
        } catch (err) {
          console.error('Could not delete draft after submit:', err)
        }
      } else {
        clearLocalDraft()
      }

      const redirectSlug = result.universityCreated ? null : result.universitySlug

      if (!user) {
        sessionStorage.setItem('trc_anon_review_submitted', 'true')
        sessionStorage.setItem('trc_anon_review_redirect', redirectSlug || '')
        // A fresh anonymous review may be claimable after this sign-in — let
        // the claim prompt re-check even if it already ran for this user.
        sessionStorage.removeItem('trc_claim_checked')
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
      const status = error instanceof ReviewSubmitError ? error.status : undefined
      if (!submissionSucceeded) {
        void trackReviewEvent({
          name: 'review_submit_failed',
          data: {
            flow: 'legacy_5',
            entry: reviewEntry,
            auth: reviewAuth,
            reason: turnstileClientFailed
              ? 'turnstile_client'
              : classifyReviewSubmitFailure(status, !user),
          },
        })
      }
      console.error('Error submitting review:', error)
      showToast(error instanceof Error ? error.message : 'Failed to submit review', 'error')
    } finally {
      submitInFlightRef.current = false
      setLoading(false)
    }
  }

  // ---- Update (edit mode) ----

  // Validate first — the confirm dialog (the warning) only opens once the
  // form is known-good, so an error never hides behind the modal.
  const requestUpdate = () => {
    for (const s of [1, 3, 4]) {
      const err = validateStep(s)
      if (err) {
        setError(err)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    clearError()
    setShowUpdateConfirm(true)
  }

  // Hands off to review-manage — ownership is enforced server-side.
  const handleUpdate = async () => {
    setLoading(true)
    try {
      await updateReview(editReview!.id, {
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
      showToast('Review updated.', 'success')
      onDone?.(true)
    } catch (err) {
      console.error('Error updating review:', err)
      showToast(err instanceof Error ? err.message : 'Failed to update review', 'error')
    } finally {
      setLoading(false)
      setShowUpdateConfirm(false)
    }
  }

  // ---- Year options ----
  const currentYear = new Date().getFullYear()
  const yearOptions: number[] = []
  for (let y = currentYear + 1; y >= 1990; y--) yearOptions.push(y)

  // ---- Render ----

  // Edit mode drops the anonymous-only "About you" step (reviewer context is
  // never stored for signed-in users), so the flow ends on "Your story".
  const totalSteps = editMode ? 4 : TOTAL_STEPS
  const stepLabels = editMode
    ? ['Basics', 'Ratings', 'Details', 'Your story']
    : ['Basics', 'Ratings', 'Details', 'Your story', 'About you']

  return (
    <div className="container" style={{ maxWidth: '700px' }}>
      <div className="section">
        {editMode ? (
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginBottom: 'var(--sp-2)' }}
            onClick={() => onDone?.(false)}
          >
            <Icons.ArrowLeft /> Back
          </button>
        ) : (
          <Link to="/" className="btn btn-outline" style={{ marginBottom: 'var(--sp-2)' }}>
            <Icons.ArrowLeft /> Back
          </Link>
        )}
        <h1 className="section-title">{editMode ? 'Edit your review' : 'Leave a Review'}</h1>

        {/* Progress bar */}
        <div className="wizard-progress">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
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
              {editMode ? (
                // The university a review is about never changes — only its
                // content does.
                <div className="form-input" style={{ background: 'var(--rice)' }}>
                  {initial?.universityLabel || 'University'}
                </div>
              ) : (
                <UniversityAutocomplete
                  id="uni-select"
                  value={selectedUniName}
                  placeholder="Start typing a university..."
                  onChange={handleUniversityChange}
                  onSelect={handleUniversitySelect}
                  onNotListed={handleNotListed}
                  allowNotListed={true}
                />
              )}
            </div>

            {!editMode && showNotListed && (
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
                <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
                  <label className="form-label" htmlFor="new-uni-city-province">
                    City
                  </label>
                  <ProvinceCityPicker
                    id="new-uni-city"
                    value={formatLocation(newUniProvince, newUniCity)}
                    onParts={(p) => {
                      setNewUniProvince(p.province)
                      setNewUniCity(p.city)
                    }}
                    allowOutsideChina={false}
                  />
                </div>
              </div>
            )}

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
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => (editMode ? onDone?.(false) : navigate('/'))}
              >
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
                  {ENROLLMENT_OPTIONS.map((opt) => (
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
                  {FUNDING_OPTIONS.map((opt) => (
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
                {fundingType && fundingType !== 'self' && (
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
                {/* Skip still runs validation — required fields are a must,
                    the rest of the step is what's skippable. */}
                <button type="button" className="btn btn-ghost" onClick={goNext}>
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
              {!draftLoading && (
                <MediaUploader
                  key={editMode ? `edit-${editReview!.id}` : 'wizard-media'}
                  onStateChange={setMediaState}
                  disabled={loading}
                  initialMedia={editMode ? (initial?.media ?? []) : draftMedia}
                />
              )}
            </div>

            <div className="wizard-nav">
              <button type="button" className="btn btn-ghost" onClick={goBack}>
                ← Back
              </button>
              {editMode ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  disabled={loading || mediaState.uploading}
                  onClick={requestUpdate}
                >
                  {loading ? 'Saving...' : 'Save changes'}
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
                  Continue →
                </button>
              )}
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
                {!user && ' Answers stay private — stored with your review, never shown publicly.'}
              </span>
            </div>

            {!user && (
              <div className="form-group">
                <label className="form-label" htmlFor="anon-email">
                  Email{' '}
                  <span className="form-hint-inline">optional — we never show it publicly</span>
                </label>
                <input
                  type="email"
                  id="anon-email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={anonEmail}
                  onChange={(e) => setAnonEmail(e.target.value)}
                />
                <span className="form-hint">
                  Never shown publicly. If you sign up with this email, we&apos;ll match the review
                  to your account so you can claim it.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label" htmlFor="home-country">
                  Home country
                </label>
                <select
                  id="home-country"
                  className="form-select"
                  value={canonicalCountryName(homeCountry) ?? ''}
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
                <label className="form-label" htmlFor="current-status">
                  What are you up to right now?
                </label>
                <select
                  id="current-status"
                  className="form-select"
                  value={currentStatus}
                  onChange={(e) => setCurrentStatus(e.target.value)}
                >
                  <option value="">Prefer not to say</option>
                  {CURRENT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="languages">
                Languages you speak{' '}
                <span className="form-hint-inline">add as many as you like</span>
              </label>
              <select
                id="languages"
                className="form-select"
                value=""
                onChange={(e) => {
                  const lang = e.target.value
                  if (lang && !languagesSpoken.includes(lang))
                    setLanguagesSpoken((prev) => [...prev, lang])
                }}
              >
                <option value="">Select a language...</option>
                {LANGUAGES.filter((l) => !languagesSpoken.includes(l)).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              {languagesSpoken.length > 0 && (
                <div className="chip-row" style={{ marginTop: '.5rem' }}>
                  {languagesSpoken.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className="chip selected"
                      title="Remove"
                      onClick={() => setLanguagesSpoken((prev) => prev.filter((x) => x !== l))}
                    >
                      {l} ✕
                    </button>
                  ))}
                </div>
              )}
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

      {showProfilePrompt && profileUpdates && (
        <ProfileSavePrompt
          items={promptItems(profileUpdates)}
          saving={savingProfile}
          onSave={handleProfileSave}
          onSkip={handleProfileSkip}
        />
      )}

      {showUpdateConfirm && (
        <ConfirmDialog
          title="Update your review?"
          body="Saving swaps in this version for the one that's live now. The old wording isn't kept."
          confirmLabel={loading ? 'Saving...' : 'Post update'}
          cancelLabel="Keep editing"
          busy={loading}
          onConfirm={handleUpdate}
          onCancel={() => setShowUpdateConfirm(false)}
        />
      )}
    </div>
  )
}
