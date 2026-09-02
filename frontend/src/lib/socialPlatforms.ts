export interface SocialPlatform {
  label: string
  icon: string
}

export const socialPlatforms: Record<string, SocialPlatform> = {
  wechat: { label: 'WeChat', icon: 'chat' },
  instagram: { label: 'Instagram', icon: 'camera' },
  red: { label: 'RED', icon: 'book' },
  rednote: { label: 'REDNote', icon: 'book' },
  other: { label: 'Social', icon: 'link' },
}
