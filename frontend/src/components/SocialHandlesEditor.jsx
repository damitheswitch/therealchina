import { socialPlatforms } from '../lib/socialPlatforms'
import { Icons } from './Icons'

export const SocialHandlesEditor = ({
  value,
  onChange,
  showHandles,
  onShowChange,
  disabled = false,
}) => {
  const handles = value?.length > 0 ? value : [{ platform: 'wechat', handle: '' }]

  const updateHandle = (index, field, newValue) => {
    const updated = handles.map((h, i) =>
      i === index ? { ...h, [field]: newValue } : h
    )
    onChange(updated)
  }

  const removeHandle = (index) => {
    const updated = handles.filter((_, i) => i !== index)
    onChange(updated.length > 0 ? updated : [{ platform: 'wechat', handle: '' }])
  }

  const addHandle = () => {
    onChange([...handles, { platform: 'wechat', handle: '' }])
  }

  return (
    <div className="social-handles-editor">
      <div className="social-handles-list">
        {handles.map((social, index) => (
          <div key={index} className="social-handle-item">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Platform</label>
              <select
                value={social.platform || 'wechat'}
                onChange={(e) => updateHandle(index, 'platform', e.target.value)}
                className="form-select"
                disabled={disabled}
              >
                {Object.entries(socialPlatforms).map(([key, platform]) => (
                  <option key={key} value={key}>
                    {platform.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Handle</label>
              <input
                type="text"
                value={social.handle || ''}
                onChange={(e) => updateHandle(index, 'handle', e.target.value)}
                placeholder="@your_handle"
                className="form-input"
                disabled={disabled}
              />
            </div>

            {handles.length > 1 && (
              <button
                type="button"
                onClick={() => removeHandle(index)}
                className="btn btn-outline btn-sm"
                disabled={disabled}
              >
                <Icons.Trash /> Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addHandle}
        className="btn btn-outline"
        disabled={disabled}
      >
        <Icons.Plus /> Add Social Profile
      </button>

      <div className="form-group" style={{ marginTop: 'var(--sp-2)', marginBottom: 0 }}>
        <label className="form-checkbox-label">
          <input
            type="checkbox"
            checked={showHandles}
            onChange={(e) => onShowChange?.(e.target.checked)}
            className="form-checkbox"
            disabled={disabled}
          />
          <span>Show social handles on my profile</span>
        </label>
        <p className="form-hint">
          When enabled, other authenticated users can see your social handles to connect with you.
        </p>
      </div>
    </div>
  )
}
