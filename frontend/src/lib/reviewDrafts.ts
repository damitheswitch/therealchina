import { supabase } from './supabaseClient'
import type { Json, Tables } from '../types/database.types'
import type { MediaItem, SubScores } from './reviewSubmit'

export type ReviewDraft = Tables<'review_drafts'> & {
  universities?: { name: string; slug: string; city: string | null } | null
}

// Serializable snapshot of the ReviewWizard state. Kept in one JSONB column so
// the wizard can resume without a column per field.
// `v` is the payload layout version: absent means v1 (the legacy 5-step
// wizard); 2 is the fast 2-screen flow. `step` means different things per
// version — resolve it with mapDraftStepToScreen, never read it raw.
export interface ReviewDraftPayload {
  v?: number
  step: number
  selectedUni: string
  selectedUniName: string
  showNotListed: boolean
  newUniName: string
  newUniProvince: string
  newUniCity: string
  rating: number
  recommend: string
  program: string
  subscores: SubScores
  enrollmentStatus: string
  startYear: number | ''
  endYear: number | ''
  languageOfInstruction: string
  degreeLevel: string
  tuitionRange: string
  livingCostRange: string
  fundingType: string
  fundingCoverage: string
  selectedTags: string[]
  pros: string
  cons: string
  reviewText: string
  // Verdict-matrix picks from the tap-first flow. Optional: drafts saved
  // before it existed simply have no key, and resume with an empty matrix.
  polarity?: Record<string, 'pos' | 'neg'>
  media: MediaItem[]
  homeCountry: string
  currentStatus: string
  languagesSpoken: string[]
  emailConsent: boolean
  anonEmail: string
  // Local drafts only: when the payload was last written to localStorage.
  // Server drafts use the row's own updated_at.
  savedAt?: number
}

const LOCAL_DRAFT_KEY = 'trc_review_draft'
// Anonymous drafts are namespaced per university so a group-chat link for
// university Y never overwrites a half-written draft for X. Drafts with no
// university chosen yet share the "none" slot.
const LOCAL_DRAFT_PREFIX = 'trc_review_draft:'
// The storage suffix for drafts saved before a university was picked.
export const LOCAL_DRAFT_NO_UNI_SLUG = 'none'
const localDraftKey = (slug: string): string =>
  `${LOCAL_DRAFT_PREFIX}${slug || LOCAL_DRAFT_NO_UNI_SLUG}`

// Draft payload version written by the current flow. Payloads saved by the
// old 5-step wizard have no `v` — they are v1 and their `step` refers to the
// old layout.
export const DRAFT_PAYLOAD_VERSION = 2

// Maps a saved draft's stored step onto the screen it should resume on.
// v2 drafts resume on their own screen; v1 drafts keep their content and land
// on the screen that now owns the fields they had reached: old steps 1-3 to
// screen 1, old steps 4-5 to screen 2 (D2.5).
export const mapDraftStepToScreen = (
  p: { v?: number; step?: number } | null | undefined
): 1 | 2 => {
  if (p?.v === DRAFT_PAYLOAD_VERSION) return p.step === 2 ? 2 : 1
  const step = typeof p?.step === 'number' && Number.isFinite(p.step) ? p.step : 1
  return step >= 4 ? 2 : 1
}

export const isDraftWorthSaving = (payload: ReviewDraftPayload | null): boolean => {
  if (!payload) return false
  if (payload.rating > 0) return true
  if (payload.reviewText.trim().length > 0) return true
  if (payload.program.trim().length > 0) return true
  if (payload.selectedUni || payload.selectedUniName.trim() || payload.newUniName.trim())
    return true
  if (Object.keys(payload.subscores).length > 0) return true
  if (payload.step > 1) return true
  return false
}

export const draftUniversityLabel = (draft: ReviewDraft): string => {
  const payload = draft.payload as unknown as ReviewDraftPayload | undefined
  return (
    draft.universities?.name?.trim() ||
    payload?.selectedUniName?.trim() ||
    payload?.newUniName?.trim() ||
    'Unknown university'
  )
}

export const draftProgressLabel = (draft: ReviewDraft): string => {
  // Every draft resumes in the 2-screen flow regardless of the layout it was
  // saved under — label the screen it will actually open on.
  const payload = draft.payload as unknown as ReviewDraftPayload | undefined
  const screen = mapDraftStepToScreen({ step: draft.progress ?? 0, v: payload?.v })
  return `Step ${screen} of 2`
}

// -- Server drafts -----------------------------------------------------------

interface SaveServerDraftInput {
  userId: string
  draftId: string | null
  universityId: string | null
  payload: ReviewDraftPayload
  progress: number
}

export const saveReviewDraft = async ({
  userId,
  draftId,
  universityId,
  payload,
  progress,
}: SaveServerDraftInput): Promise<string> => {
  const record = {
    user_id: userId,
    university_id: universityId,
    payload: payload as unknown as NonNullable<Json>,
    progress,
  }

  if (draftId) {
    const { data, error } = await supabase
      .from('review_drafts')
      .update(record)
      .eq('id', draftId)
      .eq('user_id', userId)
      .select('id')
    if (error) throw error
    if (data && data.length > 0) return draftId
    // Row was deleted elsewhere; fall through and insert a fresh one.
  }

  if (universityId) {
    const { data: existing } = await supabase
      .from('review_drafts')
      .select('id')
      .eq('user_id', userId)
      .eq('university_id', universityId)
      .maybeSingle()
    if (existing?.id) {
      const { error } = await supabase
        .from('review_drafts')
        .update(record)
        .eq('id', existing.id)
        .eq('user_id', userId)
      if (error) throw error
      return existing.id
    }
  }

  const { data, error } = await supabase.from('review_drafts').insert(record).select('id').single()
  if (error) throw error
  if (!data?.id) throw new Error('Draft was not saved')
  return data.id
}

export const getReviewDraft = async (
  draftId: string,
  userId: string
): Promise<ReviewDraft | null> => {
  const { data, error } = await supabase
    .from('review_drafts')
    .select(
      'id, user_id, university_id, payload, progress, created_at, updated_at, universities(name, slug, city)'
    )
    .eq('id', draftId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('Error loading draft:', error)
    return null
  }
  return (data as ReviewDraft | null) ?? null
}

export const listReviewDrafts = async (userId: string): Promise<ReviewDraft[]> => {
  const { data, error } = await supabase
    .from('review_drafts')
    .select(
      'id, user_id, university_id, payload, progress, created_at, updated_at, universities(name, slug, city)'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('Error listing drafts:', error)
    return []
  }
  return (data as ReviewDraft[] | null) ?? []
}

export const countReviewDrafts = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('review_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    console.error('Error counting drafts:', error)
    return 0
  }
  return count ?? 0
}

export const deleteReviewDraft = async (draftId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('review_drafts')
    .delete()
    .eq('id', draftId)
    .eq('user_id', userId)
  if (error) throw error
}

export const deleteReviewDraftForUniversity = async (
  userId: string,
  universityId: string
): Promise<void> => {
  const { error } = await supabase
    .from('review_drafts')
    .delete()
    .eq('user_id', userId)
    .eq('university_id', universityId)
  if (error) throw error
}

// -- Anonymous local fallback ------------------------------------------------

export interface LocalDraftEntry {
  // The storage suffix: a canonical university slug, or 'none' when no
  // university was picked. Not guaranteed to equal payload.selectedUni if the
  // payload is malformed, so code that needs the stored slug should use this.
  slug: string
  payload: ReviewDraftPayload
}

const readDraftKey = (key: string): ReviewDraftPayload | null => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReviewDraftPayload
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

// One-shot move of the pre-F7 single-slot draft into its per-university key.
// Safe to run on every call: once migrated there is nothing left to move.
const migrateLegacyLocalDraft = (): void => {
  const legacy = readDraftKey(LOCAL_DRAFT_KEY)
  try {
    if (legacy) {
      const target = localDraftKey(legacy.selectedUni || '')
      // A slot written by newer code wins — the legacy payload is older by
      // definition. Write before removing so a quota failure keeps the
      // legacy draft for the next call instead of losing it.
      if (!readDraftKey(target)) {
        localStorage.setItem(target, JSON.stringify(legacy))
      }
    }
    localStorage.removeItem(LOCAL_DRAFT_KEY)
  } catch {
    // Storage may be full or disabled; the draft stays put for a retry,
    // matching the rest of the local-fallback behavior.
  }
}

// Every saved anonymous draft, newest first. Skeleton drafts (a ?uni link
// visit that saved only the prefilled university) are included — callers
// decide whether they matter via isDraftWorthSaving / hasDraftSubstance.
export const listLocalDrafts = (): LocalDraftEntry[] => {
  migrateLegacyLocalDraft()
  const entries: LocalDraftEntry[] = []
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(LOCAL_DRAFT_PREFIX)) continue
      const payload = readDraftKey(key)
      if (payload && isDraftWorthSaving(payload)) {
        entries.push({ slug: key.slice(LOCAL_DRAFT_PREFIX.length), payload })
      }
    }
  } catch {
    // Ignore
  }
  entries.sort((a, b) => (b.payload.savedAt ?? 0) - (a.payload.savedAt ?? 0))
  return entries
}

// With a slug, reads only that university's slot. With no slug, returns the
// most recently saved draft across slots, matching the old single-slot
// behavior for a plain /review visit.
export const loadLocalDraft = (slug?: string): LocalDraftEntry | null => {
  if (slug === undefined) return listLocalDrafts()[0] ?? null
  migrateLegacyLocalDraft()
  const payload = readDraftKey(localDraftKey(slug))
  return payload ? { slug: slug || LOCAL_DRAFT_NO_UNI_SLUG, payload } : null
}

// Reads the canonical slot plus the raw-param slot when they differ. A raw
// param is an alias of the same university (the shared lookup only returns
// rows whose slug or slug_aliases match), so both slots hold drafts for one
// university — written by a legacy migration or a save during a failed
// lookup. The worth-saving, newer payload wins; the losing slot is removed
// so it cannot resurface as a phantom "other draft" later.
export const loadLocalDraftWithAlias = (
  slug: string | undefined,
  rawParam: string
): LocalDraftEntry | null => {
  const primary = loadLocalDraft(slug)
  // The merge is only safe with a canonical anchor: slug '' reads the
  // no-university slot and undefined reads the most-recent draft — neither
  // is known to be the same university as rawParam.
  if (!rawParam || !slug || rawParam === slug) return primary
  const secondary = loadLocalDraft(rawParam)
  if (!secondary || secondary.slug === primary?.slug) return primary
  if (!primary) return secondary
  const candidates = [primary, secondary]
  // A skeleton (a bare ?uni prefill, nothing written) never beats a draft
  // with real content, no matter which was saved more recently.
  const substantive = candidates.filter((e) => hasDraftSubstance(e.payload))
  const pick = (substantive.length ? substantive : candidates).sort(
    (a, b) => (b.payload.savedAt ?? 0) - (a.payload.savedAt ?? 0)
  )[0]
  for (const e of candidates) if (e !== pick) clearLocalDraft(e.slug)
  return pick
}

// The caller passes the resolved slug — never derive the slot from the
// payload, which can still hold a raw ?uni alias or a stale pick. The
// payload's selectedUni is kept in lockstep with the slot so resume checks
// and banner links can trust either.
export const saveLocalDraft = (slug: string, payload: ReviewDraftPayload): void => {
  migrateLegacyLocalDraft()
  try {
    localStorage.setItem(
      localDraftKey(slug),
      JSON.stringify({ ...payload, selectedUni: slug, savedAt: Date.now() })
    )
  } catch (err) {
    // Storage may be full or disabled; this is a best-effort fallback.
    console.error('Could not save local draft:', err)
  }
}

export const clearLocalDraft = (slug: string): void => {
  try {
    localStorage.removeItem(localDraftKey(slug))
    // A legacy single-slot draft for the same university goes too, in case it
    // has not been migrated yet.
    const legacy = readDraftKey(LOCAL_DRAFT_KEY)
    if (legacy && (legacy.selectedUni || '') === (slug || '')) {
      localStorage.removeItem(LOCAL_DRAFT_KEY)
    }
  } catch {
    // Ignore
  }
}

// The server's orphan-media cleanup can't see browser storage, so uploads in
// an old localStorage draft may already be gone. Drop those items before the
// wizard shows them; review-submit would reject them anyway. Only a definite
// 400/404 from storage counts as gone: a network error keeps the item.
export const withLiveMedia = async (
  payload: ReviewDraftPayload,
  signal?: AbortSignal
): Promise<{ payload: ReviewDraftPayload; dropped: number }> => {
  const media = payload.media ?? []
  if (!media.length) return { payload, dropped: 0 }
  const alive = await Promise.all(
    media.map(async (item) => {
      try {
        const res = await fetch(item.url, { method: 'HEAD', signal })
        return res.status !== 400 && res.status !== 404
      } catch (err) {
        if (signal?.aborted) throw err
        return true
      }
    })
  )
  const kept = media.filter((_, i) => alive[i])
  return { payload: { ...payload, media: kept }, dropped: media.length - kept.length }
}

export const EXPIRED_DRAFT_MEDIA_MESSAGE =
  'Some photos or videos in your saved draft expired. Add them again before you publish.'

export const hasLocalDraftForUniversity = (slug: string): boolean => {
  const entry = loadLocalDraft(slug)
  return !!entry && isDraftWorthSaving(entry.payload)
}

// A ?uni prefill alone saves a skeleton draft (university picked, nothing
// else). That is not real progress, so surfaces like the "other drafts"
// notice only count drafts where the user wrote or rated something.
export const hasDraftSubstance = (payload: ReviewDraftPayload | null): boolean => {
  if (!payload) return false
  return (
    payload.rating > 0 ||
    payload.reviewText.trim().length > 0 ||
    payload.pros.trim().length > 0 ||
    payload.cons.trim().length > 0 ||
    payload.program.trim().length > 0 ||
    payload.newUniName.trim().length > 0 ||
    Object.keys(payload.subscores).length > 0 ||
    payload.selectedTags.length > 0
  )
}
