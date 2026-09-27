import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProvinceCityPicker } from './ProvinceCityPicker'

const Harness = ({
  initial = '',
  emitFormat,
  allowOutsideChina,
  onParts,
}: {
  initial?: string
  emitFormat?: 'location' | 'term'
  allowOutsideChina?: boolean
  onParts?: (p: { province: string; city: string }) => void
}) => {
  const [value, setValue] = useState(initial)
  return (
    <>
      <ProvinceCityPicker
        id="loc"
        value={value}
        onChange={setValue}
        onParts={onParts}
        emitFormat={emitFormat}
        allowOutsideChina={allowOutsideChina}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('ProvinceCityPicker', () => {
  it('enables the city select only after a province is picked', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const city = screen.getByLabelText('City')
    expect(city).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Province'), 'Zhejiang')
    expect(city).not.toBeDisabled()
    expect(screen.getByTestId('value')).toHaveTextContent('Zhejiang')
  })

  it('emits "City, Province" when both are picked', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(screen.getByLabelText('Province'), 'Jiangsu')
    await user.selectOptions(screen.getByLabelText('City'), 'Nanjing')
    expect(screen.getByTestId('value')).toHaveTextContent('Nanjing, Jiangsu')
  })

  it('collapses municipalities to the bare province name', async () => {
    const user = userEvent.setup()
    const parts: { province: string; city: string }[] = []
    render(<Harness onParts={(p) => parts.push(p)} />)
    await user.selectOptions(screen.getByLabelText('Province'), 'Beijing')
    expect(screen.getByTestId('value')).toHaveTextContent(/^Beijing$/)
    // parts mode still reports a city so callers requiring city don't break
    expect(parts[parts.length - 1]).toEqual({ province: 'Beijing', city: 'Beijing' })
  })

  it('typed "Somewhere else…" city joins the chosen province', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(screen.getByLabelText('Province'), 'Zhejiang')
    await user.selectOptions(screen.getByLabelText('City'), '__other_city')
    await user.type(screen.getByLabelText('City name'), 'Yiwu')
    expect(screen.getByTestId('value')).toHaveTextContent('Yiwu, Zhejiang')
  })

  it('Outside China swaps to a free-text input and back', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.selectOptions(screen.getByLabelText('Province'), '__outside_china')
    await user.type(screen.getByLabelText('Location'), 'Berlin')
    expect(screen.getByTestId('value')).toHaveTextContent('Berlin')

    await user.click(screen.getByRole('button', { name: /back to province/i }))
    expect(screen.getByTestId('value')).toHaveTextContent('')
    expect(screen.getByLabelText('Province')).toBeInTheDocument()
  })

  it('term format emits only the leaf for substring filters', async () => {
    const user = userEvent.setup()
    render(<Harness emitFormat="term" />)
    await user.selectOptions(screen.getByLabelText('Province'), 'Jiangsu')
    expect(screen.getByTestId('value')).toHaveTextContent(/^Jiangsu$/)
    await user.selectOptions(screen.getByLabelText('City'), 'Suzhou')
    expect(screen.getByTestId('value')).toHaveTextContent(/^Suzhou$/)
  })

  it('restores existing stored values', () => {
    render(<Harness initial="Nanjing, Jiangsu" />)
    expect(screen.getByLabelText('Province')).toHaveValue('Jiangsu')
    expect(screen.getByLabelText('City')).toHaveValue('Nanjing')
  })

  it('restores a bare municipality value', () => {
    render(<Harness initial="Shanghai" />)
    expect(screen.getByLabelText('Province')).toHaveValue('Shanghai')
    expect(screen.getByLabelText('City')).toHaveValue('Shanghai')
  })

  it('restores legacy free text into the outside-China input', () => {
    render(<Harness initial="Berlin" />)
    expect(screen.getByLabelText('Location')).toHaveValue('Berlin')
  })

  it('can hide the outside-China escape for university picks', () => {
    render(<Harness allowOutsideChina={false} />)
    expect(screen.queryByRole('option', { name: /outside china/i })).not.toBeInTheDocument()
  })
})
