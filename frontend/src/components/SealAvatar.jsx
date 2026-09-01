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
