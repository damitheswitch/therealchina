import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextCommentAttempt, postComment, type CommentDraft } from './commentSubmit'

const insertMock = vi.hoisted(() => vi.fn())
vi.mock('./supabaseClient', () => ({
  supabase: { from: () => ({ insert: insertMock }) },
}))

const draft: CommentDraft = {
  reviewId: 'r1',
  userId: 'u1',
  parentId: null,
  text: 'Great review',
}

beforeEach(() => insertMock.mockReset())

describe('nextCommentAttempt', () => {
  it('keeps the same id when the same draft is resubmitted', () => {
    const ids = ['a', 'b']
    const newId = () => ids.shift() as string
    const first = nextCommentAttempt(null, draft, newId)
    const retry = nextCommentAttempt(first, { ...draft }, newId)
    expect(first.id).toBe('a')
    expect(retry.id).toBe('a')
  })

  it('mints a new id when the text, parent or review changes', () => {
    let n = 0
    const newId = () => `id${++n}`
    const first = nextCommentAttempt(null, draft, newId)
    expect(nextCommentAttempt(first, { ...draft, text: 'Edited' }, newId).id).not.toBe(first.id)
    expect(nextCommentAttempt(first, { ...draft, parentId: 'c1' }, newId).id).not.toBe(first.id)
    expect(nextCommentAttempt(first, { ...draft, reviewId: 'r2' }, newId).id).not.toBe(first.id)
  })
})

describe('postComment', () => {
  it('sends the client-generated id with the row', async () => {
    insertMock.mockResolvedValue({ error: null })
    await postComment(draft, 'fixed-id')
    expect(insertMock).toHaveBeenCalledWith({
      id: 'fixed-id',
      review_id: 'r1',
      user_id: 'u1',
      parent_id: null,
      text: 'Great review',
    })
  })

  it('treats a duplicate id as already saved', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } })
    await expect(postComment(draft, 'fixed-id')).resolves.toBeUndefined()
  })

  it('throws any other error', async () => {
    const error = { code: '42501', message: 'permission denied' }
    insertMock.mockResolvedValue({ error })
    await expect(postComment(draft, 'fixed-id')).rejects.toBe(error)
  })
})
