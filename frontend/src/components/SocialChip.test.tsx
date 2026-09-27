import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SocialChip } from './SocialChip'

describe('SocialChip', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders nothing when handle is empty or whitespace', () => {
    const { container } = render(<SocialChip platform="wechat" handle="   " />)
    expect(container.firstChild).toBeNull()
  })

  it('renders WeChat in full variant as copy-only action with brand label', () => {
    render(<SocialChip platform="wechat" handle="beijing_expats" />)
    expect(screen.getByText('WeChat')).toBeInTheDocument()
    expect(screen.getByText('beijing_expats')).toBeInTheDocument()

    // No external link for WeChat
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders web platform Instagram with valid external link', () => {
    render(<SocialChip platform="instagram" handle="alice_in_shanghai" />)
    expect(screen.getByText('Instagram')).toBeInTheDocument()
    expect(screen.getByText('@alice_in_shanghai')).toBeInTheDocument()

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://instagram.com/alice_in_shanghai')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('defensively cleans pasted URL in handle prop', () => {
    render(<SocialChip platform="telegram" handle="https://t.me/student_union/?start=1" />)
    expect(screen.getByText('@student_union')).toBeInTheDocument()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://t.me/student_union')
  })

  it('copies handle to clipboard when copy button is clicked', async () => {
    const onCopy = vi.fn()
    render(<SocialChip platform="wechat" handle="my_wechat_id" onCopy={onCopy} />)

    const copyBtn = screen.getByRole('button', { name: /copy wechat handle/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('my_wechat_id')
      expect(onCopy).toHaveBeenCalledWith('my_wechat_id')
    })
  })

  it('renders compact variant with copy button', () => {
    render(<SocialChip platform="whatsapp" handle="+86 138 0000 0000" variant="compact" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://wa.me/8613800000000')
  })

  it('renders icon-only variant with proper accessibility label', () => {
    render(<SocialChip platform="linkedin" handle="shanghai-alumni" variant="icon-only" />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/shanghai-alumni')
    expect(link).toHaveAttribute('aria-label', expect.stringContaining('LinkedIn'))
  })
})
