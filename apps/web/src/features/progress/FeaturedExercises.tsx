import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Line, LineChart, YAxis } from 'recharts'

export interface FeaturedItem {
  exerciseId: string
  name: string
  sets: number
  /** Per-session values for the mini curve (e1RM, or reps / duration for other types), oldest first. */
  curve: number[]
}

/** Mini trend curve; hidden with fewer than two sessions. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="w-24" />
  const data = values.map((v, i) => ({ i, v }))
  return (
    <span aria-hidden="true" data-testid="sparkline" className="w-24">
      <LineChart
        width={96}
        height={32}
        data={data}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
      >
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line
          type="monotone"
          dataKey="v"
          stroke="var(--oceano)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </span>
  )
}

/** V10 "Ejercicios destacados": top 5 by sets in the period, each opening V11. */
export function FeaturedExercises({ items }: { items: FeaturedItem[] }) {
  return (
    <section aria-labelledby="featured-exercises" className="flex flex-col gap-2">
      <h2 id="featured-exercises" className="font-display text-xl uppercase">
        Ejercicios destacados
      </h2>
      {items.length === 0 ? (
        <p className="text-polvo">Sin ejercicios en este periodo.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.exerciseId}>
              <Link
                to={`/progreso/ejercicios/${item.exerciseId}`}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-concreto bg-asfalto px-4 py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{item.name}</span>
                  <span className="text-sm text-polvo">{item.sets} series</span>
                </span>
                <Sparkline values={item.curve} />
                <ChevronRight aria-hidden="true" className="size-5 text-polvo" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
