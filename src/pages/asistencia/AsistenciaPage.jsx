import dayjs from 'dayjs'
import {
  BadgeCheck,
  Boxes,
  Brush,
  Building2,
  Calendar,
  CalendarX,
  ChartPie,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock,
  Crown,
  Dumbbell,
  Eye,
  Factory,
  Gem,
  GraduationCap,
  HelpCircle,
  Search,
  Stamp,
  UserCog,
  Users,
  Warehouse,
  Workflow,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  cardClass,
  cardHeaderClass,
  cardHeaderSubtitleClass,
  cardHeaderTitleClass,
  metricChipClass,
  pageClass,
  pageSubtitleClass,
  pageTitleClass,
  progressBarClass,
} from '@/lib/pageStyles'
import { cn, hexToRgba } from '@/lib/utils'
import { formatEmployeeNumber } from '../../data/personnel/employeeDisplay'
import { getAbsentEmployeeIds, getAssignmentsForDate } from '../../data/personnel/repository'
import { usePersonnelVersion } from '../../data/personnel/usePersonnelVersion'
import {
  canonicalOperationalAreaId,
  EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS,
  LINE_FAMILY_AREA_IDS,
  operationalGroupMembers,
  WORK_CENTERS,
} from '../../data/production/catalog'
import {
  BASE_SNAPSHOT_DATE,
  getGroupPeople,
  getPeopleWithoutArea,
} from '../../data/production/personnelByArea'
import { EmptyState } from '../../ui'
import EmployeeAvatar from '../centro-trabajo/EmployeeAvatar'

/* Modulo Asistencia (2026-09-01, a peticion explicita del usuario: "en mi
   modulo de asistencia ya lo puedes crear, pon a todos los que tenemos
   ahi... analizalo y ponlos a todos... por areas de trabajo") -- reemplaza
   el placeholder "Proximamente" (ComingSoonPage) que tenia esta ruta.

   Investigacion previa (para no duplicar trabajo ya hecho): el Excel
   "LAYOUT FFT.xlsx" (hoja "BASE ") YA esta importado por completo --
   src/data/production/realPersonnelSnapshot.js (REAL_PERSONNEL_SNAPSHOT,
   116 filas reales capturadas 2026-08-18, BASE_SNAPSHOT_DATE) alimenta ya
   todo Centro de Trabajo, y esas mismas filas ya fueron sembradas en
   Postgres real (scripts/seed-personnel.mjs, columnas rawZona/actividad/
   baseAsistencia en Employee). Esta pagina NO vuelve a importar nada:
   reutiliza esa misma fuente (getGroupPeople/personnelByArea.js) para no
   crear una segunda copia de los mismos datos con otro criterio de
   mapeo ZONA->area.

   Tambien se confirmo que el punto 2 del pedido ("que le tome la
   asistencia en automatico" al registrar a alguien en un puesto) YA
   estaba resuelto antes de este cambio: checkInEmployee (repository.js,
   ~linea 527) ya llama ensureAttendance() en cuanto confirma la
   asignacion, y del lado servidor placeEmployee() (server-lib/
   personnel.js) inserta Attendance real en la MISMA transaccion que la
   asignacion (api/personnel/checkin.js). No se toco ese codigo -- ya
   hace exactamente lo pedido.

   Esta pagina SOLO LEE (mismo patron de solo-lectura que Evaluaciones/
   KPI's) y agrupa por area de trabajo usando los mismos WORK_CENTERS de
   catalog.js que ya usa el resto de Centro de Trabajo (nunca un esquema
   de areas nuevo). Para cada persona, el estado se decide con 2 fuentes
   SIN mezclarlas:

   1) Asignacion REAL de HOY (getAssignmentsForDate, repository.js) --
      unica fuente que se muestra como "Presente hoy" (verde). Se usa esta
      tabla (DailyAssignment/`assignments`) y NO la tabla `Attendance`
      local (isPresentToday/getAttendanceForDate) porque solo `assignments`
      se fusiona cross-device en cada poll de 2s (ver pollOnce en
      apiSync.js, que jala /api/personnel/roster y escribe con
      writeAssignments) -- Attendance es un store puramente local que solo
      se llena en el MISMO navegador que hizo el check-in, asi que un
      supervisor viendo esta pagina en otro dispositivo nunca la veria
      actualizarse. `usePersonnelVersion()` se agrega como dependencia del
      useMemo de abajo por la misma razon: sin eso, un check-in real
      (propio o sincronizado desde otro dispositivo) nunca refresca esta
      pagina hasta recargar.
   2) Codigo HISTORICO de la columna ASISTENCIA de BASE (capturado
      2026-08-18) -- SOLO para quien todavia no tiene una asignacion real
      hoy. Se muestra siempre junto con su fecha de origen, nunca como si
      fuera el estado de HOY (ya paso mas de una semana desde esa
      captura).

   Significado de los codigos de ASISTENCIA -- confirmado cruzando la
   hoja "LAYOUT" del Excel (seccion visual FALTAS/SUSPENSION/VACACIONES/
   INCAPACIDAD con nombres de personas) contra la columna ASISTENCIA de
   "BASE " para esas mismas personas: coincide exacto en los 3 casos ->
   F=Falta, I=Incapacidad, V=Vacaciones. "A" NO tiene una celda de
   leyenda explicita en el archivo (es el unico codigo restante, el
   mayoritario: 90 de 116) -- se muestra como "Asistio" pero en tono
   NEUTRO/gris (nunca verde), porque esa lectura es una inferencia
   razonable, no una leyenda confirmada como las otras 3 -- para no
   inventar una certeza que el archivo no da. Quien no trae codigo
   historico (personal agregado despues, ej. ids "sem34-N") se muestra
   como "Sin dato", tambien neutro.

   REDISEÑO VISUAL COMPLETO (2026-09-01, a peticion explicita del usuario,
   sobre 4 mockups que el vio y describio en detalle -- 4 ESTADOS
   DISTINTOS del mismo modulo, nunca combinados en una sola pantalla):

   - Se conserva 100% la arquitectura de datos de arriba (2 fuentes,
     HISTORIC_STATUS, attendanceStatusFor) y la jerarquia real de
     navegacion (groups -> lines -> people, useState local, sin router
     nuevo) -- solo cambia el lenguaje visual y se agregan 4 vistas
     nuevas (accesibles desde chips/KPI cards) mas una 5ta KPI card que
     el usuario pidio explicitamente aunque no estuviera en el mockup
     ("Inasistencia").
   - Nueva pieza de datos consumida (YA resuelta por trabajo de backend
     previo a este cambio, no se toco nada de eso aqui): getAbsentEmployeeIds()
     (repository.js) -- consulta real a Attendance.status='AUSENTE' via
     apiSync.js/roster.js, hoy siempre devuelve [] porque ningun flujo real
     escribe ese estado todavia, pero es una lectura real del store
     sincronizado, no un valor fijo. Ver `absentIds` abajo.
   - `nav.mode` distingue la jerarquia real de areas (`browse`, con sus 3
     niveles groups/lines/people -- mockups 2/3/4) de las 4 vistas planas
     que abren las KPI cards/chips (`presentToday`/`pending`/`absences`/
     `coverage`, sin drill-down, mockup 1 extendido). Las 5 KPI cards + el
     buscador + los 4 chips + "Ultima actualizacion" SOLO se muestran en
     `mode==='browse' && level==='groups'` (la Vista 1 del mockup) y en
     los 4 modos especiales (para que el chip/card activo se pueda ver
     resaltado -- "sincronizados visualmente", pedido explicito del
     usuario) -- se OCULTAN en level 'lines'/'people' (mockups 2/3/4:
     ahi solo se ve "<- Volver a ..." + titulo + grid, igual que describio
     el usuario, sin la barra de herramientas encima).
   - DECISION EXPLICITA no cubierta al 100% por el brief (documentada
     aqui en vez de preguntar, criterio "mas simple y honesto"): el
     umbral de color de las barras de cobertura (areas/lineas/cobertura
     por area) se unifica en un solo criterio en toda la pagina --
     verde si >=80%, ambar si <80% y >0%, gris/vacio si 0% -- en vez de
     usar un umbral distinto solo para la vista "Lineas de produccion"
     (el mockup de esa vista solo muestra los 2 casos extremos 0% y
     100%, asi que un umbral de 100% para "verde" ahi no se puede
     verificar con los numeros dados, y tener dos reglas de color
     distintas en la misma pagina para el mismo concepto seria
     inconsistente e imposible de explicarle a un usuario).
   - El selector de fecha es deliberadamente NO funcional (ver seccion
     "Selector de fecha" del pedido: la arquitectura de datos actual
     -- getAssignmentsForDate/getGroupPeople -- solo calcula HOY, no hay
     endpoint para pedir otro dia) -- se muestra como texto informativo
     con icono de calendario, nunca como un <select>/boton que finja
     poder cambiar de fecha.
   - "Ultima actualizacion" usa la hora real de reloj (dayjs().format
     ('HH:mm')) capturada cada vez que `usePersonnelVersion()` cambia --
     nunca un texto relativo inventado tipo "hace 2 min" (el mockup lo
     muestra asi, pero el pedido funcional es explicito: HH:mm real).
   - El buscador (un solo input) filtra en un mismo indice piano
     areas + lineas + personas (nombre, numero de empleado, area, linea)
     -- nunca decorativo. Al seleccionar un resultado navega directo a la
     vista correspondiente (persona -> su area/linea; area/linea -> esa
     vista), reseteando `mode` a 'browse'. */

const HISTORIC_STATUS = {
  F: { i18nKey: 'statusFalta', tone: 'bad' },
  I: { i18nKey: 'statusIncapacidad', tone: 'warn' },
  V: { i18nKey: 'statusVacaciones', tone: 'info' },
  A: { i18nKey: 'statusAsistioHistorico', tone: 'default' },
}

function attendanceStatusFor(person, t) {
  if (person.todayAssignment) {
    return {
      chip: t('statusPresentToday'),
      tone: 'ok',
      detail: person.todayAssignment.checkInAt
        ? t('detailCheckedInAt', { time: person.todayAssignment.checkInAt })
        : '—',
    }
  }

  const historic = person.asistencia ? HISTORIC_STATUS[person.asistencia] : null
  if (historic) {
    return {
      chip: `${t(historic.i18nKey)} (${person.asistencia})`,
      tone: historic.tone,
      detail: t('detailHistoricDate', { date: dayjs(BASE_SNAPSHOT_DATE).format('DD/MM/YYYY') }),
    }
  }

  return { chip: t('statusUnknown'), tone: 'default', detail: '—' }
}

/* Cobertura = presentes/total EN ESE MISMO CONJUNTO (nunca idealHeadcount
   de catalog.js, que es un concepto distinto de dotacion ideal -- ver nota
   de encargo). `roundToInt` para tarjetas de area/linea/cobertura-por-area
   (mockup muestra enteros: "83%", "100%"); la Cobertura GLOBAL de la KPI
   card usa 1 decimal aparte (verificado exacto contra el mockup: 123/131 =
   93.9%). */
function coveragePctInt(present, total) {
  return total > 0 ? Math.round((present / total) * 100) : 0
}

function coveragePctOneDecimal(present, total) {
  return total > 0 ? Math.round((present / total) * 1000) / 10 : 0
}

function coverageBarColor(present, total) {
  if (total === 0) return 'bg-transparent'
  const pct = coveragePctInt(present, total)
  return pct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
}

const KPI_ACCENTS = {
  blue: { bg: 'bg-blue-500/[0.12]', text: 'text-blue-500' },
  green: { bg: 'bg-emerald-500/[0.12]', text: 'text-emerald-500' },
  orange: { bg: 'bg-amber-500/[0.12]', text: 'text-amber-500' },
  red: { bg: 'bg-red-500/[0.12]', text: 'text-red-500' },
}

const ACTIVE_SELECTION_CLASS = 'border-blue-400 bg-blue-500/[0.06]'

// "Personal por área" (2026-09-04, a peticion explicita del usuario, viendo esta pantalla en
// vivo -- "elimina calidad, wc gerente de fft y wc supervisor"): estas areas NUNCA se muestran
// como card de nivel 1 aqui, ni cuentan en los totales/KPIs de esta pagina (Registrados/
// Pendientes/Inasistencias/Cobertura) -- Centro de Trabajo/Auditoria siguen usando estas mismas
// areas para su proposito real (asignacion de personal, auditorias, etc), esto solo afecta como
// se cuenta el PERSONAL TOTAL aqui. Mismo criterio unificado que EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS
// (catalog.js, agrega ENTRENADOR) -- pregunta directa al usuario 2026-09-04, "Excluir los 4 en
// todos lados", ver ese comentario para el detalle completo de las 4 vistas que comparten esto.

/* Identidad visual por area (2026-09-02, a peticion explicita del usuario:
   "cada area conserve la misma estructura funcional, pero tenga identidad
   visual propia mediante icono especifico + color/acento propio" -- SOLO
   para las cards de nivel 1 de "Personal por area", nunca para las lineas
   individuales dentro de "Lineas de produccion" -- esas 10 son
   intercambiables entre si, no tiene sentido darles color distinto, y el
   pedido hablaba explicitamente de "cada area", no de cada linea).
   Iconos de lucide-react (ya la unica libreria de iconos del proyecto,
   nunca se agrega una nueva) elegidos por afinidad semantica con cada
   WORK_CENTER real de catalog.js. Solo cambia el circulo de icono -- la
   barra de cobertura sigue usando su propio color FUNCIONAL (verde/ambar
   segun %, ver coverageBarColor) para no mezclar una señal de estado real
   con un acento puramente decorativo. Cualquier id de area futuro que no
   este aqui cae al icono/color generico de siempre (Users/azul). */
const AREA_VISUALS = {
  LINEAS: { icon: Factory, bg: 'bg-blue-500/[0.12]', text: 'text-blue-500' },
  PALETIZADO: { icon: Warehouse, bg: 'bg-teal-500/[0.12]', text: 'text-teal-500' },
  ACCESORIOS: { icon: Wrench, bg: 'bg-purple-500/[0.12]', text: 'text-purple-500' },
  CONVEYOR_PRINCIPAL: { icon: Workflow, bg: 'bg-sky-500/[0.12]', text: 'text-sky-500' },
  HIGH_VALUE: { icon: Gem, bg: 'bg-rose-500/[0.12]', text: 'text-rose-500' },
  CALIDAD: { icon: BadgeCheck, bg: 'bg-emerald-500/[0.12]', text: 'text-emerald-500' },
  SELLADO: { icon: Stamp, bg: 'bg-indigo-500/[0.12]', text: 'text-indigo-500' },
  INSUMOS: { icon: Boxes, bg: 'bg-orange-500/[0.12]', text: 'text-orange-500' },
  CAPACITACION: { icon: GraduationCap, bg: 'bg-violet-500/[0.12]', text: 'text-violet-500' },
  TEAM_LEADER: { icon: UserCog, bg: 'bg-cyan-500/[0.12]', text: 'text-cyan-500' },
  ENTRENADOR: { icon: Dumbbell, bg: 'bg-fuchsia-500/[0.12]', text: 'text-fuchsia-500' },
  LIMPIEZA: { icon: Brush, bg: 'bg-emerald-600/[0.12]', text: 'text-emerald-600' },
  GERENTE: { icon: Crown, bg: 'bg-amber-500/[0.12]', text: 'text-amber-500' },
  SUPERVISOR: { icon: Eye, bg: 'bg-fuchsia-500/[0.12]', text: 'text-fuchsia-500' },
  SIN_AREA: { icon: HelpCircle, bg: 'bg-slate-500/[0.12]', text: 'text-slate-500' },
}
const DEFAULT_AREA_VISUAL = { icon: Users, bg: 'bg-blue-500/[0.12]', text: 'text-blue-500' }

/* Foto de empleado: reusa el EmployeeAvatar COMPARTIDO de Centro de
   Trabajo (23 consumidores en la app) en vez de una copia local -- ahora
   si tiene con que pintar una foto real, porque `person.photoUrl` ya
   viene resuelto desde REAL_PERSONNEL_SNAPSHOT/personnelByArea.js (ver
   comentario de `photoUrl` en realPersonnelSnapshot.js: extraida del
   Excel 2026-09-02). EmployeeAvatar ya cae solo a iniciales cuando
   `photoUrl` es null/undefined (personal "sem34-N", filas de BASE sin
   foto, o cualquier empleado creado despues) -- no hace falta repetir
   esa logica aqui. */
function EmployeeCard({ person, t }) {
  const status = attendanceStatusFor(person, t)
  return (
    <div className={cn(cardClass, 'p-2.5')}>
      <div className="flex items-start gap-2.5">
        <EmployeeAvatar employee={person} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-extrabold">{person.name}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{status.detail}</p>
          <div className="mt-1.5">
            <span className={metricChipClass(status.tone)}>{status.chip}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Tarjeta compacta para las 3 vistas planas (Registrados/Pendientes/
   Inasistencias) -- a diferencia de EmployeeCard (que usa
   attendanceStatusFor con los 2 estados historicos F/I/V/A), aqui el
   estado ya lo decidio quien arma la lista (siempre uno de los 3 estados
   "de hoy" reales: presente/pendiente/inasistencia), asi que el badge es
   fijo por lista. Muestra tambien numero de empleado + area/linea actual,
   pedido explicito del encargo. */
function FlatPersonCard({ person, badgeTone, badgeLabel, showTime, t }) {
  return (
    <div className={cn(cardClass, 'p-2.5')}>
      <div className="flex items-start gap-2.5">
        <EmployeeAvatar employee={person} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-extrabold">{person.name}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
            {formatEmployeeNumber(person.employeeNumber)} · {person._lineName || person._areaName}
          </p>
          {showTime && person.todayAssignment?.checkInAt && (
            <p className="truncate text-[11px] text-muted-foreground">
              {t('detailCheckedInAt', { time: person.todayAssignment.checkInAt })}
            </p>
          )}
          <div className="mt-1.5">
            <span className={metricChipClass(badgeTone)}>{badgeLabel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Cards de nivel 1 (grupos de area) y nivel 2 (lineas dentro de "Lineas de
   produccion") comparten el mismo diseño de tarjeta clicable -- mismo
   lenguaje visual que AuditModuleCard (AuditoriaPage.jsx) y las cards de
   "Areas de trabajo" del resto de Centro de Trabajo (cardClass, hover
   sutil, chip de conteo), ahora con la barra de cobertura que pide el
   mockup (verde/ambar/gris segun presentes-hoy / total-rastreado-hoy). */
function AreaCard({ name, count, present, total, onClick, visual = DEFAULT_AREA_VISUAL }) {
  const pct = coveragePctInt(present, total)
  const Icon = visual.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        cardClass,
        'flex cursor-pointer select-none flex-col gap-3 p-5 text-left transition-transform duration-150 hover:-translate-y-0.5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn('grid h-11 w-11 place-items-center rounded-2xl', visual.bg)}>
          <Icon className={cn('h-5 w-5', visual.text)} />
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[15px] font-extrabold">{name}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">{count}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn(progressBarClass, 'flex-1')}>
          <div
            className={cn('h-full rounded-full', coverageBarColor(present, total))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-[11px] font-bold text-muted-foreground">
          {pct}%
        </span>
      </div>
    </button>
  )
}

/* Mismo color FUNCIONAL de siempre (coverageBarColor: verde >=80%, ambar <80%/>0%, gris si
   total=0), en formato hex para poder pintar la pill superior con hexToRgba -- nunca un
   tercer umbral nuevo solo para esta pill, para no romper el criterio ya documentado arriba
   ("un solo umbral de color de cobertura en toda la pagina", decision explicita del rediseño
   2026-09-01). */
function coverageAccentColor(present, total) {
  if (total === 0) return '#94A3B8'
  return coveragePctInt(present, total) >= 80 ? '#10B981' : '#F59E0B'
}

/* Fila de 4 mini-indicadores (2026-09-02, a peticion explicita del usuario, mockup
   proporcionado) -- SOLO en las cards de nivel 1 ("Personal por area"), nunca en las cards
   de linea individual (mismo criterio ya aplicado al icono/color por area, ver AREA_VISUALS).
   Presentes/Pendientes/Inasistencias son EXACTAMENTE los mismos 3 conjuntos reales que ya
   usan las KPI/vistas planas de arriba (todayAssignment / !todayAssignment&&!absentIds /
   absentIds.has), nunca una cuarta fuente de datos inventada. "Sin marcar" es el remanente
   real (total - los otros 3) -- con el modelo de datos actual ese remanente SIEMPRE da 0,
   porque "pendientes" ya se define como "todo lo que no es presente ni inasistencia" (los 3
   conjuntos ya particionan el total exacto) -- el mismo caso que la KPI global de
   Inasistencias, cuyo subtitulo dice literalmente "Sin forma de marcar aun" mientras el
   valor sea 0. Se calcula como formula real (nunca un 0 fijo) para que, si el modelo de
   datos alguna vez agrega un cuarto estado real, este numero lo refleje solo. */
const MINI_INDICATOR_DEFS = [
  { key: 'presentes', icon: CheckCircle2, color: '#10B981', labelKey: 'miniPresentesLabel' },
  { key: 'pendientes', icon: Clock, color: '#F59E0B', labelKey: 'miniPendientesLabel' },
  { key: 'inasistencias', icon: CalendarX, color: '#EF4444', labelKey: 'miniInasistenciasLabel' },
  { key: 'sinMarcar', icon: CircleDashed, color: '#64748B', labelKey: 'miniSinMarcarLabel' },
]

function AreaCardDetailed({ name, stats, visual, onClick, t }) {
  const pct = coveragePctInt(stats.presentes, stats.total)
  const accent = coverageAccentColor(stats.presentes, stats.total)
  const Icon = visual.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        cardClass,
        'flex min-h-[164px] cursor-pointer select-none flex-col gap-3 p-4 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', visual.bg)}>
          <Icon className={cn('h-5 w-5', visual.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold leading-tight">{name}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">
            {t('peopleCount', { count: stats.total })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-extrabold"
            style={{ backgroundColor: hexToRgba(accent, 0.14), color: accent }}
          >
            {pct}%
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      </div>

      <div className={progressBarClass}>
        <div
          className={cn('h-full rounded-full', coverageBarColor(stats.presentes, stats.total))}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {MINI_INDICATOR_DEFS.map((def) => {
          const MiniIcon = def.icon
          return (
            <div
              key={def.key}
              className="flex flex-col items-center gap-0.5 rounded-lg py-1.5"
              style={{ backgroundColor: hexToRgba(def.color, 0.08) }}
            >
              <div className="flex items-center gap-1" style={{ color: def.color }}>
                <MiniIcon className="h-3 w-3 shrink-0" />
                <span className="text-[13px] font-extrabold leading-none">{stats[def.key]}</span>
              </div>
              <span className="truncate text-[9px] font-semibold leading-tight text-muted-foreground">
                {t(def.labelKey)}
              </span>
            </div>
          )
        })}
      </div>
    </button>
  )
}

function BackButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[12.5px] font-bold text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  )
}

/* KPI card clicable (5 en fila, mockup 1) -- icono en circulo suave arriba
   a la izquierda, chevron arriba a la derecha, numero grande + subtitulo
   gris abajo (mismo layout que AreaCard/GroupCard). `active` refleja
   `nav.mode` -- se resalta con el mismo token de "seleccionado" que
   pide la seccion de diseño (borde azul suave + fondo azul tenue), igual
   para las 5 cards y los 4 chips de abajo. */
function KpiCard({ icon: Icon, accent, value, subtitle, active, onClick, ariaLabel }) {
  const colors = KPI_ACCENTS[accent] || KPI_ACCENTS.blue
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        cardClass,
        'flex cursor-pointer select-none flex-col gap-3 p-5 text-left transition-transform duration-150 hover:-translate-y-0.5',
        active && ACTIVE_SELECTION_CLASS,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn('grid h-11 w-11 place-items-center rounded-2xl', colors.bg)}>
          <Icon className={cn('h-5 w-5', colors.text)} />
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[22px] font-extrabold leading-none">{value}</p>
        <p className="mt-1.5 text-[12px] font-semibold text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  )
}

function FilterChip({ label, dotClass, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
        active
          ? 'border-blue-400 bg-blue-500/[0.08] text-blue-700 dark:text-blue-300'
          : 'border-border text-muted-foreground hover:bg-accent',
      )}
    >
      {dotClass && <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} aria-hidden="true" />}
      {label}
    </button>
  )
}

/* Fila de la vista "Cobertura por area" -- ordenada de menor a mayor
   cobertura (pedido explicito), misma barra que AreaCard pero en
   formato de lista horizontal. */
function CoverageRow({ name, present, total, t }) {
  const pct = coveragePctInt(present, total)
  const complete = total > 0 && pct >= 100
  return (
    <div className={cn(cardClass, 'flex items-center gap-4 p-4')}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-extrabold">{name}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
          {t('coverageRatio', { present, total })}
        </p>
      </div>
      <div className="hidden w-32 shrink-0 sm:block">
        <div className={progressBarClass}>
          <div
            className={cn('h-full rounded-full', coverageBarColor(present, total))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="w-12 shrink-0 text-right text-[13px] font-extrabold">{pct}%</p>
      <p className="hidden w-36 shrink-0 text-right text-[11.5px] text-muted-foreground md:block">
        {complete ? t('coverageComplete') : t('coveragePartial')}
      </p>
    </div>
  )
}

export default function AsistenciaPage() {
  const { t } = useTranslation('asistencia')
  // Re-renderiza en cuanto un check-in/movimiento real cambia el store local
  // (mismo hook que usa el resto de Centro de Trabajo) -- version se pasa
  // como dependencia del useMemo de abajo; sin eso, marcar presente a
  // alguien desde Registro de personal (en este dispositivo o sincronizado
  // desde otro) no se reflejaria aqui hasta recargar la pagina.
  const version = usePersonnelVersion()

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza recalcular aunque no se lea en el callback (mismo patron en todo este folder)
  const groups = useMemo(() => {
    // getAssignmentsForDate (repository.js), NO Attendance local -- es la
    // unica de las dos que apiSync.js fusiona cross-device en cada poll de
    // 2s (ver pollOnce/writeAssignments), asi que es la fuente correcta
    // para "Presente hoy" sin importar en que dispositivo se hizo el
    // check-in.
    const assignmentsByEmployee = new Map(getAssignmentsForDate().map((a) => [a.employeeId, a]))
    const withPresence = (people) =>
      people.map((p) => ({ ...p, todayAssignment: assignmentsByEmployee.get(p.id) || null }))

    // Mismo patron exacto que getAllAreaSummaries() (personnelByArea.js):
    // solo una fila por area CANONICA activa, sumando via
    // operationalGroupMembers el personal de areas fusionadas/archivadas
    // (BOX_PREP/SUMINISTRO_MATERIAL -> INSUMOS, CONVEYOR_SECUNDARIO/SELLADO
    // -> CONVEYOR_PRINCIPAL) -- necesario para no "perder" a nadie que el
    // Excel ubico en una de esas zonas fusionadas.
    const canonicalAreas = WORK_CENTERS.filter(
      (w) => w.active !== false && canonicalOperationalAreaId(w.id) === w.id,
    )

    // Las 11 CT LINEA reales (LINEA1..10 + PROYECTO/CT LINEA 0) se agrupan
    // en una sola card de nivel 1 ("Lineas de produccion") -- mismo
    // LINE_FAMILY_AREA_IDS que ya usa AuditoriaPage.jsx para el mismo fin.
    // Cada linea individual sigue calculandose exactamente igual que
    // cualquier otra area (getGroupPeople + operationalGroupMembers +
    // withPresence), nunca una segunda fuente. Nunca se filtran las lineas
    // con 0 gente (mockup 3 confirma que WC LINEA 6 con 0 personas sigue
    // apareciendo como card).
    const lineWorkCenters = canonicalAreas.filter((w) => LINE_FAMILY_AREA_IDS.has(w.id))
    const lines = lineWorkCenters.map((w) => ({
      id: w.id,
      name: w.name,
      people: withPresence(getGroupPeople(operationalGroupMembers(w.id))),
    }))
    const linesTotalPeople = lines.reduce((sum, l) => sum + l.people.length, 0)

    const otherAreaGroups = canonicalAreas
      .filter(
        (w) => !LINE_FAMILY_AREA_IDS.has(w.id) && !EXCLUDED_FROM_PLANT_TOTAL_AREA_IDS.has(w.id),
      )
      .map((w) => ({
        id: w.id,
        kind: 'people',
        name: w.name,
        people: withPresence(getGroupPeople(operationalGroupMembers(w.id))),
      }))
      .filter((g) => g.people.length > 0)

    const areaGroups = []
    if (linesTotalPeople > 0) {
      areaGroups.push({
        id: 'LINEAS',
        kind: 'lines',
        name: t('groupLines'),
        lines,
        people: lines.flatMap((l) => l.people),
      })
    }
    areaGroups.push(...otherAreaGroups)

    // "Sin area asignada" (misma fuente que la card ya existente en Centro
    // de Trabajo, getPeopleWithoutArea) al final -- incluye tambien a quien
    // el Excel ubico en una zona archivada SIN fusion (ej. SOPORTE, ver
    // personnelByArea.getPeopleByArea: esas personas nunca quedan
    // "atrapadas" en un area que ya no se muestra en ningun lado).
    const sinArea = withPresence(getPeopleWithoutArea())
    if (sinArea.length > 0) {
      areaGroups.push({
        id: 'SIN_AREA',
        kind: 'people',
        name: t('areaSinAsignar'),
        people: sinArea,
      })
    }
    return areaGroups
  }, [t, version])

  // Universo "efectivo" de HOY, aplanado UNA sola vez sin duplicar a nadie
  // (LINEAS ya trae la suma de sus 11 lineas, nunca se vuelve a contar
  // linea por linea aqui) -- denominador real de "Personal registrado hoy"
  // (mockup: "de 131 programados") y base de las 4 vistas planas nuevas.
  // Cada persona se anota con a que area/linea (id + nombre) pertenece
  // para: (a) mostrarlo en las tarjetas de Registrados/Pendientes/
  // Inasistencias, (b) que el buscador pueda saltar directo a esa vista.
  const allPeopleFlat = useMemo(() => {
    const list = []
    groups.forEach((g) => {
      if (g.kind === 'lines') {
        g.lines.forEach((line) => {
          line.people.forEach((p) => {
            list.push({
              ...p,
              _areaName: g.name,
              _lineName: line.name,
              _groupId: g.id,
              _lineId: line.id,
            })
          })
        })
      } else {
        g.people.forEach((p) => {
          list.push({ ...p, _areaName: g.name, _lineName: null, _groupId: g.id, _lineId: null })
        })
      }
    })
    return list
  }, [groups])

  // biome-ignore lint/correctness/useExhaustiveDependencies: version fuerza releer el store sincronizado aunque no se lea en el callback (mismo patron que el useMemo de `groups`)
  const absentIds = useMemo(() => new Set(getAbsentEmployeeIds()), [version])

  const presentPeople = useMemo(
    () => allPeopleFlat.filter((p) => p.todayAssignment),
    [allPeopleFlat],
  )
  // Pendientes = universo total MENOS presentes MENOS inasistencias, pero
  // calculado por filtro (no por resta aritmetica) para que nunca se
  // cuente dos veces a nadie si algun dia una persona llegara a estar en
  // ambos conjuntos a la vez (inconsistencia de datos, hoy imposible
  // porque absentIds siempre esta vacio, pero el filtro es correcto de
  // cualquier forma).
  const pendingPeople = useMemo(
    () => allPeopleFlat.filter((p) => !p.todayAssignment && !absentIds.has(p.id)),
    [allPeopleFlat, absentIds],
  )
  const absentPeople = useMemo(
    () => allPeopleFlat.filter((p) => absentIds.has(p.id)),
    [allPeopleFlat, absentIds],
  )

  const totalPeople = allPeopleFlat.length
  const coverageOverallPct = coveragePctOneDecimal(presentPeople.length, totalPeople)

  // Cobertura por area (vista "Cobertura", 1 fila por card de nivel 1 --
  // Lineas de produccion cuenta como una sola fila agregada, nunca 11).
  const coverageByArea = useMemo(() => {
    return groups
      .map((g) => ({
        id: g.id,
        name: g.name,
        present: g.people.filter((p) => p.todayAssignment).length,
        total: g.people.length,
      }))
      .sort((a, b) => coveragePctInt(a.present, a.total) - coveragePctInt(b.present, b.total))
  }, [groups])

  // Desglose de 4 estados por area (2026-09-02, mini-indicadores de las cards de nivel 1) --
  // presentes/pendientes/inasistencias son EXACTAMENTE los mismos 3 filtros ya usados arriba
  // para presentPeople/pendingPeople/absentPeople (nunca una fuente nueva), solo aplicados al
  // subconjunto de personas de cada area en vez del universo completo. Ver comentario de
  // AreaCardDetailed sobre por que "sinMarcar" es un remanente real y no un 0 fijo.
  const areaStatsById = useMemo(() => {
    const map = new Map()
    for (const g of groups) {
      const total = g.people.length
      const presentes = g.people.filter((p) => p.todayAssignment).length
      const inasistencias = g.people.filter((p) => absentIds.has(p.id)).length
      const pendientes = g.people.filter((p) => !p.todayAssignment && !absentIds.has(p.id)).length
      const sinMarcar = Math.max(0, total - presentes - pendientes - inasistencias)
      map.set(g.id, { total, presentes, pendientes, inasistencias, sinMarcar })
    }
    return map
  }, [groups, absentIds])

  // Navegacion local (2026-09-02, sin router nuevo): `mode` distingue la
  // jerarquia real de areas (browse, con level groups -> lines -> people)
  // de las 4 vistas planas nuevas (presentToday/pending/absences/coverage)
  // que abren las KPI cards/chips. `groupId`/`lineId` se resuelven contra
  // `groups` en cada render, nunca se guarda una copia del objeto (asi
  // siempre reflejan el useMemo mas reciente).
  const [nav, setNav] = useState({ mode: 'browse', level: 'groups', groupId: null, lineId: null })
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => dayjs().format('HH:mm'))

  // "Ultima actualizacion" real -- se recalcula cada vez que la version del
  // store local cambia (mismo evento que ya dispara el recalculo de
  // `groups` arriba), nunca un texto relativo inventado.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe correr cuando version cambia
  useEffect(() => {
    setLastUpdated(dayjs().format('HH:mm'))
  }, [version])

  const selectedGroup = groups.find((g) => g.id === nav.groupId) || null
  const selectedLine =
    selectedGroup?.kind === 'lines'
      ? selectedGroup.lines.find((l) => l.id === nav.lineId) || null
      : null

  function goToGroups() {
    setNav({ mode: 'browse', level: 'groups', groupId: null, lineId: null })
  }

  function openGroup(group) {
    if (group.kind === 'lines') {
      setNav({ mode: 'browse', level: 'lines', groupId: group.id, lineId: null })
    } else {
      setNav({ mode: 'browse', level: 'people', groupId: group.id, lineId: null })
    }
  }

  function openLine(line) {
    setNav((prev) => ({ ...prev, mode: 'browse', level: 'people', lineId: line.id }))
  }

  function goToLines() {
    setNav((prev) => ({ mode: 'browse', level: 'lines', groupId: prev.groupId, lineId: null }))
  }

  function openMode(mode) {
    setNav({ mode, level: null, groupId: null, lineId: null })
  }

  function openPerson(person) {
    setQuery('')
    setSearchOpen(false)
    setNav({ mode: 'browse', level: 'people', groupId: person._groupId, lineId: person._lineId })
  }

  const peopleToShow = selectedLine ? selectedLine.people : selectedGroup?.people || []

  // La barra de herramientas (buscador + fecha + chips + "Actualizado") y
  // las 5 KPI cards solo se muestran en la Vista 1 (groups) y en los 4
  // modos especiales -- se ocultan en level 'lines'/'people' (mockups
  // 2/3/4: ahi solo "<- Volver a..." + titulo + grid, sin barra encima).
  const showToolbar = nav.mode !== 'browse' || nav.level === 'groups'

  // Indice de busqueda: areas (nivel 1, incluye "Lineas de produccion"),
  // lineas individuales y personas -- reconstruido solo cuando cambian los
  // datos reales (groups/allPeopleFlat), nunca hardcodeado.
  const searchIndex = useMemo(() => {
    const areaEntries = groups.map((g) => ({ kind: 'area', id: g.id, label: g.name, group: g }))
    const lineEntries = groups.flatMap((g) =>
      g.kind === 'lines'
        ? g.lines.map((l) => ({ kind: 'line', id: l.id, label: l.name, group: g, line: l }))
        : [],
    )
    const peopleEntries = allPeopleFlat.map((p) => ({ kind: 'person', id: p.id, person: p }))
    return [...areaEntries, ...lineEntries, ...peopleEntries]
  }, [groups, allPeopleFlat])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return searchIndex
      .filter((entry) => {
        if (entry.kind === 'person') {
          const p = entry.person
          return (
            p.name?.toLowerCase().includes(q) ||
            String(p.employeeNumber || '')
              .toLowerCase()
              .includes(q) ||
            p._areaName?.toLowerCase().includes(q) ||
            p._lineName?.toLowerCase().includes(q)
          )
        }
        return entry.label.toLowerCase().includes(q)
      })
      .slice(0, 8)
  }, [query, searchIndex])

  function selectSearchResult(entry) {
    setQuery('')
    setSearchOpen(false)
    if (entry.kind === 'area') {
      openGroup(entry.group)
    } else if (entry.kind === 'line') {
      setNav({ mode: 'browse', level: 'people', groupId: entry.group.id, lineId: entry.line.id })
    } else {
      openPerson(entry.person)
    }
  }

  return (
    <div className={pageClass}>
      <div className={cn(cardClass, 'mb-4')}>
        <div className="border-b border-border bg-black/[.015] px-5 py-3.5 dark:bg-white/[.02]">
          <p className={pageTitleClass}>{t('pageTitle')}</p>
          <p className={pageSubtitleClass}>{t('pageSubtitle')}</p>
        </div>
      </div>

      {showToolbar && (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Popover open={searchOpen && searchResults.length > 0} onOpenChange={setSearchOpen}>
              <PopoverAnchor asChild>
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('searchPlaceholder')}
                    value={query}
                    className="pl-9"
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setSearchOpen(true)
                    }}
                  />
                </div>
              </PopoverAnchor>
              <PopoverContent
                align="start"
                className="max-h-72 w-[var(--radix-popper-anchor-width)] overflow-y-auto p-1"
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                {searchResults.map((entry) => (
                  <button
                    key={`${entry.kind}-${entry.id}`}
                    type="button"
                    onClick={() => selectSearchResult(entry)}
                    className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                  >
                    {entry.kind === 'person' ? (
                      <>
                        <EmployeeAvatar employee={entry.person} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold">{entry.person.name}</p>
                          <p className="truncate text-[11px] opacity-60">
                            {formatEmployeeNumber(entry.person.employeeNumber)} ·{' '}
                            {entry.person._lineName || entry.person._areaName}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500/[0.12]">
                          <Users className="h-4 w-4 text-blue-500" />
                        </div>
                        <p className="truncate text-[13px] font-bold">{entry.label}</p>
                      </>
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <div className="flex flex-wrap items-center gap-2">
              {/* Selector de fecha: deliberadamente informativo, NO
                  funcional -- la arquitectura actual de datos solo calcula
                  HOY (ver nota grande arriba). */}
              <span
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[12.5px] font-semibold text-muted-foreground"
                title={t('dateSelectorAriaLabel')}
              >
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                {t('dateTodayLabel')} · {dayjs().format('DD/MM/YYYY')}
              </span>
              <FilterChip
                label={t('chipAll')}
                active={nav.mode === 'browse'}
                onClick={goToGroups}
              />
              <FilterChip
                label={t('chipPresent')}
                dotClass="bg-emerald-500"
                active={nav.mode === 'presentToday'}
                onClick={() => openMode('presentToday')}
              />
              <FilterChip
                label={t('chipPending')}
                dotClass="bg-amber-500"
                active={nav.mode === 'pending'}
                onClick={() => openMode('pending')}
              />
              <FilterChip
                label={t('chipAbsences')}
                dotClass="bg-red-500"
                active={nav.mode === 'absences'}
                onClick={() => openMode('absences')}
              />
            </div>

            <p className="text-xs text-muted-foreground lg:ml-auto">
              {t('lastUpdated', { time: lastUpdated })}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              icon={Building2}
              accent="blue"
              value={groups.length}
              subtitle={t('kpiActiveAreasSubtitle')}
              active={nav.mode === 'browse'}
              onClick={goToGroups}
              ariaLabel={t('kpiActiveAreasLabel')}
            />
            <KpiCard
              icon={Users}
              accent="green"
              value={presentPeople.length}
              subtitle={t('kpiRegisteredSubtitle', { total: totalPeople })}
              active={nav.mode === 'presentToday'}
              onClick={() => openMode('presentToday')}
              ariaLabel={t('kpiRegisteredLabel')}
            />
            <KpiCard
              icon={Clock}
              accent="orange"
              value={pendingPeople.length}
              subtitle={t('kpiPendingSubtitle')}
              active={nav.mode === 'pending'}
              onClick={() => openMode('pending')}
              ariaLabel={t('kpiPendingLabel')}
            />
            <KpiCard
              icon={CalendarX}
              accent="red"
              value={absentPeople.length}
              subtitle={
                absentPeople.length === 0
                  ? t('kpiAbsenceSubtitleZero')
                  : t('kpiAbsenceSubtitleSome')
              }
              active={nav.mode === 'absences'}
              onClick={() => openMode('absences')}
              ariaLabel={t('kpiAbsenceLabel')}
            />
            <KpiCard
              icon={ChartPie}
              accent="blue"
              value={`${coverageOverallPct}%`}
              subtitle={t('kpiCoverageSubtitle', { count: presentPeople.length })}
              active={nav.mode === 'coverage'}
              onClick={() => openMode('coverage')}
              ariaLabel={t('kpiCoverageLabel')}
            />
          </div>
        </>
      )}

      <div className={cardClass}>
        <div className={cardHeaderClass}>
          <div className="min-w-0 flex-1">
            {nav.mode === 'browse' && nav.level === 'groups' && (
              <>
                <p className={cardHeaderTitleClass}>{t('tableTitle')}</p>
                <p className={cardHeaderSubtitleClass}>{t('tableSubtitle')}</p>
              </>
            )}
            {nav.mode === 'browse' && nav.level === 'lines' && selectedGroup && (
              <>
                <BackButton label={t('backToGroups')} onClick={goToGroups} />
                <p className={cn(cardHeaderTitleClass, 'mt-1')}>{selectedGroup.name}</p>
                <p className={cardHeaderSubtitleClass}>{t('linesSubtitle')}</p>
              </>
            )}
            {nav.mode === 'browse' && nav.level === 'people' && selectedGroup && (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <BackButton
                    label={selectedLine ? t('backToLines') : t('backToGroups')}
                    onClick={selectedLine ? goToLines : goToGroups}
                  />
                  <p className={cn(cardHeaderTitleClass, 'mt-1')}>
                    {selectedLine ? selectedLine.name : selectedGroup.name}
                  </p>
                  <p className={cardHeaderSubtitleClass}>
                    {t('peopleSubtitle', { count: peopleToShow.length })}
                  </p>
                </div>
                <span className={cn(metricChipClass('ok'), 'gap-1.5')}>
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                    aria-hidden="true"
                  />
                  {t('presentBadge', {
                    count: peopleToShow.filter((p) => p.todayAssignment).length,
                  })}
                </span>
              </div>
            )}
            {nav.mode === 'presentToday' && (
              <>
                <BackButton label={t('backToGroups')} onClick={goToGroups} />
                <p className={cn(cardHeaderTitleClass, 'mt-1')}>{t('viewPresentTitle')}</p>
                <p className={cardHeaderSubtitleClass}>
                  {t('viewPresentSubtitle', { count: presentPeople.length })}
                </p>
              </>
            )}
            {nav.mode === 'pending' && (
              <>
                <BackButton label={t('backToGroups')} onClick={goToGroups} />
                <p className={cn(cardHeaderTitleClass, 'mt-1')}>{t('viewPendingTitle')}</p>
                <p className={cardHeaderSubtitleClass}>
                  {t('viewPendingSubtitle', { count: pendingPeople.length })}
                </p>
              </>
            )}
            {nav.mode === 'absences' && (
              <>
                <BackButton label={t('backToGroups')} onClick={goToGroups} />
                <p className={cn(cardHeaderTitleClass, 'mt-1')}>{t('viewAbsencesTitle')}</p>
                <p className={cardHeaderSubtitleClass}>
                  {t('viewAbsencesSubtitle', { count: absentPeople.length })}
                </p>
              </>
            )}
            {nav.mode === 'coverage' && (
              <>
                <BackButton label={t('backToGroups')} onClick={goToGroups} />
                <p className={cn(cardHeaderTitleClass, 'mt-1')}>{t('viewCoverageTitle')}</p>
                <p className={cardHeaderSubtitleClass}>{t('viewCoverageSubtitle')}</p>
              </>
            )}
          </div>
        </div>

        <div className="p-4">
          {nav.mode === 'browse' &&
            nav.level === 'groups' &&
            (totalPeople === 0 ? (
              <EmptyState title={t('emptyStateTitle')} description={t('emptyStateDescription')} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                  <AreaCardDetailed
                    key={group.id}
                    name={group.name}
                    stats={areaStatsById.get(group.id)}
                    onClick={() => openGroup(group)}
                    visual={AREA_VISUALS[group.id] || DEFAULT_AREA_VISUAL}
                    t={t}
                  />
                ))}
              </div>
            ))}

          {nav.mode === 'browse' && nav.level === 'lines' && selectedGroup && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {selectedGroup.lines.map((line) => (
                <AreaCard
                  key={line.id}
                  name={line.name}
                  count={t('peopleCount', { count: line.people.length })}
                  present={line.people.filter((p) => p.todayAssignment).length}
                  total={line.people.length}
                  onClick={() => openLine(line)}
                />
              ))}
            </div>
          )}

          {nav.mode === 'browse' &&
            nav.level === 'people' &&
            (peopleToShow.length === 0 ? (
              <EmptyState title={t('emptyStateTitle')} description={t('emptyStateDescription')} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {peopleToShow.map((person) => (
                  <EmployeeCard key={person.id} person={person} t={t} />
                ))}
              </div>
            ))}

          {nav.mode === 'presentToday' &&
            (presentPeople.length === 0 ? (
              <EmptyState title={t('emptyStateTitle')} description={t('emptyStateDescription')} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {presentPeople.map((person) => (
                  <FlatPersonCard
                    key={person.id}
                    person={person}
                    badgeTone="ok"
                    badgeLabel={t('statusPresentToday')}
                    showTime
                    t={t}
                  />
                ))}
              </div>
            ))}

          {nav.mode === 'pending' &&
            (pendingPeople.length === 0 ? (
              <EmptyState title={t('emptyStateTitle')} description={t('emptyStateDescription')} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pendingPeople.map((person) => (
                  <FlatPersonCard
                    key={person.id}
                    person={person}
                    badgeTone="warn"
                    badgeLabel={t('badgePending')}
                    showTime={false}
                    t={t}
                  />
                ))}
              </div>
            ))}

          {nav.mode === 'absences' &&
            (absentPeople.length === 0 ? (
              <EmptyState
                title={t('viewAbsencesEmptyTitle')}
                description={t('viewAbsencesEmptyDescription')}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {absentPeople.map((person) => (
                  <FlatPersonCard
                    key={person.id}
                    person={person}
                    badgeTone="bad"
                    badgeLabel={t('badgeAbsence')}
                    showTime={false}
                    t={t}
                  />
                ))}
              </div>
            ))}

          {nav.mode === 'coverage' && (
            <div className="flex flex-col gap-2.5">
              {coverageByArea.map((area) => (
                <CoverageRow
                  key={area.id}
                  name={area.name}
                  present={area.present}
                  total={area.total}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
