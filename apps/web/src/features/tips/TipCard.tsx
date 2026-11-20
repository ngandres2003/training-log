import { Lightbulb, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { randomTipIndex, TIPS, type Tip } from './tips'

/** "Consejo" card: a random tip on each visit, and a button to see another one. */
export function TipCard({ tips = TIPS }: { tips?: readonly Tip[] }) {
  const [index, setIndex] = useState(() => randomTipIndex(tips.length))
  const tip = tips[index]
  if (!tip) return null

  return (
    <section aria-labelledby="consejo" className="neon-soft flex gap-3 rounded-xl bg-asfalto p-4">
      <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-acento" />
      <div className="min-w-0 flex-1">
        <h2 id="consejo" className="text-xs font-bold tracking-wide text-polvo uppercase">
          Consejo
        </h2>
        <p aria-live="polite" className="mt-1">
          {tip.text}
        </p>
      </div>
      {tips.length > 1 && (
        <button
          type="button"
          onClick={() => setIndex((i) => randomTipIndex(tips.length, i))}
          aria-label="Otro consejo"
          className="-m-2 flex size-12 shrink-0 items-center justify-center self-start rounded-full text-polvo"
        >
          <RefreshCw aria-hidden="true" className="size-5" />
        </button>
      )}
    </section>
  )
}
