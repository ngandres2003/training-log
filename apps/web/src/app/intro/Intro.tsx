import { useEffect, useState, type CSSProperties } from 'react'
import './intro.css'

/** Total length of the intro (ms); keep in step with the timeline in intro.css. */
export const INTRO_MS = 1850
const REDUCED_MS = 750

/** Impact point, a little above the centre where the dumbbell lands (percent of the screen). */
const CX = 50
const CY = 46

/** Points around the screen edge (percent), clockwise from the top-left. Shards are fan slices. */
const EDGE: [number, number][] = [
  [0, 0],
  [22, 0],
  [47, 0],
  [71, 0],
  [100, 0],
  [100, 24],
  [100, 53],
  [100, 78],
  [100, 100],
  [76, 100],
  [52, 100],
  [27, 100],
  [0, 100],
  [0, 74],
  [0, 47],
  [0, 21],
]

const SHARDS = EDGE.map((p, i) => {
  const q = EDGE[(i + 1) % EDGE.length]!
  // Fly outward along the slice's middle direction, with a bit of spin.
  const mx = (p[0] + q[0]) / 2 - CX
  const my = (p[1] + q[1]) / 2 - CY
  const len = Math.hypot(mx, my) || 1
  return {
    clip: `polygon(${CX}% ${CY}%, ${p[0]}% ${p[1]}%, ${q[0]}% ${q[1]}%)`,
    dx: `${((mx / len) * 70).toFixed(1)}vw`,
    dy: `${((my / len) * 70).toFixed(1)}vh`,
    rot: `${(i % 2 ? 1 : -1) * (14 + ((i * 7) % 19))}deg`,
  }
})

/** Crack lines from the impact point, drawn in a 100×100 box stretched to the screen. */
const CRACKS = [
  'M50 46 L41 38 L33 35 L22 24 L9 19',
  'M50 46 L58 37 L63 26 L74 18 L88 6',
  'M50 46 L62 48 L74 44 L86 51 L100 49',
  'M50 46 L56 58 L54 69 L63 82 L66 100',
  'M50 46 L43 57 L33 61 L24 74 L11 84',
  'M50 46 L38 47 L27 51 L14 46 L0 52',
  'M41 38 L39 27 L44 14',
  'M62 48 L67 59 L79 64',
  'M43 57 L46 71 L40 83',
]

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function Dumbbell() {
  return (
    <svg viewBox="0 0 240 100" className="intro-dumbbell" aria-hidden="true">
      <rect x="62" y="44" width="116" height="12" rx="4" fill="var(--borde-activo)" />
      <rect x="14" y="30" width="14" height="40" rx="5" fill="var(--sol)" />
      <rect x="30" y="16" width="22" height="68" rx="6" fill="var(--sol)" />
      <rect x="52" y="36" width="10" height="28" rx="3" fill="var(--sol)" />
      <rect x="178" y="36" width="10" height="28" rx="3" fill="var(--sol)" />
      <rect x="188" y="16" width="22" height="68" rx="6" fill="var(--sol)" />
      <rect x="212" y="30" width="14" height="40" rx="5" fill="var(--sol)" />
      <rect x="34" y="22" width="5" height="56" rx="2.5" fill="var(--tinta)" opacity="0.18" />
      <rect x="192" y="22" width="5" height="56" rx="2.5" fill="var(--tinta)" opacity="0.18" />
    </svg>
  )
}

/**
 * Opening intro over the app while it loads underneath: the dumbbell slams the screen, it cracks
 * and shatters. Once per page load; a tap skips it. Decorative, so hidden from screen readers.
 */
export function Intro({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), prefersReducedMotion() ? REDUCED_MS : INTRO_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) onDone?.()
  }, [visible, onDone])

  if (!visible) return null

  return (
    <div className="intro" aria-hidden="true" data-testid="intro" onClick={() => setVisible(false)}>
      <div className="intro-shake">
        {SHARDS.map((s, i) => (
          <div
            key={i}
            className="intro-shard"
            style={{ clipPath: s.clip, '--dx': s.dx, '--dy': s.dy, '--rot': s.rot } as CSSProperties}
          />
        ))}
        <div className="intro-flash" />
        <svg className="intro-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
          {CRACKS.map((d) => (
            <path key={d} d={d} pathLength={1} />
          ))}
        </svg>
        <div className="intro-stage">
          <Dumbbell />
          <p className="intro-word">
            Training <span>Log</span>
          </p>
        </div>
      </div>
    </div>
  )
}
