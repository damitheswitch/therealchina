const RESERVED = /\b(admin|moderator|support|staff|official)\b|^\s*(admin|moderator|support|staff|official)([\s._-]|[0-9]|$)/i
const TRC_PREFIX = /^trc[_-]/i

const BLOCKLIST = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'null',
  'undefined',
  'moderator',
  'mod',
  'support',
  'staff',
  'official',
  'the_real_china',
  'therealchina',
])

export function validateDisplayName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Display name is required.', normalized: '' }
  }

  const normalized = name.replace(/\s+/g, ' ').trim()

  if (normalized.length < 2 || normalized.length > 32) {
    return { valid: false, error: 'Display name must be between 2 and 32 characters.', normalized }
  }

  if (/^\s|\s$/.test(normalized) || /\s{2,}/.test(normalized)) {
    return { valid: false, error: 'Display name has invalid spacing.', normalized }
  }

  if (!/^[-_. 'A-Za-z0-9\u4e00-\u9fff()]+$/.test(normalized)) {
    return { valid: false, error: 'Use letters, numbers, spaces, -, _, ., apostrophes, or parentheses only.', normalized }
  }

  if (!/[A-Za-z\u4e00-\u9fff]/.test(normalized)) {
    return { valid: false, error: 'Display name must contain at least one letter.', normalized }
  }

  if (RESERVED.test(normalized)) {
    return { valid: false, error: 'That name is reserved.', normalized }
  }

  if (TRC_PREFIX.test(normalized)) {
    return { valid: false, error: 'Names starting with "trc_" or "trc-" are not allowed.', normalized }
  }

  if (BLOCKLIST.has(normalized.toLowerCase())) {
    return { valid: false, error: 'That name is not allowed.', normalized }
  }

  return { valid: true, error: null, normalized }
}
