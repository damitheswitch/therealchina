import { describe, it, expect } from 'vitest'
import { parseRecoveryHash, RESET_PATH } from './passwordReset'

describe('parseRecoveryHash', () => {
  it('detects a recovery token in the fragment', () => {
    const state = parseRecoveryHash(
      '#access_token=abc123&expires_in=3600&refresh_token=def456&token_type=bearer&type=recovery'
    )
    expect(state.recovery).toBe(true)
    expect(state.error).toBeNull()
  })

  it('surfaces a friendly message for expired links', () => {
    const state = parseRecoveryHash(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    )
    expect(state.recovery).toBe(false)
    expect(state.error).toBe('That reset link has expired. Request a new one below.')
  })

  it('passes through other error descriptions', () => {
    const state = parseRecoveryHash(
      '#error=access_denied&error_code=403&error_description=Something+else+went+wrong'
    )
    expect(state.recovery).toBe(false)
    expect(state.error).toBe('Something else went wrong')
  })

  it('returns a clean state for empty or unrelated fragments', () => {
    expect(parseRecoveryHash('')).toEqual({ recovery: false, error: null })
    expect(parseRecoveryHash('#section')).toEqual({ recovery: false, error: null })
    expect(parseRecoveryHash('#type=signup')).toEqual({ recovery: false, error: null })
  })

  it('handles a fragment with and without the leading #', () => {
    expect(parseRecoveryHash('type=recovery').recovery).toBe(true)
    expect(parseRecoveryHash('#type=recovery').recovery).toBe(true)
  })
})

describe('RESET_PATH', () => {
  it('is the registered noindex auth route', () => {
    expect(RESET_PATH).toBe('/reset-password')
  })
})
