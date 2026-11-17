import { v7 } from 'uuid'
import type { Id } from '@training-log/domain'

/** Client-generated UUIDv7 for every synced row (KTD6). */
export function newId(): Id {
  return v7()
}

export function nowIso(): string {
  return new Date().toISOString()
}
