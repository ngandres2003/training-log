import { expect, test } from '@playwright/test'
import {
  activeWorkout,
  completeRow,
  createRoutine,
  EXERCISE,
  finishWorkout,
  signUp,
  startRoutine,
} from './support'

// F3, R24: an added set and a heavier weight, "Sí" updates the routine template.
test('finish with changes: "Sí" updates the routine with the new set and weight', async ({
  page,
}) => {
  await signUp(page, 'finish')
  await createRoutine(page, { name: 'Torso', sets: 2, weightKg: 60 })

  await startRoutine(page, 'Torso')
  const v5 = activeWorkout(page)
  await expect(v5).toBeVisible()
  await v5.getByRole('button', { name: 'Añadir serie' }).click()
  await expect(v5.getByRole('row', { name: 'Fila 3' })).toBeVisible()

  for (const row of ['1', '2', '3']) {
    const weight = v5.getByLabel(`kg fila ${row}`, { exact: true })
    await weight.fill('62,5')
    await weight.press('Enter')
    // The added third row has no target and no previous session to prefill from.
    const reps = v5.getByLabel(`Reps fila ${row}`, { exact: true })
    await reps.fill('10')
    await reps.press('Enter')
    await completeRow(page, row)
  }

  await finishWorkout(page, async () => {
    const changes = page.getByRole('region', { name: '¿Actualizar la rutina?' })
    await expect(changes).toContainText(`${EXERCISE}: añadir serie 3`)
    await expect(changes).toContainText(`${EXERCISE}: serie 1 de 60 a 62,5 kg`)
    await changes.getByText('Sí', { exact: true }).click()
    await expect(changes.getByRole('radio', { name: 'Sí' })).toBeChecked()
  })

  await page.getByRole('article', { name: 'Torso' }).getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: 'Torso', level: 1 })).toBeVisible()
  await expect(page.getByRole('tabpanel')).toContainText('3 × 8–12 · 62,5 kg')
})
