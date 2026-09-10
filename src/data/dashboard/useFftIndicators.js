import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { isSortingAreaId } from '../production/personnelByArea'

/* Indicadores FFT (2026-09-10, a peticion explicita del usuario, tras confirmar exactamente que
   debe mostrar cada uno -- ver FFT_INDICATORS/FftIndicatorsCard.jsx para el resto del diseño,
   que ya estaba preparado para esto sin tocarse):

   - DEMORAS: minutos totales de Demoras de trabajo capturados HOY, solo areas FFT (excluye
     Sorting -- son areas independientes, ver areaGroup.js). Usa GET /api/demoras (mismo
     endpoint que el modulo Demoras), filtrando areaId que no empiece con "SORT_".
   - PRODUCCION/EFICIENCIA: suma de standardQty (meta)/actualQty (real) de TODAS las sesiones de
     Hora por Hora de HOY, tambien solo areas FFT. Usa GET /api/hora-por-hora/sessions/history
     sin areaId (trae todas las lineas) y se filtra igual. La "meta" nunca es un numero fijo: es
     la suma real de lo que cada linea tenga configurado ese dia -- si una linea no capturo hoy,
     simplemente no aporta al total (no se inventa su meta).

   CUMPLIMIENTO_PROGRAMAS (indicador 4) se deja intencionalmente sin fuente (hasSource:false en
   catalog.js) -- ni el propio usuario tenia claro que debia representar al revisarlo, asi que no
   se inventa un calculo para el. */
export function useFftIndicators() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    demorasMinutes: null,
    productionExpected: null,
    productionActual: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const today = dayjs().format('YYYY-MM-DD')
      try {
        const [demorasRes, sessionsRes] = await Promise.all([
          fetch(`/api/demoras?dateFrom=${today}&dateTo=${today}`, { credentials: 'include' }),
          fetch(`/api/hora-por-hora/sessions/history?dateFrom=${today}&dateTo=${today}`, {
            credentials: 'include',
          }),
        ])
        if (!demorasRes.ok) throw new Error(`demoras -> ${demorasRes.status}`)
        if (!sessionsRes.ok) throw new Error(`hora-por-hora -> ${sessionsRes.status}`)
        const demorasData = await demorasRes.json()
        const sessionsData = await sessionsRes.json()

        const demorasMinutes = (demorasData.records || [])
          .filter((r) => !isSortingAreaId(r.areaId))
          .reduce((sum, r) => sum + r.durationMinutes, 0)

        const fftSessions = (sessionsData.sessions || []).filter((s) => !isSortingAreaId(s.areaId))
        const productionExpected = fftSessions.reduce((sum, s) => sum + s.expected, 0)
        const productionActual = fftSessions.reduce((sum, s) => sum + s.actual, 0)

        if (!cancelled) {
          setState({
            loading: false,
            error: null,
            demorasMinutes,
            productionExpected,
            productionActual,
          })
        }
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.message }))
      }
    }

    load()
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', load)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', load)
    }
  }, [])

  return state
}
