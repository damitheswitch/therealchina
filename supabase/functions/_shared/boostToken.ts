// Anonymous Boost capability handling, shared by review-submit (stores it),
// review-claim (matches it for device claims), and review-boost (checks it).
//
// The raw token is minted client-side with crypto.getRandomValues — never with
// a Math.random fallback — and is per review. The DB only ever sees its
// SHA-256 hex digest: a read of reviewer_context does not hand out the
// capability, and the raw token never appears in queries or logs.

export const BOOST_TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/

export function asBoostToken(value: unknown): string | null {
  return typeof value === 'string' && BOOST_TOKEN_RE.test(value) ? value : null
}

export async function hashBoostToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
