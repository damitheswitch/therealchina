import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'
import type { CommunityAnswer, CommunityAuthor, CommunityQuestion } from './community'

// Live Community Q&A data. All reads hit the qa_*_public views — the base
// tables are not client-readable, so anonymous authorship is masked in the
// database. All writes go through community-submit (authenticated +
// onboarded + rate limited) or the vote/accept/notify RPCs.

interface QuestionRow {
  id: string
  slug: string
  title: string
  body: string
  category: string
  city: string | null
  university_id: string | null
  university_name: string | null
  university_slug: string | null
  author_id: string | null
  is_author: boolean
  notify_on_answer: boolean | null
  accepted_answer_id: string | null
  created_at: string
  answer_count: number
  upvote_count: number
  viewer_upvoted: boolean
}

interface AnswerRow {
  id: string
  question_id: string
  body: string
  author_id: string | null
  is_author: boolean
  created_at: string
  upvote_count: number
  viewer_upvoted: boolean
  accepted: boolean
}

const QUESTION_COLS =
  'id, slug, title, body, category, city, university_name, university_slug, author_id, is_author, notify_on_answer, accepted_answer_id, created_at, answer_count, upvote_count, viewer_upvoted'
const ANSWER_COLS =
  'id, question_id, body, author_id, is_author, created_at, upvote_count, viewer_upvoted, accepted'

export const timeAgo = (iso: string, now: number = Date.now()): string => {
  const hours = Math.max(0, (now - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export const bodyToParagraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

const excerptOf = (body: string, max = 180): string => {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat
}

const hoursAgo = (iso: string, now: number = Date.now()): number =>
  Math.max(0, (now - new Date(iso).getTime()) / 3_600_000)

// Batch-resolve display names for the non-anonymous authors in a result set.
const fetchAuthors = async (ids: string[]): Promise<Map<string, CommunityAuthor>> => {
  const map = new Map<string, CommunityAuthor>()
  if (ids.length === 0) return map
  const { data, error } = await supabase
    .from('profile_public')
    .select('id, display_name')
    .in('id', ids)
  if (error) throw error
  for (const p of data ?? []) {
    if (p.id) map.set(p.id, { id: p.id, displayName: p.display_name ?? 'Member' })
  }
  return map
}

const mapQuestion = (
  row: QuestionRow,
  authors: Map<string, CommunityAuthor>
): CommunityQuestion => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  excerpt: excerptOf(row.body),
  body: bodyToParagraphs(row.body),
  category: row.category,
  city: row.city ?? undefined,
  university:
    row.university_name && row.university_slug
      ? { name: row.university_name, slug: row.university_slug }
      : undefined,
  author: row.author_id ? (authors.get(row.author_id) ?? null) : null,
  postedHoursAgo: hoursAgo(row.created_at),
  ago: timeAgo(row.created_at),
  upvotes: row.upvote_count,
  answerCount: row.answer_count,
  acceptedAnswerId: row.accepted_answer_id,
  mine: row.is_author,
  // Present only for the author — drives the notifications toggle.
  notifyOnAnswer: row.notify_on_answer ?? undefined,
  viewerUpvoted: row.viewer_upvoted,
})

const mapAnswer = (row: AnswerRow, authors: Map<string, CommunityAuthor>): CommunityAnswer => ({
  id: row.id,
  author: row.author_id ? (authors.get(row.author_id) ?? null) : null,
  body: bodyToParagraphs(row.body),
  postedHoursAgo: hoursAgo(row.created_at),
  ago: timeAgo(row.created_at),
  upvotes: row.upvote_count,
  accepted: row.accepted,
  mine: row.is_author,
  viewerUpvoted: row.viewer_upvoted,
})

// The whole feed in one query (one view row per live question). Category
// filtering stays client-side — the same list also drives the rail counts.
export const fetchCommunityQuestions = async (): Promise<CommunityQuestion[]> => {
  const { data, error } = await supabase
    .from('qa_questions_public')
    .select(QUESTION_COLS)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = (data ?? []) as QuestionRow[]
  const authors = await fetchAuthors([
    ...new Set(rows.map((r) => r.author_id).filter((id): id is string => !!id)),
  ])
  return rows.map((r) => mapQuestion(r, authors))
}

export const fetchCommunityQuestion = async (
  slug: string
): Promise<{ question: CommunityQuestion; answers: CommunityAnswer[] } | null> => {
  const { data: question, error } = await supabase
    .from('qa_questions_public')
    .select(QUESTION_COLS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!question) return null
  const q = question as QuestionRow

  const { data: answers, error: answersError } = await supabase
    .from('qa_answers_public')
    .select(ANSWER_COLS)
    .eq('question_id', q.id)
    .order('created_at', { ascending: true })
  if (answersError) throw answersError
  const aRows = (answers ?? []) as AnswerRow[]

  const authors = await fetchAuthors(
    [q.author_id, ...aRows.map((a) => a.author_id)].filter((id): id is string => !!id)
  )
  return { question: mapQuestion(q, authors), answers: aRows.map((a) => mapAnswer(a, authors)) }
}

// ---- writes (all through community-submit / RPCs) ----

interface FunctionResult {
  data: unknown
  error: unknown
}

const invokeSubmit = async (payload: Record<string, unknown>) => {
  const { data, error } = (await supabase.functions.invoke('community-submit', {
    body: payload,
  })) as FunctionResult
  if (error) throw new Error(await parseFunctionError(error))
  return data as Record<string, unknown>
}

export const submitQuestion = async (input: {
  title: string
  body: string
  category: string
  city?: string
  universitySlug?: string
  anonymous: boolean
  notifyOnAnswer: boolean
}): Promise<{ slug: string }> => {
  const data = await invokeSubmit({ action: 'question', ...input })
  return { slug: data.slug as string }
}

export const submitAnswer = async (input: {
  questionSlug: string
  body: string
  anonymous: boolean
}): Promise<{ id: string }> => {
  const data = await invokeSubmit({ action: 'answer', ...input })
  return { id: data.id as string }
}

export const submitReport = async (input: {
  targetType: 'question' | 'answer'
  targetId: string
  reason?: string
}): Promise<void> => {
  await invokeSubmit({ action: 'report', ...input })
}

export const toggleQuestionUpvote = async (
  questionId: string
): Promise<{ upvoted: boolean; upvoteCount: number }> => {
  const { data, error } = await supabase.rpc('toggle_question_upvote', {
    p_question_id: questionId,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { upvoted: !!row?.upvoted, upvoteCount: row?.upvote_count ?? 0 }
}

export const toggleAnswerUpvote = async (
  answerId: string
): Promise<{ upvoted: boolean; upvoteCount: number }> => {
  const { data, error } = await supabase.rpc('toggle_answer_upvote', {
    p_answer_id: answerId,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return { upvoted: !!row?.upvoted, upvoteCount: row?.upvote_count ?? 0 }
}

export const setAcceptedAnswer = async (
  questionId: string,
  answerId: string | null
): Promise<void> => {
  const { error } = await supabase.rpc('set_accepted_answer', {
    p_question_id: questionId,
    // The generated Args type marks p_answer_id non-nullable; the function
    // accepts NULL to clear the mark.
    p_answer_id: answerId!,
  })
  if (error) throw error
}

export const setQuestionNotify = async (questionId: string, enabled: boolean): Promise<void> => {
  const { error } = await supabase.rpc('set_question_notify', {
    p_question_id: questionId,
    p_enabled: enabled,
  })
  if (error) throw error
}
