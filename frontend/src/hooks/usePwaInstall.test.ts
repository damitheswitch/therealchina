import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePwaInstall } from './usePwaInstall'

// jsdom runs on http://localhost — a non-prod origin, same class as staging.
describe('usePwaInstall on a non-prod origin', () => {
  it('never captures beforeinstallprompt off prod', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    renderHook(() => usePwaInstall())
    expect(addSpy.mock.calls.some(([type]) => type === 'beforeinstallprompt')).toBe(false)
    addSpy.mockRestore()
  })

  it('still shows the install CTA, which opens prod in a new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { result } = renderHook(() => usePwaInstall())

    expect(result.current.canInstall).toBe(false)
    expect(result.current.showInstall).toBe(true)

    act(() => result.current.openProdInstall())
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/www\.therealchina\.net\//),
      '_blank',
      expect.stringContaining('noopener')
    )
    openSpy.mockRestore()
  })
})
