import { useState, useRef, useLayoutEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { Icons } from './Icons'
import { socialPlatforms } from '../lib/socialPlatforms'

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

// Parse a YYYY-MM-DD string directly so the displayed day is not
// shifted by timezone conversion
const formatDate = (dateString) => {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-').map(Number)
  if (!year || !month || !day) return dateString
  return { short: `${day} ${MONTHS_SHORT[month - 1]}`, full: `${day} ${MONTHS_SHORT[month - 1]} ${year}`, year }
}

const formatDateRange = (departure, arrival) => {
  const dep = formatDate(departure)
  const arr = formatDate(arrival)
  if (!dep || !arr) return dep || arr || ''
  return dep.year === arr.year
    ? `${dep.short} → ${arr.full}`
    : `${dep.full} → ${arr.full}`
}

export const FlightListingCard = ({ listing, onDelete, canDelete = false }) => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [showContact, setShowContact] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [notesTruncated, setNotesTruncated] = useState(false)
  const notesRef = useRef(null)

  // Detect ellipsis truncation on the collapsed note so the expand
  // affordance only appears when there is actually hidden text. Measured
  // in layout effect (before paint) and re-measured on resize; skipped
  // while expanded since the wrapping note always fits its full width.
  useLayoutEffect(() => {
    if (notesExpanded) return
    const check = () => {
      const el = notesRef.current
      if (el) setNotesTruncated(el.scrollWidth > el.clientWidth + 1)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [notesExpanded, listing.notes])

  const toggleNotes = () => {
    if (notesTruncated) setNotesExpanded(v => !v)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this flight listing?')) {
      return
    }

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('flight_listings')
        .delete()
        .eq('id', listing.id)

      if (error) throw error

      showToast('Flight listing deleted successfully', 'success')
      if (onDelete) onDelete()
    } catch (error) {
      console.error('Error deleting flight listing:', error)
      showToast('Failed to delete flight listing', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const getPrimarySocialHandle = () => {
    let handles = listing.social_handles
    // Normalize legacy rows that stored a single object instead of an array
    if (handles && !Array.isArray(handles) && handles.platform) {
      handles = [handles]
    }
    if (!Array.isArray(handles) || handles.length === 0) {
      return null
    }
    // Prefer WeChat, then first available
    const wechatHandle = handles.find(sh => sh.platform === 'wechat')
    return wechatHandle || handles[0]
  }

  const primarySocialHandle = getPrimarySocialHandle()
  const socialPlatformData = primarySocialHandle
    ? (socialPlatforms[primarySocialHandle.platform] || socialPlatforms.other)
    : null

  const dateRange = formatDateRange(listing.departure_date, listing.arrival_date)

  return (
    <div className="flight-row">
      <div className="flight-row-route">
        <Icons.Plane className="plane-icon" />
        <span className="country">{listing.departure_country}</span>
        <Icons.ArrowRight className="arrow-icon" />
        <span className="country">{listing.arrival_country}</span>
        {canDelete && <span className="you-badge">You</span>}
      </div>

      <div className="flight-row-dates" title={`Departs ${listing.departure_date} · Arrives ${listing.arrival_date}`}>
        <Icons.Calendar />
        <span>{dateRange}</span>
      </div>

      <div className="flight-row-detail">
        <Icons.Package />
        <span><strong>{listing.available_kgs} kg</strong></span>
      </div>

      <div className="flight-row-detail">
        <Icons.DollarSign />
        <span><strong>{listing.price_per_kg} {listing.currency}</strong>/kg</span>
      </div>

      {listing.notes && (
        <div
          className={[
            'flight-row-notes',
            notesTruncated && !notesExpanded ? 'expandable' : '',
            notesExpanded ? 'expanded' : '',
          ].filter(Boolean).join(' ')}
          onClick={notesTruncated ? toggleNotes : undefined}
          role={notesTruncated ? 'button' : undefined}
          tabIndex={notesTruncated ? 0 : undefined}
          aria-expanded={notesTruncated ? notesExpanded : undefined}
          aria-label={notesTruncated ? (notesExpanded ? 'Collapse note' : 'Expand note') : undefined}
          onKeyDown={notesTruncated ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleNotes()
            }
          } : undefined}
          title={notesTruncated && !notesExpanded ? listing.notes : undefined}
        >
          <Icons.Info />
          <span ref={notesRef}>{listing.notes}</span>
        </div>
      )}

      <div className="flight-row-actions">
        <div className="listing-author">
          {listing.avatar_url ? (
            <img
              src={listing.avatar_url}
              alt={listing.display_name}
              className="author-avatar"
            />
          ) : (
            <span className="author-avatar author-avatar-initial">
              {(listing.display_name || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="author-name">{listing.display_name || 'Anonymous'}</span>
        </div>

        {user && listing.show_social_handle && primarySocialHandle && (
          showContact ? (
            <button
              onClick={() => setShowContact(false)}
              className="contact-chip"
              title="Click to hide"
            >
              <span className="contact-label">{socialPlatformData.label}:</span>
              <span className="contact-value">{primarySocialHandle.handle}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowContact(true)}
              className="btn btn-outline btn-sm contact-btn"
            >
              Show Contact
            </button>
          )
        )}

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-outline btn-sm delete-btn"
            aria-label="Delete listing"
            title="Delete listing"
          >
            <Icons.Trash />
          </button>
        )}
      </div>
    </div>
  )
}
