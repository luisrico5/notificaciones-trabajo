param([string]$Mdb,[string]$Pw,[int]$MinCid = 0)
# Verifica con el motor de Access (DAO) la integridad de los indices de las tablas que toca el grabado:
#  1) recorre cada indice de cada tabla (orden del indice) y cuenta filas = conteo de la tabla
#  2) Seek por clave primaria de TODAS las filas de INSTSPEC, InstSpecGroup, CALIBRAT, PCNotes e IDs y de las
#     filas nuevas (CalibrationID >= MinCid) de CalGroups, CALDET y CALTEST -> ninguna debe quedar sin encontrar
# 3) la clave de la base sigue puesta (sin clave no abre). Solo lectura.
$ErrorActionPreference = "Stop"
$dbe = New-Object -ComObject DAO.DBEngine.120
try { $x = $dbe.OpenDatabase($Mdb, $false, $true); $x.Close(); Write-Host "FAIL abre SIN clave" } catch { Write-Host "OK   sin clave NO abre (clave intacta)" }
$db = $dbe.OpenDatabase($Mdb, $false, $true, ";pwd=$Pw")
$fallos = 0
$tablas = @("CALIBRAT","CalGroups","CALDET","CALTEST","PCNotes","INSTSPEC","InstSpecGroup","IDs")
foreach ($t in $tablas) {
  $td = $db.TableDefs.Item($t)
  $rs0 = $db.OpenRecordset("SELECT COUNT(*) AS n FROM [$t]"); $total = [int]$rs0.Fields.Item(0).Value; $rs0.Close()
  $pk = $null
  foreach ($ix in $td.Indexes) {
    if ($ix.Primary) { $pk = $ix }
    $rs = $db.OpenRecordset($t, 1)   # dbOpenTable
    $rs.Index = $ix.Name
    $n = 0
    if (-not $rs.EOF) { $rs.MoveFirst(); while (-not $rs.EOF) { $n++; $rs.MoveNext() } }
    $rs.Close()
    if ($n -ne $total) { $fallos++; Write-Host "FAIL $t indice $($ix.Name): recorre $n de $total" }
    else { Write-Host "OK   $t indice $($ix.Name): recorre $n filas" }
  }
  if ($null -eq $pk) { continue }
  $campos = @(); foreach ($f in $pk.Fields) { $campos += $f.Name }
  $where = ""
  if ($MinCid -gt 0 -and @("CalGroups","CALDET","CALTEST") -contains $t) { $where = " WHERE CalibrationID >= $MinCid" }
  $cols = ($campos | ForEach-Object { "[$_]" }) -join ","
  $src = $db.OpenRecordset("SELECT $cols FROM [$t]$where", 4)   # dbOpenSnapshot
  $keys = New-Object System.Collections.Generic.List[object[]]
  if (-not $src.EOF) { $src.MoveFirst(); while (-not $src.EOF) { $k = New-Object object[] $campos.Count; for ($i = 0; $i -lt $campos.Count; $i++) { $k[$i] = $src.Fields.Item($i).Value }; $keys.Add($k); $src.MoveNext() } }
  $src.Close()
  $rs = $db.OpenRecordset($t, 1); $rs.Index = $pk.Name
  $miss = 0
  foreach ($k in $keys) {
    switch ($k.Count) {
      1 { $rs.Seek("=", $k[0]) }
      2 { $rs.Seek("=", $k[0], $k[1]) }
      3 { $rs.Seek("=", $k[0], $k[1], $k[2]) }
      4 { $rs.Seek("=", $k[0], $k[1], $k[2], $k[3]) }
      default { throw "clave de $($k.Count) campos" }
    }
    if ($rs.NoMatch) { $miss++; if ($miss -le 5) { Write-Host ("     no encontrada: " + ($k -join " | ")) } }
  }
  $rs.Close()
  if ($miss -gt 0) { $fallos++; Write-Host "FAIL $t Seek PK ($($campos -join ',')): $miss de $($keys.Count) sin encontrar" }
  else { Write-Host "OK   $t Seek PK ($($campos -join ',')): $($keys.Count) claves encontradas$where" }
}
$db.Close()
if ($fallos -eq 0) { Write-Host "RESULTADO INDICES: OK" } else { Write-Host "RESULTADO INDICES: $fallos FALLOS" }
