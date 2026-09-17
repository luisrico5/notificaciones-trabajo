# Notificaciones de Trabajo

Genera una **plantilla de notificación de trabajo (`.txt`)** por cada Orden de Trabajo (OT),
asociando el **TAG** (denominación de objeto técnico) a su **procedimiento P-SG-…** y completando la
plantilla con los datos del instrumento tomados de la base de calibración **DPCTrack2**: **rango**,
**señal de salida**, **patrones utilizados**, **técnico** e **indicación** del último reporte.

La interfaz corre **en el navegador** como un único archivo **`index.html`** (librerías incrustadas).
Para usarla hay que **iniciar sesión** con una cuenta **aprobada por un administrador**; los reportes de
calibración y las notificaciones que generes se **guardan en tu cuenta** (Supabase) y puedes reabrirlos
desde cualquier PC. Sin internet puedes seguir generando `.txt`/PDF con la sesión ya iniciada; **guardar en
la cuenta requiere internet** (si no hay, queda en cola y sube al reconectar). Ver *Cuenta, aprobación y
guardado en la nube*.
Los datos de calibración vienen **incrustados** en `index.html` y pueden **actualizarse a futuro**
adjuntando un archivo (ver *Base de calibración* más abajo).

La pestaña Notificaciones tiene tres tarjetas, una debajo de otra: **01 · Cargar datos**, **02 ·
Notificaciones** (aparece al cargar datos) y, al final, **03 · Mapeo TAG → Procedimiento** (se usa poco). El diseño
sigue una estética de minimalismo editorial (paleta cálida monocroma, tipografía serif en títulos, sin
gradientes ni sombras marcadas).

La app tiene **cuatro pestañas** arriba: **Notificaciones** (generar las plantillas `.txt` de las órdenes),
**Reporte de calibración** (generar el informe de calibración en PDF de un instrumento; ver más abajo),
**Mis reportes** (lo guardado en tu cuenta) y, solo para administradores, **Usuarios** (aprobar cuentas).

## Uso local (pestaña Notificaciones)
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
3. Debajo aparece la tarjeta **02 · Notificaciones** con un **desplegable con todas las órdenes**
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
     - **Trabajo realizado por**: el **nombre del usuario con sesión iniciada** (en mayúsculas). Si no hay
       sesión, el técnico del último reporte **solo si es reciente** (menos de 2 meses respecto a la fecha de
       la plantilla); si no, queda vacío para llenarlo a mano.
   - Cuando el TAG **no está** en la base, esos campos quedan vacíos (etiqueta sin valor): nunca se inventan.
4. Flujo de trabajo por orden:
   - **Vista previa**: muestra el `.txt` **exacto** (con los puntos al inicio de cada línea) tal como se
     descargará; se actualiza mientras editas. Vuelve a pulsar para ocultarla.
   - Edita los campos y pulsa **Guardar en mi cuenta** (la orden queda marcada con ✓ en el desplegable,
     avanza el contador "X de N guardadas" y la notificación se **guarda en tu cuenta** en la nube; el badge
     ☁ indica si ya subió o quedó pendiente). **Guardar todas en mi cuenta** (tarjeta 02) las sube todas.
     Elige otra orden en el desplegable y repite.
   - En la orden abierta puedes **Copiar al portapapeles** toda la plantilla o **Descargar este `.txt`**
     (nombre `OT-TAG.txt`).
   - Cuando termines, **Descargar todos (.zip)** genera todas las plantillas en un ZIP.
   - **Tu trabajo se guarda solo**: las órdenes cargadas y las ediciones se conservan en el navegador y se
     **restauran al reabrir**. **Vaciar sesión** (tarjeta 02) empieza de cero.
   - **Al cerrar la página con trabajo sin guardar en tu cuenta** (notificaciones o reportes de calibración que
     editaste, o una base grabada en línea sin descargar), el navegador pregunta si quieres salir. Si eliges
     **quedarte**, se abre la ventana **"Guarda tu trabajo antes de salir"** con la lista de lo pendiente y el botón
     **Guardar todo en mi cuenta** (y **Descargar base actualizada** si aplica). Los navegadores no permiten mostrar
     esa ventana en el mismo momento de cerrar, por eso primero aparece su aviso estándar. **Cerrar sesión** con
     trabajo sin guardar abre la misma ventana (con *Cerrar sesión sin guardar*).

## Reporte de calibración (pestaña 2)
Genera el **INSTRUMENTO INFORME DE CALIBRACIÓN** en PDF, con la **misma estructura** que el que produce
DPCTrack2, a partir de un TAG.
1. Abre la pestaña **Reporte de calibración**, escribe el **TAG** (p. ej. `PT-U7122`) y pulsa **Buscar**.
2. La app **autollena todo** desde la base de calibración: fabricante, modelo, serie, estado, ubicación,
   departamento, empresa, tipo de calibración, certificado, temperatura, humedad, técnico, las
   **especificaciones** (precisión, puntos nominales de entrada/salida y sus unidades) y los **patrones
   utilizados** en el último reporte (con fabricante, modelo, serie y fechas de calibración). Todos esos
   campos quedan **editables**.
3. **Lo único que ingresas a mano son los valores de calibración**: por cada punto, **Enc. como** (as-found)
   y **Dejado como** (as-left). Vienen prellenados con el valor nominal (calibración ideal); cambia solo los
   que difieran.
4. Automáticamente se calculan: la **salida nominal** (de la base), el **% de desviación** y el resultado
   **Aprobado/Fallado** de cada punto (según los límites y el tipo de precisión de la base).
5. Pulsa **Generar reporte (PDF)**: se abre el diálogo de impresión del navegador → elige **"Guardar como
   PDF"**. El formato impreso es idéntico al informe original de DPCTrack (misma cabecera, cajas y tablas).

> Los datos salen de la misma base incrustada (o del `datos_calibracion.json` adjunto). Si el TAG no está,
> avisa y no inventa nada.

**Por lote:** al **procesar el pegado o el Excel** en Notificaciones se generan también los reportes de
todos los instrumentos que estén en la base; en la pestaña de reporte hay un **desplegable** para revisarlos
y editarlos uno por uno.

**Descargar PDF:** además de *Generar reporte (PDF)* (diálogo de impresión, vectorial), hay
**Descargar reporte (PDF)** (baja directo el del instrumento actual) y **Descargar todos (PDF)** (baja
**un PDF por instrumento**).

**Guardar en mi cuenta:** *Guardar en mi cuenta* guarda el reporte actual (con tus ediciones) en tu cuenta;
*Guardar todos en mi cuenta* sube todo el lote. Los campos **Quién realizó la calibración** y **Finalizado
por** se autollenan con el usuario con sesión (editables). Lo guardado se reabre desde **Mis reportes**.

**Grabar a la base de datos:** el botón abre un diálogo con dos opciones que dejan la base igual:
**(1) actualizar la base en línea** (eliges la base editable `.mdb` del PC donde estés, la página la graba y
verifica dentro del navegador, guarda la base **original** como **único respaldo** privado en la nube (con
reintentos; si no sube, deja descargar la original y la actualizada) y la **descargas** para llevarla a DPCTrack) o
**(2) descargar el JSON** con todos los instrumentos para `grabar.bat` (el flujo de siempre). El paso a paso
está en **[ACTUALIZAR-BASE-DE-DATOS.md](ACTUALIZAR-BASE-DE-DATOS.md)**.

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

En la tarjeta **03 · Mapeo** (al final de la pestaña Notificaciones) puedes agregar/corregir prefijos, **exportar/importar** el mapeo
como JSON y **restablecer**. Los cambios se guardan en tu navegador (localStorage, clave `noti_mapping_v12`).
El **TAG** es el primer dato que mezcla letras y números (p. ej. `PT-3110`, `3110-PT-001`, `PT-U2411`),
aunque lleve delante el código de área o de planta.

## Cuenta, aprobación y guardado en la nube
La app pide **iniciar sesión** (correo y contraseña). Funciona así:
1. **Registro**: pulsa *Regístrate*, escribe tu **nombre completo** (así saldrá en los reportes), correo y
   contraseña (mínimo 8). La cuenta queda **pendiente de aprobación**.
2. **Aprobación**: un **administrador** entra a la pestaña **Usuarios** y pulsa **Aprobar** (también puede
   revocar o dar rol de administrador). Mientras tanto verás la pantalla *"Cuenta pendiente"*; pulsa
   **Volver a comprobar** cuando te avisen.
3. **Uso**: con la cuenta aprobada, tu nombre **autollena** *Trabajo realizado por* (notificaciones) y
   *Quién realizó la calibración* / *Finalizado por* (reportes); todos siguen editables.
4. **Guardar en mi cuenta**: cada notificación (botón de la orden o *Guardar todas en mi cuenta*) y cada
   reporte de calibración (*Guardar en mi cuenta* / *Guardar todos en mi cuenta*) se guardan en la nube
   atribuidos a tu usuario. Volver a guardar la misma orden/TAG **actualiza** el registro (no duplica).
5. **Mis reportes**: lista lo guardado (tipo, TAG, OT, fecha). **Abrir** lo carga en su pestaña para seguir
   editando; **PDF / JSON / .txt** lo descargan tal como se guardó; **Eliminar** lo borra. El administrador
   ve los reportes de **todos** los usuarios (con filtro por usuario).
6. **Sin internet**: si ya iniciaste sesión en ese navegador, entras igual y puedes generar `.txt`/PDF/ZIP.
   Al guardar aparece *"pendiente de subir"*; se **sube solo al volver la conexión** (o con *Reintentar
   ahora* en Mis reportes). Iniciar sesión por primera vez y consultar Mis reportes sí requieren internet.
7. **Cerrar sesión** (botón de la cabecera) borra la sesión de ese navegador. La sesión de trabajo local
   (órdenes cargadas) es **por usuario**: no se mezcla con la de otra cuenta en el mismo PC.

> El login protege lo que se guarda en tu cuenta y atribuye cada reporte a quien lo hizo. Los datos de
> calibración y el mapeo van incrustados en la página (son públicos en el repo), como antes.

## Configurar Supabase (una vez)
El backend es un proyecto gratuito de [Supabase](https://supabase.com) (Postgres + autenticación). Pasos:
1. Crea un proyecto en supabase.com (región cercana; la contraseña de la base de Postgres no se usa en la app).
2. **SQL Editor** → pega el contenido de **`supabase/schema.sql`** → *Run*. Crea `profiles`, `reportes`, el
   trigger que da de alta el perfil al registrarse (pendiente) y las políticas RLS (cada usuario solo lo suyo;
   solo aprobados guardan; administradores ven todo y aprueban).
3. **Authentication → Providers → Email**: *Enable* ON y **Confirm email OFF** (la aprobación del
   administrador es el filtro). **Sign In / Providers**: *Allow new users to sign up* ON.
   **URL Configuration → Site URL**: `https://luisrico5.github.io/notificaciones-trabajo/`.
4. **Project Settings → API**: copia **Project URL** y **anon public key** y pégalos en
   `src/part_tail.html` (`SB_URL` y `SB_ANON_KEY`); reconstruye (`build.ps1`) y publica. Hasta que lo hagas,
   la pantalla de acceso avisa *"Falta configurar la conexión a Supabase"*. La anon key es pública por diseño
   (los datos los protege RLS); la **`service_role` key nunca** va en la app ni en el repo.
5. **Primer administrador**: regístrate desde la app con tu correo y en el SQL Editor ejecuta
   `update public.profiles set role='admin', approved=true where email='TU_CORREO';`. Desde ese momento
   verás la pestaña **Usuarios**.
6. **Respaldo de la base en la nube** (para "Grabar a la base de datos" en línea): en el SQL Editor ejecuta la
   sección final de `supabase/schema.sql` (*RESPALDO EN LA NUBE DE LA BASE DPCTrack ORIGINAL*). Crea el bucket
   **privado** `respaldo-base` (un único archivo `base_original.mdb.gz`), sus políticas (solo usuarios aprobados)
   y la tabla de una fila `respaldo_base`. Se puede ejecutar de nuevo sin problema.

> Plan gratuito: el proyecto se **pausa tras ~7 días sin uso** (botón *Restore* en el dashboard); mientras
> está pausado la app se comporta como "sin conexión". Eliminar un usuario en *Authentication → Users*
> borra también sus reportes guardados.

## Base de calibración (rangos, salidas, patrones, técnico, indicación)
Estos datos (y los **reportes que se abren por defecto** al poner una orden o un TAG) vienen incrustados en
`index.html` desde la base DPCTrack2, pero **se mantienen actualizados solos para todos los usuarios**:
- **Al grabar en línea** ("Grabar a la base de datos", Opción 1), la página lee los datos de la base **ya
  actualizada** y los comparte en la nube (un único archivo privado, solo usuarios aprobados).
- **Tarjeta 03 · Mapeo → Base de calibración → "Actualizar desde base .mdb"**: eliges una base y solo se leen sus datos
  (la base no se modifica); también se comparten. Útil si se calibró directo en DPCTrack.
- Cada técnico recibe los datos compartidos **al abrir la app** (y al volver la conexión). Sin internet sigue con
  los últimos que recibió; lo que se leyó sin conexión se comparte después.
- **Nunca retrocede:** si la base es más vieja (su última calibración tiene un número menor) que la de los datos
  vigentes, no se reemplazan y se avisa.
- Es el mismo resultado que `src/extract_ranges.ps1` (port verificado: contenido idéntico en tres bases distintas).

Alternativa manual (sin nube), como antes:
1. Ejecuta el extractor sobre la base nueva (genera `datos_calibracion.json`):
   ```
   powershell -ExecutionPolicy Bypass -File src\extract_ranges.ps1 -Mdb "ruta\base_nueva.mdb" -Password "<clave>"
   ```
2. En la tarjeta **03 · Mapeo → Base de calibración**, **adjunta** ese `datos_calibracion.json`. Se guarda
   en tu navegador y **manda sobre los datos incrustados** (los TAG que no incluya usan los incrustados).
   "Volver a los datos incrustados" descarta el archivo adjuntado.

> Para dejar los datos nuevos incrustados en la página (valor por defecto sin nube), reconstruye `index.html`
> después del paso 1.

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
  grabar_mdb.js       Escritor de la base .mdb para "Grabar a la base de datos" en línea. GENERADO por mdbwriter/build.sh.
  grabar_reporte.ps1  Graba el JSON del botón en la base editable (lo usa grabar.bat).
  build_config.py     Regenera el mapeo desde src/answers/ (resúmenes de NotebookLM).
  extract_ranges.ps1  Lee la base .mdb y vuelca rango/salida/patrones/técnico/indicación por TAG.
  answers/            Resúmenes de cada procedimiento P-SG (fuente del mapeo).
datos_calibracion.json   Datos de calibración portables (para adjuntar en la app). Generado.
supabase/schema.sql   Esquema de cuentas y reportes (tablas, trigger de perfil, RLS). Se pega en Supabase. Sin secretos.
mdbwriter/            Fuentes del escritor en línea: port de grabar_reporte.ps1 (Java) + Jackcess parcheado → JavaScript (TeaVM).
20260810_dpctrack2_backup.mdb   Base DPCTrack2 (con contraseña). NO publicar.
zzz/                Binarios del programa DPCTrack2 (referencia). NO publicar.
```
`index.html` se arma juntando `part_head.html` + `xlsx.full.min.js` + `html2pdf.bundle.min.js` + `grabar_mdb.js` + `part_tail.html`.

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
  **03 · Mapeo** (se guarda en tu navegador; puedes exportar el JSON como respaldo).
- **Cambiar los valores por defecto de un prefijo de forma permanente** → edita el objeto de ese prefijo
  en `DEFAULT_MAP_ARR` dentro de `src/part_tail.html`, **sube la versión** `STORE_KEY`
  (`noti_mapping_vN` → `vN+1`, para que no quede oculto por el `localStorage` anterior) y reconstruye.
- **Agregar un prefijo nuevo** → añádelo a `DEFAULT_MAP_ARR` (o desde la tarjeta 03 · Mapeo de la app).
- **Regenerar los procedimientos desde NotebookLM** (si cambian los PDFs de los tableros
  *notificaciones* / *notificaciones 1*): actualiza `src/answers/proc_<código>.txt`, ajusta las
  asignaciones en `src/build_config.py`, ejecuta `python src/build_config.py` (reescribe `part_tail.html`)
  y reconstruye. Detalle paso a paso en `CLAUDE.md`.
- **Actualizar los datos de calibración** (rango/salida/patrones/técnico/indicación): ejecuta
  `src/extract_ranges.ps1` sobre la base nueva y **adjunta** el `datos_calibracion.json` en la app, o
  reconstruye para incrustarlos. Ver la sección *Base de calibración*.
- **Cambiar cómo se graba la base** → cambia **los dos caminos juntos**: `src/grabar_reporte.ps1` (grabar.bat) y
  su port `mdbwriter/app/.../GrabarMdb.java` (en línea); luego `bash mdbwriter/build.sh` (regenera
  `src/grabar_mdb.js`), `build.ps1`, y la prueba de fidelidad `mdbwriter/test/run_case.sh`. Ver `mdbwriter/README.md`.

> Detalles de arquitectura, funciones clave y cómo verificar sin navegador: ver **`CLAUDE.md`**.

## Publicar en GitHub Pages
El sitio está publicado en **https://luisrico5.github.io/notificaciones-trabajo/** (repo
`luisrico5/notificaciones-trabajo`, *Settings → Pages → Deploy from branch → main / root*). Cada `git push`
a `main` actualiza la página en un momento.
- Se suben `index.html`, `README.md`, `CLAUDE.md`, `src/`, `build.*`, `supabase/schema.sql`, `mdbwriter/`
  (sin `work/` ni `app/target/`) y `datos_calibracion.json`. **No subas** la base `*.mdb`, la carpeta `zzz/`, los `grabar_*.json`, el
  `grabar.bat` ni la contraseña de la base: el `.gitignore` ya los excluye.
- `SB_URL` y `SB_ANON_KEY` (la **anon key** pública de Supabase) sí van en `src/part_tail.html`: es lo
  previsto, los datos los protege RLS. La **`service_role` key nunca** va en la app ni en el repo.
- Los datos de calibración quedan incrustados en `index.html`, así que el sitio no necesita la base.
