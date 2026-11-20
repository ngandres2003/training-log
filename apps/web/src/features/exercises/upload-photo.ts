import { put as blobPut } from '@vercel/blob/client'

/**
 * Uploads a compressed exercise photo (KTD12): the API issues a client token for one
 * server-chosen, unguessable path; the browser then uploads straight to Vercel Blob.
 */
export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
export type BlobPut = (
  pathname: string,
  body: Blob,
  options: { access: 'public'; token: string; contentType: string },
) => Promise<{ url: string }>

/** Returns the public URL of the uploaded photo. Throws on any failure. */
export async function uploadPhoto(
  blob: Blob,
  fetchImpl: Fetch = (i, init) => globalThis.fetch(i, init),
  put: BlobPut = blobPut,
): Promise<string> {
  const tokenRes = await fetchImpl('/api/uploads/token', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentType: blob.type, size: blob.size }),
  })
  if (!tokenRes.ok) throw new Error(`upload token ${tokenRes.status}`)
  const { token, pathname } = (await tokenRes.json()) as { token: string; pathname: string }

  const { url } = await put(pathname, blob, { access: 'public', token, contentType: blob.type })
  return url
}
