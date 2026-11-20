import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { More } from './More'
import { MORE_MODULES } from './modules'

vi.mock('../../app/SyncIndicator', () => ({ SyncIndicator: () => null }))

afterEach(cleanup)

describe('More', () => {
  it('lists every module as a link to its page', () => {
    const router = createMemoryRouter([{ path: '/mas', element: <More /> }], { initialEntries: ['/mas'] })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { name: 'Más' })).toBeInTheDocument()
    const list = within(screen.getByRole('list'))
    for (const m of MORE_MODULES) {
      expect(list.getByRole('link', { name: new RegExp(m.label) })).toHaveAttribute('href', m.to)
    }
  })
})
