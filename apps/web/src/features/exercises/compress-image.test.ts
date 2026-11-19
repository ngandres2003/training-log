import { describe, expect, it } from 'vitest'
import { compressImage, type ImageCodec } from './compress-image'

/**
 * A fake codec: the "decoded image" is just its size, and encoding writes
 * `<type> <width>x<height>` into a blob of the type the fake browser supports.
 */
function fakeCodec(width: number, height: number, supportsWebp = true): ImageCodec<null> {
  return {
    decode: async () => ({ image: null, width, height }),
    encode: async (_image, w, h, type) => {
      const actual = type === 'image/webp' && !supportsWebp ? 'image/png' : type
      return new Blob([`${actual} ${w}x${h}`], { type: actual })
    },
  }
}

const jpeg = new Blob(['not really a jpeg'], { type: 'image/jpeg' })

describe('compressImage', () => {
  it('turns a 4000x3000 JPEG into a 1080x810 WebP', async () => {
    const out = await compressImage(jpeg, { codec: fakeCodec(4000, 3000) })
    expect(out.type).toBe('image/webp')
    expect(await out.text()).toBe('image/webp 1080x810')
  })

  it('limits the longer side of a portrait photo', async () => {
    const out = await compressImage(jpeg, { codec: fakeCodec(3000, 4000) })
    expect(await out.text()).toBe('image/webp 810x1080')
  })

  it('does not enlarge a photo already within the limit', async () => {
    const out = await compressImage(jpeg, { codec: fakeCodec(800, 600) })
    expect(await out.text()).toBe('image/webp 800x600')
  })

  it('re-encodes as JPEG when the browser returns PNG for WebP', async () => {
    const out = await compressImage(jpeg, { codec: fakeCodec(4000, 3000, false) })
    expect(out.type).toBe('image/jpeg')
    expect(await out.text()).toBe('image/jpeg 1080x810')
  })
})
