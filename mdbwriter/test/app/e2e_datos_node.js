// Pruebas Node (nube simulada en memoria) de datosCal: datos de calibración desde la base, compartidos en la nube.
const fs = require("fs"), vm = require("vm"), path = require("path"), zlib = require("zlib");
const APP = fs.readFileSync(path.join(__dirname, "app_check.js"), "utf8");
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } }
function eq(a, b, m) { ok(a === b, m + (a === b ? "" : "  [" + JSON.stringify(a) + " !== " + JSON.stringify(b) + "]")); }
function mkStore(init) { const s = Object.assign({}, init || {}); return { getItem(k) { return (k in s) ? s[k] : null; }, setItem(k, v) { s[k] = String(v); }, removeItem(k) { delete s[k]; }, _s: s }; }
function mkEl(id) { const classes = new Set(); return { id, hidden: false, textContent: "", value: "", disabled: false, innerHTML: "", className: "", style: {}, dataset: {}, files: [], checked: false,
  classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, toggle(c, f) { if (f === undefined) f = !classes.has(c); if (f) classes.add(c); else classes.delete(c); return f; }, contains(c) { return classes.has(c); } },
  addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, hasAttribute() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; }, focus() {}, blur() {}, click() {}, remove() {}, closest() { return null; } }; }
const PROFILE = { id: "u1", email: "ana@planta.com", full_name: "Ana Prueba", role: "tecnico", approved: true };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- nube simulada ----
function nuevaNube() { return { objetos: new Map(), llamadas: [], caida: false }; }
function res(status, body, blob) { return Promise.resolve({ ok: status >= 200 && status < 300, status, text() { return Promise.resolve(body == null ? "" : JSON.stringify(body)); }, blob() { return Promise.resolve(blob); } }); }
function fetchNube(nube) {
  return async (url, init) => {
    const u = new URL(url), m = (init && init.method) || "GET", ruta = u.pathname;
    nube.llamadas.push(m + " " + ruta);
    if (/\/rest\/v1\/profiles/.test(ruta)) return res(200, [PROFILE]);
    if (nube.caida) return Promise.reject(new TypeError("Failed to fetch"));
    let mm;
    if (ruta === "/storage/v1/object/list/respaldo-base") return res(200, Array.from(nube.objetos.keys()).map(n => ({ name: n, id: n, updated_at: nube.objetos.get(n).t })));
    if ((mm = ruta.match(/^\/storage\/v1\/object\/respaldo-base\/(.+)$/)) && m === "POST") { nube.objetos.set(mm[1], { b: Buffer.from(await init.body.arrayBuffer()), t: new Date().toISOString() + Math.random() }); return res(200, { Key: "x" }); }
    if ((mm = ruta.match(/^\/storage\/v1\/object\/authenticated\/respaldo-base\/(.+)$/))) { const o = nube.objetos.get(mm[1]); return o ? res(200, null, new Blob([o.b])) : res(400, { statusCode: "404", error: "not_found", message: "Object not found" }); }
    return res(404, { message: "no simulada " + ruta });
  };
}
function load(nube, store) {
  const els = {}; const $ = id => els[id] || (els[id] = mkEl(id));
  const document = { getElementById: $, querySelector() { return mkEl("q"); }, querySelectorAll() { return []; }, createElement() { return mkEl("c"); }, addEventListener() {}, body: mkEl("body"), documentElement: mkEl("html") };
  store = store || mkStore({ noti_auth_v1: JSON.stringify({ v: 1, tokens: { access: "A1", refresh: "R1", expiresAt: Math.floor(Date.now() / 1000) + 3600 }, user: { id: PROFILE.id, email: PROFILE.email }, profile: PROFILE }) });
  const w = { addEventListener() {}, print() {}, scrollTo() {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
  const ctx = vm.createContext({ console, Math, JSON, Date, parseFloat, parseInt, isFinite, isNaN, String, Number, Array, Object, RegExp, Promise, setTimeout: (f, ms) => setTimeout(f, ms > 1000 ? 100000 : ms), clearTimeout, setInterval, clearInterval,
    encodeURIComponent, decodeURIComponent, Uint8Array, Int8Array, ArrayBuffer, document, localStorage: store, sessionStorage: mkStore(), navigator: { onLine: true }, location: { reload() {} }, window: w, self: w,
    fetch: fetchNube(nube), alert() {}, confirm() { return true; }, FileReader: function () {}, Blob, Response, CompressionStream, DecompressionStream, crypto: globalThis.crypto,
    URL: { createObjectURL() { return ""; }, revokeObjectURL() {} }, html2pdf: function () { return { set() { return this; }, from() { return this; }, save() { return Promise.resolve(); } }; } });
  vm.runInContext(APP + "\n;globalThis.__api={datosCal, repLookup, buildRepBatch, get CAL_OVERRIDE(){return CAL_OVERRIDE;}, get REP_BATCH(){return REP_BATCH;}, set REP_BATCH_EDITADO(v){REP_BATCH_EDITADO=v;}, get rows(){return rows;}, makeRow};", ctx, { filename: "app.js" });
  return { api: ctx.__api, els, store };
}
// Datos de prueba con la estructura de datos_calibracion.json
function datos(ultimoId, by, nombre) {
  return { version: 2, generado: "x", tags: { PTU7122: { r: "0 a 100 psi", s: "4 a 20 mA", p: [], by: by, d: "2026-09-17", li: "" } },
    reportes: { PTU7122: { tag: "PT-U7122", n: "TRANSMISOR", co: "C", mf: "", mo: "", sr: "", st: "", cl: "", lo: "", bu: "", de: "", eq: "", g: [{ gn: 1, na: "", sa: "Pct of Range", ra: 0.5, rd: 0, pm: 0, it: "psi", ot: "mA", pts: [[0, 4, 3.92, 4.08], [100, 20, 19.92, 20.08]] }], ct: "", tp: "", hu: "", ce: "", by: by, nt: "", std: [] } },
    patrones: {}, tecnicos: [by], base: { nombre: nombre || "base.mdb", ultimoId: ultimoId, ultimaFecha: "2026-09-17" } };
}
const gunzipJson = b => JSON.parse(zlib.gunzipSync(b).toString("utf8"));

(async () => {
  console.log("\n[D1] Base más nueva: se aplica y se comparte");
  { const nube = nuevaNube(); const A = load(nube);
    await sleep(30);
    const r = await A.api.datosCal.actualizarDesdeBase(JSON.stringify(datos(7053, "PRUEBA UNO")), "base.mdb");
    eq(r.cls, "ok", "resultado ok: " + r.msg.replace(/<[^>]+>/g, ""));
    eq(A.api.CAL_OVERRIDE.base.ultimoId, 7053, "CAL_OVERRIDE con la base nueva");
    eq(A.api.repLookup("PT-U7122").by, "PRUEBA UNO", "repLookup ya usa los datos nuevos");
    ok(JSON.parse(A.store.getItem("noti_calib_v1")).pendienteNube === false, "guardado en localStorage y sin pendiente");
    const o = nube.objetos.get("datos_calibracion.json.gz");
    ok(o && gunzipJson(o.b).base.ultimoId === 7053 && !("pendienteNube" in gunzipJson(o.b)) && !("origen" in gunzipJson(o.b)), "subido a la nube (sin campos locales)");
    ok(JSON.parse(A.store.getItem("noti_calib_nube_v1")).v, "meta de la nube guardada (no se vuelve a bajar)");
  }

  console.log("\n[D2] Base más vieja: no se aplica ni se comparte");
  { const nube = nuevaNube(); const A = load(nube);
    await sleep(30);
    await A.api.datosCal.actualizarDesdeBase(JSON.stringify(datos(7053, "NUEVO")), "nueva.mdb");
    const antes = nube.objetos.get("datos_calibracion.json.gz").t;
    const r = await A.api.datosCal.actualizarDesdeBase(JSON.stringify(datos(6937, "VIEJO")), "vieja.mdb");
    eq(r.cls, "warn", "avisa: " + r.msg.replace(/<[^>]+>/g, ""));
    eq(A.api.CAL_OVERRIDE.base.ultimoId, 7053, "se conservan los datos vigentes");
    eq(nube.objetos.get("datos_calibracion.json.gz").t, antes, "la nube no cambió");
  }

  console.log("\n[D3] La nube tiene una base más nueva: se aplican los de la nube");
  { const nube = nuevaNube();
    nube.objetos.set("datos_calibracion.json.gz", { b: zlib.gzipSync(JSON.stringify(datos(8000, "DE LA NUBE"))), t: "t0" });
    const A = load(nube);
    await sleep(30);
    const r = await A.api.datosCal.actualizarDesdeBase(JSON.stringify(datos(7500, "LOCAL")), "local.mdb");
    eq(r.cls, "warn", "avisa: " + r.msg.replace(/<[^>]+>/g, ""));
    eq(A.api.CAL_OVERRIDE.base.ultimoId, 8000, "quedan los datos de la nube");
    eq(A.api.CAL_OVERRIDE.origen, "nube", "origen nube");
    eq(gunzipJson(nube.objetos.get("datos_calibracion.json.gz").b).base.ultimoId, 8000, "la nube no se sobrescribió");
  }

  console.log("\n[D4] Sin conexión: se aplica local y queda pendiente; al sincronizar se comparte");
  { const nube = nuevaNube(); const A = load(nube);
    await sleep(30);
    nube.caida = true;
    const r = await A.api.datosCal.actualizarDesdeBase(JSON.stringify(datos(7100, "SIN RED")), "base.mdb");
    eq(r.cls, "warn", "avisa: " + r.msg.replace(/<[^>]+>/g, ""));
    eq(A.api.CAL_OVERRIDE.pendienteNube, true, "queda pendiente de compartir");
    ok(!nube.objetos.has("datos_calibracion.json.gz"), "nada en la nube todavía");
    nube.caida = false;
    await A.api.datosCal.sincronizar();
    ok(nube.objetos.has("datos_calibracion.json.gz") && gunzipJson(nube.objetos.get("datos_calibracion.json.gz").b).base.ultimoId === 7100, "sincronizar lo compartió");
    eq(A.api.CAL_OVERRIDE.pendienteNube, false, "ya no queda pendiente");
  }

  console.log("\n[D5] Otro navegador: al abrir baja los datos de la nube; si no cambiaron no los vuelve a bajar");
  { const nube = nuevaNube();
    nube.objetos.set("datos_calibracion.json.gz", { b: zlib.gzipSync(JSON.stringify(datos(7200, "COMPARTIDO"))), t: "t1" });
    const B = load(nube);
    await sleep(30);
    await B.api.datosCal.sincronizar();
    eq(B.api.CAL_OVERRIDE && B.api.CAL_OVERRIDE.base.ultimoId, 7200, "aplicó los datos de la nube");
    eq(B.api.repLookup("PT-U7122").by, "COMPARTIDO", "los reportes por defecto ya los usan");
    const n0 = nube.llamadas.filter(c => /authenticated/.test(c)).length;
    await B.api.datosCal.sincronizar();
    eq(nube.llamadas.filter(c => /authenticated/.test(c)).length, n0, "segunda sincronización: no vuelve a bajar");
    nube.objetos.set("datos_calibracion.json.gz", { b: zlib.gzipSync(JSON.stringify(datos(7300, "MAS NUEVO"))), t: "t2" });
    await B.api.datosCal.sincronizar();
    eq(B.api.CAL_OVERRIDE.base.ultimoId, 7300, "si cambió en la nube, baja y aplica lo nuevo");
    nube.objetos.set("datos_calibracion.json.gz", { b: zlib.gzipSync(JSON.stringify(datos(7000, "VIEJO EN NUBE"))), t: "t3" });
    await B.api.datosCal.sincronizar();
    eq(B.api.CAL_OVERRIDE.base.ultimoId, 7300, "si en la nube quedó algo más viejo, no retrocede");
  }

  console.log("\n[D6] Lote de reportes: se regenera si no fue editado; si fue editado, se respeta");
  { const nube = nuevaNube(); const A = load(nube);
    await sleep(30);
    A.api.rows.push(A.api.makeRow("12345678", "TRANSMISOR PT-U7122", "", "17/09/2026"));
    A.api.buildRepBatch();
    await A.api.datosCal.actualizarDesdeBase(JSON.stringify(datos(7400, "REGENERADO")), "b.mdb");
    eq(A.api.REP_BATCH[0] && A.api.REP_BATCH[0].rec.by, "REGENERADO", "lote sin editar: regenerado con los datos nuevos");
    A.api.REP_BATCH_EDITADO = true;
    const st = A.api.REP_BATCH[0];
    await A.api.datosCal.actualizarDesdeBase(JSON.stringify(datos(7500, "OTRO")), "c.mdb");
    ok(A.api.REP_BATCH[0] === st, "lote editado: no se tocó");
    ok(/más recientes/.test(A.els.repMsg.innerHTML), "y se avisa en la pestaña");
  }

  console.log("\n[D7] Errores de lectura");
  { const nube = nuevaNube(); const A = load(nube);
    await sleep(30);
    const r1 = await A.api.datosCal.actualizarDesdeBase(JSON.stringify({ ok: false, error: "La base no tiene las tablas" }), "x.mdb");
    eq(r1.cls, "err", "error del extractor: " + r1.msg.replace(/<[^>]+>/g, ""));
    const r2 = await A.api.datosCal.actualizarDesdeBase(JSON.stringify({ version: 2, tags: {}, reportes: {}, base: { ultimoId: 9 } }), "x.mdb");
    eq(r2.cls, "err", "base sin instrumentos: no cambia nada");
    ok(!A.api.CAL_OVERRIDE, "sigue con los datos incrustados");
  }
  console.log("\n########## RESUMEN DATOS: " + pass + " OK, " + fail + " FAIL ##########");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("EXCEPCIÓN: " + (e.stack || e)); process.exit(2); });
