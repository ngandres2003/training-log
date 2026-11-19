import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { syncEngine, type SyncEngine } from '../data/sync/engine'
import { startSyncTriggers } from '../data/sync/triggers'
import { authApi, type AuthApi } from '../features/auth/auth-client'

/** Services the app shell uses; injectable so the shell is tested without a network. */
export interface ShellDeps {
  engine: SyncEngine
  authApi: AuthApi
  /** Starts the sync triggers once the user is known; returns a stop function. */
  startSync: (engine: SyncEngine) => () => void
  /**
   * Sign-out request from the "another account" block after re-auth.
   * TODO(U15): placeholder. U15 owns the sign-out flow and replaces this default.
   */
  onSignOutRequested: () => void
}

const defaultDeps: ShellDeps = {
  engine: syncEngine,
  authApi,
  startSync: (engine) => startSyncTriggers(engine),
  onSignOutRequested: () => {
    // TODO(U15): placeholder until the sign-out flow exists.
    console.warn('Sign-out requested, but sign-out is not implemented yet (U15).')
  },
}

const ShellContext = createContext<ShellDeps>(defaultDeps)

export function ShellProvider({ deps, children }: { deps: Partial<ShellDeps>; children: ReactNode }) {
  const value = useMemo(() => ({ ...defaultDeps, ...deps }), [deps])
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShell(): ShellDeps {
  return useContext(ShellContext)
}
