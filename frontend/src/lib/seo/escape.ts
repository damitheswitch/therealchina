// HTML-escaping for values interpolated into <head> strings during
// prerendering. & < > " ' all escaped — prevents XSS via university names,
// review text or any user-controlled field reaching generated HTML.
export const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** JSON.stringify with HTML-dangerous characters escaped — safe inside
 *  <script type="application/ld+json"> in generated HTML. */
export const escapeJsonLd = (obj: unknown): string =>
  JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')

/** YYYY-MM-DD in UTC — deterministic across build machines and browsers. */
export const isoDate = (d: string | Date): string => {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toISOString().slice(0, 10)
}
