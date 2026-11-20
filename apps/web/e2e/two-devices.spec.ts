import { devices, expect, test, type Browser, type Page, type TestInfo } from '@playwright/test'
import { createRoutine, serverRows, signIn, signUp, syncIndicator } from './support'

/** A second, independent device (own storage, own service worker) with the suite's settings. */
async function newDevice(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { baseURL, locale, timezoneId, extraHTTPHeaders } = testInfo.project.use
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL,
    locale,
    timezoneId,
    extraHTTPHeaders,
  })
  return context.newPage()
}

/** The routine name the server holds for this account. */
async function serverRoutineName(page: Page): Promise<unknown> {
  return (await serverRows(page)).find((r) => r.table === 'routines')?.row.name
}

async function renameRoutine(page: Page, from: string, to: string): Promise<void> {
  await page.getByRole('link', { name: 'Inicio' }).first().click()
  await page.getByRole('button', { name: `Opciones de ${from}` }).click()
  await page.getByRole('menuitem', { name: 'Editar' }).click()
  const name = page.getByLabel('Nombre', { exact: true })
  await expect(name).toHaveValue(from)
  await name.fill(to)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('heading', { name: to, level: 1 })).toBeVisible()
}

// R7: two devices on one account edit the same routine; the later write wins on both.
test('two devices: the later edit of a routine name wins on both', async ({
  page: a,
  browser,
}, testInfo) => {
  const email = await signUp(a, 'two-devices')
  await createRoutine(a, { name: 'Pierna', sets: 1 })
  await expect(syncIndicator(a, 'sincronizado')).toBeVisible({ timeout: 30_000 })

  // Device B signs in to the same account: no onboarding, the routine arrives by sync.
  const b = await newDevice(browser, testInfo)
  await signIn(b, email)
  await expect(b.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await expect(b.getByRole('article', { name: 'Pierna' })).toBeVisible()

  // A true conflict: B goes offline, so it edits without ever seeing A's edit.
  await b.context().setOffline(true)
  await renameRoutine(a, 'Pierna', 'Pierna (A)')
  await expect.poll(() => serverRoutineName(a), { timeout: 30_000 }).toBe('Pierna (A)')
  await renameRoutine(b, 'Pierna', 'Pierna (B)')

  // B reconnects: its write reaches the server last, so it wins (R7, no conflict screen).
  await b.context().setOffline(false)
  await expect.poll(() => serverRoutineName(b), { timeout: 30_000 }).toBe('Pierna (B)')
  await expect(syncIndicator(b, 'sincronizado')).toBeVisible({ timeout: 30_000 })
  await expect(b.getByRole('heading', { name: 'Pierna (B)', level: 1 })).toBeVisible()

  // A picks it up on its next sync (app start runs one).
  await a.goto('/')
  await expect(a.getByRole('article', { name: 'Pierna (B)' })).toBeVisible()
  await expect(a.getByRole('article', { name: 'Pierna (A)' })).toHaveCount(0)
  await b.goto('/')
  await expect(b.getByRole('article', { name: 'Pierna (B)' })).toBeVisible()

  await b.context().close()
})
