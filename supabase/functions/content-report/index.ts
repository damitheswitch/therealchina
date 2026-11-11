// Supabase Edge Function: content-report
// Signed-in users flag a review or a comment. Reports land in the private
// content_reports table (service role only) and the owner gets an alert
// email (REPORT_ALERT_EMAIL). One report per user per target; repeat reports
// succeed quietly without a second alert. Rate limited per user, fails closed.

import {
  supabaseAdmin,
  getCaller,
  checkRateLimit,
  corsHeaders,
  jsonResponse,
} from '../_shared/guard.ts'
import { SITE_URL, sendOwnerAlert } from '../_shared/alert.ts'
import { parseReport } from './validate.ts'

const REPORT_LIMIT_PER_HOUR = 30

async function describeTarget(
  targetType: 'review' | 'comment',
  targetId: string
): Promise<{ reviewId: string; excerpt: string; link: string } | null> {
  let reviewId = targetId
  let excerpt = ''

  if (targetType === 'comment') {
    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('id, review_id, text')
      .eq('id', targetId)
      .maybeSingle()
    if (!comment) return null
    reviewId = comment.review_id
    excerpt = comment.text
  }

  const { data: review } = await supabaseAdmin
    .from('reviews')
    .select('id, text, university_id, deleted_at')
    .eq('id', reviewId)
    .maybeSingle()
  if (!review || review.deleted_at) return null
  if (targetType === 'review') excerpt = review.text

  const { data: uni } = await supabaseAdmin
    .from('universities')
    .select('slug')
    .eq('id', review.university_id)
    .maybeSingle()
  const link = uni?.slug ? `${SITE_URL}/university/${uni.slug}/` : SITE_URL
  return { reviewId, excerpt: excerpt.slice(0, 400), link }
}

async function handleReport(req: Request): Promise<Response> {
  const caller = await getCaller(req)
  if (!caller || caller.role !== 'authenticated' || !caller.sub) {
    return jsonResponse(req, { error: 'Sign in to report content.' }, 401)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON body' }, 400)
  }

  const parsed = parseReport(body)
  if ('error' in parsed) return jsonResponse(req, { error: parsed.error }, 400)

  if (!(await checkRateLimit(`report:${caller.sub}`, REPORT_LIMIT_PER_HOUR))) {
    return jsonResponse(req, { error: 'Too many reports. Try again later.' }, 429)
  }

  const target = await describeTarget(parsed.targetType, parsed.targetId)
  if (!target) return jsonResponse(req, { error: 'That content no longer exists.' }, 404)

  const { error } = await supabaseAdmin.from('content_reports').insert({
    reporter_id: caller.sub,
    review_id: parsed.targetType === 'review' ? parsed.targetId : null,
    comment_id: parsed.targetType === 'comment' ? parsed.targetId : null,
    reason: parsed.reason,
  })

  // 23505 = this user already reported it: the flag is recorded, no new alert.
  if (error?.code === '23505') return jsonResponse(req, { ok: true }, 200)
  if (error) {
    console.error('Report insert error:', error)
    return jsonResponse(req, { error: 'Could not send that. Please try again.' }, 500)
  }

  await sendOwnerAlert(`Reported ${parsed.targetType} on The Real China`, [
    `A signed-in user reported a ${parsed.targetType}.`,
    ``,
    `Reason: ${parsed.reason ?? '(none given)'}`,
    `${parsed.targetType === 'review' ? 'Review' : 'Comment'} id: ${parsed.targetId}`,
    `Review id: ${target.reviewId}`,
    `Reporter id: ${caller.sub}`,
    ``,
    `Excerpt:`,
    target.excerpt,
    ``,
    `Page: ${target.link}`,
  ])

  return jsonResponse(req, { ok: true }, 200)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(req.headers.get('origin') ?? undefined),
    })
  }
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405)
  }
  try {
    return await handleReport(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
