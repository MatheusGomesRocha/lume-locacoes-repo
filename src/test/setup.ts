import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom não tem ResizeObserver, que o Recharts usa
class ResizeObserverFalso { observe() {} unobserve() {} disconnect() {} }
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverFalso

beforeEach(() => {
  localStorage.clear()
  // jsdom não implementa rolagem
  Element.prototype.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
})
afterEach(() => cleanup())
