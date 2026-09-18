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
function Dbl($v){ if($null -eq $v -or $v -is [DBNull]){return $null}; try { return [double](([string]$v).Replace(",",".")) } catch { return $null } }
# Lecturas tolerantes a celdas vacias (DBNull) del maestro de instrumentos.
function Txt($v){ if($null -eq $v -or $v -is [DBNull]){ return "" }; return [string]$v }
function Int0($v){ if($null -eq $v -or $v -is [DBNull]){ return 0 }; try { return [int]$v } catch { return 0 } }
function Bool0($v){ if($null -eq $v -or $v -is [DBNull]){ return $false }; try { return [bool]$v } catch { return $false } }

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
# Si el instrumento NO tiene especificacion del grupo, se CREA: la fila plantilla sale de otro instrumento
# (asi todas las columnas llevan valores con el formato que usa DPCTrack) y encima se ponen los datos del
# reporte (rangos, puntos, limites, unidades y precision, que el dashboard manda en el JSON).
function Update-Spec($conn,$tx,$tag,$d,$comp,$moldeTag){
  $mesc=([string]$moldeTag).Replace("'","''")
  $O=[System.Data.OleDb.OleDbType]
  $tesc=$tag.Replace("'","''")
  foreach($g in $d.grupos){
    $gn=[int]$g.gn
    $pts=@($g.puntos); $ndiv=$pts.Count
    if($ndiv -lt 1){ continue }
    # Rangos: del JSON; si no vienen, extremos de los puntos.
    $iLo=Dbl $g.inLow;  if($null -eq $iLo){ $iLo=Dbl $pts[0].inNom }
    $iHi=Dbl $g.inHigh; if($null -eq $iHi){ $iHi=Dbl $pts[$ndiv-1].inNom }
    $oLo=Dbl $g.outLow; if($null -eq $oLo){ $oLo=Dbl $pts[0].outNom }
    $oHi=Dbl $g.outHigh;if($null -eq $oHi){ $oHi=Dbl $pts[$ndiv-1].outNom }
    # Datos del grupo que manda el dashboard (solo se usan al CREAR la spec; si ya existe, no se tocan).
    $unIn=[string]$g.unidadIn; $unOut=[string]$g.unidadOut; $prec=[string]$g.precision; $gname=[string]$g.nombre
    $ra=Dbl $g.pctRango; $rd=Dbl $g.pctLectura; $pm=Dbl $g.masMenos

    $dtSpec = Q $conn "SELECT * FROM INSTSPEC WHERE INSTRUMENTCODE='$tesc' AND GroupNumber=$gn" $tx
    $crear = ($dtSpec.Rows.Count -eq 0)
    if($crear){
      # Molde: la spec del instrumento del que salio la calibracion molde (grupo y posicion mas bajos).
      $dtSpec = Q $conn "SELECT TOP 1 * FROM INSTSPEC WHERE INSTRUMENTCODE='$mesc' ORDER BY GroupNumber, Position" $tx
      if($dtSpec.Rows.Count -eq 0){ Write-Host "    (spec: la base no tiene ninguna INSTSPEC de referencia; se omite el grupo $gn)"; continue }
    }
    $tpl=$dtSpec.Rows[0]
    # 1) InstSpecGroup (grupo a nivel de spec): Divisions + rangos. Si no existe, se crea con los datos del reporte.
    $dtG = Q $conn "SELECT * FROM InstSpecGroup WHERE INSTRUMENTCODE='$tesc' AND GroupNumber=$gn" $tx
    if($dtG.Rows.Count -eq 0){
      $dtGtpl = Q $conn "SELECT TOP 1 * FROM InstSpecGroup WHERE INSTRUMENTCODE='$mesc' ORDER BY GroupNumber" $tx
      if($dtGtpl.Rows.Count -eq 0){ Write-Host "    (spec: la base no tiene ningun InstSpecGroup de referencia; se omite el grupo $gn)"; continue }
      $ovG=@{ COMPANYNAME=$comp; INSTRUMENTCODE=$tag; GroupNumber=$gn; GROUPNAME=$gname;
        Divisions=$ndiv; InputLowRange=$iLo; InputHighRange=$iHi; OutputLowRange=$oLo; OutputHighRange=$oHi;
        INPUTSIGNALTYPE=$unIn; OUTPUTSIGNALTYPE=$unOut; STATEDACCURACY=$prec;
        RangeAccuracyPct=$ra; ReadingAccuracyPct=$rd; PlusMinus=$pm;
        UseControlLimits=$false; ControlPct=0; ControlPlusMinus=0; UseControlPlusMinus=$false }
      Insert-Hash $conn $tx $dtGtpl "InstSpecGroup" (Row-Hash $dtGtpl $dtGtpl.Rows[0] $ovG)
      Write-Host ("    spec CREADA: grupo $gn de $tag")
    } else {
      [void](Exec $conn $tx "UPDATE InstSpecGroup SET Divisions=?, InputLowRange=?, InputHighRange=?, OutputLowRange=?, OutputHighRange=? WHERE INSTRUMENTCODE=? AND GroupNumber=?" @(
        @{t=$O::Integer;v=$ndiv}, @{t=$O::Double;v=$iLo}, @{t=$O::Double;v=$iHi}, @{t=$O::Double;v=$oLo}, @{t=$O::Double;v=$oHi},
        @{t=$O::VarWChar;v=$tag}, @{t=$O::Integer;v=$gn} ))
    }
    # 2) INSTSPEC (puntos de la spec): borrar los viejos e insertar los del reporte.
    if(-not $crear){
      [void](Exec $conn $tx "DELETE FROM INSTSPEC WHERE INSTRUMENTCODE=? AND GroupNumber=?" @(
        @{t=$O::VarWChar;v=$tag}, @{t=$O::Integer;v=$gn} ))
    }
    $pos=0
    foreach($pt in $pts){
      $pos++
      $lo=(Dbl $pt.low); $hi=(Dbl $pt.high)
      $ov=@{ Position=$pos; InputSignal=(Dbl $pt.inNom); OutputSignal=(Dbl $pt.outNom); LowLimit=$lo; HighLimit=$hi }
      if($crear){
        # Fila de otro instrumento: hay que poner TODO lo que identifica al instrumento y a su grupo.
        $ov['COMPANYNAME']=$comp; $ov['INSTRUMENTCODE']=$tag; $ov['GroupNumber']=$gn
        $ov['INPUTSIGNALTYPE']=$unIn; $ov['OUTPUTSIGNALTYPE']=$unOut; $ov['STATEDACCURACY']=$prec
        $ov['RangeAccuracyPct']=$ra; $ov['ReadingAccuracyPct']=$rd; $ov['PlusMinus']=$pm
        $ov['LowControlLimit']=$lo; $ov['HighControlLimit']=$hi; $ov['DESCRIPTION']=''
      }
      Insert-Hash $conn $tx $dtSpec "INSTSPEC" (Row-Hash $dtSpec $tpl $ov)
    }
    Write-Host ("    spec " + $(if($crear){"creada"}else{"actualizada"}) + ": grupo $gn -> $ndiv puntos, entrada $iLo..$iHi, salida $oLo..$oHi")
  }
}

# Inserta UNA calibración (objeto $d) con IDs $cid/$note. Devuelve $true si insertó, $false si se omitió
# (instrumento sin calibración previa que sirva de plantilla). Usa $conn/$tx abiertos.
# $updateSpec: si $true, también actualiza la especificación (InstSpecGroup + INSTSPEC) del instrumento.
function Process-Cal($conn,$tx,$d,$cid,$note,$now,$updateSpec){
  $tag = [string]$d.tag
  if ([string]::IsNullOrWhiteSpace($tag)) { Write-Host "  (omitido: calibración sin 'tag')"; return $false }
  $tesc = $tag.Replace("'","''")
  $tplRow = (Q $conn "SELECT TOP 1 CalibrationID FROM CALIBRAT WHERE ITEMTYPE='Instrument' AND ITEMCODE='$tesc' ORDER BY CalibrationDate DESC, CalibrationID DESC" $tx)
  # PRIMERA calibracion del instrumento: no hay plantilla propia. Se usa la calibracion mas reciente de
  # CUALQUIER instrumento solo como molde (todas las columnas con el formato de DPCTrack) y encima se ponen
  # los datos del equipo (tabla INSTRMNT) y del reporte. Requisito: el equipo debe existir en el maestro.
  $dtInst = $null
  if ($tplRow.Rows.Count -eq 0) {
    $dtInst = Q $conn "SELECT TOP 1 * FROM INSTRMNT WHERE INSTRUMENTCODE='$tesc'" $tx
    if ($dtInst.Rows.Count -eq 0) { Write-Host "  OMITIDO $tag (no esta en el maestro de instrumentos de la base)"; return $false }
    $tplRow = (Q $conn "SELECT TOP 1 CalibrationID FROM CALIBRAT WHERE ITEMTYPE='Instrument' ORDER BY CalibrationDate DESC, CalibrationID DESC" $tx)
    if ($tplRow.Rows.Count -eq 0) { Write-Host "  OMITIDO $tag (la base no tiene ninguna calibracion de referencia)"; return $false }
  }
  $nuevo = ($null -ne $dtInst)
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
  if($nuevo){
    # El molde es de OTRO instrumento: se ponen los datos de ESTE equipo (del maestro) y se limpia todo lo
    # que pertenecia al otro (mantenimientos, aprobaciones, contadores, limites de control).
    $I=$dtInst.Rows[0]
    $ovCal['ITEMTYPE']='Instrument'; $ovCal['ITEMCODE']=$tag
    $ovCal['COMPANYNAME']=Txt $I['COMPANYNAME']
    if([string]::IsNullOrEmpty([string]$d.nombre)){ $ovCal['ITEMNAME']=Txt $I['INSTRUMENTNAME'] }
    foreach($c in @('MANUFACTURER','MODELNUMBER','SERIALNUMBER','EQUIPMENTCODE','LOCATION','BUILDING','STATUS','DEPARTMENT','CLASSIFICATION','PNIDNUMBER','PNIDREVISIONNUMBER','SOPNUMBER')){
      $ovCal[$c] = Txt $I[$c]
    }
    $ovCal['FREQUENCY']=Txt $I['CALIBRATIONFREQUENCY']
    $ovCal['LastCalibrationDate']=$I['LastCalibrationDate']; $ovCal['NextCalibrationDate']=$I['NextCalibrationDate']
    $ovCal['NewNextCalibrationDate']=[DBNull]::Value; $ovCal['DueDate']=[DBNull]::Value
    $ovCal['SeparateCalReadings']=Bool0 $I['SeparateCalReadings']
    $ovCal['CountScheduleEnabled']=Bool0 $I['CountScheduleEnabled']
    $ovCal['ItemCountID']=Int0 $I['ItemCountID']; $ovCal['MaxCount']=Int0 $I['MaxCount']; $ovCal['LastReset']=Int0 $I['LastReset']
    $ovCal['MeterValue']=0; $ovCal['COUNTTYPE']=''
    $ovCal['EQUIPMENTNAME']=''; $ovCal['REASON']=''; $ovCal['SOPREVISIONNUMBER']=''
    $ovCal['PlannedMaintID']=0; $ovCal['MaintRequestID']=0
    $ovCal['ItemApprovalDate']=[DBNull]::Value; $ovCal['ITEMAPPROVEDBY']=''
    $ovCal['UseControlLimits']=$false; $ovCal['ControlPct']=0
    $ovCal['ManHours']=(Dbl $I['ExpectedManHours']); if($null -eq $ovCal['ManHours']){ $ovCal['ManHours']=0 }
    $ovCal['AdjustToImprove']=$false
  }
  Insert-Hash $conn $tx $dtCal "CALIBRAT" (Row-Hash $dtCal $dtCal.Rows[0] $ovCal)
  # 3) CalGroups (Divisions = N.º de puntos; OutputLowRange/HighRange = mín/máx de salida editados).
  #    Primera calibracion: los grupos salen del reporte (el molde ajeno solo aporta el formato de columnas).
  $filasGrp = @($dtGrp.Rows)
  if($nuevo){
    $filasGrp = @()
    foreach($g in $d.grupos){ $filasGrp += , $dtGrp.Rows[0] }
  }
  $ig = -1
  foreach($row in $filasGrp){
    $ig++
    $gn = if($nuevo){ [int](@($d.grupos)[$ig].gn) } else { [int]$row['GroupNumber'] }
    $jg = $d.grupos | Where-Object { [int]$_.gn -eq $gn } | Select-Object -First 1
    $ovG = @{ CalibrationID=$cid; ASFOUNDSTATUS=$grpStatus; ASLEFTSTATUS=$grpStatus }
    if($nuevo){
      $ovG['GroupNumber']=$gn; $ovG['GROUPNAME']=[string]$jg.nombre
      $ovG['INPUTSIGNALTYPE']=[string]$jg.unidadIn; $ovG['OUTPUTSIGNALTYPE']=[string]$jg.unidadOut
      $ovG['STATEDACCURACY']=[string]$jg.precision
      $ovG['RangeAccuracyPct']=(Dbl $jg.pctRango); $ovG['ReadingAccuracyPct']=(Dbl $jg.pctLectura); $ovG['PlusMinus']=(Dbl $jg.masMenos)
      $ovG['UseControlLimits']=$false; $ovG['ControlPct']=0; $ovG['ControlPlusMinus']=0; $ovG['UseControlPlusMinus']=$false
    }
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
        if($nuevo){
          # Molde de otro instrumento: unidades, precision y limites de control tienen que ser los de este reporte.
          $ov['INPUTSIGNALTYPE']=[string]$g.unidadIn; $ov['OUTPUTSIGNALTYPE']=[string]$g.unidadOut
          $ov['STATEDACCURACY']=[string]$g.precision; $ov['DESCRIPTION']=''
          $ov['RangeAccuracyPct']=(Dbl $g.pctRango); $ov['ReadingAccuracyPct']=(Dbl $g.pctLectura); $ov['PlusMinus']=(Dbl $g.masMenos)
          $ov['LowControlLimit']=$lo; $ov['HighControlLimit']=$hi
        }
        Insert-Hash $conn $tx $dtDet "CALDET" (Row-Hash $dtDet $tplRow $ov)
      }
    }
  }
  # 5) CALTEST
  # La empresa sale del equipo cuando el molde es de otro instrumento.
  $comp=[string]$dtCal.Rows[0]['COMPANYNAME']
  if($nuevo){ $comp=Txt $dtInst.Rows[0]['COMPANYNAME'] }
  foreach($p in $d.patrones){
    Insert-Hash $conn $tx $dtTst "CALTEST" @{ CalibrationID=$cid; COMPANYNAME=$comp; TESTINSTRUMENTCODE=([string]$p[0]);
      LastCalibrationDate=(ParseDate $p[5]); NextCalibrationDate=(ParseDate $p[6]); STATUS='En servicio';
      DateEntered=$now; ENTEREDBY='User'; CountScheduleEnabled=$false; ItemCountID=0; MaxCount=0; LastReset=0; MeterValue=0; CalTestID=0 }
  }
  # 6) Especificación (InstSpecGroup + INSTSPEC), para que DPCTrack arme el reporte con estos puntos/rangos.
  if($updateSpec){ Update-Spec $conn $tx $tag $d $comp ([string]$dtCal.Rows[0]['ITEMCODE']) }
  $molde = if($nuevo){ "PRIMERA calibracion, molde=$tpl de otro instrumento" } else { "plantilla=$tpl" }
  Write-Host ("  OK $tag -> CalibrationID=$cid, NoteID=$note ($molde, grupos=" + (@($d.grupos).Count) + ", patrones=" + (@($d.patrones).Count) + ")")
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
  Write-Host ("LISTO. Insertados: $ins  |  omitidos: $omit")
  Write-Host "Abre 20260810_dpctrack2_editable.mdb en DPCTrack2 y genera los reportes."
}
catch {
  try { $tx.Rollback() } catch {}
  $conn.Close()
  throw
}
