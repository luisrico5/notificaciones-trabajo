# grabar_reporte.ps1 — Inserta en la base DPCTrack2 EDITABLE una calibración nueva a partir del JSON que
# exporta el dashboard (botón "Grabar a la base de datos"), de forma que DPCTrack2 la lea y genere el
# reporte idéntico. Mantiene la estructura fielmente: usa la ÚLTIMA calibración del mismo instrumento como
# PLANTILLA (copia todas las columnas de CALIBRAT, CalGroups y CALDET) y solo sobrescribe lo nuevo
# (IDs, fecha, técnico, temp/humedad, certificado, tipo, lecturas Enc./Dejado, patrones y nota).
#
#   powershell -ExecutionPolicy Bypass -File src\grabar_reporte.ps1 -Json <archivo.json> -Password "<clave>"
#
# - Base editable por defecto: 20260810_dpctrack2_editable.mdb (NUNCA la _backup, de solo consulta).
# - La contraseña de la base NO se toca: se abre con ella (parámetro -Password) y queda igual.
# - IDs nuevos = MAX(CalibrationID)+1 y MAX(NoteID)+1 (no hay autonumber en estas tablas).
# - Todo se hace dentro de una TRANSACCIÓN (o entra completo, o no entra nada).
# - Además ACTUALIZA LA ESPECIFICACIÓN del instrumento (InstSpecGroup + INSTSPEC) con el N.º de puntos,
#   los nominales y los rangos del reporte, porque DPCTrack ARMA el reporte desde la especificación (no
#   desde la calibración). Sin esto, cambiar puntos/rangos en el dashboard no se reflejaba en DPCTrack.
#   Para NO tocar la especificación (grabar solo la calibración) usa el modificador -NoSpec.

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Json,
  [string]$Mdb      = "c:\noti\20260810_dpctrack2_editable.mdb",
  [string]$Password = "",
  [switch]$NoSpec
)
$ErrorActionPreference = "Stop"
$Mdb  = (Resolve-Path $Mdb).Path
$Json = (Resolve-Path $Json).Path
$inv  = [System.Globalization.CultureInfo]::InvariantCulture

function New-Conn {
  foreach ($p in @("Microsoft.ACE.OLEDB.16.0","Microsoft.ACE.OLEDB.12.0")) {
    $cs = "Provider=$p;Data Source=$Mdb;"
    if ($Password -ne "") { $cs += "Jet OLEDB:Database Password=$Password;" }
    try { $c = New-Object System.Data.OleDb.OleDbConnection $cs; $c.Open(); return $c } catch {}
  }
  throw "No se pudo abrir la base editable (revisa -Password)."
}
function Q($conn,$sql,$tx=$null){ $cmd=$conn.CreateCommand();$cmd.CommandText=$sql;if($tx){$cmd.Transaction=$tx};$da=New-Object System.Data.OleDb.OleDbDataAdapter $cmd;$dt=New-Object System.Data.DataTable;[void]$da.Fill($dt);return ,$dt }
# Ejecuta un UPDATE/DELETE parametrizado. $cells = arreglo de @{ t=<OleDbType>; v=<valor> } en el orden de los "?".
function Exec($conn,$tx,$sql,$cells){
  $cmd=$conn.CreateCommand(); $cmd.Transaction=$tx; $cmd.CommandText=$sql
  foreach($c in $cells){
    $p=$cmd.CreateParameter(); $p.OleDbType=$c.t
    if($null -eq $c.v -or $c.v -is [DBNull]){ $p.Value=[DBNull]::Value } else { $p.Value=$c.v }
    [void]$cmd.Parameters.Add($p)
  }
  return $cmd.ExecuteNonQuery()
}
function ParseDate($s){
  if ([string]::IsNullOrWhiteSpace($s)) { return $null }
  foreach($fmt in @("dd/MM/yyyy","d/M/yyyy","dd/MM/yyyy HH:mm:ss","yyyy-MM-dd")){
    try { return [datetime]::ParseExact(([string]$s).Trim(),$fmt,$inv) } catch {}
  }
  try { return [datetime]::Parse(([string]$s).Trim(),$inv) } catch { return $null }
}
function Dbl($v){ if($null -eq $v){return $null}; try { return [double](([string]$v).Replace(",",".")) } catch { return $null } }

# Mapea el tipo .NET de una columna a OleDbType (para fijar el tipo del parámetro, incl. valores NULL).
function OleType($t){
  switch($t.Name){
    'String'   { [System.Data.OleDb.OleDbType]::VarWChar }
    'Int32'    { [System.Data.OleDb.OleDbType]::Integer }
    'Int16'    { [System.Data.OleDb.OleDbType]::SmallInt }
    'Byte'     { [System.Data.OleDb.OleDbType]::UnsignedTinyInt }
    'Int64'    { [System.Data.OleDb.OleDbType]::BigInt }
    'Double'   { [System.Data.OleDb.OleDbType]::Double }
    'Single'   { [System.Data.OleDb.OleDbType]::Single }
    'Decimal'  { [System.Data.OleDb.OleDbType]::Currency }
    'Boolean'  { [System.Data.OleDb.OleDbType]::Boolean }
    'DateTime' { [System.Data.OleDb.OleDbType]::Date }
    default    { [System.Data.OleDb.OleDbType]::VarWChar }
  }
}
# Inserta una fila usando un DataTable-esquema (con tipos). $hash: columna -> valor (solo las columnas
# presentes en $hash se insertan; el resto de columnas de la tabla quedan con su valor por defecto/NULL).
function Insert-Hash($conn,$tx,$schemaDt,$table,$hash){
  $names=@(); $cells=@()
  foreach($col in $schemaDt.Columns){ if($hash.ContainsKey($col.ColumnName)){ $names+=$col; $cells+=,$hash[$col.ColumnName] } }
  $colList=($names | ForEach-Object { "[" + $_.ColumnName + "]" }) -join ","
  $ph=(1..$names.Count | ForEach-Object { "?" }) -join ","
  $cmd=$conn.CreateCommand(); $cmd.Transaction=$tx; $cmd.CommandText="INSERT INTO [$table] ($colList) VALUES ($ph)"
  for($i=0;$i -lt $names.Count;$i++){
    $p=$cmd.CreateParameter(); $p.OleDbType=(OleType $names[$i].DataType)
    $v=$cells[$i]; if($null -eq $v -or $v -is [DBNull]){ $p.Value=[DBNull]::Value } else { $p.Value=$v }
    [void]$cmd.Parameters.Add($p)
  }
  [void]$cmd.ExecuteNonQuery()
}
# Construye un hash con TODAS las columnas de una fila plantilla, aplicando overrides.
function Row-Hash($schemaDt,$row,$ov){
  $h=@{}
  foreach($col in $schemaDt.Columns){ $n=$col.ColumnName; if($ov.ContainsKey($n)){ $h[$n]=$ov[$n] } else { $h[$n]=$row[$n] } }
  return $h
}

# Actualiza la ESPECIFICACIÓN del instrumento (lo que DPCTrack usa para armar el reporte) con el N.º de
# puntos, nominales y rangos del reporte $d. Por cada grupo del JSON:
#   1) InstSpecGroup: Divisions = N.º de puntos; Input/Output Low/High Range = mín/máx editados.
#   2) INSTSPEC: se borran las filas de puntos viejas y se insertan N nuevas (Position, InputSignal,
#      OutputSignal, LowLimit, HighLimit del reporte), copiando el resto de columnas de una fila plantilla
#      del mismo grupo (COMPANYNAME, tipos de señal, precisión, resoluciones, etc.).
# Solo actúa sobre grupos que YA existen en la spec (instrumentos reales); si falta, avisa y omite ese grupo.
function Update-Spec($conn,$tx,$tag,$d){
  $O=[System.Data.OleDb.OleDbType]
  $tesc=$tag.Replace("'","''")
  foreach($g in $d.grupos){
    $gn=[int]$g.gn
    $dtSpec = Q $conn "SELECT * FROM INSTSPEC WHERE INSTRUMENTCODE='$tesc' AND GroupNumber=$gn" $tx
    if($dtSpec.Rows.Count -eq 0){ Write-Host "    (spec: sin INSTSPEC para grupo $gn de $tag; se omite la spec de ese grupo)"; continue }
    $tpl=$dtSpec.Rows[0]
    $pts=@($g.puntos); $ndiv=$pts.Count
    if($ndiv -lt 1){ continue }
    # Rangos: del JSON; si no vienen, extremos de los puntos.
    $iLo=Dbl $g.inLow;  if($null -eq $iLo){ $iLo=Dbl $pts[0].inNom }
    $iHi=Dbl $g.inHigh; if($null -eq $iHi){ $iHi=Dbl $pts[$ndiv-1].inNom }
    $oLo=Dbl $g.outLow; if($null -eq $oLo){ $oLo=Dbl $pts[0].outNom }
    $oHi=Dbl $g.outHigh;if($null -eq $oHi){ $oHi=Dbl $pts[$ndiv-1].outNom }
    # 1) InstSpecGroup (grupo a nivel de spec): Divisions + rangos. Lo demás (precisión, IOCORRELATION…) queda igual.
    [void](Exec $conn $tx "UPDATE InstSpecGroup SET Divisions=?, InputLowRange=?, InputHighRange=?, OutputLowRange=?, OutputHighRange=? WHERE INSTRUMENTCODE=? AND GroupNumber=?" @(
      @{t=$O::Integer;v=$ndiv}, @{t=$O::Double;v=$iLo}, @{t=$O::Double;v=$iHi}, @{t=$O::Double;v=$oLo}, @{t=$O::Double;v=$oHi},
      @{t=$O::VarWChar;v=$tag}, @{t=$O::Integer;v=$gn} ))
    # 2) INSTSPEC (puntos de la spec): borrar los viejos e insertar los del reporte.
    [void](Exec $conn $tx "DELETE FROM INSTSPEC WHERE INSTRUMENTCODE=? AND GroupNumber=?" @(
      @{t=$O::VarWChar;v=$tag}, @{t=$O::Integer;v=$gn} ))
    $pos=0
    foreach($pt in $pts){
      $pos++
      $ov=@{ Position=$pos; InputSignal=(Dbl $pt.inNom); OutputSignal=(Dbl $pt.outNom); LowLimit=(Dbl $pt.low); HighLimit=(Dbl $pt.high) }
      Insert-Hash $conn $tx $dtSpec "INSTSPEC" (Row-Hash $dtSpec $tpl $ov)
    }
    Write-Host ("    spec actualizada: grupo $gn -> $ndiv puntos, entrada $iLo..$iHi, salida $oLo..$oHi")
  }
}

# Inserta UNA calibración (objeto $d) con IDs $cid/$note. Devuelve $true si insertó, $false si se omitió
# (instrumento sin calibración previa que sirva de plantilla). Usa $conn/$tx abiertos.
# $updateSpec: si $true, también actualiza la especificación (InstSpecGroup + INSTSPEC) del instrumento.
function Process-Cal($conn,$tx,$d,$cid,$note,$now,$updateSpec){
  $tag = [string]$d.tag
  if ([string]::IsNullOrWhiteSpace($tag)) { Write-Host "  (omitido: calibración sin 'tag')"; return $false }
  $tplRow = (Q $conn "SELECT TOP 1 CalibrationID FROM CALIBRAT WHERE ITEMTYPE='Instrument' AND ITEMCODE='$($tag.Replace("'","''"))' ORDER BY CalibrationDate DESC, CalibrationID DESC" $tx)
  if ($tplRow.Rows.Count -eq 0) { Write-Host "  OMITIDO $tag (sin calibración previa de plantilla)"; return $false }
  $tpl = [int]$tplRow.Rows[0]['CalibrationID']

  $dtCal   = Q $conn "SELECT * FROM CALIBRAT  WHERE CalibrationID=$tpl" $tx
  $dtGrp   = Q $conn "SELECT * FROM CalGroups WHERE CalibrationID=$tpl" $tx
  $dtDet   = Q $conn "SELECT * FROM CALDET    WHERE CalibrationID=$tpl ORDER BY GroupNumber,Position,READINGTYPE" $tx
  $dtTst   = Q $conn "SELECT * FROM CALTEST   WHERE 1=0" $tx
  $dtNotes = Q $conn "SELECT * FROM PCNotes   WHERE 1=0" $tx

  # Lecturas del reporte: (grupo,posición,tipo) -> valor; y límites por (grupo,posición)
  $read=@{}; $lim=@{}
  foreach($g in $d.grupos){
    $gn=[int]$g.gn
    foreach($pt in $g.puntos){
      $pos=[int]$pt.pos
      $read["$gn|$pos|FoundAs"]=(Dbl $pt.found); $read["$gn|$pos|LeftAs"]=(Dbl $pt.left)
      $lim["$gn|$pos"]=@{ lo=(Dbl $pt.low); hi=(Dbl $pt.high) }
    }
  }
  $inlim = {
    param($gn,$pos,$val)
    if($null -eq $val){ return $true }
    $k="$gn|$pos"; if(-not $lim.ContainsKey($k)){ return $true }
    $lo=$lim[$k].lo; $hi=$lim[$k].hi
    if($null -eq $lo -or $null -eq $hi){ return $true }
    return ($val -ge $lo - 1e-9 -and $val -le $hi + 1e-9)
  }
  # Resultado global (desde los puntos del reporte, no de la plantilla)
  $anyFail=$false; $anyFoundFail=$false
  foreach($g in $d.grupos){
    $gn=[int]$g.gn; $pos=0
    foreach($pt in $g.puntos){
      $pos=[int]$pt.pos
      foreach($rt in @('FoundAs','LeftAs')){
        $v = if($rt -eq 'FoundAs'){ Dbl $pt.found } else { Dbl $pt.left }
        if(-not (& $inlim $gn $pos $v)){ $anyFail=$true; if($rt -eq 'FoundAs'){ $anyFoundFail=$true } }
      }
    }
  }
  $grpStatus = if($anyFail){'Fail'}else{'Pass'}

  # 1) PCNotes
  Insert-Hash $conn $tx $dtNotes "PCNotes" @{ NoteID=$note; DateEntered=$now; WHOENTERED='User'; Note=([string]$d.nota) }
  # 2) CALIBRAT
  $finBy=[string]$d.finalizadoPor; if([string]::IsNullOrEmpty($finBy)){ $finBy='User' }
  $ovCal=@{
    CalibrationID=$cid; STRINGID=[string]$cid;
    CalibrationDate=(ParseDate $d.fecha); WHOCALIBRATED=[string]$d.por;
    TEMPERATURE=[string]$d.temp; HUMIDITY=[string]$d.humedad;
    CALIBRATIONTYPE=[string]$d.tipo; CALIBRATIONCERTIFICATENUMBER=[string]$d.certificado;
    NoteID=$note; DateEntered=$now; LastModified=$now; DateFinalized=$now;
    Finalized=$true; FINALIZEDBY=$finBy; ENTEREDBY='User'; MODIFIEDBY='User';
    Failed=$anyFail; AsFoundFailed=$anyFoundFail; IncompleteCal=$false; DateExported=[DBNull]::Value;
    ITEMNAME=([string]$d.nombre)
  }
  Insert-Hash $conn $tx $dtCal "CALIBRAT" (Row-Hash $dtCal $dtCal.Rows[0] $ovCal)
  # 3) CalGroups (Divisions = N.º de puntos; OutputLowRange/HighRange = mín/máx de salida editados)
  foreach($row in $dtGrp.Rows){
    $gn=[int]$row['GroupNumber']
    $jg = $d.grupos | Where-Object { [int]$_.gn -eq $gn } | Select-Object -First 1
    $ovG = @{ CalibrationID=$cid; ASFOUNDSTATUS=$grpStatus; ASLEFTSTATUS=$grpStatus }
    if($jg){
      $ovG['Divisions'] = @($jg.puntos).Count
      $iLo = Dbl $jg.inLow;  $iHi = Dbl $jg.inHigh
      $oLo = Dbl $jg.outLow; $oHi = Dbl $jg.outHigh
      if($null -ne $iLo){ $ovG['InputLowRange']   = $iLo }
      if($null -ne $iHi){ $ovG['InputHighRange']  = $iHi }
      if($null -ne $oLo){ $ovG['OutputLowRange']  = $oLo }
      if($null -ne $oHi){ $ovG['OutputHighRange'] = $oHi }
    }
    Insert-Hash $conn $tx $dtGrp "CalGroups" (Row-Hash $dtGrp $row $ovG)
  }
  # 4) CALDET: se construye desde los puntos del reporte (soporta puntos agregados/quitados). Cada punto
  #    genera 2 filas (FoundAs/LeftAs). Se usa una fila plantilla del mismo grupo para las columnas fijas.
  foreach($g in $d.grupos){
    $gn=[int]$g.gn
    $tplRow = ($dtDet.Rows | Where-Object { [int]$_['GroupNumber'] -eq $gn } | Select-Object -First 1)
    if($null -eq $tplRow){ if($dtDet.Rows.Count -gt 0){ $tplRow=$dtDet.Rows[0] } else { throw "Sin plantilla CALDET para $tag" } }
    $p=0
    foreach($pt in $g.puntos){
      $p++
      $inNom=(Dbl $pt.inNom); $outNom=(Dbl $pt.outNom); $lo=(Dbl $pt.low); $hi=(Dbl $pt.high)
      foreach($rt in @('FoundAs','LeftAs')){
        $v = if($rt -eq 'FoundAs'){ Dbl $pt.found } else { Dbl $pt.left }
        $rs='Pass'; if(($null -ne $lo) -and ($null -ne $hi) -and ($null -ne $v) -and (($v -lt $lo-1e-9) -or ($v -gt $hi+1e-9))){ $rs='Fail' }
        $ov=@{ CalibrationID=$cid; GroupNumber=$gn; Position=$p; READINGTYPE=$rt;
          InputSignal=$inNom; OutputSignal=$outNom; NominalInputSignal=$inNom;
          LowLimit=$lo; HighLimit=$hi; Reading=$v; ReadingEntered=$true; RESULTSTATUS=$rs }
        Insert-Hash $conn $tx $dtDet "CALDET" (Row-Hash $dtDet $tplRow $ov)
      }
    }
  }
  # 5) CALTEST
  $comp=[string]$dtCal.Rows[0]['COMPANYNAME']
  foreach($p in $d.patrones){
    Insert-Hash $conn $tx $dtTst "CALTEST" @{ CalibrationID=$cid; COMPANYNAME=$comp; TESTINSTRUMENTCODE=([string]$p[0]);
      LastCalibrationDate=(ParseDate $p[5]); NextCalibrationDate=(ParseDate $p[6]); STATUS='En servicio';
      DateEntered=$now; ENTEREDBY='User'; CountScheduleEnabled=$false; ItemCountID=0; MaxCount=0; LastReset=0; MeterValue=0; CalTestID=0 }
  }
  # 6) Especificación (InstSpecGroup + INSTSPEC), para que DPCTrack arme el reporte con estos puntos/rangos.
  if($updateSpec){ Update-Spec $conn $tx $tag $d }
  Write-Host ("  OK $tag -> CalibrationID=$cid, NoteID=$note (plantilla=$tpl, grupos=" + (@($d.grupos).Count) + ", patrones=" + (@($d.patrones).Count) + ")")
  return $true
}

# ---- Leer el JSON del dashboard (uno o varios instrumentos) ----
$d = Get-Content -Raw -Encoding UTF8 $Json | ConvertFrom-Json
$list = if ($null -ne $d.calibraciones) { @($d.calibraciones) } else { @($d) }
if ($list.Count -eq 0) { throw "El JSON no trae calibraciones." }

$conn = New-Conn
Write-Host "Base editable: $Mdb"
Write-Host ("Instrumentos en el archivo: " + @($list).Count)
Write-Host ("Especificación (InstSpecGroup+INSTSPEC): " + $(if($NoSpec){"NO se actualiza (-NoSpec)"}else{"se actualiza para reflejar puntos/rangos"}))
$now = Get-Date
$updateSpec = -not $NoSpec
$O = [System.Data.OleDb.OleDbType]

# IDs de arranque = 1 + el MAYOR entre el MAX real de la tabla y el CONTADOR INTERNO de DPCTrack (tabla IDs,
# columna LastID). DPCTrack asigna los IDs nuevos desde esa tabla; si solo usáramos MAX(tabla) podríamos
# chocar con un ID que DPCTrack tenga reservado, y si no la actualizamos al final, DPCTrack reutilizará un ID
# que ya insertamos -> "clave duplicada". Por eso leemos y luego escribimos ese contador.
function LastId($conn,$name){ $r=Q $conn "SELECT LastID FROM IDs WHERE TABLENAME='$name'"; if($r.Rows.Count){ [int]$r.Rows[0]['LastID'] } else { 0 } }
$maxCal  = [int]((Q $conn "SELECT MAX(CalibrationID) AS m FROM CALIBRAT").Rows[0]['m'])
$maxNote = [int]((Q $conn "SELECT MAX(NoteID) AS m FROM PCNotes").Rows[0]['m'])
$nextCid  = ([Math]::Max($maxCal,  (LastId $conn 'CALIBRAT'))) + 1
$nextNote = ([Math]::Max($maxNote, (LastId $conn 'PCNOTES')))  + 1

$tx = $conn.BeginTransaction()
$ins=0; $omit=0
try {
  foreach($cal in $list){
    if (Process-Cal $conn $tx $cal $nextCid $nextNote $now $updateSpec) { $nextCid++; $nextNote++; $ins++ } else { $omit++ }
  }
  # Mantener el contador interno de DPCTrack (tabla IDs) al día para que las próximas calibraciones que CREE
  # DPCTrack no reutilicen los IDs que acabamos de insertar (evita el error "clave duplicada" en DPCTrack).
  # Solo se sube (WHERE LastID<?), nunca se baja. $nextCid-1 / $nextNote-1 = último ID realmente usado.
  [void](Exec $conn $tx "UPDATE IDs SET LastID=? WHERE TABLENAME='CALIBRAT' AND LastID<?" @(@{t=$O::Integer;v=($nextCid-1)},  @{t=$O::Integer;v=($nextCid-1)}))
  [void](Exec $conn $tx "UPDATE IDs SET LastID=? WHERE TABLENAME='PCNOTES'  AND LastID<?" @(@{t=$O::Integer;v=($nextNote-1)}, @{t=$O::Integer;v=($nextNote-1)}))
  $tx.Commit()
  $conn.Close()
  Write-Host ("LISTO. Insertados: $ins  |  omitidos (sin plantilla): $omit")
  Write-Host "Abre 20260810_dpctrack2_editable.mdb en DPCTrack2 y genera los reportes."
}
catch {
  try { $tx.Rollback() } catch {}
  $conn.Close()
  throw
}
