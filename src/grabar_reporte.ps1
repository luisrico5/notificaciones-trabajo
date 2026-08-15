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

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Json,
  [string]$Mdb      = "c:\noti\20260810_dpctrack2_editable.mdb",
  [string]$Password = ""
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

# Inserta UNA calibración (objeto $d) con IDs $cid/$note. Devuelve $true si insertó, $false si se omitió
# (instrumento sin calibración previa que sirva de plantilla). Usa $conn/$tx abiertos.
function Process-Cal($conn,$tx,$d,$cid,$note,$now){
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
$now = Get-Date
$nextCid  = [int]((Q $conn "SELECT MAX(CalibrationID) AS m FROM CALIBRAT").Rows[0]['m']) + 1
$nextNote = [int]((Q $conn "SELECT MAX(NoteID) AS m FROM PCNotes").Rows[0]['m']) + 1

$tx = $conn.BeginTransaction()
$ins=0; $omit=0
try {
  foreach($cal in $list){
    if (Process-Cal $conn $tx $cal $nextCid $nextNote $now) { $nextCid++; $nextNote++; $ins++ } else { $omit++ }
  }
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
