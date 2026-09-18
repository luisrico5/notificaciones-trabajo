# Cómo actualizar la base de datos con un reporte (JSON → DPCTrack2)

Guía para **grabar en la base de datos** las calibraciones generadas en el dashboard, de modo que
**DPCTrack2** las lea y produzca el reporte idéntico.

Al pulsar **"Grabar a la base de datos"** (pestaña *Reporte de calibración*) se abre un diálogo con **dos
opciones que dejan la base exactamente igual**:

- **Opción 1 · Actualizar la base aquí mismo (en línea):** eliges la base editable `.mdb` del PC donde estés,
  la página la actualiza dentro del navegador, guarda la base **original** como respaldo en la nube y la
  descargas lista para DPCTrack. No hace falta PowerShell, `grabar.bat` ni la clave.
- **Opción 2 · Descargar el JSON (para grabar.bat):** el flujo de siempre, descrito más abajo.

---

## Opción 1 · Actualizar la base en línea (desde la página)

1. Pulsa **"Grabar a la base de datos"**. El diálogo muestra cuántos instrumentos se van a grabar.
2. **Elegir base .mdb** → selecciona la base **editable** de DPCTrack2 de ese PC.
3. **Grabar en la base** → la página graba todo (tarda unos segundos; la página sigue respondiendo). Al terminar
   muestra el mismo resumen que `grabar.bat` (`OK <tag> -> CalibrationID=…`, `spec actualizada…`,
   `OMITIDO …`) y la línea **"Verificación: OK"**.
4. **Respaldo automático en la nube** → antes de dejarte descargar, la página sube la base **original** (tal como
   la elegiste, antes de grabar) comprimida a la nube de la app. Verás *"Respaldo de la base original guardado en
   la nube"*. Si no hay internet o Supabase no responde, lo **reintenta 3 veces**; si aun así no sube, te deja
   **Reintentar respaldo** o descargar **la base original** (con `_ORIGINAL_<fecha>` en el nombre, guárdala como
   respaldo) **y la actualizada**.
5. **Descargar base actualizada** → se descarga con **el mismo nombre** que la que elegiste (normalmente en
   *Descargas*). Llévala a la carpeta de DPCTrack **reemplazando la anterior** y ábrela en DPCTrack2.
6. **Reportes por defecto al día** → además, la página lee de la base **ya actualizada** los datos con que se
   autollenan las notificaciones y los reportes al poner una orden o un TAG (rangos, patrones, técnico, puntos,
   notas…) y los **comparte con todos los usuarios**. El diálogo lo confirma con *"Reportes por defecto actualizados…
   y compartidos"*. Si la base que grabaste es más vieja que los datos vigentes, no se reemplazan y se avisa.
   (También puedes hacerlo sin grabar: tarjeta 03 · Mapeo, al final de la pestaña Notificaciones → **Actualizar desde base .mdb**.)

### Respaldo en la nube (la base original)

- **Siempre hay UNO solo:** es la base **original del último grabado en línea**. Cada grabado nuevo lo
  **reemplaza** (el anterior solo desaparece cuando el nuevo terminó de subir, así nunca te quedas sin respaldo).
  Si un grabado falla o se omiten todos los instrumentos, el respaldo **no se toca**.
- **Privado:** lo pueden subir y descargar solo los **usuarios aprobados** de la app. Va comprimido (una base de
  81 MB ocupa unos 6 MB) y con su huella SHA-256.
- **Para volver atrás:** en el mismo diálogo, sección **Respaldo en la nube**, pulsa **Descargar respaldo de la nube**.
  Baja como `<nombre>_ORIGINAL_<aaaa-mm-dd_hhmm>.mdb` y la página comprueba su huella. **Renómbrala** quitando
  `_ORIGINAL_…` y ponla en la carpeta de DPCTrack en lugar de la actual.
- Requiere haber ejecutado una vez la sección de respaldo de `supabase/schema.sql` (ver README, *Configurar
  Supabase*). Si falta, la página lo dice y ofrece descargar original y actualizada.

Cómo funciona y por qué es seguro:

- **Misma lógica que `grabar.bat`:** la página arma **el mismo JSON** que descarga la Opción 2 y lo graba con
  un port de `src\grabar_reporte.ps1` (plantilla = última calibración, `CALIBRAT`/`CalGroups`/`CALDET`/
  `CALTEST`/`PCNotes`, **especificación** `InstSpecGroup`+`INSTSPEC` y contador **`IDs`**). Se probó grabando
  los mismos JSON reales con ambos caminos: las 8 tablas quedan **idénticas fila por fila**.
- **En memoria del navegador:** la base se lee y se graba **en el navegador**; a la nube solo sube la base
  **original** como respaldo privado (ver arriba). El archivo del PC **no se modifica**: lo que descargas es una
  copia actualizada.
- **Autoverificación:** antes de ofrecer la descarga, la página reabre la base grabada y comprueba conteos de filas,
  todos los índices de las tablas tocadas y que cada calibración nueva esté completa. Si algo no cuadra, **no ofrece
  la descarga** y dice "No se grabó nada".
- **La contraseña de la base se conserva** (no se necesita para grabar y la base sigue pidiéndola).
- **Nunca sobre la _backup:** si el nombre del archivo contiene "backup", la página se niega (igual que `grabar.bat`).
- Si un instrumento no tiene calibración previa en esa base, se **omite con aviso** (igual que el script). Si se
  omiten todos, no se ofrece descarga porque no hubo cambios.
- Requiere un navegador de escritorio actualizado (Chrome/Edge). Funciona desde GitHub Pages y abriendo
  `index.html` local. Si algo falla, usa la Opción 2.

---

## Opción 2 · JSON + grabar.bat / PowerShell

> El botón **descarga un JSON** y un script de PowerShell lo inserta en la base (con el motor de Access del PC).
> Es un proceso de 2 pasos. Es el flujo original y sigue disponible sin cambios.

## Resumen del flujo

```
Dashboard (pestaña Reporte)                     PowerShell                      DPCTrack2
  ── "Grabar a la base de datos" ──►  grabar_<...>.json  ──►  src\grabar_reporte.ps1  ──►  base editable.mdb  ──►  reporte
```

1. En el dashboard generas/editas los reportes y pulsas **"Grabar a la base de datos"** → se descarga
   un archivo `grabar_calibraciones_<fecha>.json` (o `grabar_<tag>_<fecha>.json`) con **uno o varios** instrumentos.
2. Ejecutas el script `src\grabar_reporte.ps1` pasándole ese JSON → inserta las calibraciones en la
   **base editable**.
3. Abres la base editable en DPCTrack2 y generas el reporte del instrumento.

---

## Requisitos

- **Windows con PowerShell** (el que trae Windows sirve).
- **Microsoft Access Database Engine** (proveedor `Microsoft.ACE.OLEDB`), normalmente ya instalado con
  Office/DPCTrack. El script prueba las versiones 16.0 y 12.0.
- La **base editable**: `20260810_dpctrack2_editable.mdb` (copia de trabajo de la base). El script escribe
  **solo** en esta, nunca en la `_backup`.
- La **contraseña** de la base (la misma que la original; está en `zzz\PasswordReset.exe`).

---

## Paso a paso

1. Ubica el JSON descargado. Por defecto el navegador lo guarda en **Descargas**
   (`C:\Users\<usuario>\Downloads\grabar_calibraciones_<fecha>.json`). Puede quedarse ahí o moverlo a donde
   te sea cómodo — el archivo **puede ir en cualquier carpeta**, solo hay que apuntarle la ruta a `-Json`.

2. Abre **PowerShell** en la carpeta del proyecto (`c:\noti`) y ejecuta, usando la **ruta real** del JSON:

   ```powershell
   # si el JSON está en Descargas:
   powershell -ExecutionPolicy Bypass -File src\grabar_reporte.ps1 -Json "C:\Users\Dell\Downloads\grabar_calibraciones_14082026.json" -Password "<clave>"

   # o si lo copiaste al proyecto (p. ej. dentro de src\):
   powershell -ExecutionPolicy Bypass -File src\grabar_reporte.ps1 -Json "src\grabar_calibraciones_14082026.json" -Password "<clave>"
   ```

   - Cambia el nombre/ruta del JSON por el tuyo (el error `No se encuentra la ruta de acceso` significa
     que la ruta de `-Json` está mal — usa la **ruta completa** del archivo).
   - Reemplaza `<clave>` por la contraseña de la base.
   - Si tu base editable tiene otro nombre/ruta, añade `-Mdb "ruta\a\tu_base_editable.mdb"`.
   - Los `grabar_*.json` están en `.gitignore`, así que no se suben al repo aunque los dejes en el proyecto.

3. El script muestra algo como:

   ```
   Base editable: C:\noti\20260810_dpctrack2_editable.mdb
   Instrumentos en el archivo: 3
     OK LT-WA02  -> CalibrationID=6938, NoteID=6147 (plantilla=6853, grupos=1, patrones=2)
     OK PT-DR51  -> CalibrationID=6939, NoteID=6148 (plantilla=6872, grupos=1, patrones=3)
     OK WT-DR700 -> CalibrationID=6940, NoteID=6149 (plantilla=4176, grupos=1, patrones=1)
   LISTO. Insertados: 3  |  omitidos (sin plantilla): 0
   ```

4. Abre **`20260810_dpctrack2_editable.mdb` en DPCTrack2** y genera el reporte del/los instrumento(s).
   La calibración grabada queda como la **más reciente**, así que es la que DPCTrack toma.

---

## Qué hace el script (para que quede fiel)

- Usa la **última calibración del mismo instrumento como plantilla** y **copia todas las columnas** de
  `CALIBRAT`, `CalGroups` y `CALDET` (así se conserva la estructura exacta que DPCTrack espera).
- **Sobrescribe solo lo nuevo**: IDs (`CalibrationID`/`NoteID` = `MAX+1`), fecha, técnico, temperatura,
  humedad, tipo, certificado, la **lectura Enc./Dejado** de cada punto (`Reading`), el resultado
  (`RESULTSTATUS`/`Failed` según los límites), los **patrones** (`CALTEST`) y la **nota** (`PCNotes`).
- **Actualiza la ESPECIFICACIÓN del instrumento** (`InstSpecGroup` + `INSTSPEC`) con el **N.º de puntos**,
  los **nominales** y los **rangos** (mín/máx de entrada y salida) del reporte. Esto es necesario porque
  **DPCTrack arma el reporte desde la especificación, no desde la calibración**: sin esto, si cambiabas los
  puntos o el rango en el dashboard, DPCTrack seguía mostrando la configuración vieja. Para grabar **solo la
  calibración sin tocar la especificación**, añade el modificador **`-NoSpec`**.
- Acepta **uno o varios** instrumentos (el JSON del botón trae todo el lote).
- Todo se hace en **una sola transacción**: o entra completo, o no entra nada.
- **La contraseña de la base NO se toca**: se abre con ella y queda igual.

---

## Notas y advertencias

- **Solo escribe en la base editable.** La base `20260810_dpctrack2_backup.mdb` es de **solo consulta** —
  el script nunca la modifica.
- **Instrumentos omitidos:** si un instrumento **no tiene ninguna calibración previa** en la base (no hay
  plantilla que copiar), el script lo **omite con aviso** (`omitidos (sin plantilla)`). El resto sí entra.
- **Certificado:** el número que aparezca en el reporte es el que se graba. Ponle uno correcto/único antes
  de grabar si aplica.
- **Deshacer una carga:** si necesitas revertir, se borran las filas insertadas por `CalibrationID`
  (y la `PCNotes` por `NoteID`) en `CALDET`, `CalGroups`, `CALTEST`, `CALIBRAT` y `PCNotes`.
- **Cambio de especificación:** al grabar (sin `-NoSpec`), el script cambia la **spec vigente** del
  instrumento (`InstSpecGroup` + `INSTSPEC`) para que coincida con el reporte. Es lo que hace que DPCTrack
  muestre los puntos/rangos nuevos. Si solo quieres registrar la calibración sin alterar la spec del
  instrumento, usa **`-NoSpec`**.

---

## Solución de problemas

| Mensaje | Causa / solución |
|---|---|
| `No se pudo abrir la base editable (revisa -Password)` | Contraseña incorrecta o proveedor ACE ausente. Verifica la clave y que Access/ACE esté instalado. |
| `OMITIDO <tag> (no esta en el maestro de instrumentos de la base)` | Ese TAG no existe en la base (tabla de instrumentos). Hay que darlo de alta en DPCTrack antes de grabarle calibraciones. |
| `PRIMERA calibracion, molde=<id> de otro instrumento` | El equipo existe pero nunca se le habia grabado una calibracion: se crea desde cero (y su especificacion, si falta) usando otra calibracion solo como molde de formato. |
| `type mismatch` / error al insertar | Reintenta; el script fija el tipo de cada columna desde el esquema. Si persiste, revisa que el JSON no venga corrupto. |
| En **DPCTrack**: `clave duplicada` / `violación de la llave` al crear/guardar una calibración | El **contador interno** de DPCTrack (tabla `IDs`, `LastID`) quedó por debajo del `MAX` real y DPCTrack intentó reusar un `CalibrationID`/`NoteID` ya insertado. El script (a partir de esta versión) **sube ese contador** al grabar, así que no debería volver a pasar. Para reparar una base afectada: `UPDATE IDs SET LastID=(SELECT MAX(CalibrationID) FROM CALIBRAT) WHERE TABLENAME='CALIBRAT'` y lo mismo con `PCNOTES`/`MAX(NoteID)` sobre la base **editable**. |

---

| En la página: `No se grabó nada. … parece la _backup` | Elegiste la base de solo consulta. Elige la base **editable**. |
| En la página: `No se pudo guardar el respaldo en la nube` | Sin internet, Supabase pausado (botón *Restore* en su dashboard), cuenta sin aprobar o falta ejecutar la sección de respaldo del SQL. Pulsa *Reintentar respaldo*, o descarga la **original** y la **actualizada** y guarda la original como respaldo. |
| En la página: `La base cambió en el disco desde que la elegiste` | DPCTrack (o alguien) modificó la base mientras se grababa. No descargues nada: cierra DPCTrack, vuelve a elegir la base y graba de nuevo. |
| En la página: `No se grabó nada. <mensaje>` | La base no se pudo abrir/grabar/verificar (archivo que no es de DPCTrack2, dañado, o memoria insuficiente). La base original no cambió; usa la Opción 2. |

---

*Referencia rápida:* botón = **"Grabar a la base de datos"** (pestaña *Reporte de calibración*). Opción 1 =
grabado en línea (`src\grabar_mdb.js`, generado desde `mdbwriter/`). Opción 2 = JSON que inserta
**`src\grabar_reporte.ps1`** (vía `grabar.bat`).
