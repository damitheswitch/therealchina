import { useEffect, useState } from 'react'
import { isProdSite } from '../lib/pwa'

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

  return { canInstall: installPrompt !== null, promptInstall }
}
