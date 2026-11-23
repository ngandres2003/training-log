/**
 * Catalog exercises most people actually do, in the order the exercise list shows them
 * before everything else (grouped by muscle). The rest of the ~1,300 catalog entries
 * still appear, alphabetically, after these.
 *
 * Ids are `cat-<dataset id>` from /catalog/exercises.es.v1.json. Edit freely: add, remove
 * or reorder lines to change what shows up first.
 */
export const BASIC_EXERCISE_IDS: readonly string[] = [
  // Pecho
  'cat-0025', // Press de banca con barra
  'cat-0289', // Press de banca con mancuernas
  'cat-0047', // Press de banca inclinado con barra
  'cat-0314', // Press de banca inclinado con mancuernas
  'cat-0577', // Press de pecho en máquina
  'cat-0748', // Press de banca en Smith
  'cat-0757', // Press de banca inclinado en Smith
  'cat-0596', // Aperturas sentado en máquina (contractor)
  'cat-0308', // Aperturas con mancuernas
  'cat-0227', // Aperturas de pie en polea
  'cat-0662', // Flexión
  'cat-0251', // Fondos de pecho

  // Espalda
  'cat-0652', // Dominada
  'cat-1326', // Dominada supina
  'cat-0017', // Dominada asistida
  'cat-0150', // Jalón al pecho con barra en polea
  'cat-0818', // Jalón al pecho con agarre paralelo doble
  'cat-0861', // Remo sentado en polea
  'cat-1350', // Remo sentado en máquina
  'cat-0027', // Remo inclinado con barra
  'cat-0292', // Remo inclinado a una mano con mancuerna
  'cat-0032', // Peso muerto con barra
  'cat-0489', // Hiperextensión

  // Piernas
  'cat-0043', // Sentadilla profunda con barra
  'cat-0770', // Sentadilla en Smith
  'cat-1760', // Sentadilla goblet con mancuerna
  'cat-0739', // Prensa de piernas a 45°
  'cat-0743', // Sentadilla hack en máquina
  'cat-0585', // Extensión de cuádriceps en máquina
  'cat-0586', // Curl femoral tumbado en máquina
  'cat-0599', // Curl femoral sentado en máquina
  'cat-0085', // Peso muerto rumano con barra
  'cat-1459', // Peso muerto rumano con mancuernas
  'cat-0336', // Zancada con mancuernas
  'cat-1460', // Zancadas caminando
  'cat-0410', // Sentadilla búlgara con mancuernas
  'cat-1409', // Puente de glúteos con barra
  'cat-0597', // Abducción de cadera sentado en máquina
  'cat-0598', // Aducción de cadera sentado en máquina
  'cat-0605', // Elevación de gemelos de pie en máquina
  'cat-0594', // Elevación de gemelos sentado en máquina

  // Hombros
  'cat-0405', // Press de hombros sentado con mancuernas
  'cat-0091', // Press sobre la cabeza sentado con barra
  'cat-0603', // Press de hombros en máquina
  'cat-0774', // Press militar de pie en Smith
  'cat-2137', // Press Arnold con mancuernas
  'cat-0334', // Elevación lateral con mancuernas
  'cat-0178', // Elevación lateral en polea
  'cat-0310', // Elevación frontal con mancuernas
  'cat-0378', // Pájaro con mancuernas
  'cat-0602', // Pájaro sentado en máquina
  'cat-0203', // Remo de deltoides posterior en polea (con cuerda)
  'cat-0120', // Remo al mentón con barra
  'cat-0406', // Encogimiento de hombros con mancuernas
  'cat-0095', // Encogimiento de hombros con barra

  // Bíceps
  'cat-0031', // Curl con barra
  'cat-0447', // Curl con barra Z
  'cat-0294', // Curl de bíceps con mancuernas
  'cat-0313', // Curl martillo con mancuernas
  'cat-0318', // Curl inclinado con mancuernas
  'cat-0070', // Curl predicador con barra
  'cat-0868', // Curl en polea

  // Tríceps
  'cat-0201', // Extensión de tríceps en polea
  'cat-0200', // Extensión de tríceps en polea con cuerda
  'cat-0194', // Extensión de tríceps sobre la cabeza en polea (con cuerda)
  'cat-0060', // Press francés con barra
  'cat-0030', // Press de banca con agarre cerrado
  'cat-0814', // Fondos de tríceps
  'cat-0333', // Patada de tríceps con mancuerna

  // Abdomen
  'cat-0274', // Crunch en el suelo
  'cat-0175', // Crunch de rodillas en polea
  'cat-0872', // Crunch inverso
  'cat-0472', // Elevación de piernas colgado
  'cat-0687', // Giro ruso
  'cat-0857', // Rueda abdominal
]

const RANK = new Map(BASIC_EXERCISE_IDS.map((id, i) => [id, i]))

/** Position in the basics list, or `undefined` for every other exercise. */
export function basicRank(id: string): number | undefined {
  return RANK.get(id)
}
