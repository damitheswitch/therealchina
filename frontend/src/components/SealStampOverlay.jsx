import { useEffect, useState } from 'react'

/**
 * SealStampOverlay
 *
 * A full-screen celebration overlay that plays when a review is successfully
 * submitted. A large TRC seal stamp swings down and imprints with a gold ink
 * ripple, then the overlay fades and `onComplete` fires.
 *
 * Brand-anchored: seal-red (#A6192E), antique gold (#C9A227), rice-paper
 * (#FAF6EF). Pure CSS — no external assets.
 *
 * @param {() => void} onComplete  Called once the animation finishes.
 * @param {number} duration         Total animation length in ms (default 1600).
 */
export const SealStampOverlay = ({ onComplete, duration = 2500 }) => {
  const [phase, setPhase] = useState('impact') // 'impact' | 'hold' | 'fade'

  // Impact hits ~450ms in; hold until ~2050ms; then fade out over ~450ms.
  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 450)
    const fadeTimer = setTimeout(() => setPhase('fade'), 2050)
    const doneTimer = setTimeout(() => onComplete?.(), duration)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onComplete, duration])

  return (
    <div className={`seal-stamp-overlay seal-stamp-${phase}`} role="status" aria-live="polite">
      <div className="seal-stamp-ripple" aria-hidden="true" />
      <div className="seal-stamp-ripple seal-stamp-ripple-2" aria-hidden="true" />
      <div className="seal-stamp-mark" aria-hidden="true">
        <svg
          width="180"
          height="180"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Seal stamp body */}
          <rect x="6" y="6" width="36" height="36" rx="5" fill="#A6192E" />
          <rect
            x="9"
            y="9"
            width="30"
            height="30"
            rx="3"
            fill="none"
            stroke="#FAF6EF"
            strokeWidth="1.5"
            opacity="0.9"
          />
          {/* Dragon line motif */}
          <path
            d="M16 30c2-3 4-3 6-1s4 2 6-1 4-3 6 0"
            stroke="#C9A227"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          {/* TRC monogram */}
          <text
            x="24"
            y="27"
            textAnchor="middle"
            fill="#FAF6EF"
            fontFamily="Noto Serif SC, serif"
            fontWeight="900"
            fontSize="13"
            letterSpacing="-1"
          >
            TRC
          </text>
        </svg>
      </div>
      <div className="seal-stamp-text">
        <span className="seal-stamp-text-zh">已发布</span>
        <span className="seal-stamp-text-en">Review Posted</span>
      </div>
    </div>
  )
}
