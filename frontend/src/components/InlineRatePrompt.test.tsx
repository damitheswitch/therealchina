import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'

// reviewFlow.ts pulls a runtime constant from reviewDrafts.ts, which imports
// the Supabase client — mock it so the test env (no env vars) can load it.
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))
import { InlineRatePrompt } from './InlineRatePrompt'

const uni = { id: 'uni-1', name: 'Xidian University', slug: 'xidian' }

const LocationProbe = () => {
  const { pathname, search } = useLocation()
  return <output data-testid="loc">{`${pathname}${search}`}</output>
}

const renderPrompt = () =>
  render(
    <MemoryRouter>
      <InlineRatePrompt university={uni} />
      <LocationProbe />
    </MemoryRouter>
  )

describe('InlineRatePrompt', () => {
  it('starts collapsed with the drawer hidden', () => {
    renderPrompt()
    expect(screen.queryByRole('button', { name: 'Continue to publish →' })).not.toBeInTheDocument()
    expect(document.querySelector('.inline-rate-drawer')).toBeNull()
  })

  it('tapping a star opens the drawer, shows the vibe, and infers the verdict', async () => {
    const user = userEvent.setup()
    renderPrompt()
    await user.click(screen.getByRole('radio', { name: '4 Good' }))
    expect(document.querySelector('.inline-rate-drawer')).not.toBeNull()
    expect(screen.getByText('A solid choice for international students.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recommend/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('tapping a verdict pill opens the drawer and seeds a starting rating', async () => {
    const user = userEvent.setup()
    renderPrompt()
    await user.click(screen.getByRole('button', { name: /Mixed/ }))
    expect(document.querySelector('.inline-rate-drawer')).not.toBeNull()
    expect(screen.getByText('Decent overall, with trade-offs.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '3 So-so' })).toBeChecked()
    expect(screen.getByRole('button', { name: /Mixed/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a deliberate verdict survives a later star change', async () => {
    const user = userEvent.setup()
    renderPrompt()
    await user.click(screen.getByRole('button', { name: /Avoid/ }))
    await user.click(screen.getByRole('radio', { name: '4 Good' }))
    expect(screen.getByRole('button', { name: /Avoid/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('continues to /review with the picked rating, verdict, and text', async () => {
    const user = userEvent.setup()
    renderPrompt()
    await user.click(screen.getByRole('radio', { name: '5 Amazing' }))
    await user.type(screen.getByLabelText(/Got 20 seconds/), 'Dorms were fine, stipend late')
    await user.click(screen.getByRole('button', { name: 'Continue to publish →' }))
    expect(screen.getByTestId('loc').textContent).toBe(
      '/review?uni=xidian&rating=5&recommend=yes&text=Dorms+were+fine%2C+stipend+late'
    )
  })

  it('omits empty verdict and text params from the continue URL', async () => {
    const user = userEvent.setup()
    renderPrompt()
    await user.click(screen.getByRole('radio', { name: '1 Poor' }))
    // Tapping the inferred Avoid pill again toggles it off.
    await user.click(screen.getByRole('button', { name: /Avoid/ }))
    await user.click(screen.getByRole('button', { name: 'Continue to publish →' }))
    expect(screen.getByTestId('loc').textContent).toBe('/review?uni=xidian&rating=1')
  })
})
