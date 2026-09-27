export interface SocialPlatform {
  label: string
  icon: string
  placeholder?: string
  prefix?: string
  isCopyOnly?: boolean
  copyHint?: string
  getUrl?: (handle: string) => string | null
}

// Platforms whose handle should be entered as a phone number.
export const phonePlatforms: ReadonlySet<string> = new Set(['whatsapp'])

// Strip to characters valid in an international phone number: digits, spaces, +, -, (, ).
export const sanitizePhoneHandle = (value: string): string => value.replace(/[^0-9+\s()-]/g, '')

// Extract just the digits (and leading + if present) for wa.me links
export const getWhatsAppDigits = (value: string): string => {
  const trimmed = value.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  return hasPlus ? digits : digits
}

const stripProtocolAndWww = (val: string): string =>
  val.replace(/^https?:\/\//i, '').replace(/^www\./i, '')

/**
 * Strips known domains, URL query parameters, and prefix markers (@, in/)
 * from an input string to yield a clean platform handle.
 */
export const cleanHandle = (platform: string, input: string): string => {
  if (!input) return ''
  const trimmed = input.trim()

  if (phonePlatforms.has(platform)) {
    // For WhatsApp, if a full wa.me or whatsapp link was pasted:
    const waMatch = trimmed.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?([0-9+\s()-]+)/i)
    if (waMatch && waMatch[1]) {
      return sanitizePhoneHandle(waMatch[1].replace(/[^0-9+]/g, ''))
    }
    return sanitizePhoneHandle(trimmed)
  }

  // Common prefix stripping
  if (platform === 'wechat' || platform === 'discord') {
    // WeChat IDs and Discord usernames: strip leading @ and whitespace
    return trimmed.replace(/^@+/, '').trim()
  }

  if (platform === 'instagram') {
    const stripped = stripProtocolAndWww(trimmed)
    const match = stripped.match(/^instagram\.com\/([a-zA-Z0-9._]+)/i)
    if (match) return match[1]
    return trimmed.replace(/^@+/, '').replace(/\/+$/, '')
  }

  if (platform === 'telegram') {
    const stripped = stripProtocolAndWww(trimmed)
    const match = stripped.match(/^(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)/i)
    if (match) return match[1]
    return trimmed.replace(/^@+/, '').replace(/\/+$/, '')
  }

  if (platform === 'linkedin') {
    const stripped = stripProtocolAndWww(trimmed)
    const match = stripped.match(/^linkedin\.com\/in\/([a-zA-Z0-9-_%]+)/i)
    if (match) return match[1]
    return trimmed.replace(/^in\//i, '').replace(/\/+$/, '')
  }

  if (platform === 'github') {
    const stripped = stripProtocolAndWww(trimmed)
    const match = stripped.match(/^github\.com\/([a-zA-Z0-9-_]+)/i)
    if (match) return match[1]
    return trimmed.replace(/^@+/, '').replace(/\/+$/, '')
  }

  if (platform === 'x') {
    const stripped = stripProtocolAndWww(trimmed)
    const match = stripped.match(/^(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/i)
    if (match) return match[1]
    return trimmed.replace(/^@+/, '').replace(/\/+$/, '')
  }

  if (platform === 'rednote') {
    const stripped = stripProtocolAndWww(trimmed)
    const match = stripped.match(
      /(?:xiaohongshu\.com|xhslink\.com)\/(?:user\/profile\/)?([a-zA-Z0-9_]+)/i
    )
    if (match) return match[1]
    return trimmed.replace(/\/+$/, '')
  }

  if (platform === 'website') {
    return trimmed.replace(/\/+$/, '')
  }

  return trimmed
}

/**
 * Detects if the pasted text is a full URL for any known platform.
 * Returns the detected platform key and clean handle, or null.
 */
export const detectPlatformFromUrl = (
  input: string
): { platform: string; handle: string } | null => {
  if (!input) return null
  const trimmed = input.trim()

  if (/(?:instagram\.com|instagr\.am)\//i.test(trimmed)) {
    return { platform: 'instagram', handle: cleanHandle('instagram', trimmed) }
  }
  if (/(?:t\.me|telegram\.me)\//i.test(trimmed)) {
    return { platform: 'telegram', handle: cleanHandle('telegram', trimmed) }
  }
  if (/(?:wa\.me|api\.whatsapp\.com|whatsapp\.com)\//i.test(trimmed)) {
    return { platform: 'whatsapp', handle: cleanHandle('whatsapp', trimmed) }
  }
  if (/linkedin\.com\//i.test(trimmed)) {
    return { platform: 'linkedin', handle: cleanHandle('linkedin', trimmed) }
  }
  if (/github\.com\//i.test(trimmed)) {
    return { platform: 'github', handle: cleanHandle('github', trimmed) }
  }
  if (/(?:x\.com|twitter\.com)\//i.test(trimmed)) {
    return { platform: 'x', handle: cleanHandle('x', trimmed) }
  }
  if (/(?:xiaohongshu\.com|xhslink\.com)\//i.test(trimmed)) {
    return { platform: 'rednote', handle: cleanHandle('rednote', trimmed) }
  }
  if (/discord\.(?:gg|com)\//i.test(trimmed)) {
    const stripped = stripProtocolAndWww(trimmed)
    const match = stripped.match(/discord\.(?:gg|com)\/(?:users\/|invite\/)?([a-zA-Z0-9._-]+)/i)
    return { platform: 'discord', handle: match ? match[1] : trimmed }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { platform: 'website', handle: cleanHandle('website', trimmed) }
  }

  return null
}

/**
 * Builds the outbound deep link for a given platform and handle.
 * Defensively cleans the handle in case legacy rows hold raw URLs or prefixes.
 */
export const getSocialUrl = (platform: string, rawHandle: string): string | null => {
  if (!rawHandle) return null
  const handle = cleanHandle(platform, rawHandle)
  if (!handle) return null

  switch (platform) {
    case 'wechat':
    case 'discord':
      return null
    case 'instagram':
      return `https://instagram.com/${encodeURIComponent(handle)}`
    case 'telegram':
      return `https://t.me/${encodeURIComponent(handle)}`
    case 'whatsapp': {
      const digits = getWhatsAppDigits(handle)
      return digits ? `https://wa.me/${digits}` : null
    }
    case 'linkedin':
      return `https://www.linkedin.com/in/${encodeURIComponent(handle)}`
    case 'github':
      return `https://github.com/${encodeURIComponent(handle)}`
    case 'x':
      return `https://x.com/${encodeURIComponent(handle)}`
    case 'rednote':
      // If it looks like a URL already, ensure https
      if (/^https?:\/\//i.test(rawHandle)) return rawHandle
      return `https://www.xiaohongshu.com/user/profile/${encodeURIComponent(handle)}`
    case 'website':
    case 'other':
      return /^https?:\/\//i.test(rawHandle) ? rawHandle : `https://${handle}`
    default:
      return /^https?:\/\//i.test(rawHandle) ? rawHandle : null
  }
}

export const socialPlatforms: Record<string, SocialPlatform> = {
  wechat: {
    label: 'WeChat',
    icon: 'wechat',
    placeholder: 'WeChat ID',
    isCopyOnly: true,
    copyHint: 'WeChat ID copied — search in WeChat to add',
    getUrl: (h) => getSocialUrl('wechat', h),
  },
  instagram: {
    label: 'Instagram',
    icon: 'instagram',
    placeholder: 'username',
    prefix: '@',
    getUrl: (h) => getSocialUrl('instagram', h),
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: 'whatsapp',
    placeholder: '+1 555 123 4567',
    prefix: '+',
    getUrl: (h) => getSocialUrl('whatsapp', h),
  },
  telegram: {
    label: 'Telegram',
    icon: 'telegram',
    placeholder: 'username',
    prefix: '@',
    getUrl: (h) => getSocialUrl('telegram', h),
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'linkedin',
    placeholder: 'in/username',
    prefix: 'in/',
    getUrl: (h) => getSocialUrl('linkedin', h),
  },
  rednote: {
    label: 'REDNote',
    icon: 'rednote',
    placeholder: 'RED ID or link',
    getUrl: (h) => getSocialUrl('rednote', h),
  },
  x: {
    label: 'X (Twitter)',
    icon: 'x',
    placeholder: 'username',
    prefix: '@',
    getUrl: (h) => getSocialUrl('x', h),
  },
  discord: {
    label: 'Discord',
    icon: 'discord',
    placeholder: 'username',
    isCopyOnly: true,
    copyHint: 'Discord username copied to clipboard',
    getUrl: (h) => getSocialUrl('discord', h),
  },
  github: {
    label: 'GitHub',
    icon: 'github',
    placeholder: 'username',
    prefix: '@',
    getUrl: (h) => getSocialUrl('github', h),
  },
  website: {
    label: 'Website',
    icon: 'website',
    placeholder: 'portfolio or personal link',
    getUrl: (h) => getSocialUrl('website', h),
  },
  other: {
    label: 'Other',
    icon: 'link',
    placeholder: 'Handle or link',
    getUrl: (h) => getSocialUrl('other', h),
  },
}
