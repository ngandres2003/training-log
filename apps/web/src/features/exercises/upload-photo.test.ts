import { describe, expect, it, vi } from 'vitest'
import { uploadPhoto, type BlobPut } from './upload-photo'

describe('uploadPhoto', () => {
  it('asks the API for a token, then uploads the blob to the server-chosen path with it', async () => {
    const token = 'vercel_blob_client_store123_payload'
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ token, pathname: 'custom-exercises/u1/abc.webp' }), { status: 200 }),
    )
    const put = vi.fn<BlobPut>(async (pathname) => ({
      url: `https://store123.public.blob.vercel-storage.com/${pathname}`,
    }))
    const blob = new Blob(['img'], { type: 'image/webp' })

    const url = await uploadPhoto(blob, fetchImpl, put)

    expect(url).toBe('https://store123.public.blob.vercel-storage.com/custom-exercises/u1/abc.webp')
    const tokenCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(tokenCall[0]).toBe('/api/uploads/token')
    expect(tokenCall[1]).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(tokenCall[1].body))).toEqual({ contentType: 'image/webp', size: 3 })
    expect(put).toHaveBeenCalledWith('custom-exercises/u1/abc.webp', blob, {
      access: 'public',
      token,
      contentType: 'image/webp',
    })
  })

  it('fails without uploading when the API refuses the token', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 401 }))
    const put = vi.fn<BlobPut>()
    await expect(uploadPhoto(new Blob(['x'], { type: 'image/jpeg' }), fetchImpl, put)).rejects.toThrow()
    expect(put).not.toHaveBeenCalled()
  })
})
