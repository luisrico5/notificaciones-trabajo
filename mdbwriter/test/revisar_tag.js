// Revisa en una base .mdb lo que quedó grabado de un TAG: cabecera de la calibración, especificación
// (InstSpecGroup + INSTSPEC) y grupos de la calibración. Sirve para comprobar a ojo lo que crea el grabado
// cuando el instrumento no tenía calibración previa. Solo LEE (usa el escritor compilado, src/grabar_mdb.js).
//
// Uso: node mdbwriter/test/revisar_tag.js <base.mdb> <TAG>
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const [mdbPath, tag] = process.argv.slice(2);
if (!mdbPath || !tag) { console.log("Uso: node revisar_tag.js <base.mdb> <TAG>"); process.exit(2); }
const lib = path.join(__dirname, "..", "..", "src", "grabar_mdb.js");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(lib, "utf8") + "\nthis.__api = MDBW_FACTORY();", ctx);
const api = ctx.__api;
const input = fs.readFileSync(mdbPath), TROZO = 8 * 1024 * 1024;
api.nuevaBase();
for (let off = 0; off < input.length; off += TROZO) api.agregarBytes(new Int8Array(input.buffer, input.byteOffset + off, Math.min(TROZO, input.length - off)));
// El extractor devuelve los datos del instrumento tal como los ve la página (cabecera + grupos + puntos).
const datos = JSON.parse(api.extraer("18/09/2026", path.basename(mdbPath)));
api.liberar();
const norm = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const k = Object.keys(datos.reportes || {}).find(x => norm(x) === norm(tag));
if (!k) { console.log("El TAG " + tag + " no aparece en la base."); process.exit(1); }
const r = datos.reportes[k];
console.log("=== " + r.tag + " ===");
console.log("nombre=" + r.n + " | empresa=" + r.co + " | fabricante=" + r.mf + " | modelo=" + r.mo + " | serie=" + r.sr);
console.log("estado=" + r.st + " | ubicacion=" + r.lo + " | depto=" + r.de + " | equipo=" + r.eq);
console.log("ultimo reporte -> tipo=" + r.ct + " | cert=" + r.ce + " | tecnico=" + r.by + " | temp=" + r.tp + " | humedad=" + r.hu);
(r.g || []).forEach(g => {
  console.log("grupo " + g.gn + ": " + (g.pts || []).length + " puntos | " + g.it + " -> " + g.ot
    + " | precision=" + g.sa + " pctRango=" + g.ra);
  (g.pts || []).forEach((p, i) => console.log("   punto " + (i + 1) + ": entrada=" + p[0] + " salida=" + p[1] + " limites=" + p[2] + ".." + p[3]));
});
const t = (datos.tags || {})[norm(tag)];
if (t) console.log("rango=" + t.r + " | salida=" + t.s + " | patrones=" + ((t.p || []).length) + " | tecnico=" + t.by + " | fecha=" + t.d);
