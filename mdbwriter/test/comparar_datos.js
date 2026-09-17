// Compara dos datos_calibracion.json (el de src/extract_ranges.ps1 y el del extractor Java/JS) por CONTENIDO:
// mismas claves y valores en tags, reportes, patrones y tecnicos (el orden de las claves de objeto no importa; el
// de los arreglos sí). Ignora "generado" y "base" (metadatos). Uso: node comparar_datos.js referencia.json otro.json
"use strict";
const fs = require("fs");
const leer = f => JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));
const [A, B] = process.argv.slice(2).map(leer);
const difs = [];
function cmp(a, b, ruta) {
  if (difs.length > 400) return;
  if (a === b) return;
  if (typeof a === "number" && typeof b === "number") { if (a !== b) difs.push(ruta + ": " + a + " != " + b); return; }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) { difs.push(ruta + ": arreglo vs no arreglo " + JSON.stringify(a).slice(0, 80) + " | " + JSON.stringify(b).slice(0, 80)); return; }
    if (a.length !== b.length) difs.push(ruta + ": largo " + a.length + " != " + b.length + " " + JSON.stringify(a).slice(0, 160) + " | " + JSON.stringify(b).slice(0, 160));
    for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], ruta + "[" + i + "]");
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    for (const k of ka) if (!(k in b)) difs.push(ruta + "." + k + ": solo en referencia " + JSON.stringify(a[k]).slice(0, 120));
    for (const k of kb) if (!(k in a)) difs.push(ruta + "." + k + ": solo en el otro " + JSON.stringify(b[k]).slice(0, 120));
    for (const k of ka) if (k in b) cmp(a[k], b[k], ruta + "." + k);
    return;
  }
  difs.push(ruta + ": " + JSON.stringify(a) + " != " + JSON.stringify(b));
}
for (const parte of ["version", "tags", "reportes", "patrones", "tecnicos"]) cmp(A[parte], B[parte], parte);
const n = o => (o ? Object.keys(o).length : 0);
console.log("referencia: tags " + n(A.tags) + ", reportes " + n(A.reportes) + ", patrones " + n(A.patrones) + ", tecnicos " + (A.tecnicos || []).length);
console.log("otro:       tags " + n(B.tags) + ", reportes " + n(B.reportes) + ", patrones " + n(B.patrones) + ", tecnicos " + (B.tecnicos || []).length);
if (difs.length) { console.log("DIFIEREN (" + difs.length + (difs.length > 400 ? "+" : "") + "):"); difs.forEach(d => console.log("  " + d)); process.exit(1); }
console.log("IDENTICOS en contenido (tags, reportes, patrones, tecnicos)");
