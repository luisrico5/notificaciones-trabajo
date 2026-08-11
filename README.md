# Notificaciones de Trabajo

Genera una **plantilla de notificación de trabajo (`.txt`)** por cada Orden de Trabajo (OT),
asociando el **TAG** (denominación de objeto técnico) a su **procedimiento P-SG-…** y completando la
plantilla con los datos del instrumento tomados de la base de calibración **DPCTrack2**: **rango**,
**señal de salida**, **patrones utilizados**, **técnico** e **indicación** del último reporte.

Todo corre **en el navegador**, sin servidor y sin enviar datos a ningún lado.
Es un único archivo: **`index.html`** (incluye la librería de Excel incrustada, funciona offline).
Los datos de calibración vienen **incrustados** en `index.html` y pueden **actualizarse a futuro**
adjuntando un archivo (ver *Base de calibración* más abajo).

La interfaz tiene tres tarjetas: arriba, lado a lado, **01 · Cargar datos** y **02 · Mapeo TAG →
Procedimiento**; debajo, a ancho completo, **03 · Notificaciones** (aparece al cargar datos). El diseño
sigue una estética de minimalismo editorial (paleta cálida monocroma, tipografía serif en títulos, sin
gradientes ni sombras marcadas).

## Uso local
1. Doble clic en `index.html` (se abre en tu navegador).
2. Carga los datos de una de estas dos formas:
   - **Adjuntar Excel** (`.xlsx`, `.xls`, `.csv`). Se lee la primera hoja. Detecta automáticamente
     las columnas: `OT`, `Denominación de objeto técnico`, número de equipo y fecha de inicio.
   - **Pegar del portapapeles**: copia la tabla **con su fila de encabezados** (puede tener las columnas
     que quieras y en cualquier orden) y pégala; pulsa **Procesar pegado**. La app detecta y usa
     solo **OT**, **fecha de inicio** y **denominación de objeto técnico** (igual que en el Excel) e ignora
     las demás columnas. Si pegas sin encabezados, asume col 1 = OT y col 2 = denominación.
   Si la tabla trae la **fecha**, se usa como fecha de inicio **y de fin**. También se ignora la columna
   de **tipo de orden** (p. ej. `EI-5`) para que no se confunda con el TAG.
3. Debajo aparece la tarjeta **03 · Notificaciones** con un **desplegable con todas las órdenes**
   (cada opción muestra **OT · TAG · nombre · procedimiento**, y ✓ si ya está guardada).
   **Al inicio no se muestra ninguna plantilla**: elige una orden de la lista y recién ahí verás
   **solo esa plantilla**, con sus campos editables:
   - Fecha de inicio · Cómo se encontró el equipo · Falla presentada · Motivo del mantenimiento ·
     Descripción del trabajo realizado (incluye el procedimiento y el TAG) · Cómo se dejó el equipo ·
     Qué equipos o patrones se utilizaron · **Fecha fin (igual a la de inicio)** · **Trabajo realizado por** ·
     **Trabajo recibido por** (manual, quien recibe el trabajo).
   - Varios campos se **rellenan solos** con los datos del instrumento (y quedan editables):
     - **Descripción**: termina con *"Calibrado en el rango de: … para una salida de: …"* (rango y salida
       tomados de la base). PT/PIT/LT añaden *"Datos de calibración se encuentran anexos a la orden de trabajo."*
     - **¿Qué equipos o patrones se utilizaron?**: lista los **patrones del último reporte** (TAG − descripción).
     - **Cómo se dejó el equipo**: si la nota del reporte lo registra, añade *"Se dejó con indicación de …"*.
     - **Trabajo realizado por**: nombre del técnico del último reporte, **solo si ese reporte es reciente**
       (menos de 2 meses respecto a la fecha de la plantilla); si es antiguo, queda vacío para llenarlo a mano.
   - Cuando el TAG **no está** en la base, esos campos quedan vacíos (etiqueta sin valor): nunca se inventan.
4. Flujo de trabajo por orden:
   - **Vista previa**: muestra el `.txt` **exacto** (con los puntos al inicio de cada línea) tal como se
     descargará; se actualiza mientras editas. Vuelve a pulsar para ocultarla.
   - Edita los campos y pulsa **Guardar** (la orden queda marcada con ✓ en el desplegable y avanza el
     contador "X de N guardadas"). Elige otra orden en el desplegable y repite.
   - En la orden abierta puedes **Copiar al portapapeles** toda la plantilla o **Descargar este `.txt`**
     (nombre `OT-TAG.txt`).
   - Cuando termines, **Descargar todos (.zip)** genera todas las plantillas en un ZIP.
   - **Tu trabajo se guarda solo**: las órdenes cargadas y las ediciones se conservan en el navegador y se
     **restauran al reabrir**. **Vaciar sesión** (tarjeta 03) empieza de cero.

## Mapeo TAG → Procedimiento
El mapeo ya viene **pre-cargado** con los procedimientos P-SG y sus puntos clave, extraídos de los
tableros de NotebookLM *notificaciones* y *notificaciones 1*.

- **Asignación directa** (un procedimiento): PT/PIC→04551, PI→04552, TT/TIT→04544, TI→04542,
  TC/TIC→04545, AT/AI→04632, OFD→04635 (detector de llama).
- **Con desplegable** (varias tecnologías, el técnico elige por orden):
  - **Flujo** (FT, FE, FI, FIC): DP 04563 · másico 04564 · vortex 04565 · magnético 04566.
  - **Nivel** (LT, **LIT**, LI): DP 04571 · radar antena 04572 · MTS 04573 · onda guiada 04574 · Drexelbrook 04576.
  - **Elemento de temperatura** (TE): RTD 04540 · termocupla 04541.
- **Válvulas de control** (PV, FV, LV → P-SG-04580): además preguntan **tipo de falla**
  (cerrada/abierta) y **tecnología de señal** (4-20 mA / Fieldbus) y generan la tabla
  *valor generado vs. posición real* correspondiente.
- **Combinado**: SOV y VSP → P-SG-04586 (micros de posición) + P-SG-04585 (válvula on-off).
- **Peso / torque** (WT): peso → P-SG-04533 (transmisores dXp-40 BLH). Si el nombre dice *torque*, se
  ofrecen 3 opciones por centrífuga (P-SG-04618 CE-6H · 04619 CE-8H/9H·F-3424/F-3425 · 04620 CE-1H…7H·F-3423).
- **Presión (variantes)**: PT, **PIT**, PIC → P-SG-04551. Las variantes con "I" de indicador
  (LIT→LT, FIT→FT, AIT→AT) usan el procedimiento del transmisor base.
- **Plantilla genérica** (sin procedimiento): PC, FC, LIC, LC, LG, SV, HV, HAD, VTRC, EX.

Las **descripciones del trabajo** vienen redactadas en **pasado afirmativo** (indican lo que se hizo y
que el equipo respondió correctamente al procedimiento; el usuario corrige lo que aplique). Se depuran
automáticamente: "DCS o PLC" queda solo como **DCS**, se **omite toda mención de SAP** y se **quitan las
líneas de ajuste de cero** (las de *verificación de cero* se conservan). En el `.txt` generado **todas
las líneas empiezan con un punto (`.`)**. El flujo es idéntico para Excel y pegado:
ambos muestran las plantillas editables (y las mismas preguntas/desplegables) antes de descargar.

En la tarjeta **02 · Mapeo** puedes agregar/corregir prefijos, **exportar/importar** el mapeo
como JSON y **restablecer**. Los cambios se guardan en tu navegador (localStorage, clave `noti_mapping_v6`).
El **TAG** es el primer dato que mezcla letras y números (p. ej. `PT-3110`, `3110-PT-001`, `PT-U2411`),
aunque lleve delante el código de área o de planta.

## Base de calibración (rangos, salidas, patrones, técnico, indicación)
Estos datos vienen **incrustados** en `index.html` desde la base DPCTrack2. Para **actualizarlos a futuro
sin reconstruir**:
1. Ejecuta el extractor sobre la base nueva (genera `datos_calibracion.json`):
   ```
   powershell -ExecutionPolicy Bypass -File src\extract_ranges.ps1 -Mdb "ruta\base_nueva.mdb" -Password "<clave>"
   ```
2. En la tarjeta **02 · Mapeo → Base de calibración**, **adjunta** ese `datos_calibracion.json`. Se guarda
   en tu navegador y **manda sobre los datos incrustados** (los TAG que no incluya usan los incrustados).
   "Volver a los datos incrustados" descarta el archivo adjuntado.

> El navegador **no** puede abrir el `.mdb` directamente (Access con contraseña); por eso el puente es el
> `.json`. Toda la lógica se conserva; solo cambian los datos. Alternativamente, reconstruye `index.html`
> para dejar los datos nuevos incrustados.

## Estructura del proyecto
```
index.html            Entregable (generado). Es lo que abres/publicas. NO se edita a mano.
README.md             Este archivo.
CLAUDE.md             Guía técnica para trabajar el proyecto.
build.ps1 / build.sh  Ensamblan index.html desde src/.
src/
  part_head.html      <head> + CSS + interfaz (HTML).
  part_tail.html      Toda la lógica (JS): mapeo TAG→procedimiento (DEFAULT_MAP_ARR) y datos TAG_RANGES.
  xlsx.full.min.js    Librería de Excel incrustada (no se toca).
  build_config.py     Regenera el mapeo desde src/answers/ (resúmenes de NotebookLM).
  extract_ranges.ps1  Lee la base .mdb y vuelca rango/salida/patrones/técnico/indicación por TAG.
  answers/            Resúmenes de cada procedimiento P-SG (fuente del mapeo).
datos_calibracion.json   Datos de calibración portables (para adjuntar en la app). Generado.
20260810_dpctrack2_backup.mdb   Base DPCTrack2 (con contraseña). NO publicar.
zzz/                Binarios del programa DPCTrack2 (referencia). NO publicar.
```
`index.html` se arma juntando `part_head.html` + `xlsx.full.min.js` + `part_tail.html`.

## Cómo hacer cambios (ahora y a futuro)
**Regla de oro:** edita en `src/` y reconstruye. No edites `index.html` directamente (se sobrescribe y la
librería de 930 KB está incrustada en medio).

Reconstruir tras cualquier cambio:
```
powershell -ExecutionPolicy Bypass -File build.ps1     # Windows
bash build.sh                                          # bash / Git Bash
```

Cambios típicos:
- **Textos, campos, colores, interfaz** → edita `src/part_head.html` (HTML/CSS) o `src/part_tail.html`
  (lógica) y reconstruye.
- **Cambio rápido de un procedimiento/prefijo (sin recompilar)** → hazlo en la app, tarjeta
  **02 · Mapeo** (se guarda en tu navegador; puedes exportar el JSON como respaldo).
- **Cambiar los valores por defecto de un prefijo de forma permanente** → edita el objeto de ese prefijo
  en `DEFAULT_MAP_ARR` dentro de `src/part_tail.html`, **sube la versión** `STORE_KEY`
  (`noti_mapping_vN` → `vN+1`, para que no quede oculto por el `localStorage` anterior) y reconstruye.
- **Agregar un prefijo nuevo** → añádelo a `DEFAULT_MAP_ARR` (o desde la tarjeta 02 · Mapeo de la app).
- **Regenerar los procedimientos desde NotebookLM** (si cambian los PDFs de los tableros
  *notificaciones* / *notificaciones 1*): actualiza `src/answers/proc_<código>.txt`, ajusta las
  asignaciones en `src/build_config.py`, ejecuta `python src/build_config.py` (reescribe `part_tail.html`)
  y reconstruye. Detalle paso a paso en `CLAUDE.md`.
- **Actualizar los datos de calibración** (rango/salida/patrones/técnico/indicación): ejecuta
  `src/extract_ranges.ps1` sobre la base nueva y **adjunta** el `datos_calibracion.json` en la app, o
  reconstruye para incrustarlos. Ver la sección *Base de calibración*.

> Detalles de arquitectura, funciones clave y cómo verificar sin navegador: ver **`CLAUDE.md`**.

## Publicar en GitHub (más adelante)
1. `git init` en esta carpeta y sube el sitio y las fuentes (`index.html`, `README.md`, `CLAUDE.md`,
   `src/`, `build.*`). **No subas** la base `*.mdb`, la carpeta `zzz/` ni la contraseña —el `.gitignore`
   ya los excluye (quita también el valor por defecto de la clave en `src/extract_ranges.ps1`).
   Los datos de calibración ya quedan incrustados en `index.html`, así que el sitio no necesita la base.
2. En el repo: **Settings → Pages → Deploy from branch → main / root**.
3. La URL de GitHub Pages servirá `index.html` directamente (la carpeta `src/` no afecta al sitio).
