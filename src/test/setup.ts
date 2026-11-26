import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom não tem ResizeObserver, que o Recharts usa
class ResizeObserverFalso { observe() {} unobserve() {} disconnect() {} }
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverFalso

beforeEach(() => {
  // Os testes usam 25/11/2026 como "hoje" (ver HOJE em test/utils.tsx). Congelar só o Date evita que
  // os testes quebrem no dia seguinte (ou na virada do dia em UTC, como no GitHub Actions).
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0))
  localStorage.clear()
  // jsdom não implementa rolagem
  Element.prototype.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
