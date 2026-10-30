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
import {
  getOrCreateClaimToken,
  createBoostToken,
  storeBoostToken,
  getBoostToken,
} from '../lib/reviewClaim'
import { updateReview } from '../lib/reviewManage'
import { boostReview } from '../lib/reviewBoost'
import { submitAnswer } from '../lib/communityApi'
import { reviewToWizardState, type EditableReview } from '../lib/reviewEdit'
import { supabase } from '../lib/supabaseClient'
import {
  saveReviewDraft,
  getReviewDraft,
  deleteReviewDraft,
  deleteReviewDraftForUniversity,
  loadLocalDraftWithAlias,
  saveLocalDraft,
  clearLocalDraft,
  listLocalDrafts,
  hasDraftSubstance,
  isDraftWorthSaving,
  mapDraftStepToScreen,
  withLiveMedia,
  EXPIRED_DRAFT_MEDIA_MESSAGE,
  LOCAL_DRAFT_NO_UNI_SLUG,
  type LocalDraftEntry,
  type ReviewDraftPayload,
} from '../lib/reviewDrafts'
import {
  ANON_BOOST_CARDS,
  BOOST_CARD_ORDER,
  buildBoostPatch,
  buildReviewFields,
  draftPayloadFromState,
  fieldValuesFromDraft,
  normalizeUniSlugParam,
  previewReviewFromFields,
  UNI_SLUG_RE,
  type ReviewFieldValues,
} from '../lib/reviewFlow'
import { DETAILED_THRESHOLD, DETAIL_AREA_COUNT, filledDetailAreas } from '../lib/reviewDetail'
import { useReviewForm } from '../hooks/useReviewForm'
import { useUniversity } from '../hooks/useUniversity'
import { useProfileContext } from '../contexts/ProfileContext'
import { Icons } from './Icons'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { SealStampOverlay } from './SealStampOverlay'
import { SealBadge } from './SealBadge'
import { ReviewEssentials } from './review/ReviewEssentials'
import { ReviewStory } from './review/ReviewStory'
import { PublishedReviewPreview, ReviewSuccess } from './review/ReviewSuccess'
import { BoostCards } from './review/BoostCards'
import { ReviewEditForm } from './review/ReviewEditForm'
import { AnonEmailField, type MediaState } from './review/fields'

// ---- Constants ----------------------------------------------------------------

// The tap-first flow's analytics tag. Event names and meanings are unchanged —
// only `flow` distinguishes which layout produced them, so the v2 funnel can
// be compared against fast_2 directly.
const FLOW = 'tap_3' as const

// Screen index -> the step-viewed event + stage enum it emits. Step numbers
// stay positional ("Nth screen shown") and stages stay semantic, so the
// fast-flow funnel compares cleanly against the legacy one.
const SCREEN_EVENTS: Record<number, ReviewEventName> = {
  1: 'review_step_1_viewed',
  2: 'review_step_2_viewed',
  3: 'review_step_3_viewed',
}
const SCREEN_STAGES: Record<number, ReviewStage> = {
  1: 'basics',
  2: 'story',
  3: 'post',
}
const SCREEN_LABELS = ['The essentials', 'What stood out', 'Post it']

type Phase = 'form' | 'success' | 'boost'

// Slim "details collected" track under the progress dots: the dragon glides
// toward the gold pearl as detail areas fill on either side of publish. It
// reads the same ReviewCardData shape the public card uses, so the count it
// shows always matches the highlight the review will actually earn.
const DetailTrack = ({
  values,
  media,
}: {
  values: ReviewFieldValues
  media: MediaState['media']
}) => {
  const filled = filledDetailAreas(previewReviewFromFields(values, media)).length
  const pct = Math.min(100, (filled / DETAIL_AREA_COUNT) * 100)
  const earned = filled >= DETAILED_THRESHOLD
  return (
    <div
      className="detail-track"
      role="status"
      aria-label={`${filled} of ${DETAIL_AREA_COUNT} detail areas filled`}
    >
      <div className="detail-track-bar">
        <div className="detail-track-fill" style={{ width: `${pct}%` }} />
        <span
          className="detail-track-dragon"
          style={{ left: `calc(${pct}% - 0.6em)` }}
          aria-hidden="true"
        >
          🐉
        </span>
        <span className={`detail-track-pearl${earned ? ' earned' : ''}`} aria-hidden="true" />
      </div>
      <div className={`detail-track-label${earned ? ' earned' : ''}`}>
        {earned
          ? 'Gold highlight earned'
          : `${filled}/${DETAIL_AREA_COUNT} details: ${DETAILED_THRESHOLD} earns the gold highlight`}
      </div>
    </div>
  )
}

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

  // Resume a saved draft: ?draft=<id> for signed-in users, or the anonymous
  // localStorage fallback for everyone else.
  const draftParam = searchParams.get('draft')
  // Normalized like the server does (review-submit trims + lowercases, then
  // format-checks): anything that can't be a slug is treated as no param at
  // all — an empty field beats a broken lookup and a dead-end publish.
  const uniParam = normalizeUniSlugParam(searchParams.get('uni'))

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
      : { selectedUni: draftParam ? '' : uniParam, reviewText: searchParams.get('answer') || '' }
  )
  // `form` is a new object whenever values change; `applyValues`/`set` are
  // stable. Effects and callbacks that apply drafts must depend on the stable
  // setter only, or the draft-load effect would re-run on every keystroke.
  const { values, applyValues } = form

  const promptParam = searchParams.get('prompt')
  const answerParam = searchParams.get('answer')
  const qSlugParam = searchParams.get('qSlug')
  const [draftId, setDraftId] = useState<string | null>(draftParam)
  const [draftLoading, setDraftLoading] = useState(!editMode)
  const [draftUniversityId, setDraftUniversityId] = useState<string | null>(null)
  const [alsoPostAnswer, setAlsoPostAnswer] = useState(true)
  // Signed-in only: publish under "Anonymous" — the public row keeps
  // user_id NULL and ownership is linked privately on reviewer_context.
  // Named + Verified seal stays the default while logged in.
  const [postAnon, setPostAnon] = useState(false)
  // Guest who picked "Post with nickname": publishes now as Anonymous, then gets
  // the account step on the success screen (the claim flow attaches the name).
  const [wantsNickname, setWantsNickname] = useState(false)
  // Set when a requested draft lookup failed — lets a valid ?uni still
  // prefill after a bad ?draft= link instead of leaving an empty field.
  const [draftLookupFailed, setDraftLookupFailed] = useState(false)
  // A saved anonymous draft for a different university than the one open now.
  // Surfaced as a non-blocking banner so the draft is not silently buried.
  const [otherDraft, setOtherDraft] = useState<{
    slug: string
    to: string
    name: string
  } | null>(null)

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

  // Deferred work (the Boost auto-cascade fires its save inside a timer, and
  // stamped publish runs after the stamp animation) must read flushed state,
  // not the render closure it was defined in.
  const valuesRef = useRef(values)
  const mediaStateRef = useRef(mediaState)
  useEffect(() => {
    valuesRef.current = values
  }, [values])
  useEffect(() => {
    mediaStateRef.current = mediaState
  }, [mediaState])

  // Submit state
  const [loading, setLoading] = useState(false)
  const [showStamp, setShowStamp] = useState(false)
  // Screen 2: set after the first Continue tap with nothing picked or written.
  const [nudgeShown, setNudgeShown] = useState(false)
  const [pendingSuccess, setPendingSuccess] = useState<(() => void) | null>(null)

  // Turnstile (anonymous) — rendered on the publish screen.
  const reviewTurnstileRef = useRef<TurnstileInstance | undefined>(undefined)
  const [reviewTurnstileReady, setReviewTurnstileReady] = useState(false)

  // ---- Draft persistence -----------------------------------------------------

  const draftPayload = useMemo<ReviewDraftPayload>(
    () => draftPayloadFromState(values, mediaState.media, Math.min(step, 2)),
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
  // The slug/name pair a loaded draft applied — so a later clear can tell
  // "still the draft's values" apart from "the user typed over them".
  const draftSeedRef = useRef({ slug: '', name: '' })
  // The anonymous draft slot this visit consumed ('none' when no university
  // was picked). Publish clears it even if the pick changed mid-session.
  const loadedLocalSlotRef = useRef<string | null>(null)
  // The slot the last local autosave wrote — lets a pick change retire the
  // slot the draft moved from instead of stacking residue copies.
  const lastWrittenLocalSlotRef = useRef<string | null>(null)
  // Set the moment submitReview succeeds — a debounced autosave can still fire
  // during the stamp animation (phase is still 'form' until it finishes), and
  // without this it would re-create the draft row publish just deleted.
  const submittedRef = useRef(false)

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
      // Strip savedAt — draftPayload never carries it, so keeping it here
      // would dirty-compare for the ~1.5s until the next autosave.
      const { savedAt: _savedAt, ...comparable } = p
      lastSavedPayloadRef.current = comparable
      draftSeedRef.current = { slug: p.selectedUni || '', name: p.selectedUniName || '' }
    },
    [applyValues]
  )

  // Resolve ?uni=<slug> once — the field prefill below and the draft-load
  // effect's university check share this single lookup (aliases included).
  const {
    university: prefilledUni,
    loading: prefilledUniLoading,
    error: prefilledUniError,
  } = useUniversity(uniParam || undefined)

  // The local draft slot for the current pick: canonical once the ?uni
  // lookup resolves. A still-raw param is an alias while the lookup is
  // pending, so null then — keying a slot by it would leave the draft
  // unreachable via the canonical slug. On lookup *error* the raw param is
  // still the best key: the read path below falls back to it the same way,
  // and skipping saves would silently disable autosave for the session.
  const draftSlotSlug =
    uniParam && values.selectedUni === uniParam
      ? (prefilledUni?.slug ?? (prefilledUniError ? uniParam : null))
      : values.selectedUni

  // A mounted ?uni=A→B navigation starts a new visit: the slot refs below
  // belong to the university that loaded them, not the new one.
  useEffect(() => {
    loadedLocalSlotRef.current = null
    lastWrittenLocalSlotRef.current = null
  }, [uniParam])

  // Load the draft once auth is ready. Signed-in users pull by ?draft=<id>, or
  // by ?uni=<slug> when a draft already exists for that university (so the
  // wizard resumes instead of overwriting it on the first autosave). Anonymous
  // visitors fall back to the localStorage draft when the slug matches.
  useEffect(() => {
    if (editMode || authLoading) return
    // Both the signed-in draft check and the anonymous slot key come from
    // the resolved university — wait for the shared lookup rather than
    // racing it or duplicating its query. A signed-in ?draft=<id> load is
    // the one path that needs nothing from the lookup, so it skips the wait.
    if (uniParam && prefilledUniLoading && !(user && draftParam)) return

    const controller = new AbortController()
    // localStorage drafts can outlive their uploads (server cleanup can't see
    // them), so drop media that no longer exists before showing the draft.
    const applyLocalDraft = async (entry: LocalDraftEntry): Promise<boolean> => {
      const live = await withLiveMedia(entry.payload, controller.signal)
      if (controller.signal.aborted) return false
      applyDraftPayload(live.payload)
      // The slot this visit consumed — publish clears it regardless of how
      // the form's university pick changes afterward.
      loadedLocalSlotRef.current = entry.slug
      if (live.dropped) showToast(EXPIRED_DRAFT_MEDIA_MESSAGE, 'error')
      return true
    }
    const run = async () => {
      let loaded = false
      let lookupFailed = false
      // The local draft this visit applied, by storage key — kept out of the
      // other-drafts notice below.
      let appliedLocalSlug: string | null = null
      // Local slots are keyed by canonical slug and server drafts by
      // university id, while the link may carry an alias — both come from
      // the shared lookup, falling back to the raw param when it fails.
      const resolvedSlug = prefilledUni?.slug || uniParam
      const resolvedUniId = prefilledUni?.id ?? null
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
          // A draft for this university may already exist — resume it so
          // autosave updates the saved row instead of clobbering it. The row
          // comes from the shared useUniversity lookup, so alias links match
          // the canonical university id.
          if (resolvedUniId) {
            const { data: d, error: draftError } = await supabase
              .from('review_drafts')
              .select('id, payload, university_id')
              .eq('user_id', user.id)
              .eq('university_id', resolvedUniId)
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
          // Drafts are keyed by university: a ?uni link reads only its own
          // slot (canonical above, so aliases work), a plain visit picks up
          // the most recently saved draft. The raw-param slot is checked
          // too — legacy migrations and saves during a failed lookup can
          // leave drafts keyed by the alias.
          const entry = loadLocalDraftWithAlias(resolvedSlug || undefined, uniParam)
          if (entry && isDraftWorthSaving(entry.payload)) {
            if (!(await applyLocalDraft(entry))) return
            appliedLocalSlug = entry.slug
            loaded = true
          }
        }

        // Anonymous progress survives login: if the visitor just signed in and
        // no server draft was loaded, pick up the localStorage draft and let
        // autosave promote it to their account.
        if (user && !draftParam && !loaded && !controller.signal.aborted) {
          const entry = loadLocalDraftWithAlias(resolvedSlug || undefined, uniParam)
          if (entry && isDraftWorthSaving(entry.payload)) {
            if (!(await applyLocalDraft(entry))) return
            clearLocalDraft(entry.slug)
            loaded = true
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        lookupFailed = true
        console.error('Error loading draft:', err)
      } finally {
        if (!controller.signal.aborted) {
          if (lookupFailed) setDraftLookupFailed(true)
          // Tell the visitor about drafts for other universities. A group-chat
          // link for Y must not silently bury a draft they started for X.
          // Skeletons saved by a bare ?uni prefill do not count as progress.
          const others = listLocalDrafts().filter(
            (d) =>
              d.slug !== (uniParam || LOCAL_DRAFT_NO_UNI_SLUG) &&
              d.slug !== (resolvedSlug || LOCAL_DRAFT_NO_UNI_SLUG) &&
              d.slug !== appliedLocalSlug &&
              hasDraftSubstance(d.payload)
          )
          const first = others[0]
          setOtherDraft(
            first
              ? {
                  slug: first.slug,
                  to:
                    first.slug !== LOCAL_DRAFT_NO_UNI_SLUG && first.slug !== '__not_listed'
                      ? `/review?uni=${first.slug}`
                      : '/review',
                  name:
                    first.payload.selectedUniName.trim() ||
                    first.payload.newUniName.trim() ||
                    'another university',
                }
              : null
          )
          setReviewEntry(
            resolveReviewEntry({ loaded, requested: Boolean(draftParam), lookupFailed })
          )
          setDraftLoading(false)
        }
      }
    }

    run()
    return () => controller.abort()
  }, [
    editMode,
    authLoading,
    user,
    draftParam,
    uniParam,
    prefilledUni,
    prefilledUniLoading,
    applyDraftPayload,
    showToast,
  ])

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
          step: step as 1 | 2 | 3,
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
    // The ?uni lookup already resolved this row — reuse it rather than
    // re-running the same slug/alias query.
    if (
      prefilledUni &&
      (values.selectedUni === uniParam || values.selectedUni === prefilledUni.slug)
    ) {
      setDraftUniversityId(prefilledUni.id)
      return
    }
    // Anything that can't be a slug can't resolve to a row — and a legacy or
    // tampered draft payload carrying `,`/`}`/`.` would break the .or()
    // filter below into a 400 that silently nulled the draft link.
    if (!UNI_SLUG_RE.test(values.selectedUni)) {
      setDraftUniversityId(null)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      const { data, error } = await supabase
        .from('universities')
        .select('id')
        .or(`slug.eq.${values.selectedUni},slug_aliases.cs.{${values.selectedUni}}`)
        .abortSignal(controller.signal)
        .maybeSingle()
      if (controller.signal.aborted) return
      if (error) console.error('Error resolving draft university:', error)
      setDraftUniversityId(data?.id ?? null)
    }
    run()
    return () => controller.abort()
  }, [editMode, values.selectedUni, prefilledUni, uniParam])

  // Autosave once something worth keeping exists. Debounced so typing doesn't
  // create a write per keystroke. Nothing is saved after publish — the review
  // is live and the draft row is already gone.
  useEffect(() => {
    if (editMode || draftLoading || phase !== 'form') return
    if (!isDraftWorthSaving(draftPayload)) return
    if (JSON.stringify(draftPayload) === JSON.stringify(lastSavedPayloadRef.current)) return

    const timer = setTimeout(async () => {
      try {
        if (submittedRef.current) return
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
          // A null slot means the pick is still an unresolved alias — skip
          // rather than write a slot reads can't find back. While a ?uni
          // navigation is still resolving the pick has not settled either —
          // that slot belongs to the previous visit's checkpoint.
          if (draftSlotSlug !== null && !prefilledUniLoading) {
            saveLocalDraft(draftSlotSlug, draftPayload)
            lastSavedPayloadRef.current = draftPayload
            // The draft follows the pick within a visit: when it lands
            // under a different university, the copy it moved from is
            // residue — clear it so it can't resurface after publish or on
            // a later visit.
            const prevLocalSlot = lastWrittenLocalSlotRef.current ?? loadedLocalSlotRef.current
            if (prevLocalSlot !== null && prevLocalSlot !== draftSlotSlug) {
              clearLocalDraft(prevLocalSlot)
            }
            lastWrittenLocalSlotRef.current = draftSlotSlug
          }
        }
      } catch (err) {
        console.error('Draft save failed:', err)
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [
    user,
    editMode,
    draftLoading,
    phase,
    draftPayload,
    draftUniversityId,
    draftSlotSlug,
    prefilledUniLoading,
  ])

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

  // The last slug/name pair selectedUni+selectedUniName got from the URL —
  // the raw param seed or the values this effect applied. URL-sourced values
  // stay overwriteable so an alias (raw param != canonical slug) or a ?uni
  // change while the wizard is mounted doesn't freeze the field on the wrong
  // university; typed and draft-loaded values always win.
  const urlSeededRef = useRef({ slug: uniParam, name: '' })

  // Sync resolved university into form state once. Drafts already carry their
  // own university — don't let the ?uni prefill overwrite a loaded draft or a
  // university the user picked while the lookup was in flight. A failed
  // ?draft= lookup lifts the draftParam gate so a valid ?uni still prefills.
  useEffect(() => {
    if (prefilledUni && !editMode && (!draftParam || draftLookupFailed)) {
      applyValues((v) =>
        (v.selectedUniName && v.selectedUniName !== urlSeededRef.current.name) ||
        (v.selectedUni && v.selectedUni !== uniParam && v.selectedUni !== urlSeededRef.current.slug)
          ? {}
          : { selectedUni: prefilledUni.slug || '', selectedUniName: prefilledUni.name || '' }
      )
      urlSeededRef.current = { slug: prefilledUni.slug || uniParam, name: prefilledUni.name || '' }
    }
  }, [prefilledUni, editMode, draftParam, draftLookupFailed, uniParam, applyValues])

  // A ?uni slug that resolves to nothing must not ride along silently: it
  // passes step-1 validation and then fails at publish. Clearing it once the
  // lookup settles leaves an empty field that demands a real pick. A lookup
  // that errored (offline, retried abort) is not "no row" — keep the value.
  useEffect(() => {
    if (
      editMode ||
      draftParam ||
      !uniParam ||
      prefilledUni ||
      prefilledUniLoading ||
      prefilledUniError
    )
      return
    applyValues((v) =>
      v.selectedUni === uniParam
        ? {
            selectedUni: '',
            // A dead slug can carry a name in from a draft — clear the pair
            // so publish can't send the name as a free-text university. A
            // name the user typed over it stays.
            ...(v.selectedUniName === draftSeedRef.current.name ? { selectedUniName: '' } : {}),
          }
        : {}
    )
  }, [
    editMode,
    draftParam,
    uniParam,
    prefilledUni,
    prefilledUniLoading,
    prefilledUniError,
    applyValues,
  ])

  // Alias links resolve inside the draft-load effect above: the anonymous
  // draft slot uses the canonical slug, so the lookup happens once there.

  // Pre-fill program and university name from the user's profile once it
  // loads, filling empty fields only so typed input is never clobbered.
  // Skipped in edit mode (the review row is the source of truth) and for the
  // university when ?uni is present (the link wins — the profile name would
  // show one university while the link's slug submitted to another).
  useEffect(() => {
    if (!profile || editMode) return
    applyValues((v) => ({
      ...(!v.program && profile.program ? { program: profile.program } : {}),
      ...(!v.selectedUniName && !uniParam && profile.university
        ? { selectedUniName: profile.university }
        : {}),
    }))
  }, [profile, editMode, uniParam, applyValues])

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
          step: screen as 1 | 2 | 3,
          stage: SCREEN_STAGES[screen],
        },
      })
    },
    [reviewAuth]
  )

  // The publish minimum is exactly what the server requires: a university and
  // a rating on screen 1. Screen 2 asks nothing mandatory — empty text lands
  // as a quick rating; only a half-finished sentence (1-9 chars, which the
  // server would reject) gets nudged.
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
      const t = values.reviewText.trim()
      if (t.length > 0 && t.length < 10) {
        return 'A few more words, or clear it and post stars only.'
      }
      return null
    }
    return null
  }

  const storyEmpty = values.reviewText.trim() === '' && Object.keys(values.polarity).length === 0

  // "Post my stars only": drop the picks and any auto-written text, then go straight to Post it.
  const skipStory = () => {
    const err = validateScreen(1)
    if (err) return
    form.applyValues((cur) => ({
      ...cur,
      polarity: {},
      reviewText: '',
      selectedTags: [],
      pros: '',
      cons: '',
    }))
    clearError()
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goNext = () => {
    const err = validateScreen(step)
    if (err) {
      setError(err)
      reportValidationFailure(step)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    // Screen 2 with nothing picked or written: one gentle nudge, then let them through.
    if (step === 2 && storyEmpty && !nudgeShown) {
      setNudgeShown(true)
      document.querySelector<HTMLButtonElement>('.pol-btn.pos')?.focus()
      return
    }
    clearError()
    setStep((s) => Math.min(s + 1, 3))
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
      setStep(2)
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

      // Phase 3: mint the per-review Boost capability before submit so the
      // server can store its digest on the private context row. The legacy
      // shared claim token still goes along for older claim matching.
      const boostToken = !user ? createBoostToken() : null

      const result = await submitReview({
        cfToken,
        postAnonymously: Boolean(user && postAnon),
        claimToken: !user ? (getOrCreateClaimToken() ?? undefined) : undefined,
        boostToken: boostToken ?? undefined,
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
      submittedRef.current = true
      void trackReviewEvent({
        name: 'review_published',
        data: {
          flow: FLOW,
          entry: reviewEntry,
          auth: reviewAuth,
          duration_band: publishDurationBand(attemptStartedAtRef.current),
        },
      })

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
        if (qSlugParam && alsoPostAnswer && !answerParam) {
          try {
            await submitAnswer({
              questionSlug: qSlugParam,
              body: values.reviewText.trim(),
              anonymous: postAnon,
            })
          } catch (err) {
            console.error('Could not cross-post answer to Q&A thread:', err)
          }
        }
      } else {
        // Every slot this visit touched goes — its content is now published:
        // the loaded slot, the last slot autosave wrote (the pick may have
        // moved inside the debounce window), and the current pick's slot.
        for (const slot of new Set([
          loadedLocalSlotRef.current,
          lastWrittenLocalSlotRef.current,
          draftSlotSlug,
        ])) {
          if (slot !== null) clearLocalDraft(slot)
        }
      }

      const slug = result.universityCreated ? null : result.universitySlug
      // Only keep the capability when the server actually persisted its
      // digest — otherwise anonymous Boost would be offered but always 403.
      if (boostToken && result.boostAvailable) storeBoostToken(result.reviewId, boostToken)
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

      // Land straight on the Power-Up deck when this reviewer can still write
      // (signed-in JWT or a stored anonymous boost capability) — one less
      // click between "published" and "keep going". Without the capability,
      // the plain success screen is all that exists.
      setPendingSuccess(() => () => {
        const canBoost = Boolean(user) || getBoostToken(result.reviewId) !== null
        // Nickname guests see the account step first; the Boost offer follows it.
        setPhase(canBoost && !(!user && wantsNickname) ? 'boost' : 'success')
      })
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

  // Signed-in Boost keeps the full-field rewrite through review-manage. The
  // anonymous path sends only the current card's fields — the server merges
  // them into the stored row, so stale client state can never clobber columns
  // a different card owns.
  const saveBoost = async (card: BoostCard): Promise<boolean> => {
    if (!published) return false
    try {
      if (user) {
        await updateReview(
          published.reviewId,
          buildReviewFields(valuesRef.current, mediaStateRef.current.media)
        )
      } else {
        await boostReview(published.reviewId, buildBoostPatch(valuesRef.current, card))
      }
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
            wantsNickname={wantsNickname}
            postedAnonymously={Boolean(user && postAnon)}
            canBoost={Boolean(user) || getBoostToken(published.reviewId) !== null}
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
            anonymous={Boolean(user && postAnon)}
            date={new Date(published.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })}
          />
          <DetailTrack values={values} media={mediaState.media} />
          <BoostCards
            form={form}
            mediaState={mediaState}
            onMediaStateChange={setMediaState}
            cards={user ? BOOST_CARD_ORDER : ANON_BOOST_CARDS}
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
        <h1 className="section-title">
          {promptParam ? 'Answer a Student Question' : 'Leave a Review'}
        </h1>

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

        {/* A saved draft for a different university — surfaced so a ?uni
            link never silently buries work in progress. */}
        {otherDraft && (
          <div className="draft-reminder fade-in">
            <div className="draft-reminder-copy">
              <Icons.Pen />
              <span>
                You also have an unfinished review for <strong>{otherDraft.name}</strong>.
              </span>
            </div>
            <div className="draft-reminder-actions">
              <Link to={otherDraft.to} className="btn btn-outline btn-sm">
                Continue it
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOtherDraft(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="error-banner show">
            <span className="eb-icon">⚠</span>
            <span className="eb-msg">{error}</span>
          </div>
        )}

        {step === 1 && <ReviewEssentials form={form} promptQuestion={promptParam} />}

        {step === 2 && (
          <ReviewStory
            form={form}
            promptQuestion={promptParam}
            showNudge={nudgeShown && storyEmpty}
            onSkip={skipStory}
          />
        )}

        {step === 3 && (
          <div className="wizard-step active">
            <h2 className="step-title">How it will appear</h2>
            <span className="preview-eyebrow">Preview</span>
            <div className="post-preview">
              <PublishedReviewPreview
                values={values}
                media={mediaState.media}
                date={new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
                anonymous={Boolean(user && postAnon) || !user}
              />
            </div>
            {storyEmpty && (
              <button type="button" className="skip-link" onClick={() => setStep(2)}>
                Add a reason first
              </button>
            )}
          </div>
        )}

        {user && step === 3 && qSlugParam && !answerParam && (
          <label
            className="form-checkbox-label"
            htmlFor="cross-post-qa"
            style={{ marginBottom: 'var(--sp-2)' }}
          >
            <input
              id="cross-post-qa"
              type="checkbox"
              className="form-checkbox"
              checked={alsoPostAnswer}
              onChange={(e) => setAlsoPostAnswer(e.target.checked)}
            />
            Also post my response directly on the community question thread
          </label>
        )}

        {/* Attribution choice — everyone picks how the review appears before
            publishing. Guests post anonymously or sign in for the seal (modal,
            so the draft in state + localStorage survives); signed-in reviewers
            can hide their name while keeping the review privately owned. */}
        {step === 3 && (
          <div className="attribution-card" role="radiogroup" aria-label="How your review appears">
            <span className="form-label">How your review appears</span>
            {!user ? (
              <>
                <label className={`attribution-option${wantsNickname ? '' : ' selected'}`}>
                  <input
                    type="radio"
                    name="review-attribution"
                    className="attribution-radio"
                    checked={!wantsNickname}
                    disabled={loading}
                    onChange={() => setWantsNickname(false)}
                  />
                  <span className="attribution-option-body">
                    <span className="attribution-option-title">
                      Post as Anonymous
                      <span className="attribution-badge">🔒 100% Anonymous</span>
                    </span>
                    <span className="attribution-option-copy">
                      Publicly shows &quot;Anonymous&quot;. We never share your identity, IP, or
                      email with any university or third party.
                    </span>
                  </span>
                </label>
                <label className={`attribution-option${wantsNickname ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="review-attribution"
                    className="attribution-radio"
                    checked={wantsNickname}
                    disabled={loading}
                    onChange={() => setWantsNickname(true)}
                  />
                  <span className="attribution-option-body">
                    <span className="attribution-option-title">
                      Post with nickname <SealBadge />
                    </span>
                    <span className="attribution-option-copy">
                      Publish now, then make a free account in about 20 seconds to add your nickname
                      and the red Verified seal. Nothing blocks you before you post.
                    </span>
                  </span>
                </label>
              </>
            ) : (
              <>
                <label className={`attribution-option${postAnon ? '' : ' selected'}`}>
                  <input
                    type="radio"
                    name="review-attribution"
                    className="attribution-radio"
                    checked={!postAnon}
                    disabled={loading}
                    onChange={() => setPostAnon(false)}
                  />
                  <span className="attribution-option-body">
                    <span className="attribution-option-title">
                      Post as {profile?.display_name || 'yourself'} <SealBadge />
                    </span>
                    <span className="attribution-option-copy">
                      Earns the red Verified seal. Future students trust verified reviews most.
                    </span>
                  </span>
                </label>
                <label className={`attribution-option${postAnon ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="review-attribution"
                    className="attribution-radio"
                    checked={postAnon}
                    disabled={loading}
                    onChange={() => setPostAnon(true)}
                  />
                  <span className="attribution-option-body">
                    <span className="attribution-option-title">
                      Post as Anonymous
                      <span className="attribution-badge">linked privately to your account</span>
                    </span>
                    <span className="attribution-option-copy">
                      Publicly shows &quot;Anonymous&quot; with no link to your profile. You can
                      still edit, delete, get reply alerts, or put your name on it later from My
                      Reviews.
                    </span>
                  </span>
                </label>
              </>
            )}
          </div>
        )}

        {!user && step === 3 && (
          <details className="email-disclosure">
            <summary>Add a private backup email</summary>
            <AnonEmailField form={form} />
          </details>
        )}

        {/* Anonymous Turnstile — warms up on the story screen, finishes on Post it */}
        {!user && step >= 2 && (
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

        <div className="wizard-nav wizard-nav-sticky">
          {step === 3 && (
            <p className="wizard-nav-hint">
              {user
                ? postAnon
                  ? 'Shows as Anonymous.'
                  : `Shows as ${profile?.display_name || 'you'} with the Verified seal.`
                : wantsNickname
                  ? 'Shows as Anonymous until you add your nickname.'
                  : 'Shows as Anonymous.'}
            </p>
          )}
          {step === 1 ? (
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
              ← Back
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={goBack}>
              ← Back
            </button>
          )}
          {step < 3 && (
            <button type="button" className="btn btn-primary btn-lg" onClick={goNext}>
              Continue →
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={loading || (!user && !reviewTurnstileReady)}
              onClick={handlePublish}
            >
              {loading
                ? 'Publishing...'
                : !user && !reviewTurnstileReady
                  ? 'Checking your connection...'
                  : values.reviewText.trim()
                    ? 'Publish review'
                    : 'Publish rating'}
            </button>
          )}
        </div>
      </div>

      {showStamp && <SealStampOverlay onComplete={handleStampComplete} />}
    </div>
  )
}
