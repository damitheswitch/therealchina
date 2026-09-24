import { useState, useEffect } from 'react'
import { Icons } from './Icons'

export const MediaGallery = ({ media, maxVisible = 0 }) => {
  const [activeMediaIndex, setActiveMediaIndex] = useState(null)

  // Normalize media items (support array of objects or strings)
  const items = (media || []).map((item) => {
    if (typeof item === 'string') {
      const isVideo = item.match(/\.(mp4|webm|mov)$/i)
      return { url: item, type: isVideo ? 'video' : 'image', name: '' }
    }
    return item
  })

  // Optional cap on rendered tiles — the last visible tile carries a
  // "+N more" overlay and opens the lightbox on the first hidden item.
  const visible = maxVisible > 0 ? items.slice(0, maxVisible) : items
  const hiddenCount = items.length - visible.length

  // Keyboard navigation for Lightbox modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeMediaIndex === null) return
      if (e.key === 'Escape') {
        setActiveMediaIndex(null)
      } else if (e.key === 'ArrowRight') {
        setActiveMediaIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowLeft') {
        setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeMediaIndex, items.length])

  if (!items || items.length === 0) return null

  const activeItem = activeMediaIndex !== null ? items[activeMediaIndex] : null

  return (
    <div className="review-media-gallery">
      <div className={`media-grid grid-count-${Math.min(visible.length, 4)}`}>
        {visible.map((item, index) => {
          const isVideo = item.type === 'video'
          const isMoreTile = hiddenCount > 0 && index === visible.length - 1
          return (
            <div
              key={index}
              className={`gallery-item ${isVideo ? 'item-video' : 'item-image'}`}
              onClick={() => setActiveMediaIndex(isMoreTile ? index + 1 : index)}
            >
              {isVideo ? (
                <div className="video-grid-preview">
                  <video src={item.url} preload="metadata" muted />
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

      {/* Lightbox Modal */}
      {activeItem && (
        <div className="media-lightbox-overlay" onClick={() => setActiveMediaIndex(null)}>
          <div className="lightbox-container" onClick={(e) => e.stopPropagation()}>
            {/* Header controls */}
            <div className="lightbox-header">
              <span className="lightbox-counter">
                {activeMediaIndex + 1} of {items.length}
              </span>
              <button
                type="button"
                className="lightbox-close-btn"
                onClick={() => setActiveMediaIndex(null)}
                aria-label="Close modal"
              >
                <Icons.X />
              </button>
            </div>

            {/* Content view */}
            <div className="lightbox-content">
              {activeItem.type === 'video' ? (
                <video
                  src={activeItem.url}
                  controls
                  autoPlay
                  className="lightbox-video"
                  controlsList="nodownload"
                />
              ) : (
                <img
                  src={activeItem.url}
                  alt={activeItem.name || 'Full review photo'}
                  className="lightbox-image"
                />
              )}
            </div>

            {/* Navigation controls if multiple items */}
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-nav-btn nav-prev"
                  onClick={() =>
                    setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1))
                  }
                  aria-label="Previous item"
                >
                  ❮
                </button>
                <button
                  type="button"
                  className="lightbox-nav-btn nav-next"
                  onClick={() =>
                    setActiveMediaIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0))
                  }
                  aria-label="Next item"
                >
                  ❯
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
