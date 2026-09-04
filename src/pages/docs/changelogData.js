// Changelog -- espejo estructurado de CHANGELOG.md (MI Stack Reference,
// HARD RULE) para mostrarlo dentro de la app en /changelog. Si CHANGELOG.md
// cambia, este archivo debe actualizarse en el mismo PR (igual convención
// que developerManualData.js con server-lib/db/schema.ts).
//
// Textos traducibles en public/locales/*/docs.json (namespace "docs",
// sub-objeto "changelogData") -- este archivo solo guarda estructura/IDs
// estables (versionKey/sectionKey/itemKeys).

export const RELEASES = [
  {
    version: 'Unreleased',
    titleKey: 'unreleasedTitle',
    descriptionKey: 'unreleasedDescription',
    sections: [
      {
        labelKey: 'sectionAdded',
        itemKeys: [
          'addedPnpm',
          'addedBiome',
          'addedTsconfig',
          'addedSentry',
          'addedManuals',
          'addedChangelog',
          'addedDrizzle',
          'addedI18n',
          'addedTailwind',
          'addedCoolify',
          'addedPersonnelSync',
          'addedProcessManuals',
          'addedFiveSAudit',
          'addedProcessAudit',
          'addedCalidadManual',
          'addedDemorasPlaneacion',
        ],
      },
      {
        labelKey: 'sectionChanged',
        itemKeys: [
          'changedFormat',
          'changedPersonalTab',
          'changedFiveSIntro',
          'changedAreaColors',
          'changedSidebar',
          'changedAsistenciaAreas',
        ],
      },
      {
        labelKey: 'sectionPending',
        itemKeys: ['pendingSso'],
      },
    ],
  },
  {
    version: '1.0.0',
    titleKey: null,
    descriptionKey: 'v100Description',
    sections: [],
  },
]
