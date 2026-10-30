import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { MIN_OWN_UNITS, type RewardEvaluation } from '../../lib/reviewReward'

// Collapsible "free VPN for a full review" box shown under the detail bar on
// every form screen while the offer is on. It tells people the gift exists
// before they write, and shows how close the review is to "full". Progress is
// announced politely (role=status); nothing opens or moves on its own.
export const RewardTeaser = ({ evaluation }: { evaluation: RewardEvaluation }) => {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const done = 3 - evaluation.missing.length
  const has = (key: 'words' | 'taps' | 'details') => !evaluation.missing.includes(key)

  return (
    <div className="reward-teaser">
      <button
        type="button"
        className="reward-teaser-head"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">🎁</span>
        <span className="reward-teaser-title">
          {evaluation.full
            ? 'Your review is full. Your free VPN gift is ready when you publish.'
            : 'Finish a full review, get a very fast VPN for free (limited time).'}
        </span>
        <span className="reward-teaser-count" role="status">
          {done} of 3 done
        </span>
      </button>
      {open && (
        <div id={panelId} className="reward-teaser-body">
          <p>We say thank you with a free VPN. Good or bad review, the gift is the same.</p>
          <ul className="reward-checklist">
            <li className={has('words') ? 'done' : ''}>
              {MIN_OWN_UNITS} words in your own words ({evaluation.ownUnits} so far)
            </li>
            <li className={has('taps') ? 'done' : ''}>2 taps on What stood out</li>
            <li className={has('details') ? 'done' : ''}>
              4 details: major, ratings, costs, dates or a photo
            </li>
          </ul>
          <p>Add your email on the last screen. We send you the steps.</p>
          <p>One gift per person. 2GB free, one time.</p>
          <Link to="/editorial-policy#gifts">How gifts work</Link>
        </div>
      )}
    </div>
  )
}
