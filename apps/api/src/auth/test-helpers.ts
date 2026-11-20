import { eq } from 'drizzle-orm'
import type { Express } from 'express'
import request from 'supertest'
import type { Db } from '../db/client.js'
import { user } from '../db/schema.js'
import { createInvite } from '../invites/invites.js'

/** Test-only helpers: sign a test account in through the real invite and password routes. */

export const TEST_BASE_URL = 'http://localhost:3000'
export const TEST_SECRET = 'test-secret-0123456789-abcdefghijklmnop'
export const TEST_PASSWORD = 'contraseña-de-prueba'

let ipSeq = 0
/** A fresh documentation-range IP, so tests never share a rate-limit bucket by accident. */
export function testIp(): string {
  ipSeq += 1
  return `198.18.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`
}

export function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined
  return (raw ?? []).map((c) => c.split(';')[0]).join('; ')
}

export interface SignedIn {
  id: string
  cookie: string
}

/**
 * Signs `email` in on `app` (which must mount `createApp`): the first time by redeeming an invite
 * minted directly in `db`, afterwards with the password, so each call is a new device session.
 */
export async function signInForTest(
  app: Express,
  db: Db,
  email: string,
  password = TEST_PASSWORD,
): Promise<SignedIn> {
  const normalized = email.toLowerCase()
  const exists = (await db.select().from(user).where(eq(user.email, normalized))).length > 0
  let res: request.Response
  if (exists) {
    res = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', TEST_BASE_URL)
      .set('X-Forwarded-For', testIp())
      .send({ email: normalized, password })
  } else {
    const { token } = await createInvite(db, { email: normalized })
    res = await request(app)
      .post('/api/invites/redeem')
      .set('Origin', TEST_BASE_URL)
      .set('X-Forwarded-For', testIp())
      .send({ token, password })
  }
  if (res.status !== 200) throw new Error(`sign-in for ${email} failed: ${res.status} ${JSON.stringify(res.body)}`)
  const cookie = cookieHeader(res)
  const me = await request(app).get('/api/me').set('Cookie', cookie)
  if (me.status !== 200) throw new Error(`/api/me after sign-in returned ${me.status}`)
  return { id: (me.body as { user: { id: string } }).user.id, cookie }
}
