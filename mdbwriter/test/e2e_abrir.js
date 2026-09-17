// Prueba de punta a punta en Chrome REAL (headless, protocolo DevTools) del botón "Abrir todos"
// de la pestaña Mis reportes: guarda un lote en la cuenta, deja la app en blanco y lo vuelve a abrir
// completo para editarlo eligiendo en los desplegables, igual que después del primer pegado.
// Uso: node mdbwriter/test/e2e_abrir.js <ruta absoluta a index.html | URL publicada> <carpeta_trabajo>
// Simula Supabase con un servidor local (tabla reportes con upsert por user_id,kind,tag,ot).
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os");
const { spawn } = require("child_process");

const [INDEX, WORK] = process.argv.slice(2);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });

const REMOTA = /^https?:\/\//i.test(INDEX);
const html = REMOTA ? "" : fs.readFileSync(INDEX);
const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); });

// ---- nube simulada: tabla "reportes" con upsert por (user_id,kind,tag,ot) ----
const nube = { filas: [], n: 0, gets: [] };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-upsert, cache-control, prefer, accept", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };
const mock = http.createServer(async (req, res) => {
  const partes = []; for await (const c of req) partes.push(c);
  const body = Buffer.concat(partes);
  const u = new URL(req.url, "http://127.0.0.1"), ruta = u.pathname, m = req.method;
  const json = (code, obj) => { res.writeHead(code, Object.assign({ "Content-Type": "application/json" }, CORS)); res.end(JSON.stringify(obj)); };
  if (m === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  if (ruta === "/rest/v1/reportes" && m === "POST") {
    const b = JSON.parse(body.toString("utf8"));
    const ya = nube.filas.find(f => f.kind === b.kind && f.tag === b.tag && f.ot === b.ot);
    if (ya) { Object.assign(ya, b, { updated_at: new Date().toISOString() }); return json(200, [ya]); }
    nube.n++;
    const fila = Object.assign({ id: "r" + nube.n, user_id: "u-e2e", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, b);
    nube.filas.push(fila); return json(201, [fila]);
  }
  if (ruta === "/rest/v1/reportes" && m === "PATCH") {
    const id = (u.searchParams.get("id") || "").replace("eq.", "");
    const fila = nube.filas.find(f => f.id === id); if (!fila) return json(200, []);
    Object.assign(fila, JSON.parse(body.toString("utf8")), { updated_at: new Date().toISOString() });
    return json(200, [fila]);
  }
  if (ruta === "/rest/v1/reportes" && m === "GET") {
    nube.gets.push(u.search);
    const idf = u.searchParams.get("id") || "", kind = (u.searchParams.get("kind") || "").replace("eq.", "");
    let r = nube.filas.slice().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));   // updated_at.desc
    const mIn = idf.match(/^in\.\((.*)\)$/);
    if (mIn) { const ids = mIn[1].split(","); r = r.filter(f => ids.indexOf(f.id) >= 0); }
    else if (idf.indexOf("eq.") === 0) r = r.filter(f => f.id === idf.slice(3));
    if (kind) r = r.filter(f => f.kind === kind);
    return json(200, r);
  }
  if (ruta === "/rest/v1/reportes" && m === "DELETE") {
    const id = (u.searchParams.get("id") || "").replace("eq.", "");
    const i = nube.filas.findIndex(f => f.id === id); const out = i >= 0 ? nube.filas.splice(i, 1) : [];
    return json(200, out);
  }
  if (/\/storage\/v1\/object\/list/.test(ruta)) return json(200, []);
  return json(200, []);
});

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pend = new Map(); this.handlers = [];
    ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && this.pend.has(m.id)) { const p = this.pend.get(m.id); this.pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method) this.handlers.forEach(h => h(m)); }; }
  send(method, params = {}, sessionId) { const id = ++this.id; const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId; return new Promise((res, rej) => { this.pend.set(id, { res, rej }); this.ws.send(JSON.stringify(msg)); }); }
  on(fn) { this.handlers.push(fn); }
}

async function main() {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  await new Promise(r => mock.listen(0, "127.0.0.1", r));
  const URLH = REMOTA ? INDEX : "http://127.0.0.1:" + server.address().port + "/index.html";
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-chrome-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--window-size=1280,1000", "--disable-features=PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks", "about:blank"], { stdio: "ignore" });
  let port = null; for (let i = 0; i < 100 && !port; i++) { await sleep(200); try { port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch (e) { } }
  const ver = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  const cdp = new CDP(ws);
  const errores = [];
  cdp.on(m => { if (m.method === "Runtime.exceptionThrown") errores.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text); });

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, s);
  await S("Page.enable"); await S("Runtime.enable"); await S("DOM.enable");
  await S("Page.addScriptToEvaluateOnNewDocument", { source: "(function(){var real=window.fetch, MOCK='http://127.0.0.1:" + mock.address().port + "';" +
    "window.fetch=function(input,init){var url=(typeof input==='string')?input:(input&&input.url)||'';" +
    "if(/supabase\\.co/.test(url)){var u=new URL(url);" +
    "if(/^\\/storage\\/v1\\/|^\\/rest\\/v1\\/respaldo_base|^\\/rest\\/v1\\/reportes/.test(u.pathname)) return real.call(window, MOCK+u.pathname+u.search, init);" +
    "return Promise.reject(new TypeError('Failed to fetch'));}" +
    "return real.apply(window, arguments);};})();" });
  const dialogos = [];
  cdp.on(m => { if (m.sessionId === s && m.method === "Page.javascriptDialogOpening") { dialogos.push(m.params.message); S("Page.handleJavaScriptDialog", { accept: true }); } });
  const ev = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result.value; };
  const esperar = async (expr, ms, desc) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch (e) { } await sleep(250); } throw new Error("Tiempo agotado: " + desc); };
  const arrancar = async () => { await esperar("document.readyState==='complete' && typeof _appBooted!=='undefined' && _appBooted===true", 60000, "arranque de la app"); };

  await S("Page.navigate", { url: URLH });
  await esperar("document.readyState==='complete'", 60000, "carga");
  await ev(`localStorage.setItem("noti_auth_v1", JSON.stringify({v:1,tokens:{access:"x",refresh:"y",expiresAt:Math.floor(Date.now()/1000)+3600},user:{id:"u-e2e",email:"e2e@prueba"},profile:{id:"u-e2e",email:"e2e@prueba",full_name:"Prueba E2E",role:"tecnico",approved:true},checked_at:Date.now()})); true`);
  await S("Page.reload", {}); await sleep(600); await arrancar();

  // =====================================================================================
  console.log("\n[1] Se carga un lote y se guarda todo en la cuenta");
  await ev(`document.getElementById('pasteArea').value="OT\\tFecha inicio\\tDenominación de objeto técnico\\n21000001\\t17/09/2026\\tTRANSMISOR DE PRESION PT-U7122\\n21000002\\t17/09/2026\\tTRANSMISOR DE NIVEL LT-R161\\n21000003\\t17/09/2026\\tTRANSMISOR DE TEMPERATURA TIT-DR719\\n"; document.getElementById('btnPaste').click(); true`);
  await esperar("rows.length===3 && REP_BATCH.length===3", 15000, "órdenes y reportes generados");
  ok(true, "3 órdenes pegadas → 3 notificaciones y 3 reportes de calibración");
  // Se edita una notificación y un reporte, para comprobar después que vuelven tal cual.
  await ev(`var s=document.getElementById('orderSelect'); s.value=String(rows[0].id); s.dispatchEvent(new Event('change',{bubbles:true})); true`);
  await esperar("!!document.querySelector('#rows [data-f=\"recibido\"]')", 5000, "notificación abierta");
  await ev(`var el=document.querySelector('#rows [data-f="recibido"]'); el.value='JUAN PEREZ'; el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  await ev("switchTab('reporte'); repSelectShow(0); true");
  await esperar("!!document.querySelector('#repForm input[data-k=\"found\"][data-g=\"0\"][data-p=\"0\"]')", 5000, "formulario del reporte");
  const valor = await ev(`var el=document.querySelector('#repForm input[data-k="found"][data-g="0"][data-p="0"]'); el.value=String(REP_BATCH[0].groups[0].rows[0].outNom+0.07); el.dispatchEvent(new Event('input',{bubbles:true})); el.value`);
  await ev("document.getElementById('repGuardarNubeTodos').click(); true");
  await esperar("REP_BATCH.every(function(st){ return !!st._cloudId; })", 30000, "reportes guardados");
  await ev("switchTab('noti'); document.getElementById('btnNubeTodas').click(); true");
  await esperar("rows.every(function(r){ return !!r._cloudId; })", 30000, "notificaciones guardadas");
  ok(nube.filas.length === 6 && nube.filas.filter(f => f.kind === "calibracion").length === 3, "la cuenta tiene 6 registros (3 calibraciones + 3 notificaciones)");

  console.log("\n[2] La app queda en blanco (otro día, otro PC)");
  await ev("switchTab('reporte'); document.getElementById('repLimpiar').click(); true");
  await esperar("REP_BATCH.length===0", 10000, "lote vaciado");
  await ev("switchTab('noti'); document.getElementById('btnClearSession').click(); true");
  await esperar("rows.length===0", 10000, "sesión vaciada");
  await S("Page.reload", {}); await sleep(600); await arrancar();
  ok(await ev("rows.length===0 && REP_BATCH.length===0"), "al reabrir no hay órdenes ni reportes cargados");

  console.log("\n[3] 'Abrir todos' trae todo el lote y se elige en el desplegable");
  await ev("switchTab('mis'); true");
  await esperar("/21000001/.test(document.getElementById('misList').textContent)", 20000, "lista de Mis reportes");
  ok(await ev("!!document.getElementById('misAbrirTodos')"), "la pestaña Mis reportes tiene el botón 'Abrir todos'");
  const nDial = dialogos.length;
  await ev("document.getElementById('misAbrirTodos').click(); true");
  await esperar("REP_BATCH.length===3 && rows.length===3", 30000, "abrir todos");
  ok(dialogos.length > nDial && /Se abrirán 6 reporte/.test(dialogos[nDial]), "pidió confirmación: " + (dialogos[nDial] || "").split("\n")[0]);
  ok(await ev("document.getElementById('panel-reporte').classList.contains('active')"), "queda en la pestaña Reporte de calibración");
  const opciones = await ev("Array.from(document.getElementById('repSelect').options).map(function(o){ return o.textContent; })");
  ok(opciones.length === 4 && /Selecciona un instrumento \(3\)/.test(opciones[0]), "el desplegable ofrece los 3 instrumentos: " + JSON.stringify(opciones));
  ok(await ev("repState===null && document.getElementById('repSelect').value===''"), "ninguno preseleccionado: se elige como tras el primer pegado");
  ok(/Se abrieron 3 calibraciones y 3 notificaciones/.test(await ev("document.getElementById('misMsg').textContent")), "resumen de lo abierto");
  const ordenes = await ev("Array.from(document.getElementById('orderSelect').options).map(function(o){ return o.textContent; }).join(' | ')");
  ok(/21000001/.test(ordenes) && /21000002/.test(ordenes) && /21000003/.test(ordenes), "las 3 órdenes están en el desplegable de Notificaciones");

  console.log("\n[4] Lo abierto conserva lo guardado y se puede seguir editando");
  await ev(`var s=document.getElementById('repSelect'); s.value='0'; s.dispatchEvent(new Event('change',{bubbles:true})); true`);
  await esperar("!!repState && !!document.querySelector('#repForm input[data-k=\"found\"][data-g=\"0\"][data-p=\"0\"]')", 10000, "reporte elegido");
  const v4 = await ev(`document.querySelector('#repForm input[data-k="found"][data-g="0"][data-p="0"]').value`);
  ok(parseFloat(v4) === parseFloat(valor), "el valor Enc. editado volvió tal cual (" + v4 + ")");
  ok(await ev("avisoSalida.hayTrabajo()===false"), "lo recién abierto no cuenta como trabajo sin guardar");
  await ev(`var el=document.querySelector('#repForm input[data-k="found"][data-g="0"][data-p="0"]'); el.value=String(parseFloat(el.value)+0.01); el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  ok(await ev("avisoSalida.trabajo().cals.length===1"), "al editarlo vuelve a contar como trabajo sin guardar");
  await ev("document.getElementById('repGuardarNube').click(); true");
  await esperar("!/pendiente/.test(document.getElementById('repNubeMsg').textContent) && /guardado en tu cuenta/.test(document.getElementById('repNubeMsg').textContent)", 30000, "guardado");
  ok(nube.filas.length === 6, "al volver a guardar actualiza su registro, no duplica (siguen 6)");
  await ev("switchTab('noti'); var s=document.getElementById('orderSelect'); s.value=String(rows[0].id); s.dispatchEvent(new Event('change',{bubbles:true})); true");
  await esperar("!!document.querySelector('#rows [data-f=\"recibido\"]')", 10000, "notificación elegida");
  ok(await ev(`document.querySelector('#rows [data-f="recibido"]').value==='JUAN PEREZ'`), "la notificación abierta conserva lo editado");

  console.log("\n[5] Con el filtro por tipo solo abre ese tipo, y no duplica");
  await ev("switchTab('mis'); true");
  await esperar("/21000001/.test(document.getElementById('misList').textContent)", 20000, "lista");
  await ev(`var s=document.getElementById('misKind'); s.value='calibracion'; s.dispatchEvent(new Event('change',{bubbles:true})); true`);
  await sleep(1200);
  nube.gets.length = 0;
  await ev("document.getElementById('misAbrirTodos').click(); true");
  await esperar("/Se abrieron 3 calibraciones\\./.test(document.getElementById('misMsg').textContent)", 30000, "abrir solo calibraciones");
  ok(nube.gets.some(q => /kind=eq\.calibracion/.test(q)), "la consulta llevó el filtro de tipo");
  ok(await ev("REP_BATCH.length===3 && rows.length===3"), "no se duplicó nada al reabrir");

  console.log("\n[6] Casillas: abrir solo los seleccionados");
  // Se deja la app en blanco otra vez para ver qué entra exactamente.
  await ev("switchTab('reporte'); document.getElementById('repLimpiar').click(); true");
  await esperar("REP_BATCH.length===0", 10000, "lote vaciado");
  await ev("switchTab('noti'); document.getElementById('btnClearSession').click(); true");
  await esperar("rows.length===0", 10000, "sesión vaciada");
  await ev("switchTab('mis'); var s=document.getElementById('misKind'); s.value=''; s.dispatchEvent(new Event('change',{bubbles:true})); true");
  await esperar("document.querySelectorAll('#misList input[data-sel]').length===6", 20000, "lista con casillas");
  ok(true, "cada fila de la lista tiene su casilla (6)");
  ok(await ev("document.getElementById('misAbrirSel').disabled===true"), "'Abrir seleccionados' arranca deshabilitado");
  // Marca con un clic real la calibración de PT-U7122 y la notificación de la orden 21000002.
  const marcados = await ev(`(function(){ var out=[]; Array.from(document.querySelectorAll('#misList tbody tr')).forEach(function(tr){ var t=tr.textContent;
      if(/PT-U7122/.test(t) && /Calibración/.test(t)) out.push(tr.querySelector('input[data-sel]'));
      if(/21000002/.test(t) && /Notificación/.test(t)) out.push(tr.querySelector('input[data-sel]')); });
    out.forEach(function(c){ c.click(); }); return out.length; })()`);
  ok(marcados === 2, "se marcaron 2 casillas");
  ok(await ev("document.getElementById('misAbrirSel').textContent") === "Abrir seleccionados (2)", "el botón cuenta los marcados");
  await ev("document.getElementById('misAbrirSel').click(); true");
  await esperar("REP_BATCH.length===1 && rows.length===1", 30000, "abrir seleccionados");
  ok(await ev("REP_BATCH[0].rec.tag==='PT-U7122' && String(rows[0].ot)==='21000002'"), "abrió exactamente los dos marcados");
  ok(await ev("document.getElementById('misAbrirSel').disabled===true"), "tras abrirlos la selección queda limpia");
  // La casilla de la cabecera marca todo lo de la lista.
  await ev("switchTab('mis'); true"); await sleep(800);
  await ev("document.getElementById('misSelAll').click(); true");
  ok(await ev("document.getElementById('misAbrirSel').textContent") === "Abrir seleccionados (6)", "la casilla de la cabecera marca los 6");
  await ev("document.getElementById('misSelAll').click(); true");
  ok(await ev("document.getElementById('misAbrirSel').disabled===true"), "y vuelve a desmarcarlos");

  ok(errores.length === 0, "sin errores de JavaScript en consola" + (errores.length ? ": " + errores.join(" | ") : ""));
  console.log("\nRESULTADO ABRIR NAVEGADOR: " + pass + " OK, " + fail + " FAIL");
  ws.close(); chrome.kill(); server.close(); mock.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log("ERROR: " + (e.stack || e)); process.exit(2); });
