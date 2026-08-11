# extract_ranges.ps1 — Extrae de la base de calibración DPCTrack2 (.mdb Jet 4), por cada TAG:
#   - rango (señal de entrada) y salida (señal de salida)  [tabla INSTSPEC, grupo primario]
#   - patrones utilizados en el reporte de calibración MÁS RECIENTE  [CALIBRAT + CALTEST + TESTINST]
# y produce dos salidas con los MISMOS datos:
#   1) inyecta `var TAG_RANGES={...}` en src/part_tail.html (datos por defecto incrustados en index.html)
#   2) escribe c:\noti\datos_calibracion.json (portable) para adjuntar en el dashboard a futuro.
#
#   powershell -ExecutionPolicy Bypass -File src\extract_ranges.ps1 -Password "<clave>"
#   powershell -ExecutionPolicy Bypass -File build.ps1
#
# Para actualizar en el futuro: apunta -Mdb a la base nueva, ejecuta y adjunta el .json en la tarjeta 02
# ("Base de calibración") — o reconstruye para dejarlo incrustado. Toda la lógica se conserva; solo
# cambian los datos. Nunca se inventa: el TAG sin datos simplemente no se incluye.

[CmdletBinding()]
param(
  [string]$Mdb      = "c:\noti\20260810_dpctrack2_backup.mdb",
  [string]$Password = "",
  [switch]$Inspect
)

$ErrorActionPreference = "Stop"
$Mdb = (Resolve-Path $Mdb).Path
$tailPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "part_tail.html"
$esES = [System.Globalization.CultureInfo]::GetCultureInfo("es-ES")

function New-Conn {
  foreach ($p in @("Microsoft.ACE.OLEDB.16.0", "Microsoft.ACE.OLEDB.12.0")) {
    $cs = "Provider=$p;Data Source=$Mdb;"
    if ($Password -ne "") { $cs += "Jet OLEDB:Database Password=$Password;" }
    try { $c = New-Object System.Data.OleDb.OleDbConnection $cs; $c.Open(); return $c }
    catch { Write-Host ("  " + $p + " -> " + $_.Exception.InnerException.Message) }
  }
  throw "No se pudo abrir la base (revisa -Password)."
}
function Q($conn, $sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql
  $da = New-Object System.Data.OleDb.OleDbDataAdapter $cmd
  $dt = New-Object System.Data.DataTable; [void]$da.Fill($dt)
  return , $dt   # coma: evita que PowerShell desenrolle la DataTable en filas
}

$conn = New-Conn
Write-Host "Base abierta: $Mdb"

if ($Inspect) {
  Write-Host "`nMuestra INSTRMNT:"; Q $conn "SELECT TOP 8 INSTRUMENTCODE, INSTRUMENTNAME, INSTRUMENTTYPE FROM INSTRMNT" | Format-Table -AutoSize -Wrap
  Write-Host "`nMuestra rango (INSTSPEC grupo 1):"; Q $conn "SELECT TOP 12 INSTRUMENTCODE, INPUTSIGNALTYPE, MIN(InputSignal) AS lo, MAX(InputSignal) AS hi FROM INSTSPEC WHERE GroupNumber=1 GROUP BY INSTRUMENTCODE, INPUTSIGNALTYPE" | Format-Table -AutoSize -Wrap
  $conn.Close(); exit 0
}

# Grupo primario de cada instrumento (el menor GroupNumber con datos).
$grp = @{}
foreach ($r in (Q $conn "SELECT INSTRUMENTCODE, MIN(GroupNumber) AS g FROM INSTSPEC GROUP BY INSTRUMENTCODE").Rows) {
  if ($r['INSTRUMENTCODE'] -isnot [DBNull]) { $grp[[string]$r['INSTRUMENTCODE']] = [int]$r['g'] }
}
# min/max de la señal de entrada (rango) y de salida, con sus unidades, por instrumento y grupo.
$dt = Q $conn ("SELECT INSTRUMENTCODE, GroupNumber, INPUTSIGNALTYPE, OUTPUTSIGNALTYPE, " +
  "MIN(InputSignal) AS iLo, MAX(InputSignal) AS iHi, MIN(OutputSignal) AS oLo, MAX(OutputSignal) AS oHi " +
  "FROM INSTSPEC GROUP BY INSTRUMENTCODE, GroupNumber, INPUTSIGNALTYPE, OUTPUTSIGNALTYPE")
$conn.Close()

function NormTag($t) { ((([string]$t)).ToUpper() -replace '[^A-Z0-9]', '') }
function Num($v) {
  if ($null -eq $v -or $v -is [DBNull]) { return $null }
  return ([double]$v).ToString("0.####", $esES)   # coma decimal, sin ceros sobrantes (es-ES)
}
function Rango($lo, $hi, $unit) {   # "lo a hi unit" o "" si no hay rango real (nunca se inventa)
  $a = Num $lo; $b = Num $hi
  if ($null -eq $a -or $null -eq $b -or $a -eq $b) { return "" }
  $u = ([string]$unit).Trim()
  $t = "$a a $b"; if ($u -ne "") { $t += " $u" }
  return $t
}

$mapa = @{}
foreach ($r in $dt.Rows) {
  $code = [string]$r['INSTRUMENTCODE']
  if (-not $grp.ContainsKey($code)) { continue }
  if ([int]$r['GroupNumber'] -ne $grp[$code]) { continue }      # solo el grupo primario
  $rango  = Rango $r['iLo'] $r['iHi'] $r['INPUTSIGNALTYPE']     # entrada = rango del instrumento
  $salida = Rango $r['oLo'] $r['oHi'] $r['OUTPUTSIGNALTYPE']    # salida escalada
  $k = NormTag $code
  if ($k -ne "" -and -not $mapa.ContainsKey($k)) { $mapa[$k] = @{ r = $rango; s = $salida; p = @() } }
}

# --- Patrones utilizados en el reporte de calibración MÁS RECIENTE de cada instrumento ---
# CALIBRAT = reportes (ITEMCODE, CalibrationDate); CALTEST = patrones por reporte; TESTINST = maestro.
$conn2 = New-Conn
$cal = Q $conn2 "SELECT ITEMCODE, CalibrationID, CalibrationDate, WHOCALIBRATED, NoteID FROM CALIBRAT WHERE ITEMTYPE='Instrument'"
$latest = @{}   # ITEMCODE -> @{cid; date; by; hasDate; note}
foreach ($r in $cal.Rows) {
  $code = [string]$r['ITEMCODE']; if ($code -eq '') { continue }
  $cid = [int]$r['CalibrationID']; $dv = $r['CalibrationDate']
  $hasDate = ($dv -isnot [DBNull])
  $d = if ($hasDate) { [datetime]$dv } else { [datetime]::MinValue }
  if (-not $latest.ContainsKey($code) -or $d -gt $latest[$code].date -or ($d -eq $latest[$code].date -and $cid -gt $latest[$code].cid)) {
    $by = if ($r['WHOCALIBRATED'] -is [DBNull]) { '' } else { ([string]$r['WHOCALIBRATED']).Trim() }
    $nid = if ($r['NoteID'] -is [DBNull]) { $null } else { [int]$r['NoteID'] }
    $latest[$code] = @{ cid = $cid; date = $d; by = $by; hasDate = $hasDate; note = $nid }
  }
}
# Notas de calibración: NoteID -> texto. La indicación con que se dejó el equipo se extrae con regex
# de la nota del reporte MÁS RECIENTE (frases tipo "se dejó con indicación de <valor>").
$notes = @{}
foreach ($r in (Q $conn2 "SELECT NoteID, Note FROM PCNotes").Rows) {
  if ($r['NoteID'] -isnot [DBNull]) { $notes[[int]$r['NoteID']] = [string]$r['Note'] }
}
# ó = 'o con tilde' por Unicode: evita depender de la codificacion del .ps1 (PS 5.1 lo lee como ANSI,
# lo que corrompia la vocal acentuada y hacia fallar el match en notas como "indicacion").
$reInd = [regex]'(?i)indicaci\S?n\s+de\s+(?:entrega\s+)?([-+]?\d+(?:[.,]\d+)?\s*[^\s.,;:]{0,12})'
function IndicacionDe($nid) {
  if ($null -eq $nid -or -not $notes.ContainsKey($nid)) { return '' }
  $m = $reInd.Match($notes[$nid])
  if ($m.Success) { return ($m.Groups[1].Value -replace '\s+', ' ').Trim() }
  return ''
}
$ct = Q $conn2 "SELECT t.CalibrationID, t.TESTINSTRUMENTCODE, ti.TESTINSTRUMENTNAME FROM CALTEST t LEFT JOIN TESTINST ti ON t.TESTINSTRUMENTCODE=ti.TESTINSTRUMENTCODE"
$conn2.Close()
$byCid = @{}
foreach ($r in $ct.Rows) {
  $cid = [int]$r['CalibrationID']
  if (-not $byCid.ContainsKey($cid)) { $byCid[$cid] = @() }
  $tag = ([string]$r['TESTINSTRUMENTCODE']).Trim()
  $name = ([string]$r['TESTINSTRUMENTNAME']).Trim()
  if ($tag -ne '') { $byCid[$cid] += , @($tag, $name) }
}
$conPat = 0
foreach ($code in $latest.Keys) {
  $k = NormTag $code
  if (-not $mapa.ContainsKey($k)) { $mapa[$k] = @{ r = ''; s = ''; p = @() } }
  # Nombre del técnico, fecha (yyyy-MM-dd) e indicación con que se dejó el equipo (nota del reporte).
  $mapa[$k].by = $latest[$code].by
  $mapa[$k].d = if ($latest[$code].hasDate) { $latest[$code].date.ToString('yyyy-MM-dd') } else { '' }
  $mapa[$k].li = IndicacionDe $latest[$code].note
  $cid = $latest[$code].cid
  if ($byCid.ContainsKey($cid)) {
    $seen = @{}; $lst = @()
    foreach ($pp in $byCid[$cid]) { if (-not $seen.ContainsKey($pp[0])) { $seen[$pp[0]] = 1; $lst += , $pp } }
    if ($lst.Count) { $mapa[$k].p = $lst; $conPat++ }
  }
}
# Normalizar: toda entrada tiene by/d/li (aunque vengan de INSTSPEC sin reporte).
foreach ($k in @($mapa.Keys)) {
  if (-not $mapa[$k].ContainsKey('by')) { $mapa[$k].by = '' }
  if (-not $mapa[$k].ContainsKey('d'))  { $mapa[$k].d = '' }
  if (-not $mapa[$k].ContainsKey('li')) { $mapa[$k].li = '' }
}
# Descartar entradas totalmente vacías (sin rango, salida, patrones ni técnico).
foreach ($k in @($mapa.Keys)) { $e = $mapa[$k]; if ($e.r -eq '' -and $e.s -eq '' -and $e.p.Count -eq 0 -and $e.by -eq '') { $mapa.Remove($k) } }
Write-Host ("Instrumentos con datos: " + $mapa.Count + " | con patrones: " + $conPat)

# --- Serializar a JSON compacto por TAG: {"r":..,"s":..,"p":[[tag,desc],..]} ---
function Esc($s) { ([string]$s) -replace '\\', '\\' -replace '"', '\"' }
function TagJson($e) {
  $ps = foreach ($pp in $e.p) { '["' + (Esc $pp[0]) + '","' + (Esc $pp[1]) + '"]' }
  return '{"r":"' + (Esc $e.r) + '","s":"' + (Esc $e.s) + '","p":[' + ($ps -join ',') + ']' +
         ',"by":"' + (Esc $e.by) + '","d":"' + (Esc $e.d) + '","li":"' + (Esc $e.li) + '"}'
}
$lineas = foreach ($k in ($mapa.Keys | Sort-Object)) { '"' + $k + '":' + (TagJson $mapa[$k]) }
$cuerpo = ($lineas -join ",`r`n")

# 1) Inyectar en part_tail.html (datos incrustados por defecto en index.html).
$bloque = "var TAG_RANGES={" + "`r`n" + $cuerpo + "`r`n};"
$tail = Get-Content -Raw -Encoding UTF8 $tailPath
$re = '(?s)(/\* TAG_RANGES:INICIO \*/).*?(/\* TAG_RANGES:FIN \*/)'
if ($tail -notmatch $re) { throw "No encontre los marcadores TAG_RANGES en part_tail.html" }
$nuevo = [regex]::Replace($tail, $re, { param($m) $m.Groups[1].Value + "`r`n" + $bloque + "`r`n" + $m.Groups[2].Value })
Set-Content -Path $tailPath -Value $nuevo -Encoding UTF8 -NoNewline

# 2) Escribir el archivo portable que el dashboard puede adjuntar a futuro para actualizar su escaneo.
$jsonPath = Join-Path (Split-Path -Parent $tailPath) "..\datos_calibracion.json"
$hoy = (Get-Date).ToString("yyyy-MM-dd")
$json = '{"version":1,"generado":"' + $hoy + '","tags":{' + "`r`n" + $cuerpo + "`r`n}}"
Set-Content -Path $jsonPath -Value $json -Encoding UTF8 -NoNewline
Write-Host ("Generado: " + (Resolve-Path $jsonPath).Path)
Write-Host "part_tail.html actualizado. Ahora: powershell -ExecutionPolicy Bypass -File build.ps1"
