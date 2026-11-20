/**
 * Consejos que se muestran en Inicio, como en las pantallas de carga de los videojuegos.
 * Para añadir uno, agrega un objeto a la lista: `id` único y estable, `text` corto (1–2 frases).
 */
export interface Tip {
  id: string
  text: string
}

export const TIPS: readonly Tip[] = [
  {
    id: 'sobrecarga-progresiva',
    text: 'Para progresar, sube poco a poco: una repetición más o 2,5 kg más que la última vez ya cuenta.',
  },
  {
    id: 'tecnica-antes-que-peso',
    text: 'La técnica va antes que el peso. Si la última repetición sale fea, esa serie ya terminó.',
  },
  {
    id: 'descanso-y-sueno',
    text: 'El músculo crece descansando: dormir bien y no entrenar el mismo grupo dos días seguidos también es entrenar.',
  },
]

/** Index of a random tip, different from `exclude` when there is more than one. */
export function randomTipIndex(count: number, exclude: number | null = null, random: () => number = Math.random): number {
  if (count <= 1) return 0
  const pick = Math.floor(random() * (exclude === null ? count : count - 1))
  return exclude !== null && pick >= exclude ? pick + 1 : pick
}
