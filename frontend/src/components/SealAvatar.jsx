import { useMemo } from 'react'

// Extract initials from display name for seal-stamp avatar
const getInitials = (displayName) => {
  if (!displayName) return '?'

  const words = displayName.trim().split(/\s+/)
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase()
  }

  // Take first letter of first two words
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

// SealAvatar component - Chinese seal-stamp style avatar
export const SealAvatar = ({ displayName, size = 40, className = '' }) => {
  const initials = useMemo(() => getInitials(displayName), [displayName])

  const combinedClassName = `seal-avatar ${className}`.trim()

  const avatarStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '4px', // Slightly rounded square like traditional seals
    backgroundColor: 'var(--seal-red)',
    border: `2px solid var(--gold)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--gold)',
    fontFamily: 'var(--font-display)',
    fontWeight: 'bold',
    fontSize: `${size * 0.4}px`,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    userSelect: 'none',
  }

  return (
    <div className={combinedClassName} style={avatarStyle}>
      {initials}
    </div>
  )
}

// GuestSeal component - outlined "unclaimed" seal for logged-out visitors.
// Pairs with the filled member SealAvatar: guests see a seal-tinted square with
// 我 ("me"), members get the solid red seal with their initials.
export const GuestSeal = ({ size = 40, className = '' }) => {
  const combinedClassName = `guest-seal ${className}`.trim()

  const sealStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: `${Math.round(size * 0.22)}px`,
    fontSize: `${size * 0.42}px`,
  }

  return (
    <div className={combinedClassName} style={sealStyle} aria-hidden="true">
      我
    </div>
  )
}
