import { supabase } from './supabaseClient'
import type { Tables } from '../types/database.types'

export type CommentRow = Tables<'comments'>

export const updateComment = async (commentId: string, text: string): Promise<CommentRow> => {
  const trimmed = text.trim()
  if (!trimmed || Array.from(trimmed).length > 2000) {
    throw new Error('Comment must be between 1 and 2000 characters')
  }
  const { data, error } = await supabase
    .rpc('edit_comment', { p_comment_id: commentId, p_text: trimmed })
    .single()
  if (error) throw new Error(error.message || 'Could not update comment. Try again.')
  if (!data) throw new Error('Comment unavailable')
  return data
}

export const deleteComment = async (commentId: string): Promise<CommentRow> => {
  const { data, error } = await supabase.rpc('delete_comment', { p_comment_id: commentId }).single()
  if (error) throw new Error(error.message || 'Could not delete comment. Try again.')
  if (!data) throw new Error('Comment unavailable')
  return data
}
