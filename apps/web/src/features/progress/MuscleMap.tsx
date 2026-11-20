import { MUSCLES, type BodyRegion, type MuscleId } from '@training-log/domain'
import { decimal1 } from '../routines/format'

type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'poly'; points: string }

const r = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h })
const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
})

/** Mirrored pair: a shape on the left and its reflection on the right of a 120-wide figure. */
const pair = (x: number, y: number, w: number, h: number) => [
  r(x, y, w, h),
  r(120 - x - w, y, w, h),
]

/** Stylized front and back figures keyed by the fixed muscle list (R17). */
const SHAPES: Record<BodyRegion, Partial<Record<MuscleId, Shape[]>>> = {
  front: {
    neck: [r(54, 29, 12, 8)],
    shoulders: [e(37, 45, 9, 7), e(83, 45, 9, 7)],
    chest: pair(44, 40, 15, 16),
    biceps: pair(27, 54, 9, 19),
    forearms: pair(23, 76, 9, 23),
    abdominals: [r(48, 58, 24, 34)],
    abductors: pair(37, 94, 7, 22),
    quadriceps: pair(44, 98, 12, 42),
    adductors: [r(56, 100, 8, 26)],
  },
  back: {
    traps: [{ kind: 'poly', points: '48,31 72,31 82,44 38,44' }],
    shoulders: [e(37, 45, 9, 7), e(83, 45, 9, 7)],
    triceps: pair(27, 54, 9, 19),
    lats: pair(40, 48, 14, 26),
    middle_back: [r(55, 46, 10, 24)],
    lower_back: [r(50, 74, 20, 15)],
    glutes: pair(44, 92, 15, 18),
    hamstrings: pair(44, 113, 13, 31),
    calves: pair(45, 149, 11, 28),
  },
}

/** Silhouette parts that are not muscles of the list. */
const NEUTRAL: Record<BodyRegion, Shape[]> = {
  front: [e(60, 17, 11, 12), ...pair(45, 146, 10, 40), ...pair(23, 101, 9, 9)],
  back: [e(60, 17, 11, 12), ...pair(27, 76, 9, 23), ...pair(46, 180, 9, 8)],
}

function ShapeEl({ shape, fill, opacity }: { shape: Shape; fill: string; opacity: number }) {
  const common = { fill, fillOpacity: opacity, stroke: 'var(--hierro)', strokeWidth: 1 }
  if (shape.kind === 'rect')
    return <rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={4} {...common} />
  if (shape.kind === 'ellipse')
    return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />
  return <polygon points={shape.points} {...common} />
}

/** Intensity steps by weekly sets: none, 1–4, 5–9, 10+ (the bottom of the recommended band). */
function intensity(sets: number): number {
  if (sets <= 0) return 0
  if (sets < 5) return 0.35
  if (sets < 10) return 0.65
  return 1
}

const LEGEND = [
  { label: '0', opacity: 0 },
  { label: '1–4', opacity: 0.35 },
  { label: '5–9', opacity: 0.65 },
  { label: '10+', opacity: 1 },
]

const label = (id: MuscleId) => MUSCLES.find((m) => m.id === id)?.label ?? id

/** V10 body map (front and back) colored by this week's sets per muscle. */
export function MuscleMap({ sets }: { sets: Map<MuscleId, number> }) {
  const worked = MUSCLES.filter((m) => (sets.get(m.id) ?? 0) > 0)
  const summary = worked.length
    ? `Esta semana: ${worked.map((m) => `${m.label} ${decimal1(sets.get(m.id)!)} series`).join(', ')}.`
    : 'Esta semana aún no has trabajado ningún músculo.'

  return (
    <figure
      aria-label="Mapa muscular de esta semana"
      className="rounded-xl border border-concreto bg-asfalto p-3"
    >
      <figcaption className="mb-2 text-sm text-polvo">
        Mapa muscular · series de esta semana
      </figcaption>
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true" className="grid grid-cols-2 gap-2">
        {(['front', 'back'] as const).map((region) => (
          <div key={region} className="flex flex-col items-center">
            <svg viewBox="0 0 120 192" className="h-56 w-full">
              {NEUTRAL[region].map((s, i) => (
                <ShapeEl key={`n${i}`} shape={s} fill="var(--concreto)" opacity={0.6} />
              ))}
              {Object.entries(SHAPES[region]).map(([id, shapes]) => {
                const n = sets.get(id) ?? 0
                const level = intensity(n)
                return (
                  <g key={id} data-muscle={id}>
                    <title>{`${label(id)}: ${decimal1(n)} series`}</title>
                    {shapes!.map((s, i) => (
                      <ShapeEl
                        key={i}
                        shape={s}
                        fill={level ? 'var(--oceano)' : 'var(--concreto)'}
                        opacity={level || 1}
                      />
                    ))}
                  </g>
                )
              })}
            </svg>
            <span className="text-xs text-polvo">{region === 'front' ? 'Frontal' : 'Dorsal'}</span>
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-2 flex items-center justify-center gap-3 text-xs text-polvo"
      >
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span
              className="inline-block size-3 rounded-sm"
              style={{
                background: l.opacity ? 'var(--oceano)' : 'var(--concreto)',
                opacity: l.opacity || 1,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </figure>
  )
}
