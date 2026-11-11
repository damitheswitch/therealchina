// Pure parts of the reviewer ping: unsubscribe tokens and recipient selection.
// No client import, so it is unit-testable without Supabase env.

export const MAX_PINGS_PER_QUESTION = 5
export const PING_THROTTLE_DAYS = 7

export type PingKind = 'member' | 'anonymous'

export interface PingCandidate {
  email: string
  kind: PingKind
  // Auth user id when known (members, and claimed anonymous reviews).
  userId?: string | null
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

// ---- Recipient selection -----------------------------------------------------

export interface SelectOptions {
  askerId: string
  askerEmail: string | null
  // Lowercased addresses that already got a ping inside the throttle window.
  throttled: ReadonlySet<string>
  limit?: number
}

// Drops the asker (by id or address), duplicates, throttled recipients and
// anything that is not a plausible address; keeps input order; caps at limit.
export function selectRecipients(
  candidates: readonly PingCandidate[],
  opts: SelectOptions
): PingCandidate[] {
  const limit = opts.limit ?? MAX_PINGS_PER_QUESTION
  const askerEmail = opts.askerEmail ? normalizeEmail(opts.askerEmail) : null
  const seen = new Set<string>()
  const out: PingCandidate[] = []
  for (const c of candidates) {
    if (out.length >= limit) break
    const email = normalizeEmail(c.email ?? '')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (c.userId && c.userId === opts.askerId) continue
    if (askerEmail && email === askerEmail) continue
    if (opts.throttled.has(email) || seen.has(email)) continue
    seen.add(email)
    out.push({ ...c, email })
  }
  return out
}

export function throttleCutoff(now: number = Date.now()): string {
  return new Date(now - PING_THROTTLE_DAYS * 24 * 60 * 60_000).toISOString()
}

// ---- Unsubscribe tokens ------------------------------------------------------
// token = "<kind>.<base64url(subject)>.<base64url(HMAC-SHA256)>"
// subject is the profile id for members and the lowercased address for
// anonymous reviewers. No expiry: an old email must still unsubscribe.

const enc = new TextEncoder()

const toB64Url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromB64Url = (s: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null
  try {
    const padded = s.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    return Uint8Array.from(bin, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
  } catch {
    return null
  }
}

const hmacKey = (secret: string, usage: KeyUsage) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    usage,
  ])

export async function signUnsubscribeToken(
  kind: PingKind,
  subject: string,
  secret: string
): Promise<string> {
  const payload = `${kind}.${toB64Url(enc.encode(subject))}`
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(payload))
  return `${payload}.${toB64Url(new Uint8Array(sig))}`
}

export async function verifyUnsubscribeToken(
  token: string,
  secret: string
): Promise<{ kind: PingKind; subject: string } | null> {
  if (!secret || token.length > 600) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [kind, subjectPart, sigPart] = parts
  if (kind !== 'member' && kind !== 'anonymous') return null
  const subjectBytes = fromB64Url(subjectPart)
  const sig = fromB64Url(sigPart)
  if (!subjectBytes || !sig) return null
  // crypto.subtle.verify compares in constant time.
  const ok = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret, 'verify'),
    sig,
    enc.encode(`${kind}.${subjectPart}`)
  )
  if (!ok) return null
  return { kind, subject: new TextDecoder().decode(subjectBytes) }
}

// Escapes LIKE wildcards so an address matches only itself under ilike.
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (ch) => `\\${ch}`)
