import { useEffect, useState } from 'react'
import { isProdSite, prodUrlFor } from '../lib/pwa'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Defers the browser's install prompt so the app can show its own button —
 * prod origin only. A PWA installed from staging or a deploy preview stays
 * bound to that origin and would serve that build forever.
 */
export const usePwaInstall = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (!isProdSite()) return
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const promptInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  // A real install prompt can't exist on non-prod origins without binding the
  // app to that origin forever — so the CTA opens prod, where install works.
  const openProdInstall = () => {
    window.open(
      prodUrlFor(window.location.pathname, window.location.search),
      '_blank',
      'noopener,noreferrer'
    )
  }

  const canInstall = installPrompt !== null

  return {
    // prod: only when Chrome offers the prompt. non-prod: always — it opens prod.
    showInstall: canInstall || !isProdSite(),
    canInstall,
    promptInstall,
    openProdInstall,
  }
}
