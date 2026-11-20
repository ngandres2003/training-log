import { formatWeight, type Id } from '@training-log/domain'
import { Share2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../ui/Button'
import { formatLongDay } from '../history/format'
import { dayOf } from '../routines/format'
import { closeCelebration } from '../workout/ui-store'
import { minutesText } from './format'
import { summarize } from './session-data'
import { renderShareImage, shareImage } from './share-image'
import { useSession } from './use-session'

/** Brief celebration after V7's Guardar (spec V7, Hevy style), shareable as an image; then V1. */
export function Celebration({ workoutId }: { workoutId: Id }) {
  const { data, model, lookup } = useSession(workoutId)
  const navigate = useNavigate()
  const [status, setStatus] = useState('')

  const done = () => {
    closeCelebration()
    void navigate('/')
  }

  if (!data || !model) return <div aria-hidden="true" className="fixed inset-0 z-40 bg-hierro" />

  const unit = model.settings.unit
  const summary = summarize(data, model, lookup)
  const date = formatLongDay(dayOf(data.workout.startedAt))
  const stats: [string, string][] = [
    ['Duración', summary.durationMs != null ? minutesText(summary.durationMs) : '—'],
    ['Volumen', formatWeight(summary.volume, unit)],
    ['Series', String(summary.sets)],
    ['Reps', String(summary.reps)],
  ]

  const share = async () => {
    const blob = await renderShareImage({ title: data.workout.name, date, stats, prs: summary.prs })
    if (!blob) {
      setStatus('No se pudo crear la imagen.')
      return
    }
    const result = await shareImage(blob, 'entreno.png', data.workout.name)
    if (result === 'downloaded') setStatus('Imagen descargada.')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Entreno guardado"
      className="fixed inset-0 z-40 flex justify-center bg-hierro text-arena"
    >
      <div className="flex h-full w-full max-w-[480px] flex-col justify-center gap-6 px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-2 text-center">
          <Trophy aria-hidden="true" className="size-14 text-sol motion-safe:animate-bounce" />
          <p className="font-display text-4xl text-sol uppercase">¡Entreno guardado!</p>
          <h1 className="font-display text-2xl uppercase">{data.workout.name}</h1>
          <p className="text-polvo">{date}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col rounded-xl border border-concreto bg-asfalto px-3 py-2">
              <dt className="text-sm text-polvo">{label}</dt>
              <dd className="font-display text-2xl">{value}</dd>
            </div>
          ))}
        </dl>
        {summary.prs > 0 && (
          <p className="text-center font-display text-2xl text-atardecer uppercase">
            {summary.prs === 1 ? '1 PR nuevo' : `${summary.prs} PRs nuevos`}
          </p>
        )}
        <p role="status" className="text-center text-sm text-polvo">
          {status}
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => void share()}>
            <Share2 aria-hidden="true" className="size-5" />
            Compartir
          </Button>
          <Button className="uppercase" onClick={done}>
            Continuar
          </Button>
        </div>
      </div>
    </div>
  )
}
