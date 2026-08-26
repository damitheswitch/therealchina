import { useState, useRef, useEffect } from 'react'
import { Icons } from './Icons'
import {
  validateMediaFile,
  uploadSingleMedia,
  MAX_FILES,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
} from '../lib/mediaUpload'
import { useToast } from '../contexts/ToastContext'

let nextItemId = 0

const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * Media attachment picker with eager upload.
 * Each selected file starts uploading to Supabase immediately (before the
 * review is submitted) and reports its progress on its thumbnail tile.
 *
 * Reports upward via onStateChange({ media, uploading, errorCount }):
 *  - media: successfully uploaded items ready to attach to the review
 *  - uploading: true while any attachment is still in flight
 *  - errorCount: number of tiles in the error state (skipped on submit)
 */
export const MediaUploader = ({ disabled, onStateChange }) => {
  const fileInputRef = useRef(null)
  const itemsRef = useRef([])
  const [items, setItems] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Derive the state the parent (review submit) cares about
  useEffect(() => {
    onStateChange?.({
      media: items.filter((it) => it.status === 'done').map((it) => it.media),
      uploading: items.some((it) => it.status === 'uploading'),
      errorCount: items.filter((it) => it.status === 'error').length,
    })
  }, [items, onStateChange])

  // Release preview URLs when the component unmounts
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl))
    }
  }, [])

  const startUpload = (item) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading', error: null } : it))
    )

    uploadSingleMedia(item.file)
      .then((media) => {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'done', media } : it))
        )
      })
      .catch((err) => {
        setItems((prev) =>
          prev.some((it) => it.id === item.id)
            ? prev.map((it) =>
                it.id === item.id ? { ...it, status: 'error', error: err.message } : it
              )
            : prev
        )
        showToast(err.message || `Failed to upload ${item.file.name}`, 'error')
      })
  }

  const handleFilesAdded = (newFiles) => {
    if (disabled) return
    const incomingList = Array.from(newFiles)
    const room = MAX_FILES - items.length

    if (room <= 0) {
      showToast(`You can attach a maximum of ${MAX_FILES} photos/videos.`, 'error')
      return
    }
    if (incomingList.length > room) {
      showToast(`Only ${room} more can be added (max ${MAX_FILES} per review).`, 'error')
    }

    const accepted = []
    for (const file of incomingList.slice(0, room)) {
      const validation = validateMediaFile(file)
      if (!validation.valid) {
        showToast(validation.error, 'error')
      } else {
        accepted.push({
          id: nextItemId++,
          file,
          type: validation.type,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          media: null,
          error: null,
        })
      }
    }

    if (accepted.length > 0) {
      setItems((prev) => [...prev, ...accepted])
      accepted.forEach(startUpload)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files)
      // reset value so re-selecting the same file triggers change
      e.target.value = ''
    }
  }

  const handleRemove = (id) => {
    if (disabled) return
    const item = itemsRef.current.find((it) => it.id === id)
    if (item) URL.revokeObjectURL(item.previewUrl)
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleRetry = (item) => {
    if (disabled) return
    startUpload(item)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files)
    }
  }

  const atMax = items.length >= MAX_FILES

  return (
    <div className="media-uploader">
      <div className="media-uploader-header">
        <span className="form-label">Photos &amp; videos</span>
        <span className="media-max-hint">
          <Icons.Image /> Max {MAX_FILES} attachments
        </span>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Dropzone / call-to-action */}
      <div
        className={`media-dropzone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''} ${
          items.length > 0 ? 'compact' : ''
        } ${atMax ? 'at-max' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Add photos or videos to your review"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !atMax && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !atMax) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <div className="dropzone-icon">
          <Icons.Camera />
        </div>
        <div className="dropzone-copy">
          <p className="dropzone-text">
            {atMax ? (
              <>
                <strong>Maximum attachments reached</strong> — remove one to add more
              </>
            ) : items.length > 0 ? (
              <>
                <strong>Add more</strong> photos or videos
              </>
            ) : (
              <>
                <strong>Add photos or videos</strong>
                <span className="dropzone-sub">
                  Dorms, campus, food — help other students see it for themselves
                </span>
              </>
            )}
          </p>
          {items.length === 0 && (
            <p className="dropzone-hint">
              Click or drag &amp; drop · JPG, PNG, WEBP, GIF up to {MAX_IMAGE_SIZE_MB}MB · MP4, WEBM,
              MOV up to {MAX_VIDEO_SIZE_MB}MB
            </p>
          )}
        </div>
      </div>

      {/* Attachment tiles */}
      {items.length > 0 && (
        <div className="media-previews-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className={`media-tile status-${item.status}`}
              title={item.error ? `${item.file.name} — ${item.error}` : item.file.name}
              onClick={() => item.status === 'error' && handleRetry(item)}
            >
              {item.type === 'video' ? (
                <>
                  <video
                    src={item.previewUrl + '#t=0.1'}
                    preload="metadata"
                    muted
                    playsInline
                  />
                  <span className="tile-type-badge">
                    <Icons.Video /> VIDEO
                  </span>
                </>
              ) : (
                <img src={item.previewUrl} alt={item.file.name} />
              )}

              {item.status === 'uploading' && (
                <div className="tile-uploading">
                  <span className="spinner" aria-label="Uploading" />
                  <span className="tile-status-label">
                    {item.type === 'video' ? 'Processing video' : 'Uploading'} ·{' '}
                    {formatFileSize(item.file.size)}
                  </span>
                </div>
              )}

              {item.status === 'done' && (
                <span className="tile-done-badge" title="Uploaded">
                  <Icons.Check />
                </span>
              )}

              {item.status === 'error' && (
                <div className="tile-error">
                  <span className="tile-error-icon">
                    <Icons.AlertCircle />
                  </span>
                  <span className="tile-status-label">
                    Failed — click to retry
                  </span>
                </div>
              )}

              <button
                type="button"
                className="remove-media-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(item.id)
                }}
                title="Remove attachment"
                aria-label={`Remove ${item.file.name}`}
                disabled={disabled}
              >
                <Icons.X />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
