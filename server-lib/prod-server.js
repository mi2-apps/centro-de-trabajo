// Servidor de PRODUCCION para Coolify (MI Stack Reference, Fase 7) --
// unico entrypoint real usado fuera de Vercel. Monta los mismos handlers de
// /api que Vercel (via mountApiRoutes, ver api-routes.js -- nunca una
// segunda copia de esa logica) y ademas sirve el build estatico de Vite
// (dist/) con fallback de SPA para las rutas del cliente (React Router).
//
// Requisitos del checklist de stack de la plataforma (apps.mi2.com.mx/launch):
// - Bind obligatorio a 0.0.0.0 (nunca localhost) para que el proxy de
//   Coolify (Traefik) pueda enrutar trafico externo hacia el contenedor.
// - Puerto tomado de process.env.PORT (asignado por Coolify), con 3000
//   como default solo para pruebas locales de este archivo.
// - Lanzado via PM2 (ecosystem.config.cjs en la raiz del repo, ver
//   package.json "start"), nunca `node` directo en produccion real.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { mountApiRoutes } from './api-routes.js'
import { runPersonnelSync } from './personnel-sync.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const app = express()
app.use(express.json())

mountApiRoutes(app)

// Estatico + fallback de SPA -- SIEMPRE despues de mountApiRoutes, para que
// ninguna ruta /api caiga aqui por error si algun dia se agrega una ruta
// nueva sin registrar (fallaria con 404 real de Express en vez de servir
// index.html por accidente).
app.use(express.static(distDir))
// Express 5 (path-to-regexp v8) ya no acepta el comodin '*' a secas --
// requiere un nombre de parametro ('/*splat'), verificado empiricamente
// contra la version instalada (express@5.2.1) antes de usarlo aqui.
app.get('/*splat', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(distDir, 'index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[prod-server] escuchando en 0.0.0.0:${PORT}`)
})

// Sync automatico Employee <-> SmartControl (2026-09-03, ver server-lib/personnel-sync.js) --
// SOLO corre aqui, el proceso persistente de Coolify (nunca hay un equivalente en Vercel,
// serverless, sin proceso propio -- ese remoto ya esta retirado para este repo de todas formas).
// Nunca debe tumbar el servidor: cualquier error (SmartControl caido, credenciales faltantes) se
// loguea y se reintenta en el siguiente ciclo, nunca se propaga.
const PERSONNEL_SYNC_INTERVAL_MS = 30 * 60 * 1000
async function runPersonnelSyncSafely() {
  try {
    const result = await runPersonnelSync()
    if (result.skipped) {
      console.log('[personnel-sync]', result.reason)
    } else {
      console.log(
        `[personnel-sync] alta=${result.added.length} baja=${result.bajas.length} (${result.ranAt})`,
      )
    }
  } catch (e) {
    console.error('[personnel-sync] error:', e.message)
  }
}
setTimeout(runPersonnelSyncSafely, 60 * 1000)
setInterval(runPersonnelSyncSafely, PERSONNEL_SYNC_INTERVAL_MS)
