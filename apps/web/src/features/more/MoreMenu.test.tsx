import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { MoreMenu } from './MoreMenu'
import { MORE_MODULES } from './modules'

afterEach(cleanup)

function setup(path = '/') {
  const router = createMemoryRouter(
    [{ path: '*', element: <MoreMenu tabClassName={(active) => (active ? 'activa' : '')} /> }],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('MoreMenu', () => {
  it('opens a menu with every module and navigates to the chosen one', async () => {
    const user = userEvent.setup()
    const router = setup()
    const button = screen.getByRole('button', { name: 'Más' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(MORE_MODULES.length)

    await user.click(screen.getByRole('menuitem', { name: /Biblioteca de ejercicios/ }))
    expect(router.state.location.pathname).toBe('/perfil/ejercicios')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Más' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('stays lit inside a module', () => {
    setup('/perfil')
    expect(screen.getByRole('button', { name: 'Más' })).toHaveClass('activa')
  })
})
