// Supabase Edge Function: media-cleanup
// Deletes review-media objects that no review or draft references and that
// are older than MIN_AGE. Uploads happen before a review is submitted, so
// abandoned uploads would otherwise stay public forever. Invoked daily by
// pg_cron (public.trigger_media_cleanup) with a shared secret from Vault;
// never by browsers. Missing or mismatched secret: fail closed.

import { supabaseAdmin, jsonResponse } from '../_shared/guard.ts'
import { safeEqual } from '../_shared/safeEqual.ts'

// Long enough that an in-progress review or draft save is never raced.
const MIN_AGE = '2 days'
const BATCH = 500
// Storage remove() takes a list; keep each call small.
const REMOVE_CHUNK = 100

async function handleCleanup(req: Request): Promise<Response> {
  const secret = Deno.env.get('MEDIA_CLEANUP_SECRET')
  if (!secret || !safeEqual(req.headers.get('x-cleanup-secret') ?? '', secret)) {
    return jsonResponse(req, { error: 'Unauthorized' }, 401)
  }

  const { data, error } = await supabaseAdmin.rpc('list_orphan_media', {
    p_min_age: MIN_AGE,
    p_limit: BATCH,
  })
  if (error) {
    console.error('list_orphan_media failed:', error)
    return jsonResponse(req, { error: 'Listing failed' }, 500)
  }

  const names = ((data as { name: string }[] | null) ?? []).map((r) => r.name)
  let removed = 0
  for (let i = 0; i < names.length; i += REMOVE_CHUNK) {
    const chunk = names.slice(i, i + REMOVE_CHUNK)
    const { error: removeError } = await supabaseAdmin.storage.from('review-media').remove(chunk)
    if (removeError) {
      console.error('Storage remove failed:', removeError)
      break
    }
    removed += chunk.length
  }

  return jsonResponse(req, { ok: true, found: names.length, removed }, 200)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse(req, { error: 'Method not allowed' }, 405)
  }
  try {
    return await handleCleanup(req)
  } catch (err) {
    console.error('Unhandled error:', err)
    return jsonResponse(req, { error: 'Internal server error' }, 500)
  }
})
