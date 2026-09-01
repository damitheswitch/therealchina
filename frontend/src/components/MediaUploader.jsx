import { useState, useRef, useEffect, useCallback } from 'react'
import { Icons } from './Icons'
import {
  validateMediaFile,
  createUploadSession,
  uploadFile,
  MAX_FILES,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
} from '../lib/mediaUpload'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { Turnstile } from '@marsidev/react-turnstile'

const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * Media attachment picker with eager upload.
 * Each selected file starts uploading through the media-upload Edge Function
 * as soon as files are picked, using a short-lived session.
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
  const { user } = useAuth()

  const [session, setSession] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const turnstileLoadedRef = useRef(false)
  const resolveTurnstileLoaded = useRef(null)
  const turnstileLoadedPromiseRef = useRef(null)
  const turnstileRef = useRef(null)
  const nextItemIdRef = useRef(0)

  // Created on demand from event handlers/effects only: refs must not be
  // written during render (breaks under StrictMode / concurrent rendering).
  const getTurnstileReadyPromise = () => {
    if (!turnstileLoadedPromiseRef.current) {
      turnstileLoadedPromiseRef.current = new Promise((resolve) => {
        resolveTurnstileLoaded.current = resolve
      })
    }
    return turnstileLoadedPromiseRef.current
  }

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Sync the Turnstile ready flag and resolve the one-time promise when loaded.
  useEffect(() => {
    turnstileLoadedRef.current = turnstileLoaded
    if (turnstileLoaded && resolveTurnstileLoaded.current) {
      resolveTurnstileLoaded.current()
      resolveTurnstileLoaded.current = null
    }
  }, [turnstileLoaded])

  // Derive the state the parent (review submit) cares about
  useEffect(() => {
    onStateChange?.({
      media: items.filter((it) => it.status === 'done').map((it) => it.media),
      uploading: items.some((it) => it.status === 'uploading') || verifying,
      errorCount: items.filter((it) => it.status === 'error').length,
    })
  }, [items, verifying, onStateChange])

  // Release preview URLs when the component unmounts
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl))
    }
  }, [])

  const getTurnstileToken = useCallback(async () => {
    if (!turnstileRef.current) {
      throw new Error('Turnstile widget is not ready')
    }
    if (!turnstileLoadedRef.current) {
      await Promise.race([
        getTurnstileReadyPromise(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Turnstile widget took too long to load')), 10000)
        ),
      ])
    }
    if (!turnstileRef.current) {
      throw new Error('Turnstile widget is not ready')
    }
    // Wait for the widget to solve. With execution: 'render' it will
    // auto-solve and getResponsePromise returns the token.
    const token = await turnstileRef.current.getResponsePromise(30000, 250)
    if (!token) throw new Error('Turnstile verification failed')
    return token
  }, [])

  const ensureSession = useCallback(async () => {
    if (session && new Date(session.expiresAt) > new Date()) {
      return session.sessionId
    }
    if (verifying) {
      throw new Error('Upload verification is already in progress')
    }
    setVerifying(true)
    try {
      let cfToken
      if (!user) {
        cfToken = await getTurnstileToken()
      }
      const data = await createUploadSession({ cfToken })
      setSession(data)
      return data.sessionId
    } finally {
      setVerifying(false)
    }
  }, [session, user, verifying, getTurnstileToken])

  const handleUploadError = useCallback(
    (item, err) => {
      const message = err instanceof Error ? err.message : `Failed to upload ${item.file.name}`
      setItems((prev) =>
        prev.some((it) => it.id === item.id)
          ? prev.map((it) => (it.id === item.id ? { ...it, status: 'error', error: message } : it))
          : prev
      )
      showToast(message, 'error')
    },
    [showToast]
  )

  const uploadItem = useCallback(
    async (item, sessionId) => {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading', error: null } : it))
      )

      try {
        const media = await uploadFile({ file: item.file, sessionId })
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: 'done', media } : it))
        )
      } catch (err) {
        handleUploadError(item, err)
      }
    },
    [handleUploadError]
  )

  const runUploads = useCallback(
    async (itemsToUpload) => {
      if (itemsToUpload.length === 0) return

      try {
        const sessionId = await ensureSession()
        await Promise.allSettled(itemsToUpload.map((item) => uploadItem(item, sessionId)))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload could not start'
        for (const item of itemsToUpload) {
          handleUploadError(item, new Error(message))
        }
      }
    },
    [ensureSession, uploadItem, handleUploadError]
  )

  const handleFilesAdded = async (newFiles) => {
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
          id: nextItemIdRef.current++,
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
      await runUploads(accepted)
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

  const handleRetry = async (item) => {
    if (disabled) return
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: 'uploading', error: null } : it))
    )
    try {
      const sessionId = await ensureSession()
      await uploadItem(item, sessionId)
    } catch (err) {
      handleUploadError(item, err)
    }
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
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/x-matroska"
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
              Click or drag &amp; drop · JPG, PNG, WEBP, GIF, HEIC up to {MAX_IMAGE_SIZE_MB}MB ·
              MP4, WEBM, MOV, MKV up to {MAX_VIDEO_SIZE_MB}MB
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
                  <video src={item.previewUrl + '#t=0.1'} preload="metadata" muted playsInline />
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
                  <span className="tile-status-label">Failed — click to retry</span>
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

      {/* Invisible / managed Turnstile widget (only for anonymous users) */}
      {!user && (
        <div style={{ minHeight: '0' }}>
          <Turnstile
            ref={turnstileRef}
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
            onWidgetLoad={() => setTurnstileLoaded(true)}
            onError={(error) => {
              console.error('[Turnstile] error:', error)
              showToast(`Verification challenge error: ${error}`, 'error')
            }}
            onTimeout={() => {
              console.warn('[Turnstile] timeout')
              showToast('Verification challenge timed out. Please try again.', 'error')
            }}
            onUnsupported={() => {
              console.error('[Turnstile] unsupported browser')
              showToast('Your browser does not support the verification challenge.', 'error')
            }}
            onExpire={() => {
              turnstileRef.current?.reset()
            }}
            options={{
              execution: 'render',
              size: 'normal',
              appearance: 'interaction-only',
              action: 'media-upload',
            }}
          />
        </div>
      )}
    </div>
  )
}
