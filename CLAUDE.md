# CLAUDE.md — Notificaciones de Trabajo

Guía para trabajar en este proyecto. Lee también `README.md` (uso) y la memoria del proyecto.
(El título visible de la app es **"Notificaciones de Trabajo"**, sin la palabra "Dashboard".)

## Qué es
App web de **un solo archivo** (`index.html`) que corre 100% en el navegador (sin servidor, offline).
A partir de una tabla de Órdenes de Trabajo (columna **OT** + **denominación de objeto técnico** = TAG),
asocia cada TAG a su **procedimiento P-SG-…** y genera una **plantilla de notificación `.txt`** por orden.
Entrada por Excel o por pegado. Sin dependencias externas en runtime. UI en tres tarjetas: **01 Cargar
datos** y **02 Mapeo** lado a lado (`.toprow`), y **03 Notificaciones** a ancho completo debajo.

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
  build_config.py     <- Genera el mapeo TAG→procedimiento desde src/answers/ y lo inyecta en part_tail.html.
  default_map.js      <- Salida intermedia de build_config.py (referencia).
  answers/proc_*.txt  <- Resúmenes de cada procedimiento extraídos de NotebookLM (fuente del mapeo).
  extract_ranges.ps1  <- Lee el .mdb de calibración y vuelca por TAG {rango,salida,patrones,técnico,
                         indicación} en part_tail.html; genera además datos_calibracion.json.
datos_calibracion.json <- Datos de calibración portables (para adjuntar en la app). Generado.
.gitignore            <- Excluye *.mdb y zzz/ (no publicar base ni binarios).
20260810_dpctrack2_backup.mdb  <- Base DPCTrack2 (Jet 4, con contraseña; está en zzz\PasswordReset.exe). Fuente de datos. NO PUBLICAR.
zzz/                  <- Carpeta del programa DPCTrack2 (binarios). NO PUBLICAR; útil solo de referencia.
```
> **Etapa 3 (GitHub Pages):** publicar SOLO `index.html` (y opcionalmente `src/`). **Nunca subir** el
> `.mdb`, la carpeta `zzz/` ni la contraseña de la base — añádelos a `.gitignore`. Los rangos ya quedan
> incrustados en `index.html`, así que el sitio no necesita la base.
`index.html` = `part_head.html` + `xlsx.full.min.js` + `"\n"` + `part_tail.html`.

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
- `RE_TIPO_ORDEN` / `esTipoOrden()` / `sinTipoOrden()`: los códigos de **clase/tipo de orden**
  (`EI-5…`, `PM01`, `ZM…`, `IW…`, `MN…`) mezclan letras y números pero se repiten igual en todas las
  filas — **nunca son TAG**. Se descartan en `tagOf`, `matchPrefix`, `detectKey` y en el desplegable.
  Si aparece otro tipo de orden en los reportes, se añade a `RE_TIPO_ORDEN`.
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
  la base vigente). Botón **"Vaciar sesión"** en la tarjeta 03.
- `autoTecnico(row)` + campo **"Trabajo realizado por:"** (última línea del `.txt`): nombre del técnico
  del último reporte de calibración (`WHOCALIBRATED`, campo `by`), **solo si ese reporte es reciente**
  (menos de 2 meses respecto a `row.fecha`). Si es antiguo (≥2 meses), faltan fechas o el TAG no está en
  la base → vacío para llenar a mano. Editable. Se recalcula al cambiar la fecha de la plantilla.
  `d` = fecha del reporte (yyyy-MM-dd); `parseDMY`/`parseISO`/`addMonths` hacen la comparación.
- **Actualizar los datos sin reconstruir** (`CAL_OVERRIDE` / `CAL_STORE_KEY` / tarjeta 02 "Base de
  calibración"): `src/extract_ranges.ps1` también genera `datos_calibracion.json`; el usuario lo adjunta
  en el dashboard (input `importCalib`), se guarda en `localStorage` y **manda sobre los datos
  incrustados** (para TAG que no incluya, cae a `TAG_RANGES`). "Volver a incrustados" = `btnCalibReset`.
  El navegador **no** abre el `.mdb` directo (Access cifrado); por eso el puente es el `.json`.
  Regenerar: `powershell -File src\extract_ranges.ps1 -Mdb <base_nueva> -Password "<clave>"` (clave en
  `zzz\PasswordReset.exe`, por defecto de DPCTrack2) → adjuntar el `.json` **o** `build.ps1` para incrustar.
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
- Gestión de mapeo (tarjeta **02**, junto a "Cargar datos"): agregar/editar/borrar prefijos; se guarda en
  `localStorage` (`STORE_KEY`), con exportar/importar JSON y restablecer.
- Layout: `.toprow` (grid 2 col) coloca **01 Cargar datos** y **02 Mapeo** lado a lado; debajo, a ancho
  completo, **03 Notificaciones** (`#resultsCard`) que solo aparece al cargar datos y muestra una plantilla
  únicamente cuando se elige una orden del desplegable. En pantallas < 820px la fila superior se apila.

## Estructura de una entrada de DEFAULT_MAP_ARR
- **Directa**: `{prefijo, nombre, proc:"P-SG-####", descripcion, equipos}`.
- **Con opciones** (varias tecnologías; el técnico elige por orden en un desplegable):
  `{prefijo, nombre, proc:"", opciones:[{proc, nombre, descripcion, equipos}, …]}`.
- **Válvula** (PV/FV/LV): igual que directa + `tipo:"valvula"` → pide *tipo de falla* (cerrada/abierta)
  y *tecnología* (4-20/fieldbus) y añade la tabla de posición.
- **Combinada** (SOV/VSP): `proc:"P-SG-04586 + P-SG-04585"` con descripción unida.
- **Genérica**: `proc:""`, descripción/equipos vacíos → plantilla genérica editable.

## Convenciones / decisiones (no romper)
- **Descripciones en pasado afirmativo**: "se hizo… el equipo respondió correctamente al procedimiento".
  Las genera `build_config.py` transformando el imperativo (verbo→pasado + neutraliza condicionales).
- **Cada línea del `.txt` empieza con `.`** (en `genText`, prefijo aplicado a todas las líneas).
- **Fecha fin = fecha de inicio** siempre.
- **Diseño**: estética *minimalismo editorial* (skill `diseñador/SKILL.md`): canvas bone `#F7F6F3`,
  tarjetas blancas con `1px solid #EAEAEA`, tipografía serif (`--serif`) en títulos y mono (`--mono`) en
  metadatos/eyebrows, botón primario sólido `#111`, badges pastel; sin gradientes ni sombras marcadas.
  Toda la paleta/tipografía está en variables `:root` de `src/part_head.html`.
- Nombre de archivo: `OT-TAG.txt` (TAG = primer token de la denominación).
- Al **cambiar los datos por defecto** del mapeo, **sube la versión** `STORE_KEY` (`noti_mapping_vN`)
  para que el `localStorage` viejo del usuario no oculte los nuevos valores. **Valor actual: `noti_mapping_v7`**
  (v4 PIT, v5 WT peso, v6 WT-TORQUE, v7 PSH/PSL). Otras claves de `localStorage`: `noti_calib_v1` (base de
  calibración adjuntada) y `noti_session_v1` (sesión auto-guardada).
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
  (Para cambios puntuales sin recompilar, el usuario también puede usar la tarjeta 02 "Mapeo" de la UI.)
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
El JS de la app se extrae de `index.html` (2º `<script>`) y se prueba con Node + stub de DOM en el
scratchpad: `node --check` (sintaxis) y scripts que comprueban matcheo de prefijos por planta, variantes
ISA, tipo de orden, tablas de válvula, prefijo `.`, pasado afirmativo, fechas (inicio=fin), autorrelleno
por tipo, desplegable, rango/salida/patrones reales de la base, regla de 2 meses del técnico, indicación
de la nota, y el ciclo guardar/restaurar sesión y override de base de calibración.
Verificación real: abrir `index.html`, pegar TAGs variados (PT, FT, FIC, PIC, PV, TE, SOV, WT, PIT-…) y
comprobar rango/salida/patrones/técnico/indicación.

## Pendiente
- **Etapa 3**: publicar en GitHub + GitHub Pages (el usuario indicará el repositorio). Publicar SOLO
  `index.html` (+ opcional `src/`); **nunca** el `.mdb`, `zzz/` ni la clave (el `.gitignore` ya los
  excluye; quitar además el valor por defecto de `-Password` en `extract_ranges.ps1`).
- Confirmar si el WT de torque de **F-0406** (WT-U4321) necesita un procedimiento propio.
