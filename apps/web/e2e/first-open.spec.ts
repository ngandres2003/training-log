import { expect, test } from '@playwright/test'
import { acceptInvite, completeOnboarding, serverRows, syncIndicator, uniqueEmail } from './support'

// F1, R3, R4: invite link → password → V0 in 3 steps → empty Inicio.
test('first open: an invite link leads through onboarding to an empty Inicio', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Training Log' })).toBeVisible()
  await expect(page.getByLabel('Contraseña')).toBeVisible()

  const email = uniqueEmail('first-open')
  await acceptInvite(page, email)
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

  // The session survives a reload: no password again.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
})
