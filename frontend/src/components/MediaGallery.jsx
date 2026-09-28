import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icons } from './Icons'
import { normalizeMediaItems } from '../lib/reviewDisplay'

const SWIPE_THRESHOLD_PX = 50

export const MediaGallery = ({ media, maxVisible = 0 }) => {
  const [activeMediaIndex, setActiveMediaIndex] = useState(null)
  const [mediaStatus, setMediaStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [retryNonce, setRetryNonce] = useState(0)
  const lightboxRef = useRef(null)
  const closeBtnRef = useRef(null)
  const touchStart = useRef(null)

  // Normalize media items (support array of objects or strings)
  const items = normalizeMediaItems(media)

  // Optional cap on rendered tiles — the last visible tile carries a
  // "+N more" overlay and opens the lightbox on the first hidden item.
  const visible = maxVisible > 0 ? items.slice(0, maxVisible) : items
  const hiddenCount = items.length - visible.length

  const isOpen = activeMediaIndex !== null
  const activeItem = isOpen ? items[activeMediaIndex] : null

  const close = useCallback(() => setActiveMediaIndex(null), [])
  const goPrev = useCallback(
    () =>
      setActiveMediaIndex((prev) =>
        prev === null ? prev : prev > 0 ? prev - 1 : items.length - 1
      ),
    [items.length]
  )
  const goNext = useCallback(
    () =>
      setActiveMediaIndex((prev) =>
        prev === null ? prev : prev < items.length - 1 ? prev + 1 : 0
      ),
    [items.length]
  )
  const retry = useCallback(() => {
    setMediaStatus('loading')
    setRetryNonce((n) => n + 1)
  }, [])

  // Keyboard navigation + focus trap for the lightbox dialog.
  // Arrow keys are left alone while the video element has focus so native
  // seeking/volume still works.
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        close()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (document.activeElement?.tagName === 'VIDEO') return
        if (e.key === 'ArrowRight') goNext()
        else goPrev()
      } else if (e.key === 'Tab' && lightboxRef.current) {
        const focusables = lightboxRef.current.querySelectorAll('button, video')
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!lightboxRef.current.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close, goPrev, goNext])

  // While the lightbox is open: lock page scroll, move focus into the dialog,
  // and restore both on close.
  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [isOpen])

  // Reset the load state each time the viewer moves to a new item.
  useEffect(() => {
    if (isOpen) setMediaStatus('loading')
  }, [isOpen, activeMediaIndex])

  if (!items || items.length === 0) return null

  // Horizontal swipe navigation (right-to-left swipe = next), ignored when a
  // vertical scroll dominates.
  const handleTouchStart = (e) => {
    // Don't hijack gestures that start on the video element — the user is
    // interacting with native controls (e.g. scrubbing the timeline).
    if (e.target.tagName === 'VIDEO') {
      touchStart.current = null
      return
    }
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
    }
  }

  const lightbox =
    activeItem &&
    createPortal(
      <div
        className="media-lightbox-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Review media viewer"
        ref={lightboxRef}
        onClick={close}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="lightbox-topbar" onClick={(e) => e.stopPropagation()}>
          <span className="lightbox-counter" aria-live="polite">
            {activeMediaIndex + 1} / {items.length}
          </span>
          <button
            type="button"
            className="lightbox-close-btn"
            onClick={close}
            aria-label="Close media viewer"
            ref={closeBtnRef}
          >
            <Icons.X />
          </button>
        </div>

        <div className="lightbox-stage">
          {items.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn nav-prev"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
              aria-label="Previous media"
            >
              <Icons.ChevronLeft />
            </button>
          )}

          {mediaStatus === 'loading' && <div className="lightbox-spinner" aria-hidden="true" />}

          {mediaStatus === 'error' ? (
            <div className="lightbox-error" role="alert" onClick={(e) => e.stopPropagation()}>
              <p>
                {activeItem.type === 'video'
                  ? 'This video could not be loaded. The format may not be supported by your browser.'
                  : 'This photo could not be loaded.'}
              </p>
              <button type="button" className="lightbox-retry-btn" onClick={retry}>
                Try again
              </button>
            </div>
          ) : activeItem.type === 'video' ? (
            <video
              key={`${activeItem.url}-${retryNonce}`}
              ref={(el) => {
                // Cached media can finish loading before React attaches the
                // event handlers — catch that so it never stays invisible.
                if (el && el.readyState >= 3) setMediaStatus('ready')
              }}
              src={activeItem.url}
              controls
              autoPlay
              playsInline
              preload="auto"
              className={`lightbox-media lightbox-video ${mediaStatus === 'ready' ? 'is-ready' : ''}`}
              controlsList="nodownload"
              onCanPlay={() => setMediaStatus('ready')}
              onError={() => setMediaStatus('error')}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              key={`${activeItem.url}-${retryNonce}`}
              ref={(el) => {
                if (el && el.complete && el.naturalWidth > 0) setMediaStatus('ready')
              }}
              src={activeItem.url}
              alt={activeItem.name || `Review photo ${activeMediaIndex + 1}`}
              className={`lightbox-media lightbox-image ${mediaStatus === 'ready' ? 'is-ready' : ''}`}
              onLoad={() => setMediaStatus('ready')}
              onError={() => setMediaStatus('error')}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {items.length > 1 && (
            <button
              type="button"
              className="lightbox-nav-btn nav-next"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
              aria-label="Next media"
            >
              <Icons.ChevronRight />
            </button>
          )}
        </div>
      </div>,
      document.body
    )

  return (
    <div className="review-media-gallery">
      <div className={`media-grid grid-count-${Math.min(visible.length, 4)}`}>
        {visible.map((item, index) => {
          const isVideo = item.type === 'video'
          const isMoreTile = hiddenCount > 0 && index === visible.length - 1
          return (
            <div
              key={item.url}
              className={`gallery-item ${isVideo ? 'item-video' : 'item-image'}`}
              onClick={() => setActiveMediaIndex(isMoreTile ? index + 1 : index)}
            >
              {isVideo ? (
                <div className="video-grid-preview">
                  <video src={item.url} preload="metadata" muted playsInline />
                  <div className="play-overlay">
                    <div className="play-btn-circle">
                      <Icons.Play />
                    </div>
                  </div>
                  <span className="video-label">
                    <Icons.Video /> Video
                  </span>
                  {isMoreTile && (
                    <div className="more-photos-overlay">
                      +{hiddenCount} more photo{hiddenCount === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="image-grid-preview">
                  <img
                    src={item.url}
                    alt={item.name || `Review photo ${index + 1}`}
                    loading="lazy"
                  />
                  {isMoreTile ? (
                    <div className="more-photos-overlay">
                      +{hiddenCount} more photo{hiddenCount === 1 ? '' : 's'}
                    </div>
                  ) : (
                    <div className="zoom-hover-hint">
                      <Icons.Maximize />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {lightbox}
    </div>
  )
}
