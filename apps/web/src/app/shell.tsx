import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { syncEngine, type SyncEngine } from '../data/sync/engine'
import { startSyncTriggers } from '../data/sync/triggers'
import { authApi, type AuthApi } from '../features/auth/auth-client'
import { invitesApi, type InvitesApi } from '../features/profile/invites-api'
import { signOut } from '../features/profile/sign-out'

/** Services the app shell uses; injectable so the shell is tested without a network. */
export interface ShellDeps {
  engine: SyncEngine
  authApi: AuthApi
  /** Admin invites (Perfil · Invitar). */
  invitesApi: InvitesApi
  /** Starts the sync triggers once the user is known; returns a stop function. */
  startSync: (engine: SyncEngine) => () => void
  /**
   * Sign-out request from the "another account" block after re-auth.
   */
  onSignOutRequested: () => void
}

const defaultDeps: ShellDeps = {
  engine: syncEngine,
  authApi,
  invitesApi,
  startSync: (engine) => startSyncTriggers(engine),
  onSignOutRequested: () => void signOut(),
}

const ShellContext = createContext<ShellDeps>(defaultDeps)

export function ShellProvider({ deps, children }: { deps: Partial<ShellDeps>; children: ReactNode }) {
  const value = useMemo(() => ({ ...defaultDeps, ...deps }), [deps])
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell(): ShellDeps {
  return useContext(ShellContext)
}
