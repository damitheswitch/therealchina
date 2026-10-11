import { describe, it, expect, vi, beforeEach } from 'vitest'
import { boostReview } from './reviewBoost'
import { storeBoostToken, createBoostToken } from './reviewClaim'

const invokeMock = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: invokeMock } },
}))

const REVIEW_ID = '11111111-2222-4333-8444-555555555555'

beforeEach(() => {
  localStorage.clear()
  invokeMock.mockReset()
})

describe('boostReview', () => {
  it('sends reviewId, the per-review token, and the field patch', async () => {
    const token = createBoostToken()!
    storeBoostToken(REVIEW_ID, token)
    invokeMock.mockResolvedValue({ data: { saved: true }, error: null })

    await boostReview(REVIEW_ID, { program: 'MBBS', startYear: 2023 })

    expect(invokeMock).toHaveBeenCalledWith('review-boost', {
      body: {
        reviewId: REVIEW_ID,
        boostToken: token,
        fields: { program: 'MBBS', startYear: 2023 },
      },
    })
  })

  it('fails closed when the browser holds no token for the review', async () => {
    await expect(boostReview(REVIEW_ID, { program: 'MBBS' })).rejects.toThrow(
      "can't be edited from this device"
    )
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('surfaces the function error message', async () => {
    storeBoostToken(REVIEW_ID, createBoostToken()!)
    invokeMock.mockResolvedValue({ data: null, error: { message: 'window closed' } })

    await expect(boostReview(REVIEW_ID, { pros: 'x' })).rejects.toThrow()
  })
})
