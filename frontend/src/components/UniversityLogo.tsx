import { firstPartyLogo } from '../lib/logo'

interface Props {
  name: string
  logoUrl?: string | null
  /** Intrinsic size hint (width/height attrs) — layout size comes from className. */
  size: number
  className?: string
  /** Above-the-fold logos (university page hero) load eagerly. */
  eager?: boolean
}

/**
 * First-party university logo. DB rows store the ShanghaiRanking CDN URL;
 * firstPartyLogo() maps it to the mirrored /logos/<id>.<ext> file. Anything
 * else renders a letter tile — third-party images are never hotlinked.
 */
export const UniversityLogo = ({ name, logoUrl, size, className, eager = false }: Props) => {
  const src = firstPartyLogo(logoUrl)
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${name} logo`}
        className={`uni-logo-fallback ${className ?? ''}`}
        style={{ fontSize: size * 0.4 }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      style={{ objectFit: 'contain' }}
    />
  )
}
