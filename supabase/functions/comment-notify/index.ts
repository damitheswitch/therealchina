// Supabase Edge Function: comment-notify
// Sends the review owner an email when someone comments on their review.
// Invoked only by the comments INSERT trigger via pg_net — never by browsers —
// so auth is a shared secret header (COMMENT_NOTIFY_SECRET) stored in the
// Postgres Vault, not a caller JWT. Missing/mismatched secret: fail closed.
//
// Notification rules:
//   - anonymous reviews (user_id IS NULL): no email. reviewer_context emails
//     are promised "only used if you want early access", so they stay untouched.
//   - self-comments never notify.
//   - comments on soft-deleted reviews never notify.
//   - one email per review per owner per 30 minutes, 20 per owner per day.
//   - every outcome lands in comment_email_log (service-role only table).

import { supabaseAdmin, jsonResponse } from '../_shared/guard.ts'

const COMMENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const THROTTLE_MINUTES = 30
const DAILY_CAP = 20
const EXCERPT_LEN = 240

const FROM_EMAIL =
  Deno.env.get('NOTIFY_FROM_EMAIL') || 'The Real China <notifications@therealchina.net>'
const SITE_URL = (Deno.env.get('NOTIFY_SITE_URL') || 'https://www.therealchina.net').replace(
  /\/$/,
  ''
)

type LogStatus = 'sent' | 'skipped' | 'failed'

async function logResult(
  commentId: string,
  reviewId: string,
  recipientUserId: string | null,
  recipientEmail: string | null,
  status: LogStatus,
  detail?: string
) {
  const { error } = await supabaseAdmin.from('comment_email_log').upsert(
    {
      comment_id: commentId,
      review_id: reviewId,
      recipient_user_id: recipientUserId,
      recipient_email: recipientEmail,
      status,
      detail: detail ?? null,
    },
    { onConflict: 'comment_id' }
  )
  if (error) console.error('comment_email_log write failed:', error)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text, html }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`)
  }
}

async function handleNotify(req: Request): Promise<Response> {
  const secret = Deno.env.get('COMMENT_NOTIFY_SECRET')
  if (!secret || req.headers.get('x-notify-secret') !== secret) {
    return jsonResponse(req, { error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }
  const commentId = typeof body.comment_id === 'string' ? body.comment_id : ''
  if (!COMMENT_ID_RE.test(commentId)) {
    return jsonResponse(req, { error: 'comment_id must be a uuid' }, 400)
  }

  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('id, review_id, user_id, text')
    .eq('id', commentId)
    .maybeSingle()
  if (!comment) return jsonResponse(req, { error: 'Comment not found' }, 404)

  const { data: review } = await supabaseAdmin
    .from('reviews')
    .select('id, user_id, university_id, deleted_at')
    .eq('id', comment.review_id)
    .maybeSingle()

  // Claim the comment before doing any work: a duplicate delivery of the same
  // comment_id exits here instead of double-sending.
  const { data: claimed } = await supabaseAdmin
    .from('comment_email_log')
    .insert({
      comment_id: commentId,
      review_id: comment.review_id,
      status: 'pending',
    })
    .select('comment_id')
    .maybeSingle()
  if (!claimed) return jsonResponse(req, { ok: true, skipped: 'already_processed' }, 200)

  const skip = async (reason: string) => {
    await logResult(commentId, comment.review_id, review?.user_id ?? null, null, 'skipped', reason)
    return jsonResponse(req, { ok: true, skipped: reason }, 200)
  }

  if (!review || review.deleted_at) return skip('review_deleted')
  if (!review.user_id) return skip('anonymous_review')
  if (review.user_id === comment.user_id) return skip('self_comment')

  // Throttle: at most one email per review+owner per window, plus a daily cap.
  const windowStart = new Date(Date.now() - THROTTLE_MINUTES * 60_000).toISOString()
  const { count: recentForReview } = await supabaseAdmin
    .from('comment_email_log')
    .select('comment_id', { count: 'exact', head: true })
    .eq('review_id', review.id)
    .eq('recipient_user_id', review.user_id)
    .eq('status', 'sent')
    .gte('created_at', windowStart)
  if ((recentForReview ?? 0) > 0) return skip('throttled')

  const dayStart = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { count: todayForOwner } = await supabaseAdmin
    .from('comment_email_log')
    .select('comment_id', { count: 'exact', head: true })
    .eq('recipient_user_id', review.user_id)
    .eq('status', 'sent')
    .gte('created_at', dayStart)
  if ((todayForOwner ?? 0) >= DAILY_CAP) return skip('daily_cap')

  const {
    data: { user: owner },
    error: ownerError,
  } = await supabaseAdmin.auth.admin.getUserById(review.user_id)
  if (ownerError || !owner?.email) return skip('no_owner_email')

  const [{ data: commenter }, { data: university }] = await Promise.all([
    supabaseAdmin.from('profiles').select('display_name').eq('id', comment.user_id).maybeSingle(),
    supabaseAdmin.from('universities').select('name, slug').eq('id', review.university_id).single(),
  ])
  const uniName = university?.name || 'the university'
  const uniSlug = university?.slug || ''
  const commenterName = commenter?.display_name || 'Someone'
  const excerpt =
    comment.text.length > EXCERPT_LEN ? `${comment.text.slice(0, EXCERPT_LEN)}…` : comment.text
  const link = `${SITE_URL}/university/${uniSlug}/`

  const subject = `${commenterName} commented on your ${uniName} review`
  const text = [
    `Hi,`,
    ``,
    `${commenterName} left a comment on your review of ${uniName}:`,
    ``,
    `"${excerpt}"`,
    ``,
    `Read the thread and reply: ${link}`,
    ``,
    `The Real China`,
  ].join('\n')
  const html = `<p>Hi,</p>
<p><strong>${escapeHtml(commenterName)}</strong> left a comment on your review of <strong>${escapeHtml(
    uniName
  )}</strong>:</p>
<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #ccc;color:#444;">${escapeHtml(
    excerpt
  )}</blockquote>
<p><a href="${link}">Read the thread and reply</a></p>
<p style="color:#888;font-size:12px;">The Real China</p>`

  try {
    await sendEmail(owner.email, subject, text, html)
  } catch (err) {
    await logResult(
      commentId,
      review.id,
      review.user_id,
      owner.email,
      'failed',
      err instanceof Error ? err.message : 'send failed'
    )
    return jsonResponse(req, { error: 'Email send failed' }, 502)
  }

  await logResult(commentId, review.id, review.user_id, owner.email, 'sent')
  return jsonResponse(req, { ok: true, sent: true }, 200)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405)
  }
  try {
    return await handleNotify(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
