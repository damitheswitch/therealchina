import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useProfileContext } from '../contexts/ProfileContext'
import { useToast } from '../contexts/ToastContext'
import { SocialHandlesEditor } from './SocialHandlesEditor'
import { getSocialHandles, hasSocialHandles } from '../lib/socialHandles'

export const SocialHandlesSetupModal = ({ isOpen, onClose, onSaved }) => {
  const { user } = useAuth()
  const { profile, loading: profileLoading, refetch } = useProfileContext()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [socialHandles, setSocialHandles] = useState([{ platform: 'wechat', handle: '' }])
  const [showSocialHandle, setShowSocialHandle] = useState(true)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Seed the editor from the already-cached profile, once per open — the
  // profile row is app state (ProfileContext), no per-modal refetch.
  useEffect(() => {
    if (!isOpen) {
      setSeeded(false)
      return
    }
    if (seeded || !profile) return
    const handles = getSocialHandles(profile)
    setSocialHandles(handles.length > 0 ? handles : [{ platform: 'wechat', handle: '' }])
    setShowSocialHandle(profile.show_social_handle !== false)
    setSeeded(true)
  }, [isOpen, profile, seeded])

  if (!isOpen || !user) return null

  const handleSave = async (e) => {
    e.preventDefault()
    if (!profile) return // never save over a row we haven't read

    const validHandles = socialHandles.filter((sh) => sh.handle && sh.handle.trim())
    if (!hasSocialHandles({ social_handles: validHandles })) {
      showToast('Please add at least one social handle with a non-empty handle.', 'error')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          social_handles: validHandles,
          social_platform: null,
          social_handle: null,
          show_social_handle: showSocialHandle,
        })
        .eq('id', user.id)

      if (error) throw error

      refetch() // keep the shared profile cache in sync with the new handles
      showToast('Social handles saved!', 'success')
      onSaved?.()
    } catch (err) {
      console.error('Error saving social handles:', err)
      showToast(err.message || 'Failed to save social handles', 'error')
    } finally {
      setLoading(false)
    }
  }

  const modalContent = (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div
        className="auth-modal-content"
        style={{ maxWidth: '560px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="auth-modal-header">
          <h2>Add a social handle</h2>
          <p className="auth-modal-subtitle">
            Travelers need a way to reach you. Add at least one social handle to post flights.
          </p>
        </div>

        {!profile ? (
          <div className="loading" style={{ padding: '2rem 0', textAlign: 'center' }}>
            {profileLoading
              ? 'Loading...'
              : 'Could not load your profile. Please close this and try again.'}
          </div>
        ) : (
          <form onSubmit={handleSave} className="auth-modal-form">
            <SocialHandlesEditor
              value={socialHandles}
              onChange={setSocialHandles}
              showHandles={showSocialHandle}
              onShowChange={setShowSocialHandle}
              disabled={loading}
            />

            <div className="auth-modal-actions" style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
