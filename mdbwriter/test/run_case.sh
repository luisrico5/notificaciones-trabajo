#!/usr/bin/env bash
# Prueba de fidelidad: graba el MISMO JSON sobre dos copias de la misma base, una con src/grabar_reporte.ps1
# (motor de Access, el flujo de grabar.bat) y otra con el port Java (misma lógica que corre en la página), y
# compara el volcado completo de las 8 tablas que se tocan + el conteo de filas de TODAS las tablas.
# Luego ejecuta el JavaScript (src/grabar_mdb.js) con la misma hora y exige que sea idéntico byte a byte a la JVM.
#
# Uso (Git Bash en Windows, con Access Database Engine y JDK; antes: bash mdbwriter/build.sh):
#   DPC_CLAVE='<clave de la base>' bash mdbwriter/test/run_case.sh <nombre> <base_editable.mdb> <grabar.json> [carpeta_salida]
# Nunca uses la base _backup: se trabaja siempre sobre COPIAS en la carpeta de salida.
set -euo pipefail
N="$1"; BASE="$2"; J="$3"; OUT="${4:-${TMPDIR:-/tmp}/mdbwriter-casos}"
: "${DPC_CLAVE:?Define DPC_CLAVE con la clave de la base}"
case "$BASE" in *backup*|*BACKUP*|*Backup*) echo "No se usa una base _backup (solo consulta)." >&2; exit 1 ;; esac
DIR="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="$(cd "$DIR/.." && pwd)"
p() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
mkdir -p "$OUT"
cp "$BASE" "$OUT/$N.ps.mdb"; cp "$BASE" "$OUT/$N.java.mdb"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(p "$ROOT/src/grabar_reporte.ps1")" -Json "$(p "$J")" -Mdb "$(p "$OUT/$N.ps.mdb")" -Password "$DPC_CLAVE" > "$OUT/$N.ps.log" 2>&1
echo "PS exit=$?"
NOW="$(date +%Y-%m-%dT%H:%M:%S.%3N)"
CP="$(p "$DIR/work/lib/jackcess-web.jar");$(p "$DIR/work/lib/mdbshim.jar");$(p "$DIR/app/target/classes")"
java -cp "$CP" grabarmdb.Cli "$(p "$OUT/$N.java.mdb")" "$(p "$J")" "$(p "$OUT/$N.java.out.mdb")" "$NOW" > "$OUT/$N.java.log" 2>&1
echo "Java exit=$?"
for v in ps java.out; do
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(p "$DIR/test/dump_fast.ps1")" -Mdb "$(p "$OUT/$N.$v.mdb")" -Pw "$DPC_CLAVE" -Out "$(p "$OUT/$N.$v.dump.txt")" > /dev/null
done
if cmp -s "$OUT/$N.ps.dump.txt" "$OUT/$N.java.out.dump.txt"; then
  echo "RESULTADO $N: IDENTICO a grabar_reporte.ps1 (8 tablas completas + conteo de todas las tablas)"
else
  echo "RESULTADO $N: DIFIERE"; diff "$OUT/$N.ps.dump.txt" "$OUT/$N.java.out.dump.txt" | head -40; exit 1
fi
node "$DIR/test/node_test.js" "$ROOT/src/grabar_mdb.js" "$OUT/$N.java.mdb" "$J" "$OUT/$N.js.mdb" "$NOW" > "$OUT/$N.js.log" 2>&1
if cmp -s "$OUT/$N.java.out.mdb" "$OUT/$N.js.mdb"; then echo "RESULTADO $N: JavaScript == JVM byte a byte"; else echo "RESULTADO $N: JavaScript DIFIERE de la JVM"; exit 1; fi
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(p "$DIR/test/verify_index.ps1")" -Mdb "$(p "$OUT/$N.js.mdb")" -Pw "$DPC_CLAVE" | tr -d '\r' | grep -E "FAIL|RESULTADO|clave"
