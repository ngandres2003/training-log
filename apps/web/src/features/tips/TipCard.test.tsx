import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TipCard } from './TipCard'
import { randomTipIndex, TIPS } from './tips'

describe('tips', () => {
  it('ships at least 3 tips with unique ids', () => {
    expect(TIPS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length)
  })

  it('randomTipIndex never repeats the excluded tip', () => {
    for (let r = 0; r < 1; r += 0.05) {
      for (let exclude = 0; exclude < 3; exclude++) {
        const i = randomTipIndex(3, exclude, () => r)
        expect(i).not.toBe(exclude)
        expect(i).toBeGreaterThanOrEqual(0)
        expect(i).toBeLessThan(3)
      }
    }
  })

  it('"Otro consejo" shows a different tip', async () => {
    const user = userEvent.setup()
    const tips = [
      { id: 'a', text: 'Consejo A' },
      { id: 'b', text: 'Consejo B' },
    ]
    render(<TipCard tips={tips} />)
    const first = screen.getByText(/Consejo [AB]/).textContent

    await user.click(screen.getByRole('button', { name: 'Otro consejo' }))

    expect(screen.getByText(/Consejo [AB]/).textContent).not.toBe(first)
  })
})
