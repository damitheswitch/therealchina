import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const matchesQuery = (university, query) => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!queryWords.length) return false
  const nameWords = university.toLowerCase().split(/\s+/)
  return queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw)))
}

export const UniversityAutocomplete = ({ id, value, onChange, placeholder }) => {
  const [focused, setFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [listStyle, setListStyle] = useState(null)
  const [universities, setUniversities] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const blurTimer = useRef(null)

  const suggestions = value.trim() 
    ? universities.filter(u => matchesQuery(u.name, value)).slice(0, 6)
    : []
  const exactMatch = value.trim() && universities.some(u => u.name.toLowerCase() === value.trim().toLowerCase())
  const showList = focused && suggestions.length > 0 && !exactMatch

  useEffect(() => {
    fetchUniversities()
  }, [])

  const fetchUniversities = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('universities')
        .select('name, city, slug')
        .order('name')

      if (error) throw error
      setUniversities(data || [])
    } catch (error) {
      console.error('Error fetching universities:', error)
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

  const select = (university) => {
    onChange(university.name)
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
            I can't find my university...
          </li>
        </ul>
      )}
    </div>
  )
}
