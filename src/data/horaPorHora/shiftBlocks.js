/* Generador puro de bloques horarios de un turno (2026-09-04, a peticion explicita del usuario --
   "el sistema debe generar los bloques correspondientes por hora... manejar correctamente un
   turno que cruza medianoche"). Reutiliza OFFICIAL_SHIFTS de src/data/production/catalog.js
   (UNICA fuente real de horarios de turno, ya con la logica de "cruza medianoche" resuelta para
   getCurrentShift) -- este archivo NO inventa un segundo sistema de turnos, solo genera bloques
   de 1 hora a partir de start/end de OFFICIAL_SHIFTS.

   Cada bloque se calcula con fechas reales (Date), nunca aritmetica de texto "HH:MM" suelta --
   asi "cual bloque esta activo ahora" y "a que fecha/hora real corresponde cada bloque" usan
   EXACTAMENTE la misma fuente, sin duplicar logica de cruce de medianoche en dos lugares. */

function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return { h, m }
}

// Extrae año/mes/dia de una fecha "de calendario" sin pasar por conversion de zona horaria --
// el API devuelve session.date como string ISO ("2026-09-04T00:00:00.000Z", la columna `date` de
// Postgres serializada), y reinterpretar ese instante con `new Date(...).getFullYear()` aplicaria
// la zona horaria LOCAL del navegador/servidor, recorriendo un dia hacia atras con offsets
// negativos -- por eso el año/mes/dia se leen directo del string, nunca de un Date ya parseado.
function toCalendarYMD(dateLike) {
  if (dateLike instanceof Date) {
    return { y: dateLike.getFullYear(), m: dateLike.getMonth(), d: dateLike.getDate() }
  }
  const [y, m, d] = String(dateLike).slice(0, 10).split('-').map(Number)
  return { y, m: m - 1, d }
}

// Combina una fecha "de calendario" (Date, "YYYY-MM-DD", o ISO string) con "HH:MM" -> Date real,
// a esa hora local.
function combineDateAndTime(dateLike, hhmm) {
  const { y, m, d } = toCalendarYMD(dateLike)
  const { h, m: min } = parseHHMM(hhmm)
  return new Date(y, m, d, h, min, 0, 0)
}

function formatHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/* Genera los bloques de 1 hora (el ultimo puede ser parcial, ej. Matutino termina 17:10 -> el
   ultimo bloque es 17:00-17:10) de un turno que inicia el `sessionDate` dado. `shift` es una
   entrada de OFFICIAL_SHIFTS ({ start: "HH:MM", end: "HH:MM" }) -- si end <= start, se asume que
   cruza medianoche (mismo criterio que getCurrentShift). Devuelve
   [{ startTime, endTime, startsAt, endsAt }], startTime/endTime en "HH:MM" (lo que se persiste),
   startsAt/endsAt como Date real (solo para comparar contra "ahora", nunca se guardan). */
export function buildShiftBlocks(sessionDate, shift) {
  const startsAt = combineDateAndTime(sessionDate, shift.start)
  let endsAt = combineDateAndTime(sessionDate, shift.end)
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000)
  }

  const blocks = []
  let cursor = startsAt
  while (cursor.getTime() < endsAt.getTime()) {
    const nextHour = new Date(cursor)
    nextHour.setMinutes(0, 0, 0)
    nextHour.setHours(nextHour.getHours() + 1)
    const blockEnd = nextHour.getTime() < endsAt.getTime() ? nextHour : endsAt
    blocks.push({
      startTime: formatHHMM(cursor),
      endTime: formatHHMM(blockEnd),
      startsAt: new Date(cursor),
      endsAt: new Date(blockEnd),
    })
    cursor = blockEnd
  }
  return blocks
}

// Indice del bloque activo AHORA MISMO (o -1 si ninguno, ej. sesion ya termino o todavia no
// empieza) -- usado para resaltar la hora en curso, nunca para bloquear captura de otras horas.
export function findActiveBlockIndex(blocks, now = new Date()) {
  const t = now.getTime()
  return blocks.findIndex((b) => t >= b.startsAt.getTime() && t < b.endsAt.getTime())
}
