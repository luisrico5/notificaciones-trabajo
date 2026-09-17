// Prueba de punta a punta en Chrome REAL (headless, protocolo DevTools) de:
//  (1) la tarjeta "Mapeo TAG → Procedimiento" al FINAL de la pestaña Notificaciones (tarjetas 01 Cargar, 02 Notificaciones, 03 Mapeo);
//  (2) el aviso al cerrar la página con trabajo sin guardar y la ventana "Guarda tu trabajo antes de salir".
// Uso: node mdbwriter/test/e2e_salida.js <ruta absoluta a index.html | URL publicada> <COPIA de la base editable .mdb> <carpeta_trabajo>
// Simula Supabase con un servidor local (reportes, Storage, respaldo_base); el perfil/auth quedan "sin conexión".
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os");
const { spawn } = require("child_process");

const [INDEX, BASE, WORK] = process.argv.slice(2);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DL = path.join(WORK, "descargas");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });

const REMOTA = /^https?:\/\//i.test(INDEX);
const html = REMOTA ? "" : fs.readFileSync(INDEX);
const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); });

// ---- nube simulada ----
const nube = { reportes: [], caidaReportes: false, objetos: new Map(), fila: null, n: 0 };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-upsert, cache-control, prefer, accept", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };
const mock = http.createServer(async (req, res) => {
  const partes = []; for await (const c of req) partes.push(c);
  const body = Buffer.concat(partes);
  const u = new URL(req.url, "http://127.0.0.1"), ruta = u.pathname, m = req.method;
  const json = (code, obj) => { res.writeHead(code, Object.assign({ "Content-Type": "application/json" }, CORS)); res.end(JSON.stringify(obj)); };
  if (m === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  let mm;
  if (ruta === "/rest/v1/reportes" && (m === "POST" || m === "PATCH")) {
    if (nube.caidaReportes) return json(503, { message: "Service Unavailable" });
    const b = JSON.parse(body.toString("utf8")); nube.n++;
    const fila = Object.assign({ id: "r" + nube.n, updated_at: new Date().toISOString() }, b); nube.reportes.push(fila);
    return json(m === "POST" ? 201 : 200, [fila]);
  }
  if ((mm = ruta.match(/^\/storage\/v1\/object\/respaldo-base\/([^/]+)$/)) && m === "POST") { nube.objetos.set(decodeURIComponent(mm[1]), body); return json(200, { Key: "x" }); }
  if (ruta === "/storage/v1/object/list/respaldo-base") return json(200, Array.from(nube.objetos.keys()).map(n => ({ name: n, id: n, updated_at: "t" })));
  if ((mm = ruta.match(/^\/storage\/v1\/object\/authenticated\/respaldo-base\/([^/]+)$/))) {
    const o = nube.objetos.get(decodeURIComponent(mm[1])); if (!o) return json(400, { statusCode: "404", message: "Object not found" });
    res.writeHead(200, Object.assign({ "Content-Type": "application/gzip" }, CORS)); return res.end(o);
  }
  if (ruta === "/storage/v1/object/respaldo-base" && m === "DELETE") return json(200, []);
  if (ruta === "/rest/v1/respaldo_base") { if (m === "POST") { nube.fila = Object.assign({ subido_at: new Date().toISOString() }, JSON.parse(body.toString("utf8"))); return json(201, [nube.fila]); } return json(200, nube.fila ? [nube.fila] : []); }
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
  const descargas = [], errores = [];
  cdp.on(m => {
    if (m.method === "Browser.downloadWillBegin") descargas.push({ guid: m.params.guid, nombre: m.params.suggestedFilename, listo: false });
    if (m.method === "Browser.downloadProgress" && m.params.state === "completed") { const d = descargas.find(x => x.guid === m.params.guid); if (d) d.listo = true; }
    if (m.method === "Runtime.exceptionThrown") errores.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
  });
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: DL, eventsEnabled: true });

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
  // Diálogos: los de la app se aceptan; el de "¿Salir del sitio?" responde según 'respuestaSalida' (true = salir).
  let respuestaSalida = false; const dialogosSalida = []; const otrosDialogos = [];
  cdp.on(m => {
    if (m.sessionId !== s || m.method !== "Page.javascriptDialogOpening") return;
    if (m.params.type === "beforeunload") { dialogosSalida.push(Date.now()); S("Page.handleJavaScriptDialog", { accept: respuestaSalida }); }
    else { otrosDialogos.push(m.params.message); S("Page.handleJavaScriptDialog", { accept: true }); }
  });
  const ev = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text); return r.result.value; };
  const esperar = async (expr, ms, desc) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await ev(expr)) return true; } catch (e) { } await sleep(250); } throw new Error("Tiempo agotado: " + desc); };
  const esperarDescarga = async (patron, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const d = descargas.find(x => x.listo && (patron instanceof RegExp ? patron.test(x.nombre) : x.nombre === patron)); if (d) return d; await sleep(250); } return null; };
  // Un clic real (activación del usuario): sin él, Chrome no muestra el aviso de beforeunload.
  const clicReal = async () => { for (const type of ["mousePressed", "mouseReleased"]) await S("Input.dispatchMouseEvent", { type, x: 640, y: 12, button: "left", clickCount: 1 }); };
  const arrancar = async () => { await esperar("document.readyState==='complete' && typeof _appBooted!=='undefined' && _appBooted===true", 60000, "arranque de la app"); };
  // Intenta recargar (como cerrar la página). Devuelve {dialogo, recargo}.
  const intentarSalir = async (salir) => {
    respuestaSalida = !!salir;
    await ev("window.__marca=1; true");
    const n0 = dialogosSalida.length;
    S("Page.reload", {}).catch(() => { });
    const t = Date.now(); let dialogo = false;
    while (Date.now() - t < 5000) { if (dialogosSalida.length > n0) { dialogo = true; break; } await sleep(100); }
    await sleep(1500);
    let recargo = false;
    try { recargo = await ev("typeof window.__marca==='undefined'"); } catch (e) { recargo = true; }
    if (recargo) await arrancar();
    return { dialogo, recargo };
  };

  await S("Page.navigate", { url: URLH });
  await esperar("document.readyState==='complete'", 60000, "carga");
  await ev(`localStorage.setItem("noti_auth_v1", JSON.stringify({v:1,tokens:{access:"x",refresh:"y",expiresAt:Math.floor(Date.now()/1000)+3600},user:{id:"u-e2e",email:"e2e@prueba"},profile:{id:"u-e2e",email:"e2e@prueba",full_name:"Prueba E2E",role:"tecnico",approved:true},checked_at:Date.now()})); true`);
  await S("Page.reload", {}); await sleep(600); await arrancar();

  // =====================================================================================
  console.log("\n[1] Tarjeta de mapeo al final de la pestaña Notificaciones");
  const orden = await ev(`Array.from(document.querySelectorAll('#panel-noti > section.card')).map(function(c){ return (c.querySelector('.num')||{}).textContent+' '+(c.querySelector('h2')||{}).textContent; })`);
  console.log("     tarjetas en orden: " + JSON.stringify(orden));
  ok(orden.length === 3 && /^01 Cargar datos/.test(orden[0]) && /^02 Notificaciones/.test(orden[1]) && /^03 Mapeo TAG/.test(orden[2]), "orden: 01 Cargar datos · 02 Notificaciones · 03 Mapeo (al final)");
  ok(await ev("!document.querySelector('.toprow') && document.querySelector('#panel-noti').lastElementChild.id==='mapCard'"), "el mapeo es el último bloque y ya no comparte fila con 'Cargar datos'");
  ok(await ev("Math.abs(document.querySelector('#panel-noti > section.card').getBoundingClientRect().width - document.getElementById('mapCard').getBoundingClientRect().width) < 2"), "'Cargar datos' y 'Mapeo' ocupan el ancho completo");
  await ev(`document.getElementById('pasteArea').value="OT\\tFecha inicio\\tDenominación de objeto técnico\\n21000001\\t17/09/2026\\tTRANSMISOR DE PRESION PT-U7122\\n21000002\\t17/09/2026\\tTRANSMISOR DE NIVEL LT-R161\\n"; document.getElementById('btnPaste').click(); true`);
  await esperar("rows.length===2 && getComputedStyle(document.getElementById('resultsCard')).display!=='none'", 10000, "órdenes procesadas");
  ok(await ev("var a=document.querySelector('#panel-noti > section.card').getBoundingClientRect().top, b=document.getElementById('resultsCard').getBoundingClientRect().top, c=document.getElementById('mapCard').getBoundingClientRect().top; a<b && b<c"), "con órdenes cargadas: Cargar datos → Notificaciones → Mapeo, de arriba a abajo");
  await ev(`document.getElementById('mPref').value='ZZQ'; document.getElementById('mProc').value='P-SG-09999'; document.getElementById('mNom').value='Prueba de mapeo'; document.getElementById('btnAddMap').click(); true`);
  ok(await ev("!!MAP.ZZQ && MAP.ZZQ.proc==='P-SG-09999' && /ZZQ/.test(document.getElementById('mapList').textContent)"), "el mapeo sigue funcionando desde su nueva posición (prefijo agregado)");

  console.log("\n[2] Sin trabajo editado, cerrar no avisa");
  await clicReal();
  const r2 = await intentarSalir(false);
  ok(!r2.dialogo && r2.recargo, "órdenes cargadas sin editar: la página se cierra/recarga sin aviso");
  ok(await ev("rows.length") === 2, "la sesión local se restauró (2 órdenes)");

  console.log("\n[3] Notificación editada: aviso del navegador → quedarse → ventana 'Guarda tu trabajo'");
  await ev(`var s=document.getElementById('orderSelect'); s.value=String(rows[0].id); s.dispatchEvent(new Event('change',{bubbles:true})); true`);
  await esperar("!!document.querySelector('#rows textarea[data-f=\"recibido\"], #rows input[data-f=\"recibido\"]')", 5000, "notificación abierta");
  await ev(`var el=document.querySelector('#rows [data-f="recibido"]'); el.value='JUAN PEREZ'; el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  await clicReal();
  const r3 = await intentarSalir(false);
  ok(r3.dialogo && !r3.recargo, "el navegador pidió confirmación y, al elegir quedarse, la página siguió abierta");
  await esperar("!document.getElementById('salidaModal').hidden", 5000, "ventana de salida");
  ok(true, "se abrió la ventana 'Guarda tu trabajo antes de salir'");
  const lista3 = await ev("document.getElementById('salidaLista').textContent");
  ok(/1 notificación editada/.test(lista3) && /21000001/.test(lista3), "lista la notificación editada: " + lista3);
  ok(await ev("JSON.parse(localStorage.getItem('noti_session_v1')).rows.some(function(r){ return r.fields.recibido==='JUAN PEREZ'; })"), "al intentar salir se guardó la sesión local con la edición");
  await ev("document.getElementById('salidaSeguir').click(); true");
  ok(await ev("document.getElementById('salidaModal').hidden"), "'Seguir trabajando' cierra la ventana");

  console.log("\n[4] Reporte de calibración editado también cuenta");
  await ev("switchTab('reporte'); true");
  await esperar("REP_BATCH.length>=1", 5000, "lote de reportes");
  await ev(`repSelectShow(0); var el=document.querySelector('#repForm input[data-k="found"][data-g="0"][data-p="0"]'); el.value=String(REP_BATCH[0].groups[0].rows[0].outNom+0.01); el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  await clicReal();
  const r4 = await intentarSalir(false);
  ok(r4.dialogo && !r4.recargo, "aviso del navegador y la página sigue abierta");
  await esperar("!document.getElementById('salidaModal').hidden", 5000, "ventana de salida");
  const lista4 = await ev("document.getElementById('salidaLista').textContent");
  ok(/1 notificación editada/.test(lista4) && /1 reporte de calibración editado/.test(lista4), "lista notificación y reporte: " + lista4);

  console.log("\n[5] 'Guardar todo en mi cuenta' y luego cerrar sin aviso");
  const n5 = nube.reportes.length;
  await ev("document.getElementById('salidaGuardar').click(); true");
  await esperar("/\\b(ok|warn|err)\\b/.test(document.getElementById('salidaEstado').className)", 20000, "guardar todo");
  const est5 = await ev("document.getElementById('salidaEstado').textContent");
  ok(/Guardado en tu cuenta/.test(est5) && /Ya puedes cerrar/.test(est5), "resultado: " + est5);
  const nuevos = nube.reportes.slice(n5);
  ok(nuevos.length === 2 && nuevos.some(x => x.kind === "notificacion" && x.payload.row.fields.recibido === "JUAN PEREZ") && nuevos.some(x => x.kind === "calibracion"), "la nube recibió la notificación editada y el reporte de calibración");
  ok(/No queda trabajo sin guardar/.test(await ev("document.getElementById('salidaLista').textContent")) && await ev("document.getElementById('salidaGuardar').disabled"), "la ventana indica que no queda nada");
  await ev("document.getElementById('salidaSeguir').click(); true");
  await clicReal();
  const r5 = await intentarSalir(false);
  ok(!r5.dialogo && r5.recargo, "con todo guardado, la página se cierra sin aviso");
  ok(await ev("rows.some(function(r){ return r.fields.recibido==='JUAN PEREZ' && !!r._cloudSig; })"), "al reabrir, la notificación restaurada sigue marcada como guardada");

  console.log("\n[6] Sin conexión: guardar deja pendientes (no se pierde) y cerrar no avisa");
  await ev(`var s=document.getElementById('orderSelect'); s.value=String(rows[1].id); s.dispatchEvent(new Event('change',{bubbles:true})); true`);
  await esperar("!!document.querySelector('#rows [data-f=\"recibido\"]')", 5000, "segunda notificación");
  await ev(`var el=document.querySelector('#rows [data-f="recibido"]'); el.value='MARIA LOPEZ'; el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  nube.caidaReportes = true;
  await ev("avisoSalida.mostrar(false); true");
  await ev("document.getElementById('salidaGuardar').click(); true");
  await esperar("/\\b(ok|warn|err)\\b/.test(document.getElementById('salidaEstado').className)", 30000, "guardar sin conexión");
  const est6 = await ev("document.getElementById('salidaEstado').textContent");
  ok(/Sin conexión/.test(est6) && /pendiente/.test(est6), "resultado: " + est6);
  ok(await ev("misReportes.pendientes().length") === 1, "queda 1 pendiente en este navegador");
  await ev("document.getElementById('salidaSeguir').click(); true");
  nube.caidaReportes = false;
  const n6 = nube.reportes.length;
  await clicReal();
  const r6 = await intentarSalir(false);
  ok(!r6.dialogo && r6.recargo, "cerrar no avisa: lo pendiente está a salvo en el navegador");
  await esperar("misReportes.pendientes().length===0", 20000, "subida de pendientes al reabrir");
  ok(nube.reportes.length === n6 + 1 && nube.reportes[nube.reportes.length - 1].payload.row.fields.recibido === "MARIA LOPEZ", "al reabrir con conexión, el pendiente se subió solo");

  console.log("\n[7] Base grabada en línea sin descargar");
  await ev("switchTab('reporte'); document.getElementById('repTag').value='TIT-DR719'; document.getElementById('repBuscar').click(); document.getElementById('repGrabar').click(); true");
  const copia = path.join(WORK, "base_editable_prueba.mdb"); fs.copyFileSync(BASE, copia);
  const doc = await S("DOM.getDocument", {}); const nodo = await S("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#dbFile" });
  await S("DOM.setFileInputFiles", { nodeId: nodo.nodeId, files: [copia] });
  await esperar("!document.getElementById('dbProcesar').disabled", 10000, "base elegida");
  await ev("document.getElementById('dbProcesar').click(); true");
  await sleep(500);
  ok(await ev("avisoSalida.trabajo().grabando") === true, "mientras graba cuenta como trabajo en curso");
  await esperar("document.getElementById('dbCerrar').disabled===false && !document.getElementById('dbDescargaRow').hidden", 300000, "grabado");
  await ev("document.getElementById('dbCerrar').click(); true");
  await clicReal();
  const r7 = await intentarSalir(false);
  ok(r7.dialogo && !r7.recargo, "con la base actualizada sin descargar, el navegador pide confirmación");
  await esperar("!document.getElementById('salidaModal').hidden", 5000, "ventana de salida");
  ok(/Base de datos actualizada sin descargar/.test(await ev("document.getElementById('salidaLista').textContent")) && await ev("!document.getElementById('salidaBase').hidden"), "la ventana ofrece 'Descargar base actualizada'");
  await ev("document.getElementById('salidaBase').click(); true");
  const d7 = await esperarDescarga("base_editable_prueba.mdb", 60000);
  ok(!!d7 && fs.statSync(path.join(DL, d7.guid)).size > 1000000, "descargó la base actualizada desde la ventana");
  ok(/No queda trabajo sin guardar/.test(await ev("document.getElementById('salidaLista').textContent")), "después ya no queda trabajo");
  await ev("document.getElementById('salidaSeguir').click(); true");

  console.log("\n[8] Salir de todos modos: se cierra y lo editado queda en la sesión local");
  await ev("switchTab('noti'); var s=document.getElementById('orderSelect'); s.value=String(rows[0].id); s.dispatchEvent(new Event('change',{bubbles:true})); true");
  await esperar("!!document.querySelector('#rows [data-f=\"recibido\"]')", 5000, "notificación");
  await ev(`var el=document.querySelector('#rows [data-f="recibido"]'); el.value='CAMBIO SIN GUARDAR'; el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  await clicReal();
  const r8 = await intentarSalir(true);
  ok(r8.dialogo && r8.recargo, "el navegador avisó y, al elegir salir, la página se cerró/recargó");
  ok(await ev("rows.some(function(r){ return r.fields.recibido==='CAMBIO SIN GUARDAR'; }) && document.getElementById('salidaModal').hidden"), "al reabrir, la edición está en la sesión local y no aparece la ventana");

  console.log("\n[9] Cerrar sesión con trabajo sin guardar");
  await ev(`var s=document.getElementById('orderSelect'); s.value=String(rows[0].id); s.dispatchEvent(new Event('change',{bubbles:true})); true`);
  await esperar("!!document.querySelector('#rows [data-f=\"recibido\"]')", 5000, "notificación");
  await ev(`var el=document.querySelector('#rows [data-f="recibido"]'); el.value='OTRO CAMBIO'; el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  const nOtros = otrosDialogos.length;
  await ev("document.getElementById('btnLogout').click(); true");
  await sleep(500);
  ok(otrosDialogos.length === nOtros && await ev("!document.getElementById('salidaModal').hidden && !document.getElementById('salidaLogout').hidden"), "en vez de cerrar sesión, abre la ventana con 'Cerrar sesión sin guardar'");
  await clicReal();
  const nSalida = dialogosSalida.length;
  await ev("window.__marca=1; document.getElementById('salidaLogout').click(); true");
  await sleep(2500);
  ok(dialogosSalida.length === nSalida, "'Cerrar sesión sin guardar' no pide otra confirmación del navegador");
  await esperar("document.readyState==='complete' && typeof window.__marca==='undefined'", 20000, "recarga tras cerrar sesión");
  await sleep(800);
  ok(await ev("!document.getElementById('authGate').hidden && getComputedStyle(document.getElementById('authGate')).display!=='none'"), "quedó en la pantalla de inicio de sesión");

  ok(errores.length === 0, "sin errores de JavaScript en consola" + (errores.length ? ": " + errores.join(" | ") : ""));
  console.log("\nRESULTADO SALIDA NAVEGADOR: " + pass + " OK, " + fail + " FAIL");
  ws.close(); chrome.kill(); server.close(); mock.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log("ERROR: " + (e.stack || e)); process.exit(2); });
