import { act, cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLayer } from './layer'

function Layer({ onClose }: { onClose: () => void }) {
  useLayer(onClose)
  return <div>layer</div>
}

function Host({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      {open && (
        <Layer
          onClose={() => {
            onClose?.()
            setOpen(false)
          }}
        />
      )}
      <button onClick={() => setOpen(false)}>cerrar</button>
    </>
  )
}

/** jsdom fires popstate asynchronously after history.back(). */
const settle = () => act(() => new Promise((r) => setTimeout(r, 20)))

afterEach(cleanup)

describe('useLayer', () => {
  it('Back closes the open layer instead of leaving the page', async () => {
    const onClose = vi.fn()
    const { queryByText } = render(<Host onClose={onClose} />)
    expect(window.history.state?.layer).toBeDefined()
    expect(document.documentElement.classList.contains('layer-open')).toBe(true)

    window.history.back()
    await settle()

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(queryByText('layer')).toBeNull()
    expect(document.documentElement.classList.contains('layer-open')).toBe(false)
  })

  it('closing from the UI pops its history entry again', async () => {
    const { getByText } = render(<Host />)
    const opened = window.history.state?.layer as string
    expect(opened).toBeDefined()

    await act(async () => getByText('cerrar').click())
    await settle()

    // Back on the entry below the layer, so the next Back leaves the page as expected.
    expect(window.history.state?.layer).not.toBe(opened)
    expect(document.documentElement.classList.contains('layer-open')).toBe(false)
  })
})
