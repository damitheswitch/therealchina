const SR_LOGO = /^https:\/\/www\.shanghairanking\.cn\/_uni\/logo(?:-jpg)?\/(\d+)\.(png|jpg)$/

/**
 * Maps a DB logo_url to a first-party /logos/<id>.png path (mirrored by
 * scripts/mirror_logos.mjs; logo-jpg sources are converted to transparent
 * PNGs by scripts/remove_logo_bg.py). Returns null for anything else —
 * callers render the letter placeholder so no third-party image is ever
 * hotlinked.
 *
 * The ?v=2 query cache-busts the 2026-10 transparency conversion: browsers
 * and CDN edges may hold the old opaque-background PNGs at the same path.
 * Bump it if logos are ever reprocessed again.
 */
export const firstPartyLogo = (url?: string | null): string | null => {
  const m = url ? SR_LOGO.exec(url) : null
  return m ? `/logos/${m[1]}.png?v=2` : null
}
