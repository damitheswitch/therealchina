// Thank-you gift plumbing shared by review-submit, review-boost and
// review-manage. Best effort by design: a gift problem is logged and reported
// back as a state, and never fails the review save that triggered it.
//
// Flow: review-submit calls requestReward() when the reviewer asked for the
// gift, then every save path calls maybeDispatchReward(). The email goes out
// the first time the review is "full" (server-checked in reward.ts).

import { supabaseAdmin } from './guard.ts'
import { SITE_URL } from './alert.ts'
import {
  evaluateReward,
  newRewardCode,
  normalizeEmail,
  type RewardMissing,
  type RewardReviewRow,
} from './reward.ts'
import { buildRewardEmail } from './rewardEmail.ts'

export type RewardState =
  'off' | 'waiting' | 'sent' | 'email_used' | 'email_blocked' | 'failed' | 'paused' | 'declined'

export interface RewardResult {
  state: RewardState
  code?: string
  missing?: RewardMissing[]
}

const FROM_EMAIL =
  Deno.env.get('NOTIFY_FROM_EMAIL') || 'The Real China <notifications@therealchina.net>'
const SUPPORT_EMAIL = Deno.env.get('REWARD_SUPPORT_EMAIL') || 'nihao@therealchina.net'

async function emailKey(email: string): Promise<string | null> {
  const secret = Deno.env.get('REWARD_HASH_SECRET')
  if (!secret) return null
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalizeEmail(email)))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function rewardEnabled(): boolean {
  return (
    Deno.env.get('REWARD_ENABLED') === 'true' &&
    Boolean(Deno.env.get('REWARD_WECHAT_ID')) &&
    Boolean(Deno.env.get('REWARD_HASH_SECRET')) &&
    Boolean(Deno.env.get('RESEND_API_KEY'))
  )
}

// Creates the bookkeeping row for a review whose author asked for the gift.
// Returns the gift code, or null when the row could not be created.
export async function requestReward(
  reviewId: string,
  authKind: 'anonymous' | 'signed_in',
  userId: string | null
): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newRewardCode()
    const { error } = await supabaseAdmin.from('review_rewards').insert({
      review_id: reviewId,
      auth_kind: authKind,
      user_id: userId,
      reward_code: code,
    })
    if (!error) return code
    if (error.code !== '23505') {
      console.error('Reward request insert error:', error)
      return null
    }
    // 23505 is either a code collision (retry) or an existing row for this review.
    const { data } = await supabaseAdmin
      .from('review_rewards')
      .select('reward_code')
      .eq('review_id', reviewId)
      .maybeSingle()
    if (data?.reward_code) return data.reward_code as string
  }
  return null
}

const REVIEW_COLUMNS =
  'deleted_at, text, pros, cons, tags, program, degree_level, rating_academics, rating_campus, rating_accommodation, rating_cost, rating_intl_office, rating_social, rating_extracurricular, rating_career, tuition_range, living_cost_range, funding_type, enrollment_status, start_year, end_year, language_of_instruction, media'

function stateFromStatus(status: string, code: string): RewardResult {
  switch (status) {
    case 'sent':
    case 'contacted':
    case 'fulfilled':
      return { state: 'sent', code }
    case 'email_used':
      return { state: 'email_used', code }
    case 'email_blocked':
      return { state: 'email_blocked', code }
    case 'declined':
      return { state: 'declined', code }
    case 'failed':
      return { state: 'failed', code }
    case 'expired':
      return { state: 'off' }
    default:
      return { state: 'waiting', code }
  }
}

async function resolveEmail(
  reviewId: string,
  authKind: string,
  userId: string | null
): Promise<string | null> {
  if (authKind === 'signed_in' && userId) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !data?.user?.email || !data.user.email_confirmed_at) return null
    return data.user.email
  }
  const { data } = await supabaseAdmin
    .from('reviewer_context')
    .select('email')
    .eq('review_id', reviewId)
    .maybeSingle()
  return (data?.email as string | null) ?? null
}

async function sendRewardEmail(to: string, code: string): Promise<string | null> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const wechatId = Deno.env.get('REWARD_WECHAT_ID')
  if (!apiKey || !wechatId) return null
  const email = buildRewardEmail({
    code,
    wechatId,
    ownerName: Deno.env.get('REWARD_OWNER_NAME') || 'The TRC team',
    discountText: Deno.env.get('REWARD_DISCOUNT_TEXT') || '',
    supportEmail: SUPPORT_EMAIL,
    siteUrl: SITE_URL,
  })
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: SUPPORT_EMAIL,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: {
          'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}?subject=delete>`,
        },
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.error(`Reward email failed: Resend ${res.status}`)
      return null
    }
    const json = await res.json().catch(() => ({}))
    return typeof json.id === 'string' ? json.id : 'sent'
  } catch (err) {
    console.error('Reward email failed:', err)
    return null
  }
}

// Checks whether the review is full and, the first time it is, sends the gift
// email. Safe to call after every save: it is a no-op once the gift is sent.
export async function maybeDispatchReward(reviewId: string): Promise<RewardResult> {
  try {
    const { data: row, error: rowError } = await supabaseAdmin
      .from('review_rewards')
      .select('status, reward_code, auth_kind, user_id')
      .eq('review_id', reviewId)
      .maybeSingle()
    if (rowError || !row) return { state: 'off' }

    const code = row.reward_code as string
    const status = row.status as string
    if (!['waiting', 'failed', 'sending'].includes(status)) {
      return stateFromStatus(status, code)
    }
    if (!rewardEnabled()) return { state: 'paused', code }

    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select(REVIEW_COLUMNS)
      .eq('id', reviewId)
      .maybeSingle()
    if (reviewError || !review) return { state: 'off' }

    const evaluation = evaluateReward(review as unknown as RewardReviewRow)
    if (!evaluation.full) return { state: 'waiting', code, missing: evaluation.missing }

    const email = await resolveEmail(
      reviewId,
      row.auth_kind as string,
      (row.user_id as string | null) ?? null
    )
    if (!email) return { state: 'waiting', code }

    const { data: allowed } = await supabaseAdmin.rpc('is_email_allowed', {
      p_email: email,
    })
    if (allowed === false) {
      await supabaseAdmin
        .from('review_rewards')
        .update({ status: 'email_blocked' })
        .eq('review_id', reviewId)
      return { state: 'email_blocked', code }
    }

    const key = await emailKey(email)
    if (!key) return { state: 'paused', code }

    const { data: verdict, error: rpcError } = await supabaseAdmin.rpc('dispatch_review_reward', {
      p_review_id: reviewId,
      p_email_key: key,
      p_own_text: evaluation.ownText,
      p_own_words: evaluation.ownUnits,
      p_areas: evaluation.areas,
    })
    if (rpcError) {
      console.error('Reward dispatch RPC error:', rpcError)
      return { state: 'failed', code }
    }
    if (verdict === 'email_used') return { state: 'email_used', code }
    if (verdict === 'duplicate_text') return { state: 'declined', code }
    if (verdict !== 'send') {
      const { data: again } = await supabaseAdmin
        .from('review_rewards')
        .select('status')
        .eq('review_id', reviewId)
        .maybeSingle()
      return stateFromStatus((again?.status as string) ?? 'waiting', code)
    }

    const resendId = await sendRewardEmail(email, code)
    if (!resendId) {
      await supabaseAdmin
        .from('review_rewards')
        .update({ status: 'failed' })
        .eq('review_id', reviewId)
      return { state: 'failed', code }
    }
    await supabaseAdmin
      .from('review_rewards')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_id: resendId,
      })
      .eq('review_id', reviewId)
    return { state: 'sent', code }
  } catch (err) {
    console.error('Reward dispatch error:', err)
    return { state: 'failed' }
  }
}
