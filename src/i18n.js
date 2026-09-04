// Andamiaje i18n (MI Stack Reference, sección 10, HARD RULE) -- Fase 4 de
// la migración de compliance. Trilingüe: en (fallback técnico), es-MX
// (idioma real del personal de piso), zh-CN. namespaces: common,
// navigation, auth, centroTrabajo (2026-08-29, primera carpeta real que
// extrae su contenido -- una clave por archivo fuente, ver
// public/locales/*/centroTrabajo.json). en/zh-CN de centroTrabajo.json
// se quedan vacios a proposito hasta que alguien los traduzca de verdad
// -- fallbackLng='es-MX' hace que cualquier clave faltante en esos 2
// idiomas se vea en español mientras tanto, nunca una clave cruda ni un
// texto vacío. layout (2026-08-29, mismo patron, src/layout/AppLayout.jsx,
// HeaderUserActions.jsx, NotificationBell.jsx -- ver
// public/locales/*/layout.json) sigue exactamente la misma convencion:
// en/zh-CN vacios a proposito, es-MX con el contenido real.
//
// Idioma por defecto = es-MX, NO el que detecte el navegador: el personal
// de piso habla español, y la mayoría de los dispositivos en producción
// nunca cambiaron su idioma del sistema -- dejar que el navegador decida
// arriesgaba mostrar inglés/otro idioma a alguien que nunca lo pidió.
// `order: ['localStorage']` (sin 'navigator') es justo por eso: la ÚNICA
// forma de salir de es-MX es que alguien lo cambie explícitamente con el
// selector (persiste en localStorage) -- nunca automático.
//
// fallbackLng también es 'es-MX' (no 'en'): si algún día una traducción
// queda incompleta en otro idioma, es más útil que el texto faltante
// aparezca en español (el idioma real de la mayoría) que en inglés.
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'es-MX',
    supportedLngs: ['es-MX', 'en', 'zh-CN'],
    ns: [
      'common',
      'navigation',
      'auth',
      'centroTrabajo',
      'layout',
      'dashboard',
      'usuarios',
      'registroPersonal',
      'docs',
      'repository',
      'app',
      'catalog',
      'dataLayer',
      'auditoria',
      'kpis',
      'evaluaciones',
      'asistencia',
      'produccionFft',
      'demoras',
      'controlEquipo',
    ],
    defaultNS: 'common',
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'fft_language',
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })

export default i18n
