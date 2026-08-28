import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const matchesQuery = (city, query) => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!queryWords.length) return false
  const nameWords = city.toLowerCase().split(/\s+/)
  return queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw)))
}

export const CityAutocomplete = ({ id, value, onChange, placeholder }) => {
  const [focused, setFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [listStyle, setListStyle] = useState(null)
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const blurTimer = useRef(null)

  const suggestions = value.trim() 
    ? cities.filter(c => matchesQuery(c, value)).slice(0, 6)
    : []
  const exactMatch = value.trim() && cities.some(c => c.toLowerCase() === value.trim().toLowerCase())
  const showList = focused && suggestions.length > 0 && !exactMatch

  useEffect(() => {
    fetchCities()
  }, [])

  const fetchCities = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('universities')
        .select('city')
        .order('city')

      if (error) throw error
      
      // Get unique cities
      const uniqueCities = [...new Set(data?.map(u => u.city) || [])].sort()
      setCities(uniqueCities)
    } catch (error) {
      console.error('Error fetching cities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!showList) {
      setListStyle(null)
      return
    }

    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (!rect) return
      setListStyle({
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [showList, value])

  const select = (city) => {
    onChange(city)
    setFocused(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => i <= 0 ? suggestions.length - 1 : i - 1)
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      select(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setFocused(false)
      setHighlightedIndex(-1)
    }
  }

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setFocused(false), 120)
  }

  const handleFocus = () => {
    clearTimeout(blurTimer.current)
    setFocused(true)
    setHighlightedIndex(-1)
  }

  return (
    <div className="autocomplete">
      <input
        type="text"
        id={id}
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setHighlightedIndex(-1)
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        ref={inputRef}
      />
      {showList && listStyle && (
        <ul
          className="autocomplete-list"
          style={listStyle}
          role="listbox"
          aria-label="City suggestions"
        >
          {suggestions.map((city, index) => (
            <li
              key={city}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`autocomplete-option ${index === highlightedIndex ? 'highlighted' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                select(city)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {city}
            </li>
          ))}
          <li
            role="option"
            className="autocomplete-option not-listed-option"
            onMouseDown={(e) => {
              e.preventDefault()
              onChange('__not_listed')
              setFocused(false)
            }}
            onMouseEnter={() => setHighlightedIndex(-1)}
          >
            I can't find my city...
          </li>
        </ul>
      )}
    </div>
  )
}
