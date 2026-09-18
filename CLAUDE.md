# CLAUDE.md — Notificaciones de Trabajo

Guía para trabajar en este proyecto. Lee también `README.md` (uso) y la memoria del proyecto.
(El título visible de la app es **"Notificaciones de Trabajo"**, sin la palabra "Dashboard".)

## Qué es
App web de **un solo archivo** (`index.html`) que corre en el navegador. Requiere **iniciar sesión**
(Supabase: usuarios **aprobados por un administrador**) y **guarda los reportes por usuario** en la nube;
sin internet sigue generando .txt/PDF con la sesión cacheada, pero guardar/listar requiere red (ver
*Auth y guardado por usuario*).
A partir de una tabla de Órdenes de Trabajo (columna **OT** + **denominación de objeto técnico** = TAG),
asocia cada TAG a su **procedimiento P-SG-…** y genera una **plantilla de notificación `.txt`** por orden.
Entrada por Excel o por pegado. Única dependencia de red: la API REST de Supabase (sin librería; wrapper
`sb` sobre `fetch`). Cuatro pestañas arriba:
**Notificaciones** (UI en tres tarjetas a ancho completo, una debajo de otra: **01 Cargar datos**, **02 Notificaciones**
y, al final porque se usa poco, **03 Mapeo** (`#mapCard`)), **Reporte de calibración** (generador del informe DPCTrack
en PDF a partir de un TAG; ver sección de arquitectura), **Mis reportes** (lo guardado en la cuenta) y
**Usuarios** (solo admin: aprobar/revocar). Toda la app queda tras un **gate de login** (ver *Auth*).

## Estructura de archivos
```
index.html            <- ENTREGABLE. Generado; NO editar a mano (se sobrescribe al construir).
README.md             <- Uso y cómo hacer cambios.
CLAUDE.md             <- Este archivo.
build.ps1 / build.sh  <- Ensamblan index.html desde src/.
src/
  part_head.html      <- <head> + CSS + markup + apertura de <script> de la librería.
  part_tail.html      <- cierre de librería + TODA la lógica JS de la app (aquí se edita casi todo).
  xlsx.full.min.js    <- SheetJS incrustado (lectura de Excel). No modificar.
  html2pdf.bundle.min.js <- html2pdf (html2canvas + jsPDF) incrustado, para descargar reportes en PDF sin diálogo. No modificar.
  grabar_mdb.js       <- GENERADO por mdbwriter/build.sh (NO editar): escritor de la base .mdb para "Grabar a la base
                         de datos" EN LÍNEA (port de grabar_reporte.ps1 + Jackcess compilados a JS con TeaVM).
  build_config.py     <- Genera el mapeo TAG→procedimiento desde src/answers/ y lo inyecta en part_tail.html.
  default_map.js      <- Salida intermedia de build_config.py (referencia).
  answers/proc_*.txt  <- Resúmenes de cada procedimiento extraídos de NotebookLM (fuente del mapeo).
  extract_ranges.ps1  <- Lee el .mdb de calibración y vuelca por TAG {rango,salida,patrones,técnico,
                         indicación} (TAG_RANGES) y el informe completo (TAG_REPORT: cabecera,
                         especificaciones por grupo con puntos/límites y patrones con detalle) en
                         part_tail.html (+ TEST_INSTR, catálogo de patrones); genera además
                         datos_calibracion.json ({tags, reportes, patrones}).
  grabar_reporte.ps1  <- Inserta en la base EDITABLE la calibración generada por el dashboard (del JSON del
                         botón "Grabar a la base de datos"), copiando la última calib. como plantilla para
                         que DPCTrack la lea igual. TAMBIÉN actualiza la especificación (InstSpecGroup +
                         INSTSPEC) con el N.º de puntos/nominales/rangos del reporte, porque DPCTrack arma el
                         reporte desde la spec, no desde la calibración (usa -NoSpec para no tocar la spec).
                         Nunca toca la contraseña ni la base _backup.
datos_calibracion.json <- Datos de calibración portables (para adjuntar en la app). Generado.
mdbwriter/            <- Fuentes de src/grabar_mdb.js (Java + parche de Jackcess + reescritor + shims + pruebas).
                         Ver mdbwriter/README.md. work/ y app/target/ no se versionan.
supabase/schema.sql   <- Esquema Supabase (profiles, reportes, trigger handle_new_user, helpers is_admin/
                         is_approved, RLS; al final: bucket privado respaldo-base + tabla respaldo_base del
                         respaldo único de la base original). Sin secretos; se pega en el SQL Editor del proyecto.
.gitignore            <- Excluye *.mdb y zzz/ (no publicar base ni binarios).
20260810_dpctrack2_backup.mdb    <- Base DPCTrack2 (Jet 4, clave en zzz\PasswordReset.exe). SOLO CONSULTA (ver regla). NO PUBLICAR.
20260810_dpctrack2_editable.mdb  <- Copia de trabajo de la base (aquí SÍ se puede modificar). NO PUBLICAR.
zzz/                  <- Carpeta del programa DPCTrack2 (binarios). NO PUBLICAR; útil solo de referencia.
```
> **⛔ REGLA ESTRICTA — base de datos de SOLO CONSULTA:** `20260810_dpctrack2_backup.mdb` es **de solo
> lectura**. **NUNCA** se debe escribir, modificar, actualizar ni ejecutar sobre ella nada que altere sus
> datos (ni INSERT/UPDATE/DELETE por OLEDB, ni desde DPCTrack, ni de ninguna forma). Solo se abre para
> **leer/consultar** (extraer rangos, patrones, cabeceras, etc.). Para cualquier cambio a la base se usa la
> **copia de trabajo** `20260810_dpctrack2_editable.mdb`. Si en el futuro se necesita escribir en una base,
> se hace siempre sobre la copia editable, nunca sobre la `_backup`.
> **Etapa 3 (GitHub Pages):** publicar SOLO `index.html` (y opcionalmente `src/`). **Nunca subir** el
> `.mdb`, la carpeta `zzz/` ni la contraseña de la base — añádelos a `.gitignore`. Los rangos ya quedan
> incrustados en `index.html`, así que el sitio no necesita la base.
`index.html` = `part_head.html` + `xlsx.full.min.js` + `"\n"` + `html2pdf.bundle.min.js` + `"\n"` + `grabar_mdb.js` + `"\n"` + `part_tail.html`.

## Construir
```
powershell -ExecutionPolicy Bypass -File build.ps1     # Windows
bash build.sh                                          # bash
```
Siempre editar en `src/` y reconstruir. Nunca editar `index.html` directamente (la librería de 930 KB
está en medio y el archivo se regenera).

## Arquitectura de la app (src/part_tail.html)
- `DEFAULT_MAP_ARR`: array del mapeo (ver abajo). Es lo que más se toca.
- `MAP` / `SORTED_KEYS`: mapa por prefijo; claves ordenadas por longitud desc para **match más largo**
  (PIC gana a PI/PC, TIT a TI/TT, VTRC, SOV a SV, …).
- `tagOf(denom)`: el TAG es el **primer token que mezcla letras y números** (`PT-3110`, `3110-PT-001`).
  Cubre denominaciones tipo "TRANSMISOR DE PRESION PT-3110".
- `RE_TIPO_ORDEN` / `esTipoOrden()` / `sinTipoOrden()`: códigos de **clase/tipo de orden** y de **clase de
  actividad** (`EI-5531`, `IN-5531`, `PM01`, `ZM…`, `IW…`, `MN…`, `XPM7`) que mezclan letras y números
  pero se repiten igual en todas las filas — **nunca son TAG**. Se descartan en `tagOf`, `matchPrefix`,
  `detectKey` y en el desplegable. Si aparece otro código repetido, se añade a `RE_TIPO_ORDEN`.
- `esShutdown(denom)` + entrada **`SHUTDOWN`**: si la orden dice "shutdown" (prueba de shutdown en
  quemadores), `detectKey` la enruta por **contenido** a `SHUTDOWN` → `P-SG-04554`, con prioridad sobre el
  prefijo (el TAG suele ser el quemador `HE-…` o venir vacío).
- `matchPrefix(tag)` / `detectKey(tag,denom)`: resuelven el prefijo en este orden —
  (1) **exacta** sobre las letras iniciales, (2) **variante ISA** quitando la "I" de indicador
  (`LIT→LT`, `FIT→FT`, `AIT→AT`, `PDIT→PDT`), (3) los mismos dos pasos sobre cada grupo de letras
  **pegado a un número** (`TCM-PIT-1234 → PIT`, no `TC`), (4) match por **prefijo más largo**.
  Las coincidencias fuertes van antes que el prefijo, por eso un código de área no secuestra el match.
  Si el TAG no resuelve, `detectKey` reintenta con el resto de la denominación.
- `makeRow(ot,denom,equipo,fecha)` + `recompAuto(row)`: construyen la fila y su plantilla automática.
  Los campos arrancan en `undefined` = "aún no editado": `recompAuto` los rellena y los **recalcula solo
  mientras el técnico no los toque** (compara contra `row._autoDesc`/`row._autoEq`/`row._auto[campo]`).
- `TIPO_TXT` + `tipoDe(row)` + `autoFields(row)`: rellenan *cómo se encontró / falla / motivo / cómo se dejó*
  con el **caso normal** (equipo en servicio, sin falla, preventivo programado) redactado según el tipo de
  equipo — transmisor, indicador, controlador, válvula, solenoide, elemento, analizador, detector, visor o
  genérico. El tipo sale del `nombre` del prefijo (analizador/detector/visor se evalúan antes que
  "transmisor" por "Analizador/transmisor de gas"). Cada tipo lleva su artículo para la concordancia.
- `parseFecha(v)` / `findFecha(cells)`: normalizan fechas escritas (`dd/mm/aaaa`, `dd-mm-aa`, `dd.mm.aaaa`
  de SAP, `aaaa-mm-dd`) a `dd/mm/aaaa`. El pegado toma la fecha de su columna; si no hay columna
  reconocible, busca una celda con forma de fecha (también dentro de una línea suelta). Inicio = fin.
- `TAG_RANGES` + `rangoDe(tag)` + `lineaCalib(row)` + `patronesDe(tag)`: datos de calibración por TAG.
  `TAG_RANGES` mapea TAG normalizado (sin guiones) → `{r,s,p}`: **r** rango de entrada, **s** señal de
  salida, **p** lista `[[tagPatrón,descripción],…]` de los **patrones del reporte de calibración más
  reciente**. La descripción cierra con **"Calibrado en el rango de: r para una salida de: s"**
  (`TXT_RANGO`/`TXT_SALIDA`), y el campo *¿Qué equipos o patrones se utilizaron?* se rellena con
  "Patrones utilizados:" + los patrones (TAG − descripción). **Nada se inventa**: sin dato, queda la
  etiqueta vacía / cae a los equipos genéricos del procedimiento.
  Origen (`src/extract_ranges.ps1`, base DPCTrack2): `INSTSPEC` grupo primario → rango = min–max
  `InputSignal` (`INPUTSIGNALTYPE`), salida = min–max `OutputSignal` (`OUTPUTSIGNALTYPE`; 4-20 mA o
  escalado en unidades de ingeniería según protocolo); patrones = reporte más reciente por instrumento
  (`CALIBRAT` MAX fecha) → `CALTEST` → `TESTINST`.
- **Indicación con que se dejó el equipo** (campo `li`): de la **nota** del último reporte (`CALIBRAT.NoteID`
  → `PCNotes.Note`) se extrae con regex la frase tipo "indicación de &lt;valor&gt;"; si existe, se añade a
  *Cómo se dejó el equipo*: "Se dejó con indicación de &lt;valor&gt;." (solo ~10 reportes la traen). Ojo:
  el regex en `extract_ranges.ps1` es **ASCII** (`indicaci\S?n`) a propósito — PS 5.1 lee el `.ps1` como
  ANSI y una vocal acentuada literal rompía el match de las notas con tilde.
- **Auto-guardado de sesión** (`SESSION_KEY`=`noti_session_v1`, `saveSession`/`loadSession`/`clearSession`):
  las filas cargadas y sus ediciones se guardan en `localStorage` en cada render y edición (debounce), y se
  restauran al abrir. Al restaurar se re-ejecuta `recompAuto` (respeta lo editado, re-sincroniza autos con
  la base vigente). Botón **"Vaciar sesión"** en la tarjeta 02 (Notificaciones).
- `autoTecnico(row)` + campo **"Trabajo realizado por:"** (penúltima línea del `.txt`): nombre del técnico
  del último reporte de calibración (`WHOCALIBRATED`, campo `by`), **solo si ese reporte es reciente**
  (menos de 2 meses respecto a `row.fecha`). Si es antiguo (≥2 meses), faltan fechas o el TAG no está en
  la base → vacío para llenar a mano. Editable. Se recalcula al cambiar la fecha de la plantilla.
  `d` = fecha del reporte (yyyy-MM-dd); `parseDMY`/`parseISO`/`addMonths` hacen la comparación.
- Campo **"Trabajo recibido por:"** (última línea del `.txt`, `fields.recibido`): **manual**, arranca vacío
  y no se autocalcula (quien recibe/acepta el trabajo). Editable; se persiste con la sesión.
- **Actualizar los datos sin reconstruir** (`CAL_OVERRIDE` / `CAL_STORE_KEY` / tarjeta 03 Mapeo → "Base de
  calibración"): `src/extract_ranges.ps1` también genera `datos_calibracion.json`; el usuario lo adjunta
  en el dashboard (input `importCalib`), se guarda en `localStorage` y **manda sobre los datos
  incrustados** (para TAG que no incluya, cae a `TAG_RANGES`). "Volver a incrustados" = `btnCalibReset`.
  Regenerar: `powershell -File src\extract_ranges.ps1 -Mdb <base_nueva> -Password "<clave>"` (clave en
  `zzz\PasswordReset.exe`, por defecto de DPCTrack2) → adjuntar el `.json` **o** `build.ps1` para incrustar.
- **Datos de calibración desde la base, compartidos en la nube** (módulo `datosCal`): el MISMO contenido que
  `extract_ranges.ps1` lo produce en el navegador `api.extraer(generado, nombre)` (port Java
  `mdbwriter/app/.../Extractor.java`, **contenido idéntico** a PS verificado con `mdbwriter/test/comparar_datos.js`
  en 3 bases) y va a `CAL_OVERRIDE` con `base:{nombre, ultimoId=MAX(CalibrationID), ultimaFecha}`, `generado`,
  `origen` ("base"|"nube") y `pendienteNube`. Entradas: (1) tras grabar en línea, `mdbwEjecutar` extrae de la base YA
  actualizada (`out.datos`) y `dbGrabar` llama `datosCal.actualizarDesdeBase` (estado en `#dbDatosEstado`); (2) tarjeta
  02 **"Actualizar desde base .mdb"** (`#importBase`, `mdbwCorrer({tipo:"extraer"})`, estado `#calBaseEstado`; solo
  lectura, admite cualquier base). **Nunca retrocede**: si `base.ultimoId` < el vigente no aplica. Aplica local
  (`refreshAll` + `renderRepTecnicos`; regenera `REP_BATCH` solo si `REP_BATCH_EDITADO` es false, si no avisa en
  `#repMsg`) y comparte UN archivo `datos_calibracion.json.gz` en el bucket `respaldo-base` (x-upsert; si la nube ya
  tiene una base más nueva aplica la de la nube). `sincronizar()` (2,5 s tras `bootApp` y al volver `online`): sube lo
  `pendienteNube` o baja de la nube si cambió (`noti_calib_nube_v1` guarda la última versión vista) y no es más
  vieja. `respaldoNube.limpiarOtros` conserva ese archivo. `REP_BATCH_EDITADO` se pone en true al editar el formulario
  (listeners de captura), buscar/agregar, abrir de Mis reportes o aplicar técnico; false en `buildRepBatch`/"Vaciar".
  **Si cambias `extract_ranges.ps1`, cambia también `Extractor.java`** y compara (`ExtraerCli`/`node_extraer.js` vs PS).
  Rendimiento en JS (~7 s para 81 MB): evitar `String.toLowerCase(Locale)`, `String.replace(CharSequence)`,
  `BigDecimal` y `Double.toString` en bucles (en TeaVM son órdenes de magnitud más lentos; ver `ci`, `redondear`, `Json.Num`).
- **Pestaña "Reporte de calibración"** (`TAG_REPORT` + funciones `rep*` + área `#reportPrint`): la app tiene
  dos pestañas arriba — **Notificaciones** (todo lo anterior) y **Reporte de calibración**, un generador que
  **replica el informe de DPCTrack** ("INSTRUMENTO INFORME DE CALIBRACIÓN") en PDF. El técnico digita un TAG,
  `repLookup` lo busca en `TAG_REPORT` (o en `CAL_OVERRIDE.reportes` si hay `.json` adjunto) y autollena TODO
  desde la base: cabecera (fabricante, modelo, serie, estado, ubicación, depto, empresa), especificaciones por
  grupo (`sa` tipo de precisión, `ra`/`rd`/`pm`, unidades `it`/`ot`, puntos `pts=[inNom,outNom,lowLim,highLim]`)
  y patrones del último reporte con detalle (`std=[code,name,mf,model,serial,lastCal,nextCal]`). Los defaults
  de temp/humedad/tipo/certificado/técnico salen del reporte más reciente (`CALIBRAT`); la nota por defecto usa
  el P-SG del mapeo (`procForTag`→`detectKey`). **Lo único que se ingresa a mano son los valores de calibración**
  (Enc. como / Dejado como por punto); todo lo demás es editable pero prellenado. **"Fecha de finalización"
  (`h.fdt`, campo editable de `REP_FIELDS`)**: es la del reporte, NUNCA la de hoy (antes se imprimía
  `nowStamp()`, un bug). Arranca igual a la fecha de calibración (`h.dt`) — también cuando `buildRepBatch`
  toma la fecha de la orden — y la **sigue mientras no se edite aparte** (el listener de `dt` la arrastra solo
  si `fdt===dt`, sin flags, así sobrevive a guardar/reabrir); editada, manda lo editado. Cálculo automático:
  **salida nominal** viene de la base; **% de desviación** = `desvPct` (para *Pct of Range* la base es la
  **salida máxima** del grupo, así el límite coincide con `RangeAccuracyPct×salidaMax`; para *Pct of Reading*
  es respecto al nominal); **Aprobado/Fallado** = `dentro` (usa los `LowLimit/HighLimit` de la base, que están
  poblados al 100% en `INSTSPEC`). "Generar reporte" → `repBuildHtml` llena `#reportPrint` y `window.print()`
  (imprimir a PDF). El CSS de `#reportPrint` (en `part_head.html`) está oculto en pantalla y visible en
  `@media print`; usa serif Times, cabecera de dos columnas, cajas con borde y la regla azul de la empresa,
  igual que el PDF original. `TAG_REPORT` se genera en el MISMO paso de `extract_ranges.ps1` (misma base) e
  igual se incrusta y se incluye en `datos_calibracion.json` (`{tags, reportes, patrones}`, ahora `version:2`).
  **Selector "agregar patrón"**: además de los patrones por defecto (los del último reporte), el formulario
  tiene un desplegable con el catálogo completo de patrones (`TEST_INSTR`, tabla `TESTINST`: code →
  `[name,mf,model,serial,lastCal,nextCal]`) para **añadir más**; se guardan en `repState.extraStd` (no
  mutan el registro base), se listan con opción de quitar, se deduplican por código y `repStdBox` concatena
  por-defecto + añadidos. Fuente: `testInstrSrc()` (override `CAL_OVERRIDE.patrones` o `TEST_INSTR`
  incrustado). `TEST_INSTR` se genera en el mismo `extract_ranges.ps1`.
  **Desplegable "Quién realizó la calibración"** (`TECNICOS` + `repTecnico`/`renderRepTecnicos`/`repSetTecnicoAll`):
  la lista de técnicos sale de `WHOCALIBRATED` (base, por frecuencia, ≥2, sin User/Technician), se incrusta
  como `TECNICOS` (fuente `tecnicoSrc()` = override `CAL_OVERRIDE.tecnicos` o incrustado) y alimenta un
  desplegable en la pestaña que **aplica el nombre a TODOS los reportes del lote**. El campo por reporte
  sigue **editable** (input con `list="repTecList"`: se elige del datalist o se escribe a mano).
  **N.º de puntos por grupo (agregar/quitar puntos)** (`grpRange`/`deriveTol`/`regenPoints` + input `data-gpts`):
  cada grupo tiene un campo "N.º de puntos de calibración"; al cambiarlo, `regenPoints` reparte N puntos en el
  rango del instrumento (`G.range`, extremos de los `pts`), salida lineal, límites por el modelo de tolerancia
  del grupo (`deriveTol`: constante para *Pct of Range*/*Plus-Minus*, proporcional a la lectura para *Pct of
  Reading*), Enc./Dejado arrancan en el nominal (editables); la desviación se recalcula. Al **exportar el JSON**,
  `repGrabarPayload` incluye todos los puntos y `grabar_reporte.ps1` **construye `CALDET` desde los puntos del
  reporte** (2 filas por punto) y fija `CalGroups.Divisions = N`, así DPCTrack muestra el grupo con esa cantidad
  de campos. **Aplica a cualquier instrumento** (no solo WT).
  **Entrada nominal editable** (input `data-k="inNom"` por punto + `recomputePoint`): al editar la entrada
  nominal de un punto, la **salida nominal se recalcula** por la función de transferencia lineal del grupo
  (`[iLo,iHi]→[oLo,oHi]`), junto con los límites y el % de desviación; si Enc./Dejado estaban en el nominal
  (sin tocar) se sincronizan. La celda de salida es `.cell-outnom`. Al exportar, `CALDET.InputSignal` y
  `NominalInputSignal` llevan la entrada editada y `CalGroups.InputLowRange/HighRange` = extremos de los puntos.
  **Mín/máx de entrada y de salida editables** (inputs `data-gimin`/`data-gimax` y `data-gomin`/`data-gomax`
  por grupo): cambian `G.range.iLo`/`iHi`/`oLo`/`oHi`; `regenPoints` reparte los N puntos en el nuevo rango,
  con salida lineal (**la entrada máx mapea a la salida máx**) y límites por el modelo `deriveTol` (**escala
  con el span**: fracción-del-span × span actual para *Pct of Range*, así ±tol crece/decrece con el rango);
  el `% de desv` usa `grpBase(G)` = salida máx del rango ACTUAL (por eso `desvPct` acepta `base`). Al exportar,
  el grupo lleva `inLow/inHigh/outLow/outHigh` (extremos de los puntos) y `grabar_reporte.ps1` fija
  `CalGroups.InputLowRange/InputHighRange/OutputLowRange/OutputHighRange` (+ el `Input/OutputSignal` de cada
  CALDET ya sale recalculado).
  **Nr. de certificado = OT** (`buildRepBatch`): al procesar el pegado/Excel, el certificado de cada reporte
  arranca con la **Orden de Trabajo (OT)** de esa fila (`st.h.ce=r.ot`), no con el certificado del último
  reporte de la base. Editable después.
  **Generación por lote** (`REP_BATCH`/`buildRepBatch`/`renderRepSelect`/`repSelectShow`): al **procesar el
  pegado o el Excel** en Notificaciones, además de las plantillas `.txt`, se generan los reportes de
  calibración de cada orden cuyo TAG esté en la base (`repLookup`); los que no estén se **omiten**. La
  pestaña de reporte tiene un **desplegable** (`#repSelect`) para elegir y **revisar/editar** cada uno
  (cada entrada del lote es un estado editable independiente; las ediciones se conservan al cambiar de
  instrumento). "Buscar/agregar un TAG suelto" agrega uno más al lote. "Vaciar reportes" limpia el lote.
  **Botones de PDF** (todos usan el mismo `repBuildHtml`→`#reportPrint`, salen idénticos):
  (1) **"Generar reporte (PDF)"** (`repGenerar`) → abre la ventana de impresión del navegador (Guardar como
  PDF, **vectorial**). (2) **"Descargar reporte (PDF)"** (`repDescargar`→`repPdfFrom`) → **descarga directa**
  (sin diálogo) del instrumento seleccionado con **html2pdf** (rasteriza `#reportPrint` con html2canvas y baja
  el `.pdf`). (3) **"Descargar todos (PDF)"** (`repDescargarTodos`) → **UN PDF POR INSTRUMENTO**, descarga
  directa y secuencial (encadena promesas `repPdfFrom` por cada `REP_BATCH`, nombre `<tag>.pdf`).
  `repPdfFrom` pone `#reportPrint` visible fuera de pantalla, corre `html2pdf().from(box).save()` y restaura.
  **Botón "Grabar a la base de datos" = diálogo `#dbModal` con DOS opciones** (módulo `dbGrabar`, abre con
  `dbGrabar.abrir()`). **Opción 1 (en línea):** el usuario elige la base editable `.mdb` de su PC (`#dbFile`), se graba
  **en memoria del navegador** con `MDBW_FACTORY` (`src/grabar_mdb.js`) dentro de un **Web Worker** creado desde
  `MDBW_FACTORY.toString()` + `mdbwEjecutar` + `mdbwWorkerMain` (si no se puede crear, corre en el hilo principal),
  se **autoverifica** (Verificador: conteos, todos los índices, claves y calibraciones completas), se **respalda la
  base ORIGINAL en la nube** (módulo `respaldoNube`, ver abajo) y solo entonces se ofrece
  **"Descargar base actualizada"** con el mismo nombre. **Respaldo único en la nube** (`respaldoNube`): bucket
  PRIVADO `respaldo-base` con ruta fija `base_original.mdb.gz` (gzip con `CompressionStream`; 81 MB → ~6 MB) +
  tabla de UNA fila `public.respaldo_base` (`nombre, bytes, bytes_gz, sha256, instrumentos`; `subido_por*` y
  `subido_at` los fija un trigger); RLS: solo aprobados (`is_approved()`); SQL al final de `supabase/schema.sql`.
  Flujo: `preparar(file, buf, tags)` calcula SHA-256 del buffer ANTES de transferirlo al worker y comprime en
  paralelo; tras grabar OK, `subirConReintentos` (3 intentos a 0/3/10 s, solo red/5xx/429; 403/413 fallan de una)
  hace POST con `x-upsert` (el anterior solo se reemplaza cuando el nuevo subió), upsert de la fila `on_conflict=id`
  y borra cualquier otro objeto del bucket. Si falla: botones "Reintentar respaldo" (`#dbNubeReintentar`) y
  "Descargar base original" (`#dbOriginal`, `triggerBlob(File)` como `<base>_ORIGINAL_<aaaa-mm-dd_hhmm>.mdb`)
  además de la actualizada. Grabado fallido u omitido → la nube NO se toca. `NotReadableError` (la base cambió en
  disco) → no ofrece descargas. Sección "Respaldo en la nube" del diálogo: `info()` (`#dbNubeInfo`) y
  `descargar()` (`#dbNubeDescargar`: descomprime con `DecompressionStream`, verifica SHA-256, baja `_ORIGINAL_…`).
  `sb.req` acepta `raw` (Blob, `contentType`), `headers` extra y `as:"blob"` (Storage). Recibe **exactamente el mismo texto JSON** que la Opción 2
  (`repGrabarJson()`), rechaza nombres con "backup" y no `.mdb`, no envía nada a servidores y no toca el archivo
  original. Es un **port fiel de `grabar_reporte.ps1`** (`mdbwriter/app/.../GrabarMdb.java`): **si cambias la lógica
  de grabado, cambia los dos** y corre `mdbwriter/test/run_case.sh` (ACE vs port: 8 tablas idénticas; JS = JVM byte a
  byte). Jackcess va **parcheado** (`mdbwriter/patch`: Access deja entradas de nodo padre desactualizadas en índices
  como el PK de `INSTSPEC`). **Opción 2 (flujo original, sin cambios):** `repGrabar` descarga el JSON para `grabar.bat`.
  Detalle del JSON y del script (`repGrabar`/`repGrabarPayload` + `src/grabar_reporte.ps1`): descarga
  **UN SOLO JSON con TODOS los instrumentos del lote** (`{version,generado,calibraciones:[…]}`) y lo graba en
  la base DPCTrack2 **editable** para que DPCTrack los lea y produzca los reportes idénticos. Como el navegador **no puede** escribir el `.mdb` (Access cifrado, sin servidor), el botón
  **descarga un JSON** (`grabar_<tag>_<fecha>.json`) con todos los datos (cabecera, grupos con puntos y
  lecturas Enc./Dejado, patrones, nota) y el usuario lo pasa a `src/grabar_reporte.ps1`, que **inserta** la
  calibración en `20260810_dpctrack2_editable.mdb`. El script **copia la última calibración del mismo
  instrumento como plantilla** (todas las columnas de `CALIBRAT`/`CalGroups`/`CALDET`) y solo sobrescribe lo
  nuevo (IDs `MAX+1` — no hay autonumber —, fecha, técnico, temp/humedad, certificado, tipo, `Reading` de
  cada punto = valor Enc./Dejado, `RESULTSTATUS` por límites, `Failed`/`AsFound`), reconstruye `CALTEST`
  desde los patrones del reporte y crea `PCNotes` (`NoteID` `MAX+1`). **Además actualiza la ESPECIFICACIÓN**
  del instrumento (`Update-Spec`), porque **DPCTrack arma el reporte desde la spec, no desde la calibración**:
  por cada grupo del JSON fija `InstSpecGroup.Divisions` = N.º de puntos y `Input/OutputLowRange/HighRange` =
  mín/máx, y **reemplaza las filas de `INSTSPEC`** (borra las viejas e inserta N nuevas con
  `Position/InputSignal/OutputSignal/LowLimit/HighLimit` del reporte, copiando el resto de columnas —tipos de
  señal, precisión, resoluciones— de una fila plantilla del mismo grupo). Sin esto, cambiar puntos/rangos en
  el dashboard **no se reflejaba** en DPCTrack. El modificador **`-NoSpec`** graba solo la calibración sin
  tocar la spec. **Mantiene el contador interno de DPCTrack** (tabla `IDs`, `LastID` por `TABLENAME`): los
  IDs de arranque = `1 + max(MAX(tabla), IDs.LastID)` y al final **sube** `IDs.LastID` de `CALIBRAT` y
  `PCNOTES` al último usado (solo hacia arriba). Sin esto, DPCTrack reutilizaba un `CalibrationID`/`NoteID`
  ya insertado y lanzaba **"clave duplicada / violación de la llave"** al crear una calibración nueva.
  Acepta **uno o varios** instrumentos
  (`$d.calibraciones`): itera con IDs incrementales, todo en **una transacción** (atómico; `Q` lleva la
  transacción en cada SELECT; `Exec` corre los UPDATE/DELETE parametrizados de la spec y el contador `IDs`);
  omite (con aviso) los
  que no tengan calibración previa de plantilla. Fija el
  `OleDbType` de cada parámetro desde el esquema (evita "type mismatch" con los NULL). La **contraseña de la
  base NO se toca** (se abre con ella y queda igual). Uso:
  `powershell -File src\grabar_reporte.ps1 -Json <archivo> -Password "<clave>"`. Verificado contra la base
  (estudiado en 5 instrumentos; probado grabando 3 en lote — LT/PT/WT — que quedaron como la calib. más
  reciente de cada uno con la estructura exacta).
- `ajustaWT(k,denom)`: **WT** comparte prefijo entre peso y torque. Si el nombre contiene "torque" se
  enruta a `WT-TORQUE` (entrada con 3 opciones por centrífuga: `P-SG-04618` CE-6H, `P-SG-04619`
  CE-8H/9H·F-3424/F-3425, `P-SG-04620` CE-1H…7H·F-3423); si no, se queda en peso (`WT` → `P-SG-04533`).
- `CALIB_ANEXA` + `NOTA_CALIB`: los prefijos ahí listados (**PT, PIT, LT** — y `LIT`, que resuelve a `LT`)
  cierran la *descripción del trabajo* con "Datos de calibración se encuentran anexos a la orden de
  trabajo." Solo se añade cuando ya hay procedimiento (en LT, tras elegir la variante).
- `genText(row)`: arma el `.txt`. **Toda línea empieza con `.`** (requisito).
- `valveTable(falla,tecno)`: tabla generado-vs-posición para válvulas.
- `renderRows()`: **al inicio no muestra ninguna plantilla** — solo el desplegable `#orderSelect` con la
  opción placeholder "— Selecciona una orden —" y un aviso `.emptysel`. Al elegir una orden se muestra
  **esa sola** con sus campos editables, botones (Vista previa / Copiar / Descargar / Guardar) y contador
  "X de N guardadas". `currentId` arranca en `null` y no se auto-selecciona.
- `optionLabel(row)`: cada opción del desplegable muestra **OT · TAG del equipo · nombre · procedimiento**
  (`✓` si está guardada). Sin TAG reconocible dice "sin TAG" y usa la denominación; sin procedimiento,
  "sin procedimiento" o "elegir procedimiento" según el caso.
- Entradas: `fileInput` (Excel, SheetJS) y `btnPaste` (pegado). Ambas usan `makeRow`+`renderRows`
  (mismo comportamiento y mismas preguntas). Detección de columnas: `detectCols` (Excel, por clave) y
  `detectColIdx` (pegado, por índice), compartiendo los matchers `COL`. Sin encabezados, el pegado separa
  OT (bloque de ≥4 dígitos), fecha (por forma) y denominación (el resto), incluso si todo viene en una
  sola línea separada por espacios.
- Gestión de mapeo (tarjeta **03 · Mapeo**, `#mapCard`, al FINAL de la pestaña Notificaciones): agregar/editar/borrar prefijos; se guarda en
  `localStorage` (`STORE_KEY`), con exportar/importar JSON y restablecer.
- Layout (pestaña Notificaciones): tres tarjetas a ancho completo en este orden: **01 Cargar datos**, **02 Notificaciones**
  (`#resultsCard`, solo aparece al cargar datos y muestra una plantilla únicamente cuando se elige una orden) y
  **03 Mapeo** (`#mapCard`, incluye "Base de calibración"). Ya no existe `.toprow`.
- **Aviso al cerrar la página** (módulo `avisoSalida`, ventana `#salidaModal`): los navegadores no permiten una ventana
  propia al cerrar, así que en `beforeunload`, si hay trabajo sin guardar, se pide el aviso estándar
  (`preventDefault` + `returnValue`) y se programa `setTimeout(mostrar)`, que solo corre si el usuario elige
  **quedarse**. Antes guarda la sesión local (`saveSession`). "Trabajo sin guardar" = filas/reportes con `_tocado`
  (se marca en los listeners de edición de `#rows` y `#repForm`, patrones, técnico para todos) cuyo
  `JSON.stringify(payload)` no coincide con `_cloudSig` (lo guardado en la cuenta; lo fijan `guardar`,
  `flushPending` y `abrir`) ni con `_cloudSigQ` (lo encolado sin conexión), más `dbGrabar.pendienteSalida()`
  (grabando o base actualizada sin descargar). `misReportes.sinGuardar()` / `guardarLista(notis, cals)` (sin alertas).
  Botones: **Guardar todo en mi cuenta**, **Descargar base actualizada**, **Seguir trabajando** y, si se abrió desde
  "Cerrar sesión" (`avisoSalida.mostrar(true)`), **Cerrar sesión sin guardar**. `auth.logout` llama
  `avisoSalida.permitirSalida()` para que la recarga propia no avise. Órdenes cargadas sin editar NO cuentan (la
  sesión local ya las conserva).

## Auth y guardado por usuario (Supabase)
Bloque al final de `src/part_tail.html` (entre el IIFE de wiring y el Init). Config pública tras `var uid=0;`:
`SB_URL`, `SB_ANON_KEY` (la anon key es pública; la protege RLS; **la `service_role` NUNCA va en cliente ni
repo**), `AUTH_KEY="noti_auth_v1"`, `PENDING_KEY="noti_pending_v1"`, `CURRENT_USER` y `tecnicoNombre()`
(= `upNoAcc(nombre)`: "Luis Rico"→"LUIS RICO", convención DPCTrack). Esquema en `supabase/schema.sql`
(pasos de configuración en el README, "Configurar Supabase").
- **`sb`** (wrapper sobre `fetch`; NO se vendoriza supabase-js): `req` (headers `apikey` / `Authorization:
  Bearer` / `Prefer`; sin `fetch` o `navigator.onLine===false` → `e.offline`; TypeError de red → `e.offline`;
  **refresco proactivo** si el JWT vence en <60 s; **401 → `refresh()` single-flight → 1 reintento**;
  `errFrom` → mensajes en español para GoTrue nuevo/antiguo y PostgREST), `from(t).select/insert/upsert/
  update/del` (filtros PostgREST `{id:"eq.x", order:"updated_at.desc", limit:200}`),
  `auth.signUp/signIn/refresh/getUser/signOut`.
- **`auth`**: caché `noti_auth_v1={v,tokens:{access,refresh,expiresAt},user:{id,email},profile:{…},checked_at}`.
  `init(onReady)`: sin caché → `gate("login")` (+aviso si `SB_URL` sigue en placeholder); con caché → entra
  YA (offline-first): aprobado → `unlock()`→`onReady()` (=`bootApp`, una sola vez), pendiente →
  `gate("pending")`; luego `revalidate()` en segundo plano (offline/5xx → badge "sin conexión"; 401 /
  `invalid_grant` / `refresh_token_not_found` → borra caché y `location.reload()` con aviso; `approved`
  cambiado → aplica). `logout()` = borrar caché + `location.reload()`. Eventos `storage` (sincroniza
  pestañas), `online`/`offline`. **El gate es el overlay `#authGate`** (`position:fixed`, fuera de `.wrap`,
  visible por defecto): **NUNCA tocar `.wrap{display}`** (lo usa `repPdfFrom`). La regla
  `[hidden]{display:none!important}` es necesaria (los bloques nuevos usan flex).
- **Init diferido**: `loadMap/renderMap/renderCalStatus` corren siempre; `bootApp()` (tras autenticar) hace
  `renderRepTecnicos` (incluye al usuario), `loadSession`/`renderRows`/`buildRepBatch`/`renderRepSelect`,
  `misReportes.flushPending()` y, si admin, `adminUsers.listar()`.
- **Atribución**: `autoTecnico` devuelve `tecnicoNombre()` si hay sesión (si no, la regla de 2 meses);
  `repBuildState` pone `h.by=tecnicoNombre()||rec.by` y `h.fin=tecnicoNombre()||"User"`;
  `renderRepTecnicos` antepone al usuario si no está en `TECNICOS`. Todo sigue editable (`aplicaTecnico`
  respeta `_autoTec`).
- **`misReportes`**: `serializeCal(st)` = `{v:1,tag,rec (snapshot COMPLETO),h,std,groups:[{gn,range,rows}]}`
  — sin `meta` (=`rec.g[i]`) ni `tol` (función); `deserializeCal(p)` = `repBuildState(p.rec)` (re-deriva `tol`
  con `deriveTol(pts)`) + sobreescribir `h/std/range/rows` (`null`→`NaN`; si el payload no trae `h.fdt` —
  guardado antes de que existiera— se toma `h.dt`). Así `repGrabarPayload` y
  `repBuildHtml` son idénticos al reabrir, **incluida la fecha de finalización**. `serializeNoti(row)` =
  `{v:1,row (sin _cloud*/_qid),txt:genText(row),filename:fileNameOf(row)}`; `deserializeNoti` = copia +
  `id=++uid` + `recompAuto`. Filas de `reportes`: `{kind:"calibracion"|"notificacion",tag,ot,titulo,payload}`;
  `guardar()` hace **upsert por `(user_id,kind,tag,ot)`** (re-guardar actualiza, no duplica; efecto
  colateral: dos calibraciones del mismo TAG con certificado vacío se pisan → el certificado arranca = OT)
  o `PATCH` por `_cloudId`. Fallo offline/5xx → **cola** `noti_pending_v1` (`flushPending` al arrancar, al
  volver `online`, tras guardar OK o con "Reintentar ahora"); 4xx (403 pendiente/revocado, 413, 23505) →
  no se encola, `_cloudError`. Estado visible con `cloudBadge(row)` (cardHtml) y `#repNubeMsg`
  (`renderRepStatus`). `listar/abrir/abrirTodos/dlPdf/dlJson/dlTxt/eliminar` en la pestaña **Mis reportes**
  (`switchTab("mis")`); `abrir` usa `repBatchPut` (reemplaza en `REP_BATCH` por TAG) y `repSelectShow`.
  **`aplicarItems(items)`**: núcleo común de abrir lo guardado. Ordena **del más antiguo al más nuevo** por
  `updated_at` (así el lote queda en el orden en que se guardó) y aplica los payloads — calibraciones con
  `repBatchPut` + `renderRepSelect`, notificaciones reemplazando por `ot`+`tag` o `push` + `renderRows` —,
  fija `_cloudId/_cloudAt/_cloudSig` (no cuentan como trabajo sin guardar), **deja el desplegable sin
  selección** (como tras el primer pegado; si `repState` sigue en el lote la conserva), pasa a la pestaña
  Reporte si hubo calibraciones y resume en `#misMsg`. Un payload dañado se cuenta aparte y no corta el resto.
  **`abrirTodos`** (botón `#misAbrirTodos`): un `select("*")` con `filtrosActuales()` (los mismos filtros de
  tipo/usuario que usa `listar`; `limit:1000`), pide confirmación y llama a `aplicarItems`.
  **Selección con casillas** (`SEL` = ids marcados, `VISIBLES` = ids que muestra la lista): cada fila lleva
  `<input type="checkbox" data-sel="id">` y la cabecera `#misSelAll` (marcar/desmarcar todos; `indeterminate`
  si van algunos). `renderSel` actualiza el botón `#misAbrirSel` ("Abrir seleccionados (N)", deshabilitado con
  0). `listar` poda `SEL` a lo visible. **`abrirSeleccionados`**: `fetchIds` trae los marcados en **lotes de 40**
  (`id=in.(…)`, para no armar URLs enormes), pregunta **solo** si alguno reemplaza algo ya cargado
  (`yaCargados`), aplica y limpia la selección. API: `seleccionar(id,on)` / `seleccionados()`.
  El botón "Guardar" de cada notificación pasó a **"Guardar en mi cuenta"** (marca `saved` + `guardarNoti`);
  botones nuevos `#btnNubeTodas`, `#repGuardarNube`, `#repGuardarNubeTodos`.
- **`adminUsers`** (solo `auth.isAdmin()`): pestaña **Usuarios** (`#tabAdmin`, oculta si no es admin):
  aprobar/revocar (`profiles.approved`) y rol (`profiles.role`); no puede tocarse a sí mismo. También puebla
  `#misUser` (filtro por usuario en Mis reportes).
- **Sesión local por usuario**: `saveSession` guarda `owner=CURRENT_USER.id`; `loadSession` devuelve `false`
  si `owner` es de otra cuenta (no se mezclan sesiones en un PC compartido).
- **RLS (resumen)**: `profiles` select propio o admin, update solo admin (+trigger `profiles_guard`);
  `reportes` select/delete propio o admin, insert/update propio **y aprobado**; helpers `is_admin()` /
  `is_approved()` SECURITY DEFINER (evitan recursión); `anon` sin acceso. Primer admin por SQL en el
  dashboard (`update public.profiles set role='admin', approved=true where email='…'`).
- **Estilo**: todo en ES5 (`var`, `function(){}`, `.then/.catch`; sin arrow functions, `?.`, `??` ni
  template literals) para que `node --check` y el harness sigan funcionando.

## Estructura de una entrada de DEFAULT_MAP_ARR
- **Directa**: `{prefijo, nombre, proc:"P-SG-####", descripcion, equipos}`.
- **Con opciones** (varias tecnologías; el técnico elige por orden en un desplegable):
  `{prefijo, nombre, proc:"", opciones:[{proc, nombre, descripcion, equipos}, …]}`.
- **Válvula** (PV/FV/LV): igual que directa + `tipo:"valvula"` → pide *tipo de falla* (cerrada/abierta)
  y *tecnología* (4-20/fieldbus) y añade la tabla de posición. **No** lleva la línea "Calibrado en el
  rango de:…" (usa la tabla de posición); `genText` la omite cuando `row.isValve` (igual que con `onoff`).
- **Combinada** (SOV/VSP): `proc:"P-SG-04586 + P-SG-04585"` con descripción unida. Llevan `onoff:true`
  (válvula on-off, sin rango/salida analógica) → `genText` **omite la línea "Calibrado en el rango de:…"**
  (`recompAuto` fija `row.onoff` desde el mapeo; la línea solo se añade cuando `!row.onoff && !row.isValve`,
  es decir, **ninguna válvula** —on-off ni de control— la lleva).
- **Genérica**: `proc:""`, descripción/equipos vacíos → plantilla genérica editable.

## Convenciones / decisiones (no romper)
- **Descripciones 100% en pasado afirmativo**: "se hizo… el equipo respondió correctamente al procedimiento".
  Todos los verbos van en pasado y con **concordancia** (p. ej. "se midieron los voltajes", no "se midió
  voltajes"). **Nunca dejar un infinitivo colgando tras "y/e/coma"** (bug típico: "Se limpió el actuador **e
  inspeccionar** conexiones" → debe ser "…**y se inspeccionaron** las conexiones"). Las descripciones baked
  en `DEFAULT_MAP_ARR` ya están corregidas (v11); si se regeneran desde NotebookLM, revisar esto a mano.
- **Sin cambio de piezas por defecto**: la notificación parte de un **mantenimiento preventivo sin daño**
  (los campos automáticos ya dicen "sin daño físico", "Sin falla presentada", "Mantenimiento preventivo
  programado"). Por eso **ninguna descripción por defecto debe afirmar que se reemplazó/cambió/sustituyó una
  pieza** (ni "sellos nuevos", ni "reemplazar switches defectuosos", ni "sustituir el sensor"). Si en la
  intervención real sí se cambió algo, **lo agrega el técnico a mano** editando el campo.
- **Limpieza de bullets** (`clean_bullet` en `build_config.py`, aplica a TODAS las descripciones):
  (1) "DCS o PLC" → **DCS**; (2) **se elimina toda mención de SAP** (se quita el segmento unido por " y "
  que la contiene; si el bullet queda vacío, se descarta); (3) se **elimina el bullet completo** que diga
  que se ejecutó **ajuste de cero/Zero** (las líneas de *verificación/indicación de cero* SÍ se conservan,
  porque no son ajuste). Si se regenera desde NotebookLM, estas reglas se re-aplican solas.
- **Cada línea del `.txt` empieza con `.`** (en `genText`, prefijo aplicado a todas las líneas).
- **Fecha fin = fecha de inicio** siempre.
- **Diseño**: estética *minimalismo editorial* (skill `diseñador/SKILL.md`): canvas bone `#F7F6F3`,
  tarjetas blancas con `1px solid #EAEAEA`, tipografía serif (`--serif`) en títulos y mono (`--mono`) en
  metadatos/eyebrows, botón primario sólido `#111`, badges pastel; sin gradientes ni sombras marcadas.
  Toda la paleta/tipografía está en variables `:root` de `src/part_head.html`.
- Nombre de archivo: `OT-TAG.txt` (TAG = primer token de la denominación).
- Al **cambiar los datos por defecto** del mapeo, **sube la versión** `STORE_KEY` (`noti_mapping_vN`)
  para que el `localStorage` viejo del usuario no oculte los nuevos valores. **Valor actual: `noti_mapping_v12`**
  (v4 PIT, v5 WT peso, v6 WT-TORQUE, v7 PSH/PSL, v8 limpieza DCS/SAP/ajuste-cero, v9 LIT,
  v10 SHUTDOWN + TV, v11 descripciones 100% en pasado + sin menciones de reemplazo/cambio de piezas,
  v12 SOV/VSP marcadas `onoff` → sin línea "Calibrado en el rango").
  Otras claves de `localStorage`: `noti_calib_v1` (base de calibración adjuntada;
  el `.json` ahora es `version:2` = `{tags, reportes}`, y `reportes` alimenta la pestaña de reporte),
  `noti_session_v1` (sesión auto-guardada; ahora lleva `owner` = id del usuario), `noti_auth_v1` (sesión de
  Supabase cacheada: tokens + perfil) y `noti_pending_v1` (cola de reportes por subir). `sessionStorage`:
  `noti_auth_msg` (aviso tras cerrar sesión por expiración).
- **Footer**: ya no dice "Ningún dato se envía a servidores"; indica que los reportes se guardan en la
  cuenta (Supabase) y que guardar requiere internet.
- **LIT** (transmisor indicador de nivel) es **entrada propia** con las mismas opciones de nivel que LT
  (`multi(...LEVEL)`; el técnico elige el procedimiento en el desplegable). Está en `CALIB_ANEXA` como LT.
- **Enter tras cada línea de la descripción**: `recompAuto` normaliza `autoDesc` con `split(/\n+/).join("\n\n")`,
  `cardHtml` muestra el campo con `conEnters(...)` y `genText` lo aplica al `.txt` (idempotente). Garantiza
  una línea en blanco entre líneas aunque el campo esté editado o venga de una sesión previa.
- **PSH/PSL** (switches de presión) → `P-SG-04553`. `SWITCH_DIR={PSH:"subiendo",PSL:"bajando"}`: la
  descripción añade "Se realizaron pruebas de repetibilidad satisfactorias con el SET de: &lt;rango&gt;
  &lt;subiendo|bajando&gt;." (no hay PSH/PSL en la base → el valor del SET se llena a mano). En vez de la
  línea de rango/salida. **Toda descripción termina con un salto de línea** (`autoDesc+="\n"`).
- **PV, FV y LV** comparten configuración idéntica de válvula (`proc:"P-SG-04580"`, misma `descripcion`
  y `equipos`, `tipo:"valvula"`); solo cambia el `nombre` (presión/flujo/nivel). Los tres piden tipo de
  falla + tecnología y generan la tabla.

## Cómo hacer cambios
- **UI/estilos**: editar `src/part_head.html` (CSS/markup) o `src/part_tail.html` (lógica) → `build.ps1`.
- **Cambiar/añadir el procedimiento de un prefijo** de forma permanente: editar `DEFAULT_MAP_ARR` en
  `src/part_tail.html` (o `build_config.py` si viene de NotebookLM) → subir `STORE_KEY` → `build.ps1`.
  (Para cambios puntuales sin recompilar, el usuario también puede usar la tarjeta 03 "Mapeo" de la UI.)
- **Regenerar el mapeo desde NotebookLM** (si cambian los PDFs): ver siguiente sección, luego
  `python src/build_config.py` (reescribe `part_tail.html`) y `build.ps1`.

## Regenerar procedimientos desde NotebookLM (skill `notebooklm`)
Tableros: **notificaciones** `4b85f680-9773-4929-9d77-f9cbce5fcef1` y **notificaciones 1**
`fd1060f4-c48d-4fc0-8ea0-914fcb770934`.
1. Listar fuentes: `notebooklm source list -n <notebook_id> --json`.
2. Por cada procedimiento a usar: `notebooklm ask "<prompt OBJETO/ACTIVIDADES/EQUIPOS>" -s <source_id> -n <notebook_id>`
   y guardar la salida en `src/answers/proc_<codigo>.txt` (mismo formato que los existentes).
3. Ajustar asignaciones prefijo→código en `src/build_config.py` (funciones `single/multi/valve/combined/generic`).
4. `python src/build_config.py` → `powershell -File build.ps1`.

## Verificación (sin navegador)
Desde el login, el stub debe proveer `localStorage`, `sessionStorage`, `navigator.onLine`, `location.reload`,
`window.addEventListener` y un `fetch` simulado (`auth.init` corre al cargar; sin caché de sesión NO llama a
la red). **`node mdbwriter/test/app/correr.js`** extrae el JS de `index.html` y corre `e2e_auth.js`, `e2e_nube_node.js`
(respaldo en la nube: `sb.req` binario, reintentos, 403, gzip, huella) y `e2e_datos_node.js` (datos compartidos: no
retroceder, publicar, nube más nueva, pendiente sin red, sincronizar, lote editado), `e2e_salida_node.js` (trabajo sin
guardar y aviso al cerrar) y `e2e_abrir_node.js` ("Abrir todos" y "Abrir seleccionados": orden del lote, sin duplicar,
filtros, cancelar, sin conexión, lista vacía, payload dañado, casillas, aviso de reemplazo, lotes de 40).
En Chrome real: `node mdbwriter/test/e2e_abrir.js <index.html|URL>
<carpeta>` (guardar un lote en la cuenta → vaciar la app → "Abrir todos" → elegir en los desplegables, editar y
volver a guardar sin duplicar; y marcar casillas → "Abrir seleccionados" abre solo esos) y `node mdbwriter/test/e2e_salida.js <index.html|URL> <copia.mdb> <carpeta>`
(orden de tarjetas; aviso `beforeunload` con clic real para la activación del usuario; quedarse → ventana; guardar
todo; sin conexión; base sin descargar; salir igual; cerrar sesión). El arnés `e2e_auth.js` cubre: gate sin caché, arranque con caché, autollenado,
round-trip calibración/notificación, wrapper `sb` (errores legibles, 401→refresh→reintento, offline,
refresco proactivo, upsert), cola offline, pendiente/revocado/sesión inválida, offline con caché y `owner`.
El JS de la app se extrae de `index.html` (2º `<script>`) y se prueba con Node + stub de DOM en el
scratchpad: `node --check` (sintaxis) y scripts que comprueban matcheo de prefijos por planta, variantes
ISA, tipo de orden, tablas de válvula, prefijo `.`, pasado afirmativo, fechas (inicio=fin), autorrelleno
por tipo, desplegable, rango/salida/patrones reales de la base, regla de 2 meses del técnico, indicación
de la nota, y el ciclo guardar/restaurar sesión y override de base de calibración.
Para la **pestaña de reporte**: se prueba `repLookup`/`repBuildState`/`desvPct`/`dentro`/`repBuildHtml`
(0.00% e ideal→Aprobado, valor fuera de límite→Fallado, valor en el límite→% = precisión declarada) y se
renderiza `#reportPrint` a PDF con Chrome headless (`--print-to-pdf`) para **comparar 1:1** con el informe
de DPCTrack de referencia (`PT-U7122.pdf`).
Para **grabar en línea** (Opción 1), siempre sobre COPIAS de la base editable y con la clave en `DPC_CLAVE`:
`mdbwriter/test/run_case.sh` (grabar_reporte.ps1 vs port: volcado de 8 tablas + conteos idénticos; JS = JVM byte a
byte; índices con DAO), `mdbwriter/test/e2e_navegador.js` (Chrome real headless por DevTools: diálogo, rechazo de
_backup, archivo dañado, Web Worker, descarga de base y JSON, original intacto, file://; **simula Supabase** con un
script inyectado (`Page.addScriptToEvaluateOnNewDocument`) que desvía `fetch` de Storage/`respaldo_base` a un
servidor local — NO usar `Fetch.requestPaused`: Chrome corta DevTools al pausar un POST de ~6 MB —: respaldo
idéntico a la original tras gunzip, uno solo en el bucket, reemplazo en el 2.º
grabado, nube caída → 3 intentos + descargas original/actualizada + reintento, 403 sin reintentos, descarga del
respaldo con huella) y, sobre la base descargada,
`verify_index.ps1` + compactado DAO. Tras la prueba del navegador se graba con `grabar.bat` el JSON descargado y
la base debe quedar idéntica a la del navegador.
Verificación real: abrir `index.html`, pegar TAGs variados (PT, FT, FIC, PIC, PV, TE, SOV, WT, PIT-…) y
comprobar rango/salida/patrones/técnico/indicación; en la pestaña de reporte, buscar un TAG y "Generar reporte".

## Pendiente
- **Etapa 3**: publicar en GitHub + GitHub Pages (el usuario indicará el repositorio). Publicar SOLO
  `index.html` (+ opcional `src/`); **nunca** el `.mdb`, `zzz/` ni la clave (el `.gitignore` ya los
  excluye; quitar además el valor por defecto de `-Password` en `extract_ranges.ps1`).
- Confirmar si el WT de torque de **F-0406** (WT-U4321) necesita un procedimiento propio.
