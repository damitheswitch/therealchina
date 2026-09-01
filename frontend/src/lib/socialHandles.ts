import type { Tables } from '../types/database.types'

export interface SocialHandle {
  platform: string
  handle: string
}

type ProfileWithSocial =
  | Pick<Tables<'profiles'>, 'social_handles' | 'social_platform' | 'social_handle'>
  | null
  | undefined

export const getSocialHandles = (profile: ProfileWithSocial): SocialHandle[] => {
  if (
    profile?.social_handles &&
    Array.isArray(profile.social_handles) &&
    profile.social_handles.length > 0
  ) {
    return profile.social_handles as unknown as SocialHandle[]
  }

  if (profile?.social_platform || profile?.social_handle) {
    return [
      {
        platform: profile.social_platform || 'other',
        handle: profile.social_handle || '',
      },
    ]
  }

  return []
}

export const hasSocialHandles = (profile: ProfileWithSocial): boolean => {
  return getSocialHandles(profile).some((sh) => sh.handle && sh.handle.trim())
}
