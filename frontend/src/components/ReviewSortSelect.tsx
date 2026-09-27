import { REVIEW_SORT_OPTIONS, type ReviewSort } from '../lib/reviewSort'

// Compact "Sort: …" dropdown for review lists. Shares the .filter-select
// styling used by the university directory; .review-sort-select tightens it
// so it can sit beside a section title.
export const ReviewSortSelect = ({
  value,
  onChange,
}: {
  value: ReviewSort
  onChange: (sort: ReviewSort) => void
}) => (
  <select
    className="filter-select review-sort-select"
    aria-label="Sort reviews"
    value={value}
    onChange={(e) => onChange(e.target.value as ReviewSort)}
  >
    {REVIEW_SORT_OPTIONS.map((o) => (
      <option key={o.value} value={o.value}>
        Sort: {o.label}
      </option>
    ))}
  </select>
)
