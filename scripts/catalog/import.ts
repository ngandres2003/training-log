/**
 * Builds apps/web/public/catalog/exercises.es.v1.json from the
 * hasaneyldrm/exercises-dataset JSON (see README.md).
 *
 *   pnpm exec tsx scripts/catalog/import.ts <path-to-exercises.json>
 *
 * The input is treated as untrusted data: it is only parsed and read field by
 * field. Media (images/GIFs) are not used; see README.md for why.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CatalogExercise, Equipment, TrackingType } from '../../packages/domain/src/types'
import { DROPPED_TARGETS, mapPrimaryMuscle, mapSecondaryMuscles } from './muscle-map'

export interface SourceExercise {
  id: string
  name: string
  equipment: string
  target: string
  secondary_muscles: string[]
  instruction_steps?: Record<string, string[] | undefined>
  media_id: string
}

export interface CatalogEntry extends CatalogExercise {
  /** Original English name, used as a search alias. */
  nameEn: string
  instructionsEs: string[]
  /** Dataset media id, kept so images can be enabled once licensed. */
  mediaId: string
}

/** Dataset equipment -> spec equipment group. Anything else is 'other'. */
export const EQUIPMENT_MAP: Readonly<Record<string, Equipment>> = {
  barbell: 'barbell',
  'olympic barbell': 'barbell',
  'ez barbell': 'barbell',
  'trap bar': 'barbell',
  dumbbell: 'dumbbell',
  cable: 'cable',
  rope: 'cable',
  'smith machine': 'machine',
  'leverage machine': 'machine',
  'sled machine': 'machine',
  'body weight': 'bodyweight',
  assisted: 'bodyweight',
  weighted: 'bodyweight',
}

/** Cardio machines: their exercises are dropped (cardio is out of scope). */
export const DROPPED_EQUIPMENT: readonly string[] = [
  'upper body ergometer',
  'skierg machine',
  'stationary bike',
  'elliptical machine',
  'stepmill machine',
]

/** Dataset equipment without external load: tracked by reps alone. */
const UNLOADED_EQUIPMENT = new Set([
  'body weight',
  'assisted',
  'band',
  'resistance band',
  'stability ball',
  'bosu ball',
  'roller',
  'wheel roller',
  'hammer',
  'tire',
])

/** Static positions, tracked by time. Bare "lever" is not here: machine names start with it. */
const HOLD =
  /\b(plank|hold|wall sit|isometric|stretch|dead hang|l-sit|v-sit|side bridge v|planche|front lever|back lever|maltese|handstand|flag|pose|sphinx|upward facing dog)\b/
/** Words that turn a hold-like name into a moving exercise (plank with twist, planche push-up). */
const MOVING = /\b(twist|tap|fly|lift|push-up|jack|march|wipers|clean|rotation|reach|dynamic|reps)\b/

export function mapEquipment(equipment: string): Equipment {
  return (Object.hasOwn(EQUIPMENT_MAP, equipment) && EQUIPMENT_MAP[equipment]) || 'other'
}

export function trackingTypeFor(name: string, equipment: string): TrackingType {
  if (HOLD.test(name) && !MOVING.test(name)) return 'time'
  if (UNLOADED_EQUIPMENT.has(equipment)) return 'reps'
  return 'weight_reps'
}

export function isDropped(e: SourceExercise): boolean {
  return DROPPED_TARGETS.includes(e.target) || DROPPED_EQUIPMENT.includes(e.equipment)
}

/** Repairs the mojibake "в°" the dataset has in a few names. */
const cleanName = (name: string) => name.replaceAll('в°', '°').trim()

export function buildCatalog(
  source: readonly SourceExercise[],
  translations: Readonly<Record<string, string>>,
): CatalogEntry[] {
  const missing: string[] = []
  const entries: CatalogEntry[] = []
  for (const e of source) {
    if (isDropped(e)) continue
    const nameEn = cleanName(e.name)
    const name = translations[e.id]?.trim()
    if (!name) {
      missing.push(`${e.id}: ${nameEn}`)
      continue
    }
    const primaryMuscle = mapPrimaryMuscle(e.target)
    const steps = e.instruction_steps?.es?.length ? e.instruction_steps.es : (e.instruction_steps?.en ?? [])
    entries.push({
      id: `cat-${e.id}`,
      name,
      nameEn,
      primaryMuscle,
      secondaryMuscles: mapSecondaryMuscles(e.secondary_muscles ?? [], primaryMuscle),
      equipment: mapEquipment(e.equipment),
      trackingType: trackingTypeFor(nameEn, e.equipment),
      imageUrl: null,
      mediaId: e.media_id,
      instructionsEs: steps.map((s) => s.trim()).filter(Boolean),
    })
  }
  if (missing.length) {
    throw new Error(
      `${missing.length} kept exercises have no Spanish name in translations.es.json:\n  ${missing.join('\n  ')}`,
    )
  }
  return entries
}

function main() {
  const input = process.argv[2]
  if (!input) throw new Error('Usage: tsx scripts/catalog/import.ts <path-to-exercises.json>')
  const here = dirname(fileURLToPath(import.meta.url))
  const source = JSON.parse(readFileSync(resolve(input), 'utf8')) as SourceExercise[]
  const translations = JSON.parse(readFileSync(resolve(here, 'translations.es.json'), 'utf8')) as Record<
    string,
    string
  >
  const catalog = buildCatalog(source, translations)
  const out = resolve(here, '../../apps/web/public/catalog/exercises.es.v1.json')
  mkdirSync(dirname(out), { recursive: true })
  // One entry per line keeps regeneration diffs reviewable.
  writeFileSync(out, `[\n${catalog.map((e) => JSON.stringify(e)).join(',\n')}\n]\n`)
  console.log(`Wrote ${catalog.length} exercises (${source.length - catalog.length} dropped) to ${out}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
