import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './copyText'

describe('copyText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses the Clipboard API when it works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    expect(await copyText('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when the Clipboard API rejects', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) },
    })
    const exec = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    expect(await copyText('hello')).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('reports failure when both paths fail', async () => {
    vi.stubGlobal('navigator', {})
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })
    expect(await copyText('hello')).toBe(false)
  })
})
