// Ejecuta el escritor compilado a JavaScript (el mismo código que corre en la página) sobre una base y un JSON.
// Uso: node node_test.js <grabar_mdb.js> <entrada.mdb> <grabar.json> <salida.mdb> <yyyy-MM-ddTHH:mm:ss> [--no-spec]
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const [libPath, mdbPath, jsonPath, outPath, ahora, flag] = process.argv.slice(2);
const src = fs.readFileSync(libPath, "utf8");
let api;
if (/function MDBW_FACTORY\(/.test(src)) {
  // src/grabar_mdb.js envuelto (como va dentro de index.html)
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + "\nthis.__api = MDBW_FACTORY();", ctx); api = ctx.__api;
} else {
  api = require(path.resolve(libPath));   // salida UMD directa de TeaVM
}
const input = fs.readFileSync(mdbPath);
const json = fs.readFileSync(jsonPath, "utf8");
const TROZO = 8 * 1024 * 1024;
const t0 = Date.now();
api.nuevaBase();
for (let off = 0; off < input.length; off += TROZO) {
  const n = Math.min(TROZO, input.length - off);
  api.agregarBytes(new Int8Array(input.buffer, input.byteOffset + off, n));
}
const t1 = Date.now();
const res = JSON.parse(api.grabar(json, ahora, flag !== "--no-spec", path.basename(mdbPath)));
const t2 = Date.now();
if (!res.ok) { console.log("ERROR:", res.error, "(" + res.tipo + ")"); process.exit(2); }
const total = api.tamano();
const fd = fs.openSync(outPath, "w");
for (let off = 0; off < total; off += TROZO) {
  const parte = api.leerBytes(off, Math.min(TROZO, total - off));
  fs.writeSync(fd, Buffer.from(parte.buffer, parte.byteOffset, parte.byteLength));
}
fs.closeSync(fd);
api.liberar();
const t3 = Date.now();
for (const l of res.log) console.log(l);
console.log("verificacion:", JSON.stringify(res.verificacion));
console.log(`(JS cargar ${t1 - t0} ms, grabar+verificar ${t2 - t1} ms, leer ${t3 - t2} ms; bytes ${total}; RSS ${Math.round(process.memoryUsage().rss / 1048576)} MB)`);
