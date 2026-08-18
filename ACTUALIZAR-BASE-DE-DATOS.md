# Cómo actualizar la base de datos con un reporte (JSON → DPCTrack2)

Guía para **grabar en la base de datos** las calibraciones generadas en el dashboard, de modo que
**DPCTrack2** las lea y produzca el reporte idéntico.

> ⚠️ El navegador **no puede** escribir el `.mdb` (Access cifrado, sin servidor). Por eso el botón del
> dashboard **descarga un JSON** y un script de PowerShell lo inserta en la base. Es un proceso de 2 pasos.

---

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
| `OMITIDO <tag> (sin calibración previa de plantilla)` | Ese instrumento no tiene historial en la base; no se puede armar la plantilla. Normal para equipos nuevos. |
| `type mismatch` / error al insertar | Reintenta; el script fija el tipo de cada columna desde el esquema. Si persiste, revisa que el JSON no venga corrupto. |
| En **DPCTrack**: `clave duplicada` / `violación de la llave` al crear/guardar una calibración | El **contador interno** de DPCTrack (tabla `IDs`, `LastID`) quedó por debajo del `MAX` real y DPCTrack intentó reusar un `CalibrationID`/`NoteID` ya insertado. El script (a partir de esta versión) **sube ese contador** al grabar, así que no debería volver a pasar. Para reparar una base afectada: `UPDATE IDs SET LastID=(SELECT MAX(CalibrationID) FROM CALIBRAT) WHERE TABLENAME='CALIBRAT'` y lo mismo con `PCNOTES`/`MAX(NoteID)` sobre la base **editable**. |

---

*Referencia rápida:* botón que genera el JSON = **"Grabar a la base de datos"** (pestaña *Reporte de
calibración*). Script que lo inserta = **`src\grabar_reporte.ps1`**.
