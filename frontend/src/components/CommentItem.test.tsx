import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentItem } from './CommentItem'
import type { Tables } from '../types/database.types'

type Comment = Tables<'comments'>
type HarnessProps = { comment?: Comment; onChanged?: (row: Comment) => void; isOwner?: boolean }

const { updateComment, deleteComment, showToast } = vi.hoisted(() => ({
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  showToast: vi.fn(),
}))
vi.mock('../lib/commentManage', () => ({ updateComment, deleteComment }))
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }))
vi.mock('./ReportButton', () => ({ ReportButton: () => null }))

const base: Comment = {
  id: 'c1',
  review_id: 'r1',
  user_id: 'u1',
  parent_id: null,
  text: 'Original text',
  created_at: null,
  edited_at: null,
  deleted_at: null,
}
const renderItem = (props: HarnessProps = {}) =>
  render(
    <MemoryRouter>
      <Harness {...props} />
    </MemoryRouter>
  )

const Harness = ({
  comment: initialComment = base,
  onChanged = vi.fn(),
  isOwner = true,
}: HarnessProps) => {
  const [comment, setComment] = useState(initialComment)
  return (
    <CommentItem
      comment={comment}
      profile={undefined}
      isOwner={isOwner}
      onChanged={(row) => {
        onChanged(row)
        setComment(row)
      }}
    />
  )
}

beforeEach(() => vi.clearAllMocks())

describe('CommentItem', () => {
  it('shows edit and delete controls only to the owner', () => {
    const { rerender } = renderItem()
    expect(screen.getByRole('button', { name: 'Edit comment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete comment' })).toBeInTheDocument()
    rerender(
      <MemoryRouter>
        <CommentItem comment={base} profile={undefined} isOwner={false} onChanged={vi.fn()} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete comment' })).not.toBeInTheDocument()
  })

  it('keeps the draft and editor open when saving fails', async () => {
    updateComment.mockRejectedValueOnce(new Error('Could not update'))
    renderItem()
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment' }), {
      target: { value: 'My draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Could not update', 'error'))
    expect(screen.getByRole('textbox', { name: 'Edit comment' })).toHaveValue('My draft')
  })

  it('applies the returned row after a successful save', async () => {
    const updated = { ...base, text: 'Saved text', edited_at: '2026-01-01' }
    updateComment.mockResolvedValueOnce(updated)
    const onChanged = vi.fn()
    renderItem({ onChanged })
    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment' }), {
      target: { value: 'Saved text' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated))
    expect(screen.getByText(/Saved text/)).toBeInTheDocument()
  })

  it('confirms deletion and displays a tombstone while replies remain managed by the parent', async () => {
    const deleted = { ...base, text: '', deleted_at: '2026-01-01' }
    deleteComment.mockResolvedValueOnce(deleted)
    const onChanged = vi.fn()
    renderItem({ onChanged })
    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Delete this comment? Your text will be removed. Replies will stay.'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(deleted))
    expect(screen.getByText('Comment deleted')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument()
  })

  it('renders deleted comments without author or action controls', () => {
    renderItem({ comment: { ...base, text: '', deleted_at: '2026-01-01' } })
    expect(screen.getByText('Comment deleted')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument()
  })
})
