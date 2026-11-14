import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateComment, deleteComment } from './commentManage'

const { rpc, single } = vi.hoisted(() => ({ rpc: vi.fn(), single: vi.fn() }))
vi.mock('./supabaseClient', () => ({ supabase: { rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  rpc.mockReturnValue({ single })
})

describe('comment management', () => {
  it('sends only the comment id and trimmed text, and returns the committed row', async () => {
    const row = { id: 'c1', text: 'Updated', edited_at: '2026-11-14' }
    single.mockResolvedValue({ data: row, error: null })
    expect(await updateComment('c1', ' Updated\n')).toEqual(row)
    expect(rpc).toHaveBeenCalledWith('edit_comment', { p_comment_id: 'c1', p_text: 'Updated' })
  })

  it.each(['', ' \n\t', 'a'.repeat(2001)])(
    'rejects invalid text before making a request',
    async (text) => {
      await expect(updateComment('c1', text)).rejects.toThrow('between 1 and 2000')
      expect(rpc).not.toHaveBeenCalled()
    }
  )

  it('uses the deletion RPC rather than deleting table rows', async () => {
    const row = { id: 'c1', text: 'Comment deleted', deleted_at: '2026-11-14' }
    single.mockResolvedValue({ data: row, error: null })
    expect(await deleteComment('c1')).toEqual(row)
    expect(rpc).toHaveBeenCalledWith('delete_comment', { p_comment_id: 'c1' })
  })

  it('surfaces permission and unavailable errors without claiming success', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'Comment unavailable' } })
    await expect(deleteComment('other')).rejects.toThrow('Comment unavailable')
    single.mockResolvedValue({ data: null, error: null })
    await expect(updateComment('missing', 'text')).rejects.toThrow('Comment unavailable')
  })
})
