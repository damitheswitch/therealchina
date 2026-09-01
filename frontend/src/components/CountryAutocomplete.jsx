import { useState, useRef, useEffect, useMemo } from 'react'
import { countries } from 'countries-list'

// Canonical country names from countries-list (sorted, deduplicated)
export const COUNTRY_NAMES = Object.values(countries)
  .map((c) => c.name)
  .filter((name, index, arr) => arr.indexOf(name) === index)
  .sort((a, b) => a.localeCompare(b))

export const isCountryName = (value) =>
  typeof value === 'string' && COUNTRY_NAMES.includes(value.trim())

// Searchable haystack per country: English name, native name and aliases
// (e.g. "USA", "America") so users can find a country by any of them
const COUNTRY_ENTRIES = Object.values(countries).map((c) => ({
  name: c.name,
  words: [c.name, c.native, ...(c.alias || [])]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean),
}))

const matchesQuery = (entry, query) => {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!queryWords.length) return false
  return queryWords.every((qw) => entry.words.some((nw) => nw.startsWith(qw)))
}

// Strict country input: values must come from the canonical list, never
// free-form text. Typing filters suggestions; on blur an unambiguous
// case-insensitive match is canonicalized and anything else is cleared.
export const CountryAutocomplete = ({ id, value, onChange, placeholder }) => {
  const [focused, setFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [listStyle, setListStyle] = useState(null)
  const inputRef = useRef(null)
  const blurTimer = useRef(null)

  const query = value.trim()
  const suggestions = useMemo(() => {
    if (!query) return []
    return COUNTRY_ENTRIES.filter((e) => matchesQuery(e, query)).slice(0, 8)
  }, [query])

  const exactMatch = COUNTRY_NAMES.includes(query)
  const showList = focused && suggestions.length > 0 && !exactMatch

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

  const select = (country) => {
    onChange(country)
    setFocused(false)
    setHighlightedIndex(-1)
  }

  const commitTypedText = () => {
    // Resolve what the user typed into a canonical country name, or clear it
    const typed = value.trim()
    if (!typed || COUNTRY_NAMES.includes(typed)) return

    const canonical = COUNTRY_NAMES.find((name) => name.toLowerCase() === typed.toLowerCase())
    if (canonical) {
      onChange(canonical)
    } else {
      onChange('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (showList && highlightedIndex >= 0) {
        e.preventDefault()
        select(suggestions[highlightedIndex].name)
      } else if (showList && suggestions.length === 1) {
        e.preventDefault()
        select(suggestions[0].name)
      } else if (focused) {
        e.preventDefault()
        commitTypedText()
        setFocused(false)
        inputRef.current?.blur()
      }
    } else if (e.key === 'ArrowDown' && showList) {
      e.preventDefault()
      setHighlightedIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault()
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setFocused(false)
      setHighlightedIndex(-1)
    }
  }

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setFocused(false)
      setHighlightedIndex(-1)
      commitTypedText()
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
          aria-label="Country suggestions"
        >
          {suggestions.map((entry, index) => (
            <li
              key={entry.name}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`autocomplete-option ${index === highlightedIndex ? 'highlighted' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                select(entry.name)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {entry.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
