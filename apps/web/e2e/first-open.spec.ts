import { expect, test } from '@playwright/test'
import { completeOnboarding, serverRows, signIn, syncIndicator, uniqueEmail } from './support'

// F1, R3, R4: VA → code → V0 in 3 steps → empty Inicio.
test('first open: the emailed code leads through onboarding to an empty Inicio', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Training Log' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar código' })).toBeEnabled()

  const email = uniqueEmail('first-open')
  await signIn(page, email)
  await completeOnboarding(page, 'Ana')

  await expect(page.getByText('Hola, Ana')).toBeVisible()
  await expect(page.getByText('Crea tu primera rutina')).toBeVisible()
  await expect(syncIndicator(page, 'sincronizado')).toBeVisible()

  // The account exists on the server and the onboarding settings reached it.
  await expect
    .poll(
      async () =>
        (await serverRows(page)).find((r) => r.table === 'settings')?.row.onboardedAt ?? null,
    )
    .not.toBeNull()

  // The session survives a reload: no second code.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
})
