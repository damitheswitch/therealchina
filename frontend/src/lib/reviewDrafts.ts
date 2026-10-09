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
  media: MediaItem[]
  homeCountry: string
  currentStatus: string
  languagesSpoken: string[]
  emailConsent: boolean
  anonEmail: string
}

const LOCAL_DRAFT_KEY = 'trc_review_draft'

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

export const loadLocalDraft = (): ReviewDraftPayload | null => {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReviewDraftPayload
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed
  } catch {
    return null
  }
}

export const saveLocalDraft = (payload: ReviewDraftPayload): void => {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(payload))
  } catch (err) {
    // Storage may be full or disabled; this is a best-effort fallback.
    console.error('Could not save local draft:', err)
  }
}

export const clearLocalDraft = (): void => {
  try {
    localStorage.removeItem(LOCAL_DRAFT_KEY)
  } catch {
    // Ignore
  }
}

export const hasLocalDraftForUniversity = (slug: string): boolean => {
  const draft = loadLocalDraft()
  if (!isDraftWorthSaving(draft)) return false
  return draft?.selectedUni === slug
}
