import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Intro, INTRO_MS } from './Intro'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Intro', () => {
  it('covers the app, hidden from screen readers, and goes away on its own', () => {
    const onDone = vi.fn()
    render(<Intro onDone={onDone} />)
    expect(screen.getByTestId('intro')).toHaveAttribute('aria-hidden', 'true')

    act(() => vi.advanceTimersByTime(INTRO_MS))
    expect(screen.queryByTestId('intro')).not.toBeInTheDocument()
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('a tap skips it', () => {
    render(<Intro />)
    fireEvent.click(screen.getByTestId('intro'))
    expect(screen.queryByTestId('intro')).not.toBeInTheDocument()
  })
})
