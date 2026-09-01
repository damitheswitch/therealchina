import { describe, it, expect } from 'vitest'
import { validateDisplayName } from './validateDisplayName'

describe('validateDisplayName', () => {
  describe('valid names', () => {
    it.each(['Alex', 'Alex Chen', "O'Neill", 'user_name-92', '张伟', 'Alex (PKU)', 'a. lai'])(
      'accepts %s',
      (name) => {
        const result = validateDisplayName(name)
        expect(result.valid).toBe(true)
        expect(result.error).toBeNull()
      }
    )

    it('normalizes extra whitespace before validating', () => {
      const result = validateDisplayName('  Alex   Chen ')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('Alex Chen')
    })
  })

  describe('required / length', () => {
    it.each([null, undefined, '', 42])('rejects %s as missing', (name) => {
      expect(validateDisplayName(name).valid).toBe(false)
      expect(validateDisplayName(name).error).toMatch(/required/i)
    })

    it('rejects names shorter than 2 characters', () => {
      expect(validateDisplayName('a').valid).toBe(false)
    })

    it('rejects names longer than 32 characters', () => {
      expect(validateDisplayName('a'.repeat(33)).valid).toBe(false)
    })

    it('accepts a name at exactly 32 characters', () => {
      expect(validateDisplayName('a'.repeat(32)).valid).toBe(true)
    })
  })

  describe('characters', () => {
    it.each(['alex<script>', 'hello;drop', 'money$bags', 'emoji😀name'])(
      'rejects %s with invalid characters',
      (name) => {
        const result = validateDisplayName(name)
        expect(result.valid).toBe(false)
        expect(result.error).toMatch(/letters/i)
      }
    )

    it('requires at least one letter', () => {
      expect(validateDisplayName('12345').valid).toBe(false)
      expect(validateDisplayName('___').valid).toBe(false)
    })

    it('accepts a Chinese-only name', () => {
      expect(validateDisplayName('小明').valid).toBe(true)
    })
  })

  describe('reserved names', () => {
    it.each(['admin', 'Admin', 'site admin', 'support_team', 'official23', 'moderator'])(
      'rejects reserved name %s',
      (name) => {
        expect(validateDisplayName(name).valid).toBe(false)
      }
    )

    it.each(['trc_news', 'TRC-official'])('rejects TRC-prefixed name %s', (name) => {
      expect(validateDisplayName(name).valid).toBe(false)
    })

    it.each(['root', 'system', 'therealchina'])('rejects blocklisted name %s', (name) => {
      expect(validateDisplayName(name).valid).toBe(false)
    })

    it('does not reject names merely containing reserved words', () => {
      expect(validateDisplayName('administrator of fun').valid).toBe(true)
      expect(validateDisplayName('supportive amy').valid).toBe(true)
    })
  })
})
