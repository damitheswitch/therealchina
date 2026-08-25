import { Icons } from './Icons'

// SealBadge component - verified badge
export const SealBadge = ({ large = false }) => (
  <span className={`seal-badge ${large ? 'seal-badge-lg' : ''}`}>
    <Icons.Seal /> Verified
  </span>
)
