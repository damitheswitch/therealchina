const SR_LOGO = /^https:\/\/www\.shanghairanking\.cn\/_uni\/logo(?:-jpg)?\/(\d+)\.(png|jpg)$/

/**
 * Maps a DB logo_url to a first-party /logos/<id>.<ext> path (mirrored by
 * scripts/mirror_logos.mjs). Returns null for anything else — callers render
 * the letter placeholder so no third-party image is ever hotlinked.
 */
export const firstPartyLogo = (url?: string | null): string | null => {
  const m = url ? SR_LOGO.exec(url) : null
  return m ? `/logos/${m[1]}.${m[2]}` : null
}
