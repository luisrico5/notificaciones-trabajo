# Ensambla index.html (un solo archivo) desde src/.
# Uso:  powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'src'
$enc  = [Text.Encoding]::UTF8
$head = [IO.File]::ReadAllText((Join-Path $src 'part_head.html'), $enc)
$lib  = [IO.File]::ReadAllText((Join-Path $src 'xlsx.full.min.js'), $enc)
$tail = [IO.File]::ReadAllText((Join-Path $src 'part_tail.html'), $enc)
$out  = Join-Path $root 'index.html'
[IO.File]::WriteAllText($out, ($head + $lib + "`n" + $tail), (New-Object Text.UTF8Encoding($false)))
Write-Host ("index.html generado: " + (Get-Item $out).Length + " bytes")
