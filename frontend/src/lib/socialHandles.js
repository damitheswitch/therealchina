export const getSocialHandles = (profile) => {
  if (
    profile?.social_handles &&
    Array.isArray(profile.social_handles) &&
    profile.social_handles.length > 0
  ) {
    return profile.social_handles
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

export const hasSocialHandles = (profile) => {
  return getSocialHandles(profile).some((sh) => sh.handle && sh.handle.trim())
}
