import { useState } from 'react'

// Prototype vote pill: toggles local state only. The real version calls
// toggle_question_upvote / toggle_answer_upvote RPCs.
export const VotePill = ({ count, label }: { count: number; label?: string }) => {
  const [upvoted, setUpvoted] = useState(false)
  const shown = count + (upvoted ? 1 : 0)

  return (
    <button
      type="button"
      className={`upvote-btn${upvoted ? ' active' : ''}`}
      aria-pressed={upvoted}
      onClick={() => setUpvoted((v) => !v)}
    >
      👍 {label ? `${label} ` : ''}({shown})
    </button>
  )
}
