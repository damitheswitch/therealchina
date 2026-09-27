import React, { useState, useEffect, useRef } from 'react'
import { Icons } from './Icons'
import {
  socialPlatforms,
  cleanHandle,
  getSocialUrl,
  type SocialPlatform,
} from '../lib/socialPlatforms'
import { useToast } from '../contexts/ToastContext'

interface SocialChipProps {
  platform: string
  handle: string
  variant?: 'full' | 'compact' | 'icon-only'
  className?: string
  onCopy?: (handle: string) => void
}

export const PlatformIcon: React.FC<{
  platform: string
  size?: number
  className?: string
}> = ({ platform, size = 16, className = '' }) => {
  switch (platform) {
    case 'wechat':
      return <Icons.WeChat size={size} className={className} />
    case 'instagram':
      return <Icons.Instagram size={size} className={className} />
    case 'whatsapp':
      return <Icons.WhatsApp size={size} className={className} />
    case 'telegram':
      return <Icons.Telegram size={size} className={className} />
    case 'linkedin':
      return <Icons.LinkedIn size={size} className={className} />
    case 'github':
      return <Icons.GitHub size={size} className={className} />
    case 'x':
      return <Icons.TwitterX size={size} className={className} />
    case 'discord':
      return <Icons.Discord size={size} className={className} />
    case 'rednote':
      return <Icons.REDNote size={size} className={className} />
    case 'website':
      return <Icons.Globe size={size} className={className} />
    default:
      return <Icons.Link size={size} className={className} />
  }
}

export const SocialChip: React.FC<SocialChipProps> = ({
  platform,
  handle,
  variant = 'full',
  className = '',
  onCopy,
}) => {
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<number | null>(null)

  let showToast: (msg: string, type?: string) => void = () => {}
  try {
    const toastContext = useToast()
    if (toastContext?.showToast) {
      showToast = toastContext.showToast
    }
  } catch {
    // Fallback when rendered outside ToastProvider
  }

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  if (!handle || !handle.trim()) return null

  const platformKey = platform?.toLowerCase() || 'other'
  const platformData: SocialPlatform = socialPlatforms[platformKey] || socialPlatforms.other

  const clean = cleanHandle(platformKey, handle)
  const url = getSocialUrl(platformKey, handle)
  const isCopyOnly = Boolean(platformData.isCopyOnly || !url)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!clean) return

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(clean)
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea')
        textArea.value = clean
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      setCopied(true)
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopied(false), 2000)

      const hint = platformData.copyHint || `${platformData.label} copied to clipboard!`
      showToast(hint)
      onCopy?.(clean)
    } catch {
      showToast('Could not copy to clipboard', 'error')
    }
  }

  // Display handle: add prefix if defined and not already in clean
  const displayHandle =
    platformData.prefix &&
    !clean.startsWith(platformData.prefix) &&
    !clean.startsWith('+') &&
    platformKey !== 'whatsapp'
      ? `${platformData.prefix}${clean}`
      : clean

  if (variant === 'icon-only') {
    const titleText = isCopyOnly
      ? `${platformData.label}: ${displayHandle} (Click to copy)`
      : `${platformData.label}: ${displayHandle} (Click to open)`

    if (isCopyOnly) {
      return (
        <button
          type="button"
          onClick={handleCopy}
          className={`social-chip-icon-btn ${copied ? 'copied' : ''} ${className}`}
          title={copied ? 'Copied!' : titleText}
          aria-label={titleText}
        >
          {copied ? <Icons.Check size={14} /> : <PlatformIcon platform={platformKey} size={14} />}
        </button>
      )
    }

    return (
      <a
        href={url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className={`social-chip-icon-btn ${className}`}
        title={titleText}
        aria-label={titleText}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <PlatformIcon platform={platformKey} size={14} />
      </a>
    )
  }

  if (variant === 'compact') {
    if (isCopyOnly) {
      return (
        <button
          type="button"
          onClick={handleCopy}
          className={`social-chip social-chip-compact is-copy-action ${copied ? 'copied' : ''} ${className}`}
          title={copied ? 'Copied to clipboard!' : `Click to copy ${platformData.label}`}
        >
          <span className="social-chip-icon">
            <PlatformIcon platform={platformKey} size={14} />
          </span>
          <span className="social-chip-handle">{displayHandle}</span>
          <span className="social-chip-badge">
            {copied ? (
              <>
                <Icons.Check size={12} /> Copied
              </>
            ) : (
              'Copy'
            )}
          </span>
        </button>
      )
    }

    return (
      <div className={`social-chip social-chip-compact ${className}`}>
        <a
          href={url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="social-chip-main-link"
          title={`Open ${platformData.label} profile`}
        >
          <span className="social-chip-icon">
            <PlatformIcon platform={platformKey} size={14} />
          </span>
          <span className="social-chip-handle">{displayHandle}</span>
          <Icons.ExternalLink size={11} className="social-chip-ext-icon" />
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className={`social-chip-copy-icon-btn ${copied ? 'copied' : ''}`}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          aria-label={`Copy ${platformData.label} handle`}
        >
          {copied ? <Icons.Check size={12} /> : <Icons.Copy size={12} />}
        </button>
      </div>
    )
  }

  // variant === 'full' (for ProfileView)
  return (
    <div
      className={`social-chip social-chip-full ${copied ? 'copied' : ''} ${className}`}
      data-platform={platformKey}
    >
      <div className="social-chip-brand">
        <span className="social-chip-brand-icon">
          <PlatformIcon platform={platformKey} size={18} />
        </span>
        <div className="social-chip-text">
          <span className="social-chip-platform-name">{platformData.label}</span>
          {isCopyOnly ? (
            <button
              type="button"
              onClick={handleCopy}
              className="social-chip-handle-btn"
              title="Click to copy handle"
            >
              <span className="social-chip-handle-val">{displayHandle}</span>
            </button>
          ) : (
            <a
              href={url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="social-chip-handle-link"
              title={`Visit ${platformData.label} profile`}
            >
              <span className="social-chip-handle-val">{displayHandle}</span>
              <Icons.ExternalLink size={12} className="social-chip-ext-icon" />
            </a>
          )}
        </div>
      </div>

      <div className="social-chip-actions">
        <button
          type="button"
          onClick={handleCopy}
          className={`btn-copy-chip ${copied ? 'copied' : ''}`}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          aria-label={`Copy ${platformData.label} handle`}
        >
          {copied ? (
            <>
              <Icons.Check size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Icons.Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
