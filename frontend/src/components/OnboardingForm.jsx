import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useProfileContext } from '../contexts/ProfileContext'
import { validateDisplayName } from '../lib/validateDisplayName'
import { COUNTRIES, LANGUAGES, CURRENT_STATUSES } from '../lib/constants'
import { CityAutocomplete } from './CityAutocomplete'
import { UniversityAutocomplete } from './UniversityAutocomplete'
import { ProgramAutocomplete } from './ProgramAutocomplete'
import { SocialHandlesEditor } from './SocialHandlesEditor'

const emptySocialHandle = { platform: 'wechat', handle: '' }

const normalizeSocialHandles = (profile) => {
  if (
    profile?.social_handles &&
    Array.isArray(profile.social_handles) &&
    profile.social_handles.length > 0
  ) {
    return [...profile.social_handles]
  }
  if (profile?.social_platform || profile?.social_handle) {
    return [{ platform: profile.social_platform || 'wechat', handle: profile.social_handle || '' }]
  }
  return [emptySocialHandle]
}

export const OnboardingForm = ({
  initialDisplayName,
  displayNameEditable,
  initialProfile,
  onComplete,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { refetch } = useProfileContext()

  const [displayName, setDisplayName] = useState(initialDisplayName || '')
  const [displayNameError, setDisplayNameError] = useState('')
  const [bio, setBio] = useState(initialProfile?.bio || '')
  const [location, setLocation] = useState(initialProfile?.location || '')
  const [university, setUniversity] = useState(initialProfile?.university || '')
  const [program, setProgram] = useState(initialProfile?.program || '')
  const [socialHandles, setSocialHandles] = useState(normalizeSocialHandles(initialProfile))
  const [showSocialHandle, setShowSocialHandle] = useState(
    initialProfile?.show_social_handle !== false
  )
  const [homeCountry, setHomeCountry] = useState(initialProfile?.home_country || '')
  const [currentStatus, setCurrentStatus] = useState(initialProfile?.current_status || '')
  const [languagesSpoken, setLanguagesSpoken] = useState(
    Array.isArray(initialProfile?.languages_spoken) ? initialProfile.languages_spoken : []
  )
  const [emailConsent, setEmailConsent] = useState(initialProfile?.email_consent === true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDisplayName(initialDisplayName || '')
    setBio(initialProfile?.bio || '')
    setLocation(initialProfile?.location || '')
    setUniversity(initialProfile?.university || '')
    setProgram(initialProfile?.program || '')
    setSocialHandles(normalizeSocialHandles(initialProfile))
    setShowSocialHandle(initialProfile?.show_social_handle !== false)
    setHomeCountry(initialProfile?.home_country || '')
    setCurrentStatus(initialProfile?.current_status || '')
    setLanguagesSpoken(
      Array.isArray(initialProfile?.languages_spoken) ? initialProfile.languages_spoken : []
    )
    setEmailConsent(initialProfile?.email_consent === true)

    if (displayNameEditable && initialDisplayName) {
      setDisplayNameError(validateDisplayName(initialDisplayName).error || '')
    } else {
      setDisplayNameError('')
    }
  }, [initialDisplayName, displayNameEditable, initialProfile])

  const handleDisplayNameChange = (e) => {
    setDisplayName(e.target.value)
    if (displayNameEditable) {
      setDisplayNameError(validateDisplayName(e.target.value).error || '')
    }
  }

  const buildUpdate = () => {
    const update = {
      onboarding_completed: true,
      is_discoverable: true,
      bio: bio.trim() || null,
      location: location.trim() !== '__not_listed' ? location.trim() || null : null,
      university: university.trim() !== '__not_listed' ? university.trim() || null : null,
      program: program.trim() || null,
      show_social_handle: showSocialHandle,
      home_country: homeCountry || null,
      current_status: currentStatus || null,
      languages_spoken: languagesSpoken.length > 0 ? languagesSpoken : null,
      email_consent: emailConsent,
      social_handles: socialHandles.filter((sh) => sh.handle && sh.handle.trim()),
      social_platform: null,
      social_handle: null,
    }

    if (displayNameEditable) {
      const { valid, error, normalized } = validateDisplayName(displayName)
      if (!valid) throw new Error(error)
      update.display_name = normalized
    }

    return update
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setDisplayNameError('')

    let update
    try {
      update = buildUpdate()
    } catch (error) {
      setDisplayNameError(error.message)
      setSaving(false)
      return
    }

    try {
      const { error } = await supabase.from('profiles').update(update).eq('id', user.id)
      if (error) throw error
      // Sync the app-wide profile record so the header reflects the new
      // display name immediately after onboarding.
      await refetch()
      onComplete()
    } catch (error) {
      console.error('Error saving onboarding:', error)
      if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate key')) {
        setDisplayNameError('That display name is taken.')
      } else {
        showToast(error.message || 'Failed to save profile. Please try again.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (displayNameEditable || !user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true, is_discoverable: true })
        .eq('id', user.id)

      if (error) throw error
      onComplete()
    } catch (error) {
      console.error('Error skipping onboarding:', error)
      showToast(error.message || 'Failed to save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="onboarding-form">
      <div className="form-section">
        <h3 className="form-section-title">
          {displayNameEditable ? 'Choose your display name' : 'Your display name'}
        </h3>

        {displayNameEditable ? (
          <div className="form-group">
            <label className="form-label" htmlFor="onboarding-display-name">
              Choose your display name / pseudonym
            </label>
            <input
              id="onboarding-display-name"
              type="text"
              value={displayName}
              onChange={handleDisplayNameChange}
              placeholder="e.g. Alex (Shanghai Uni)"
              className="form-input"
              disabled={saving}
              required
            />
            <p className="form-hint">
              This is how you&apos;ll appear across TRC — reviews, directory, and flights. You can
              change it later in Settings.
            </p>
            {displayNameError && (
              <p className="form-hint" style={{ color: 'var(--error)' }}>
                {displayNameError}
              </p>
            )}
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Your display name</label>
            <div
              className="form-input"
              style={{ background: 'var(--rice-warm)', display: 'flex', alignItems: 'center' }}
            >
              {displayName}
            </div>
            <p className="form-hint">
              You chose this when you signed up. You can change it later in Settings.
            </p>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">About you</h3>

        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-city">
            Where are you based?
          </label>
          <CityAutocomplete
            id="onboarding-city"
            value={location}
            onChange={setLocation}
            placeholder="e.g. Beijing, Shanghai"
          />
          <p className="form-hint">
            Adding your city helps other students find relevant flights, listings, and connect with
            students in the same area.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-university">
            Your university
          </label>
          <UniversityAutocomplete
            id="onboarding-university"
            value={university}
            onChange={setUniversity}
            placeholder="Your university"
          />
          <p className="form-hint">
            Adding your university gives your reviews more context and makes your profile more
            trustworthy to other international students.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-program">
            Your program
          </label>
          <ProgramAutocomplete
            id="onboarding-program"
            value={program}
            onChange={setProgram}
            placeholder="Your program of study"
          />
          <p className="form-hint">
            Your program of study helps students in the same field connect with you.
          </p>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">A bit more about you</h3>

        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label className="form-label" htmlFor="onboarding-home-country">
              Home country
            </label>
            <select
              id="onboarding-home-country"
              className="form-select"
              value={homeCountry}
              onChange={(e) => setHomeCountry(e.target.value)}
              disabled={saving}
            >
              <option value="">Prefer not to say</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label className="form-label" htmlFor="onboarding-current-status">
              What are you up to right now?
            </label>
            <select
              id="onboarding-current-status"
              className="form-select"
              value={currentStatus}
              onChange={(e) => setCurrentStatus(e.target.value)}
              disabled={saving}
            >
              <option value="">Prefer not to say</option>
              {CURRENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-languages">
            Languages you speak <span className="form-hint-inline">add as many as you like</span>
          </label>
          <select
            id="onboarding-languages"
            className="form-select"
            value=""
            onChange={(e) => {
              const lang = e.target.value
              if (lang && !languagesSpoken.includes(lang))
                setLanguagesSpoken((prev) => [...prev, lang])
            }}
            disabled={saving}
          >
            <option value="">Select a language...</option>
            {LANGUAGES.filter((l) => !languagesSpoken.includes(l)).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {languagesSpoken.length > 0 && (
            <div className="chip-row" style={{ marginTop: '.5rem' }}>
              {languagesSpoken.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="chip selected"
                  title="Remove"
                  onClick={() => setLanguagesSpoken((prev) => prev.filter((x) => x !== l))}
                  disabled={saving}
                >
                  {l} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <span className="form-label" id="onboarding-email-consent-label">
            Want early access & updates?
          </span>
          <div className="segmented" role="group" aria-labelledby="onboarding-email-consent-label">
            <button
              type="button"
              className={`seg ${!emailConsent ? 'selected' : ''}`}
              onClick={() => setEmailConsent(false)}
              disabled={saving}
            >
              No thanks
            </button>
            <button
              type="button"
              className={`seg ${emailConsent ? 'selected' : ''}`}
              onClick={() => setEmailConsent(true)}
              disabled={saving}
            >
              Yes, sign me up
            </button>
          </div>
          <span className="form-hint">
            Get the newsletter. Scholarships, new features, and early access before everyone else.
          </span>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Social & bio</h3>

        <div className="form-group">
          <label className="form-label">Social handles</label>
          <SocialHandlesEditor
            value={socialHandles}
            onChange={setSocialHandles}
            showHandles={showSocialHandle}
            onShowChange={setShowSocialHandle}
            disabled={saving}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="onboarding-bio">
            A short bio
          </label>
          <textarea
            id="onboarding-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A few lines make your profile more human..."
            className="form-textarea"
            rows={4}
            disabled={saving}
          />
          <p className="form-hint">
            A few lines make your profile more human and help others understand where you&apos;re
            coming from.
          </p>
        </div>
      </div>

      <p className="form-hint" style={{ textAlign: 'center' }}>
        Your profile will appear in the student directory so other students can find you. You can
        turn this off in Settings later.
      </p>

      <div
        className="onboarding-actions"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-1)',
          alignItems: 'center',
        }}
      >
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary btn-lg"
          style={{ width: '100%', maxWidth: '320px', justifyContent: 'center' }}
        >
          {saving ? 'Saving...' : 'Save & continue'}
        </button>

        {!displayNameEditable && (
          <>
            <button type="button" onClick={handleSkip} disabled={saving} className="btn-text">
              Skip for now
            </button>
            <p className="form-hint onboarding-skip-hint">You can add these later in Settings.</p>
          </>
        )}
      </div>
    </form>
  )
}
