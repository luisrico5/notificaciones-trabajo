// Extrae con el JavaScript de la página (src/grabar_mdb.js) los datos de calibración de una base, para compararlos
// con src/extract_ranges.ps1 (comparar_datos.js). Uso: node node_extraer.js <grabar_mdb.js> <base.mdb> <salida.json>
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const [libPath, mdbPath, outPath] = process.argv.slice(2);
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(libPath, "utf8") + "\nthis.__api = MDBW_FACTORY();", ctx);
const api = ctx.__api;
const input = fs.readFileSync(mdbPath), TROZO = 8 * 1024 * 1024;
const t0 = Date.now();
api.nuevaBase();
for (let off = 0; off < input.length; off += TROZO) api.agregarBytes(new Int8Array(input.buffer, input.byteOffset + off, Math.min(TROZO, input.length - off)));
const json = api.extraer("2026-01-01 00:00", path.basename(mdbPath));
api.liberar();
const obj = JSON.parse(json);
if (obj.ok === false) { console.log("ERROR: " + obj.error + " (" + obj.tipo + ")"); process.exit(2); }
fs.writeFileSync(outPath, json);
console.log("(JS extraer " + (Date.now() - t0) + " ms; tags " + Object.keys(obj.tags).length + ", reportes " + Object.keys(obj.reportes).length +
  "; base " + JSON.stringify(obj.base) + ")");
