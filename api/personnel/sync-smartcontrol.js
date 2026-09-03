// Trigger manual del sync automatico Employee <-> SmartControl (server-lib/personnel-sync.js) --
// mismo guard que ya usa api/users/index.js (solo quien tiene acceso al modulo Usuarios), porque
// esto muta personal real. El servidor persistente (server-lib/prod-server.js) ya corre esto solo
// cada 30 min; este endpoint es para forzarlo al momento (verificar un deploy, o antes de revisar
// el directorio) sin esperar al proximo ciclo.
import { requireModuleAccess } from '../../server-lib/auth.js'
import { runPersonnelSync } from '../../server-lib/personnel-sync.js'

export default requireModuleAccess('/usuarios', async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const result = await runPersonnelSync()
    return res.status(200).json(result)
  } catch (e) {
    console.error('[personnel-sync] error en sync manual:', e)
    return res.status(500).json({ error: e.message || 'Error al sincronizar con SmartControl.' })
  }
})
