import type { ReactNode } from 'react'
import { AuthProvider } from '../contexts/AuthContext'
import { ProfileProvider } from '../contexts/ProfileContext'
import { ToastProvider } from '../contexts/ToastContext'
import { AuthModalProvider } from '../contexts/AuthModalContext'
import { ErrorBoundary } from './ErrorBoundary'
import { PrerenderDataProvider } from '../lib/prerenderData'

/**
 * The single provider tree shared by browser entry (main.jsx) and the
 * prerender entry (entry-server.tsx). Keep both entry points using this —
 * provider drift causes hydration mismatches.
 */
export const AppProviders = ({
  children,
  prerenderData,
}: {
  children: ReactNode
  prerenderData?: Record<string, unknown>
}) => (
  <ErrorBoundary>
    <AuthProvider>
      <ProfileProvider>
        <ToastProvider>
          <AuthModalProvider>
            <PrerenderDataProvider data={prerenderData ?? {}}>{children}</PrerenderDataProvider>
          </AuthModalProvider>
        </ToastProvider>
      </ProfileProvider>
    </AuthProvider>
  </ErrorBoundary>
)
