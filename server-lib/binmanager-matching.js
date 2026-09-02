// Empareja un usuario de BinManager (nombre real resuelto via ADM.UsersLogin) contra el roster
// real de Employee de esta app -- por NOMBRE, porque no existe ningun identificador compartido
// entre los dos sistemas (BinManager usa un username propio tipo "nombre.apellidoNN", esta app usa
// employeeNumber/fullName; ver server-lib/binmanager-sql.js). NUNCA se autoconfirma un match dudoso
// -- a peticion explicita del usuario ("emparejar automatico, revisando los casos dudosos"), esto
// devuelve un status por cada usuario: solo 'OK' con exactamente 1 candidato se usa para atribuir
// piezas reales a una linea; 'AMBIGUO'/'REVISAR'/'SIN_MATCH' se reportan para que Roman confirme a
// mano, nunca se adivina.
//
// Probado en vivo 2026-09-02 contra los primeros 10 usuarios reales del work center FFT: 7/10 OK,
// 1/10 SIN_MATCH real (no esta en el roster activo), 2/10 REVISAR (apellido comun con varios
// candidatos, ej "Mendoza"/"Reyes") -- ver memoria de la sesion para el detalle exacto.

function normalize(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] =
        a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
    }
  }
  return d[m][n]
}

// Tolerancia de edicion SOLO para el nombre de pila (variantes reales observadas: Yesica/Yessica,
// Evelyn/Evelin) -- el apellido SIEMPRE debe coincidir EXACTO (token completo), nunca con
// tolerancia, porque un apellido corto+comun con distancia de edicion abierta produce falsos
// positivos peligrosos (verificado en vivo: "Ramon"/"Mendoza"/"Flores" solos ya dan varios
// candidatos reales sin tolerancia adicional).
function isCloseFirstName(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  const dist = levenshtein(a, b)
  return dist <= (Math.max(a.length, b.length) >= 6 ? 2 : 1)
}

/**
 * @param {{username:string,name:string,secondName:string|null,lastName:string,secondLastName:string|null}} bmUser
 * @param {{employeeNumber:string,fullName:string}[]} employees - roster activo de Employee
 * @returns {{status:'OK'|'AMBIGUO'|'REVISAR'|'SIN_MATCH', candidates:{employeeNumber:string,fullName:string}[]}}
 */
export function matchBinManagerUser(bmUser, employees) {
  const nameTok = normalize(bmUser.name)
  const lastTok = normalize(bmUser.lastName)
  const secondLastTok = normalize(bmUser.secondLastName)

  const withEmployeeTokens = employees.map((e) => ({
    ...e,
    tokens: normalize(e.fullName).split(' ').filter(Boolean),
  }))

  // Paso 1: candidatos reales -- el apellido (principal o materno) debe aparecer EXACTO como
  // token completo en el nombre del empleado.
  const surnameCandidates = withEmployeeTokens.filter((e) =>
    e.tokens.some((t) => (lastTok && t === lastTok) || (secondLastTok && t === secondLastTok)),
  )

  if (surnameCandidates.length === 0) {
    return { status: 'SIN_MATCH', candidates: [] }
  }

  // Paso 2: de esos, cuales tambien tienen un nombre de pila cercano.
  const strong = surnameCandidates.filter((e) => e.tokens.some((t) => isCloseFirstName(t, nameTok)))

  const toPublic = (list) => list.map(({ employeeNumber, fullName }) => ({ employeeNumber, fullName }))

  if (strong.length === 1) return { status: 'OK', candidates: toPublic(strong) }
  if (strong.length > 1) return { status: 'AMBIGUO', candidates: toPublic(strong) }
  // Apellido coincide pero ningun nombre de pila es cercano -- se reporta como REVISAR con los
  // candidatos por apellido (nunca se descarta silenciosamente, puede ser la persona real con un
  // nombre de pila muy distinto al que BinManager tiene capturado).
  return { status: 'REVISAR', candidates: toPublic(surnameCandidates) }
}

export function matchAllBinManagerUsers(bmUsers, employees) {
  return bmUsers.map((bmUser) => ({
    username: bmUser.username,
    resolvedName: [bmUser.name, bmUser.secondName, bmUser.lastName, bmUser.secondLastName]
      .filter(Boolean)
      .join(' '),
    ...matchBinManagerUser(bmUser, employees),
  }))
}
