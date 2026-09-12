import { Icons } from './Icons'
import { StarRating } from './StarRating'
import { formatReviewerMix, getRecommendMeta } from '../lib/reviewDisplay'
import { TUITION_RANGES, LIVING_COSTS } from '../lib/constants'
import type { ReviewSummary as ReviewSummaryData } from '../lib/reviewSummary'

const RECOMMEND_KEYS = ['yes', 'maybe', 'no'] as const

// Stepped cost scale: one segment per wizard bucket, cheap → expensive.
// Segments up to the reported bucket get a light fill and the reported
// bucket itself gets the solid mark — reads as a position without the
// false precision of a dot on a continuous gradient. Decorative; the
// range text carries the actual value.
const CostScale = ({
  label,
  buckets,
  value,
  suffix,
}: {
  label: string
  buckets: string[]
  value: string
  suffix: string
}) => {
  const idx = buckets.indexOf(value)
  return (
    <div className="cost-row">
      <span className="cost-label">{label}</span>
      <span className="cost-scale" aria-hidden="true">
        {buckets.map((b, i) => (
          <span
            key={b}
            className={`cost-seg${i < idx ? ' filled' : ''}${i === idx ? ' on' : ''}`}
          />
        ))}
      </span>
      <span className="cost-val">
        {value}
        {suffix}
      </span>
    </div>
  )
}

// Aggregate "student verdict" card shown on the university page under the
// rating strip. Purely presentational — every number arrives pre-computed
// from buildReviewSummary(), so it always matches the review list below.
export const ReviewSummary = ({ summary }: { summary: ReviewSummaryData }) => {
  if (summary.reviewCount === 0) return null

  const { reviewCount, ratingDist, recommend, subscores, topTags, enrollment } = summary
  const reviewerMix = formatReviewerMix(enrollment)
  const hasCost = Boolean(summary.modalLivingCost) || Boolean(summary.modalTuition)
  const hasFooter = topTags.length > 0 || hasCost || reviewerMix !== ''

  return (
    <section className="uni-summary">
      <h2 className="uni-summary-title">Student verdict</h2>

      <div className="uni-summary-grid">
        <div className="sum-col">
          <h3 className="sum-col-title">Rating breakdown</h3>
          <div className="hist-list">
            {ratingDist.map(({ stars, count }) => (
              <div
                key={stars}
                className="hist-row"
                aria-label={`${stars} star${stars === 1 ? '' : 's'}: ${count} review${count === 1 ? '' : 's'}`}
              >
                <span className="hist-label">
                  {stars} <Icons.Star />
                </span>
                <span className="hist-track" aria-hidden="true">
                  <span
                    className="hist-fill"
                    style={{ width: `${(count / reviewCount) * 100}%` }}
                  />
                </span>
                <span className="hist-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sum-col">
          <h3 className="sum-col-title">Recommend</h3>
          {recommend.answered === 0 ? (
            <p className="sum-note">No recommendation data yet</p>
          ) : (
            <>
              <div className="rec-bar" aria-hidden="true">
                {RECOMMEND_KEYS.map((k) =>
                  recommend[k] > 0 ? (
                    <span
                      key={k}
                      className={`rec-seg rec-${k}`}
                      style={{ flexGrow: recommend[k] }}
                    />
                  ) : null
                )}
              </div>
              <div className="rec-legend">
                {RECOMMEND_KEYS.filter((k) => recommend[k] > 0).map((k) => {
                  const meta = getRecommendMeta(k)
                  return (
                    <span key={k} className={`review-recommend rec-${k}`}>
                      <span aria-hidden="true">{meta?.emoji}</span>{' '}
                      <span className="sr-only">{meta?.label}</span>
                      {recommend[`${k}Pct`]}%
                    </span>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="sum-col">
          <h3 className="sum-col-title">By category</h3>
          {subscores.length < 3 ? (
            <p className="sum-note">Not enough category data yet</p>
          ) : (
            <div className="cat-list">
              {subscores.map((s) => (
                <div key={s.key} className="cat-row">
                  <span className="cat-label">{s.label}</span>
                  <span className="cat-val">
                    <StarRating rating={s.avg} sizeClass="stars-sm" />
                    <span className="cat-avg">{s.avg.toFixed(1)}</span>
                    {s.count < reviewCount && (
                      <span
                        className="cat-n"
                        title={`${s.count} reviewer${s.count === 1 ? '' : 's'} rated this`}
                      >
                        ({s.count})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasFooter && (
        <div className="uni-summary-footer">
          {topTags.length > 0 && (
            <div className="chip-row">
              {topTags.map(({ tag, count }) => (
                <span key={tag} className="chip">
                  {tag}
                  {count >= 2 ? ` ×${count}` : ''}
                </span>
              ))}
            </div>
          )}
          {summary.modalLivingCost && (
            <CostScale
              label="Living cost"
              buckets={LIVING_COSTS}
              value={summary.modalLivingCost}
              suffix="/mo"
            />
          )}
          {summary.modalTuition && (
            <CostScale
              label="Tuition"
              buckets={TUITION_RANGES}
              value={summary.modalTuition}
              suffix="/yr"
            />
          )}
          {reviewerMix && <p className="sum-note">{reviewerMix}</p>}
        </div>
      )}

      {reviewCount <= 4 && (
        <p className="early-note">
          <Icons.Info /> Early data — based on {reviewCount} review{reviewCount === 1 ? '' : 's'} so
          far
        </p>
      )}
    </section>
  )
}
