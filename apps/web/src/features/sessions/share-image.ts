/** What the shareable celebration image shows. */
export interface ShareCard {
  title: string
  date: string
  /** Up to four "label: value" stats, e.g. ["Volumen", "1960 kg"]. */
  stats: [string, string][]
  prs: number
}

const SIZE = 1080
// Dark theme colors (ui/theme.css), fixed so the shared image looks the same in either theme: Hierro background, Sol accent, Arena text, Polvo secondary.
const HIERRO = '#0e0e0c'
const SOL = '#f6c026'
const ARENA = '#efe6d2'
const POLVO = '#a39e8f'

/** Renders the card to a 1080 × 1080 PNG on a canvas; null where canvas is unavailable. */
export async function renderShareImage(card: ShareCard): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = HIERRO
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = SOL
  ctx.fillRect(0, 0, SIZE, 16)

  ctx.textBaseline = 'top'
  ctx.fillStyle = POLVO
  ctx.font = '40px Archivo, sans-serif'
  ctx.fillText(card.date, 80, 96)
  ctx.fillStyle = ARENA
  ctx.font = '96px Anton, Impact, sans-serif'
  ctx.fillText(card.title.toUpperCase(), 80, 156, SIZE - 160)

  card.stats.slice(0, 4).forEach(([label, value], i) => {
    const x = 80 + (i % 2) * 460
    const y = 400 + Math.floor(i / 2) * 220
    ctx.fillStyle = POLVO
    ctx.font = '40px Archivo, sans-serif'
    ctx.fillText(label, x, y)
    ctx.fillStyle = ARENA
    ctx.font = '88px Anton, Impact, sans-serif'
    ctx.fillText(value, x, y + 56, 420)
  })

  if (card.prs > 0) {
    ctx.fillStyle = SOL
    ctx.font = '72px Anton, Impact, sans-serif'
    ctx.fillText(card.prs === 1 ? '1 PR NUEVO' : `${card.prs} PRS NUEVOS`, 80, 880)
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

/**
 * Shares the image through the Web Share API when the device can share files, and otherwise
 * downloads it. Resolves with what happened; a dismissed share sheet is "cancelled".
 */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Any other failure falls through to the download.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'downloaded'
}
