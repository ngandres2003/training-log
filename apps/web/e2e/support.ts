import { neon } from '@neondatabase/serverless'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

/** Running against a deployed preview (`BASE_URL`) rather than the local build. */
export const remote = !!process.env.BASE_URL

/** The password every e2e account gets. */
export const E2E_PASSWORD = 'e2e-contraseña-segura'

/** A fresh address per test. No email is ever sent, so any domain works. */
export function uniqueEmail(tag: string): string {
  const id = `${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return `e2e-${id}@example.com`
}

/**
 * An invite link path (`/invitacion/<token>`) for `email`, as an admin would generate it: locally
 * from the e2e API's test route; against a preview, inserted straight into its database
 * (`E2E_DATABASE_URL`) with the same shape `apps/api/src/invites/invites.ts` writes.
 */
export async function mintInvite(request: APIRequestContext, email: string): Promise<string> {
  if (!remote) {
    const res = await request.post('/api/__e2e/invite', { data: { email } })
    expect(res.ok(), `e2e invite returned ${res.status()}`).toBe(true)
    return ((await res.json()) as { path: string }).path
  }
  const url = process.env.E2E_DATABASE_URL
  if (!url)
    throw new Error('E2E_DATABASE_URL (the preview Neon branch) is required when BASE_URL is set')
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await neon(url).query(
    `insert into invites (id, email, token_hash, expires_at) values ($1, $2, $3, now() + interval '7 days')`,
    [randomUUID(), email.toLowerCase(), tokenHash],
  )
  return `/invitacion/${token}`
}

/** Opens an invite link for `email` and sets the password. Leaves the page on V0 (new account) or Inicio. */
export async function acceptInvite(page: Page, email: string, password = E2E_PASSWORD): Promise<void> {
  await page.goto(await mintInvite(page.request, email))
  await expect(page.getByText(email)).toBeVisible()
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Repite la contraseña').fill(password)
  await page.getByRole('button', { name: /^(Crear cuenta|Guardar contraseña) y entrar$/ }).click()
}

/** VA: email + password → signed in. Leaves the page on V0 or Inicio. */
export async function signIn(page: Page, email: string, password = E2E_PASSWORD): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

/** V0's three steps with the defaults, ending on an empty Inicio. */
export async function completeOnboarding(page: Page, name = 'E2E'): Promise<void> {
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await page.getByLabel('Nombre', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Paso 3 de 3')).toBeVisible()
  await page.getByRole('button', { name: 'Empezar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
}

/** New account (invite link + password) straight to an empty Inicio. */
export async function signUp(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag)
  await acceptInvite(page, email)
  await completeOnboarding(page)
  return email
}

export const EXERCISE = 'Press de banca con barra'

/** V3: a routine with one weight exercise and `sets` sets of 8–12 at `weightKg`. */
export async function createRoutine(
  page: Page,
  { name, sets = 2, weightKg = 60 }: { name: string; sets?: number; weightKg?: number },
): Promise<void> {
  await page.getByRole('link', { name: 'Nueva rutina' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill(name)
  await page.getByRole('button', { name: '+ Añadir ejercicios' }).click()
  const picker = page.getByRole('dialog', { name: 'Seleccionar ejercicios' })
  await picker.getByLabel('Buscar ejercicio').fill(EXERCISE)
  await picker.getByRole('checkbox', { name: EXERCISE, exact: true }).check({ force: true })
  await picker.getByRole('button', { name: 'Añadir (1)' }).click()

  const card = page.getByRole('region', { name: EXERCISE })
  // A new exercise starts with three sets: add or remove to reach `sets`.
  const removeButtons = card.getByRole('button', { name: /^Quitar serie \d+$/ })
  await expect(removeButtons).toHaveCount(3)
  for (let n = 3; n < sets; n++) await card.getByRole('button', { name: '+ Serie' }).click()
  for (let n = 3; n > sets; n--)
    await card.getByRole('button', { name: `Quitar serie ${n}` }).click()
  await expect(removeButtons).toHaveCount(sets)
  for (let n = 1; n <= sets; n++) {
    await card.getByLabel(`Reps mín., serie ${n}`).fill('8')
    await card.getByLabel(`Reps máx., serie ${n}`).fill('12')
    await card.getByLabel(`Peso objetivo (kg), serie ${n}`).fill(String(weightKg))
  }
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('article', { name })).toBeVisible()
}

/** The global sync indicator in the page header (R6). */
export function syncIndicator(page: Page, state: 'sincronizado' | 'pendiente' | 'sin conexión') {
  return page.getByRole('link', { name: new RegExp(`^Sincronización: ${state}`) }).first()
}

export interface ServerRow {
  table: string
  row: Record<string, unknown> & { id: string }
}

/** Every row the server holds for the signed-in account (uses the page's session cookie). */
export async function serverRows(page: Page): Promise<ServerRow[]> {
  const res = await page.request.get('/api/sync/pull?cursor=0&limit=500')
  expect(res.ok(), `pull returned ${res.status()}`).toBe(true)
  return ((await res.json()) as { rows: ServerRow[] }).rows
}

/** Waits until the service worker controls the page, so the shell is precached for offline use. */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload()
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  }
}

/** ▶ Iniciar on the routine's card in Inicio (not "Toca hoy", which may offer the same routine). */
export async function startRoutine(page: Page, name: string): Promise<void> {
  await page
    .getByRole('article', { name })
    .getByRole('button', { name: `Iniciar ${name}` })
    .click()
  await expect(activeWorkout(page)).toBeVisible()
}

/** V5: the active workout dialog. */
export function activeWorkout(page: Page) {
  return page.getByRole('dialog', { name: 'Entreno activo' })
}

/**
 * ✓ on a set row of V5. Rest is per exercise and the e2e routines set none ("Sin descanso"), so
 * no rest sheet (V6) opens and V5 stays visible.
 */
export async function completeRow(page: Page, row: string): Promise<void> {
  const check = page.getByRole('button', { name: `Completar fila ${row}` })
  await check.click()
  await expect(activeWorkout(page)).toBeVisible()
  await expect(check).toHaveAttribute('aria-pressed', 'true')
}

/** V5 Finalizar → V7 Guardar → celebration → Continuar, back on Inicio. */
export async function finishWorkout(page: Page, beforeSave?: () => Promise<void>): Promise<void> {
  await activeWorkout(page).getByRole('button', { name: 'Finalizar' }).click()
  const finish = page.getByRole('dialog', { name: 'Finalizar entreno' })
  await expect(finish).toBeVisible()
  await beforeSave?.()
  await finish.getByRole('button', { name: 'Guardar' }).click()
  const saved = page.getByRole('dialog', { name: 'Entreno guardado' })
  await expect(saved).toBeVisible()
  await saved.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
}
