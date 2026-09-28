// Password-reset helpers. The URL parsing is pure so vitest covers it
// without a DOM or a live Supabase project.

export const RESET_PATH = '/reset-password'

/** Recovery emails send users back to this URL. Built from the current
 *  origin so local dev, deploy previews and prod each return to themselves.
 *  Every origin still needs an allowlist entry in the project's Supabase
 *  auth settings: config.toml locally, dashboard URL Configuration remotely. */
export const resetRedirectTo = (): string => `${window.location.origin}${RESET_PATH}`

export interface RecoveryLinkState {
  /** The link carries a recovery token (fragment contains type=recovery). */
  recovery: boolean
  /** User-facing error when the link failed (expired, invalid, reused). */
  error: string | null
}

/** Parse the auth fragment Supabase appends to the recovery redirect.
 *  Implicit flow lands as /reset-password#access_token=...&type=recovery;
 *  a dead link lands as #error=access_denied&error_code=otp_expired&
 *  error_description=... (+ encoded spaces). */
export const parseRecoveryHash = (hash: string): RecoveryLinkState => {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const code = params.get('error_code')
  const description = params.get('error_description')
  const error =
    code === 'otp_expired' ? 'That reset link has expired. Request a new one below.' : description
  return { recovery: params.get('type') === 'recovery', error }
}
