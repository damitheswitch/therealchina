import { describe, it, expect } from 'vitest'
import {
  socialPlatforms,
  phonePlatforms,
  sanitizePhoneHandle,
  cleanHandle,
  detectPlatformFromUrl,
  getSocialUrl,
} from './socialPlatforms'

describe('socialPlatforms roster', () => {
  it('does not expose RED as a platform option', () => {
    expect(socialPlatforms).not.toHaveProperty('red')
  })

  it('contains all curated core platforms', () => {
    const expected = [
      'wechat',
      'instagram',
      'whatsapp',
      'telegram',
      'linkedin',
      'rednote',
      'x',
      'discord',
      'github',
      'website',
      'other',
    ]
    for (const key of expected) {
      expect(socialPlatforms[key]).toBeDefined()
      expect(socialPlatforms[key].label).toBeTruthy()
    }
  })

  it('marks WeChat and Discord as copy-only', () => {
    expect(socialPlatforms.wechat.isCopyOnly).toBe(true)
    expect(socialPlatforms.discord.isCopyOnly).toBe(true)
    expect(socialPlatforms.instagram.isCopyOnly).toBeFalsy()
  })
})

describe('phonePlatforms', () => {
  it('treats WhatsApp as a phone-style platform', () => {
    expect(phonePlatforms.has('whatsapp')).toBe(true)
  })

  it('does not treat other platforms as phone-style', () => {
    expect(phonePlatforms.has('wechat')).toBe(false)
    expect(phonePlatforms.has('instagram')).toBe(false)
    expect(phonePlatforms.has('telegram')).toBe(false)
    expect(phonePlatforms.has('linkedin')).toBe(false)
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

describe('cleanHandle', () => {
  it('strips leading @ from handles', () => {
    expect(cleanHandle('instagram', '@alice')).toBe('alice')
    expect(cleanHandle('telegram', '@bob_smith')).toBe('bob_smith')
    expect(cleanHandle('x', '@elon_musk')).toBe('elon_musk')
    expect(cleanHandle('github', '@octocat')).toBe('octocat')
    expect(cleanHandle('wechat', '@wxid_123')).toBe('wxid_123')
  })

  it('strips domains and query params from pasted Instagram URLs', () => {
    expect(cleanHandle('instagram', 'https://www.instagram.com/alice/?hl=en')).toBe('alice')
    expect(cleanHandle('instagram', 'http://instagram.com/alice/')).toBe('alice')
  })

  it('strips domains from pasted Telegram URLs', () => {
    expect(cleanHandle('telegram', 'https://t.me/student_chat')).toBe('student_chat')
    expect(cleanHandle('telegram', 'telegram.me/student_chat')).toBe('student_chat')
  })

  it('strips in/ prefix and domain from LinkedIn URLs', () => {
    expect(cleanHandle('linkedin', 'https://www.linkedin.com/in/student-name/')).toBe(
      'student-name'
    )
    expect(cleanHandle('linkedin', 'in/student-name')).toBe('student-name')
  })

  it('strips domain from GitHub and X URLs', () => {
    expect(cleanHandle('github', 'https://github.com/developer')).toBe('developer')
    expect(cleanHandle('x', 'https://x.com/tech_insider')).toBe('tech_insider')
    expect(cleanHandle('x', 'https://twitter.com/tech_insider')).toBe('tech_insider')
  })

  it('extracts phone number from wa.me links', () => {
    expect(cleanHandle('whatsapp', 'https://wa.me/15551234567')).toBe('15551234567')
  })
})

describe('detectPlatformFromUrl', () => {
  it('detects Instagram URLs', () => {
    const res = detectPlatformFromUrl('https://instagram.com/traveler')
    expect(res).toEqual({ platform: 'instagram', handle: 'traveler' })
  })

  it('detects Telegram URLs', () => {
    const res = detectPlatformFromUrl('https://t.me/beijing_students')
    expect(res).toEqual({ platform: 'telegram', handle: 'beijing_students' })
  })

  it('detects WhatsApp URLs', () => {
    const res = detectPlatformFromUrl('https://wa.me/8613800000000')
    expect(res).toEqual({ platform: 'whatsapp', handle: '8613800000000' })
  })

  it('detects LinkedIn URLs', () => {
    const res = detectPlatformFromUrl('https://www.linkedin.com/in/alumni-pro')
    expect(res).toEqual({ platform: 'linkedin', handle: 'alumni-pro' })
  })

  it('detects GitHub and X/Twitter URLs', () => {
    expect(detectPlatformFromUrl('https://github.com/coder')).toEqual({
      platform: 'github',
      handle: 'coder',
    })
    expect(detectPlatformFromUrl('https://twitter.com/news')).toEqual({
      platform: 'x',
      handle: 'news',
    })
  })

  it('detects generic website URLs', () => {
    const res = detectPlatformFromUrl('https://myportfolio.dev/work')
    expect(res).toEqual({ platform: 'website', handle: 'https://myportfolio.dev/work' })
  })

  it('returns null for plain handle text', () => {
    expect(detectPlatformFromUrl('just_a_handle')).toBeNull()
    expect(detectPlatformFromUrl('@user123')).toBeNull()
  })
})

describe('getSocialUrl', () => {
  it('returns null for copy-only platforms like WeChat and Discord', () => {
    expect(getSocialUrl('wechat', 'wxid_abcdef')).toBeNull()
    expect(getSocialUrl('discord', 'gamer#1234')).toBeNull()
  })

  it('builds valid deep link URLs for web platforms', () => {
    expect(getSocialUrl('instagram', 'alice')).toBe('https://instagram.com/alice')
    expect(getSocialUrl('telegram', 'bob')).toBe('https://t.me/bob')
    expect(getSocialUrl('linkedin', 'carol')).toBe('https://www.linkedin.com/in/carol')
    expect(getSocialUrl('github', 'dave')).toBe('https://github.com/dave')
    expect(getSocialUrl('x', 'eve')).toBe('https://x.com/eve')
    expect(getSocialUrl('whatsapp', '+1 555 123 4567')).toBe('https://wa.me/15551234567')
  })

  it('handles dirty legacy stored handles with @ prefix or full URL', () => {
    expect(getSocialUrl('instagram', '@alice')).toBe('https://instagram.com/alice')
    expect(getSocialUrl('telegram', 'https://t.me/bob')).toBe('https://t.me/bob')
    expect(getSocialUrl('linkedin', 'in/carol')).toBe('https://www.linkedin.com/in/carol')
  })
})
