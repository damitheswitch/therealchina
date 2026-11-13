import { supabase } from './supabaseClient'

export type CommentDraft = {
  reviewId: string
  userId: string
  parentId: string | null
  text: string
}

export type CommentAttempt = { key: string; id: string }

// Postgres unique_violation. On comments the only unique key is the primary
// key, so this means "a row with this id already landed".
const UNIQUE_VIOLATION = '23505'

const draftKey = (d: CommentDraft) => `${d.reviewId}|${d.parentId ?? ''}|${d.text}`

// Reuse the previous attempt's id while the user resubmits the same draft, so
// a retry after a lost response cannot create a second row. Any change to the
// draft gets a fresh id.
export const nextCommentAttempt = (
  prev: CommentAttempt | null,
  draft: CommentDraft,
  newId: () => string = () => crypto.randomUUID()
): CommentAttempt => {
  const key = draftKey(draft)
  return prev?.key === key ? prev : { key, id: newId() }
}

// Idempotent insert: the id is generated client-side, and a duplicate-key
// error means an earlier attempt with the same id already saved the comment.
export const postComment = async (draft: CommentDraft, id: string): Promise<void> => {
  const { error } = await supabase.from('comments').insert({
    id,
    review_id: draft.reviewId,
    user_id: draft.userId,
    parent_id: draft.parentId,
    text: draft.text,
  })
  if (error && error.code !== UNIQUE_VIOLATION) throw error
}
