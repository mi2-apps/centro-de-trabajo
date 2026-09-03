import { Activity, Timer } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  cardClass,
  cardHeaderClass,
  cardHeaderSubtitleClass,
  cardHeaderTitleClass,
  cellTextClass,
  cellTextSecondaryClass,
  tableHeaderRowClass,
  tableRowClass,
} from '@/lib/pageStyles'
import { cn } from '@/lib/utils'

/* Tabla de Takt Time (teorico + real), UNA por cada una de las 11 lineas FFT (LINEA1..10 +
   PROYECTO/"WC LINEA 0") -- rediseño 2026-09-03, a peticion explicita del usuario, 2 rondas:
   1ra ronda: card propia con mas espacio, debajo de la barra de busqueda, SIEMPRE visible en las
   11 lineas (haya o no haya personal/piezas reales hoy -- ver LineDetailDrawer.jsx, realTakt nunca
   sale null, solo secondsPerUnit null cuando no hay piezas reales todavia).
   2da ronda ("te dije una card que explique que es cada quien y como se mide... te dije abajo del
   buscador una TABLA CHICA no esa card gigante"): se cambia el formato de 2 bloques grandes a una
   TABLA chica de 3 columnas (Tipo/Seg. por pieza/Qué significa), y cada fila explica el numero en
   una frase directa ("sale 1 pieza cada Xs...") en vez de dejar el segundo suelto sin contexto. */
export default function TaktTimeCard({ t, taktTime, realTakt, shiftLabel }) {
  if (!taktTime) return null

  const targetPcs = Math.round(taktTime.targetPcs).toLocaleString()
  const theoreticalExplanation = taktTime.activeLineCount
    ? t('lineDetailDrawer.taktTimeExplanationSplit', {
        seconds: taktTime.secondsPerUnit.toFixed(1),
        targetPcs,
        plantTargetPcs: taktTime.plantTargetPcs.toLocaleString(),
        activeLineCount: taktTime.activeLineCount,
        shiftLabel,
      })
    : t('lineDetailDrawer.taktTimeExplanation', {
        seconds: taktTime.secondsPerUnit.toFixed(1),
        targetPcs,
        shiftLabel,
      })

  const rows = [
    {
      id: 'theoretical',
      icon: Timer,
      tone: 'text-[#A855F7]',
      label: t('lineDetailDrawer.taktTimeTitle'),
      seconds: taktTime.secondsPerUnit,
      explanation: theoreticalExplanation,
    },
    {
      id: 'real',
      icon: Activity,
      tone: 'text-[#22C55E]',
      label: t('lineDetailDrawer.taktTimeRealTitle'),
      seconds: realTakt?.secondsPerUnit ?? null,
      explanation:
        realTakt?.secondsPerUnit != null
          ? t('lineDetailDrawer.taktTimeRealExplanation', {
              seconds: realTakt.secondsPerUnit.toFixed(1),
              realPieces: realTakt.realPieces.toLocaleString(),
            })
          : t('lineDetailDrawer.taktTimeRealEmptyLabel'),
    },
  ]

  return (
    <div className={cn(cardClass, 'mb-6')}>
      <div className={cardHeaderClass}>
        <div className="min-w-0 flex-1">
          <p className={cardHeaderTitleClass}>{t('lineDetailDrawer.taktTimeCardTitle')}</p>
          <p className={cardHeaderSubtitleClass}>{t('lineDetailDrawer.taktTimeCardSubtitle')}</p>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className={tableHeaderRowClass}>
            <TableHead>{t('lineDetailDrawer.taktTimeColType')}</TableHead>
            <TableHead>{t('lineDetailDrawer.taktTimeColSeconds')}</TableHead>
            <TableHead>{t('lineDetailDrawer.taktTimeColMeaning')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow key={row.id} className={tableRowClass(idx)}>
              <TableCell className={cn(cellTextClass, 'whitespace-nowrap font-bold')}>
                <span className="flex items-center gap-1.5">
                  <row.icon className={cn('h-3.5 w-3.5 shrink-0', row.tone)} />
                  {row.label}
                </span>
              </TableCell>
              <TableCell className={cn(cellTextClass, 'whitespace-nowrap font-extrabold')}>
                {row.seconds != null ? `${row.seconds.toFixed(1)}s` : '—'}
              </TableCell>
              <TableCell className={cellTextSecondaryClass}>{row.explanation}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
