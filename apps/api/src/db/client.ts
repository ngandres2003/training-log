import { Pool, neonConfig } from '@neondatabase/serverless'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema.js'

export { schema }

/** Any Drizzle Postgres database over this schema (Neon in production, PGlite in tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** A transaction handle from `db.transaction(...)`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

// Node has no global WebSocket in every runtime; the Pool needs one for interactive transactions (KTD2).
neonConfig.webSocketConstructor = ws

/** Drizzle on the Neon serverless Pool (WebSocket), reading `DATABASE_URL`. */
export function createDb(connectionString = process.env.DATABASE_URL): { db: Db; pool: Pool } {
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  const pool = new Pool({ connectionString })
  return { db: drizzle({ client: pool, schema }), pool }
}
