import { expect, test } from '@playwright/test'
import {
  activeWorkout,
  completeRow,
  createRoutine,
  finishWorkout,
  serverRows,
  signUp,
  startRoutine,
  syncIndicator,
  waitForServiceWorker,
} from './support'

// F2, R5, R6, and U8's precache: the whole workout happens with the browser offline.
test('offline workout: logged without signal, synced when the connection returns', async ({
  page,
  context,
}) => {
  await signUp(page, 'offline')
  await createRoutine(page, { name: 'Empuje', sets: 2, weightKg: 60 })
  await expect(syncIndicator(page, 'sincronizado')).toBeVisible()
  await waitForServiceWorker(page)

  await context.setOffline(true)
  // The installed shell opens with no network at all (service worker precache).
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await expect(syncIndicator(page, 'sin conexión')).toBeVisible()

  await startRoutine(page, 'Empuje')
  await expect(activeWorkout(page)).toBeVisible()
  await expect(
    activeWorkout(page).getByText('Sin conexión. Tu entreno se guarda en este móvil.'),
  ).toBeVisible()
  await completeRow(page, '1')
  await completeRow(page, '2')
  await finishWorkout(page)

  // Saved locally, waiting to sync.
  await expect(syncIndicator(page, 'sin conexión')).toHaveAccessibleName(/cambios? pendientes?/)
  await expect(page.getByRole('article', { name: 'Empuje' })).toContainText('Última vez')

  await context.setOffline(false)
  await expect(syncIndicator(page, 'sincronizado')).toBeVisible({ timeout: 30_000 })

  const rows = await serverRows(page)
  const workout = rows.find((r) => r.table === 'workouts')
  expect(workout?.row).toMatchObject({ name: 'Empuje', status: 'finished' })
  const sets = rows.filter((r) => r.table === 'workoutSets' && r.row.completed === true)
  expect(sets).toHaveLength(2)
  expect(sets.map((s) => s.row.weight)).toEqual([60, 60])
})
