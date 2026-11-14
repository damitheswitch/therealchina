import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentSection } from './CommentSection'
import type { Tables } from '../types/database.types'

const { useComments, useAuth, showToast, updateComment, deleteComment, insert } = vi.hoisted(
  () => ({
    useComments: vi.fn(),
    useAuth: vi.fn(),
    showToast: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    insert: vi.fn(),
  })
)
vi.mock('../hooks/useComments', () => ({ useComments }))
vi.mock('../contexts/AuthContext', () => ({ useAuth }))
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }))
vi.mock('../lib/commentManage', () => ({ updateComment, deleteComment }))
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: () => ({ insert }) } }))
vi.mock('./ReportButton', () => ({ ReportButton: () => null }))

type Comment = Tables<'comments'>
const parent: Comment = {
  id: 'c1',
  review_id: 'r1',
  user_id: 'u1',
  parent_id: null,
  text: 'Parent text',
  created_at: null,
  edited_at: null,
  deleted_at: null,
}
const reply: Comment = {
  id: 'c2',
  review_id: 'r1',
  user_id: 'u2',
  parent_id: 'c1',
  text: 'Reply stays',
  created_at: null,
  edited_at: null,
  deleted_at: null,
}
let initialRows: Comment[]

const CommentListHook = () => {
  const [comments, setComments] = useState(initialRows)
  return {
    comments,
    authorProfiles: {},
    loaded: true,
    refetch: vi.fn(),
    applyComment: (row: Comment) =>
      setComments((previous) => previous.map((item) => (item.id === row.id ? row : item))),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  initialRows = [parent, reply]
  useAuth.mockReturnValue({ user: { id: 'u1' } })
  useComments.mockImplementation(CommentListHook)
})

describe('CommentSection management controls', () => {
  it('keeps replies visible when the owner deletes a parent and updates the visible count', async () => {
    deleteComment.mockResolvedValueOnce({ ...parent, text: '', deleted_at: '2026-11-14' })
    render(<CommentSection reviewId="r1" initialCount={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Comments (2)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByText('Comment deleted')).toBeInTheDocument())
    expect(screen.getByText('Reply stays')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Comments (1)' })).toBeInTheDocument()
  })

  it('does not apply an old account mutation or show its toast after the account changes', async () => {
    let resolveUpdate!: (row: Comment) => void
    updateComment.mockReturnValueOnce(
      new Promise<Comment>((resolve) => {
        resolveUpdate = resolve
      })
    )
    const { rerender } = render(<CommentSection reviewId="r1" initialCount={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Comments (2)' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit comment' })[0])
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment' }), {
      target: { value: 'Pending edit' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateComment).toHaveBeenCalledOnce())
    useAuth.mockReturnValue({ user: { id: 'u2' } })
    rerender(<CommentSection reviewId="r1" initialCount={2} />)
    await act(async () => {
      resolveUpdate({ ...parent, text: 'Pending edit', edited_at: '2026-11-14' })
      await Promise.resolve()
    })
    expect(showToast).not.toHaveBeenCalled()
  })

  it('keeps a committed edit when the thread is collapsed while the request is pending', async () => {
    let resolveUpdate!: (row: Comment) => void
    updateComment.mockReturnValueOnce(
      new Promise<Comment>((resolve) => {
        resolveUpdate = resolve
      })
    )
    render(<CommentSection reviewId="r1" initialCount={2} />)
    fireEvent.click(screen.getByRole('button', { name: 'Comments (2)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment' }), {
      target: { value: 'Saved while collapsed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByRole('button', { name: 'Comments (2)' }))
    await act(async () => {
      resolveUpdate({ ...parent, text: 'Saved while collapsed' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Comments (2)' }))
    expect(screen.getByText('Saved while collapsed')).toBeInTheDocument()
  })
})
