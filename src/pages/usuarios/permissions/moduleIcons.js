import {
  Activity,
  Ban,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  ClipboardCheck,
  Code2,
  Factory,
  Gauge,
  HelpCircle,
  History,
  Hourglass,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  Star,
  UserPlus,
  Users,
} from 'lucide-react'

// Mapea el string `icon` de MODULE_REGISTRY (shared/moduleRegistry.js) al
// componente Lucide real -- el registro no puede importar JSX (debe ser
// importable tambien desde Node/api), asi que la traduccion vive aqui.
// Fase 6c: mismos iconos que ya eligio Sidebar.jsx para cada modulo
// (Dashboard/Factory/PersonAddAlt1/Group/QueryStats/EventAvailable/
// FactCheck), para no tener dos mapeos MUI->Lucide distintos del mismo
// concepto en la app.
// 2026-09-04 (rediseño de sidebar): BookOpen/Code2/History se agregan para
// Manual de Usuario/Developer Manual/Cambios, que ahora tambien viven en
// MODULE_REGISTRY -- mismos iconos que Sidebar.jsx ya usaba para ellos.
const ICONS = {
  Dashboard: LayoutDashboard,
  Factory: Factory,
  PersonAddAlt1: UserPlus,
  Group: Users,
  Map: MapIcon,
  QueryStats: BarChart3,
  EventAvailable: CalendarCheck,
  FactCheck: ClipboardCheck,
  Activity: Activity,
  BookOpen: BookOpen,
  Code2: Code2,
  History: History,
  Star: Star,
  Hourglass: Hourglass,
  CalendarRange: CalendarRange,
  Network: Network,
  Ban: Ban,
  Gauge: Gauge,
}

export function getModuleIcon(iconKey) {
  return ICONS[iconKey] || HelpCircle
}
