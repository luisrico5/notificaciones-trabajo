// Pruebas Node (fetch simulado) de sb.req binario y del módulo respaldoNube.
const fs = require("fs"), vm = require("vm"), path = require("path"), nodeCrypto = require("crypto");
const APP = fs.readFileSync(path.join(__dirname, "app_check.js"), "utf8");
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("  OK   " + m); } else { fail++; console.log("  FAIL " + m); } }
function eq(a, b, m) { ok(a === b, m + (a === b ? "" : "  [" + JSON.stringify(a) + " !== " + JSON.stringify(b) + "]")); }
function mkStore(init) { const s = Object.assign({}, init || {}); return { getItem(k) { return (k in s) ? s[k] : null; }, setItem(k, v) { s[k] = String(v); }, removeItem(k) { delete s[k]; } }; }
function mkEl(id) { const classes = new Set(); return { id, hidden: false, textContent: "", value: "", disabled: false, innerHTML: "", className: "", style: {}, dataset: {}, files: [], checked: false,
  classList: { add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, toggle(c, f) { if (f === undefined) f = !classes.has(c); if (f) classes.add(c); else classes.delete(c); return f; }, contains(c) { return classes.has(c); } },
  addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, hasAttribute() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; }, focus() {}, blur() {}, click() {}, remove() {}, closest() { return null; } }; }
const PROFILE = { id: "u1", email: "ana@planta.com", full_name: "Ana Prueba", role: "tecnico", approved: true };
function load(fetchImpl) {
  const els = {}; const $ = id => els[id] || (els[id] = mkEl(id));
  const document = { getElementById: $, querySelector() { return mkEl("q"); }, querySelectorAll() { return []; }, createElement() { return mkEl("c"); }, addEventListener() {}, body: mkEl("body"), documentElement: mkEl("html") };
  const calls = [];
  let impl = fetchImpl;
  const fetchMock = (url, init) => { calls.push({ url, init }); return impl(url, init); };
  const store = mkStore({ noti_auth_v1: JSON.stringify({ v: 1, tokens: { access: "A1", refresh: "R1", expiresAt: Math.floor(Date.now() / 1000) + 3600 }, user: { id: PROFILE.id, email: PROFILE.email }, profile: PROFILE }) });
  const w = { addEventListener() {}, print() {}, scrollTo() {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
  const fastTimeout = (f, ms) => setTimeout(f, Math.min(ms || 0, 5));
  const ctx = vm.createContext({ console, Math, JSON, Date, parseFloat, parseInt, isFinite, isNaN, String, Number, Array, Object, RegExp, Promise, setTimeout: fastTimeout, clearTimeout, setInterval, clearInterval,
    encodeURIComponent, decodeURIComponent, Uint8Array, Int8Array, ArrayBuffer, document, localStorage: store, sessionStorage: mkStore(), navigator: { onLine: true }, location: { reload() {} }, window: w, self: w,
    fetch: fetchMock, alert() {}, confirm() { return true; }, FileReader: function () {}, Blob, Response, CompressionStream, DecompressionStream, crypto: globalThis.crypto,
    URL: { createObjectURL() { return ""; }, revokeObjectURL() {} }, html2pdf: function () { return { set() { return this; }, from() { return this; }, save() { return Promise.resolve(); } }; } });
  vm.runInContext(APP + "\n;globalThis.__api={sb,respaldoNube};", ctx, { filename: "app.js" });
  return { api: ctx.__api, calls, setFetch(f) { impl = f; } };
}
function res(status, body, blob) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status,
    text() { return Promise.resolve(body == null ? "" : (typeof body === "string" ? body : JSON.stringify(body))); },
    blob() { return Promise.resolve(blob); } });
}
const sha = b => nodeCrypto.createHash("sha256").update(b).digest("hex");

(async () => {
  // Datos de prueba: "base" de 3 MB con patrón repetitivo (como un .mdb)
  const base = Buffer.alloc(3 * 1024 * 1024); for (let i = 0; i < base.length; i++) base[i] = (i * 7) % 251;
  const archivo = new Blob([base]); archivo.name = "20260908_dpctrack2_editable.mdb";
  const fileLike = Object.assign(archivo, {});   // Blob con name/size/stream/arrayBuffer

  console.log("\n[N1] sb.req con cuerpo binario, cabeceras extra y respuesta Blob");
  { const L = load(() => res(200, { Key: "respaldo-base/base_original.mdb.gz" }));
    const cuerpo = new Blob([Buffer.from("hola")]);
    await L.api.sb.req("/storage/v1/object/respaldo-base/x.gz", { method: "POST", raw: cuerpo, contentType: "application/gzip", headers: { "x-upsert": "true" } });
    const c = L.calls.find(x => /object\/respaldo-base\/x\.gz$/.test(x.url));   // calls[0] es la revalidación de sesión al arrancar
    ok(c.init.body === cuerpo, "el cuerpo es el Blob tal cual (sin JSON.stringify)");
    eq(c.init.headers["Content-Type"], "application/gzip", "Content-Type del binario");
    eq(c.init.headers["x-upsert"], "true", "cabecera x-upsert");
    eq(c.init.headers.Authorization, "Bearer A1", "Authorization Bearer");
    const blobResp = new Blob([Buffer.from("datos")]);
    L.setFetch(() => res(200, null, blobResp));
    const b = await L.api.sb.req("/storage/v1/object/authenticated/respaldo-base/x.gz", { as: "blob" });
    ok(b === blobResp, "as:'blob' devuelve el Blob de la respuesta");
    L.setFetch(() => res(400, { statusCode: "404", error: "not_found", message: "Bucket not found" }));
    let e = null; try { await L.api.sb.req("/storage/v1/object/authenticated/respaldo-base/x.gz", { as: "blob" }); } catch (x) { e = x; }
    ok(e && e.status === 400 && e.raw && e.raw.statusCode === "404", "error de Storage se lee como JSON aunque se pidiera Blob");
    ok(/Falta configurar el respaldo/.test(L.api.respaldoNube.mensaje(e)), "mensaje: falta configurar (bucket not found)");
    // 401 -> refresh -> reintento con el mismo Blob
    let n = 0;
    L.setFetch((url, init) => {
      n++;
      if (/grant_type=refresh_token/.test(url)) return res(200, { access_token: "A2", refresh_token: "R2", expires_in: 3600 });
      if (init.headers.Authorization === "Bearer A1") return res(401, { message: "jwt expired" });
      return res(200, { Key: "ok" });
    });
    const calls0 = L.calls.length;
    await L.api.sb.req("/storage/v1/object/respaldo-base/x.gz", { method: "POST", raw: cuerpo, contentType: "application/gzip" });
    const reintento = L.calls.slice(calls0).filter(x => /object\/respaldo-base/.test(x.url));
    ok(reintento.length === 2 && reintento[1].init.body === cuerpo && reintento[1].init.headers.Authorization === "Bearer A2", "401 -> refresh -> reintento con el mismo Blob y token nuevo");
  }

  console.log("\n[N2] preparar: huella SHA-256 y gzip ida y vuelta");
  { const L = load(() => res(200, {}));
    const ab = base.buffer.slice(base.byteOffset, base.byteOffset + base.byteLength);
    const prep = await L.api.respaldoNube.preparar(fileLike, ab, ["LT-R161", "PT-U7122"]);
    eq(prep.sha256, sha(base), "sha256 calculado del buffer = sha256 real");
    ok(prep.gz.size < base.length / 5, "gzip comprime (" + base.length + " -> " + prep.gz.size + " bytes)");
    const vuelta = Buffer.from(await new Response(prep.gz.stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    ok(vuelta.equals(base), "gzip descomprime a bytes idénticos");
    const prep2 = await L.api.respaldoNube.preparar(fileLike, null, []);
    eq(prep2.sha256, sha(base), "sin buffer, la huella se calcula leyendo el archivo");
    eq(prep.nombre, "20260908_dpctrack2_editable.mdb", "conserva el nombre");
    eq(prep.bytes, base.length, "conserva el tamaño");
  }

  console.log("\n[N3] subir: objeto (upsert) + fila + limpieza de otros objetos");
  { const nube = { obj: {}, fila: null, borrados: [] };
    nube.obj["viejo_manual.mdb.gz"] = Buffer.from("x");
    const L = load(async (url, init) => {
      if (/\/storage\/v1\/object\/list\/respaldo-base/.test(url)) return res(200, Object.keys(nube.obj).map(n => ({ name: n, id: n })));
      if (init && init.method === "DELETE" && /\/storage\/v1\/object\/respaldo-base$/.test(url)) { const p = JSON.parse(init.body).prefixes; p.forEach(k => { delete nube.obj[k]; nube.borrados.push(k); }); return res(200, p.map(k => ({ name: k }))); }
      if (init && init.method === "POST" && /\/storage\/v1\/object\/respaldo-base\/base_original\.mdb\.gz$/.test(url)) { nube.obj["base_original.mdb.gz"] = Buffer.from(await init.body.arrayBuffer()); nube.upsertHdr = init.headers["x-upsert"]; return res(200, { Key: "respaldo-base/base_original.mdb.gz" }); }
      if (/\/rest\/v1\/respaldo_base/.test(url) && init && init.method === "POST") { const f = JSON.parse(init.body); nube.fila = Object.assign({}, f, { subido_por_nombre: "Ana Prueba", subido_at: new Date().toISOString() }); nube.prefer = init.headers.Prefer; nube.onConflict = url; return res(201, [nube.fila]); }
      if (/\/rest\/v1\/respaldo_base/.test(url)) return res(200, nube.fila ? [nube.fila] : []);
      if (/\/storage\/v1\/object\/authenticated\/respaldo-base\/base_original\.mdb\.gz/.test(url)) return res(200, null, new Blob([nube.obj["base_original.mdb.gz"]]));
      return res(404, { message: "ruta no simulada " + url });
    });
    const ab = base.buffer.slice(base.byteOffset, base.byteOffset + base.byteLength);
    const prepP = L.api.respaldoNube.preparar(fileLike, ab, ["LT-R161"]);
    const intentos = [];
    const fila = await L.api.respaldoNube.subirConReintentos(prepP, (i) => intentos.push(i));
    eq(intentos.join(","), "1", "sube al primer intento");
    eq(nube.upsertHdr, "true", "la subida reemplaza (x-upsert)");
    ok(Object.keys(nube.obj).length === 1 && nube.obj["base_original.mdb.gz"], "queda UN solo objeto en el bucket (se borró el sobrante)");
    eq(nube.borrados.join(","), "viejo_manual.mdb.gz", "borró exactamente el objeto sobrante");
    ok(/on_conflict=id/.test(nube.onConflict) && /merge-duplicates/.test(nube.prefer), "fila por upsert on_conflict=id");
    ok(fila && fila.sha256 === sha(base) && fila.bytes === base.length && fila.bytes_gz === nube.obj["base_original.mdb.gz"].length && fila.nombre === "20260908_dpctrack2_editable.mdb", "fila con nombre, tamaños y huella correctos");
    ok(JSON.stringify(nube.fila.instrumentos) === '["LT-R161"]', "fila con los instrumentos del grabado");
    const d = await L.api.respaldoNube.descargar();
    ok(Buffer.from(await d.blob.arrayBuffer()).equals(base) && d.shaOk, "descargar: bytes idénticos al original y huella verificada");
    ok(/^20260908_dpctrack2_editable_ORIGINAL_\d{4}-\d{2}-\d{2}_\d{4}\.mdb$/.test(d.nombre), "nombre de descarga " + d.nombre);
    nube.fila.sha256 = "0".repeat(64);
    const d2 = await L.api.respaldoNube.descargar();
    eq(d2.shaOk, false, "si la huella no coincide, lo marca");
    // segunda subida con otra base: reemplaza, sigue habiendo uno
    const base2 = Buffer.from(base); base2[10] = 99; const f2 = new Blob([base2]); f2.name = "otra_editable.mdb";
    await L.api.respaldoNube.subirConReintentos(L.api.respaldoNube.preparar(f2, base2.buffer.slice(base2.byteOffset, base2.byteOffset + base2.byteLength), []));
    const gz2 = Buffer.from(await new Response(new Blob([nube.obj["base_original.mdb.gz"]]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    ok(Object.keys(nube.obj).length === 1 && gz2.equals(base2) && nube.fila.nombre === "otra_editable.mdb" && nube.fila.sha256 === sha(base2), "segunda subida reemplaza objeto y fila (sigue habiendo uno)");
  }

  console.log("\n[N4] reintentos y errores");
  { let n = 0;
    const L = load((url) => { if (/object\/respaldo-base\/base_original/.test(url)) { n++; return n < 3 ? res(503, { message: "Service Unavailable" }) : res(200, {}); } if (/rest\/v1\/respaldo_base/.test(url)) return res(201, [{ nombre: "x" }]); if (/object\/list/.test(url)) return res(200, []); return res(200, {}); });
    const intentos = [];
    await L.api.respaldoNube.subirConReintentos(L.api.respaldoNube.preparar(fileLike, null, []), i => intentos.push(i));
    eq(intentos.join(","), "1,2,3", "503, 503, OK -> 3 intentos y sube");
    n = 0;
    L.setFetch((url) => { if (/object\/respaldo-base\/base_original/.test(url)) { n++; return res(503, { message: "Service Unavailable" }); } return res(200, []); });
    let e = null; try { await L.api.respaldoNube.subirConReintentos(L.api.respaldoNube.preparar(fileLike, null, [])); } catch (x) { e = x; }
    ok(e && n === 3, "503 siempre -> 3 intentos y falla (" + n + ")");
    ok(/no responde/.test(L.api.respaldoNube.mensaje(e)), "mensaje de servidor caído");
    n = 0;
    L.setFetch((url) => { if (/object\/respaldo-base\/base_original/.test(url)) { n++; return Promise.reject(new TypeError("Failed to fetch")); } return res(200, []); });
    e = null; try { await L.api.respaldoNube.subirConReintentos(L.api.respaldoNube.preparar(fileLike, null, [])); } catch (x) { e = x; }
    ok(e && e.offline && n === 3, "sin red -> 3 intentos y falla con offline");
    n = 0;
    L.setFetch((url) => { if (/object\/respaldo-base\/base_original/.test(url)) { n++; return res(400, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" }); } return res(200, []); });
    e = null; try { await L.api.respaldoNube.subirConReintentos(L.api.respaldoNube.preparar(fileLike, null, [])); } catch (x) { e = x; }
    ok(e && n === 1, "403 de RLS -> un solo intento");
    ok(/no tiene permiso/.test(L.api.respaldoNube.mensaje(e)), "mensaje de permiso");
    L.setFetch(() => res(404, { code: "PGRST205", message: "Could not find the table 'public.respaldo_base' in the schema cache" }));
    e = null; try { await L.api.respaldoNube.info(); } catch (x) { e = x; }
    ok(/Falta configurar el respaldo/.test(L.api.respaldoNube.mensaje(e)), "tabla sin crear -> mensaje de configuración");
    const nr = new Error("x"); nr.name = "NotReadableError";
    ok(/cambió en el disco/.test(L.api.respaldoNube.mensaje(nr)), "archivo cambiado en disco -> mensaje claro");
  }

  console.log("\n########## RESUMEN NUBE: " + pass + " OK, " + fail + " FAIL ##########");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log("EXCEPCIÓN: " + (e.stack || e)); process.exit(2); });
