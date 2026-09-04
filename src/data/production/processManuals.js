/* Manuales de proceso reales de WC LINEA 0..10 (2026-09-03, a peticion explicita del usuario) --
   extraidos TAL CUAL (con imagenes, sin editar nada) de "manual de fft tv.docx" via exportacion a
   PDF por rango de paginas real del documento (Word, ExportAsFixedFormat). Cada PDF vive en
   public/manuals/ (servido estatico, igual que public/personnel-photos/) y se asocia por el
   `role` REAL de la estacion (LINE_BASE_ROLES / 'Empaque' en
   src/data/personnel/workstations.js) -- nunca por el nombre visible con sufijo numerico
   ("Etiquetado 2" sigue siendo role='Etiquetado').

   Paginas de origen en el documento completo (referencia, no se muestra en la UI):
     Prueba eléctrica -> hojas 18-25
     Limpieza de TV   -> hojas 26-27
     Empaque          -> hojas 28-39
     Etiquetado       -> hojas 40-49

   2026-09-04 (a peticion explicita del usuario, mismo mecanismo): Calidad usa un documento
   PROPIO real -- "SOP-MTY-FFT-QA-001_v1.0.0.pdf" (SOP oficial de Calidad, 8 paginas), copiado
   TAL CUAL a public/manuals/calidad.pdf -- no es un recorte de "manual de fft tv.docx" como los
   otros 4, es su propio PDF de origen completo. */
export const PROCESS_MANUALS = {
  'Prueba eléctrica': '/manuals/prueba-electrica.pdf',
  'Limpieza de TV': '/manuals/limpieza-de-tv.pdf',
  Empaque: '/manuals/empaque.pdf',
  Etiquetado: '/manuals/etiquetado.pdf',
  Calidad: '/manuals/calidad.pdf',
}

export function processManualForRole(role) {
  return PROCESS_MANUALS[role] || null
}
