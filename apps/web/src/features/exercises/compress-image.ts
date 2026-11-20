/**
 * Decodes and re-encodes images. The browser default draws on a canvas; tests inject a fake
 * because jsdom has no canvas.
 */
export interface ImageCodec<T> {
  decode(file: Blob): Promise<{ image: T; width: number; height: number }>
  /** Draws `image` at `width`×`height` and encodes it; the browser may return another type than asked. */
  encode(image: T, width: number, height: number, type: string, quality: number): Promise<Blob>
}

export interface CompressOptions<T> {
  /** Longest side of the result in pixels. */
  maxSize?: number
  quality?: number
  codec?: ImageCodec<T>
}

/**
 * Compresses a photo for upload (KTD12): longer side at most `maxSize`, WebP, or JPEG when the
 * browser cannot encode WebP (Safari returns PNG for an unsupported type).
 */
export async function compressImage<T = ImageBitmap>(file: Blob, options: CompressOptions<T> = {}): Promise<Blob> {
  const { maxSize = 1080, quality = 0.8 } = options
  const codec = options.codec ?? (canvasCodec as unknown as ImageCodec<T>)

  const { image, width, height } = await codec.decode(file)
  const scale = Math.min(1, maxSize / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const webp = await codec.encode(image, w, h, 'image/webp', quality)
  if (webp.type === 'image/webp') return webp
  return codec.encode(image, w, h, 'image/jpeg', quality)
}

/** The browser codec: `createImageBitmap` plus an OffscreenCanvas, or a `<canvas>` where that is missing. */
export const canvasCodec: ImageCodec<ImageBitmap> = {
  async decode(file) {
    const image = await createImageBitmap(file)
    return { image, width: image.width, height: image.height }
  },

  async encode(image, width, height, type, quality) {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2D canvas is not available')
      ctx.drawImage(image, 0, 0, width, height)
      return canvas.convertToBlob({ type, quality })
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas is not available')
    ctx.drawImage(image, 0, 0, width, height)
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed'))), type, quality)
    })
  },
}
