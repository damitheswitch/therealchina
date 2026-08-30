// Shared UI components for The Real China (TRC).
// Pure functions returning HTML strings.

import { socialPlatforms } from './lib/socialPlatforms.js'

// ===== SVG Icons =====
export const icons = {
  seal: `<svg class="seal-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" stroke="none" opacity="0.15"/><path d="M9 12l2 2 4-4" stroke="currentColor"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" opacity="0.5"/></svg>`,
  star: (filled = true) =>
    `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" class="${filled ? 'star-filled' : 'star-empty'}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  mapPin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  chevron: `<svg class="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chat: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  camera: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  book: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
  pen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  arrowLeft: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
}

// ===== Logo =====
// Red seal-stamp mark with a restrained dragon line motif.
export function logoSVG(size = 36) {
  return `<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Seal stamp body -->
    <rect x="6" y="6" width="36" height="36" rx="5" fill="#A6192E"/>
    <rect x="9" y="9" width="30" height="30" rx="3" fill="none" stroke="#FAF6EF" stroke-width="1.5" opacity="0.9"/>
    <!-- Dragon line motif (restrained, single stroke) -->
    <path d="M16 30c2-3 4-3 6-1s4 2 6-1 4-3 6 0" stroke="#C9A227" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.8"/>
    <!-- TRC monogram -->
    <text x="24" y="27" text-anchor="middle" fill="#FAF6EF" font-family="Noto Serif SC, serif" font-weight="900" font-size="13" letter-spacing="-1">TRC</text>
  </svg>`
}

// ===== Star Rating (display) =====
export function starRating(rating, sizeClass = '') {
  const full = Math.floor(rating)
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75
  const roundedFull = rating - full >= 0.75 ? full + 1 : full
  let html = `<span class="stars ${sizeClass}">`
  for (let i = 1; i <= 5; i++) {
    if (i <= roundedFull) {
      html += icons.star(true)
    } else if (i === roundedFull + 1 && hasHalf) {
      html += `<svg viewBox="0 0 24 24" class="star-filled"><defs><linearGradient id="half-${i}-${Math.random()}"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="none"/></linearGradient></defs><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" opacity="0.5"/></svg>`
    } else {
      html += icons.star(false)
    }
  }
  html += '</span>'
  return html
}

// ===== Seal Badge =====
export function sealBadge(large = false) {
  return `<span class="seal-badge ${large ? 'seal-badge-lg' : ''}">${icons.seal} Verified</span>`
}

// ===== Header =====
export function renderHeader(currentPath) {
  const isActive = (path) => (currentPath === path ? 'color: var(--seal-red);' : '')
  return `<header class="site-header">
    <div class="container header-inner">
      <a href="#/" class="logo-link">
        ${logoSVG(36)}
        <span class="logo-text">The Real <span class="accent">China</span></span>
      </a>
      <nav class="nav-links">
        <a href="#/" class="nav-text-link" style="${isActive('/')}">${icons.book} Universities</a>
        <a href="#/review" class="btn btn-primary" style="${isActive('/review') ? 'background: var(--seal-red-dark);' : ''}">
          ${icons.pen} Leave a Review
        </a>
      </nav>
    </div>
  </header>`
}

// ===== Footer =====
export function renderFooter() {
  return `<footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        ${logoSVG(28)}
        <span class="logo-text">The Real China</span>
      </div>
      <div class="footer-links">
        <a href="#/">Browse Universities</a>
        <a href="#/review">Leave a Review</a>
        <a href="#/">About</a>
      </div>
      <p class="footer-copy">The Real China — Authentic student reviews. Built by the community, for the community.</p>
    </div>
  </footer>`
}

// ===== Social Promo Banner =====
export function socialPromo(platform, handle) {
  if (!platform || !handle) return ''
  const p = socialPlatforms[platform] || socialPlatforms.other
  const icon = icons[p.icon] || icons.link
  return `<div class="review-promo">
    ${icon}
    <span>Reviewer on <strong>${p.label}</strong>: <a href="#" onclick="return false;">${handle}</a></span>
  </div>`
}

// ===== Toast =====
export function showToast(message, type = '') {
  let toast = document.querySelector('.toast')
  if (toast) toast.remove()
  toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
