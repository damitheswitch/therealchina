import type { ReactNode } from 'react'

interface Props {
  href: string
  children: ReactNode
  className?: string
}

/**
 * The ONLY way to render a user-supplied URL: always ugc + nofollow so
 * crawlers don't follow user-placed links. New tab + noopener for safety.
 */
export const UserLink = ({ href, children, className }: Props) => (
  <a href={href} className={className} target="_blank" rel="ugc nofollow noopener noreferrer">
    {children}
  </a>
)
