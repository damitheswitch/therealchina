// Shared Cloudflare Turnstile siteverify — one implementation for every
// function that gates anonymous writes (media-upload, review-submit).
// Fails closed everywhere: any verification problem returns false.

// Cloudflare's official test secret — when it is configured, the environment
// IS a test environment and siteverify returns no action/hostname to check.
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA'

// `action` binds the token to its surface (e.g. 'media-upload' vs
// 'review-submit') so a token solved on one form can't be replayed on another.
export async function verifyTurnstile(
  token: string,
  ip: string,
  action: string
): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY not configured')
    return false
  }
  const isTestSecret = secret === TURNSTILE_TEST_SECRET

  const form = new URLSearchParams()
  form.append('secret', secret)
  form.append('response', token)
  form.append('remoteip', ip)

  let data: {
    success: boolean
    action?: string
    hostname?: string
    'error-codes'?: string[]
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    data = await res.json()
  } catch (err) {
    console.error('Turnstile siteverify request failed:', err)
    return false
  }

  if (!data.success) {
    console.error('Turnstile verification failed:', data['error-codes'])
    return false
  }
  // Test-secret environments skip the action + hostname checks: test tokens
  // carry neither, so enforcing them would make staging/local unusable.
  if (!isTestSecret && data.action !== action) {
    console.error('Turnstile action mismatch:', data.action, 'expected', action)
    return false
  }
  // Optional hostname allowlist. When TURNSTILE_HOSTNAMES is unset, skip so
  // local dev keeps working. In production, set it to the exact frontend
  // hostnames (comma-separated, no scheme, no trailing slash) and never
  // include localhost / 127.0.0.1.
  const hostnamesRaw = Deno.env.get('TURNSTILE_HOSTNAMES')
  if (hostnamesRaw && !isTestSecret) {
    const allowed = new Set(
      hostnamesRaw
        .split(',')
        .map((h) => h.trim().replace(/\/$/, ''))
        .filter(Boolean)
    )
    if (!data.hostname || !allowed.has(data.hostname)) {
      console.error('Turnstile hostname not allowed:', data.hostname)
      return false
    }
  }
  return true
}
