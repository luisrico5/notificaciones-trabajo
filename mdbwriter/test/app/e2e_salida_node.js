// Pruebas Node (fetch simulado) del aviso al cerrar la página (avisoSalida) y de "trabajo sin guardar".
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
  const nube = { reportes: [], caida: false, n: 0 };
  const fetchMock = (url, init) => {
    const u = new URL(url), m = (init && init.method) || "GET";
    if (/\/rest\/v1\/profiles/.test(u.pathname)) return res(200, [PROFILE]);
    if (nube.caida) return Promise.reject(new TypeError("Failed to fetch"));
    if (u.pathname === "/rest/v1/reportes" && (m === "POST" || m === "PATCH")) {
      const b = JSON.parse(init.body); nube.n++;
      const fila = Object.assign({ id: "id" + nube.n, updated_at: new Date().toISOString() }, b); nube.reportes.push(fila);
      return res(m === "POST" ? 201 : 200, [fila]);
    }
    if (/\/storage\/v1\/object\/list/.test(u.pathname)) return res(200, []);
    return res(200, []);
  };
  const listeners = {};
  const w = { addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, print() {}, scrollTo() {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
  const store = mkStore({ noti_auth_v1: JSON.stringify({ v: 1, tokens: { access: "A1", refresh: "R1", expiresAt: Math.floor(Date.now() / 1000) + 3600 }, user: { id: PROFILE.id, email: PROFILE.email }, profile: PROFILE }) });
  const timeouts = [];
  const ctx = vm.createContext({ console, Math, JSON, Date, parseFloat, parseInt, isFinite, isNaN, String, Number, Array, Object, RegExp, Promise,
    setTimeout: (f, ms) => { if (ms > 1000) return 0; timeouts.push(f); return setTimeout(f, ms); }, clearTimeout, setInterval, clearInterval,
    encodeURIComponent, decodeURIComponent, Uint8Array, Int8Array, ArrayBuffer, document, localStorage: store, sessionStorage: mkStore(), navigator: { onLine: true },
    location: { reload() {} }, window: w, self: w, fetch: fetchMock, alert() {}, confirm() { return true; }, FileReader: function () {}, Blob, Response,
    URL: { createObjectURL() { return ""; }, revokeObjectURL() {} }, html2pdf: function () { return { set() { return this; }, from() { return this; }, save() { return Promise.resolve(); } }; } });
  vm.runInContext(APP + "\n;globalThis.__api={avisoSalida, misReportes, makeRow, repLookup, repBuildState, repBatchAdd, auth, get rows(){return rows;}, get REP_BATCH(){return REP_BATCH;}, get repState(){return repState;}, set repState(v){repState=v;}, get _appBooted(){return _appBooted;}};", ctx, { filename: "app.js" });
  return { api: ctx.__api, els, nube, listeners, store };
}
function cerrar(L) {   // simula el intento de cerrar la página
  const ev = { prevenido: false, returnValue: undefined, preventDefault() { this.prevenido = true; } };
  (L.listeners.beforeunload || []).forEach(f => f(ev));
  return ev;
}

(async () => {
  console.log("\n[S1] Sin trabajo editado no se avisa");
  { const L = load(); await sleep(30);
    ok(L.api._appBooted, "la app arrancó con la sesión");
    L.api.rows.push(L.api.makeRow("11111111", "TRANSMISOR PT-U7122", "", "17/09/2026"));
    eq(L.api.avisoSalida.hayTrabajo(), false, "órdenes cargadas SIN editar: no cuentan");
    eq(cerrar(L).prevenido, false, "cerrar: no se pide confirmación");
  }

  console.log("\n[S2] Notificación editada: aviso, ventana y guardar todo");
  { const L = load(); await sleep(30);
    const r = L.api.makeRow("22222222", "TRANSMISOR PT-U7122", "", "17/09/2026"); L.api.rows.push(r);
    r.fields.recibido = "JUAN"; r._tocado = true;
    const t = L.api.avisoSalida.trabajo();
    eq(t.notis.length, 1, "una notificación editada sin guardar");
    const ev = cerrar(L);
    ok(ev.prevenido && ev.returnValue === "", "cerrar: se pide la confirmación del navegador");
    ok(L.store.getItem("noti_session_v1") && JSON.parse(L.store.getItem("noti_session_v1")).rows.length === 1, "al intentar salir se guardó la sesión local");
    await sleep(10);
    eq(L.els.salidaModal.hidden, false, "si se queda, se abre la ventana 'Guarda tu trabajo'");
    ok(/1 notificación editada/.test(L.els.salidaLista.innerHTML) && /22222222/.test(L.els.salidaLista.innerHTML), "la ventana lista la notificación");
    eq(L.els.salidaGuardar.disabled, false, "'Guardar todo en mi cuenta' habilitado");
    const g = await L.api.misReportes.guardarLista(t.notis, t.cals);
    eq(g.ok, 1, "guardarLista guardó 1");
    eq(L.nube.reportes.length, 1, "llegó a la nube como reporte kind=" + (L.nube.reportes[0] && L.nube.reportes[0].kind));
    eq(L.api.avisoSalida.hayTrabajo(), false, "tras guardar ya no queda trabajo");
    eq(cerrar(L).prevenido, false, "cerrar: ya no avisa");
    r.fields.recibido = "PEDRO";
    eq(L.api.avisoSalida.trabajo().notis.length, 1, "si se edita DESPUÉS de guardar, vuelve a contar");
  }

  console.log("\n[S3] Reporte de calibración editado");
  { const L = load(); await sleep(30);
    const rec = L.api.repLookup("PT-U7122");
    const idx = L.api.repBatchAdd(rec); const st = L.api.REP_BATCH[idx];
    eq(L.api.avisoSalida.hayTrabajo(), false, "reporte agregado sin editar: no cuenta");
    st.groups[0].rows[0].found = 4.01; st._tocado = true;
    eq(L.api.avisoSalida.trabajo().cals.length, 1, "reporte editado: cuenta");
    const g = await L.api.misReportes.guardarLista([], L.api.avisoSalida.trabajo().cals);
    ok(g.ok === 1 && L.nube.reportes[0].kind === "calibracion", "se guardó como calibración");
    eq(L.api.avisoSalida.hayTrabajo(), false, "tras guardar ya no queda trabajo");
  }

  console.log("\n[S4] Sin conexión: queda en cola (no se pierde) y deja de contar como sin guardar");
  { const L = load(); await sleep(30);
    const r = L.api.makeRow("33333333", "TRANSMISOR PT-U7122", "", "17/09/2026"); L.api.rows.push(r); r._tocado = true;
    L.nube.caida = true;
    const g = await L.api.misReportes.guardarLista([r], []);
    eq(g.pend, 1, "quedó 1 pendiente");
    const t = L.api.avisoSalida.trabajo();
    ok(t.notis.length === 0 && t.pendientes === 1, "no cuenta como sin guardar; 1 pendiente de subir");
    eq(cerrar(L).prevenido, false, "cerrar: no avisa (queda guardado en este navegador)");
    r.fields.recibido = "OTRO";
    eq(L.api.avisoSalida.trabajo().notis.length, 1, "si se edita después de encolar, vuelve a contar");
  }

  console.log("\n[S5] Cerrar sesión: con trabajo abre la ventana; el logout propio no pide confirmación");
  { const L = load(); await sleep(30);
    const r = L.api.makeRow("44444444", "TRANSMISOR PT-U7122", "", "17/09/2026"); L.api.rows.push(r); r._tocado = true;
    L.api.avisoSalida.mostrar(true);
    eq(L.els.salidaLogout.hidden, false, "la ventana ofrece 'Cerrar sesión sin guardar'");
    L.api.auth.logout(false);
    eq(cerrar(L).prevenido, false, "tras logout, la recarga de la app no pide confirmación");
  }

  console.log("\n########## RESUMEN SALIDA: " + pass + " OK, " + fail + " FAIL ##########");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("EXCEPCIÓN: " + (e.stack || e)); process.exit(2); });
