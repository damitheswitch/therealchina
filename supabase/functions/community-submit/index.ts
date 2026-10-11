import {
  corsHeaders,
  jsonResponse,
  getCaller,
  checkRateLimit,
  supabaseAdmin,
  SUPABASE_URL,
} from '../_shared/guard.ts'
import { asTrimmedString } from '../_shared/reviewFields.ts'

// Gated write path for Community Q&A (Phase 6). All three actions require a
// signed-in caller whose profile has completed onboarding — anonymous
// *write* is disabled by owner decision, so no Turnstile is needed here.
// "Post anonymously" is display-only: author_id always records the caller so
// abuse stays traceable for moderation.
//
//   question  → {title, body, category, city?, universitySlug?, anonymous,
//                notifyOnAnswer} → {slug}
//   answer    → {questionSlug, body, anonymous} → {id}
//   report    → {targetType: 'question'|'answer', targetId, reason?} → {}
//
// Rate limits (per authenticated user, shared record_upload_attempt counter):
// questions 10/h, answers 20/h, reports 30/h. Fails closed when the
// limiter is unavailable.

const QA_CATEGORIES = new Set([
  'visas',
  'driving',
  'money',
  'housing',
  'academics',
  'work',
  'health',
  'tech',
  'life',
  'other',
])

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function slugify(title: string): string {
  // Same scheme as review-submit's slugify, capped at 120 to leave room for
  // a numeric suffix inside the 140-char CHECK.
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
  return slug || 'question'
}

async function notifyAnswer(answerId: string) {
  // Queue hop: community-submit is the only write path, so it calls
  // qa-notify directly with the shared secret (no pg_net trigger or Vault
  // entries to provision). A notify failure must not fail the answer —
  // qa-notify already logged it to qa_email_log.
  const secret = Deno.env.get('QA_NOTIFY_SECRET')
  if (!secret) return
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/qa-notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-notify-secret': secret },
      body: JSON.stringify({ answer_id: answerId }),
    })
  } catch (err) {
    console.error('qa-notify dispatch failed:', err)
  }
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

  const caller = await getCaller(req)
  if (!caller || caller.role !== 'authenticated' || !caller.sub) {
    return jsonResponse(req, { error: 'Sign in to post.' }, 401)
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', caller.sub)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    return jsonResponse(req, { error: 'Complete your profile setup first.' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse(req, { error: 'Invalid JSON' }, 400)
  }

  const action = typeof body.action === 'string' ? body.action : ''

  // ---- Post a question ----
  if (action === 'question') {
    const title = asTrimmedString(body.title, 160)
    const text = asTrimmedString(body.body, 5000)
    const category = asTrimmedString(body.category, 40)
    const city = asTrimmedString(body.city, 120)
    const universitySlug = asTrimmedString(body.universitySlug, 140)
    const anonymous = body.anonymous === true
    const notifyOnAnswer = body.notifyOnAnswer !== false // default on

    if (!title || title.length < 10) {
      return jsonResponse(req, { error: 'Give it a title (at least 10 characters).' }, 400)
    }
    if (!text || text.length < 20) {
      return jsonResponse(req, { error: 'Add the details (at least 20 characters).' }, 400)
    }
    if (!category || !QA_CATEGORIES.has(category)) {
      return jsonResponse(req, { error: 'Pick a topic.' }, 400)
    }
    if (universitySlug && (!SLUG_RE.test(universitySlug) || universitySlug.length > 140)) {
      return jsonResponse(req, { error: 'Invalid university.' }, 400)
    }

    if (!(await checkRateLimit(`qa-q:${caller.sub}`, 10))) {
      return jsonResponse(
        req,
        { error: 'Too many questions. Try again in a little while.' },
        429
      )
    }

    let universityId: string | null = null
    if (universitySlug) {
      const { data: uni } = await supabaseAdmin
        .from('universities')
        .select('id')
        .or(`slug.eq.${universitySlug},slug_aliases.cs.{${universitySlug}}`)
        .limit(1)
        .maybeSingle()
      universityId = uni?.id ?? null
      // A name typed but not picked is ignored — the question just stays
      // unlinked rather than failing on a typo.
    }

    const base = slugify(title)
    // Retry on the slug UNIQUE index — suffixes keep links clean when titles
    // collide.
    for (let attempt = 0; attempt < 4; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`
      const { data, error } = await supabaseAdmin
        .from('qa_questions')
        .insert({
          slug,
          title,
          body: text,
          category,
          city,
          university_id: universityId,
          author_id: caller.sub,
          is_anonymous: anonymous,
          notify_on_answer: notifyOnAnswer,
        })
        .select('slug')
        .single()

      if (!error && data) return jsonResponse(req, { slug: data.slug }, 200)
      if (error?.code !== '23505') {
        console.error('Question insert error:', error)
        return jsonResponse(req, { error: 'Could not post that. Please try again.' }, 500)
      }
    }
    return jsonResponse(req, { error: 'Could not post that. Please try again.' }, 500)
  }

  // ---- Post an answer ----
  if (action === 'answer') {
    const questionSlug = asTrimmedString(body.questionSlug, 140)
    const text = asTrimmedString(body.body, 5000)
    const anonymous = body.anonymous === true

    if (!questionSlug || !SLUG_RE.test(questionSlug)) {
      return jsonResponse(req, { error: 'Question not found' }, 404)
    }
    if (!text || text.length < 10) {
      return jsonResponse(req, { error: 'Say a bit more (at least 10 characters).' }, 400)
    }

    if (!(await checkRateLimit(`qa-a:${caller.sub}`, 20))) {
      return jsonResponse(req, { error: 'Too many answers. Try again in a little while.' }, 429)
    }

    const { data: question } = await supabaseAdmin
      .from('qa_questions')
      .select('id')
      .eq('slug', questionSlug)
      .is('deleted_at', null)
      .maybeSingle()
    if (!question) return jsonResponse(req, { error: 'Question not found' }, 404)

    const { data: answer, error } = await supabaseAdmin
      .from('qa_answers')
      .insert({
        question_id: question.id,
        author_id: caller.sub,
        is_anonymous: anonymous,
        body: text,
      })
      .select('id')
      .single()

    if (error || !answer) {
      console.error('Answer insert error:', error)
      return jsonResponse(req, { error: 'Could not post that. Please try again.' }, 500)
    }

    await notifyAnswer(answer.id)
    return jsonResponse(req, { id: answer.id }, 200)
  }

  // ---- Report a question or answer ----
  if (action === 'report') {
    const targetType = body.targetType === 'answer' ? 'answer' : 'question'
    const targetId = asTrimmedString(body.targetId, 40)
    const reason = asTrimmedString(body.reason, 500)

    if (!targetId || !UUID_RE.test(targetId)) {
      return jsonResponse(req, { error: 'Invalid report target' }, 400)
    }

    if (!(await checkRateLimit(`qa-r:${caller.sub}`, 30))) {
      return jsonResponse(req, { error: 'Too many reports. Try again later.' }, 429)
    }

    const { error } = await supabaseAdmin.from('qa_reports').insert({
      reporter_id: caller.sub,
      question_id: targetType === 'question' ? targetId : null,
      answer_id: targetType === 'answer' ? targetId : null,
      reason,
    })

    // 23505 = already reported by this user — treat as success, the flag is
    // recorded either way.
    if (error && error.code !== '23505') {
      console.error('Report insert error:', error)
      return jsonResponse(req, { error: 'Could not send that. Please try again.' }, 500)
    }
    return jsonResponse(req, { ok: true }, 200)
  }

  return jsonResponse(req, { error: 'Unknown action' }, 400)
})
