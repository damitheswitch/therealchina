import { supabase } from './supabaseClient'
import { parseFunctionError } from './mediaUpload'

// Reports on reviews and comments go through the content-report Edge
// Function (signed-in only, rate limited). Q&A reports use community-submit.
export type ReportTargetType = 'review' | 'comment'

export const submitContentReport = async (input: {
  targetType: ReportTargetType
  targetId: string
  reason?: string
}): Promise<void> => {
  const { error } = await supabase.functions.invoke('content-report', { body: input })
  if (error) throw new Error(await parseFunctionError(error))
}
