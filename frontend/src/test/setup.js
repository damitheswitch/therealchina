import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom lacks these browser APIs used by interactive components.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView = vi.fn()
