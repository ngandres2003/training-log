import { expect, test } from '@playwright/test'
import { activeWorkout, completeRow, createRoutine, signUp, startRoutine } from './support'

// Spec F5 / KTD9: the active workout lives in IndexedDB, so a reload restores it.
test('a reload during an active workout restores it', async ({ page }) => {
  await signUp(page, 'reload')
  await createRoutine(page, { name: 'Espalda', sets: 2, weightKg: 50 })

  await startRoutine(page, 'Espalda')
  const v5 = activeWorkout(page)
  await expect(v5).toBeVisible()
  const weight = v5.getByLabel('kg fila 1', { exact: true })
  await weight.fill('55')
  await weight.press('Enter')
  await completeRow(page, '1')

  await page.reload()

  const banner = page.getByRole('region', { name: 'Tienes un entreno en curso' })
  await expect(banner).toBeVisible()
  await expect(banner).toContainText('Espalda')
  await banner.getByRole('button', { name: 'Continuar' }).click()

  await expect(v5).toBeVisible()
  await expect(v5.getByRole('button', { name: 'Completar fila 1' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(v5.getByLabel('kg fila 1', { exact: true })).toHaveValue('55')
  await expect(v5.getByRole('button', { name: 'Completar fila 2' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(v5.getByText('1/2 series')).toBeVisible()
})
