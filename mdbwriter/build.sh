#!/usr/bin/env bash
# Construye src/grabar_mdb.js: el escritor de la base DPCTrack2 (.mdb) que usa la página para
# "Grabar a la base de datos" en línea. Es el port de src/grabar_reporte.ps1 (app/) sobre Jackcess,
# compilado a JavaScript con TeaVM. Ver mdbwriter/README.md.
#
# Uso:  bash mdbwriter/build.sh          (Git Bash en Windows, o bash en Linux/macOS)
# Requisitos: JDK 11+ (java, javac, jar), curl, unzip, patch, sha1sum. Maven se descarga si no está.
# Descargas (Maven Central, con verificación SHA-1) y compilados quedan en mdbwriter/work/ (no se versiona).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
W="$DIR/work"
MC="https://repo1.maven.org/maven2"
JACKCESS=5.0.0
ASM=9.10.1
MAVEN=3.9.11

SEP=":"
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) SEP=";" ;; esac
p() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

mkdir -p "$W/lib"

# Descarga $1 (ruta en Maven Central) a $2 y verifica su SHA-1 publicado.
dl() {
  local url="$MC/$1" out="$2"
  if [ ! -s "$out" ]; then
    echo "descargando $1"
    curl -fsSL -o "$out.tmp" "$url"
    local want got
    want="$(curl -fsSL "$url.sha1" | tr -d ' \r\n' | cut -c1-40)"
    got="$(sha1sum "$out.tmp" | cut -c1-40)"
    if [ "$want" != "$got" ]; then echo "SHA-1 no coincide para $1 ($got != $want)" >&2; rm -f "$out.tmp"; exit 1; fi
    mv "$out.tmp" "$out"
  fi
}

dl "com/healthmarketscience/jackcess/jackcess/$JACKCESS/jackcess-$JACKCESS.jar" "$W/lib/jackcess-$JACKCESS.jar"
dl "com/healthmarketscience/jackcess/jackcess/$JACKCESS/jackcess-$JACKCESS-sources.jar" "$W/lib/jackcess-$JACKCESS-sources.jar"
for a in asm asm-tree asm-commons; do
  dl "org/ow2/asm/$a/$ASM/$a-$ASM.jar" "$W/lib/$a-$ASM.jar"
done

if command -v mvn >/dev/null 2>&1; then
  MVN=mvn
else
  dl "org/apache/maven/apache-maven/$MAVEN/apache-maven-$MAVEN-bin.zip" "$W/maven.zip"
  [ -d "$W/apache-maven-$MAVEN" ] || unzip -q "$W/maven.zip" -d "$W"
  MVN="$W/apache-maven-$MAVEN/bin/mvn"
fi

JC="$W/lib/jackcess-$JACKCESS.jar"
ASMCP="$(p "$W/lib/asm-$ASM.jar")$SEP$(p "$W/lib/asm-tree-$ASM.jar")$SEP$(p "$W/lib/asm-commons-$ASM.jar")"

echo "== 1/6 parche de Jackcess (IndexPageCache: entradas de nodo padre que Access deja desactualizadas)"
rm -rf "$W/patch-src" "$W/patch-classes" "$W/jx"
mkdir -p "$W/patch-src" "$W/patch-classes" "$W/jx"
(cd "$W/patch-src" && unzip -q "$(p "$W/lib/jackcess-$JACKCESS-sources.jar")" "com/healthmarketscience/jackcess/impl/IndexPageCache.java")
patch -s -p1 -d "$W/patch-src" < "$DIR/patch/IndexPageCache.diff"
javac -nowarn --release 11 -encoding UTF-8 -cp "$(p "$JC")" -d "$(p "$W/patch-classes")" \
  "$(p "$W/patch-src/com/healthmarketscience/jackcess/impl/IndexPageCache.java")"
(cd "$W/jx" && jar xf "$(p "$JC")")
rm -f "$W/jx"/com/healthmarketscience/jackcess/impl/IndexPageCache*.class
cp "$W/patch-classes"/com/healthmarketscience/jackcess/impl/IndexPageCache*.class "$W/jx/com/healthmarketscience/jackcess/impl/"
rm -f "$W/lib/jackcess-$JACKCESS-patched.jar"
jar cf "$(p "$W/lib/jackcess-$JACKCESS-patched.jar")" -C "$(p "$W/jx")" .

echo "== 2/6 sustitutos del JDK para el navegador (mdbshim)"
rm -rf "$W/shim-classes" && mkdir -p "$W/shim-classes"
SHIMS=()
while IFS= read -r f; do SHIMS+=("$(p "$f")"); done < <(find "$DIR/shim" -name '*.java')
javac -nowarn --release 11 -encoding UTF-8 -d "$(p "$W/shim-classes")" "${SHIMS[@]}"
rm -f "$W/lib/mdbshim.jar"
jar cf "$(p "$W/lib/mdbshim.jar")" -C "$(p "$W/shim-classes")" .

echo "== 3/6 reescritura del bytecode de Jackcess (fórmulas desactivadas, tipos del JDK -> mdbshim)"
rm -rf "$W/rewriter-classes" && mkdir -p "$W/rewriter-classes"
javac -nowarn -encoding UTF-8 -cp "$ASMCP" -d "$(p "$W/rewriter-classes")" "$(p "$DIR/rewriter/WebRewriter.java")"
java -cp "$ASMCP$SEP$(p "$W/rewriter-classes")" WebRewriter \
  "$(p "$W/lib/jackcess-$JACKCESS-patched.jar")" "$(p "$W/shim-classes")" "$(p "$W/lib/jackcess-web.jar")"

echo "== 4/6 instalar los jars en el repositorio Maven local"
"$MVN" -q -B install:install-file -Dfile="$(p "$W/lib/jackcess-web.jar")" -DgroupId=local.noti -DartifactId=jackcess-web -Dversion=5.0.0-web -Dpackaging=jar
"$MVN" -q -B install:install-file -Dfile="$(p "$W/lib/mdbshim.jar")" -DgroupId=local.noti -DartifactId=mdbshim -Dversion=1.0 -Dpackaging=jar

echo "== 5/6 compilar a JavaScript con TeaVM"
"$MVN" -q -B -f "$(p "$DIR/app/pom.xml")" clean process-classes
JS="$DIR/app/target/js/grabar_mdb.js"
[ -s "$JS" ] || { echo "TeaVM no generó $JS" >&2; exit 1; }

echo "== 6/6 envolver en src/grabar_mdb.js"
first="$(head -n 1 "$JS" | tr -d '\r')"
if [ "$first" != '"use strict";' ]; then echo "Formato inesperado de TeaVM (primera línea: $first)" >&2; exit 1; fi
if grep -qiE '</script|<!--' "$JS"; then echo "El JS contiene </script o <!-- (rompería index.html)" >&2; exit 1; fi
OUT="$ROOT/src/grabar_mdb.js"
{
  echo '/* grabar_mdb.js - GENERADO por mdbwriter/build.sh. NO editar a mano.'
  echo '   Escritor de la base DPCTrack2 (.mdb, Access/Jet 4) para el navegador: port de src/grabar_reporte.ps1'
  echo '   (mdbwriter/app) compilado a JavaScript con TeaVM 0.15.0. Uso: var api = MDBW_FACTORY();'
  echo '   Incluye codigo de terceros bajo Apache License 2.0 (texto en mdbwriter/LICENSE-APACHE-2.0.txt):'
  echo '   - Jackcess 5.0.0 (https://jackcess.sourceforge.io). MODIFICADO: parche en IndexPageCache'
  echo '     (mdbwriter/patch) y bytecode reescrito para el navegador (mdbwriter/rewriter + mdbwriter/shim).'
  echo '   - TeaVM 0.15.0, runtime y classlib (https://teavm.org). */'
  printf 'function MDBW_FACTORY(){"use strict";var exports={},define;\n'
  tail -n +2 "$JS"
  printf '\nreturn exports;}\n'
} > "$OUT"
echo "listo: $OUT ($(wc -c < "$OUT") bytes). Reconstruye index.html con build.ps1 o build.sh."
