import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SocialHandlesEditor } from './SocialHandlesEditor'

describe('SocialHandlesEditor', () => {
  it('renders quick-add platform buttons', () => {
    const onChange = vi.fn()
    render(
      <SocialHandlesEditor
        value={[{ platform: 'wechat', handle: '' }]}
        onChange={onChange}
        showHandles={true}
        onShowChange={() => {}}
      />
    )

    expect(screen.getByRole('button', { name: /add instagram/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add whatsapp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add telegram/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add linkedin/i })).toBeInTheDocument()
  })

  it('clicking a quick-add platform button replaces empty default row', () => {
    const onChange = vi.fn()
    render(
      <SocialHandlesEditor
        value={[{ platform: 'wechat', handle: '' }]}
        onChange={onChange}
        showHandles={true}
        onShowChange={() => {}}
      />
    )

    const addIgBtn = screen.getByRole('button', { name: /add instagram/i })
    fireEvent.click(addIgBtn)

    expect(onChange).toHaveBeenCalledWith([{ platform: 'instagram', handle: '' }])
  })

  it('clicking a quick-add platform button appends when existing rows have data', () => {
    const onChange = vi.fn()
    render(
      <SocialHandlesEditor
        value={[{ platform: 'wechat', handle: 'my_wx' }]}
        onChange={onChange}
        showHandles={true}
        onShowChange={() => {}}
      />
    )

    const addIgBtn = screen.getByRole('button', { name: /add instagram/i })
    fireEvent.click(addIgBtn)

    expect(onChange).toHaveBeenCalledWith([
      { platform: 'wechat', handle: 'my_wx' },
      { platform: 'instagram', handle: '' },
    ])
  })

  it('auto-detects platform and extracts clean handle when URL is pasted', () => {
    const onChange = vi.fn()
    render(
      <SocialHandlesEditor
        value={[{ platform: 'wechat', handle: '' }]}
        onChange={onChange}
        showHandles={true}
        onShowChange={() => {}}
      />
    )

    const handleInput = screen.getByPlaceholderText(/wechat id/i)
    fireEvent.change(handleInput, {
      target: { value: 'https://t.me/beijing_students' },
    })

    expect(onChange).toHaveBeenCalledWith([{ platform: 'telegram', handle: 'beijing_students' }])
  })

  it('cleans handle when typing or pasting @-prefix into Instagram', () => {
    const onChange = vi.fn()
    render(
      <SocialHandlesEditor
        value={[{ platform: 'instagram', handle: '' }]}
        onChange={onChange}
        showHandles={true}
        onShowChange={() => {}}
      />
    )

    const handleInput = screen.getByPlaceholderText(/username/i)
    fireEvent.change(handleInput, {
      target: { value: '@alice_in_beijing' },
    })

    expect(onChange).toHaveBeenCalledWith([{ platform: 'instagram', handle: 'alice_in_beijing' }])
  })

  it('removes handle row when remove button is clicked', () => {
    const onChange = vi.fn()
    render(
      <SocialHandlesEditor
        value={[
          { platform: 'wechat', handle: 'wx_1' },
          { platform: 'instagram', handle: 'ig_1' },
        ]}
        onChange={onChange}
        showHandles={true}
        onShowChange={() => {}}
      />
    )

    const removeBtns = screen.getAllByRole('button', { name: /remove .* handle/i })
    expect(removeBtns.length).toBe(2)
    fireEvent.click(removeBtns[0])

    expect(onChange).toHaveBeenCalledWith([{ platform: 'instagram', handle: 'ig_1' }])
  })
})
