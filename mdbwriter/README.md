# mdbwriter — grabar la base DPCTrack2 (.mdb) desde el navegador

Fuentes de **`src/grabar_mdb.js`**, el código que usa la **Opción 1** del botón **"Grabar a la base de datos"**
(pestaña *Reporte de calibración*): el usuario elige la base editable `.mdb` de su PC, la página la graba en
memoria, la verifica y la ofrece para descargar. Nada se envía a un servidor.

El JavaScript es el **port de `src/grabar_reporte.ps1`** (la lógica de `grabar.bat`) escrito en Java sobre
[Jackcess](https://jackcess.sourceforge.io) 5.0.0 y compilado con [TeaVM](https://teavm.org) 0.15.0.

## Regla principal
**La lógica de grabado vive en dos lugares y deben cambiar juntos:** `src/grabar_reporte.ps1` (grabar.bat) y
`app/src/main/java/grabarmdb/GrabarMdb.java` (en línea). Tras cualquier cambio, regenerar y correr la prueba de
fidelidad: ambos caminos deben dejar la base **idéntica**.

## Estructura
```
build.sh                      Construye todo y escribe ../src/grabar_mdb.js (descarga dependencias con SHA-1).
app/pom.xml                   Proyecto Maven + plugin TeaVM (JavaScript minificado, módulo UMD).
app/src/main/java/grabarmdb/
  GrabarMdb.java              Port fiel de grabar_reporte.ps1 (mismas tablas, plantilla, reglas Pass/Fail, spec, IDs,
                              y conversiones de PowerShell 5.1: [string]$null="", [int] redondeo bancario, etc.).
  Json.java                   Lector JSON que conserva el texto de los números (como ConvertFrom-Json + casts de PS).
  Verificador.java            Autoverificación de la base grabada (conteos, todos los índices, claves, calibraciones completas).
  WebApi.java                 API exportada a JS: nuevaBase, agregarBytes, grabar, tamano, leerBytes, liberar.
  Cli.java                    Mismo flujo en la JVM, para pruebas.
  JackcessResources.java      Empaqueta en el JS las tablas de ordenación de texto de los índices Jet 4.
patch/IndexPageCache.diff     Parche a Jackcess (ver abajo).
rewriter/WebRewriter.java     Reescribe el bytecode de Jackcess para TeaVM (ASM).
shim/mdbshim/**               Sustitutos mínimos de clases del JDK que TeaVM no trae (FileChannel, java.time, …).
test/                         Pruebas (ver abajo).
LICENSE-APACHE-2.0.txt        Licencia de Jackcess y TeaVM (Apache 2.0).
work/, app/target/            Descargas y compilados (ignorados por git).
```

## Datos de calibración (Extractor)
`Extractor.java` es el port de `src/extract_ranges.ps1`: lee la base (solo lectura) y devuelve el mismo contenido que
`datos_calibracion.json` (`tags`, `reportes`, `patrones`, `tecnicos`) más `base:{nombre, ultimoId, ultimaFecha}`.
La página lo usa tras grabar en línea y con "Actualizar desde base .mdb" (tarjeta 02) para mantener actualizados y
compartidos los reportes por defecto. Replica claves sin mayúsculas, `Trim()` de .NET, los formatos numéricos "0.####"
(es-ES) y "0.######" y el orden de `Sort-Object` cuando dos TAG se normalizan igual (p. ej. `PT--RF189`/`PT-RF189`).
Comparación: `java grabarmdb.ExtraerCli base.mdb java.json` o `node test/node_extraer.js ../src/grabar_mdb.js base.mdb js.json`,
y `node test/comparar_datos.js datos_calibracion.json js.json` contra la salida de `extract_ranges.ps1` sobre la misma
base (correr el script sobre una COPIA de `src/` para no reescribir `part_tail.html`).

## Construir
```
bash mdbwriter/build.sh                                   # Git Bash (Windows) o bash
powershell -ExecutionPolicy Bypass -File build.ps1       # luego, reconstruir index.html
```
Requisitos: JDK 11+ (`java`, `javac`, `jar`), `curl`, `unzip`, `patch`, `sha1sum` (Git Bash los trae). Maven se
descarga si no está. Pasos: parche de Jackcess → shims → reescritura del bytecode → instalar jars en `~/.m2` →
TeaVM → envolver como `function MDBW_FACTORY(){…; return exports;}` en `src/grabar_mdb.js`.

## Cómo lo usa la página (`src/part_tail.html`, módulo `dbGrabar`)
- `MDBW_FACTORY` va en el primer `<script>` de `index.html` (junto a xlsx y html2pdf) y no se ejecuta al cargar.
- Al grabar, la página crea un **Web Worker** desde `MDBW_FACTORY.toString()` (la página no se congela); si el
  navegador no permite el worker, corre en el hilo principal.
- La base se pasa por trozos de 8 MB, se graba con **el mismo texto JSON** que descarga la Opción 2
  (`repGrabarJson()`), se autoverifica y se devuelve por trozos para armar el `.mdb` descargable.
- Rechaza archivos cuyo nombre contenga "backup" (igual que `grabar.bat`) y los que no sean `.mdb`.

## Decisiones técnicas
- **Evaluación de fórmulas de Access desactivada** (como el script: no hay columnas calculadas ni validaciones por
  fórmula en esta base). El reescritor pliega `isEvaluateExpressions()` a `false` y deja inalcanzable ese motor.
- **Fechas** como `LocalDateTime` (hora local, igual que `Get-Date` del script).
- **Parche `IndexPageCache.updateParentEntry`:** Access/Jet no siempre reescribe la entrada del nodo padre de un
  índice cuando cambia la última entrada de una página hija (la deja como cota superior). Jackcess exigía coincidencia
  exacta y fallaba con *"Could not find child entry in parent"* al borrar filas de `INSTSPEC` de algunos instrumentos
  (p. ej. LT-U6924, TIT-DR719). El parche localiza la entrada del padre por el número de la página hija cuando la
  búsqueda exacta falla. Verificado con DAO (recorrido de todos los índices + búsqueda de cada clave) y compactando
  con Access.
- **La contraseña de la base no se toca:** Jet 4 la guarda en la cabecera y Jackcess no la necesita para leer/escribir;
  la base descargada sigue pidiéndola en Access/DPCTrack.

## Pruebas
Siempre sobre **copias** de la base editable, nunca la `_backup`. La clave va por variable de entorno, nunca en archivos.
- `test/run_case.sh <nombre> <base.mdb> <grabar.json> [salida]` (con `DPC_CLAVE`): graba el mismo JSON con
  `grabar_reporte.ps1` (ACE) y con el port en la JVM y compara el volcado de las 8 tablas + conteo de todas las tablas
  (`dump_fast.ps1`); luego exige que el JavaScript sea **idéntico byte a byte** a la JVM (`node_test.js`) y valida los
  índices con DAO (`verify_index.ps1`).
- `test/EquivTest.java`: Jackcess parcheado original vs reescrito para el navegador, idénticos byte a byte.
- `test/e2e_navegador.js <index.html | URL publicada> <copia.mdb> <carpeta>`: Chrome real (headless): abre el
  diálogo, rechaza la `_backup`, graba con Web Worker, descarga la base y el JSON, comprueba que el original no cambió,
  que el resto de la pestaña sigue funcionando y (con ruta local) que también funciona abriendo `index.html` como
  archivo. Con la URL de GitHub Pages prueba la página publicada. **Simula Supabase** (respaldo de la base original):
  un script inyectado desvía las llamadas a Storage y a `respaldo_base` a un servidor local en memoria y comprueba
  respaldo idéntico tras gunzip, uno solo en el bucket, reemplazo, nube caída (3 intentos + descargas de original y
  actualizada + reintento), 403 sin reintentos y descarga del respaldo con huella verificada.

Resultados al incorporarlo (base del 2026-09-08): JSON reales del 18-ago (15 instrumentos) y del 08-sep
(9 instrumentos, 1 omitido), casos borde y el lote del navegador → **idénticos** a `grabar_reporte.ps1`/`grabar.bat`;
JS = JVM byte a byte; índices OK con DAO; compactado de Access sin errores y con los mismos datos.
