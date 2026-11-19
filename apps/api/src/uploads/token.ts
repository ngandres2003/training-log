import { randomBytes } from 'node:crypto'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'

/** Largest photo a client token accepts (KTD12). */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024

/** How long a client token stays valid. */
export const TOKEN_TTL_MS = 5 * 60_000

/** Content types a custom exercise photo may have, with the extension used in its path. */
export const PHOTO_EXTENSIONS = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
} as const

export type PhotoContentType = keyof typeof PHOTO_EXTENSIONS

export function isPhotoContentType(value: unknown): value is PhotoContentType {
  return typeof value === 'string' && Object.hasOwn(PHOTO_EXTENSIONS, value)
}

/**
 * An unguessable path under the user's prefix (R16: the store is public, so the
 * 128-bit random name is what keeps the photo private to whoever holds the URL).
 */
export function photoPathname(userId: string, contentType: PhotoContentType): string {
  const random = randomBytes(16).toString('base64url')
  return `custom-exercises/${userId}/${random}.${PHOTO_EXTENSIONS[contentType]}`
}

export interface PhotoUploadToken {
  token: string
  pathname: string
}

/**
 * Signs a client-upload token for exactly one server-chosen path, one image type,
 * at most 2 MB and a short validity (KTD12).
 */
export async function issuePhotoUploadToken(opts: {
  userId: string
  contentType: PhotoContentType
  readWriteToken: string
  now?: number
}): Promise<PhotoUploadToken> {
  const pathname = photoPathname(opts.userId, opts.contentType)
  const token = await generateClientTokenFromReadWriteToken({
    token: opts.readWriteToken,
    pathname,
    allowedContentTypes: [opts.contentType],
    maximumSizeInBytes: MAX_PHOTO_BYTES,
    addRandomSuffix: false,
    allowOverwrite: false,
    validUntil: (opts.now ?? Date.now()) + TOKEN_TTL_MS,
  })
  return { token, pathname }
}
