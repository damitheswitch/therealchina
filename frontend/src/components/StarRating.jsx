import { Icons } from './Icons'

// StarRating component - displays rating as stars
export const StarRating = ({ rating, sizeClass = '' }) => {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75
  const roundedFull = rating - full >= 0.75 ? full + 1 : full

  return (
    <span className={`stars ${sizeClass}`}>
      {[1, 2, 3, 4, 5].map((i) => {
        if (i <= roundedFull) {
          return <Icons.Star key={i} filled={true} />
        } else if (i === roundedFull + 1 && hasHalf) {
          return (
            <svg key={i} viewBox="0 0 24 24" className="star-filled">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" opacity="0.5"/>
            </svg>
          )
        } else {
          return <Icons.Star key={i} filled={false} />
        }
      })}
    </span>
  )
}
