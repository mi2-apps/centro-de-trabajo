/* ────────────────────────────────────────────
   Snapshot REAL de personal. La base son las 116 filas extraidas de
   LAYOUT FFT.xlsx (hoja BASE) el 2026-08-18, ninguna inventada
   (ids "base-N"). A partir del 2026-08-20 se agregaron ademas
   personas que SOLO existen en "ASISTENCIA FFT SEM 34.xlsx" y no
   tenian ninguna fila equivalente en BASE (ids "sem34-N") — ver mas
   abajo.

   - name: EMPLEADO tal como viene en el Excel (Title Case para lectura).
   - areaZona: ZONA normalizada al catalogo de areas (catalog.js). null si
     no se conoce una zona para esa persona (ausente/sin ubicacion actual).
   - rawZona: ZONA exactamente como aparece en el Excel de origen, sin
     normalizar (ej. "ACCESORIOS3", "CALIDAD11", "Chofer") — se conserva
     para no perder informacion, aunque areaZona ya la agrupo razonablemente.
   - actividad/asistencia: codigos crudos de BASE (2026-08-18), SIN
     interpretar significado. Solo existen para gente "base-N"; el
     personal "sem34-N" no participo del snapshot de BASE, por lo que
     no tiene estos dos campos.
   - fechaIngreso: fecha de ingreso tal como viene en SEM 34 ("DD/MM/AAAA"),
     sin interpretar. null cuando SEM 34 no la trae para esa persona.
   - photoUrl (2026-09-02): foto real de la persona, extraida de la columna
     FOTO de "BASE " -- ahi la foto esta incrustada como imagen "en celda"
     (funcion moderna de Excel 365), no como texto/URL, por eso ninguna
     lectura anterior del Excel la habia visto. Extraida una sola vez con
     scripts/extract-personnel-photos-2026-09-02.mjs a
     public/personnel-photos/base-N.jpg (N = numero de fila de BASE, mismo
     indice que ya usa el id "base-N" de este archivo). Solo 99 de los ids
     "base-N" que sobreviven en este archivo tienen foto extraida (algunas
     filas de BASE no traian foto -- 1 caso real -- y otras filas SI tenian
     foto pero su id ya no existe aqui por ser un duplicado/fantasma
     borrado en rondas anteriores, ver historial arriba). Nadie mas
     (ids "sem34-N", empleados creados despues) tiene esta propiedad --
     no hay foto de origen para ellos, se muestran con iniciales
     (EmployeeAvatar.jsx ya maneja photoUrl ausente).

   BASE no tiene columna de numero de empleado. El cruce contra SEM 34
   ("Asistencia FFT SEM 34", semana del 17-21/08/2026) se hizo en 3
   rondas (scripts/_match-employee-numbers-tmp.mjs, _match2-tmp.mjs y
   _apply-sem34-roster-tmp.mjs, todos temporales, no versionados). Solo
   se agrego `employeeNumber`/nombre completo cuando la coincidencia
   fue INEQUIVOCA: un unico candidato con ese nombre, validado por area
   compatible entre ambas hojas Y/O por el codigo de asistencia del
   18/08 coincidiendo en ambas hojas. `employeeNumber` solo se puso
   cuando SEM 34 tenia numero real (no "Proyecto"/"Nuevo"/vacio); si el
   nombre quedo confirmado pero sin numero real todavia, se actualizo
   solo el nombre (y ahora tambien la fecha de ingreso, si la hay).

   Ronda 1: 42 de 116 resueltos (nombre + numero).
   Ronda 2: 22 mas (8 con numero real + nombre, 14 solo nombre completo).
   Ronda 3 (2026-08-20, con la lista completa de SEM 34 nombre+numero+
   fecha de ingreso que dio el usuario): 19 resoluciones nuevas +
   fecha de ingreso para 76 personas (66 via numero de empleado ya
   conocido, 10 a mano para quienes SEM 34 aun no trae numero real) +
   20 personas agregadas que NO estaban en BASE (ids "sem34-1".."sem34-20":
   la mayoria en "Produccion" generico, sin decir que linea especifica,
   por eso su areaZona queda como texto libre "PRODUCCION" en vez de
   inventar una linea — no aparecen en el layout, solo en el modulo de
   Personal).

   Ronda 4 (2026-08-21, a peticion del usuario de "agregar a todos los
   de semana 34" y revisar "LAYOUT FFT.xlsx" por si mostraba donde esta
   cada quien mas habitualmente): se releyo LAYOUT FFT.xlsx completo,
   las 3 hojas (LAYOUT, "BASE ", BAJAS). La hoja "LAYOUT" es un dibujo
   visual del piso que solo REPRODUCE la misma pareja ZONA+EMPLEADO que
   ya trae la hoja BASE (se verifico cruzando varias posiciones
   contra los datos ya importados — coinciden exactamente, ej. los 7
   nombres bajo "LINEA 1" son los mismos 7 que ya tienen areaZona
   LINEA 1 aqui) — NO trae una columna ni señal nueva para saber cual
   "Luis"/"Juan"/"Ricardo"/"Jesus" especifico es cual: sigue siendo el
   mismo primer nombre repetido, sin apellido, en ambas hojas. Por eso
   NO se pudo desambiguar ningun caso adicional de nombre repetido con
   este archivo — no se inventa ni se adivina cual es cual.
   Se releyo tambien "ASISTENCIA FFT SEM 34.xlsx" completo (las 113
   filas de la hoja "Asistencia FFT SEM 34", con TODAS sus columnas de
   dia 17-21/08, no solo el 18/08) y se comparo cada fila (por numero
   y por nombre exacto) contra este snapshot: de las 113, 105 ya
   estaban capturadas de rondas anteriores; las 8 que faltaban eran
   exactamente las mismas 7 personas "baja" de mas abajo (con
   evidencia fuerte otra vez, sin tocarlas, mismo motivo que antes) +
   1 caso nuevo real: "Sandra" (base-56, ACCESORIOS) se resolvio a
   Sandra Iveth Barrón Marinez (#2446, Accesorios, unico candidato sin
   ambiguedad). Con esto, TODAS las filas de SEM 34 semana 34 quedan
   reflejadas en este snapshot (via numero, nombre, o la excepcion de
   baja) — no quedo ninguna persona de esa hoja sin capturar.
   Total resuelto con nombre/numero: 84 de 136 (el total de personas
   no cambio esta ronda, solo se completo a Sandra). Quedan sin este dato
   los ~24 casos de BASE cuyo nombre corto es ambiguo (varios
   "Luis"/"Juan"/"Ricardo"/"Jesus"/"Alfredo"/etc. con mas de un
   candidato posible en SEM 34): en TODOS esos casos, el/los
   candidato(s) de SEM 34 con ese nombre YA se agregaron como personas
   nuevas separadas (ids "sem34-N", rondas 3-4, ver el bloque de mas
   abajo) porque no habia forma segura de saber a cual "base-N"
   especifico correspondia cada uno — reabrir esa asignacion ahora
   seria adivinar, no se hace. Es decir, esas personas de SEM 34 SI
   estan en el sistema, solo que como registro nuevo aparte en vez de
   completar el nombre corto de BASE.

   Hallazgo informativo de la hoja BAJAS de LAYOUT FFT.xlsx (13
   nombres sueltos marcados "BAJA" con fecha, sin apellido ni numero,
   por lo que NO se pudo cruzar con certeza contra nadie de este
   snapshot): coincide en primer nombre con varios casos ya conocidos
   o sospechados — "JOSE" (refuerza la anomalia ya detectada en Ronda
   1/2 de que Jose Sanchez/base-74/#3981 aparecia con "Baja" el 19/08
   en SEM 34), y ademas "ANTONIO", "ALEXIS", "JESUS" (x2), "BRAYAN" —
   pero como la hoja BAJAS no trae apellido ni numero, esto es solo
   una señal debil, no una confirmacion: NO se desactivo ni se toco a
   nadie por esto (base-17 Antonio Rocha Ipiña, base-116 Alexis,
   base-18/base-20 Jesus, base-71/base-109 Brayan siguen exactamente
   igual). Queda anotado para que el usuario lo revise si quiere.

   Excepcion deliberada: 8 personas ("baja") se dejan SIN TOCAR a
   peticion explicita del usuario (2026-08-19, reconfirmado 2026-08-20
   pese a que la lista de SEM 34 trae evidencia fuerte — nombre+numero+
   fecha — para 5 de las 8): Miguel/base-11, Reynaldo/base-12,
   Daniela/base-31, Socorro/base-32, Marco/base-65, Olga/base-66,
   Janeth/base-87, Jonhatan/base-107. No se debe reabrir esto sin que
   el usuario lo confirme.

   Resolucion 2026-08-24: el usuario reabrio esto explicitamente y pidio
   marcar formalmente estos 8 como BAJA (campo `status: "BAJA"`) en vez
   de dejarlos ambiguos/invisibles. El usuario paso una lista de roster
   nueva que traia numero de empleado + fecha de ingreso + area/puesto
   historico para 6 de los 8 (Miguel/base-11, Reynaldo/base-12,
   Socorro/base-32, Marco/base-65, Olga/base-66, Janeth/base-87,
   Jonhatan/base-107) — se completaron esos campos con esa info nueva.
   Daniela/base-31 se queda exactamente igual que antes (sin numero ni
   fecha) porque la unica "Daniela" de esa lista nueva (#3914, Daniela
   Ivonee Aguilar Sanchez) resulto ser una persona real DISTINTA, ya
   resuelta como base-92 en CALIDAD — no se le atribuyo esa info a la
   Daniela de baja por error. Ninguno de los 8 tiene `areaZona` real
   (sigue null o texto libre que no mapea a ningun catalog.js), nunca
   son asignables/colocables — ahora tienen una pestaña dedicada de solo
   lectura en Centro de Trabajo ("Bajas") en vez de estar simplemente
   ausentes de todo. Ver tambien: al revisar esta misma lista nueva se
   llenaron datos que faltaban (sin ser "baja") para Ramiro Aguilar
   Rubio/base-16, Antonio Rocha Ipiña/base-17 (la señal debil de baja
   de mas arriba se descarto explicitamente por el usuario: esta
   persona SI esta disponible), Rosa Maria Rodriguez Cruz/base-3,
   Valentin Cruz Martinez/base-34, Juan Eduardo Cuellar Ruiz/base-48,
   Kevin Alejandro Cira Ramirez/base-54, Wiliams de la Cruz/base-72,
   Jose Sanchez/base-74 (misma decision explicita: disponible, no baja,
   pese a la señal debil de la hoja BAJAS anotada arriba) y Angel
   Ricardo Flores Vargas/base-108 — todos con `areaZona` generico
   PRODUCCION o PALETIZADO segun lo que decia esa lista, nunca una linea
   especifica que esa lista no traia. No se tocaron Francisca Elizabeth
   Delgado Perez/base-8 (SOPORTE), Angel Jovani Cruz Biviano/base-96
   (DMT), Daniela Ivonee Aguilar Sanchez/base-92 (CALIDAD) ni Estime
   Blaise/base-104 (SOPORTE): ya tenian un area real mas especifica que
   la etiqueta generica de la lista nueva, se dejaron intactos.

   Areas nuevas "Chofer" e "Ingenieria" (SEM 34): por decision del
   usuario (2026-08-20) NO tienen bloque de layout — el personal ahi
   es elegible y buscable en el modulo de Personal, pero no aparece en
   el plano visual (areaZona no coincide con ningun id de catalog.js).

   "Roman Herrera de Leon" #3647 (area "Practicante" en SEM 34) es el
   usuario administrador de la app, no personal de piso — se excluye
   siempre de cualquier cruce (nunca se le asigna a "base-101 Roman",
   que es una persona real distinta de Paletizado).

   Investigacion 2026-08-24 (a peticion del usuario, que reporto un
   conteo real esperado de ~113 personas contra las 136 de este
   snapshot): se revisaron TODOS los casos de nombre corto ambiguo en
   BASE (Juan/Luis/Ricardo/Jesus/Gustavo/Alfredo/Alexis/Jhony/Carlos +
   los 6 nombres sueltos de CALIDAD: Alondra/Beckham/Patricia/
   Gabriela/Jeser/Jonathan) contra cada candidato "sem34-N" con el
   mismo primer nombre, buscando una fusion segura. Resultado: NINGUNA
   fusion cumplio la misma barra de confianza ya usada en las rondas
   1-4 de este archivo (candidato UNICO en ambos lados + area
   compatible o codigo de asistencia coincidente) —
   - Juan: 4 candidatos ambiguos en BASE (base-13/45/62/111) vs 3 en
     sem34 (sem34-8/17/18). Multiples-a-multiples, sin forma de saber
     cual es cual.
   - Luis: 3 en BASE (base-47/51/95) vs 3 en sem34 (sem34-14/15/16).
     Mismo problema.
   - Ricardo: 2 en BASE (base-40 LINEA0/base-44 LINEA7) vs 2 en sem34
     (sem34-9/19), ambos sem34 con area generica PRODUCCION que no
     distingue cual linea es cual.
   - Jesus: 2 en BASE (base-18 LINEA0/base-20 LINEA1) vs 1 en sem34
     (sem34-20/Jesus Perez Cruz/#3251) — un solo candidato sem34 no
     resuelve CUAL de los 2 de BASE es, si acaso alguno.
   - Gustavo: base-49 (LINEA4) es candidato plausible de sem34-5 (Jose
     Gustavo Aguilar Corpus, PRODUCCION generico) por apodo, pero sin
     numero/codigo que lo confirme y el area generica no corrobora
     especificamente LINEA4 — confianza media, no se fusiona.
   - Alexis: base-116 (CAJAS) es el UNICO candidato de BASE y sem34-7
     (Alexis Garcia Garcia, PRODUCCION) el UNICO de sem34 para ese
     nombre, pero sus areas se CONTRADICEN (CAJAS vs PRODUCCION) en vez
     de corroborarse — evidencia en contra de fusionar, no a favor.
     (Ver tambien la señal debil de la hoja BAJAS ya anotada arriba
     para este mismo base-116.)
   - Alfredo/Jhony/Carlos y los 6 nombres sueltos de CALIDAD: cero
     candidatos sem34 con ese nombre — no hay nada con que fusionar.
   Conclusion original (superada por la limpieza de abajo, se deja el
   razonamiento intacto por historial): la brecha de ~23 personas entre
   este snapshot (136) y el conteo real que espera el usuario (~113) NO
   se explica de forma segura por duplicados entre BASE y SEM 34 con la
   informacion ya importada — de existir duplicados reales aqui,
   desambiguarlos necesitaria un dato nuevo (numero de empleado real o
   apellido) que ninguna de las dos hojas ya leidas aporta. No se
   fusiono ni se borro ningun registro en esa ronda.

   Limpieza de entradas fantasma 2026-08-24 (a peticion explicita del
   usuario, "si porfa"): el paso anterior solo cruzo los nombres cortos
   ambiguos entre si (BASE vs SEM 34); esta vez se uso la lista de RH
   completa que dio el usuario (113 filas / 112 personas unicas — "Luis
   Hernandez Hernandez #2663" viene repetido dos veces en esa lista, un
   duplicado inofensivo del propio documento) como fuente de verdad
   contra las 136 entradas de este snapshot: 111 confirmadas por esa
   lista, 25 sin ninguna fila correspondiente. De esas 25, 2 ya estaban
   explicadas (Daniela/base-31, de baja, sin fila en la lista nueva
   porque el "#3914" de esa lista es una persona real distinta ya
   resuelta como base-92; y "Roman"/base-101, una persona real de
   Paletizado, no el administrador). Las otras 23 SI se confirmaron
   como ruido: exactamente 136 − 23 = 113, el numero que esperaba el
   usuario. Se eliminaron por completo (sin fila en la lista de RH Y
   ya documentadas como nombre corto ambiguo sin forma de desambiguar,
   rondas 1-4 y la investigacion de arriba): base-13 ("Juan Dd"),
   base-18/base-20 ("Jesus" x2), base-40/base-44 ("Ricardo" x2),
   base-45/base-62 ("Juan" x2 de esa pareja), base-47/base-51/base-95
   ("Luis" x3), base-49 ("Gustavo"), base-52 ("Alfredo"), base-53
   ("Jhony"), base-67 ("Carlos"), base-88 ("Alondra"), base-89
   ("Beckham"), base-90 ("Patricia" de CALIDAD — no confundir con la
   Patricia real de Accesorios, base-25, que sigue intacta), base-91
   ("Gabriela"), base-93 ("Jeser"), base-113 ("Kelly"), base-116
   ("Alexis"). Ademas, hallazgo nuevo de esta ronda: base-111 ("Juan
   B", sin area ni numero) se fusiono dentro de base-73 (Juan
   Bohorquez, #3818, Paletizado, ya confirmado real por la lista de
   RH) y se elimino como duplicado — nadie mas referenciaba ese id en
   el codigo (verificado con grep). NO se toco base-112 ("Jonathan",
   CALIDAD): es muy probablemente una persona real distinta que esa
   lista de RH simplemente no incluyo, no un duplicado. Total final:
   114 personas (136 − 22).

   Correccion 2026-08-24 (mismo dia, con el archivo real de RH
   "ASISTENCIA FFT SEM 34_PRO_AREAS.xlsx", hoja "SEM 34 POR AREA"):
   el "113" de la ronda anterior NO era el total real de la empresa —
   ese Excel solo cubre 12 categorias (Accesorios/Cajas/Paletizado/
   Produccion/Chofer/Limpieza/Lider/Team Leader/Practicante/
   Capacitacion/Supervision/Ingenieria) y NUNCA incluye Calidad,
   Soporte ni Gerente. Comparar 136 contra 113 fue peras con manzanas;
   la coincidencia numerica exacta de la ronda anterior fue casualidad.

   Con la asistencia real dia por dia (17-21/08) de ese Excel se
   corrigen los estados BAJA que se habian asignado sin esta evidencia:

   - Se QUITA el status BAJA (tenian asistencia real "OK" o permiso
     documentado, no un patron de baja) y se completa su areaZona con
     la que trae el Excel: base-65 Marco Antonio Andrade Garcia (2 OK +
     Vacaciones -> PRODUCCION), base-12 Reynaldo Hernandez Luciano (2 OK
     + Permiso -> PRODUCCION), base-87 Janeth Alejandra Rodriguez
     Mendoza (2 OK + Permiso -> CAJAS), base-32 Maria del Socorro Juarez
     Moreno (Incapacidad x3, permiso medico, no baja -> ACCESORIOS).
   - Se MANTIENEN sin cambio (el Excel confirma baja real): base-11
     Miguel Angel Ortega Martinez y base-107 Jonhatan Alfredo Gomez
     Trujillo (0 dias OK, codigo "Cambio" los 3 dias), base-66 Olga
     Lidia Lara Davila (codigo literal "Baja" el 19/08), base-31
     Daniela (no aparece en este Excel, sin evidencia nueva).
   - Se REVIERTE una decision de esta misma sesion (se habian marcado
     "disponibles" con areaZona PRODUCCION generico antes de tener este
     Excel; su fila real muestra el mismo patron de baja que Miguel/
     Jonhatan — 0 dias OK, codigo "Baja"/"Cambio" los 3 dias): base-48
     Juan Eduardo Cuellar Ruiz, base-3 Rosa Maria Rodriguez Cruz,
     base-16 Ramiro Aguilar Rubio, base-34 Valentin Cruz Martinez,
     base-54 Kevin Alejandro Cira Ramirez. Vuelven a `areaZona: null` +
     `status: "BAJA"`, igual que los demas de baja (nunca se borran,
     solo se marcan). Mismo patron confirmado por primera vez en
     sem34-6 Javier Aguilar De Dios (nunca se le habia puesto status
     antes) -> tambien BAJA.
   - Hueco real llenado (no tenia areaZona ni rawZona, sin relacion con
     baja, 2 dias OK reales en el Excel): base-69 Jesus David Hernandez
     Zuniga -> PRODUCCION.

   Verificado el resto de las 113 filas del Excel contra las 114 del
   snapshot: solo 4 mismatches, y los 4 ya estaban explicados y dejados
   intactos a proposito en la ronda anterior (el snapshot ya tenia un
   area mas especifica que el generico "Produccion" de este Excel):
   base-8 Francisca Elizabeth Delgado Perez (SOPORTE), base-92 Daniela
   Ivonee Aguilar Sanchez (CALIDAD), base-96 Angel Jovani Cruz Biviano
   (DMT), base-104 Estime Blaise (SOPORTE). Nuevo mismatch encontrado,
   NO resuelto (queda para que el usuario decida, no se adivina):
   base-103 Rodrigo Martinez Montes tiene areaZona SOPORTE ya asignado,
   pero el Excel lo pone en PRODUCCION generico. Calidad no aparece en
   este Excel (fuera de su alcance) — se confirmo que ningun CALIDAD
   real se toco en esta ronda.

   Correccion 2026-08-24 (mismo dia, encontrada por el coordinador
   antes de sincronizar la base de datos real): la "Limpieza de
   entradas fantasma" de mas arriba SI habia borrado 5 personas reales
   de CALIDAD por error — base-88 (Alondra), base-89 (Beckham), base-90
   (Patricia), base-91 (Gabriela), base-93 (Jeser). La logica de esa
   ronda ("sin fila en la lista de RH = fantasma") es INVALIDA para
   Calidad especificamente, porque ese Excel de RH nunca cubre Calidad
   sea real o no la persona — no es evidencia de nada para esa area.
   Se restauran las 5 con sus datos originales exactos, en su posicion
   original entre base-87 y base-94. Las otras 17 entradas eliminadas
   en esa misma ronda (todas de Produccion/Cajas/sin area — categorias
   que SI cubre el Excel de RH) siguen borradas, esa logica si aplica
   para ellas. Total final: 119 personas (114 + 5 restauradas). */

export const BASE_SNAPSHOT_DATE = '2026-08-18'

export const REAL_PERSONNEL_SNAPSHOT = [
  {
    id: 'base-1',
    photoUrl: '/personnel-photos/base-1.jpg',
    name: 'Aide Mendoza Gutierrez',
    areaZona: null,
    rawZona: 'LINEA 1',
    actividad: 'LC',
    asistencia: 'A',
  },
  {
    id: 'base-2',
    photoUrl: '/personnel-photos/base-2.jpg',
    employeeNumber: '3842',
    name: 'Thelma Virginia Rodriguez Cissneros',
    areaZona: null,
    rawZona: 'LINEA 0',
    actividad: 'LC',
    asistencia: 'A',
    fechaIngreso: '18/06/2026',
  },
  {
    id: 'base-3',
    photoUrl: '/personnel-photos/base-3.jpg',
    employeeNumber: '3591',
    name: 'Rosa Maria Rodriguez Cruz',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'LC',
    asistencia: 'F',
    fechaIngreso: '09/03/2026',
    status: 'BAJA',
  },
  {
    id: 'base-4',
    photoUrl: '/personnel-photos/base-4.jpg',
    employeeNumber: '3844',
    name: 'Ezelin del Carmen Bohorquez',
    areaZona: null,
    rawZona: 'LINEA 3',
    actividad: 'LC',
    asistencia: 'A',
    fechaIngreso: '18/06/2026',
  },
  {
    id: 'base-5',
    photoUrl: '/personnel-photos/base-5.jpg',
    name: 'Migdalia Georgina Ramirez Díaz',
    areaZona: null,
    rawZona: 'LINEA 2',
    actividad: 'LC',
    asistencia: 'A',
    fechaIngreso: '10/03/2026',
  },
  {
    id: 'base-6',
    photoUrl: '/personnel-photos/base-6.jpg',
    employeeNumber: '3866',
    name: 'Yailen Rodriguez Perez',
    areaZona: null,
    rawZona: 'LINEA 5',
    actividad: 'LC',
    asistencia: 'A',
    fechaIngreso: '29/06/2026',
  },
  {
    id: 'base-7',
    photoUrl: '/personnel-photos/base-7.jpg',
    employeeNumber: '3865',
    name: 'Yamilia Peraza Luna',
    areaZona: null,
    rawZona: 'LINEA 4',
    actividad: 'LC',
    asistencia: 'A',
    fechaIngreso: '29/06/2026',
  },
  {
    id: 'base-8',
    photoUrl: '/personnel-photos/base-8.jpg',
    employeeNumber: '3285',
    name: 'Francisca Elizabeth Delgado Perez',
    areaZona: null,
    rawZona: 'SOPORTE',
    actividad: 'LC',
    asistencia: 'A',
    fechaIngreso: '07/10/2025',
  },
  {
    id: 'base-9',
    photoUrl: '/personnel-photos/base-9.jpg',
    name: 'Angie Neil Garrido Castellanos',
    areaZona: null,
    rawZona: 'LINEA 1',
    actividad: 'LC',
    asistencia: 'A',
    fechaIngreso: '27/12/2024',
  },
  {
    id: 'base-10',
    photoUrl: '/personnel-photos/base-10.jpg',
    employeeNumber: '2871',
    name: 'Jose Alfredo Morales Reyes',
    areaZona: null,
    rawZona: 'LINEA 1',
    actividad: 'EM',
    asistencia: 'A',
    fechaIngreso: '08/05/2025',
  },
  {
    id: 'base-11',
    photoUrl: '/personnel-photos/base-11.jpg',
    employeeNumber: '3276',
    name: 'Miguel Angel Ortega Martinez',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'EM',
    asistencia: 'F',
    fechaIngreso: '13/10/2025',
    status: 'BAJA',
  },
  {
    id: 'base-12',
    photoUrl: '/personnel-photos/base-12.jpg',
    employeeNumber: '3754',
    name: 'Reynaldo Hernández Luciano',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'EM',
    asistencia: 'F',
    fechaIngreso: '03/02/2026',
  },
  {
    id: 'base-14',
    photoUrl: '/personnel-photos/base-14.jpg',
    employeeNumber: '2898',
    name: 'Saúl Santiago Hernandez',
    areaZona: null,
    rawZona: 'LINEA 3',
    actividad: 'EM',
    asistencia: 'A',
    fechaIngreso: '15/05/2025',
  },
  {
    id: 'base-15',
    photoUrl: '/personnel-photos/base-15.jpg',
    employeeNumber: '3939',
    name: 'Elian Isai Rosas Regalado',
    areaZona: null,
    rawZona: 'LINEA 4',
    actividad: 'EM',
    asistencia: 'A',
    fechaIngreso: '28/07/2026',
  },
  {
    id: 'base-16',
    photoUrl: '/personnel-photos/base-16.jpg',
    name: 'Ramiro Aguilar Rubio',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'EM',
    asistencia: 'F',
    fechaIngreso: '08/06/2026',
    status: 'BAJA',
  },
  {
    id: 'base-17',
    photoUrl: '/personnel-photos/base-17.jpg',
    name: 'Antonio Rocha Ipiña',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'EM',
    asistencia: 'F',
  },
  {
    id: 'base-19',
    photoUrl: '/personnel-photos/base-19.jpg',
    employeeNumber: '3499',
    name: 'Pedro Alejandrez Quintero',
    areaZona: null,
    rawZona: 'LINEA 0',
    actividad: 'EM',
    asistencia: 'A',
    fechaIngreso: '04/12/2025',
  },
  {
    id: 'base-21',
    photoUrl: '/personnel-photos/base-21.jpg',
    employeeNumber: '3372',
    name: 'Diego Alberto Tamez Vazquez',
    areaZona: null,
    rawZona: 'LINEA 5',
    actividad: 'EM',
    asistencia: 'A',
    fechaIngreso: '13/10/2025',
  },
  {
    id: 'base-22',
    photoUrl: '/personnel-photos/base-22.jpg',
    name: 'Cesar Hernandez Hernandez',
    areaZona: null,
    rawZona: 'LINEA 2',
    actividad: 'EM',
    asistencia: 'A',
    fechaIngreso: '03/02/2026',
  },
  {
    id: 'base-23',
    photoUrl: '/personnel-photos/base-23.jpg',
    employeeNumber: '3984',
    name: 'Francisco Gomez Cruz',
    areaZona: null,
    rawZona: 'LINEA 0',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '05/08/2026',
  },
  {
    id: 'base-24',
    photoUrl: '/personnel-photos/base-24.jpg',
    employeeNumber: '3872',
    name: 'Lidia Esther Rivera Gomez',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '30/06/2026',
  },
  {
    id: 'base-25',
    photoUrl: '/personnel-photos/base-25.jpg',
    employeeNumber: '3470',
    name: 'Patricia Obregón Cerdas',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '09/06/2026',
  },
  {
    id: 'base-26',
    photoUrl: '/personnel-photos/base-26.jpg',
    employeeNumber: '2767',
    name: 'Gudelia Hernández Hernández',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '02/04/2025',
  },
  {
    id: 'base-27',
    photoUrl: '/personnel-photos/base-27.jpg',
    employeeNumber: '3580',
    name: 'Norma Deyanira Gonzalez Ramos',
    areaZona: null,
    rawZona: 'ACCESORIOS5',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '13/01/2026',
  },
  {
    id: 'base-28',
    photoUrl: '/personnel-photos/base-28.jpg',
    employeeNumber: '3101',
    name: 'Veronica Lopez Arroyo',
    areaZona: null,
    rawZona: 'LINEA 1',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '27/09/2025',
  },
  {
    id: 'base-29',
    photoUrl: '/personnel-photos/base-29.jpg',
    employeeNumber: '3889',
    name: 'Sarah Estefania Juarez Alvarado',
    areaZona: null,
    rawZona: 'LINEA 2',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '07/07/2026',
  },
  {
    id: 'base-30',
    photoUrl: '/personnel-photos/base-30.jpg',
    employeeNumber: '3864',
    name: 'Victor Gabriel Perez Perez',
    areaZona: null,
    rawZona: 'LINEA 0',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '29/06/2026',
  },
  {
    id: 'base-31',
    photoUrl: '/personnel-photos/base-31.jpg',
    name: 'Daniela',
    areaZona: null,
    rawZona: null,
    actividad: 'L',
    asistencia: 'F',
    status: 'BAJA',
  },
  {
    id: 'base-32',
    photoUrl: '/personnel-photos/base-32.jpg',
    employeeNumber: '2962',
    name: 'Maria del Socorro Juarez Moreno',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'L',
    asistencia: 'I',
    fechaIngreso: '02/06/2025',
  },
  {
    id: 'base-33',
    photoUrl: '/personnel-photos/base-33.jpg',
    employeeNumber: '2626',
    name: 'Ulises Fernández Huerta',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '09/12/2024',
  },
  {
    id: 'base-34',
    photoUrl: '/personnel-photos/base-34.jpg',
    name: 'Valentin Cruz Martinez',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'L',
    asistencia: 'F',
    status: 'BAJA',
  },
  {
    id: 'base-35',
    photoUrl: '/personnel-photos/base-35.jpg',
    employeeNumber: '3871',
    name: 'Karol Patricia de la Rosa Perez',
    areaZona: null,
    rawZona: 'LINEA 3',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '30/06/2026',
  },
  {
    id: 'base-36',
    photoUrl: '/personnel-photos/base-36.jpg',
    employeeNumber: '3891',
    name: 'Paula Edith Ovalle Gandara',
    areaZona: null,
    rawZona: 'LINEA 4',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '07/07/2026',
  },
  {
    id: 'base-37',
    photoUrl: '/personnel-photos/base-37.jpg',
    employeeNumber: '3932',
    name: 'Alexis Gomez Jimenez',
    areaZona: null,
    rawZona: 'LINEA 0',
    actividad: 'PE',
    asistencia: 'A',
    fechaIngreso: '27/07/2026',
  },
  {
    id: 'base-38',
    photoUrl: '/personnel-photos/base-38.jpg',
    employeeNumber: '3559',
    name: 'Esly Suyapa Mata Licona',
    areaZona: null,
    rawZona: 'LINEA 1',
    actividad: 'PE',
    asistencia: 'A',
    fechaIngreso: '29/07/2026',
  },
  {
    id: 'base-39',
    photoUrl: '/personnel-photos/base-39.jpg',
    employeeNumber: '3555',
    name: 'Delfina Uribe Rodriguez',
    areaZona: null,
    rawZona: 'LINEA 3',
    actividad: 'PE',
    asistencia: 'A',
    fechaIngreso: '12/01/2026',
  },
  {
    id: 'base-41',
    photoUrl: '/personnel-photos/base-41.jpg',
    name: 'Edgar Solis Cruz',
    areaZona: null,
    rawZona: 'LINEA 5',
    actividad: 'L',
    asistencia: 'A',
    fechaIngreso: '05/08/2026',
  },
  {
    id: 'base-42',
    photoUrl: '/personnel-photos/base-42.jpg',
    employeeNumber: '3540',
    name: 'Nancy Vazquez Arredondo',
    areaZona: null,
    rawZona: 'LINEA 2',
    actividad: 'PE',
    asistencia: 'A',
    fechaIngreso: '07/01/2026',
  },
  {
    id: 'base-43',
    photoUrl: '/personnel-photos/base-43.jpg',
    employeeNumber: '2945',
    name: 'Lourdes Dominguez Islas',
    areaZona: null,
    rawZona: 'LINEA 4',
    actividad: 'PE',
    asistencia: 'A',
    fechaIngreso: '27/05/2025',
  },
  {
    id: 'base-46',
    photoUrl: '/personnel-photos/base-46.jpg',
    employeeNumber: '3963',
    name: 'Bryan Uriel Hernandez Hernandez',
    areaZona: null,
    rawZona: 'LINEA 3',
    actividad: 'M',
    asistencia: 'A',
    fechaIngreso: '09/08/2026',
  },
  {
    id: 'base-48',
    photoUrl: '/personnel-photos/base-48.jpg',
    employeeNumber: '3924',
    name: 'Juan Eduardo Cuellar Ruiz',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'M',
    asistencia: 'F',
    fechaIngreso: '23/07/2026',
    status: 'BAJA',
  },
  {
    id: 'base-50',
    photoUrl: '/personnel-photos/base-50.jpg',
    employeeNumber: '3938',
    name: 'Hector Manuel Cisneros Sanchez',
    areaZona: null,
    rawZona: 'LINEA 0',
    actividad: 'M',
    asistencia: 'A',
    fechaIngreso: '28/07/2026',
  },
  {
    id: 'base-54',
    photoUrl: '/personnel-photos/base-54.jpg',
    name: 'Kevin Alejandro Cira Ramirez',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'M',
    asistencia: 'F',
    fechaIngreso: '08/11/2026',
    status: 'BAJA',
  },
  {
    id: 'base-55',
    photoUrl: '/personnel-photos/base-55.jpg',
    name: 'Jose Eleazar Hernandez',
    areaZona: null,
    rawZona: 'LINEA 5',
    actividad: 'M',
    asistencia: 'A',
    fechaIngreso: '08/12/2026',
  },
  {
    id: 'base-56',
    photoUrl: '/personnel-photos/base-56.jpg',
    employeeNumber: '2446',
    name: 'Sandra Iveth Barrón Marinez',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '17/02/2025',
  },
  {
    id: 'base-57',
    photoUrl: '/personnel-photos/base-57.jpg',
    employeeNumber: '2641',
    name: 'Jesus Ernesto Rivera Escobar',
    areaZona: null,
    rawZona: 'CAJAS',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '30/12/2024',
  },
  {
    id: 'base-58',
    photoUrl: '/personnel-photos/base-58.jpg',
    employeeNumber: '2570',
    name: 'Yessica Guadalupe Luna Barboza',
    areaZona: 'LINEA 1',
    rawZona: 'LINEA 1',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '26/08/2025',
  },
  {
    id: 'base-59',
    photoUrl: '/personnel-photos/base-59.jpg',
    employeeNumber: '3650',
    name: 'Lizbeth Esmeralda Monsiváis Rangel',
    areaZona: null,
    rawZona: 'LINEA 2',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '26/02/2026',
  },
  {
    id: 'base-60',
    photoUrl: '/personnel-photos/base-60.jpg',
    employeeNumber: '3743',
    name: 'Evelin Yasmin Bautista Martinez',
    areaZona: 'LINEA 3',
    rawZona: 'LINEA 3',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '04/03/2026',
  },
  {
    id: 'base-61',
    photoUrl: '/personnel-photos/base-61.jpg',
    employeeNumber: '3310',
    name: 'Edgar Uriel Sanchez Morales',
    areaZona: null,
    rawZona: 'LINEA 7',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '16/10/2025',
  },
  {
    id: 'base-63',
    photoUrl: '/personnel-photos/base-63.jpg',
    employeeNumber: '3085',
    name: 'Sandra Cecilia Perez Cruz',
    areaZona: null,
    rawZona: 'CAPACITACION',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '01/09/2025',
  },
  {
    id: 'base-64',
    photoUrl: '/personnel-photos/base-64.jpg',
    employeeNumber: '3912',
    name: 'Joshua Oscar Estrada',
    areaZona: null,
    rawZona: 'LINEA 0',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '20/07/2026',
  },
  {
    id: 'base-65',
    photoUrl: '/personnel-photos/base-65.jpg',
    employeeNumber: '3048',
    name: 'Marco Antonio Andrade García',
    areaZona: 'PRODUCCION',
    rawZona: 'PRODUCCION',
    actividad: 'LIDER',
    asistencia: 'V',
    fechaIngreso: '25/08/2025',
  },
  {
    id: 'base-66',
    photoUrl: '/personnel-photos/base-66.jpg',
    employeeNumber: '3625',
    name: 'Olga Lidia Lara Davila',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'LIDER',
    asistencia: 'F',
    fechaIngreso: '20/01/2026',
    status: 'BAJA',
  },
  {
    id: 'base-68',
    photoUrl: '/personnel-photos/base-68.jpg',
    employeeNumber: '3595',
    name: 'Idalia Guereca Banda',
    areaZona: null,
    rawZona: 'LINEA 5',
    actividad: 'LIDER',
    asistencia: 'A',
    fechaIngreso: '14/01/2026',
  },
  {
    id: 'base-69',
    photoUrl: '/personnel-photos/base-69.jpg',
    employeeNumber: '3942',
    name: 'Jesus David Hernandez Zuniga',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: 'TC',
    asistencia: 'F',
    fechaIngreso: '28/07/2026',
  },
  {
    id: 'base-70',
    photoUrl: '/personnel-photos/base-70.jpg',
    employeeNumber: '3860',
    name: 'Axel Uriel Cruz Mata',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: 'TC',
    asistencia: 'A',
    fechaIngreso: '24/06/2026',
  },
  {
    id: 'base-71',
    photoUrl: '/personnel-photos/base-71.jpg',
    employeeNumber: '3237',
    name: 'Brayan Alejandro Lopez Ibarra',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: 'TC',
    asistencia: 'A',
  },
  {
    id: 'base-72',
    photoUrl: '/personnel-photos/base-72.jpg',
    employeeNumber: '3982',
    name: 'Wiliams de la Cruz',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: 'TC',
    asistencia: 'F',
    fechaIngreso: '13/8/2028',
  },
  {
    id: 'base-73',
    photoUrl: '/personnel-photos/base-73.jpg',
    employeeNumber: '3818',
    name: 'Juan Bohorquez',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: 'TG',
    asistencia: 'A',
    fechaIngreso: '07/06/2026',
  },
  {
    id: 'base-74',
    photoUrl: '/personnel-photos/base-74.jpg',
    employeeNumber: '3981',
    name: 'Jose Sanchez',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: 'TG',
    asistencia: 'F',
    fechaIngreso: '13/8/2027',
  },
  {
    id: 'base-75',
    photoUrl: '/personnel-photos/base-75.jpg',
    name: 'Nathalie del Valle Zapata Lopez',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: 'E',
    asistencia: 'A',
  },
  {
    id: 'base-76',
    photoUrl: '/personnel-photos/base-76.jpg',
    name: 'Yusley Montes',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: 'E',
    asistencia: 'A',
  },
  {
    id: 'base-77',
    photoUrl: '/personnel-photos/base-77.jpg',
    employeeNumber: '2718',
    name: 'Maria de Jesus de Dios Carrazo',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'C',
    asistencia: 'A',
    fechaIngreso: '11/06/2025',
  },
  {
    id: 'base-78',
    photoUrl: '/personnel-photos/base-78.jpg',
    employeeNumber: '3086',
    name: 'Juana Mendrano Villanueva',
    areaZona: null,
    rawZona: 'ACCESORIOS',
    actividad: 'PC',
    asistencia: 'A',
    fechaIngreso: '01/09/2025',
  },
  {
    id: 'base-79',
    photoUrl: '/personnel-photos/base-79.jpg',
    employeeNumber: '3719',
    name: 'Damaris Jael Barboza Yañez',
    areaZona: null,
    rawZona: 'ACCESORIOS4',
    actividad: 'SA',
    asistencia: 'A',
    fechaIngreso: '10/02/2026',
  },
  {
    id: 'base-80',
    photoUrl: '/personnel-photos/base-80.jpg',
    employeeNumber: '3575',
    name: 'Karen Rivera Gomez',
    areaZona: null,
    rawZona: 'ACCESORIOS3',
    actividad: 'SA',
    asistencia: 'A',
    fechaIngreso: '13/01/2026',
  },
  {
    id: 'base-81',
    photoUrl: '/personnel-photos/base-81.jpg',
    employeeNumber: '3361',
    name: 'Juan Daniel Gavidia Zavala',
    areaZona: null,
    rawZona: 'ACCESORIOS0',
    actividad: 'SA',
    asistencia: 'A',
    fechaIngreso: '14/10/2025',
  },
  {
    id: 'base-82',
    photoUrl: '/personnel-photos/base-82.jpg',
    employeeNumber: '3626',
    name: 'Esmeralda Catalina Llanas Tinajero',
    areaZona: null,
    rawZona: 'ACCESORIOS4',
    actividad: 'SA',
    asistencia: 'A',
    fechaIngreso: '21/01/2026',
  },
  {
    id: 'base-83',
    photoUrl: '/personnel-photos/base-83.jpg',
    employeeNumber: '3016',
    name: 'Angela Estrada Garcia',
    areaZona: null,
    rawZona: 'ACCESORIOS2',
    actividad: 'SA',
    asistencia: 'A',
    fechaIngreso: '03/07/2026',
  },
  {
    id: 'base-84',
    photoUrl: '/personnel-photos/base-84.jpg',
    employeeNumber: '3678',
    name: 'Aglael Emiret Trujillo Reyes',
    areaZona: null,
    rawZona: 'ACCESORIOS1',
    actividad: 'SA',
    asistencia: 'A',
    fechaIngreso: '03/02/2026',
  },
  {
    id: 'base-85',
    photoUrl: '/personnel-photos/base-85.jpg',
    employeeNumber: '3544',
    name: 'Evelyn Cristal Espinoza Uribe',
    areaZona: null,
    rawZona: 'ACCESORIOS5',
    actividad: 'SA',
    asistencia: 'A',
    fechaIngreso: '03/06/2026',
  },
  {
    id: 'base-86',
    photoUrl: '/personnel-photos/base-86.jpg',
    employeeNumber: '3489',
    name: 'Gustavo Israel Garibay García',
    areaZona: null,
    rawZona: 'CAJAS',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '26/11/2025',
  },
  {
    id: 'base-87',
    photoUrl: '/personnel-photos/base-87.jpg',
    employeeNumber: '2877',
    name: 'Janeth Alejandra Rodriguez Mendoza',
    areaZona: null,
    rawZona: 'CAJAS',
    actividad: null,
    asistencia: 'F',
    fechaIngreso: '12/05/2025',
  },
  {
    id: 'base-88',
    photoUrl: '/personnel-photos/base-88.jpg',
    name: 'Alondra',
    areaZona: null,
    rawZona: 'CALIDAD1',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-89',
    photoUrl: '/personnel-photos/base-89.jpg',
    name: 'Beckham',
    areaZona: null,
    rawZona: 'CALIDAD11',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-90',
    photoUrl: '/personnel-photos/base-90.jpg',
    name: 'Patricia',
    areaZona: null,
    rawZona: 'CALIDAD12',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-91',
    photoUrl: '/personnel-photos/base-91.jpg',
    name: 'Gabriela',
    areaZona: null,
    rawZona: 'CALIDAD2',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-92',
    photoUrl: '/personnel-photos/base-92.jpg',
    employeeNumber: '3914',
    name: 'Daniela Ivonee Aguilar Sanchez',
    areaZona: null,
    rawZona: 'CALIDAD3',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '19/07/2026',
  },
  {
    id: 'base-93',
    photoUrl: '/personnel-photos/base-93.jpg',
    name: 'Jeser',
    areaZona: null,
    rawZona: 'CALIDAD4',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-94',
    photoUrl: '/personnel-photos/base-94.jpg',
    employeeNumber: '2738',
    name: 'Arturo Badillo Santillán',
    areaZona: 'CAPACITACION',
    rawZona: 'CAPACITACION',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '25/03/2026',
  },
  {
    id: 'base-96',
    photoUrl: '/personnel-photos/base-96.jpg',
    employeeNumber: '3568',
    name: 'Angel Jovani Cruz Biviano',
    areaZona: null,
    rawZona: 'DMT',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '13/01/2026',
  },
  {
    id: 'base-97',
    photoUrl: '/personnel-photos/base-97.jpg',
    name: 'Mireya Josefina Lopez Zapata',
    areaZona: null,
    rawZona: 'LIMPIEZA',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-98',
    photoUrl: '/personnel-photos/base-98.jpg',
    employeeNumber: '3280',
    name: 'Sofia Ibañez Rodriguez',
    areaZona: null,
    rawZona: 'LIMPIEZA',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '07/10/2025',
  },
  {
    id: 'base-99',
    photoUrl: '/personnel-photos/base-99.jpg',
    employeeNumber: '3133',
    name: 'Elias Hernádez Gallardo',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '19/09/2025',
  },
  {
    id: 'base-100',
    photoUrl: '/personnel-photos/base-100.jpg',
    employeeNumber: '2686',
    name: 'Paulino Cordoba Ulloa',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '19/05/2025',
  },
  {
    id: 'base-101',
    photoUrl: '/personnel-photos/base-101.jpg',
    name: 'Roman',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-102',
    photoUrl: '/personnel-photos/base-102.jpg',
    employeeNumber: '3915',
    name: 'Luis Manuel de Jesus Faz Serrano',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '21/07/2026',
  },
  {
    id: 'base-103',
    photoUrl: '/personnel-photos/base-103.jpg',
    employeeNumber: '3401',
    name: 'Rodrigo Martinez Montes',
    areaZona: null,
    rawZona: 'SOPORTE',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '28/07/2026',
  },
  {
    id: 'base-104',
    photoUrl: '/personnel-photos/base-104.jpg',
    name: 'Estime Blaise',
    areaZona: null,
    rawZona: 'SOPORTE',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '25/01/2026',
  },
  {
    id: 'base-105',
    photoUrl: '/personnel-photos/base-105.jpg',
    employeeNumber: '2701',
    name: 'Caín Bautista Rojas',
    areaZona: null,
    rawZona: 'SUPERVISOR',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '08/03/2025',
  },
  {
    id: 'base-106',
    photoUrl: '/personnel-photos/base-106.jpg',
    employeeNumber: '2573',
    name: 'Diego Julián Marín Zamudio',
    areaZona: null,
    rawZona: 'TEAM LEADER',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '05/08/2024',
  },
  {
    // Corregido 2026-09-02 (a peticion explicita del usuario -- "el lider Jhonatan... el no
    // esta de baja"): estaba marcado BAJA desde el 2026-08-24 con evidencia del Excel de RH de
    // esa fecha, pero el usuario confirmo hoy que es un error real -- sigue activo, lider de
    // turno de noche. Se revierte `status: 'BAJA'` (ver tambien
    // scripts/reactivate-jonhatan-gomez-2026-09-02.mjs, que hizo el mismo cambio en el Employee
    // real de Postgres). `areaZona` se deja en null a proposito -- no se inventa a que area
    // especifica lidera, eso lo asigna un supervisor por el flujo normal.
    id: 'base-107',
    photoUrl: '/personnel-photos/base-107.jpg',
    employeeNumber: '3402',
    name: 'Jonhatan Alfredo Gomez Trujillo',
    areaZona: null,
    rawZona: 'LIDER',
    actividad: null,
    asistencia: null,
    fechaIngreso: '20/10/2025',
  },
  {
    id: 'base-108',
    photoUrl: '/personnel-photos/base-108.jpg',
    employeeNumber: '3977',
    name: 'Angel Ricardo Flores Vargas',
    areaZona: null,
    rawZona: 'PRODUCCION',
    actividad: null,
    asistencia: 'F',
    fechaIngreso: '05/08/2026',
  },
  {
    id: 'base-109',
    photoUrl: '/personnel-photos/base-109.jpg',
    employeeNumber: '3861',
    name: 'Brayan Alejandro Antonio Margarito',
    areaZona: null,
    rawZona: 'CAJAS',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '25/06/2026',
  },
  {
    id: 'base-110',
    photoUrl: '/personnel-photos/base-110.jpg',
    employeeNumber: '3841',
    name: 'Genaro Flores Zalazar',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '17/06/2026',
  },
  {
    id: 'base-112',
    photoUrl: '/personnel-photos/base-112.jpg',
    name: 'Jonathan',
    areaZona: null,
    rawZona: 'CALIDAD6',
    actividad: null,
    asistencia: 'A',
  },
  {
    id: 'base-114',
    photoUrl: '/personnel-photos/base-114.jpg',
    name: 'Denilson Edilber Castro',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '27/12/2024',
  },
  {
    id: 'base-115',
    photoUrl: '/personnel-photos/base-115.jpg',
    name: 'Mauricio Hernandez Clixtro',
    areaZona: null,
    rawZona: 'PALETIZADO',
    actividad: null,
    asistencia: 'A',
    fechaIngreso: '13/08/2026',
  },
  {
    id: 'sem34-1',
    employeeNumber: '3486',
    name: 'Sabina Sanchez Hernández',
    areaZona: null,
    rawZona: 'Accesorios',
    fechaIngreso: null,
  },
  {
    id: 'sem34-2',
    name: 'Jose Francisco Franco Vara',
    areaZona: null,
    rawZona: 'Paletizado',
    fechaIngreso: '17/08/2026',
  },
  {
    id: 'sem34-3',
    employeeNumber: '3492',
    name: 'David Delfin Rodriguez',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '23/07/2026',
  },
  {
    id: 'sem34-4',
    name: 'Brayan Gonzalez Sanchez',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '17/06/2026',
  },
  {
    id: 'sem34-5',
    employeeNumber: '3878',
    name: 'Jose Gustavo Aguilar Corpus',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '06/07/2026',
  },
  {
    id: 'sem34-6',
    name: 'Javier Aguilar De Dios',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '08/12/2026',
    status: 'BAJA',
  },
  {
    id: 'sem34-7',
    name: 'Alexis Garcia Garcia',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '08/12/2026',
  },
  {
    id: 'sem34-8',
    name: 'Juan Hernandez Gonzalez',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '08/12/2026',
  },
  {
    id: 'sem34-9',
    name: 'Ricardo Yandel Sanchez Alviso',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '08/06/2026',
  },
  {
    id: 'sem34-10',
    employeeNumber: '2888',
    name: 'Angel Ismael Romero Rojas',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '28/05/2026',
  },
  {
    id: 'sem34-11',
    employeeNumber: '3736',
    name: 'Manuel Alejandro Ramos Barron',
    areaZona: null,
    rawZona: 'Chofer',
    fechaIngreso: '27/02/2026',
  },
  {
    id: 'sem34-12',
    employeeNumber: '2661',
    name: 'Diciembre Alfonso Alvarado',
    areaZona: null,
    rawZona: 'Chofer',
    fechaIngreso: '22/06/2025',
  },
  {
    id: 'sem34-13',
    employeeNumber: '2678',
    name: 'Jose Juan Bocanegra',
    areaZona: 'INGENIERIA',
    rawZona: 'Ingenieria',
    fechaIngreso: '25/02/2025',
  },
  {
    id: 'sem34-14',
    employeeNumber: '2663',
    name: 'Luis Hernandez Hernandez',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '05/08/2026',
  },
  {
    id: 'sem34-15',
    employeeNumber: '3883',
    name: 'Luis Angel Rangel Espindola',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '07/07/2026',
  },
  {
    id: 'sem34-16',
    employeeNumber: '3096',
    name: 'Luis Alfredo Salas Rocha',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: null,
  },
  {
    id: 'sem34-17',
    employeeNumber: '3188',
    name: 'Juan de Dios Arellano Rodriguez',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '26/06/2026',
  },
  {
    id: 'sem34-18',
    employeeNumber: '2986',
    name: 'Juan Godinez Bautista',
    areaZona: 'PRODUCCION',
    rawZona: 'Produccion',
    fechaIngreso: '13/06/2026',
  },
  {
    id: 'sem34-19',
    employeeNumber: '3885',
    name: 'Ricardo Antonio Rodriguez Guzman',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '07/07/2026',
  },
  {
    id: 'sem34-20',
    employeeNumber: '3251',
    name: 'Jesus Perez Cruz',
    areaZona: null,
    rawZona: 'Produccion',
    fechaIngreso: '10/10/2025',
  },
]
