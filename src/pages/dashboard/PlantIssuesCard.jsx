import { AlertTriangle, Hourglass, PackageX, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cardClass, cardHeaderClass, cardHeaderTitleClass } from '@/lib/pageStyles'
import { EmptyState } from '../../ui'

function withAlpha(hex, opacity) {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`
}

/* "Problemas en planta" -- widget al fondo del Dashboard (2026-09-04, a peticion explicita del
   usuario -- "en el dashboards hasta abajo asegurate que indique que problemas hay en la planta
   con los modulos conectados por si hay demora o problema de material, linea saturada, etc").
   Agrega datos REALES de hoy de dos modulos ya conectados -- Demoras (DowntimeRecord) y Control
   de Equipo (EquipmentItem), via /api/dashboard/plant-issues. "Linea saturada" no tiene fuente de
   datos real todavia (no hay metrica de capacidad/utilizacion en el sistema) -- no se inventa
   aqui, solo se muestran los 2 problemas que SI se pueden medir hoy. */
export default function PlantIssuesCard() {
  const { t } = useTranslation('dashboard')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/plant-issues', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasIssues = data && (data.downtime.totalRecords > 0 || data.equipment.issuesCount > 0)

  return (
    <div className={cardClass}>
      <div className={cardHeaderClass}>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-[18px] w-[18px] text-[#F59E0B]" />
          <p className={cardHeaderTitleClass}>{t('plantIssuesCard.title')}</p>
        </div>
      </div>
      <div className="p-4">
        {loading ? (
          <EmptyState compact title={t('plantIssuesCard.loading')} />
        ) : !hasIssues ? (
          <EmptyState
            compact
            title={t('plantIssuesCard.emptyTitle')}
            description={t('plantIssuesCard.emptyDescription')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <IssueStat
              color="#F59E0B"
              Icon={Hourglass}
              label={t('plantIssuesCard.downtimeLabel')}
              value={t('plantIssuesCard.downtimeValue', {
                count: data.downtime.totalRecords,
                minutes: data.downtime.totalMinutes,
              })}
              detail={t('plantIssuesCard.reportableDetail', {
                count: data.downtime.reportableCount,
              })}
            />
            <IssueStat
              color="#EF4444"
              Icon={PackageX}
              label={t('plantIssuesCard.materialLabel')}
              value={t('plantIssuesCard.materialValue', {
                count: data.downtime.materialIssuesCount,
              })}
              detail={
                data.downtime.topReasons[0]
                  ? t(`demoras:reasons.${data.downtime.topReasons[0].reasonKey}`)
                  : t('plantIssuesCard.noneDetail')
              }
            />
            <IssueStat
              color="#8B5CF6"
              Icon={Wrench}
              label={t('plantIssuesCard.equipmentLabel')}
              value={t('plantIssuesCard.equipmentValue', { count: data.equipment.issuesCount })}
              detail={
                data.equipment.recent[0]
                  ? t(`controlEquipo:types.${data.equipment.recent[0].typeKey}`)
                  : t('plantIssuesCard.noneDetail')
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

function IssueStat({ color, Icon, label, value, detail }) {
  return (
    <div className="flex items-start gap-2.5">
      <div
        className="mt-[0.8px] grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full"
        style={{ backgroundColor: withAlpha(color, 0.14), color }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.02em] text-muted-foreground">
          {label}
        </p>
        <p className="text-[15px] font-extrabold leading-tight">{value}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}
