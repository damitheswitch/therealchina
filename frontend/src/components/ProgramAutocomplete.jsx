import { useState, useRef, useEffect } from 'react'

// Common programs (geared toward international students in China).
// Purely suggestions — the user can always type anything else.
const COMMON_PROGRAMS = [
  'Accounting',
  'Actuarial Science',
  'Aerospace Engineering',
  'Agriculture',
  'Applied Mathematics',
  'Architecture',
  'Artificial Intelligence',
  'Automation',
  'Bioengineering',
  'Biology',
  'Biotechnology',
  'Business Administration',
  'Chemical Engineering',
  'Chemistry',
  'Chinese Language (Mandarin)',
  'Civil Engineering',
  'Clinical Medicine (MBBS)',
  'Communication',
  'Computer Engineering',
  'Computer Science',
  'Cybersecurity',
  'Data Science',
  'Dentistry',
  'Design',
  'Economics',
  'Education',
  'Electrical Engineering',
  'Electronics and Information Engineering',
  'Energy and Power Engineering',
  'Environmental Engineering',
  'Environmental Science',
  'Finance',
  'Food Science and Engineering',
  'History',
  'International Business',
  'International Economics and Trade',
  'International Relations',
  'Journalism',
  'Law',
  'Linguistics',
  'Materials Science',
  'Mathematics',
  'MBA',
  'Mechanical Engineering',
  'Music',
  'Nursing',
  'Pharmacy',
  'Philosophy',
  'Physics',
  'Political Science',
  'Psychology',
  'Public Administration',
  'Robotics',
  'Software Engineering',
  'Sociology',
  'Sports Science',
  'Statistics',
  'Supply Chain Management',
  'Teaching Chinese as a Foreign Language (TCSOL)',
  'Traditional Chinese Medicine',
  'Tourism Management',
  'Translation and Interpreting',
  'Urban Planning',
]

// Every word of the query must be the prefix of some word of the program name,
// so "comp" matches "Computer Science" and "computer en" matches "Computer Engineering".
const matchesQuery = (program, query) => {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!queryWords.length) return false
  const nameWords = program.toLowerCase().split(/\s+/)
  return queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw)))
}

const getSuggestions = (query) => {
  const matches = COMMON_PROGRAMS.filter((p) => matchesQuery(p, query))
  const lowerQuery = query.trim().toLowerCase()
  // Programs starting with the full query first, then the rest, each alphabetical
  return matches.sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(lowerQuery) ? 0 : 1
    const bStarts = b.toLowerCase().startsWith(lowerQuery) ? 0 : 1
    return aStarts - bStarts || a.localeCompare(b)
  })
}

// ProgramAutocomplete - free-text input with guiding suggestions.
// The list is position: fixed so it is not clipped by the collapsible
// section's overflow: hidden while scrolling into view.
export const ProgramAutocomplete = ({ id, value, onChange, placeholder }) => {
  const [focused, setFocused] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [listStyle, setListStyle] = useState(null)
  const inputRef = useRef(null)
  const blurTimer = useRef(null)

  const suggestions = value.trim() ? getSuggestions(value).slice(0, 6) : []
  const exactMatch = value.trim().toLowerCase() === suggestions[0]?.toLowerCase()
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

  const select = (program) => {
    onChange(program)
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
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      select(suggestions[highlightedIndex])
    } else if (e.key === 'Escape') {
      setFocused(false)
      setHighlightedIndex(-1)
    }
  }

  const handleBlur = () => {
    // Delay so clicking a suggestion registers before the list unmounts
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
          aria-label="Program suggestions"
        >
          {suggestions.map((program, index) => (
            <li
              key={program}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`autocomplete-option ${index === highlightedIndex ? 'highlighted' : ''}`}
              // onMouseDown fires before the input's blur, so the click isn't lost
              onMouseDown={(e) => {
                e.preventDefault()
                select(program)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {program}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
