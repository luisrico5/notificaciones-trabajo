param([string]$Mdb,[string]$Pw,[string]$Out)
# Mismo volcado canonico que dump_ace.ps1 (mismo formato de salida), con el formateo en C# compilado (rapido).
$ErrorActionPreference = "Stop"
if (-not ("DumpFmt" -as [type])) {
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Text;
public static class DumpFmt {
  static string Fmt(object v) {
    CultureInfo inv = CultureInfo.InvariantCulture;
    if (v == null || v is DBNull) return "<NULL>";
    if (v is DateTime) return ((DateTime)v).ToString("yyyy-MM-dd HH:mm:ss.fff", inv);
    if (v is double) return ((double)v).ToString("R", inv);
    if (v is float) return ((float)v).ToString("R", inv);
    if (v is decimal) return ((decimal)v).ToString(inv);
    string s = v as string;
    if (s != null) return s.Replace("\\","\\\\").Replace("\r","\\r").Replace("\n","\\n").Replace("|","\\p");
    return Convert.ToString(v, inv);
  }
  public static void Table(StringBuilder sb, string name, DataTable dt, string[] nowCols) {
    DateTime today = DateTime.Now.Date;
    HashSet<string> nc = new HashSet<string>(nowCols ?? new string[0]);
    List<string> lines = new List<string>(dt.Rows.Count);
    StringBuilder row = new StringBuilder();
    foreach (DataRow r in dt.Rows) {
      row.Length = 0;
      for (int i = 0; i < dt.Columns.Count; i++) {
        if (i > 0) row.Append('|');
        object v = r[i];
        if (nc.Contains(dt.Columns[i].ColumnName) && v is DateTime && (DateTime)v >= today) row.Append("<NOW>");
        else row.Append(Fmt(v));
      }
      lines.Add(row.ToString());
    }
    string[] arr = lines.ToArray();
    Array.Sort(arr, StringComparer.Ordinal);
    List<string> cols = new List<string>();
    foreach (DataColumn c in dt.Columns) cols.Add(c.ColumnName);
    sb.Append("### ").Append(name).Append(" filas=").Append(arr.Length).Append(" cols=").Append(string.Join(",", cols.ToArray())).Append("\r\n");
    foreach (string l in arr) sb.Append(l).Append("\r\n");
  }
}
"@ -ReferencedAssemblies System.Data, System.Xml
}
$cs = "Provider=Microsoft.ACE.OLEDB.16.0;Data Source=$Mdb;Jet OLEDB:Database Password=$Pw;"
$c = New-Object System.Data.OleDb.OleDbConnection $cs; $c.Open()
$nowCols = @{ "CALIBRAT" = [string[]]@("DateEntered","LastModified","DateFinalized"); "PCNotes" = [string[]]@("DateEntered"); "CALTEST" = [string[]]@("DateEntered") }
$sb = New-Object System.Text.StringBuilder
foreach ($t in @("CALIBRAT","CalGroups","CALDET","CALTEST","PCNotes","INSTSPEC","InstSpecGroup","IDs")) {
  $cmd = $c.CreateCommand(); $cmd.CommandText = "SELECT * FROM [$t]"
  $da = New-Object System.Data.OleDb.OleDbDataAdapter $cmd; $dt = New-Object System.Data.DataTable; [void]$da.Fill($dt)
  $nc = $nowCols[$t]; if ($null -eq $nc) { $nc = [string[]]@() }
  [DumpFmt]::Table($sb, $t, $dt, $nc)
}
$schema = $c.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Tables, @($null,$null,$null,"TABLE"))
$names = @(); foreach ($r in $schema.Rows) { $names += [string]$r["TABLE_NAME"] }
[void]$sb.Append("### CONTEO " + $names.Count + " tablas`r`n")
foreach ($n in ($names | Sort-Object)) {
  $cmd = $c.CreateCommand(); $cmd.CommandText = "SELECT COUNT(*) FROM [$n]"
  [void]$sb.Append($n + "=" + $cmd.ExecuteScalar() + "`r`n")
}
$c.Close()
[System.IO.File]::WriteAllText($Out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
Write-Host ("Volcado: " + $Out)
