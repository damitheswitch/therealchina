import { useState } from 'react'
import React from 'react'

// StarInput component - interactive star rating input
export const StarInput = ({ value, onChange }) => {
  const [hoverLabel, setHoverLabel] = useState('')

  const labels = {
    5: '5 Amazing',
    4: '4 Good',
    3: '3 So-so',
    2: '2 Fair',
    1: '1 Poor',
  }

  const handleClick = (rating) => {
    onChange(rating)
    setHoverLabel(labels[rating])
  }

  const handleMouseEnter = (rating) => {
    setHoverLabel(labels[rating])
  }

  const handleMouseLeave = () => {
    setHoverLabel(value ? labels[value] : '')
  }

  return (
    <div className="star-input-wrap">
      <div className="star-input">
        {[5, 4, 3, 2, 1].map((rating) => (
          <React.Fragment key={rating}>
            <input
              key={`input-${rating}`}
              type="radio"
              name="rating"
              value={rating}
              checked={value === rating}
              onChange={() => handleClick(rating)}
            />
            <label
              key={`label-${rating}`}
              data-label={labels[rating]}
              onMouseEnter={() => handleMouseEnter(rating)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(rating)}
            >
              &#9733;
            </label>
          </React.Fragment>
        ))}
      </div>
      <div className="star-input-labels">{hoverLabel}</div>
    </div>
  )
}
