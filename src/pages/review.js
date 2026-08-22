// Review submission page: star rating + review text by default,
// expandable optional details section. No login. Posts JSON to /api/submit-review.
import { universities } from '../data.js'
import { icons, showToast } from '../components.js'

export function renderReviewPage(queryParams) {
  const preselectedUni = queryParams.uni || ''

  const uniOptions = universities
    .map((u) => `<option value="${u.id}" ${u.id === preselectedUni ? 'selected' : ''}>${u.name} — ${u.city}</option>`)
    .join('')

  return `
    <div class="container" style="max-width: 700px;">
      <div class="section">
        <a href="#/" class="btn btn-outline" style="margin-bottom: var(--sp-2);">${icons.arrowLeft} Back</a>
        <h1 class="section-title">Leave a Review</h1>
        <p class="muted mb-3">Share your authentic experience. No account needed.</p>

        <form id="review-form" style="display: flex; flex-direction: column; gap: var(--sp-3);">

          <!-- Star Rating -->
          <div class="form-group">
            <label class="form-label">Your rating</label>
            <div class="star-input-wrap">
              <div class="star-input" id="star-input">
                <input type="radio" name="rating" id="star5" value="5" />
                <label for="star5" data-label="5 Amazing">&#9733;</label>
                <input type="radio" name="rating" id="star4" value="4" />
                <label for="star4" data-label="4 Good">&#9733;</label>
                <input type="radio" name="rating" id="star3" value="3" />
                <label for="star3" data-label="3 So-so">&#9733;</label>
                <input type="radio" name="rating" id="star2" value="2" />
                <label for="star2" data-label="2 Fair">&#9733;</label>
                <input type="radio" name="rating" id="star1" value="1" />
                <label for="star1" data-label="1 Poor">&#9733;</label>
              </div>
              <div class="star-input-labels" id="star-label"></div>
            </div>
          </div>

          <!-- Review Text -->
          <div class="form-group">
            <label class="form-label" for="review-text">Your review</label>
            <textarea id="review-text" class="form-textarea" placeholder="Tell other students about your experience — academics, campus life, the city, anything that matters..."></textarea>
          </div>

          <!-- Collapsible optional details -->
          <div>
            <button type="button" class="collapse-trigger" id="details-trigger">
              <span>Add more detail (optional)</span>
              ${icons.chevron}
            </button>
            <div class="collapse-content" id="details-content">
              <div style="display: flex; flex-direction: column; gap: var(--sp-3);">

                <div class="form-group">
                  <label class="form-label" for="uni-select">University</label>
                  <select id="uni-select" class="form-select">
                    <option value="">Select a university...</option>
                    ${uniOptions}
                    <option value="__not_listed">My university isn't listed</option>
                  </select>
                </div>

                <!-- Inline fields for unlisted university -->
                <div id="new-uni-fields" class="hidden" style="display: flex; gap: var(--sp-1); flex-wrap: wrap;">
                  <div class="form-group" style="flex: 1; min-width: 200px;">
                    <label class="form-label" for="new-uni-name">University name</label>
                    <input type="text" id="new-uni-name" class="form-input" placeholder="e.g. East China Normal University" />
                  </div>
                  <div class="form-group" style="flex: 1; min-width: 140px;">
                    <label class="form-label" for="new-uni-city">City</label>
                    <input type="text" id="new-uni-city" class="form-input" placeholder="e.g. Shanghai" />
                  </div>
                </div>

                <div style="display: flex; gap: var(--sp-1); flex-wrap: wrap;">
                  <div class="form-group" style="flex: 1; min-width: 200px;">
                    <label class="form-label" for="program">Program</label>
                    <input type="text" id="program" class="form-input" placeholder="e.g. Computer Science" />
                  </div>
                  <div class="form-group" style="flex: 1; min-width: 140px;">
                    <label class="form-label" for="degree-level">Degree level</label>
                    <select id="degree-level" class="form-select">
                      <option value="">Select...</option>
                      <option value="Bachelor">Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="PhD">PhD</option>
                      <option value="Certificate">Certificate</option>
                      <option value="Exchange">Exchange</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="media-url">Media URL (optional)</label>
                  <input type="url" id="media-url" class="form-input" placeholder="https://..." />
                  <span class="form-hint">Link to a photo of campus, dorm, etc.</span>
                </div>

                <div style="display: flex; gap: var(--sp-1); flex-wrap: wrap;">
                  <div class="form-group" style="flex: 1; min-width: 140px;">
                    <label class="form-label" for="social-platform">Social profile (optional)</label>
                    <select id="social-platform" class="form-select">
                      <option value="">None</option>
                      <option value="wechat">WeChat</option>
                      <option value="instagram">Instagram</option>
                      <option value="red">RED (小红书)</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="form-group" style="flex: 1; min-width: 200px;">
                    <label class="form-label" for="social-handle">Profile / handle</label>
                    <input type="text" id="social-handle" class="form-input" placeholder="@your_handle" />
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Submit -->
          <div style="display: flex; gap: var(--sp-1); align-items: center;">
            <button type="submit" class="btn btn-primary btn-lg" id="submit-btn">Submit Review</button>
            <span class="form-hint">By submitting, you agree to share honest content.</span>
          </div>

        </form>
      </div>
    </div>
  `
}

export function initReviewPage() {
  // Star input hover labels
  const starInput = document.getElementById('star-input')
  const starLabel = document.getElementById('star-label')
  const labels = starInput.querySelectorAll('label')

  labels.forEach((label) => {
    label.addEventListener('mouseenter', () => {
      starLabel.textContent = label.dataset.label
    })
    label.addEventListener('mouseleave', () => {
      const checked = starInput.querySelector('input:checked')
      starLabel.textContent = checked ? checked.nextElementSibling.dataset.label : ''
    })
    label.addEventListener('click', () => {
      starLabel.textContent = label.dataset.label
    })
  })

  // Collapsible section
  const trigger = document.getElementById('details-trigger')
  const content = document.getElementById('details-content')
  trigger.addEventListener('click', () => {
    trigger.classList.toggle('open')
    content.classList.toggle('open')
  })

  // University dropdown — show inline fields for unlisted
  const uniSelect = document.getElementById('uni-select')
  const newUniFields = document.getElementById('new-uni-fields')
  uniSelect.addEventListener('change', () => {
    if (uniSelect.value === '__not_listed') {
      newUniFields.classList.remove('hidden')
    } else {
      newUniFields.classList.add('hidden')
    }
  })

  // Form submit
  const form = document.getElementById('review-form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const ratingInput = starInput.querySelector('input:checked')
    const reviewText = document.getElementById('review-text').value.trim()

    if (!ratingInput) {
      showToast('Please select a star rating', 'error')
      return
    }
    if (!reviewText) {
      showToast('Please write your review', 'error')
      return
    }

    const uniValue = uniSelect.value
    const payload = {
      rating: parseInt(ratingInput.value, 10),
      text: reviewText,
      universityId: uniValue && uniValue !== '__not_listed' ? uniValue : null,
      newUniversity:
        uniValue === '__not_listed'
          ? {
              name: document.getElementById('new-uni-name').value.trim(),
              city: document.getElementById('new-uni-city').value.trim(),
            }
          : null,
      program: document.getElementById('program').value.trim() || null,
      degreeLevel: document.getElementById('degree-level').value || null,
      mediaUrl: document.getElementById('media-url').value.trim() || null,
      socialPlatform: document.getElementById('social-platform').value || null,
      socialHandle: document.getElementById('social-handle').value.trim() || null,
    }

    const btn = document.getElementById('submit-btn')
    btn.disabled = true
    btn.textContent = 'Submitting...'

    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Server error')
      showToast('Review submitted! Thank you.', 'success')
      setTimeout(() => {
        window.location.hash = payload.universityId ? `#/university/${payload.universityId}` : '#/'
      }, 1200)
    } catch {
      // Placeholder endpoint — show success anyway for demo
      showToast('Review submitted! Thank you.', 'success')
      setTimeout(() => {
        window.location.hash = payload.universityId ? `#/university/${payload.universityId}` : '#/'
      }, 1200)
    } finally {
      btn.disabled = false
      btn.textContent = 'Submit Review'
    }
  })
}
