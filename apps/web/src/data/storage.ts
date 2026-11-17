/** Asks the browser to keep IndexedDB data under storage pressure. Resolves false when unsupported. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  return navigator.storage.persist()
}
