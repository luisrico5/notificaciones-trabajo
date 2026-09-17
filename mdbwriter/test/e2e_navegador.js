// Prueba de punta a punta en Chrome REAL (headless, protocolo DevTools) del botón "Grabar a la base de datos".
// Uso: node mdbwriter/test/e2e_navegador.js <ruta absoluta a index.html> <COPIA de la base editable .mdb> <carpeta_trabajo>
// Requiere Google Chrome. Bloquea la red a Supabase y entra con una sesión cacheada de prueba (no toca la nube).
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os");
const { spawn } = require("child_process");
const crypto = require("crypto");

const [INDEX, BASE, WORK] = process.argv.slice(2);
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DL = path.join(WORK, "descargas");
const UP = path.join(WORK, "subir");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha1 = f => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");

function rmrf(d) { fs.rmSync(d, { recursive: true, force: true }); }
rmrf(DL); rmrf(UP); fs.mkdirSync(DL, { recursive: true }); fs.mkdirSync(UP, { recursive: true });

// ---- servidor estático (como GitHub Pages) ----
const html = fs.readFileSync(INDEX);
const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html); });

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
  const URLH = "http://127.0.0.1:" + server.address().port + "/index.html";
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-chrome-"));
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run",
    "--no-default-browser-check", "--disable-extensions", "--allow-file-access-from-files", "about:blank"], { stdio: "ignore" });
  let port = null;
  for (let i = 0; i < 100 && !port; i++) { await sleep(200); try { port = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch (e) { } }
  const ver = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const cdp = new CDP(ws);
  const downloads = {};
  const workers = [];
  const errores = [];
  cdp.on(m => {
    if (m.method === "Browser.downloadProgress" && m.params.state === "completed") downloads[m.params.guid] = true;
    if (m.method === "Browser.downloadWillBegin") downloads[m.params.guid] = downloads[m.params.guid] || false, downloads["name:" + m.params.guid] = m.params.suggestedFilename;
    if (m.method === "Target.attachedToTarget" && m.params.targetInfo.type === "worker") workers.push(m.params.targetInfo);
    if (m.method === "Runtime.exceptionThrown") errores.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errores.push(m.params.args.map(a => a.value || a.description).join(" "));
  });
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL, eventsEnabled: true });

  async function nuevaPagina(url, etiqueta) {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId: s } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const S = (m, p) => cdp.send(m, p, s);
    await S("Page.enable"); await S("Runtime.enable"); await S("Network.enable"); await S("DOM.enable");
    await S("Network.setBlockedURLs", { urls: ["*supabase.co*"] });     // sin red a Supabase: la app entra con la sesión cacheada
    await S("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    cdp.on(m => { if (m.sessionId === s && m.method === "Page.javascriptDialogOpening") { dialogs.push(m.params.message); S("Page.handleJavaScriptDialog", { accept: true }); } });
    const dialogs = [];
    const ev = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(etiqueta + ": " + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text)); return r.result.value; };
    const esperar = async (expr, ms, desc) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await ev(expr)) return true; } catch (e) { } await sleep(250); } throw new Error("Tiempo agotado esperando: " + desc); };
    await S("Page.navigate", { url });
    await esperar("document.readyState==='complete'", 60000, "carga");
    await ev(`localStorage.setItem("noti_auth_v1", JSON.stringify({v:1,tokens:{access:"x",refresh:"y",expiresAt:Math.floor(Date.now()/1000)+3600},user:{id:"u-e2e",email:"e2e@prueba"},profile:{id:"u-e2e",email:"e2e@prueba",full_name:"Prueba E2E",role:"tecnico",approved:true},checked_at:Date.now()})); true`);
    await S("Page.reload", {});
    await sleep(500);
    await esperar("document.readyState==='complete' && typeof _appBooted!=='undefined' && _appBooted===true", 60000, "arranque de la app");
    const setFile = async (sel, file) => { const doc = await S("DOM.getDocument", {}); const n = await S("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel });
      await S("DOM.setFileInputFiles", { nodeId: n.nodeId, files: [file] }); };
    return { S, ev, esperar, setFile, dialogs, targetId };
  }
  async function esperarDescarga(nombre, ms) {
    const f = path.join(DL, nombre), t0 = Date.now();
    while (Date.now() - t0 < ms) { const g = Object.keys(downloads).find(k => downloads["name:" + k] === nombre && downloads[k] === true); if (g && fs.existsSync(f)) return f; await sleep(250); }
    throw new Error("No se descargó " + nombre);
  }

  // =====================================================================================
  console.log("\n[1] Página servida por HTTP (como GitHub Pages)");
  const P = await nuevaPagina(URLH, "http");
  ok(await P.ev("!!document.getElementById('authGate').hidden || getComputedStyle(document.getElementById('authGate')).display==='none'"), "la app arrancó con la sesión cacheada (sin red a Supabase)");
  ok(await P.ev("typeof MDBW_FACTORY==='function'"), "index.html trae el escritor de la base (MDBW_FACTORY)");
  await P.ev("switchTab('reporte'); true");
  const TAGS = ["LT-R161", "LT-U6924", "TIT-DR719", "PT-U7122"];
  for (const t of TAGS) { await P.ev(`document.getElementById('repTag').value=${JSON.stringify(t)}; document.getElementById('repBuscar').click(); true`); }
  ok(await P.ev("REP_BATCH.length") === 4, "4 instrumentos agregados al lote con Buscar/agregar");
  // Edición como el técnico: LT-U6924 a 5 puntos (cambia la spec) y un valor Enc. fuera de límite en PT-U7122
  await P.ev(`repSelectShow(1); var el=document.querySelector('#repForm input[data-gpts="0"]'); el.value="5"; el.dispatchEvent(new Event('change',{bubbles:true})); true`);
  ok(await P.ev("REP_BATCH[1].groups[0].rows.length") === 5, "LT-U6924 quedó con 5 puntos (editado en el formulario)");
  await P.ev(`repSelectShow(3); var el=document.querySelector('#repForm input[data-k="found"][data-g="0"][data-p="1"]'); el.value=String(REP_BATCH[3].groups[0].rows[1].hi+1); el.dispatchEvent(new Event('input',{bubbles:true})); true`);
  ok(await P.ev("REP_BATCH[3].groups[0].rows[1].found > REP_BATCH[3].groups[0].rows[1].hi"), "PT-U7122 punto 2 con Enc. fuera de límite (editado en el formulario)");

  console.log("\n[2] Botón 'Grabar a la base de datos' abre el diálogo");
  await P.ev("document.getElementById('repGrabar').click(); true");
  ok(await P.ev("!document.getElementById('dbModal').hidden"), "se abre el diálogo");
  ok(await P.ev("/Se grabarán 4 instrumento/.test(document.getElementById('dbResumen').textContent)"), "resumen: 4 instrumentos");
  ok(await P.ev("document.getElementById('dbProcesar').disabled"), "'Grabar en la base' deshabilitado hasta elegir la base");

  console.log("\n[3] Base _backup: se rechaza sin grabar");
  const backup = path.join(UP, "20260908_dpctrack2_backup.mdb");
  fs.copyFileSync(BASE, backup);
  await P.setFile("#dbFile", backup);
  await P.esperar("/backup/.test(document.getElementById('dbFileName').textContent)", 5000, "nombre de archivo backup");
  await P.ev("document.getElementById('dbProcesar').click(); true");
  await sleep(500);
  ok(await P.ev("document.getElementById('dbEstado').classList.contains('err') && /_backup/.test(document.getElementById('dbEstado').textContent)"), "mensaje de error por base _backup");
  ok(await P.ev("document.getElementById('dbDescargaRow').hidden"), "no se ofrece descarga");

  console.log("\n[4] Base editable: grabar en línea");
  const editable = path.join(UP, "20260908_dpctrack2_editable.mdb");
  fs.copyFileSync(BASE, editable);
  const hashAntes = sha1(editable);
  await P.setFile("#dbFile", editable);
  await P.esperar("/editable/.test(document.getElementById('dbFileName').textContent) && !document.getElementById('dbProcesar').disabled", 5000, "archivo editable elegido");
  const nWorkersAntes = workers.length;
  const t0 = Date.now();
  await P.ev("document.getElementById('dbProcesar').click(); true");
  // mientras graba, el hilo principal debe responder (Web Worker)
  const lat = [];
  let terminado = false;
  while (!terminado && Date.now() - t0 < 240000) {
    const a = Date.now(); terminado = await P.ev("!document.getElementById('dbDescargaRow').hidden || document.getElementById('dbEstado').classList.contains('err') || document.getElementById('dbEstado').classList.contains('warn')"); lat.push(Date.now() - a);
    if (!terminado) await sleep(300);
  }
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  const estado = await P.ev("document.getElementById('dbEstado').textContent");
  console.log("     estado: " + estado);
  console.log("     log:\n" + (await P.ev("document.getElementById('dbLog').textContent")).split("\n").map(l => "       " + l).join("\n"));
  ok(await P.ev("!document.getElementById('dbDescargaRow').hidden"), "grabó y ofrece 'Descargar base actualizada' (" + seg + " s)");
  ok(workers.length > nWorkersAntes, "corrió en un Web Worker");
  ok(Math.max(...lat) < 1500, "la página siguió respondiendo durante el grabado (latencia máx " + Math.max(...lat) + " ms)");
  ok(/4 calibraci/.test(estado), "4 calibraciones grabadas");
  ok(await P.ev("/Verificación: OK/.test(document.getElementById('dbLog').textContent)"), "autoverificación OK");
  ok(await P.ev("document.getElementById('dbCerrar').disabled===false"), "diálogo desbloqueado al terminar");
  await P.ev("document.getElementById('dbDescargar').click(); true");
  const mdbOut = await esperarDescarga("20260908_dpctrack2_editable.mdb", 60000);
  ok(fs.statSync(mdbOut).size > 1000000, "descargó la base actualizada con el mismo nombre (" + fs.statSync(mdbOut).size + " bytes)");
  ok(sha1(editable) === hashAntes, "el archivo original del PC no cambió");

  console.log("\n[5] Opción 2: JSON para grabar.bat (flujo de siempre)");
  const nDlg = P.dialogs.length;
  await P.ev("document.getElementById('dbJson').click(); true");
  const hoy = new Date(); const z = n => (n < 10 ? "0" : "") + n;
  const jsonName = "grabar_calibraciones_" + z(hoy.getDate()) + z(hoy.getMonth() + 1) + hoy.getFullYear() + ".json";
  const jsonOut = await esperarDescarga(jsonName, 30000);
  await sleep(300);
  ok(P.dialogs.length === nDlg + 1 && /grabar\.bat/.test(P.dialogs[P.dialogs.length - 1]), "descargó " + jsonName + " y mostró el aviso");
  const pj = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
  ok(pj.calibraciones.length === 4 && pj.calibraciones[1].grupos[0].puntos.length === 5, "el JSON trae los 4 instrumentos y la edición de puntos");
  const textoPagina = await P.ev("repGrabarJson().text");
  ok(fs.readFileSync(jsonOut, "utf8") === textoPagina, "el JSON descargado es EXACTAMENTE el mismo texto que recibió el grabado en línea");

  console.log("\n[6] El resto de la pestaña sigue funcionando");
  await P.ev("document.getElementById('dbCerrar').click(); true");
  ok(await P.ev("document.getElementById('dbModal').hidden && !document.body.classList.contains('modal-open')"), "el diálogo se cierra");
  await P.ev("repSelectShow(0); document.getElementById('repDescargar').click(); true");
  const pdf = await esperarDescarga("LT-R161.pdf", 90000).catch(e => null);
  ok(pdf && fs.statSync(pdf).size > 10000, "'Descargar reporte (PDF)' sigue descargando el PDF");

  console.log("\n[7] index.html abierto como archivo local (file://)");
  const F = await nuevaPagina("file:///" + INDEX.replace(/\\/g, "/"), "file");
  await F.ev("switchTab('reporte'); document.getElementById('repTag').value='TIT-DR719'; document.getElementById('repBuscar').click(); document.getElementById('repGrabar').click(); true");
  const editable2 = path.join(UP, "copia2", "base_editable_local.mdb"); fs.mkdirSync(path.dirname(editable2), { recursive: true }); fs.copyFileSync(BASE, editable2);
  await F.setFile("#dbFile", editable2);
  await F.esperar("!document.getElementById('dbProcesar').disabled", 5000, "archivo elegido (file://)");
  const w2 = workers.length;
  await F.ev("document.getElementById('dbProcesar').click(); true");
  await F.esperar("!document.getElementById('dbDescargaRow').hidden || document.getElementById('dbEstado').classList.contains('err')", 240000, "grabado file://");
  ok(await F.ev("!document.getElementById('dbDescargaRow').hidden"), "también graba abriendo index.html local (" + (workers.length > w2 ? "Web Worker" : "hilo principal") + "): " + await F.ev("document.getElementById('dbEstado').textContent"));

  ok(errores.length === 0, "sin errores de JavaScript en consola" + (errores.length ? ": " + errores.join(" | ") : ""));
  fs.writeFileSync(path.join(WORK, "resultado_browser.json"), JSON.stringify({ mdb: mdbOut, json: jsonOut }));
  console.log("\nRESULTADO NAVEGADOR: " + pass + " OK, " + fail + " FAIL");
  ws.close(); chrome.kill(); server.close();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.log("ERROR: " + (e.stack || e)); process.exit(2); });
