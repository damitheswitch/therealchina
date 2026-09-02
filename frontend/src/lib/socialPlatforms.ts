export interface SocialPlatform {
  label: string
  icon: string
}

export const socialPlatforms: Record<string, SocialPlatform> = {
  wechat: { label: 'WeChat', icon: 'chat' },
  instagram: { label: 'Instagram', icon: 'camera' },
  rednote: { label: 'REDNote', icon: 'book' },
  whatsapp: { label: 'WhatsApp', icon: 'phone' },
  other: { label: 'Social', icon: 'link' },
}

// Platforms whose handle should be entered as a phone number.
export const phonePlatforms: ReadonlySet<string> = new Set(['whatsapp'])

// Strip to characters valid in an international phone number: digits, spaces, +, -, (, ).
export const sanitizePhoneHandle = (value: string): string => value.replace(/[^0-9+\s()-]/g, '')
