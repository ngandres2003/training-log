import { useId, useRef, useState } from 'react'
import { useSyncSnapshot } from '../../app/SyncIndicator'
import { listCustomExercises } from '../../data/repositories/exercises'
import { Button } from '../../ui/Button'
import { loadCatalog } from '../exercises/catalog'
import { seedDemoData } from './demo-seed'
import { buildCsvExport, buildJsonExport, downloadFile } from './export'
import { importExport, InvalidExportError, parseExport } from './import'
import { Section } from './Section'

const CONFIRM_WORD = 'BORRAR'

const today = () => new Date().toISOString().slice(0, 10)

/** "Cargar datos de ejemplo" exists in dev builds, or in a build made with VITE_DEMO_SEED=true (a preview). */
const DEMO_SEED_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEMO_SEED === 'true'

/** V12 Datos: JSON export/import, CSV export and "Borrar todos mis datos" (R8, U15 steps 3–4). */
export function DataTools({ onDeleteAll }: { onDeleteAll: () => Promise<void> }) {
  const snap = useSyncSnapshot()
  const offline = snap.status === 'offline'
  const fileRef = useRef<HTMLInputElement>(null)
  const confirmId = useId()
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')

  async function run(fn: () => Promise<string | null>, failure: string) {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await fn())
    } catch (err) {
      setMessage(
        err instanceof InvalidExportError
          ? 'Este archivo no es una exportación de la app.'
          : failure,
      )
    } finally {
      setBusy(false)
    }
  }

  const exportJson = () =>
    run(async () => {
      const file = await buildJsonExport()
      downloadFile(`entrenos-${today()}.json`, JSON.stringify(file), 'application/json')
      return null
    }, 'No se pudo exportar.')

  const exportCsv = () =>
    run(async () => {
      const [catalog, custom] = await Promise.all([
        loadCatalog().catch(() => []),
        listCustomExercises(),
      ])
      const names = new Map([...catalog, ...custom].map((e) => [e.id, e.name]))
      const csv = await buildCsvExport({ exerciseName: (id) => names.get(id) })
      downloadFile(`series-${today()}.csv`, csv, 'text/csv;charset=utf-8')
      return null
    }, 'No se pudo exportar.')

  const importFile = (file: File) =>
    run(async () => {
      const result = await importExport(parseExport(await file.text()))
      return `Importados ${result.rows} registros.`
    }, 'No se pudo importar el archivo.')

  const loadDemo = () =>
    run(async () => {
      const r = await seedDemoData()
      return `Añadidos ${r.workouts} entrenos de ejemplo (${r.sets} series) en 3 rutinas.`
    }, 'No se pudieron cargar los datos de ejemplo.')

  const deleteAll = () =>
    run(async () => {
      await onDeleteAll()
      return null
    }, 'No se pudo borrar. Comprueba la conexión e inténtalo de nuevo.')

  return (
    <Section title="Datos">
      <div className="flex flex-col gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void exportJson()}>
          Exportar JSON
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void exportCsv()}>
          Exportar CSV
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          Importar JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Archivo JSON a importar"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void importFile(file)
          }}
        />
        {DEMO_SEED_ENABLED && (
          <Button variant="secondary" disabled={busy} onClick={() => void loadDemo()}>
            Cargar 4 meses de ejemplo
          </Button>
        )}
      </div>

      {!confirming ? (
        <Button variant="secondary" disabled={offline || busy} onClick={() => setConfirming(true)}>
          Borrar todos mis datos
        </Button>
      ) : (
        <div role="alertdialog" aria-label="Borrar todos mis datos" className="flex flex-col gap-2">
          <p className="font-bold">
            Se borrarán tus rutinas, sesiones, ejercicios y ajustes de este dispositivo y de la
            nube. Tus otros dispositivos cerrarán sesión. No se puede deshacer.
          </p>
          <label htmlFor={confirmId} className="text-sm text-polvo">
            Escribe {CONFIRM_WORD} para confirmar
          </label>
          <input
            id={confirmId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="min-h-12 rounded-lg border border-concreto bg-hierro px-4 text-arena"
          />
          <Button
            disabled={typed.trim().toUpperCase() !== CONFIRM_WORD || offline || busy}
            onClick={() => void deleteAll()}
          >
            Borrar todo
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirming(false)
              setTyped('')
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
      {offline && <p className="text-sm text-polvo">Borrar tus datos necesita conexión.</p>}

      {message && (
        <p role="status" className="text-sm text-polvo">
          {message}
        </p>
      )}
    </Section>
  )
}
