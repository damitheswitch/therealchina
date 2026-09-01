import { useState, useRef, useEffect } from 'react'
import { useDebounce } from '../hooks/useDebounce'

export const Autocomplete = ({
  id,
  value = '',
  onChange,
  onSelect,
  onNotListed,
  allowNotListed = false,
  placeholder,
  loadOptions,
  minQueryLength = 1,
  maxSuggestions = 6,
  debounceMs = 150,
  notListedText = "I can't find my...",
  renderOption = (option) => option.label,
  getOptionValue = (option) => option.value ?? '',
  getOptionKey = (option) => option.key ?? option.value,
  isExactMatch = (option, value) => option.value?.toLowerCase() === value?.trim()?.toLowerCase(),
}) => {
  const [focused, setFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [listStyle, setListStyle] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)

  const inputRef = useRef(null)
  const blurTimer = useRef(null)
  const loadOptionsRef = useRef(loadOptions)

  const debouncedValue = useDebounce(value, debounceMs)

  useEffect(() => {
    loadOptionsRef.current = loadOptions
  }, [loadOptions])

  useEffect(() => {
    const query = (debouncedValue ?? '').trim()
    if (!query || query.length < minQueryLength) {
      setSuggestions([])
      setLoading(false)
      return
    }

    let ignore = false
    const fetch = async () => {
      setLoading(true)
      try {
        const results = await loadOptionsRef.current(query)
        if (!ignore) {
          setSuggestions((results || []).slice(0, maxSuggestions))
        }
      } catch (error) {
        console.error('Autocomplete loadOptions error:', error)
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    fetch()
    return () => {
      ignore = true
    }
  }, [debouncedValue, minQueryLength, maxSuggestions])

  const exactMatch = suggestions.some((option) => isExactMatch(option, value))
  const showNotListed = allowNotListed && value?.trim() && !exactMatch
  const showList = focused && (suggestions.length > 0 || showNotListed) && !exactMatch

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
  }, [showList])

  const select = (option) => {
    onChange(getOptionValue(option))
    onSelect?.(option)
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
    const match = suggestions.find((option) => isExactMatch(option, value))
    if (match) {
      onSelect?.(match)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showList) {
        setFocused(true)
        if (suggestions.length > 0 || showNotListed) {
          setHighlightedIndex(0)
        }
      } else {
        const total = suggestions.length + (showNotListed ? 1 : 0)
        if (total === 0) return
        setHighlightedIndex((i) => (i + 1) % total)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!showList) return
      const total = suggestions.length + (showNotListed ? 1 : 0)
      if (total === 0) return
      setHighlightedIndex((i) => (i <= 0 ? total - 1 : i - 1))
    } else if (e.key === 'Enter') {
      if (showList && highlightedIndex >= 0) {
        e.preventDefault()
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
          aria-label={placeholder || 'Suggestions'}
        >
          {suggestions.map((option, index) => (
            <li
              key={getOptionKey(option)}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`autocomplete-option ${index === highlightedIndex ? 'highlighted' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                select(option)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {renderOption(option, index === highlightedIndex)}
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
              {notListedText}
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
