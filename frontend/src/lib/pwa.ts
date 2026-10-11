import { PROD_ORIGIN } from './seo/site'

// The installed app must always be the prod build. Deploy previews, the
// staging site and local dev all serve the same manifest + service worker,
// and an installed PWA stays bound to the origin it was installed from —
// an install from staging.therealchina.net would serve that deploy forever.

/** Pure predicate: the only origin allowed to install or serve the PWA. */
export const isProdOrigin = (origin: string): boolean => origin === PROD_ORIGIN

/** True when this page is running on the production origin. */
export const isProdSite = (): boolean =>
  typeof window !== 'undefined' && isProdOrigin(window.location.origin)

/** True when running inside an installed PWA window (standalone display). */
export const isInstalledPwa = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    (window.matchMedia?.('(display-mode: standalone)')?.matches ?? false) ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Absolute prod URL for a path — hands a stale-origin install back to prod. */
export const prodUrlFor = (path = '/', search = ''): string => `${PROD_ORIGIN}${path}${search}`

/**
 * Remove every service-worker registration and its caches. Runs on non-prod
 * origins so previews/staging/local builds are never installable and never
 * serve a stale precache.
 */
export const unregisterServiceWorkers = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((r) => r.unregister()))
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
  }
}
