import { db } from '../../data/db'
import { authClient } from '../auth/auth-client'

export interface SignOutDeps {
  /** Ends the server session (Better Auth). */
  endSession: () => Promise<unknown>
  /** Leaves the app; the reload opens VA because the device no longer has a user. */
  reloadTo: (path: string) => void
}

const defaults: SignOutDeps = {
  endSession: () => authClient.signOut(),
  reloadTo: (path) => window.location.assign(path),
}

/**
 * Signs out (R8, U15 step 2): ends the server session when it can, deletes the whole local
 * database (rows, outbox, last known user) and reloads to `/`. Callers warn about pending
 * changes first. Offline, the server session cannot be ended; the device forgets it anyway.
 */
export async function signOut(deps: Partial<SignOutDeps> = {}): Promise<void> {
  const { endSession, reloadTo } = { ...defaults, ...deps }
  try {
    await endSession()
  } catch {
    // Offline or server error: local sign-out still happens.
  }
  await db.delete()
  reloadTo('/')
}
