import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { validateDisplayName } from '../lib/validateDisplayName'
import { Icons } from './Icons'
import { CityAutocomplete } from './CityAutocomplete'
import { UniversityAutocomplete } from './UniversityAutocomplete'
import { ProgramAutocomplete } from './ProgramAutocomplete'
import { SocialHandlesEditor } from './SocialHandlesEditor'

// ProfileEditForm component - Form for editing profile details
export const ProfileEditForm = () => {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false)
  
  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [displayNameError, setDisplayNameError] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [university, setUniversity] = useState('')
  const [program, setProgram] = useState('')
  const [socialHandles, setSocialHandles] = useState([])
  const [showSocialHandle, setShowSocialHandle] = useState(true)
  const [isDiscoverable, setIsDiscoverable] = useState(true)
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [user])

  const fetchProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, social_handles')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data) {
        setDisplayName(data.display_name || '')
        setBio(data.bio || '')
        setLocation(data.location || '')
        setUniversity(data.university || '')
        setProgram(data.program || '')
        
        // Handle social handles - migrate from old format if needed
        let handles = []
        if (data.social_handles && Array.isArray(data.social_handles) && data.social_handles.length > 0) {
          handles = data.social_handles
        } else if (data.social_platform || data.social_handle) {
          // Migrate old single social handle to new array format
          handles = [{
            platform: data.social_platform || 'other',
            handle: data.social_handle || ''
          }]
        }
        
        // Ensure we always have at least one social handle field
        setSocialHandles(handles.length > 0 ? handles : [{ platform: 'wechat', handle: '' }])
        setShowSocialHandle(data.show_social_handle !== false)
        setIsDiscoverable(data.is_discoverable !== false)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      showToast('Failed to load profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setDisplayNameError('')

    const { valid, error: validationError, normalized } = validateDisplayName(displayName)
    if (!valid) {
      setDisplayNameError(validationError)
      showToast(validationError, 'error')
      setSaving(false)
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: normalized,
          bio: bio.trim(),
          location: location.trim() !== '__not_listed' ? location.trim() : null,
          university: university.trim() !== '__not_listed' ? university.trim() : null,
          program: program.trim(),
          social_handles: socialHandles.filter((sh) => sh.handle && sh.handle.trim()),
          social_platform: null,
          social_handle: null,
          show_social_handle: showSocialHandle,
          is_discoverable: isDiscoverable,
        })
        .eq('id', user.id)

      if (error) throw error

      setDisplayName(normalized)
      showToast('Profile updated successfully!', 'success')
    } catch (error) {
      console.error('Error updating profile:', error)
      if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate key')) {
        const taken = 'That display name is already taken.'
        setDisplayNameError(taken)
        showToast(taken, 'error')
      } else {
        showToast(error.message || 'Failed to update profile', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }

    setSaving(true)

    try {
      // Re-authenticate with current password (OWASP security guidance)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (signInError) {
        showToast('Current password is incorrect', 'error')
        setSaving(false)
        return
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      showToast('Password updated successfully!', 'success')
      
      // Clear password fields
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSectionOpen(false)
    } catch (error) {
      console.error('Error updating password:', error)
      showToast(error.message || 'Failed to update password', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading profile...</div>
  }

  return (
    <div className="profile-edit-container">
      <form onSubmit={handleProfileSave} className="profile-edit-form">
        <div className="form-section">
          <h3 className="form-section-title">Basic Information</h3>
          
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setDisplayNameError(validateDisplayName(e.target.value).error || '')
              }}
              placeholder="Your display name"
              className="form-input"
            />
            {displayNameError && <p className="form-hint" style={{ color: 'var(--error)' }}>{displayNameError}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              className="form-textarea"
              rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Base City</label>
            <CityAutocomplete
              id="location"
              placeholder="e.g. Beijing, Shanghai"
              value={location}
              onChange={setLocation}
            />
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Academic Information</h3>
          
          <div className="form-group">
            <label className="form-label">University</label>
            <UniversityAutocomplete
              id="university"
              placeholder="Your university"
              value={university}
              onChange={setUniversity}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Program</label>
            <ProgramAutocomplete
              id="program"
              placeholder="Your program of study"
              value={program}
              onChange={setProgram}
            />
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Social Profiles</h3>

          <SocialHandlesEditor
            value={socialHandles}
            onChange={setSocialHandles}
            showHandles={showSocialHandle}
            onShowChange={setShowSocialHandle}
            disabled={saving}
          />
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Privacy</h3>

          <div className="form-group">
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                checked={isDiscoverable}
                onChange={(e) => setIsDiscoverable(e.target.checked)}
                className="form-checkbox"
              />
              <span>Show my profile in the student directory</span>
            </label>
            <p className="form-hint">
              When enabled, other students can find you in the directory. Turn this off to stay unlisted.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      <div className="password-section">
        <button
          type="button"
          className={`collapse-trigger ${passwordSectionOpen ? 'open' : ''}`}
          onClick={() => setPasswordSectionOpen(!passwordSectionOpen)}
        >
          <span>Change Password</span>
          <Icons.Chevron />
        </button>

        {passwordSectionOpen && (
          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="form-input"
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="form-input"
                required
                minLength={6}
              />
            </div>

            <div className="form-actions">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => setPasswordSectionOpen(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}