import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Icons } from './Icons'
import { CountryAutocomplete, isCountryName } from './CountryAutocomplete'

export const FlightListingForm = ({ onSuccess, onCancel }) => {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [saving, setSaving] = useState(false)

  // Form fields
  const [departureCountry, setDepartureCountry] = useState('')
  const [arrivalCountry, setArrivalCountry] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [arrivalDate, setArrivalDate] = useState('')
  const [availableKgs, setAvailableKgs] = useState('')
  const [pricePerKg, setPricePerKg] = useState('')
  const [currency, setCurrency] = useState('CNY')
  const [notes, setNotes] = useState('')

  // Local calendar date (YYYY-MM-DD), unlike toISOString() which is UTC
  const todayLocal = () => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${month}-${day}`
  }

  useEffect(() => {
    // Set minimum date to today
    const today = todayLocal()
    setDepartureDate(today)
    setArrivalDate(today)
  }, [])

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

      const { error } = await supabase
        .from('flight_listings')
        .insert({
          user_id: user.id,
          departure_country: departureCountry.trim(),
          arrival_country: arrivalCountry.trim(),
          departure_date: departureDate,
          arrival_date: arrivalDate,
          available_kgs: kgs,
          price_per_kg: price,
          currency: currency.trim(),
          notes: notes.trim() || null,
          is_active: true
        })

      if (error) throw error

      showToast('Flight listing created successfully!', 'success')
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error creating flight listing:', error)
      showToast(error.message || 'Failed to create flight listing', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flight-listing-form-container">
      <div className="form-header">
        <h2>Post Your Flight</h2>
        <p>Help others send packages by sharing your flight information</p>
      </div>

      <form onSubmit={handleSubmit} className="flight-listing-form">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="departure-country">From (Country) *</label>
            <CountryAutocomplete
              id="departure-country"
              placeholder="e.g. China"
              value={departureCountry}
              onChange={setDepartureCountry}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="arrival-country">To (Country) *</label>
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
            <label className="form-label" htmlFor="departure-date">Departure Date *</label>
            <input
              id="departure-date"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="form-input"
              min={todayLocal()}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="arrival-date">Arrival Date *</label>
            <input
              id="arrival-date"
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="form-input"
              min={departureDate || todayLocal()}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="available-kgs">Available KGs *</label>
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
            <label className="form-label" htmlFor="price-per-kg">Price per KG *</label>
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
          <label className="form-label" htmlFor="flight-notes">Notes</label>
          <textarea
            id="flight-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={'e.g. "No phones or electronics. Fixed price." Feel free to add anything else useful: restrictions, exact cities or airports, pickup arrangements, or extra contact details like your WeChat ID.'}
            className="form-textarea"
            rows={3}
          />
          <p className="form-hint">
            <Icons.Info />
            Interested travelers will see the social handle from your profile (WeChat, Instagram, etc.), so make sure it is filled in there. Anything extra — restrictions, exact cities, special instructions — belongs in the notes above.
          </p>
        </div>

        <div className="form-actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-outline">
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Creating...' : 'Post Flight Listing'}
          </button>
        </div>
      </form>
    </div>
  )
}
