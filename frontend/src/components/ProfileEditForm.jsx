import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Icons } from './Icons'
import { CityAutocomplete } from './CityAutocomplete'
import { UniversityAutocomplete } from './UniversityAutocomplete'
import { ProgramAutocomplete } from './ProgramAutocomplete'

// Social platforms data (inline to avoid import issues)
const socialPlatforms = {
  wechat: { label: 'WeChat', icon: 'chat' },
  instagram: { label: 'Instagram', icon: 'camera' },
  red: { label: 'RED', icon: 'book' },
  rednote: { label: 'REDNote', icon: 'book' },
  other: { label: 'Social', icon: 'link' },
}

// ProfileEditForm component - Form for editing profile details
export const ProfileEditForm = () => {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false)
  
  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [university, setUniversity] = useState('')
  const [program, setProgram] = useState('')
  const [socialHandles, setSocialHandles] = useState([])
  const [showSocialHandle, setShowSocialHandle] = useState(true)
  
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

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim(),
          location: location.trim() !== '__not_listed' ? location.trim() : null,
          university: university.trim() !== '__not_listed' ? university.trim() : null,
          program: program.trim(),
          social_handles: socialHandles.filter(sh => sh.handle && sh.handle.trim()),
          social_platform: null, // Deprecated, using social_handles array now
          social_handle: null, // Deprecated, using social_handles array now
          show_social_handle: showSocialHandle,
        })
        .eq('id', user.id)

      if (error) throw error

      showToast('Profile updated successfully!', 'success')
    } catch (error) {
      console.error('Error updating profile:', error)
      showToast(error.message || 'Failed to update profile', 'error')
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
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="form-input"
            />
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
          
          <div className="social-handles-list">
            {socialHandles.map((social, index) => (
              <div key={index} className="social-handle-item">
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select
                    value={social.platform}
                    onChange={(e) => {
                      const updated = [...socialHandles]
                      updated[index].platform = e.target.value
                      setSocialHandles(updated)
                    }}
                    className="form-select"
                  >
                    {Object.entries(socialPlatforms).map(([key, platform]) => (
                      <option key={key} value={key}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Handle</label>
                  <input
                    type="text"
                    value={social.handle}
                    onChange={(e) => {
                      const updated = [...socialHandles]
                      updated[index].handle = e.target.value
                      setSocialHandles(updated)
                    }}
                    placeholder="@your_handle"
                    className="form-input"
                  />
                </div>

                {socialHandles.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = socialHandles.filter((_, i) => i !== index)
                      setSocialHandles(updated)
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    <Icons.Trash /> Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSocialHandles([...socialHandles, { platform: 'wechat', handle: '' }])}
            className="btn btn-outline"
          >
            <Icons.Plus /> Add Social Profile
          </button>

          <div className="form-group" style={{ marginTop: 'var(--sp-2)' }}>
            <label className="form-checkbox-label">
              <input
                type="checkbox"
                checked={showSocialHandle}
                onChange={(e) => setShowSocialHandle(e.target.checked)}
                className="form-checkbox"
              />
              <span>Show social handles on my profile</span>
            </label>
            <p className="form-hint">
              When enabled, other authenticated users can see your social handles to connect with you.
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