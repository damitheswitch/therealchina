import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RewardEmailNotice, type RewardMissing } from './RewardEmailNotice'

const setup = (full: boolean, missing: RewardMissing[] = []) => {
  const handlers = { onFix: vi.fn(), onChoose: vi.fn(), onClose: vi.fn() }
  render(
    <MemoryRouter>
      <RewardEmailNotice email="me@example.com" full={full} missing={missing} {...handlers} />
    </MemoryRouter>
  )
  return handlers
}

describe('RewardEmailNotice', () => {
  it('lists missing items and calls onFix with the tapped one', () => {
    const h = setup(false, ['words', 'money'])
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Add the cost/ }))
    expect(h.onFix).toHaveBeenCalledWith('money')
    expect(screen.queryByRole('button', { name: /Add your major/ })).toBeNull()
  })

  it('Finish my gift has focus and fixes the first missing item', () => {
    const h = setup(false, ['taps', 'program'])
    const finish = screen.getByRole('button', { name: 'Finish my gift' })
    expect(document.activeElement).toBe(finish)
    fireEvent.click(finish)
    expect(h.onFix).toHaveBeenCalledWith('taps')
    fireEvent.click(screen.getByRole('button', { name: 'Post without the gift' }))
    expect(h.onChoose).toHaveBeenCalledWith(false)
  })

  it('full state posts with the gift', () => {
    const h = setup(true)
    expect(screen.getByText(/me@example.com/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Post and get my gift' }))
    expect(h.onChoose).toHaveBeenCalledWith(true)
  })

  it('Escape closes', () => {
    const h = setup(true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(h.onClose).toHaveBeenCalled()
  })

  it('links to the gifts policy', () => {
    setup(true)
    const link = screen.getByRole('link', { name: /How gifts work/ })
    expect(link.getAttribute('href')).toBe('/editorial-policy#gifts')
  })
})
