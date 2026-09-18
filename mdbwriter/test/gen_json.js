// Genera un JSON de grabado igual que el botón "Grabar a la base de datos", para las pruebas de fidelidad
// (run_case.sh). Útil sobre todo para instrumentos que NO tienen calibración previa: así se comprueba que el
// script y el port crean la calibración (y la especificación, si falta) exactamente igual.
//
// Uso: node mdbwriter/test/gen_json.js <salida.json> TAG1 [TAG2 ...]
//   (antes: node mdbwriter/test/app/correr.js, que extrae el JS de index.html a test/app/app_check.js)
"use strict";
const fs = require("fs"), vm = require("vm"), path = require("path");
const APP = fs.readFileSync(path.join(__dirname, "app", "app_check.js"), "utf8");
function mkStore() { const s = {}; return { getItem(k) { return (k in s) ? s[k] : null; }, setItem(k, v) { s[k] = String(v); }, removeItem(k) { delete s[k]; } }; }
function mkEl(id) { return { id, hidden: true, textContent: "", value: "", disabled: false, innerHTML: "", className: "", style: {}, dataset: {}, files: [], checked: false,
  classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
  addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, hasAttribute() { return false; },
  querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; }, focus() {}, blur() {}, click() {}, remove() {}, closest() { return null; } }; }
const els = {}; const $ = id => els[id] || (els[id] = mkEl(id));
const document = { getElementById: $, querySelector() { return mkEl("q"); }, querySelectorAll() { return []; }, createElement() { return mkEl("c"); }, addEventListener() {}, body: mkEl("body"), documentElement: mkEl("html") };
const w = { addEventListener() {}, print() {}, scrollTo() {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
const ctx = vm.createContext({ console, Math, JSON, Date, parseFloat, parseInt, isFinite, isNaN, String, Number, Array, Object, RegExp, Promise,
  setTimeout: () => 0, clearTimeout, setInterval, clearInterval, encodeURIComponent, decodeURIComponent, Uint8Array, Int8Array, ArrayBuffer,
  document, localStorage: mkStore(), sessionStorage: mkStore(), navigator: { onLine: false }, location: { reload() {} }, window: w, self: w,
  fetch: () => Promise.reject(new TypeError("sin red")), alert() {}, confirm() { return false; }, FileReader: function () {}, Blob, Response,
  URL: { createObjectURL() { return ""; }, revokeObjectURL() {} }, html2pdf: function () { return { set() { return this; }, from() { return this; }, save() { return Promise.resolve(); } }; } });
vm.runInContext(APP + "\n;globalThis.__api={repLookup, repBuildState, repGrabarPayload};", ctx, { filename: "app.js" });
const api = ctx.__api;

const [out, ...tags] = process.argv.slice(2);
if (!out || !tags.length) { console.log("Uso: node gen_json.js <salida.json> TAG1 [TAG2 ...]"); process.exit(2); }
const cals = [];
for (const t of tags) {
  const rec = api.repLookup(t);
  if (!rec) { console.log("NO ENCONTRADO: " + t); continue; }
  const st = api.repBuildState(rec);
  st.h.ce = "PRUEBA-" + t;
  st.h.dt = "18/09/2026"; st.h.fdt = "18/09/2026";
  st.h.by = "LUIS RICO"; st.h.tp = "25"; st.h.hu = "50";
  // Enc./Dejado = el nominal, salvo el primer punto del primer grupo (desviado, para ver el cálculo).
  st.groups.forEach((G, gi) => G.rows.forEach((r, i) => { r.found = r.outNom + (gi === 0 && i === 0 ? 0.01 : 0); r.left = r.outNom; }));
  cals.push(api.repGrabarPayload(st));
  console.log("incluido: " + rec.tag + "  grupos=" + st.groups.length + "  sin especificación=" + !!st.sinSpec
    + "  puntos=" + st.groups.map(g => g.rows.length).join(",")
    + "  unidades=" + st.groups.map(g => (g.meta.it || "") + "->" + (g.meta.ot || "")).join(" "));
}
fs.writeFileSync(out, JSON.stringify({ version: 1, generado: "18/09/2026", calibraciones: cals }, null, 1));
console.log("escrito " + out + " con " + cals.length + " instrumento(s)");
