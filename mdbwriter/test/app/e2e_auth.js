// e2e_auth.js — pruebas (Node + stub de DOM + fetch simulado) del login y el guardado por usuario. Correr con mdbwriter/test/app/correr.js
const fs=require("fs"), vm=require("vm"), path=require("path");
const APP=fs.readFileSync(path.join(__dirname,"app_check.js"),"utf8");
let pass=0, fail=0;
function ok(c,m){ if(c){pass++;console.log("  OK   "+m);} else {fail++;console.log("  FAIL "+m);} }
function eq(a,b,m){ ok(a===b, m+(a===b?"":"  ["+JSON.stringify(a)+" !== "+JSON.stringify(b)+"]")); }
const wait=(ms)=>new Promise(r=>setTimeout(r,ms||20));
function resp(status,body){ return { ok:(status>=200&&status<300), status, text(){ return Promise.resolve(body==null?"":JSON.stringify(body)); } }; }
function fetchSeq(list){ let i=0; return function(url,init){ const it=list[Math.min(i,list.length-1)]; i++; const r=(typeof it==="function")?it(url,init):it; if(r instanceof Error) return Promise.reject(r); return Promise.resolve(resp(r.status,r.body)); }; }
function mkStore(init){ const s=Object.assign({},init||{}); return { getItem(k){return (k in s)?s[k]:null;}, setItem(k,v){s[k]=String(v);}, removeItem(k){delete s[k];}, _s:s }; }
function mkEl(id){ const classes=new Set(); return { id, hidden:false, textContent:"", value:"", disabled:false, innerHTML:"", className:"", style:{}, dataset:{}, files:[], checked:false, _classes:classes,
  classList:{ add(c){classes.add(c);}, remove(c){classes.delete(c);}, toggle(c,f){ if(f===undefined) f=!classes.has(c); if(f) classes.add(c); else classes.delete(c); return f; }, contains(c){return classes.has(c);} },
  addEventListener(){}, appendChild(){}, setAttribute(){}, getAttribute(){return null;}, removeAttribute(){}, hasAttribute(){return false;}, querySelector(){return null;}, querySelectorAll(){return [];}, contains(){return false;}, focus(){}, blur(){}, click(){}, remove(){}, closest(){return null;} }; }
function load(opts){
  opts=opts||{};
  const els={}; const $=id=>els[id]||(els[id]=mkEl(id));
  const document={ getElementById:$, querySelector(){return mkEl("q");}, querySelectorAll(){return [];}, createElement(){return mkEl("c");}, addEventListener(){}, body:mkEl("body"), documentElement:mkEl("html") };
  const calls=[]; let current=opts.fetch||function(){ return Promise.reject(new TypeError("Failed to fetch")); };
  function fetchMock(url,init){ calls.push({url,init}); return current(url,init); }
  const localStorage=mkStore(opts.store), sessionStorage=mkStore();
  const navigator={onLine: opts.online!==false};
  const st={reloaded:0}; const location={reload(){ st.reloaded++; }};
  const w={addEventListener(){}, print(){}, scrollTo(){}, scrollX:0, scrollY:0, matchMedia(){return {matches:false,addEventListener(){}};}};
  const ctx=vm.createContext({console,Math,JSON,Date,parseFloat,parseInt,isFinite,isNaN,String,Number,Array,Object,RegExp,Promise,setTimeout,clearTimeout,encodeURIComponent,decodeURIComponent,
    document,localStorage,sessionStorage,navigator,location,window:w,self:w,fetch:fetchMock,alert(){},confirm(){return true;},FileReader:function(){},Blob:function(){},URL:{createObjectURL(){return"";},revokeObjectURL(){}},
    html2pdf:function(){return{set(){return this;},from(){return this;},save(){return Promise.resolve();}};}});
  vm.runInContext(APP+"\n;globalThis.__api={makeRow,recompAuto,genText,fileNameOf,repBuildState,repGrabarPayload,repBuildHtml,regenPoints,renderRepTecnicos,sb,auth,misReportes,adminUsers,TAG_REPORT,TECNICOS,tecnicoNombre,repLookup,get CURRENT_USER(){return CURRENT_USER;},get rows(){return rows;},get REP_BATCH(){return REP_BATCH;},get repState(){return repState;},set repState(v){repState=v;},get _appBooted(){return _appBooted;}};",ctx,{filename:"app.js"});
  return { api:ctx.__api, els, calls, localStorage, sessionStorage, st, setFetch(fn){ current=fn; } };
}
const PROFILE={id:"u1",email:"ana@planta.com",full_name:"Ana Prueba",role:"tecnico",approved:true};
function cacheFor(profile,expIn){ return {v:1,tokens:{access:"A1",refresh:"R1",expiresAt:Math.floor(Date.now()/1000)+(expIn==null?3600:expIn)},user:{id:profile.id,email:profile.email},profile}; }
function pickRec(api){ return Object.keys(api.TAG_REPORT).map(k=>api.TAG_REPORT[k]).find(r=>r&&r.g&&r.g.length&&r.g[0].pts&&r.g[0].pts.length>=3); }

(async function(){
  console.log("\n[T0] Sin sesión cacheada");
  { const A=load();
    eq(A.calls.length,0,"al cargar NO llama a fetch");
    ok(A.els.authLogin._classes.has("active"),"muestra la vista de login");
    eq(A.els.authGate.hidden,false,"gate visible");
    eq(A.api._appBooted,false,"la app no arranca sin sesión");
    ok(!/Falta configurar/.test(A.els.authMsg?A.els.authMsg.textContent:""),"con SB_URL/SB_ANON_KEY reales no muestra el aviso de configuracion");
    const r=A.api.makeRow("4100001","TRANSMISOR DE PRESION PT-3110","","05/03/2026"); A.api.recompAuto(r); const t=A.api.genText(r);
    ok(t.split("\n").filter(l=>l.length).every(l=>l[0]==="."),"genText sigue prefijando '.' en todas las líneas");
    eq(r.fields.tecnico,"","sin usuario: 'Trabajo realizado por' vacío (regla de 2 meses/sin base)");
  }

  console.log("\n[T1] Sesión cacheada y aprobada: arranque inmediato + autollenado");
  { const B=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, fetch:fetchSeq([{status:200,body:[PROFILE]}])});
    eq(B.api._appBooted,true,"bootApp corre de inmediato con la caché");
    eq(B.els.authGate.hidden,true,"gate oculto");
    eq(B.els.userBar.hidden,false,"barra de usuario visible");
    eq(B.api.CURRENT_USER.name,"Ana Prueba","CURRENT_USER cargado desde la caché");
    eq(B.api.tecnicoNombre(),"ANA PRUEBA","tecnicoNombre en MAYÚSCULAS sin acentos");
    await wait();
    eq(B.calls.length,1,"revalida el perfil en segundo plano (1 fetch)");
    ok(/\/rest\/v1\/profiles\?/.test(B.calls[0].url),"consulta /rest/v1/profiles");
    const h=B.calls[0].init.headers; ok(/^eyJ/.test(h.apikey) && h.Authorization==="Bearer A1","headers apikey + Authorization Bearer");
    const r=B.api.makeRow("4100001","TRANSMISOR DE PRESION PT-3110","","05/03/2026"); B.api.recompAuto(r);
    eq(r.fields.tecnico,"ANA PRUEBA","'Trabajo realizado por' autollenado con el usuario");
    r.fields.tecnico="OTRO NOMBRE"; B.api.recompAuto(r); eq(r.fields.tecnico,"OTRO NOMBRE","la edición manual se respeta tras recompAuto");
    const rec=pickRec(B.api); const st=B.api.repBuildState(rec);
    eq(st.h.by,"ANA PRUEBA","h.by (Quién realizó la calibración) autollenado");
    eq(st.h.fin,"ANA PRUEBA","h.fin (Finalizado por) autollenado");
    eq(B.api.repGrabarPayload(st).finalizadoPor,"ANA PRUEBA","finalizadoPor en el JSON de grabar");
    B.api.renderRepTecnicos(); const html=B.els.repTecnico.innerHTML;
    eq((html.match(/<option value="ANA PRUEBA">/g)||[]).length,1,"el usuario aparece UNA vez en el desplegable de técnicos");
    ok(html.indexOf("ANA PRUEBA")<html.indexOf(B.api.TECNICOS[0]),"…y en primer lugar");
  }

  console.log("\n[T2] Round-trip de un reporte de calibración (serializar → JSON → deserializar)");
  { const B=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, fetch:fetchSeq([{status:200,body:[PROFILE]}])});
    const rec=pickRec(B.api); const st=B.api.repBuildState(rec);
    st.h.ce="4100777"; st.h.tp="27"; st.h.nt="Nota editada a mano."; st.std.push(["U-9999","PATRON DE PRUEBA","MARCA","MOD","S/N","01/01/2026","01/01/2027"]);
    const G=st.groups[0]; B.api.regenPoints(G,7); G.rows[0].found=G.rows[0].outNom+0.01; G.rows[3].left=G.rows[3].outNom-0.02;
    G.range.oHi=G.range.oHi*1.1; B.api.regenPoints(G,7); G.rows[6].found=G.rows[6].outNom+0.03;
    const pay1=JSON.stringify(B.api.repGrabarPayload(st));
    B.api.repState=st; const html1=B.api.repBuildHtml().replace(/<tr><td class="lbl">Fecha de finalización<\/td><td>[^<]*<\/td><\/tr>/,"");
    const p=JSON.parse(JSON.stringify(B.api.misReportes.serializeCal(st)));
    ok(p.v===1 && p.rec && p.h && p.groups && !("meta" in p.groups[0]) && !("tol" in p.groups[0]),"payload v1 con rec/h/std/groups (sin meta ni tol)");
    const st2=B.api.misReportes.deserializeCal(p);
    eq(JSON.stringify(B.api.repGrabarPayload(st2)),pay1,"repGrabarPayload idéntico tras reabrir");
    B.api.repState=st2; const html2=B.api.repBuildHtml().replace(/<tr><td class="lbl">Fecha de finalización<\/td><td>[^<]*<\/td><\/tr>/,"");
    eq(html2,html1,"repBuildHtml idéntico tras reabrir (salvo hora de finalización)");
    eq(st2.h.nt,"Nota editada a mano.","nota editada conservada"); eq(st2.std.length,st.std.length,"patrones añadidos conservados");
    const G2=st2.groups[0]; let same=true;
    [0,0.25,0.5,0.75,1].forEach(f=>{ const o=G.range.oLo+(G.range.oHi-G.range.oLo)*f, span=Math.abs(G.range.oHi-G.range.oLo); const a=G.tol(o,span), b=G2.tol(o,span); if(!((isNaN(a)&&isNaN(b))||Math.abs(a-b)<1e-12)) same=false; });
    ok(same,"modelo de tolerancia (tol) idéntico en 5 puntos");
    B.api.regenPoints(G,9); B.api.regenPoints(G2,9);
    eq(JSON.stringify(G.rows),JSON.stringify(G2.rows),"regenPoints(9) produce las mismas filas en el reabierto");
  }

  console.log("\n[T3] Round-trip de una notificación .txt");
  { const B=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, fetch:fetchSeq([{status:200,body:[PROFILE]}])});
    const r=B.api.makeRow("4100002","TRANSMISOR DE PRESION PT-3110","","05/03/2026"); B.api.recompAuto(r);
    r.fields.comoEncontro="Editado a mano."; r.fields.recibido="PEPE PEREZ"; r.saved=true;
    const p=JSON.parse(JSON.stringify(B.api.misReportes.serializeNoti(r)));
    ok(p.v===1 && typeof p.txt==="string" && p.txt.indexOf(".Trabajo recibido por: PEPE PEREZ")>=0,"payload lleva el .txt generado");
    const r2=B.api.misReportes.deserializeNoti(p);
    eq(B.api.genText(r2),p.txt,"genText del reabierto == txt guardado");
    eq(B.api.fileNameOf(r2),p.filename,"nombre de archivo igual");
    eq(r2.fields.comoEncontro,"Editado a mano.","edición manual intacta");
    eq(r2.fields.tecnico,"ANA PRUEBA","técnico autollenado sigue tras reabrir");
    const item=B.api.misReportes.itemNoti(r); eq(item.kind,"notificacion","itemNoti.kind"); eq(item.ot,"4100002","itemNoti.ot"); eq(item.tag,"PT-3110","itemNoti.tag");
  }

  console.log("\n[T4] Wrapper sb: errores legibles, 401→refresh→reintento, offline, refresco proactivo");
  { const B=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, fetch:fetchSeq([{status:200,body:[PROFILE]}])}); await wait();
    B.setFetch(fetchSeq([{status:400,body:{error_code:"invalid_credentials",msg:"Invalid login credentials"}}]));
    let e=null; try{ await B.api.sb.auth.signIn("a@b.c","x"); }catch(x){ e=x; } eq(e&&e.message,"Correo o contraseña incorrectos","GoTrue nuevo: invalid_credentials → mensaje legible");
    B.setFetch(fetchSeq([{status:400,body:{error:"invalid_grant",error_description:"Invalid login credentials"}}]));
    e=null; try{ await B.api.sb.auth.signIn("a@b.c","x"); }catch(x){ e=x; } eq(e&&e.message,"Correo o contraseña incorrectos","GoTrue antiguo: invalid_grant → mensaje legible");
    B.setFetch(fetchSeq([{status:403,body:{code:"42501",message:"new row violates row-level security policy"}}]));
    e=null; try{ await B.api.sb.from("reportes").insert({a:1}); }catch(x){ e=x; } ok(e&&/permiso/.test(e.message)&&e.status===403,"PostgREST 42501/403 → 'sin permiso'");
    B.setFetch(function(){ return Promise.reject(new TypeError("Failed to fetch")); });
    e=null; try{ await B.api.sb.from("reportes").select("id"); }catch(x){ e=x; } ok(e&&e.offline===true,"TypeError de red → e.offline");
    const n0=B.calls.length;
    B.setFetch(fetchSeq([{status:401,body:{code:"PGRST301",message:"JWT expired"}},{status:200,body:{access_token:"A2",refresh_token:"R2",expires_in:3600}},{status:200,body:[{id:"x1"}]}]));
    const rows=await B.api.sb.from("reportes").select("id",{limit:5});
    eq(JSON.stringify(rows),'[{"id":"x1"}]',"401 → refresh → reintento devuelve datos");
    eq(B.calls.length-n0,3,"exactamente 3 llamadas (select, refresh, select)");
    ok(/grant_type=refresh_token/.test(B.calls[n0+1].url),"la 2ª llamada es el refresh");
    eq(B.calls[n0+2].init.headers.Authorization,"Bearer A2","el reintento usa el token nuevo");
    eq(JSON.parse(B.localStorage._s.noti_auth_v1).tokens.access,"A2","la caché guarda los tokens rotados");
    ok(/Prefer/.test(JSON.stringify(B.calls[n0+2].init.headers))===false,"select sin Prefer");
    B.setFetch(fetchSeq([{status:201,body:[{id:"n1",updated_at:"2026-09-16T10:00:00Z"}]}]));
    await B.api.sb.from("reportes").upsert({kind:"x"},"user_id,kind,tag,ot"); const last=B.calls[B.calls.length-1];
    ok(/on_conflict=user_id%2Ckind%2Ctag%2Cot/.test(last.url)&&last.init.headers.Prefer==="resolution=merge-duplicates,return=representation","upsert: on_conflict + Prefer merge-duplicates");
  }
  { const C=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE,10))}, fetch:fetchSeq([{status:200,body:{access_token:"A9",refresh_token:"R9",expires_in:3600}},{status:200,body:[PROFILE]}])}); await wait();
    ok(/grant_type=refresh_token/.test(C.calls[0].url),"token a punto de expirar → refresco PROACTIVO antes de la 1ª petición");
    eq(C.calls[1].init.headers.Authorization,"Bearer A9","…y la petición usa el token nuevo");
  }

  console.log("\n[T5] Guardado con cola offline y reintento");
  { const D=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, fetch:fetchSeq([{status:200,body:[PROFILE]}])}); await wait();
    const rec=pickRec(D.api); const st=D.api.repBuildState(rec); st.h.ce="4100555"; D.api.REP_BATCH.push(st);
    D.setFetch(function(){ return Promise.reject(new TypeError("Failed to fetch")); });
    await D.api.misReportes.guardarCal(st);
    eq(st._cloudPending,true,"sin red: el reporte queda pendiente"); eq(D.api.misReportes.pendientes().length,1,"…y en la cola noti_pending_v1");
    ok(!!JSON.parse(D.localStorage._s.noti_pending_v1)[0].payload,"la cola guarda el payload");
    D.setFetch(fetchSeq([{status:201,body:[{id:"cid1",updated_at:"2026-09-16T10:00:00Z"}]}]));
    await D.api.misReportes.flushPending();
    eq(D.api.misReportes.pendientes().length,0,"con red: flushPending vacía la cola"); eq(st._cloudId,"cid1","…y fija _cloudId en el reporte"); eq(st._cloudPending,false,"…y quita el estado pendiente");
    const st3=D.api.repBuildState(rec); st3.h.ce="4100556"; D.api.REP_BATCH.push(st3);
    D.setFetch(fetchSeq([{status:403,body:{code:"42501",message:"rls"}}]));
    await D.api.misReportes.guardarCal(st3);
    eq(D.api.misReportes.pendientes().length,0,"403 (sin permiso) NO se encola"); ok(/permiso/.test(st3._cloudError||""),"…y deja el error legible en el reporte");
    D.setFetch(fetchSeq([{status:200,body:[{id:"cid1",updated_at:"2026-09-16T11:00:00Z"}]}]));
    await D.api.misReportes.guardarCal(st); const u=D.calls[D.calls.length-1];
    ok(u.init.method==="PATCH"&&/id=eq\.cid1/.test(u.url),"re-guardar con _cloudId hace PATCH por id");
    const r=D.api.makeRow("4100002","TRANSMISOR DE PRESION PT-3110","","05/03/2026"); D.api.recompAuto(r);
    D.setFetch(fetchSeq([{status:201,body:[{id:"nid1",updated_at:"2026-09-16T10:00:00Z"}]}]));
    await D.api.misReportes.guardarNoti(r); eq(r._cloudId,"nid1","guardarNoti fija _cloudId en la fila");
    const body=JSON.parse(D.calls[D.calls.length-1].init.body); eq(body.kind,"notificacion","cuerpo kind=notificacion"); ok(body.payload&&body.payload.txt,"cuerpo lleva payload.txt");
  }

  console.log("\n[T6] Usuario pendiente / revocado / sesión inválida");
  { const P2=Object.assign({},PROFILE,{approved:false});
    const E=load({store:{noti_auth_v1:JSON.stringify(cacheFor(P2))}, fetch:fetchSeq([{status:200,body:[Object.assign({},PROFILE,{approved:true})]}])});
    ok(E.els.authPending._classes.has("active"),"perfil pendiente en caché → pantalla 'pendiente'"); eq(E.api._appBooted,false,"…y la app no arranca");
    let e=null; try{ await E.api.misReportes.guardar({kind:"x"},{}); }catch(x){ e=x; } ok(e&&e.status===403,"guardar con cuenta pendiente se rechaza sin llamar a la red");
    await wait(); eq(E.api._appBooted,true,"al revalidar y venir aprobado → arranca la app"); eq(E.els.authGate.hidden,true,"…y se oculta el gate");
  }
  { const F=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, fetch:fetchSeq([{status:200,body:[Object.assign({},PROFILE,{approved:false})]}])}); await wait();
    eq(F.api.CURRENT_USER.approved,false,"revocado en servidor → CURRENT_USER.approved=false"); ok(F.els.authPending._classes.has("active"),"…y vuelve al gate 'pendiente'");
  }
  { const G=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, fetch:fetchSeq([{status:401,body:{code:"PGRST301",message:"JWT expired"}},{status:400,body:{error_code:"refresh_token_not_found",msg:"Invalid Refresh Token"}}])}); await wait(50);
    eq(G.localStorage._s.noti_auth_v1,undefined,"refresh inválido → se borra la sesión cacheada"); eq(G.st.reloaded,1,"…y se recarga la página"); ok(/expiró/.test(G.sessionStorage._s.noti_auth_msg||""),"…con aviso de sesión expirada");
  }
  { const H=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE))}, online:false}); await wait();
    eq(H.api._appBooted,true,"offline con caché aprobada: entra igual"); eq(H.calls.length,0,"…sin intentar la red"); eq(H.els.ubOffline.hidden,false,"…y muestra 'sin conexión'");
  }

  console.log("\n[T7] Sesión local por usuario (owner)");
  { const I=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE)), noti_session_v1:JSON.stringify({v:1,uid:3,currentId:null,rows:[{id:1,ot:"1",denom:"PT-1",tag:"PT-1",fields:{}}],owner:"OTRO"})}, fetch:fetchSeq([{status:200,body:[PROFILE]}])});
    eq(I.api.rows.length,0,"la sesión de OTRO usuario no se carga");
    const J=load({store:{noti_auth_v1:JSON.stringify(cacheFor(PROFILE)), noti_session_v1:JSON.stringify({v:1,uid:3,currentId:null,rows:[{id:1,ot:"1",denom:"TRANSMISOR PT-3110",tag:"PT-3110",fields:{}}],owner:"u1"})}, fetch:fetchSeq([{status:200,body:[PROFILE]}])});
    eq(J.api.rows.length,1,"la sesión del MISMO usuario sí se carga");
  }

  console.log("\n########## RESUMEN: "+pass+" OK, "+fail+" FAIL ##########");
  process.exit(fail?1:0);
})().catch(e=>{ console.log("EXCEPCIÓN EN EL ARNÉS:",e&&e.stack||e); process.exit(1); });
