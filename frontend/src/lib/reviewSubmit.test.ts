import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { supabase } from './supabaseClient'
import { ReviewSubmitError, submitReview } from './reviewSubmit'

const invoke = vi.mocked(supabase.functions.invoke)

describe('submitReview errors', () => {
  it('preserves the HTTP status for analytics classification', async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: new Response(JSON.stringify({ error: 'Rejected' }), { status: 429 }),
      },
    })

    await expect(submitReview({ rating: 4, text: 'A useful review' })).rejects.toMatchObject({
      name: 'ReviewSubmitError',
      message: 'Rejected',
      status: 429,
    })
    await expect(ReviewSubmitError.prototype).toBeInstanceOf(Error)
  })
})
