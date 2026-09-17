// Pruebas Node (fetch simulado) del botón "Abrir todos" de la pestaña Mis reportes (misReportes.abrirTodos).
const fs = require("fs"), vm = require("vm"), path = require("path");
const APP = fs.readFileSync(path.join(__dirname, "app_check.js"), "utf8");
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } }
function eq(a, b, m) { ok(a === b, m + (a === b ? "" : "  [" + JSON.stringify(a) + " !== " + JSON.stringify(b) + "]")); }
function mkStore(init) { const s = Object.assign({}, init || {}); return { getItem(k) { return (k in s) ? s[k] : null; }, setItem(k, v) { s[k] = String(v); }, removeItem(k) { delete s[k]; }, _s: s }; }
function mkEl(id) { const classes = new Set(); return { id, hidden: id === "salidaModal" || id === "dbModal", textContent: "", value: "", disabled: false, innerHTML: "", className: "", style: {}, dataset: {}, files: [], checked: false,
  classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, toggle(c, f) { if (f === undefined) f = !classes.has(c); if (f) classes.add(c); else classes.delete(c); return f; }, contains(c) { return classes.has(c); } },
  addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, hasAttribute() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; }, focus() {}, blur() {}, click() {}, remove() {}, closest() { return null; } }; }
const PROFILE = { id: "u1", email: "ana@planta.com", full_name: "Ana Prueba", role: "tecnico", approved: true };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function res(status, body) { return Promise.resolve({ ok: status >= 200 && status < 300, status, text() { return Promise.resolve(body == null ? "" : JSON.stringify(body)); } }); }

function load() {
  const els = {}; const $ = id => els[id] || (els[id] = mkEl(id));
  const document = { getElementById: $, querySelector() { return mkEl("q"); }, querySelectorAll() { return []; }, createElement() { return mkEl("c"); }, addEventListener() {}, body: mkEl("body"), documentElement: mkEl("html") };
  // Nube simulada: filas guardadas (GET de la lista y de "Abrir todos") + registro de las consultas.
  const nube = { filas: [], gets: [], caida: false };
  const fetchMock = (url, init) => {
    const u = new URL(url), m = (init && init.method) || "GET";
    if (/\/rest\/v1\/profiles/.test(u.pathname)) return res(200, [PROFILE]);
    if (nube.caida) return Promise.reject(new TypeError("Failed to fetch"));
    if (u.pathname === "/rest/v1/reportes" && m === "GET") {
      nube.gets.push(u.search);
      const kind = (u.searchParams.get("kind") || "").replace("eq.", "");
      return res(200, nube.filas.filter(f => !kind || f.kind === kind));
    }
    return res(200, []);
  };
  const listeners = {};
  const w = { addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, print() {}, scrollTo() {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
  const store = mkStore({ noti_auth_v1: JSON.stringify({ v: 1, tokens: { access: "A1", refresh: "R1", expiresAt: Math.floor(Date.now() / 1000) + 3600 }, user: { id: PROFILE.id, email: PROFILE.email }, profile: PROFILE }) });
  const estado = { confirm: true };
  const ctx = vm.createContext({ console, Math, JSON, Date, parseFloat, parseInt, isFinite, isNaN, String, Number, Array, Object, RegExp, Promise,
    setTimeout: (f, ms) => (ms > 1000 ? 0 : setTimeout(f, ms)), clearTimeout, setInterval, clearInterval,
    encodeURIComponent, decodeURIComponent, Uint8Array, Int8Array, ArrayBuffer, document, localStorage: store, sessionStorage: mkStore(), navigator: { onLine: true },
    location: { reload() {} }, window: w, self: w, fetch: fetchMock, alert() {}, confirm() { return estado.confirm; }, FileReader: function () {}, Blob, Response,
    URL: { createObjectURL() { return ""; }, revokeObjectURL() {} }, html2pdf: function () { return { set() { return this; }, from() { return this; }, save() { return Promise.resolve(); } }; } });
  vm.runInContext(APP + "\n;globalThis.__api={misReportes, makeRow, repLookup, repBuildState, avisoSalida, normTag, get rows(){return rows;}, get REP_BATCH(){return REP_BATCH;}, get repState(){return repState;}, get REP_BATCH_EDITADO(){return REP_BATCH_EDITADO;}, get _appBooted(){return _appBooted;}};", ctx, { filename: "app.js" });
  return { api: ctx.__api, els, nube, store, estado };
}
// Arma una fila de la tabla "reportes" tal como la guarda la app.
function filaCal(api, tag, ot, found, id, fecha) {
  const st = api.repBuildState(api.repLookup(tag));
  st.h.ce = ot; st.groups[0].rows[0].found = found; st.groups[0].rows[0].left = found;
  return { id, user_id: "u1", kind: "calibracion", tag, ot, titulo: "Calibración " + tag, payload: api.misReportes.serializeCal(st), created_at: fecha, updated_at: fecha };
}
function filaNoti(api, tag, ot, recibido, id, fecha) {
  const r = api.makeRow(ot, "TRANSMISOR " + tag, "", "17/09/2026"); r.fields.recibido = recibido;
  return { id, user_id: "u1", kind: "notificacion", tag, ot, titulo: "Notificación " + tag, payload: api.misReportes.serializeNoti(r), created_at: fecha, updated_at: fecha };
}

(async () => {
  console.log("\n[A1] Abrir todos: calibraciones al lote y notificaciones a las órdenes");
  { const L = load(); await sleep(30); const api = L.api;
    // La nube devuelve de más nuevo a más viejo (order=updated_at.desc).
    L.nube.filas = [
      filaCal(api, "TIT-DR719", "21000003", 4.10, "c2", "2026-09-17T12:00:00Z"),
      filaNoti(api, "LT-R161", "21000002", "MARIA", "n1", "2026-09-17T11:00:00Z"),
      filaCal(api, "PT-U7122", "21000001", 4.05, "c1", "2026-09-17T10:00:00Z")
    ];
    eq(api.rows.length, 0, "se arranca sin órdenes cargadas");
    eq(api.REP_BATCH.length, 0, "se arranca sin reportes en el lote");
    await api.misReportes.abrirTodos();
    eq(api.REP_BATCH.length, 2, "el lote quedó con las 2 calibraciones");
    eq(api.REP_BATCH[0].rec.tag, "PT-U7122", "orden del lote: primero la más antigua (como el pegado)");
    eq(api.REP_BATCH[1].rec.tag, "TIT-DR719", "orden del lote: después la más reciente");
    eq(api.rows.length, 1, "la notificación quedó en las órdenes cargadas");
    eq(api.rows[0].fields.recibido, "MARIA", "la notificación conserva lo editado");
    eq(api.REP_BATCH[0].groups[0].rows[0].found, 4.05, "el reporte conserva el valor Enc. guardado");
    eq(api.REP_BATCH[0].h.ce, "21000001", "el reporte conserva su Nr. de certificado (OT)");
    ok(api.REP_BATCH[0]._cloudId === "c1" && !!api.REP_BATCH[0]._cloudSig, "cada reporte abierto queda ligado a su fila de la cuenta");
    eq(api.repState, null, "no se preselecciona ninguno: se elige en el desplegable");
    ok(/Selecciona un instrumento \(2\)/.test(L.els.repSelect.innerHTML), "el desplegable de reportes ofrece los 2 para elegir");
    eq(api.REP_BATCH_EDITADO, true, "el lote abierto no se pisa si luego llegan datos nuevos de la base");
    eq(api.avisoSalida.hayTrabajo(), false, "lo abierto no cuenta como trabajo sin guardar");
    ok(/Se abrieron 2 calibraciones y 1 notificación/.test(L.els.misMsg.textContent), "resumen: " + L.els.misMsg.textContent);
  }

  console.log("\n[A2] No duplica: reabrir reemplaza por lo guardado");
  { const L = load(); await sleep(30); const api = L.api;
    L.nube.filas = [filaCal(api, "PT-U7122", "21000001", 4.05, "c1", "2026-09-17T10:00:00Z"), filaNoti(api, "LT-R161", "21000002", "MARIA", "n1", "2026-09-17T11:00:00Z")];
    await api.misReportes.abrirTodos();
    // El técnico edita y vuelve a pulsar "Abrir todos": gana lo guardado en la cuenta.
    api.REP_BATCH[0].groups[0].rows[0].found = 9.99; api.REP_BATCH[0]._tocado = true;
    api.rows[0].fields.recibido = "CAMBIO LOCAL"; api.rows[0]._tocado = true;
    await api.misReportes.abrirTodos();
    eq(api.REP_BATCH.length, 1, "sigue habiendo un solo reporte de ese TAG");
    eq(api.rows.length, 1, "sigue habiendo una sola orden con esa OT/TAG");
    eq(api.REP_BATCH[0].groups[0].rows[0].found, 4.05, "el reporte se reemplazó por el de la cuenta");
    eq(api.rows[0].fields.recibido, "MARIA", "la notificación se reemplazó por la de la cuenta");
    eq(api.avisoSalida.hayTrabajo(), false, "tras reabrir no queda trabajo sin guardar");
  }

  console.log("\n[A3] Respeta el filtro de tipo y el de usuario (admin)");
  { const L = load(); await sleep(30); const api = L.api;
    L.nube.filas = [filaCal(api, "PT-U7122", "21000001", 4.05, "c1", "2026-09-17T10:00:00Z"), filaNoti(api, "LT-R161", "21000002", "MARIA", "n1", "2026-09-17T11:00:00Z")];
    L.els.misKind.value = "calibracion";
    L.nube.gets.length = 0;
    await api.misReportes.abrirTodos();
    ok(/kind=eq\.calibracion/.test(L.nube.gets.join("|")), "la consulta llevó el filtro de tipo");
    eq(api.REP_BATCH.length, 1, "solo se abrió la calibración");
    eq(api.rows.length, 0, "no se abrieron notificaciones");
    L.els.misUser.value = "otro-usuario";   // el filtro por usuario es solo del admin
    L.nube.gets.length = 0;
    await api.misReportes.abrirTodos();
    ok(!/user_id=/.test(L.nube.gets.join("|")), "sin rol de admin, el filtro por usuario no se aplica");
  }

  console.log("\n[A4] Cancelar, sin conexión, lista vacía y datos dañados");
  { const L = load(); await sleep(30); const api = L.api;
    L.nube.filas = [filaCal(api, "PT-U7122", "21000001", 4.05, "c1", "2026-09-17T10:00:00Z")];
    L.estado.confirm = false;
    await api.misReportes.abrirTodos();
    eq(api.REP_BATCH.length, 0, "si se cancela la confirmación no se abre nada");
    eq(L.els.misAbrirTodos.disabled, false, "el botón vuelve a quedar disponible");
    L.estado.confirm = true;

    L.nube.caida = true;
    await api.misReportes.abrirTodos();
    ok(/No se pudo abrir/.test(L.els.misMsg.textContent), "sin conexión avisa: " + L.els.misMsg.textContent);
    eq(L.els.misAbrirTodos.disabled, false, "el botón sigue disponible tras el error");
    L.nube.caida = false;

    L.nube.filas = [];
    await api.misReportes.abrirTodos();
    ok(/No hay nada guardado para abrir/.test(L.els.misMsg.textContent), "lista vacía: " + L.els.misMsg.textContent);

    L.nube.filas = [
      { id: "malo", kind: "calibracion", tag: "XX-1", ot: "1", titulo: "dañado", payload: { v: 1, tag: "XX-1" }, updated_at: "2026-09-17T09:00:00Z" },
      filaCal(api, "PT-U7122", "21000001", 4.05, "c1", "2026-09-17T10:00:00Z")
    ];
    await api.misReportes.abrirTodos();
    eq(api.REP_BATCH.length, 1, "un payload dañado no impide abrir los demás");
    ok(/1 no se pudo abrir/.test(L.els.misMsg.textContent), "avisa del dañado: " + L.els.misMsg.textContent);
  }

  console.log("\nRESUMEN ABRIR: " + pass + " OK, " + fail + " FAIL");
  process.exit(fail ? 1 : 0);
})();
