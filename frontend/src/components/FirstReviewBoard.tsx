import { Link } from 'react-router-dom'
import { UniversityLogo } from './UniversityLogo'
import { useFirstReviewCandidates } from '../hooks/useFirstReviewCandidates'

// Homepage board of well-known universities nobody has reviewed yet. Each row
// deep-links into the review wizard with the university already chosen.
export const FirstReviewBoard = () => {
  const candidates = useFirstReviewCandidates()
  if (candidates.length === 0) return null

  return (
    <section className="first-review-board" aria-labelledby="first-review-title">
      <h2 id="first-review-title">Waiting for a first review</h2>
      <p className="muted">
        Study at one of these? Yours would be the first story future students see. It takes about 30
        seconds and stays anonymous.
      </p>
      <ul className="first-review-list">
        {candidates.map((u) => (
          <li key={u.id} className="first-review-item">
            <UniversityLogo name={u.name} logoUrl={u.logo_url} size={48} />
            <div className="first-review-name">
              <strong>{u.name}</strong>
              <span className="muted">{u.name_zh || u.city || u.province}</span>
            </div>
            <Link
              to={`/review?uni=${encodeURIComponent(u.slug)}`}
              className="btn btn-outline"
              aria-label={`Write the first review of ${u.name}`}
            >
              Be the first
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
