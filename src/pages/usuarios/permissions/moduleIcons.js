import {
  Activity,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  Factory,
  HelpCircle,
  LayoutDashboard,
  Map as MapIcon,
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
}

export function getModuleIcon(iconKey) {
  return ICONS[iconKey] || HelpCircle
}
