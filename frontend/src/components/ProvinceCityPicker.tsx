import { useState } from 'react'
import {
  CHINA_DIVISIONS,
  MUNICIPALITIES,
  parseLocation,
  formatLocation,
} from '../lib/chinaDivisions'

const OUTSIDE_CHINA = '__outside_china'
const OTHER_CITY = '__other_city'

const isMuniProvince = (p: string) => MUNICIPALITIES.includes(p)

export interface LocationParts {
  province: string
  /** Canonical or typed city name — '' when only a province was picked. */
  city: string
}

interface ProvinceCityPickerProps {
  /** Base id — province select gets `${id}-province`, city `${id}-city`. */
  id: string
  /** Stored location string ('Suzhou, Jiangsu', 'Beijing', or free text). */
  value: string
  /** Optional in parts-only usage (the review wizard reads onParts instead). */
  onChange?: (value: string) => void
  /** Structured emission for callers that need province/city separately
   * (e.g. the review wizard's new-university payload). */
  onParts?: (parts: LocationParts) => void
  disabled?: boolean
  /** 'location' emits the canonical 'City, Province' string; 'term' emits just
   * the selected leaf (city or province) for substring filtering. */
  emitFormat?: 'location' | 'term'
  /** Hide the 'outside China' escape — university cities are always in China. */
  allowOutsideChina?: boolean
}

/**
 * Province -> city cascade backed by the vendored CHINA_DIVISIONS list.
 * Escapes: 'Somewhere else…' reveals a free-text city input inside a known
 * province; 'Outside China / not listed' swaps the cascade for a plain text
 * input so arbitrary locations (home country towns etc.) still work.
 */
export const ProvinceCityPicker = ({
  id,
  value,
  onChange,
  onParts,
  disabled = false,
  emitFormat = 'location',
  allowOutsideChina = true,
}: ProvinceCityPickerProps) => {
  const parsed = parseLocation(value)
  const [otherCityOpen, setOtherCityOpen] = useState(false)
  const [outsidePicked, setOutsidePicked] = useState(false)

  const division = CHINA_DIVISIONS.find((d) => d.name === parsed.province)
  const cityOptions = division?.cities ?? []
  const cityIsKnown = cityOptions.includes(parsed.city)
  const showOtherCity = otherCityOpen || (!!parsed.city && !cityIsKnown && !parsed.freeText)
  const outside = allowOutsideChina && (outsidePicked || !!parsed.freeText)
  const isMuni = MUNICIPALITIES.includes(parsed.province)

  const emit = (province: string, city: string, freeText: string | null = null) => {
    if (emitFormat === 'term') {
      onChange?.(freeText ?? (city.trim() || province))
    } else {
      onChange?.(freeText ?? formatLocation(province, city))
    }
    // Municipalities are their own city — 'Beijing' picked as the province
    // means the city part is 'Beijing', not ''.
    onParts?.({
      province: freeText !== null ? '' : province,
      city: freeText !== null ? '' : city.trim() || (isMuniProvince(province) ? province : ''),
    })
  }

  const handleProvince = (next: string) => {
    setOtherCityOpen(false)
    if (next === OUTSIDE_CHINA) {
      setOutsidePicked(true)
      onChange?.(parsed.freeText || '')
      onParts?.({ province: '', city: '' })
      return
    }
    setOutsidePicked(false)
    emit(next, '')
  }

  const handleCity = (next: string) => {
    if (next === OTHER_CITY) {
      setOtherCityOpen(true)
      emit(parsed.province, '')
      return
    }
    setOtherCityOpen(false)
    emit(parsed.province, next)
  }

  const citySelectValue = showOtherCity
    ? OTHER_CITY
    : cityIsKnown
      ? parsed.city
      : isMuni && !parsed.city
        ? parsed.province
        : ''

  return (
    <div>
      {outside ? (
        <input
          type="text"
          id={`${id}-other`}
          className="form-input"
          aria-label="Location"
          placeholder="Type your location"
          value={parsed.freeText}
          onChange={(e) => {
            onChange?.(e.target.value)
            onParts?.({ province: '', city: '' })
          }}
          disabled={disabled}
        />
      ) : (
        <div style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
          <select
            id={`${id}-province`}
            className="form-select"
            style={{ flex: 1, minWidth: '140px' }}
            aria-label="Province"
            value={parsed.province}
            onChange={(e) => handleProvince(e.target.value)}
            disabled={disabled}
          >
            <option value="">Province…</option>
            {CHINA_DIVISIONS.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
            {allowOutsideChina && <option value={OUTSIDE_CHINA}>Outside China / not listed</option>}
          </select>
          <select
            id={`${id}-city`}
            className="form-select"
            style={{ flex: 1, minWidth: '140px' }}
            aria-label="City"
            value={citySelectValue}
            onChange={(e) => handleCity(e.target.value)}
            disabled={disabled || !parsed.province}
          >
            <option value="">{parsed.province ? 'City…' : 'Pick a province first'}</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {parsed.province && <option value={OTHER_CITY}>Somewhere else…</option>}
          </select>
        </div>
      )}
      {showOtherCity && !outside && (
        <input
          type="text"
          id={`${id}-other-city`}
          className="form-input"
          style={{ marginTop: 'var(--sp-1)' }}
          aria-label="City name"
          placeholder="Type the city name"
          value={parsed.city}
          onChange={(e) => emit(parsed.province, e.target.value)}
          disabled={disabled}
        />
      )}
      {outside && (
        <button
          type="button"
          className="btn-text"
          style={{ marginTop: 'var(--sp-1)' }}
          onClick={() => {
            setOutsidePicked(false)
            onChange?.('')
            onParts?.({ province: '', city: '' })
          }}
          disabled={disabled}
        >
          Back to province / city
        </button>
      )}
    </div>
  )
}
