import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Icons } from './Icons'
import { CountryAutocomplete } from './CountryAutocomplete'
import { canonicalCountryName, isCountryName } from '../lib/constants'
import { getSocialHandles, hasSocialHandles } from '../lib/socialHandles'
import { socialPlatforms, cleanHandle } from '../lib/socialPlatforms'
import { contactPlatformsToStore, contactPlatformSelection } from '../lib/flightListings'
import { PlatformIcon } from './SocialChip'

export const FlightListingForm = ({
  listing = null,
  onSuccess,
  onCancel,
  onRequiresSocialHandles,
}) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const isEditing = Boolean(listing)

  const [saving, setSaving] = useState(false)

  // Form fields
  const [departureCountry, setDepartureCountry] = useState('')
  const [arrivalCountry, setArrivalCountry] = useState('')
  const [departureCity, setDepartureCity] = useState('')
  const [arrivalCity, setArrivalCity] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [arrivalDate, setArrivalDate] = useState('')
  const [availableKgs, setAvailableKgs] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')
  const [currency, setCurrency] = useState('CNY')
  const [notes, setNotes] = useState('')

  // Contact picker: which of the owner's profile handles this listing shows.
  // selectedPlatforms stays null until the profile load finishes so a failed
  // load never clobbers a stored selection on edit.
  const [profileHandles, setProfileHandles] = useState([])
  const [savedHandlesJson, setSavedHandlesJson] = useState('[]')
  const [selectedPlatforms, setSelectedPlatforms] = useState(null)
  const [profileHidesSocials, setProfileHidesSocials] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [newPlatform, setNewPlatform] = useState('wechat')
  const [newHandle, setNewHandle] = useState('')

  // Local calendar date (YYYY-MM-DD), unlike toISOString() which is UTC
  const todayLocal = () => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${month}-${day}`
  }

  useEffect(() => {
    if (listing) {
      setDepartureCountry(listing.departure_country || '')
      setArrivalCountry(listing.arrival_country || '')
      setDepartureCity(listing.departure_city || '')
      setArrivalCity(listing.arrival_city || '')
      setDepartureDate(listing.departure_date || '')
      setArrivalDate(listing.arrival_date || '')
      setAvailableKgs(listing.available_kgs != null ? String(listing.available_kgs) : '')
      setPricePerKg(listing.price_per_kg != null ? String(listing.price_per_kg) : '')
      setCurrency(listing.currency || 'CNY')
      setNotes(listing.notes || '')
    } else {
      // Set minimum date to today
      const today = todayLocal()
      setDepartureDate(today)
      setArrivalDate(today)
    }
  }, [listing])

  // Load the owner's profile handles for the picker. A stored selection
  // (edit mode) is intersected with the handles still on the profile;
  // listings without one default to every platform checked.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const loadContacts = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('social_handles, social_platform, social_handle, show_social_handle')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (error) {
        console.error('Error loading profile contacts:', error)
        return
      }
      const handles = getSocialHandles(data).filter((h) => h.handle && h.handle.trim())
      setProfileHandles(handles)
      setSavedHandlesJson(JSON.stringify(handles))
      setProfileHidesSocials(data.show_social_handle === false)
      setSelectedPlatforms(
        contactPlatformSelection(
          listing?.contact_platforms,
          handles.map((h) => h.platform)
        )
      )
    }
    loadContacts()
    return () => {
      cancelled = true
    }
  }, [user, listing])

  const toggleContactPlatform = (platform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev || [])
      if (next.has(platform)) next.delete(platform)
      else next.add(platform)
      return next
    })
  }

  const handleAddContact = () => {
    const cleaned = cleanHandle(newPlatform, newHandle)
    if (!cleaned) {
      showToast('Enter a handle or phone number first', 'error')
      return
    }
    const entry = { platform: newPlatform, handle: cleaned }
    setProfileHandles((prev) => [
      ...prev.filter((h) => !(h.platform === entry.platform && h.handle === entry.handle)),
      entry,
    ])
    setSelectedPlatforms((prev) => new Set(prev || []).add(entry.platform))
    setNewHandle('')
    setAddingContact(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Countries must come from the canonical list (the autocomplete
      // enforces this too, but re-validate in case of a race)
      if (!isCountryName(departureCountry)) {
        showToast('Please select the departure country from the list', 'error')
        setSaving(false)
        return
      }
      if (!isCountryName(arrivalCountry)) {
        showToast('Please select the arrival country from the list', 'error')
        setSaving(false)
        return
      }

      if (!departureDate || !arrivalDate) {
        showToast('Please provide both departure and arrival dates', 'error')
        setSaving(false)
        return
      }

      const kgs = parseFloat(availableKgs)
      const price = parseFloat(pricePerKg)

      if (!Number.isFinite(kgs) || kgs <= 0) {
        showToast('Please provide a valid amount of available kg', 'error')
        setSaving(false)
        return
      }

      if (!Number.isFinite(price) || price < 0) {
        showToast('Please provide a valid price per kg', 'error')
        setSaving(false)
        return
      }

      // Validate dates
      if (arrivalDate < departureDate) {
        showToast('Arrival date must be after departure date', 'error')
        setSaving(false)
        return
      }

      // Contacts added inline live on the profile like the others, so save
      // them there first. Runs before the social-handle gate below so a
      // handle added right here counts toward it. Only runs when the handle
      // list actually changed.
      if (JSON.stringify(profileHandles) !== savedHandlesJson) {
        const { error: handleError } = await supabase
          .from('profiles')
          .update({
            social_handles: profileHandles,
            social_platform: null,
            social_handle: null,
          })
          .eq('id', user.id)

        if (handleError) {
          console.error('Error saving new contact:', handleError)
          showToast('Failed to save your new contact', 'error')
          setSaving(false)
          return
        }
        setSavedHandlesJson(JSON.stringify(profileHandles))
      }

      // Verify the user has at least one social handle so travelers can contact
      // them. Only enforced when posting — editing an existing listing must not
      // be blocked by the current profile state.
      if (!isEditing) {
        const { data: freshProfile, error: profileError } = await supabase
          .from('profiles')
          .select('social_handles, social_handle, social_platform')
          .eq('id', user.id)
          .single()

        if (profileError || !hasSocialHandles(freshProfile)) {
          showToast('You must have at least one social handle set up to post a flight.', 'error')
          onRequiresSocialHandles?.()
          setSaving(false)
          return
        }
      }

      const payload = {
        // Store canonical spellings even when the row being edited (or the
        // user's typed text) carried a legacy one.
        departure_country: canonicalCountryName(departureCountry) ?? departureCountry.trim(),
        arrival_country: canonicalCountryName(arrivalCountry) ?? arrivalCountry.trim(),
        departure_city: departureCity.trim() || null,
        arrival_city: arrivalCity.trim() || null,
        departure_date: departureDate,
        arrival_date: arrivalDate,
        available_kgs: kgs,
        price_per_kg: price,
        currency: currency.trim(),
        notes: notes.trim() || null,
      }

      if (selectedPlatforms) {
        // NULL keeps the legacy "every profile handle" behavior; a real
        // subset (including none) is stored explicitly.
        payload.contact_platforms = contactPlatformsToStore(
          selectedPlatforms,
          profileHandles.map((h) => h.platform)
        )
      }

      const { error } = isEditing
        ? await supabase.from('flight_listings').update(payload).eq('id', listing.id)
        : await supabase
            .from('flight_listings')
            .insert({ ...payload, user_id: user.id, is_active: true })

      if (error) throw error

      showToast(
        isEditing ? 'Flight listing updated successfully!' : 'Flight listing created successfully!',
        'success'
      )
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error saving flight listing:', error)
      const message = error?.message || ''
      if (
        !isEditing &&
        (error?.code === '42501' || message.toLowerCase().includes('row-level security'))
      ) {
        showToast('You must have at least one social handle set up to post a flight.', 'error')
      } else {
        showToast(message || `Failed to ${isEditing ? 'update' : 'create'} flight listing`, 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  // Group profile handles by platform; platform is the stored selection
  // granularity, so a platform with two handles renders as one option.
  const platformGroups = []
  for (const h of profileHandles) {
    const group = platformGroups.find(([p]) => p === h.platform)
    if (group) group[1].push(h.handle)
    else platformGroups.push([h.platform, [h.handle]])
  }

  return (
    <div className="flight-listing-form-container">
      <div className="form-header">
        <h2>{isEditing ? 'Edit Flight Listing' : 'Post Your Flight'}</h2>
        <p>
          {isEditing
            ? 'Update your flight details below'
            : 'Help others send packages by sharing your flight information'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flight-listing-form">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="departure-country">
              From (Country) *
            </label>
            <CountryAutocomplete
              id="departure-country"
              placeholder="e.g. China"
              value={departureCountry}
              onChange={setDepartureCountry}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="arrival-country">
              To (Country) *
            </label>
            <CountryAutocomplete
              id="arrival-country"
              placeholder="e.g. Morocco"
              value={arrivalCountry}
              onChange={setArrivalCountry}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="departure-city">
              From (City) <span className="text-muted">(optional)</span>
            </label>
            <input
              id="departure-city"
              type="text"
              placeholder="e.g. Shanghai or Beijing"
              value={departureCity}
              onChange={(e) => setDepartureCity(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="arrival-city">
              To (City) <span className="text-muted">(optional)</span>
            </label>
            <input
              id="arrival-city"
              type="text"
              placeholder="e.g. Casablanca or Rabat"
              value={arrivalCity}
              onChange={(e) => setArrivalCity(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="departure-date">
              Departure Date *
            </label>
            <input
              id="departure-date"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="form-input"
              min={isEditing ? undefined : todayLocal()}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="arrival-date">
              Arrival Date *
            </label>
            <input
              id="arrival-date"
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="form-input"
              min={departureDate || (isEditing ? undefined : todayLocal())}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="available-kgs">
              Available KGs *
            </label>
            <input
              id="available-kgs"
              type="number"
              step="0.1"
              min="0.1"
              value={availableKgs}
              onChange={(e) => setAvailableKgs(e.target.value)}
              placeholder="e.g. 5"
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="price-per-kg">
              Price per KG *
            </label>
            <div className="price-input-group">
              <input
                id="price-per-kg"
                type="number"
                step="0.01"
                min="0"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                placeholder="e.g. 50"
                className="form-input"
                required
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="form-select"
                aria-label="Currency"
              >
                <option value="CNY">CNY (¥)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="MAD">MAD (DH)</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="flight-notes">
            Notes
          </label>
          <textarea
            id="flight-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              'e.g. "No phones or electronics. Fixed price." Feel free to add anything else useful: restrictions, exact cities or airports, pickup arrangements, or extra contact details like your WeChat ID.'
            }
            className="form-textarea"
            rows={3}
            maxLength={1000}
          />
          <p className="form-hint">
            <Icons.Info />
            Travelers see the contacts you pick in the section below. Anything extra, like
            restrictions, exact cities, or special instructions, belongs in the notes above.
          </p>
        </div>

        <div className="form-group">
          <span className="form-label">Contacts shown to travelers</span>
          {selectedPlatforms === null ? (
            <p className="form-hint">Loading your contacts...</p>
          ) : (
            <>
              {platformGroups.length > 0 && (
                <div className="contact-pick-list">
                  {platformGroups.map(([platform, handles]) => {
                    const platformData = socialPlatforms[platform] || socialPlatforms.other
                    return (
                      <label key={platform} className="contact-pick-option">
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.has(platform)}
                          onChange={() => toggleContactPlatform(platform)}
                          className="form-checkbox"
                        />
                        <span className="contact-pick-icon">
                          <PlatformIcon platform={platform} size={15} />
                        </span>
                        <span className="contact-pick-platform">{platformData.label}</span>
                        <span className="contact-pick-handles">{handles.join(', ')}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {addingContact ? (
                <div className="contact-add-row">
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="form-select"
                    aria-label="New contact platform"
                  >
                    {Object.entries(socialPlatforms).map(([key, platform]) => (
                      <option key={key} value={key}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder="Handle or phone number"
                    className="form-input"
                    aria-label="New contact handle"
                  />
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="btn btn-primary btn-sm"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingContact(false)
                      setNewHandle('')
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingContact(true)}
                  className="btn btn-outline btn-sm"
                >
                  <Icons.Plus /> Add a new contact
                </button>
              )}

              <p className="form-hint">
                <Icons.Info />
                {selectedPlatforms.size === 0
                  ? 'No contact selected. Travelers will not see a way to reach you on this listing.'
                  : 'Only the checked contacts appear on this listing.'}
                {profileHidesSocials &&
                  ' Your profile currently hides social handles, so contacts will not show until you turn them back on in your profile.'}
              </p>
            </>
          )}
        </div>

        <div className="form-actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-outline">
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
                ? 'Save Changes'
                : 'Post Flight Listing'}
          </button>
        </div>
      </form>
    </div>
  )
}
