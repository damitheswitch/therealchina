import { describe, it, expect } from 'vitest'
import { socialPlatforms, phonePlatforms, sanitizePhoneHandle } from './socialPlatforms'

describe('socialPlatforms', () => {
  it('does not expose RED as a platform option', () => {
    expect(socialPlatforms).not.toHaveProperty('red')
  })

  it('keeps REDNote available', () => {
    expect(socialPlatforms.rednote).toBeDefined()
    expect(socialPlatforms.rednote.label).toBe('REDNote')
  })

  it('keeps WeChat, Instagram, and Other available', () => {
    expect(socialPlatforms.wechat).toBeDefined()
    expect(socialPlatforms.instagram).toBeDefined()
    expect(socialPlatforms.other).toBeDefined()
  })

  it('adds WhatsApp as a platform option', () => {
    expect(socialPlatforms.whatsapp).toBeDefined()
    expect(socialPlatforms.whatsapp.label).toBe('WhatsApp')
  })
})

describe('phonePlatforms', () => {
  it('treats WhatsApp as a phone-style platform', () => {
    expect(phonePlatforms.has('whatsapp')).toBe(true)
  })

  it('does not treat other platforms as phone-style', () => {
    expect(phonePlatforms.has('wechat')).toBe(false)
    expect(phonePlatforms.has('instagram')).toBe(false)
    expect(phonePlatforms.has('rednote')).toBe(false)
    expect(phonePlatforms.has('other')).toBe(false)
  })
})

describe('sanitizePhoneHandle', () => {
  it('keeps digits, spaces, +, -, and parentheses', () => {
    expect(sanitizePhoneHandle('+1 (555) 123-4567')).toBe('+1 (555) 123-4567')
  })

  it('strips letters and other non-phone characters', () => {
    expect(sanitizePhoneHandle('+1abc555-1234')).toBe('+1555-1234')
    expect(sanitizePhoneHandle('@user_handle')).toBe('')
  })

  it('returns an empty string for empty input', () => {
    expect(sanitizePhoneHandle('')).toBe('')
  })
})
