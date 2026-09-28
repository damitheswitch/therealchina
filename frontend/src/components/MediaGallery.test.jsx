import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaGallery } from './MediaGallery'

const photos = [
  'https://cdn.example.com/a.jpg',
  'https://cdn.example.com/b.jpg',
  'https://cdn.example.com/c.mp4',
]

const openLightbox = (index = 0) => {
  const tiles = document.querySelectorAll('.gallery-item')
  fireEvent.click(tiles[index])
}

describe('MediaGallery lightbox', () => {
  it('opens the viewer in a body portal so transformed ancestors cannot clip it', () => {
    render(
      <div className="fade-in">
        <MediaGallery media={photos} />
      </div>
    )
    openLightbox()

    const dialog = screen.getByRole('dialog')
    expect(dialog.parentElement).toBe(document.body)
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.querySelector('.fade-in .media-lightbox-overlay')).toBeNull()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('navigates with arrow buttons, arrow keys, and wraps around', () => {
    render(<MediaGallery media={photos} />)
    openLightbox()

    fireEvent.click(screen.getByRole('button', { name: 'Next media' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('closes on Escape, backdrop click, and the close button', () => {
    const { unmount } = render(<MediaGallery media={photos} />)
    openLightbox()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    openLightbox()
    fireEvent.click(document.querySelector('.media-lightbox-overlay'))
    expect(screen.queryByRole('dialog')).toBeNull()

    openLightbox()
    fireEvent.click(screen.getByRole('button', { name: 'Close media viewer' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()
  })

  it('locks body scroll while open and restores it on close', () => {
    render(<MediaGallery media={photos} />)
    openLightbox()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
  })

  it('renders a playable video element for video items', () => {
    render(<MediaGallery media={photos} />)
    openLightbox(2)
    const video = document.querySelector('.lightbox-video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('src', 'https://cdn.example.com/c.mp4')
  })
})
