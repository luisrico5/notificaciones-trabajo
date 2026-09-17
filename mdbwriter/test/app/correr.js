// Corre las pruebas Node de la app (sin navegador; fetch y nube simulados) sobre el JavaScript del index.html construido.
// Uso: node mdbwriter/test/app/correr.js [ruta a index.html]   (por defecto ../../../index.html)
"use strict";
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const index = process.argv[2] || path.join(__dirname, "..", "..", "..", "index.html");
const html = fs.readFileSync(index, "utf8");
const bloques = []; const re = /<script>([\s\S]*?)<\/script>/g; let m;
while ((m = re.exec(html))) bloques.push(m[1]);
fs.writeFileSync(path.join(__dirname, "app_check.js"), bloques[1]);   // 2.º <script> = lógica de la app
const chk = spawnSync(process.execPath, ["--check", path.join(__dirname, "app_check.js")], { encoding: "utf8" });
if (chk.status !== 0) { console.log("Sintaxis inválida:\n" + chk.stderr); process.exit(1); }
console.log("sintaxis de la app: OK");
let fallos = 0;
for (const f of ["e2e_auth.js", "e2e_nube_node.js", "e2e_datos_node.js", "e2e_salida_node.js", "e2e_abrir_node.js"]) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8", timeout: 300000 });
  const lineas = (r.stdout || "").split("\n");
  const resumen = lineas.filter(l => /RESUMEN/.test(l)).pop() || ("(sin resumen) " + (r.stderr || "").slice(0, 300));
  lineas.filter(l => /^\s*FAIL|EXCEPCI/.test(l)).forEach(l => console.log("  " + f + ": " + l.trim()));
  console.log(f + ": " + resumen.replace(/#/g, "").trim());
  if (r.status !== 0) fallos++;
}
process.exit(fallos ? 1 : 0);
