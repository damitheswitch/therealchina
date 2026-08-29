import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const matchesQuery = (university, query) => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!queryWords.length) return false
  const words = `${university.name} ${university.city}`.toLowerCase().split(/\s+/)
  return queryWords.every((qw) => words.some((w) => w.startsWith(qw)))
}

export const UniversityAutocomplete = ({
  id,
  value,
  onChange,
  onSelect,
  onNotListed,
  allowNotListed = false,
  placeholder,
}) => {
  const [focused, setFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [listStyle, setListStyle] = useState(null)
  const [universities, setUniversities] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const blurTimer = useRef(null)
  const searchTimer = useRef(null)

  const suggestions = value.trim()
    ? universities.filter((u) => matchesQuery(u.name, value)).slice(0, 6)
    : []
  const exactMatch = value.trim()
    ? universities.some((u) => u.name.toLowerCase() === value.trim().toLowerCase())
    : false
  const showNotListed = allowNotListed && value.trim() && !exactMatch
  const showList = focused && (suggestions.length > 0 || showNotListed) && !exactMatch

  // Fetch matching universities as the user types, not on mount.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    const trimmed = value.trim()
    if (!trimmed) {
      setUniversities([])
      return
    }

    searchTimer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const words = trimmed.split(/\s+/).filter(Boolean)
        // Match any word against name or city, then refine client-side.
        const conditions = words
          .map((w) => `name.ilike.%${w}%,city.ilike.%${w}%`)
          .join(',')

        const { data, error } = await supabase
          .from('universities')
          .select('name, city, slug')
          .or(conditions)
          .order('name')
          .limit(50)

        if (error) throw error
        setUniversities(data || [])
      } catch (error) {
        console.error('Error fetching universities:', error)
      } finally {
        setLoading(false)
      }
    }, 150)

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [value])

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

  const select = (university) => {
    onChange(university.name)
    if (onSelect) onSelect(university)
    setFocused(false)
    setHighlightedIndex(-1)
  }

  const handleNotListed = () => {
    if (onNotListed) {
      onNotListed()
    } else {
      onChange('__not_listed')
    }
    setFocused(false)
    setHighlightedIndex(-1)
  }

  const selectExactMatchIfAny = () => {
    const match = universities.find(
      (u) => u.name.toLowerCase() === value.trim().toLowerCase()
    )
    if (match && onSelect) {
      onSelect(match)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showList) {
        setFocused(true)
        setHighlightedIndex(0)
      } else {
        const total = suggestions.length + (showNotListed ? 1 : 0)
        setHighlightedIndex((i) => (i + 1) % total)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!showList) return
      const total = suggestions.length + (showNotListed ? 1 : 0)
      setHighlightedIndex((i) => (i <= 0 ? total - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showList && highlightedIndex >= 0) {
        if (highlightedIndex < suggestions.length) {
          select(suggestions[highlightedIndex])
        } else {
          handleNotListed()
        }
      } else {
        selectExactMatchIfAny()
      }
    } else if (e.key === 'Escape') {
      setFocused(false)
      setHighlightedIndex(-1)
    }
  }

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setFocused(false)
      selectExactMatchIfAny()
    }, 120)
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
          aria-label="University suggestions"
        >
          {suggestions.map((uni, index) => (
            <li
              key={uni.slug}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`autocomplete-option ${index === highlightedIndex ? 'highlighted' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                select(uni)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {uni.name} — {uni.city}
            </li>
          ))}
          {showNotListed && (
            <li
              role="option"
              className={`autocomplete-option not-listed-option ${
                highlightedIndex === suggestions.length ? 'highlighted' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                handleNotListed()
              }}
              onMouseEnter={() => setHighlightedIndex(suggestions.length)}
            >
              I can't find my university...
            </li>
          )}
          {loading && suggestions.length === 0 && (
            <li className="autocomplete-option muted">Loading...</li>
          )}
        </ul>
      )}
    </div>
  )
}
