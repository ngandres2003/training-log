import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { fileURLToPath } from 'node:url'
import type { Db } from './client.js'
import * as schema from './schema.js'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

export interface TestDb {
  db: Db
  close: () => Promise<void>
}

/** A fresh in-memory Postgres (PGlite) with the generated migrations applied. */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite()
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder })
  return { db: db as unknown as Db, close: () => client.close() }
}
