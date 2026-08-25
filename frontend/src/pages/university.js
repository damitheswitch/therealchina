// University profile page: name/city header, aggregate rating, review feed.
import { getUniversityById, getReviewsForUniversity, getUniversityStats } from '../data.js'
import { starRating, sealBadge, icons, socialPromo } from '../components.js'

export function renderUniversityPage(uniId) {
  const uni = getUniversityById(uniId)
  if (!uni) {
    return `<div class="container"><div class="empty-state" style="padding-top: 6rem;">
      <h1>University not found</h1>
      <p>This university doesn't exist in our database.</p>
      <a href="#/" class="btn btn-primary mt-2">${icons.arrowLeft} Back to all universities</a>
    </div></div>`
  }

  const stats = getUniversityStats(uniId)
  const uniReviews = getReviewsForUniversity(uniId)

  const ratingBlock = stats.count > 0
    ? `<div class="uni-profile-rating-block">
        <span class="rating-number">${stats.avgRating.toFixed(1)}</span>
        <div class="rating-info">
          ${starRating(stats.avgRating, 'stars-lg')}
          <span class="count">Based on ${stats.count} review${stats.count !== 1 ? 's' : ''}</span>
        </div>
        ${stats.hasVerified ? sealBadge(true) : ''}
      </div>`
    : `<div class="uni-profile-rating-block">
        <span class="rating-number">—</span>
        <div class="rating-info">
          ${starRating(0, 'stars-lg')}
          <span class="count">No reviews yet — be the first!</span>
        </div>
      </div>`

  const reviewsHTML =
    uniReviews.length > 0
      ? uniReviews
          .map((r) => {
            const tags = [r.program, r.degreeLevel].filter(Boolean)
            const tagsHTML = tags.length
              ? `<div class="review-tags">${tags.map((t) => `<span class="review-tag">${t}</span>`).join('')}</div>`
              : ''
            const imgHTML = r.mediaUrl ? `<img src="${r.mediaUrl}" alt="Review photo" class="review-img" loading="lazy" />` : ''
            const promoHTML = socialPromo(r.socialPlatform, r.socialHandle)

            return `<div class="review-card fade-in">
              <div class="review-header">
                ${starRating(r.rating)}
                <div class="review-meta">
                  ${r.verified ? sealBadge() : ''}
                  <span>${r.date}</span>
                </div>
              </div>
              <p class="review-text">${r.text}</p>
              ${imgHTML}
              ${tagsHTML}
              ${promoHTML}
            </div>`
          })
          .join('')
      : `<div class="empty-state">
          <h3>No reviews yet</h3>
          <p>Be the first to share your experience at ${uni.name}.</p>
          <a href="#/review?uni=${uni.id}" class="btn btn-primary mt-2">${icons.pen} Leave a Review</a>
        </div>`

  return `
    <div class="container">
      <a href="#/" class="btn btn-outline mt-3" style="margin-bottom: 0;">${icons.arrowLeft} All universities</a>
      <div class="uni-profile-header">
        <div class="uni-profile-top">
          <div class="uni-profile-name-block">
            <div class="uni-profile-city">${icons.mapPin} ${uni.city}</div>
            <h1>${uni.name}</h1>
            <div class="uni-profile-name-zh">${uni.nameZh}</div>
          </div>
          <a href="#/review?uni=${uni.id}" class="btn btn-primary btn-lg">${icons.pen} Leave a Review</a>
        </div>
        ${ratingBlock}
      </div>
      <div class="section" style="padding-top: var(--sp-2);">
        <h2 class="section-title">Student Reviews</h2>
        <div class="review-list">
          ${reviewsHTML}
        </div>
      </div>
    </div>
  `
}
