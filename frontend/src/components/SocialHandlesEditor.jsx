import {
  socialPlatforms,
  phonePlatforms,
  cleanHandle,
  detectPlatformFromUrl,
} from '../lib/socialPlatforms'
import { Icons } from './Icons'
import { PlatformIcon } from './SocialChip'

const QUICK_ADD_PLATFORMS = [
  'wechat',
  'instagram',
  'whatsapp',
  'telegram',
  'linkedin',
  'rednote',
  'x',
  'github',
  'website',
]

export const SocialHandlesEditor = ({
  value,
  onChange,
  showHandles,
  onShowChange,
  disabled = false,
}) => {
  const handles = value?.length > 0 ? value : [{ platform: 'wechat', handle: '' }]

  const updateHandle = (index, field, newValue) => {
    if (field === 'handle') {
      // Check if user pasted a full URL for any platform
      const detected = detectPlatformFromUrl(newValue)
      if (detected) {
        const updated = handles.map((h, i) =>
          i === index ? { platform: detected.platform, handle: detected.handle } : h
        )
        onChange(updated)
        return
      }

      // Clean for current platform
      const currentPlatform = handles[index]?.platform || 'wechat'
      const cleaned = cleanHandle(currentPlatform, newValue)
      const updated = handles.map((h, i) => (i === index ? { ...h, handle: cleaned } : h))
      onChange(updated)
      return
    }

    // Platform change: re-clean existing handle with the new platform rules
    const updated = handles.map((h, i) => {
      if (i !== index) return h
      const currentHandle = h.handle || ''
      return {
        platform: newValue,
        handle: cleanHandle(newValue, currentHandle),
      }
    })
    onChange(updated)
  }

  const removeHandle = (index) => {
    const updated = handles.filter((_, i) => i !== index)
    onChange(updated.length > 0 ? updated : [{ platform: 'wechat', handle: '' }])
  }

  const addHandle = () => {
    onChange([...handles, { platform: 'wechat', handle: '' }])
  }

  const addSpecificPlatform = (platformKey) => {
    // If the only item is an untouched blank default wechat row, replace it
    if (handles.length === 1 && handles[0].platform === 'wechat' && !handles[0].handle?.trim()) {
      onChange([{ platform: platformKey, handle: '' }])
      return
    }
    // Check if platform is already added
    const alreadyExists = handles.some((h) => h.platform === platformKey)
    if (alreadyExists) {
      // Append another row or keep as is
      onChange([...handles, { platform: platformKey, handle: '' }])
    } else {
      onChange([...handles, { platform: platformKey, handle: '' }])
    }
  }

  const existingPlatforms = new Set(handles.map((h) => h.platform))

  return (
    <div className="social-handles-editor">
      {/* Quick-add platform bar */}
      <div className="social-quick-add-section">
        <span className="social-quick-add-label">Quick add platform:</span>
        <div className="social-quick-add-chips">
          {QUICK_ADD_PLATFORMS.map((key) => {
            const p = socialPlatforms[key]
            if (!p) return null
            const isAdded = existingPlatforms.has(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => addSpecificPlatform(key)}
                className={`btn-quick-add-platform ${isAdded ? 'is-added' : ''}`}
                disabled={disabled}
                aria-label={`Add ${p.label}`}
                title={
                  isAdded ? `${p.label} already added (click to add another)` : `Add ${p.label}`
                }
              >
                <span className="quick-add-icon">
                  <PlatformIcon platform={key} size={13} />
                </span>
                <span>{p.label}</span>
                <span className="quick-add-plus">+</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="social-handles-list">
        {handles.map((social, index) => {
          const currentPlatform = social.platform || 'wechat'
          const platformData = socialPlatforms[currentPlatform] || socialPlatforms.other
          const prefix = platformData.prefix

          return (
            <div key={index} className="social-handle-item">
              <div className="social-handle-fields-grid">
                <div className="form-group social-platform-group">
                  <label htmlFor={`social-platform-select-${index}`} className="form-label">
                    Platform
                  </label>
                  <div className="platform-select-wrap">
                    <span className="platform-select-icon">
                      <PlatformIcon platform={currentPlatform} size={16} />
                    </span>
                    <select
                      id={`social-platform-select-${index}`}
                      value={currentPlatform}
                      onChange={(e) => updateHandle(index, 'platform', e.target.value)}
                      className="form-select platform-select-input"
                      disabled={disabled}
                    >
                      {Object.entries(socialPlatforms).map(([key, platform]) => (
                        <option key={key} value={key}>
                          {platform.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group social-handle-group">
                  <label htmlFor={`social-handle-input-${index}`} className="form-label">
                    {phonePlatforms.has(currentPlatform)
                      ? 'Phone number (with country code)'
                      : 'Handle or Profile Link'}
                  </label>
                  <div className="input-with-prefix">
                    {prefix && <span className="input-prefix-tag">{prefix}</span>}
                    <input
                      id={`social-handle-input-${index}`}
                      type={phonePlatforms.has(currentPlatform) ? 'tel' : 'text'}
                      value={social.handle || ''}
                      onChange={(e) => updateHandle(index, 'handle', e.target.value)}
                      placeholder={
                        platformData.placeholder ||
                        (phonePlatforms.has(currentPlatform)
                          ? '+1 555 123 4567'
                          : 'username or URL')
                      }
                      className={`form-input ${prefix ? 'has-prefix' : ''}`}
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="social-handle-remove-cell">
                  {handles.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeHandle(index)}
                      className="btn btn-outline btn-sm btn-remove-social"
                      disabled={disabled}
                      aria-label={`Remove ${platformData.label} handle`}
                      title="Remove handle"
                    >
                      <Icons.Trash />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="social-editor-footer-actions">
        <button
          type="button"
          onClick={addHandle}
          className="btn btn-outline btn-sm"
          disabled={disabled}
        >
          <Icons.Plus /> Add Another Profile
        </button>
      </div>

      <div className="form-group" style={{ marginTop: 'var(--sp-3)', marginBottom: 0 }}>
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
          When enabled, other verified members can see your socials and 1-click copy or connect with
          you.
        </p>
      </div>
    </div>
  )
}
