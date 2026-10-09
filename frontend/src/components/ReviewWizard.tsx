import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'
import { submitReview, ReviewSubmitError } from '../lib/reviewSubmit'
import {
  classifyReviewSubmitFailure,
  publishDurationBand,
  resolveReviewEntry,
  trackReviewEvent,
  type BoostAfterCard,
  type BoostCard,
  type ReviewAuth,
  type ReviewEntry,
  type ReviewEventName,
  type ReviewStage,
} from '../lib/analytics'
import { getOrCreateClaimToken } from '../lib/reviewClaim'
import { updateReview } from '../lib/reviewManage'
import { reviewToWizardState, type EditableReview } from '../lib/reviewEdit'
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
  mapDraftStepToScreen,
  type ReviewDraftPayload,
} from '../lib/reviewDrafts'
import { buildReviewFields, draftPayloadFromState, fieldValuesFromDraft } from '../lib/reviewFlow'
import { useReviewForm } from '../hooks/useReviewForm'
import { useUniversity } from '../hooks/useUniversity'
import { useProfileContext } from '../contexts/ProfileContext'
import { Icons } from './Icons'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { RegistrationNudge } from './RegistrationNudge'
import { SealStampOverlay } from './SealStampOverlay'
import { ReviewEssentials } from './review/ReviewEssentials'
import { ReviewStory } from './review/ReviewStory'
import { PublishedReviewPreview, ReviewSuccess } from './review/ReviewSuccess'
import { BoostCards } from './review/BoostCards'
import { ReviewEditForm } from './review/ReviewEditForm'
import type { MediaState } from './review/fields'

// ---- Constants ----------------------------------------------------------------

// The fast flow's analytics tag. Phase 1 event names and meanings are
// unchanged — only `flow` distinguishes which layout produced them.
const FLOW = 'fast_2' as const

// Screen index -> the step-viewed event + stage enum it emits. Step numbers
// stay positional ("Nth screen shown") and stages stay semantic, so the
// fast-flow funnel compares cleanly against the legacy one.
const SCREEN_EVENTS: Record<number, ReviewEventName> = {
  1: 'review_step_1_viewed',
  2: 'review_step_2_viewed',
}
const SCREEN_STAGES: Record<number, ReviewStage> = {
  1: 'basics',
  2: 'story',
}
const SCREEN_LABELS = ['The essentials', 'Your story']

type Phase = 'form' | 'success' | 'boost'

export const ReviewWizard = ({
  searchParams,
  editReview,
  onDone,
}: {
  searchParams: URLSearchParams
  // Edit mode: mount with the stored row and edit it in place on one page.
  // onDone(changed) fires on cancel (false) and after a saved update (true).
  editReview?: EditableReview
  onDone?: (changed: boolean) => void
}) => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { profile } = useProfileContext()
  const { showToast } = useToast()

  const editMode = !!editReview
  // Stored values mapped once at mount — the editor is only opened with the
  // row already in hand, so lazy initializers are safe.
  const [initial] = useState(() => (editReview ? reviewToWizardState(editReview) : null))

  const form = useReviewForm(
    editMode && initial
      ? {
          rating: initial.rating,
          recommend: initial.recommend,
          program: initial.program,
          degreeLevel: initial.degreeLevel,
          subscores: initial.subscores,
          enrollmentStatus: initial.enrollmentStatus,
          startYear: initial.startYear,
          endYear: initial.endYear,
          languageOfInstruction: initial.languageOfInstruction,
          tuitionRange: initial.tuitionRange,
          livingCostRange: initial.livingCostRange,
          fundingType: initial.fundingType,
          fundingCoverage: initial.fundingCoverage,
          selectedTags: initial.tags,
          pros: initial.pros,
          cons: initial.cons,
          reviewText: initial.reviewText,
        }
      : { selectedUni: searchParams.get('uni') || '' }
  )
  // `form` is a new object whenever values change; `applyValues`/`set` are
  // stable. Effects and callbacks that apply drafts must depend on the stable
  // setter only, or the draft-load effect would re-run on every keystroke.
  const { values, applyValues } = form

  // Resume a saved draft: ?draft=<id> for signed-in users, or the anonymous
  // localStorage fallback for everyone else.
  const draftParam = searchParams.get('draft')
  const uniParam = searchParams.get('uni')
  const [draftId, setDraftId] = useState<string | null>(draftParam)
  const [draftLoading, setDraftLoading] = useState(!editMode)
  const [draftUniversityId, setDraftUniversityId] = useState<string | null>(null)

  // Flow state
  const [phase, setPhase] = useState<Phase>('form')
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [reviewEntry, setReviewEntry] = useState<ReviewEntry>('unknown')
  const [boostIndex, setBoostIndex] = useState(0)

  // Set once publish succeeds: the row id (Boost writes against it), the
  // canonical slug for links, and the timestamp shown on the preview card.
  const [published, setPublished] = useState<{
    reviewId: string
    universitySlug: string | null
    publishedAt: string
  } | null>(null)

  const [mediaState, setMediaState] = useState<MediaState>({
    media: initial?.media ?? [],
    uploading: false,
    errorCount: 0,
  })

  // Submit state
  const [loading, setLoading] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  const [pendingSuccess, setPendingSuccess] = useState<(() => void) | null>(null)

  // Turnstile (anonymous) — rendered on the publish screen.
  const reviewTurnstileRef = useRef<TurnstileInstance | undefined>(undefined)
  const [reviewTurnstileReady, setReviewTurnstileReady] = useState(false)

  // ---- Draft persistence -----------------------------------------------------

  const draftPayload = useMemo<ReviewDraftPayload>(
    () => draftPayloadFromState(values, mediaState.media, step),
    [values, mediaState.media, step]
  )

  const draftIdRef = useRef<string | null>(draftParam)
  const lastSavedPayloadRef = useRef<ReviewDraftPayload | null>(null)
  const draftPayloadRef = useRef<ReviewDraftPayload>(draftPayload)
  const reviewStartedRef = useRef(false)
  const attemptStartedAtRef = useRef<number | null>(null)
  const viewedScreensRef = useRef(new Set<number>())
  const storyViewedRef = useRef(false)
  const reportedValidationScreensRef = useRef(new Set<number>())
  const submitInFlightRef = useRef(false)

  useEffect(() => {
    draftIdRef.current = draftId
  }, [draftId])

  useEffect(() => {
    draftPayloadRef.current = draftPayload
  }, [draftPayload])

  const applyDraftPayload = useCallback(
    (p: ReviewDraftPayload) => {
      setStep(mapDraftStepToScreen(p))
      applyValues(fieldValuesFromDraft(p))
      setMediaState({ media: p.media ?? [], uploading: false, errorCount: 0 })
      lastSavedPayloadRef.current = p
    },
    [applyValues]
  )

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
      data: { flow: FLOW, entry: reviewEntry, auth: reviewAuth },
    })
  }, [reviewEntry, reviewAuth])

  // Screen-viewed events: once per screen per visit, including the screen a
  // resumed draft lands on. The writing screen also emits review_story_viewed
  // (the same event the legacy writing screen fired).
  useEffect(() => {
    if (editMode || authLoading || draftLoading || phase !== 'form') return
    beginReviewAttempt()
    if (!viewedScreensRef.current.has(step)) {
      viewedScreensRef.current.add(step)
      void trackReviewEvent({
        name: SCREEN_EVENTS[step],
        data: {
          flow: FLOW,
          entry: reviewEntry,
          auth: reviewAuth,
          step: step as 1 | 2,
          stage: SCREEN_STAGES[step],
        },
      })
    }
    if (step === 2 && !storyViewedRef.current) {
      storyViewedRef.current = true
      void trackReviewEvent({
        name: 'review_story_viewed',
        data: { flow: FLOW, entry: reviewEntry, auth: reviewAuth },
      })
    }
  }, [
    authLoading,
    beginReviewAttempt,
    draftLoading,
    editMode,
    phase,
    reviewAuth,
    reviewEntry,
    step,
  ])

  // Resolve the current university slug to an id for the draft row. Optional —
  // drafts for "not listed" universities stay linked by payload only.
  useEffect(() => {
    if (editMode || !values.selectedUni || values.selectedUni === '__not_listed') {
      setDraftUniversityId(null)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      const { data } = await supabase
        .from('universities')
        .select('id')
        .eq('slug', values.selectedUni)
        .abortSignal(controller.signal)
        .maybeSingle()
      if (!controller.signal.aborted) setDraftUniversityId(data?.id ?? null)
    }
    run()
    return () => controller.abort()
  }, [editMode, values.selectedUni])

  // Autosave once something worth keeping exists. Debounced so typing doesn't
  // create a write per keystroke. Nothing is saved after publish — the review
  // is live and the draft row is already gone.
  useEffect(() => {
    if (editMode || draftLoading || phase !== 'form') return
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
  }, [user, editMode, draftLoading, phase, draftPayload, draftUniversityId])

  // Warn before closing the tab when there is unsaved progress. The autosave
  // runs every 1.5s, so this only guards the narrow window after a change.
  useEffect(() => {
    if (editMode || draftLoading || phase !== 'form') return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const current = draftPayloadRef.current
      if (!isDraftWorthSaving(current)) return
      if (JSON.stringify(current) === JSON.stringify(lastSavedPayloadRef.current)) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [editMode, draftLoading, phase])

  // Pre-fill university from ?uni=<slug>
  const uniSlug = uniParam
  const { university: prefilledUni } = useUniversity(uniSlug || undefined)

  // Sync resolved university into form state once. Drafts already carry their
  // own university — don't let the ?uni prefill overwrite a loaded draft or a
  // university the user picked while the lookup was in flight.
  useEffect(() => {
    if (prefilledUni && !editMode && !draftParam) {
      applyValues((v) =>
        v.selectedUniName || (v.selectedUni && v.selectedUni !== prefilledUni.slug)
          ? {}
          : { selectedUni: prefilledUni.slug || '', selectedUniName: prefilledUni.name || '' }
      )
    }
  }, [prefilledUni, editMode, draftParam, applyValues])

  // Pre-fill program and university name from the user's profile once it
  // loads, filling empty fields only so typed input is never clobbered.
  // Skipped in edit mode: the review row is the source of truth there.
  useEffect(() => {
    if (!profile || editMode) return
    applyValues((v) => ({
      ...(!v.program && profile.program ? { program: profile.program } : {}),
      ...(!v.selectedUniName && profile.university ? { selectedUniName: profile.university } : {}),
    }))
  }, [profile, editMode, applyValues])

  // ---- Validation --------------------------------------------------------------

  const clearError = useCallback(() => setError(null), [])

  const reportValidationFailure = useCallback(
    (screen: number) => {
      if (reportedValidationScreensRef.current.has(screen)) return
      reportedValidationScreensRef.current.add(screen)
      void trackReviewEvent({
        name: 'review_validation_failed',
        data: {
          flow: FLOW,
          auth: reviewAuth,
          step: screen as 1 | 2,
          stage: SCREEN_STAGES[screen],
        },
      })
    },
    [reviewAuth]
  )

  // The publish minimum is exactly what the server requires: a university and
  // a rating on screen 1, one real sentence on screen 2. Everything else is
  // optional input, never a gate.
  const validateScreen = (s: number): string | null => {
    if (s === 1) {
      if (!values.selectedUni && !values.selectedUniName.trim()) {
        return "Which university? Other students can't find your review without it."
      }
      if (values.showNotListed && (!values.newUniName.trim() || !values.newUniCity.trim())) {
        return 'Please enter the university name and city.'
      }
      if (!values.rating) {
        return "Pick a star rating. It's the first thing every student looks at."
      }
      return null
    }
    if (s === 2) {
      if (values.reviewText.trim().length < 10) {
        return 'One honest sentence is enough — but other students do need that much.'
      }
      return null
    }
    return null
  }

  const goNext = () => {
    const err = validateScreen(step)
    if (err) {
      setError(err)
      reportValidationFailure(step)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    clearError()
    setStep((s) => Math.min(s + 1, 2))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    clearError()
    setStep((s) => Math.max(s - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ---- Publish -------------------------------------------------------------------

  const handleStampComplete = () => {
    setShowStamp(false)
    if (pendingSuccess) {
      pendingSuccess()
      setPendingSuccess(null)
    }
  }

  const handlePublish = async () => {
    if (submitInFlightRef.current) return
    beginReviewAttempt()

    // A resumed draft can land straight on screen 2 with essentials missing —
    // send the reviewer back to fix them rather than letting the server 400.
    const essentialsErr = validateScreen(1)
    if (essentialsErr) {
      setStep(1)
      setError(essentialsErr)
      reportValidationFailure(1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const storyErr = validateScreen(2)
    if (storyErr) {
      setError(storyErr)
      reportValidationFailure(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    clearError()
    setLoading(true)
    submitInFlightRef.current = true
    void trackReviewEvent({
      name: 'review_submit_attempted',
      data: { flow: FLOW, entry: reviewEntry, auth: reviewAuth },
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

      const isNotListed = values.selectedUni === '__not_listed'

      const result = await submitReview({
        cfToken,
        claimToken: !user ? (getOrCreateClaimToken() ?? undefined) : undefined,
        universitySlug: !isNotListed && values.selectedUni ? values.selectedUni : undefined,
        universityName:
          !isNotListed && !values.selectedUni && values.selectedUniName.trim()
            ? values.selectedUniName.trim()
            : undefined,
        newUniversity: isNotListed
          ? {
              name: values.newUniName.trim(),
              city: values.newUniCity.trim(),
              province: values.newUniProvince || undefined,
            }
          : undefined,
        ...buildReviewFields(values, mediaState.media),
        reviewerContext: !user
          ? {
              email: values.anonEmail.trim() || undefined,
              emailConsent: values.emailConsent,
              homeCountry: values.homeCountry || undefined,
              currentStatus: values.currentStatus || undefined,
              languagesSpoken:
                values.languagesSpoken.length > 0 ? values.languagesSpoken : undefined,
            }
          : undefined,
      })

      submissionSucceeded = true
      void trackReviewEvent({
        name: 'review_published',
        data: {
          flow: FLOW,
          entry: reviewEntry,
          auth: reviewAuth,
          duration_band: publishDurationBand(attemptStartedAtRef.current),
        },
      })

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

      const slug = result.universityCreated ? null : result.universitySlug
      setPublished({
        reviewId: result.reviewId,
        universitySlug: slug,
        publishedAt: new Date().toISOString(),
      })

      if (!user) {
        sessionStorage.setItem('trc_anon_review_submitted', 'true')
        sessionStorage.setItem('trc_anon_review_redirect', slug || '')
        // A fresh anonymous review may be claimable after sign-in — let the
        // claim prompt re-check even if it already ran for this user.
        sessionStorage.removeItem('trc_claim_checked')
      }

      setPendingSuccess(() => () => setPhase('success'))
      setShowStamp(true)
    } catch (error) {
      const status = error instanceof ReviewSubmitError ? error.status : undefined
      if (!submissionSucceeded) {
        void trackReviewEvent({
          name: 'review_submit_failed',
          data: {
            flow: FLOW,
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

  // ---- Boost ---------------------------------------------------------------------

  // Every card's Save persists the whole current field set — review-manage
  // rewrites all writable columns on each update, so merging happens here.
  const saveBoost = async (): Promise<boolean> => {
    if (!published || !user) return false
    try {
      await updateReview(published.reviewId, buildReviewFields(values, mediaState.media))
      return true
    } catch (err) {
      console.error('Boost save failed:', err)
      showToast(err instanceof Error ? err.message : 'Could not save that. Try again.', 'error')
      return false
    }
  }

  const trackBoostCompleted = useCallback(
    (card: BoostCard) => {
      void trackReviewEvent({
        name: 'boost_card_completed',
        data: { flow: FLOW, auth: reviewAuth, card },
      })
    },
    [reviewAuth]
  )

  const handleBoostExit = useCallback(
    (afterCard: BoostAfterCard, nextIndex: number) => {
      void trackReviewEvent({
        name: 'boost_exited',
        data: { flow: FLOW, auth: reviewAuth, after_card: afterCard },
      })
      setBoostIndex(nextIndex)
      setPhase('success')
    },
    [reviewAuth]
  )

  const handleBoostFinish = useCallback(() => {
    setPhase('success')
    showToast('All saved. Thanks for the detail.', 'success')
  }, [showToast])

  const finishFlow = () => {
    navigate(published?.universitySlug ? `/university/${published.universitySlug}` : '/')
  }

  // ---- Render --------------------------------------------------------------------

  if (editMode) {
    return (
      <ReviewEditForm
        form={form}
        mediaState={mediaState}
        onMediaStateChange={setMediaState}
        editReview={editReview!}
        onDone={onDone}
      />
    )
  }

  if (phase === 'success' && published) {
    return (
      <div className="container" style={{ maxWidth: '700px' }}>
        <div className="section">
          <ReviewSuccess
            form={form}
            media={mediaState.media}
            publishedAt={published.publishedAt}
            universitySlug={published.universitySlug}
            isAnonymous={!user}
            onBoost={() => setPhase('boost')}
            onDone={finishFlow}
          />
        </div>
      </div>
    )
  }

  if (phase === 'boost' && published) {
    return (
      <div className="container" style={{ maxWidth: '700px' }}>
        <div className="section">
          <PublishedReviewPreview
            values={values}
            media={mediaState.media}
            date={new Date(published.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          />
          <BoostCards
            form={form}
            mediaState={mediaState}
            onMediaStateChange={setMediaState}
            initialIndex={boostIndex}
            onSave={saveBoost}
            onCardCompleted={trackBoostCompleted}
            onExit={handleBoostExit}
            onFinish={handleBoostFinish}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: '700px' }}>
      <div className="section">
        <Link to="/" className="btn btn-outline" style={{ marginBottom: 'var(--sp-2)' }}>
          <Icons.ArrowLeft /> Back
        </Link>
        <h1 className="section-title">Leave a Review</h1>

        {/* Progress bar */}
        <div className="wizard-progress">
          {SCREEN_LABELS.map((_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`progress-step ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}
            />
          ))}
        </div>
        <div className="step-labels">
          {SCREEN_LABELS.map((label, i) => (
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

        {step === 1 && <ReviewEssentials form={form} />}

        {step === 2 && <ReviewStory form={form} isAnonymous={!user} />}

        {/* Anonymous Turnstile — lives on the publish screen now */}
        {!user && step === 2 && (
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

        <div className="wizard-nav">
          {step === 1 ? (
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
              ← Back
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={goBack}>
              ← Back
            </button>
          )}
          {step === 1 && (
            <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
              Continue →
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={loading || (!user && !reviewTurnstileReady)}
              onClick={handlePublish}
            >
              {loading
                ? 'Publishing...'
                : !user && !reviewTurnstileReady
                  ? 'Verifying you are human...'
                  : 'Publish review 📜'}
            </button>
          )}
        </div>
      </div>

      <RegistrationNudge />

      {showStamp && <SealStampOverlay onComplete={handleStampComplete} />}
    </div>
  )
}
