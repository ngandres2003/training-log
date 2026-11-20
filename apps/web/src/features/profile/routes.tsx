import type { RouteObject } from 'react-router'
import { Profile } from './Profile'

/** Routes under the Perfil tab (`/perfil`). */
export const profileRoutes: RouteObject[] = [{ index: true, element: <Profile /> }]
