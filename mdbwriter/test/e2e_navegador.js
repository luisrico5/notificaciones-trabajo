// Prueba de punta a punta en Chrome REAL (headless, protocolo DevTools) del botón "Grabar a la base de datos".
// Uso: node mdbwriter/test/e2e_navegador.js <ruta absoluta a index.html | URL publicada> <COPIA de la base editable .mdb> <carpeta_trabajo>
// Requiere Google Chrome. Entra con una sesión cacheada de prueba y SIMULA Supabase: un script inyectado antes de la
// app dirige las llamadas a Storage (bucket respaldo-base) y a la tabla respaldo_base a un servidor local en memoria;
// el resto de Supabase (perfil, auth) queda "sin conexión". No toca la nube real.
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os"), zlib = require("zlib");
const { spawn } = require("child_process");
const crypto = require("crypto");

const [INDEX, BASE, WORK] = process.argv.slice(2);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DL = path.join(WORK, "descargas");
const UP = path.join(WORK, "subir");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = (b, alg) => crypto.createHash(alg || "sha1").update(Buffer.isBuffer(b) ? b : fs.readFileSync(b)).digest("hex");
const RUTA = "/storage/v1/object/respaldo-base/base_original.mdb.gz";

function rmrf(d) { fs.rmSync(d, { recursive: true, force: true }); }
rmrf(DL); rmrf(UP); fs.mkdirSync(DL, { recursive: true }); fs.mkdirSync(UP, { recursive: true });
function copiaEn(sub, nombre, origen) { const d = path.join(UP, sub); fs.mkdirSync(d, { recursive: true }); const f = path.join(d, nombre); fs.copyFileSync(origen || BASE, f); return f; }

// ---- servidor estático (como GitHub Pages) ----
const REMOTA = /^https?:\/\//i.test(INDEX);   // p. ej. la página publicada en GitHub Pages (se omite la prueba file://)
const html = REMOTA ? "" : fs.readFileSync(INDEX);
const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); });

// ---- nube simulada (Storage + tabla respaldo_base), servidor HTTP local ----
const nube = { modo: "ok", objetos: new Map([["viejo_manual.mdb.gz", Buffer.from("sobrante")]]), actualizado: {}, fila: null, llamadas: [], intentos: 0, upsert: null, descargaVisibleAlSubir: [] };
const datosNube = () => { const o = nube.objetos.get("datos_calibracion.json.gz"); return o ? JSON.parse(zlib.gunzipSync(o).toString("utf8")) : null; };
// Opcionales: E2E_REF_DATOS = datos_calibracion.json de extract_ranges.ps1 sobre la MISMA base (compara contenido);
// E2E_BASE_VIEJA = copia de una base más vieja (debe rechazarse sin tocar los datos vigentes).
const REF_DATOS = process.env.E2E_REF_DATOS ? JSON.parse(fs.readFileSync(process.env.E2E_REF_DATOS, "utf8").replace(/^﻿/, "")) : null;
function igualContenido(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => igualContenido(x, b[i]));
  if (typeof a === "object") { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => k in b && igualContenido(a[k], b[k])); }
  return false;
}
const mismosDatos = (a, b) => ["tags", "reportes", "patrones", "tecnicos"].every(k => igualContenido(a[k], b[k]));
let paginaActual = null;   // página cuya UI se consulta mientras sube el respaldo
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-upsert, cache-control, prefer, accept", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };
const mock = http.createServer(async (req, res) => {
  const partes = []; for await (const c of req) partes.push(c);
  const body = Buffer.concat(partes);
  const u = new URL(req.url, "http://127.0.0.1"), ruta = u.pathname, m = req.method;
  const json = (code, obj) => { res.writeHead(code, Object.assign({ "Content-Type": "application/json" }, CORS)); res.end(JSON.stringify(obj)); };
  if (process.env.E2E_DEBUG) console.log("  [nube] " + m + " " + ruta + " " + body.length + " bytes");
  if (m === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
  nube.llamadas.push(m + " " + ruta);
  let mm;
  if ((mm = ruta.match(/^\/storage\/v1\/object\/respaldo-base\/([^/]+)$/)) && m === "POST") {
    const nombre = decodeURIComponent(mm[1]), esBase = (ruta === RUTA);
    if (esBase) {
      nube.intentos++;
      try { if (paginaActual) nube.descargaVisibleAlSubir.push(await paginaActual.ev("!document.getElementById('dbDescargaRow').hidden")); } catch (e) { }
    } else nube.subidasDatos = (nube.subidasDatos || 0) + 1;
    if (nube.modo === "caida") return json(503, { message: "Service Unavailable" });
    if (nube.modo === "403") return json(400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
    nube.objetos.set(nombre, body); nube.actualizado[nombre] = new Date().toISOString() + "#" + Math.random();
    if (esBase) { nube.upsert = req.headers["x-upsert"]; nube.tipo = req.headers["content-type"]; }
    return json(200, { Key: "respaldo-base/" + nombre });
  }
  if (ruta === "/storage/v1/object/list/respaldo-base") {
    if (nube.modo === "caida") return json(503, { message: "Service Unavailable" });
    return json(200, Array.from(nube.objetos.keys()).map(n => ({ name: n, id: n, updated_at: nube.actualizado[n] || "t0" })));
  }
  if (ruta === "/storage/v1/object/respaldo-base" && m === "DELETE") { const b = JSON.parse(body.toString("utf8")); b.prefixes.forEach(k => nube.objetos.delete(k)); return json(200, b.prefixes.map(k => ({ name: k }))); }
  if ((mm = ruta.match(/^\/storage\/v1\/object\/authenticated\/respaldo-base\/([^/]+)$/))) {
    if (nube.modo === "caida") return json(503, { message: "Service Unavailable" });
    const o = nube.objetos.get(decodeURIComponent(mm[1]));
    if (!o) return json(400, { statusCode: "404", error: "not_found", message: "Object not found" });
    res.writeHead(200, Object.assign({ "Content-Type": "application/gzip" }, CORS)); return res.end(o);
  }
  if (ruta === "/rest/v1/respaldo_base") {
    if (m === "POST") { const f = JSON.parse(body.toString("utf8")); nube.fila = Object.assign({}, f, { subido_por_nombre: "PRUEBA E2E", subido_at: new Date().toISOString() }); nube.onConflict = u.search; return json(201, [nube.fila]); }
    return json(200, nube.fila ? [nube.fila] : []);
  }
  return json(404, { message: "ruta no simulada " + ruta });
});

// ---- CDP mínimo ----
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pend = new Map(); this.handlers = [];
    ws.onmessage = ev => { const m = JSON.parse(ev.data);
      if (m.id && this.pend.has(m.id)) { const p = this.pend.get(m.id); this.pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
      else if (m.method) this.handlers.forEach(h => h(m)); };
  }
  send(method, params = {}, sessionId) { const id = ++this.id; const msg = { id, method, params }; if (sessionId) msg.sessionId = sessionId;
    return new Promise((res, rej) => { this.pend.set(id, { res, rej }); this.ws.send(JSON.stringify(msg)); }); }
  on(fn) { this.handlers.push(fn); }
}

async function main() {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  await new Promise(r => mock.listen(0, "127.0.0.1", r));
  const URLH = REMOTA ? INDEX : "http://127.0.0.1:" + server.address().port + "/index.html";
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-chrome-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run",
    "--no-default-browser-check", "--disable-extensions", "--allow-file-access-from-files",
    "--disable-features=PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks", "about:blank"], { stdio: "ignore" });
  let port = null;
  for (let i = 0; i < 100 && !port; i++) { await sleep(200); try { port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch (e) { } }
  const ver = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const cdp = new CDP(ws);
  const descargas = [];            // {guid, nombre, listo}
  const usadas = new Set();
  const workers = [];
  const errores = [];
  cdp.on(m => {
    if (m.method === "Browser.downloadWillBegin") descargas.push({ guid: m.params.guid, nombre: m.params.suggestedFilename, listo: false });
    if (m.method === "Browser.downloadProgress" && m.params.state === "completed") { const d = descargas.find(x => x.guid === m.params.guid); if (d) d.listo = true; }
    if (m.method === "Target.attachedToTarget" && m.params.targetInfo.type === "worker") workers.push(m.params.targetInfo);
    if (m.method === "Runtime.exceptionThrown") errores.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errores.push(m.params.args.map(a => a.value || a.description).join(" "));
  });
  // allowAndName: cada descarga se guarda con su GUID (así dos descargas con el mismo nombre no se pisan)
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: DL, eventsEnabled: true });
  async function esperarDescarga(patron, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const d = descargas.find(x => !usadas.has(x.guid) && x.listo && (patron instanceof RegExp ? patron.test(x.nombre) : x.nombre === patron));
      if (d && fs.existsSync(path.join(DL, d.guid))) { usadas.add(d.guid); return { file: path.join(DL, d.guid), nombre: d.nombre }; }
      await sleep(250);
    }
    throw new Error("No se descargó " + patron);
  }

  async function nuevaPagina(url, etiqueta, contexto) {
    const { targetId } = await cdp.send("Target.createTarget", contexto ? { url: "about:blank", browserContextId: contexto } : { url: "about:blank" });
    const { sessionId: s } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, s);
    const dialogs = [];
    await S("Page.enable"); await S("Runtime.enable"); await S("Network.enable"); await S("DOM.enable");
    // Antes de que cargue la app: las llamadas a Storage y a respaldo_base van al servidor simulado; el resto de
    // Supabase (perfil/auth) falla como "sin conexión". (Interceptar con Fetch.requestPaused no sirve: Chrome
    // corta la conexión de DevTools al pausar un POST de varios MB.)
    await S("Page.addScriptToEvaluateOnNewDocument", { source: "(function(){var real=window.fetch, MOCK='http://127.0.0.1:" + mock.address().port + "';" +
      "window.fetch=function(input,init){var url=(typeof input==='string')?input:(input&&input.url)||'';" +
      "if(/supabase\\.co/.test(url)){var u=new URL(url);" +
      "if(/^\\/storage\\/v1\\/|^\\/rest\\/v1\\/respaldo_base/.test(u.pathname)) return real.call(window, MOCK+u.pathname+u.search, init);" +
      "return Promise.reject(new TypeError('Failed to fetch'));}" +
      "return real.apply(window, arguments);};})();" });
    await S("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    const ev = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(etiqueta + ": " + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text)); return r.result.value; };
    cdp.on(m => {
      if (m.sessionId !== s) return;
      if (m.method === "Page.javascriptDialogOpening") { dialogs.push(m.params.message); S("Page.handleJavaScriptDialog", { accept: true }); }
    });
    const esperar = async (expr, ms, desc) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch (e) { } await sleep(250); } throw new Error("Tiempo agotado esperando: " + desc); };
    await S("Page.navigate", { url });
    await esperar("document.readyState==='complete'", 60000, "carga");
    await ev(`localStorage.setItem("noti_auth_v1", JSON.stringify({v:1,tokens:{access:"x",refresh:"y",expiresAt:Math.floor(Date.now()/1000)+3600},user:{id:"u-e2e",email:"e2e@prueba"},profile:{id:"u-e2e",email:"e2e@prueba",full_name:"Prueba E2E",role:"tecnico",approved:true},checked_at:Date.now()})); true`);
    await S("Page.reload", {});
    await sleep(500);
    await esperar("document.readyState==='complete' && typeof _appBooted!=='undefined' && _appBooted===true", 60000, "arranque de la app");
    const setFile = async (sel, file) => { const doc = await S("DOM.getDocument", {}); const n = await S("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel });
      await S("DOM.setFileInputFiles", { nodeId: n.nodeId, files: [file] }); };
    const FIN = "!document.getElementById('dbDescargaRow').hidden || document.getElementById('dbEstado').classList.contains('err') || document.getElementById('dbEstado').classList.contains('warn') || document.getElementById('dbEstado').classList.contains('ok')";
    // Elige la base, pulsa Grabar y espera a que termine (grabado + respaldo). Devuelve latencias del hilo principal.
    const grabar = async (archivo) => {
      await setFile("#dbFile", archivo);
      await esperar("!document.getElementById('dbProcesar').disabled && document.getElementById('dbFileName').textContent.indexOf(" + JSON.stringify(path.basename(archivo)) + ")===0", 10000, "archivo elegido");
      const t0 = Date.now(), lat = [];
      await ev("document.getElementById('dbProcesar').click(); true");
      await sleep(300);
      let fin = false;
      while (!fin && Date.now() - t0 < 300000) {
        const a = Date.now(); fin = await ev("document.getElementById('dbCerrar').disabled===false && (" + FIN + ")"); lat.push(Date.now() - a);
        if (!fin) await sleep(300);
        if (process.env.E2E_DEBUG && lat.length % 30 === 0) console.log("  [estado] " + (await ev("document.getElementById('dbEstado').textContent")));
      }
      return { lat, seg: ((Date.now() - t0) / 1000).toFixed(1), estado: await ev("document.getElementById('dbEstado').textContent"), clase: await ev("document.getElementById('dbEstado').className") };
    };
    // Espera el resultado de "reportes por defecto" tras un grabado.
    const esperarDatos = async () => {
      await esperar("/\\b(ok|warn|err)\\b/.test(document.getElementById('dbDatosEstado').className)", 180000, "datos de calibración tras grabar");
      return { cls: (await ev("document.getElementById('dbDatosEstado').className")).replace("dbst", "").trim(), texto: await ev("document.getElementById('dbDatosEstado').textContent") };
    };
    // Tarjeta 02: "Actualizar desde base .mdb".
    const actualizarDesdeBase = async (archivo) => {
      await ev("var e=document.getElementById('calBaseEstado'); e.className='dbst'; e.innerHTML=''; true");
      await setFile("#importBase", archivo);
      await esperar("/\\b(ok|warn|err)\\b/.test(document.getElementById('calBaseEstado').className)", 180000, "actualizar desde base");
      return { cls: (await ev("document.getElementById('calBaseEstado').className")).replace("dbst", "").trim(), texto: await ev("document.getElementById('calBaseEstado').textContent") };
    };
    const pagina = { S, ev, esperar, setFile, dialogs, targetId, grabar, esperarDatos, actualizarDesdeBase };
    paginaActual = pagina;
    return pagina;
  }
  const gunzip = b => zlib.gunzipSync(b);

  // =====================================================================================
  console.log("\n[1] Página servida por HTTP (como GitHub Pages)");
  const P = await nuevaPagina(URLH, "http");
  ok(await P.ev("!!document.getElementById('authGate').hidden || getComputedStyle(document.getElementById('authGate')).display==='none'"), "la app arrancó con la sesión cacheada");
  ok(await P.ev("typeof MDBW_FACTORY==='function' && typeof respaldoNube==='object'"), "index.html trae el escritor de la base y el módulo de respaldo");
  await P.ev("switchTab('reporte'); true");
  const TAGS = ["LT-R161", "LT-U6924", "TIT-DR719", "PT-U7122"];
  for (const t of TAGS) { await P.ev(`document.getElementById('repTag').value=${JSON.stringify(t)}; document.getElementById('repBuscar').click(); true`); }
  ok(await P.ev("REP_BATCH.length") === 4, "4 instrumentos agregados al lote con Buscar/agregar");
  await P.ev(`repSelectShow(1); var el=document.querySelector('#repForm input[data-gpts="0"]'); el.value="5"; el.dispatchEvent(new Event('change',{bubbles:true})); true`);
  ok(await P.ev("REP_BATCH[1].groups[0].rows.length") === 5, "LT-U6924 quedó con 5 puntos (editado en el formulario)");
  await P.ev(`repSelectShow(3); var el=document.querySelector('#repForm input[data-k="found"][data-g="0"][data-p="1"]'); el.value=String(REP_BATCH[3].groups[0].rows[1].hi+1); el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  ok(await P.ev("REP_BATCH[3].groups[0].rows[1].found > REP_BATCH[3].groups[0].rows[1].hi"), "PT-U7122 punto 2 con Enc. fuera de límite (editado en el formulario)");

  console.log("\n[1b] Tarjeta 02: 'Actualizar desde base .mdb' (solo lectura) y compartir con todos");
  await sleep(3500);   // deja pasar la sincronización del arranque (la nube aún no tiene datos)
  ok(await P.ev("CAL_OVERRIDE===null"), "arranca con los datos incrustados (la nube no tenía datos)");
  const baseDatos = copiaEn("datos", "base_para_datos.mdb"), hashDatos = hash(baseDatos);
  const rd = await P.actualizarDesdeBase(baseDatos);
  ok(rd.cls === "ok" && /compartidos con todos/.test(rd.texto), "actualizó y compartió: " + rd.texto);
  const d1 = datosNube();
  const idBase = (d1 && d1.base) ? d1.base.ultimoId : 0;
  ok(d1 && d1.base.nombre === "base_para_datos.mdb" && idBase > 0 && Object.keys(d1.tags).length > 1000, "datos en la nube (" + (d1 ? Object.keys(d1.tags).length : 0) + " instrumentos, última calibración n.º " + idBase + ")");
  ok(await P.ev("!!CAL_OVERRIDE && CAL_OVERRIDE.base.ultimoId===" + idBase + " && CAL_OVERRIDE.pendienteNube===false"), "aplicados en la app y marcados como compartidos");
  ok(/Datos de la base base_para_datos\.mdb/.test(await P.ev("document.getElementById('calStatus').textContent")), "la tarjeta 02 muestra la base y el estado");
  if (REF_DATOS) ok(d1 && mismosDatos(REF_DATOS, d1), "contenido IDÉNTICO al datos_calibracion.json de extract_ranges.ps1 sobre la misma base");
  ok(hash(baseDatos) === hashDatos, "la base leída no cambió");
  if (process.env.E2E_BASE_VIEJA) {
    const antes = nube.actualizado["datos_calibracion.json.gz"];
    const rv = await P.actualizarDesdeBase(copiaEn("vieja", "base_vieja.mdb", process.env.E2E_BASE_VIEJA));
    ok(rv.cls === "warn" && /más vieja/.test(rv.texto), "base más vieja rechazada: " + rv.texto);
    ok(nube.actualizado["datos_calibracion.json.gz"] === antes && await P.ev("CAL_OVERRIDE.base.ultimoId===" + idBase), "ni la nube ni la app retrocedieron");
  }

  console.log("\n[2] Botón 'Grabar a la base de datos' abre el diálogo");
  await P.ev("document.getElementById('repGrabar').click(); true");
  ok(await P.ev("!document.getElementById('dbModal').hidden"), "se abre el diálogo");
  ok(await P.ev("/Se grabarán 4 instrumento/.test(document.getElementById('dbResumen').textContent)"), "resumen: 4 instrumentos");
  ok(await P.ev("document.getElementById('dbProcesar').disabled"), "'Grabar en la base' deshabilitado hasta elegir la base");
  await P.esperar("/Aún no hay respaldo/.test(document.getElementById('dbNubeInfo').textContent)", 10000, "info de la nube");
  ok(await P.ev("document.getElementById('dbNubeDescargar').disabled"), "sin respaldo en la nube: 'Descargar respaldo' deshabilitado");

  console.log("\n[3] Casos que NO graban: _backup y archivo dañado (la nube no se toca)");
  nube.llamadas = [];   // la consulta de información del paso 2 no cuenta
  await P.setFile("#dbFile", copiaEn("b", "20260908_dpctrack2_backup.mdb"));
  await P.esperar("/backup/.test(document.getElementById('dbFileName').textContent)", 5000, "nombre backup");
  await P.ev("document.getElementById('dbProcesar').click(); true");
  await sleep(500);
  ok(await P.ev("document.getElementById('dbEstado').classList.contains('err') && /_backup/.test(document.getElementById('dbEstado').textContent)"), "base _backup rechazada");
  const danado = path.join(UP, "d", "base_danada_editable.mdb"); fs.mkdirSync(path.dirname(danado), { recursive: true }); fs.writeFileSync(danado, crypto.randomBytes(2 * 1024 * 1024));
  const r3 = await P.grabar(danado);
  ok(/No se grabó nada/.test(r3.estado) && /err/.test(r3.clase), "archivo dañado: 'No se grabó nada'");
  ok(nube.llamadas.length === 0 && nube.intentos === 0, "la nube no se tocó en los casos fallidos");
  ok(await P.ev("document.getElementById('dbDescargaRow').hidden && document.getElementById('dbNubeFallo').hidden"), "no se ofrece ninguna descarga");

  console.log("\n[4] Base editable: grabar + respaldo de la ORIGINAL en la nube");
  const ed1 = copiaEn("uno", "20260908_dpctrack2_editable.mdb");
  const orig1 = fs.readFileSync(ed1), hashAntes = hash(ed1);
  const nW = workers.length;
  const r4 = await P.grabar(ed1);
  console.log("     estado: " + r4.estado);
  console.log("     log:\n" + (await P.ev("document.getElementById('dbLog').textContent")).split("\n").map(l => "       " + l).join("\n"));
  ok(/Respaldo de la base original guardado en la nube/.test(r4.estado) && /ok/.test(r4.clase), "grabó y guardó el respaldo (" + r4.seg + " s)");
  ok(/4 calibraci/.test(r4.estado), "4 calibraciones grabadas");
  ok(workers.length > nW, "el grabado corrió en un Web Worker");
  ok(Math.max(...r4.lat) < 1500, "la página siguió respondiendo (latencia máx " + Math.max(...r4.lat) + " ms)");
  ok(await P.ev("/Verificación: OK/.test(document.getElementById('dbLog').textContent)"), "autoverificación OK");
  ok(nube.descargaVisibleAlSubir.length === 1 && nube.descargaVisibleAlSubir[0] === false, "mientras subía el respaldo NO se ofrecía la descarga");
  ok(nube.intentos === 1 && nube.upsert === "true" && /gzip/.test(nube.tipo || ""), "subida única con x-upsert y tipo gzip");
  const obj1 = nube.objetos.get("base_original.mdb.gz");
  const soloEsperados = () => Array.from(nube.objetos.keys()).every(k => k === "base_original.mdb.gz" || k === "datos_calibracion.json.gz");
  ok(obj1 && soloEsperados() && !nube.objetos.has("viejo_manual.mdb.gz"), "UN solo respaldo de base en el bucket (se borró el sobrante; se conserva el archivo de datos compartidos)");
  ok(obj1 && gunzip(obj1).equals(orig1), "el respaldo descomprimido es idéntico byte a byte a la base ORIGINAL (" + orig1.length + " -> " + (obj1 ? obj1.length : 0) + " bytes)");
  ok(nube.fila && nube.fila.nombre === "20260908_dpctrack2_editable.mdb" && nube.fila.bytes === orig1.length && nube.fila.bytes_gz === obj1.length && nube.fila.sha256 === hash(orig1, "sha256"), "fila: nombre, tamaños y SHA-256 correctos");
  ok(JSON.stringify(nube.fila && nube.fila.instrumentos) === JSON.stringify(TAGS) && /on_conflict=id/.test(nube.onConflict || ""), "fila: instrumentos del grabado, upsert por id");
  ok(await P.ev("!document.getElementById('dbDescargaRow').hidden && document.getElementById('dbNubeFallo').hidden"), "ofrece 'Descargar base actualizada' (sin botones de fallo)");
  ok(await P.ev("/20260908_dpctrack2_editable\\.mdb/.test(document.getElementById('dbNubeInfo').textContent) && !document.getElementById('dbNubeDescargar').disabled"), "info de la nube actualizada y 'Descargar respaldo' habilitado");
  await P.ev("document.getElementById('dbDescargar').click(); true");
  const mdbOut = await esperarDescarga("20260908_dpctrack2_editable.mdb", 60000);
  ok(fs.statSync(mdbOut.file).size > 1000000 && !fs.readFileSync(mdbOut.file).equals(orig1), "descargó la base actualizada con el mismo nombre");
  ok(hash(ed1) === hashAntes, "el archivo original del PC no cambió");
  const dd4 = await P.esperarDatos(), d4 = datosNube();
  ok(dd4.cls === "ok" && d4 && d4.base.ultimoId > idBase && d4.base.nombre === "20260908_dpctrack2_editable.mdb", "tras grabar, reportes por defecto actualizados con la base YA actualizada (n.º " + (d4 && d4.base.ultimoId) + ") y compartidos: " + dd4.texto);
  ok(await P.ev("repLookup('LT-R161').by") === "PRUEBA E2E" && await P.ev("CAL_OVERRIDE.tags.LTR161.by") === "PRUEBA E2E", "el reporte y la notificación por defecto de LT-R161 ya traen al técnico del grabado");
  const idTras4 = d4 ? d4.base.ultimoId : 0;

  console.log("\n[5] Descargar el respaldo de la nube");
  await P.ev("document.getElementById('dbNubeDescargar').click(); true");
  const rest = await esperarDescarga(/^20260908_dpctrack2_editable_ORIGINAL_\d{4}-\d{2}-\d{2}_\d{4}\.mdb$/, 60000);
  ok(fs.readFileSync(rest.file).equals(orig1), "baja " + rest.nombre + " idéntica a la base original");
  await P.esperar("document.getElementById('dbNubeEstado').classList.contains('ok')", 10000, "estado de descarga de nube");
  ok(/huella verificada/.test(await P.ev("document.getElementById('dbNubeEstado').textContent")), "huella SHA-256 verificada al descargar");

  console.log("\n[6] Opción 2: JSON para grabar.bat (flujo de siempre)");
  const nDlg = P.dialogs.length;
  await P.ev("document.getElementById('dbJson').click(); true");
  const hoy = new Date(); const z = n => (n < 10 ? "0" : "") + n;
  const jsonName = "grabar_calibraciones_" + z(hoy.getDate()) + z(hoy.getMonth() + 1) + hoy.getFullYear() + ".json";
  const jsonOut = await esperarDescarga(jsonName, 30000);
  await sleep(300);
  ok(P.dialogs.length === nDlg + 1 && /grabar\.bat/.test(P.dialogs[P.dialogs.length - 1]), "descargó " + jsonName + " y mostró el aviso");
  const pj = JSON.parse(fs.readFileSync(jsonOut.file, "utf8"));
  ok(pj.calibraciones.length === 4 && pj.calibraciones[1].grupos[0].puntos.length === 5, "el JSON trae los 4 instrumentos y la edición de puntos");
  ok(fs.readFileSync(jsonOut.file, "utf8") === await P.ev("repGrabarJson().text"), "el JSON descargado es EXACTAMENTE el texto que recibió el grabado en línea");

  console.log("\n[7] Segundo grabado: el respaldo se REEMPLAZA (sigue habiendo uno)");
  const ed2 = copiaEn("dos", "20260908_dpctrack2_editable.mdb", mdbOut.file);    // la base ya actualizada es la nueva "original"
  const orig2 = fs.readFileSync(ed2);
  nube.intentos = 0; nube.descargaVisibleAlSubir = [];
  const r7 = await P.grabar(ed2);
  const obj2 = nube.objetos.get("base_original.mdb.gz");
  ok(/Respaldo de la base original guardado/.test(r7.estado), "grabó y respaldó (" + r7.seg + " s)");
  ok(soloEsperados() && obj2 && gunzip(obj2).equals(orig2) && !gunzip(obj2).equals(orig1), "el único respaldo de base ahora es la original del SEGUNDO grabado");
  ok(nube.fila.sha256 === hash(orig2, "sha256") && nube.fila.bytes === orig2.length, "la fila se actualizó con la nueva original");
  const dd7 = await P.esperarDatos(), d7 = datosNube();
  ok(dd7.cls === "ok" && d7 && d7.base.ultimoId > idTras4, "segundo grabado: datos compartidos avanzan (n.º " + (d7 && d7.base.ultimoId) + ")");
  const idTras7 = d7 ? d7.base.ultimoId : 0;

  console.log("\n[8] Nube caída: 3 intentos, luego descargar ORIGINAL y ACTUALIZADA; reintento manual");
  nube.modo = "caida"; nube.intentos = 0;
  const ed3 = copiaEn("tres", "20260908_dpctrack2_editable.mdb");
  const orig3 = fs.readFileSync(ed3);
  const r8 = await P.grabar(ed3);
  ok(/No se pudo guardar el respaldo/.test(r8.estado) && /warn/.test(r8.clase), "avisa que no se pudo guardar el respaldo (" + r8.seg + " s)");
  ok(nube.intentos === 3, "hizo 3 intentos (" + nube.intentos + ")");
  ok(await P.ev("!document.getElementById('dbNubeFallo').hidden && !document.getElementById('dbDescargaRow').hidden"), "muestra 'Reintentar', 'Descargar base original' y 'Descargar base actualizada'");
  ok(gunzip(nube.objetos.get("base_original.mdb.gz")).equals(orig2), "el respaldo anterior de la nube quedó intacto");
  await P.ev("document.getElementById('dbOriginal').click(); true");
  const o3 = await esperarDescarga(/^20260908_dpctrack2_editable_ORIGINAL_\d{4}-\d{2}-\d{2}_\d{4}\.mdb$/, 60000);
  ok(fs.readFileSync(o3.file).equals(orig3), "'Descargar base original' baja " + o3.nombre + " idéntica a la elegida");
  const dd8 = await P.esperarDatos();
  ok(dd8.cls === "warn" && /más vieja/.test(dd8.texto) && datosNube().base.ultimoId === idTras7, "la base de este grabado es más vieja que los datos vigentes: no retrocede (" + dd8.texto + ")");
  await P.ev("document.getElementById('dbDescargar').click(); true");
  const m3 = await esperarDescarga("20260908_dpctrack2_editable.mdb", 60000);
  ok(fs.statSync(m3.file).size > 1000000 && !fs.readFileSync(m3.file).equals(orig3), "'Descargar base actualizada' también funciona");
  nube.modo = "ok"; nube.intentos = 0;
  await P.ev("document.getElementById('dbNubeReintentar').click(); true");
  await sleep(300);
  await P.esperar("document.getElementById('dbCerrar').disabled===false && document.getElementById('dbEstado').classList.contains('ok')", 60000, "reintento");
  ok(nube.intentos === 1 && gunzip(nube.objetos.get("base_original.mdb.gz")).equals(orig3), "'Reintentar respaldo' sube la original de este grabado");
  ok(await P.ev("document.getElementById('dbNubeFallo').hidden && !document.getElementById('dbDescargaRow').hidden"), "tras el reintento quedan solo las descargas normales");

  console.log("\n[9] Cuenta sin permiso (403): sin reintentos, directo a las dos descargas");
  nube.modo = "403"; nube.intentos = 0;
  const r9 = await P.grabar(copiaEn("cuatro", "20260908_dpctrack2_editable.mdb"));
  ok(nube.intentos === 1 && /no tiene permiso/.test(r9.estado), "un solo intento y mensaje de permiso");
  ok(await P.ev("!document.getElementById('dbNubeFallo').hidden && !document.getElementById('dbDescargaRow').hidden"), "ofrece original y actualizada");
  ok(gunzip(nube.objetos.get("base_original.mdb.gz")).equals(orig3), "la nube no cambió");
  nube.modo = "ok";

  console.log("\n[10] El resto de la pestaña sigue funcionando");
  await P.ev("document.getElementById('dbCerrar').click(); true");
  ok(await P.ev("document.getElementById('dbModal').hidden && !document.body.classList.contains('modal-open')"), "el diálogo se cierra");
  await P.ev("repSelectShow(0); document.getElementById('repDescargar').click(); true");
  const pdf = await esperarDescarga("LT-R161.pdf", 90000).catch(e => null);
  ok(pdf && fs.statSync(pdf.file).size > 10000, "'Descargar reporte (PDF)' sigue descargando el PDF");

  if (!REMOTA) {
    console.log("\n[11] index.html abierto como archivo local (file://)");
    const F = await nuevaPagina("file:///" + INDEX.replace(/\\/g, "/"), "file");
    await F.ev("switchTab('reporte'); document.getElementById('repTag').value='TIT-DR719'; document.getElementById('repBuscar').click(); document.getElementById('repGrabar').click(); true");
    const w2 = workers.length; nube.intentos = 0;
    const edF = copiaEn("local", "base_editable_local.mdb");
    const rF = await F.grabar(edF);
    ok(/Respaldo de la base original guardado/.test(rF.estado) && gunzip(nube.objetos.get("base_original.mdb.gz")).equals(fs.readFileSync(edF)),
      "también graba y respalda abriendo index.html local (" + (workers.length > w2 ? "Web Worker" : "hilo principal") + ")");
    ok(await F.ev("!!CAL_OVERRIDE && CAL_OVERRIDE.origen==='nube' && CAL_OVERRIDE.base.ultimoId===" + idTras7), "al abrir recibió de la nube los datos compartidos");
  }

  console.log("\n[12] Otro navegador (perfil limpio): al abrir recibe los datos compartidos");
  const { browserContextId } = await cdp.send("Target.createBrowserContext", {});
  const O = await nuevaPagina(URLH, "otro", browserContextId);
  await O.esperar("!!CAL_OVERRIDE && CAL_OVERRIDE.origen==='nube'", 30000, "sincronización en otro navegador");
  ok(await O.ev("CAL_OVERRIDE.base.ultimoId") === idTras7, "aplicó los datos de la nube (n.º " + idTras7 + ")");
  ok(await O.ev("repLookup('LT-R161').by") === "PRUEBA E2E", "el reporte por defecto de LT-R161 ya viene actualizado en el otro navegador");
  ok(/recibidos de la nube/.test(await O.ev("document.getElementById('calStatus').textContent")), "la tarjeta 02 indica que vienen de la nube");

  ok(errores.length === 0, "sin errores de JavaScript en consola" + (errores.length ? ": " + errores.join(" | ") : ""));
  fs.writeFileSync(path.join(WORK, "resultado_browser.json"), JSON.stringify({ mdb: mdbOut.file, json: jsonOut.file, base: ed1 }));
  console.log("\nRESULTADO NAVEGADOR: " + pass + " OK, " + fail + " FAIL");
  ws.close(); chrome.kill(); server.close(); mock.close();
  try { rmrf(profile); } catch (e) { }
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log("ERROR: " + (e.stack || e)); process.exit(2); });
