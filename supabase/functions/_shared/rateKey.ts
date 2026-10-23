// Rate-limit keys for anonymous callers. Pure (no client import) so it can be
// unit-tested without Supabase env.
//
// getClientIP returns 'unknown' when no trusted public IP is present. That
// used to skip the limiter entirely, which failed open exactly when the
// signal was missing. Instead, every unknown-IP caller now shares a single
// bucket per surface: abuse still hits a ceiling, and a misconfigured proxy
// shows up as 429s rather than as silent unlimited writes.

export const UNKNOWN_IP = 'unknown'

export function anonRateKey(prefix: string, ip: string): string {
  if (!ip || ip === UNKNOWN_IP) {
    console.error(`Rate limit: no trusted client IP, using shared bucket for ${prefix}`)
    return `${prefix}${UNKNOWN_IP}`
  }
  return `${prefix}${ip}`
}
