import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudyStatusField } from './fields'
import { emptyReviewFieldValues } from '../../lib/reviewFlow'
import type { ReviewForm } from '../../hooks/useReviewForm'

// fields.tsx reaches the Supabase client through its autocomplete imports; the
// test never calls it.
vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } },
}))

const formWith = (values: Partial<typeof emptyReviewFieldValues>) => {
  const set = vi.fn()
  const form = {
    values: { ...emptyReviewFieldValues, ...values },
    set,
    applyValues: vi.fn(),
  } as unknown as ReviewForm
  return { form, set }
}

describe('StudyStatusField', () => {
  it('stays hidden until a start year is picked', () => {
    const { form } = formWith({})
    const { container } = render(<StudyStatusField form={form} />)
    expect(container.firstChild).toBeNull()
  })

  it('stays hidden for exchange students', () => {
    const { form } = formWith({ startYear: 2024, enrollmentStatus: 'exchange' })
    const { container } = render(<StudyStatusField form={form} />)
    expect(container.firstChild).toBeNull()
  })

  it('marks the reviewer as a current student with no end year', () => {
    const { form, set } = formWith({ startYear: 2024 })
    render(<StudyStatusField form={form} />)
    fireEvent.click(screen.getByRole('button', { name: 'Yes, still here' }))
    expect(set).toHaveBeenCalledWith('enrollmentStatus', 'current')
    expect(set).toHaveBeenCalledWith('endYear', '')
  })

  it('shows finish-year chips after "I finished"', () => {
    const { form } = formWith({ startYear: 2019, enrollmentStatus: 'alumni' })
    render(<StudyStatusField form={form} />)
    expect(screen.getByText('Finish year')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'I finished' }).getAttribute('aria-pressed')).toBe(
      'true'
    )
  })
})
