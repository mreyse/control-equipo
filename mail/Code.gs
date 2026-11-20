/**
 * Control de Equipo · Correo semanal
 * ARCHIVO GENERADO por tools/build_mail.py — no editar a mano la sección del motor.
 *
 * Se ejecuta en Google Apps Script con la cuenta dedicada de envío.
 * Esa cuenta debe ser miembro del proyecto de Firebase (rol Visor o superior).
 *
 * Funciones para ejecutar desde el editor:
 *   probar()               → envía a ESTA cuenta una copia de prueba de cada correo (no a los destinatarios).
 *   enviarResumenSemanal() → envía el correo a los integrantes marcados en Ajustes → Correo semanal.
 *   instalarDisparador()   → programa el envío automático cada viernes a las 16:00 (hora de Monterrey).
 *   quitarDisparador()     → detiene el envío automático.
 */
const DB_URL = 'https://control-equipo-e46f2-default-rtdb.firebaseio.com';
const TZ = 'America/Monterrey';
const HORA_ENVIO = 16;

let S = null, requests = {};

function leerNodo_(path) {
  const r = UrlFetchApp.fetch(DB_URL + '/' + path + '.json?access_token=' + ScriptApp.getOAuthToken(), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('No se pudo leer Firebase (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));
  return JSON.parse(r.getContentText());
}
function cargar_() {
  S = hydrate(leerNodo_('controlEquipo') || {});
  requests = leerNodo_('requests') || {};
  rotCache = new Map();
}
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function config_() { return Object.assign({ enabled: true, fromName: 'Control de Equipo · Colaboración', replyTo: '' }, (S.settings && S.settings.mail) || {}); }

function enviarResumenSemanal() {
  cargar_();
  const M = config_();
  if (M.enabled === false) { console.log('Envío semanal desactivado en Ajustes.'); return; }
  const hoy = hoy_();
  const dest = S.members.filter(m => m.mail === true && m.email);
  dest.forEach(m => {
    const e = buildWeeklyEmail(m.id, hoy, requests);
    const opt = { to: m.email.trim(), subject: e.subject, htmlBody: e.html, name: M.fromName };
    if (M.replyTo) opt.replyTo = M.replyTo;
    MailApp.sendEmail(opt);
  });
  console.log('Correos enviados: ' + dest.length + ' → ' + dest.map(m => m.email).join(', '));
}

function probar() {
  cargar_();
  const M = config_();
  const yo = Session.getEffectiveUser().getEmail();
  const hoy = hoy_();
  const dest = S.members.filter(m => m.mail === true && m.email);
  if (!dest.length) { console.log('No hay destinatarios marcados en Ajustes → Correo semanal.'); return; }
  dest.forEach(m => {
    const e = buildWeeklyEmail(m.id, hoy, requests);
    MailApp.sendEmail({ to: yo, subject: '[PRUEBA para ' + m.email + '] ' + e.subject, htmlBody: e.html, name: M.fromName });
  });
  console.log('Pruebas enviadas a ' + yo + ': ' + dest.length);
}

function instalarDisparador() {
  quitarDisparador();
  ScriptApp.newTrigger('enviarResumenSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(HORA_ENVIO).nearMinute(0).everyWeeks(1).inTimezone(TZ).create();
  console.log('Envío programado: viernes ' + HORA_ENVIO + ':00 (' + TZ + ')');
}
function quitarDisparador() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'enviarResumenSemanal').forEach(t => ScriptApp.deleteTrigger(t));
}

/* ===== Motor copiado de index.html ===== */
const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const HX = 'Horas extras a cambiar';
const GUARD_PHONES_DEFAULT = { 'Colaboración':'8122823041', 'MM':'8131420542' };
const MEAL_H = 1.5; // 1:30 h de comida por jornada
const NEW_HOURS = () => ({ 'Mañana':{start:'08:00',end:'18:00'}, 'Mutante':{start:'10:00',end:'20:00'}, 'Tarde':{start:'14:00',end:'22:30'}, 'Oficina':{start:'09:00',end:'19:00'}, 'Home office':{start:'09:00',end:'19:00'} });
function blank(){
  return { members:[], oncall:[], vacations:[], holidays:[], notices:[], settings:{ maxOff:2, defaultDays:18 },
    rotation:{ anchor:'2026-11-09', order:[], positions:[], overrides:{}, breaks:[],
      hours:{ 'Mañana':{start:'08:00',end:'18:00'}, 'Mutante':{start:'10:00',end:'20:00'}, 'Tarde':{start:'14:00',end:'22:30'}, 'Oficina':{start:'09:00',end:'19:00'}, 'Home office':{start:'09:00',end:'19:00'} } } };
}
const toArr = v => Array.isArray(v) ? v.filter(x=>x!=null) : (v ? Object.values(v) : []);
function hydrate(d){
  const b = blank();
  const x = Object.assign(b, d, {settings:Object.assign(b.settings, d.settings||{}), rotation:Object.assign(blank().rotation, d.rotation||{})});
  x.members = toArr(x.members).map(m=>Object.assign({}, m, {fixed: m.fixed ? Object.assign({}, m.fixed, {days: toArr(m.fixed.days)}) : null}));
  x.oncall = toArr(x.oncall); x.vacations = toArr(x.vacations); x.holidays = toArr(x.holidays); x.notices = toArr(x.notices);
  const R = x.rotation;
  R.order = toArr(R.order); R.breaks = toArr(R.breaks); R.overrides = R.overrides || {};
  R.positions = toArr(R.positions).map(p=>Object.assign({}, p, {days: toArr(p.days)}));
  R.hours = Object.assign(blank().rotation.hours, R.hours||{});
  return x;
}
const pd = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); };
const fd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const nice = s => { if(!s) return ''; const d = pd(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`; };
const dow = d => (d.getDay()+6)%7; // 0 = lunes
function eachDay(a,b,fn){ const d = pd(a), e = pd(b); while(d<=e){ fn(fd(d), new Date(d)); d.setDate(d.getDate()+1); } }
const _holCache = {};
function nthMonday(y,m,n){ const d=new Date(y,m,1); const off=(8-d.getDay())%7; d.setDate(1+off+(n-1)*7); return fd(d); }
function officialHolidays(y){
  if(_holCache[y]) return _holCache[y];
  const L = [
    [`${y}-01-01`,'Año Nuevo'],
    [nthMonday(y,1,1),'Día de la Constitución'],
    [nthMonday(y,2,3),'Natalicio de Benito Juárez'],
    [`${y}-05-01`,'Día del Trabajo'],
    [`${y}-09-16`,'Día de la Independencia'],
    [nthMonday(y,10,3),'Día de la Revolución'],
    [`${y}-12-25`,'Navidad'],
  ];
  if((y-2024)%6===0 && y>=2024) L.push([`${y}-10-01`,'Transmisión del Poder Ejecutivo']);
  return _holCache[y] = L.map(([date,name])=>({date,name,official:true}));
}
function holidaysOfYear(y){ return [...officialHolidays(y).filter(h=>!(S.holidays||[]).some(c=>c.date===h.date && c.off)), ...(S.holidays||[]).filter(h=>!h.off && h.date.startsWith(y+'-'))].sort((a,b)=>a.date.localeCompare(b.date)); }
function holidayOn(s){ return holidaysOfYear(+s.slice(0,4)).find(h=>h.date===s) || null; }
function businessDays(a,b){ let n=0; eachDay(a,b,(s,d)=>{ if(dow(d)<5 && !holidayOn(s)) n++; }); return n; }
const overlaps = (a1,b1,a2,b2) => a1<=b2 && a2<=b1;
const inRange = (s,a,b) => s>=a && s<=b;
const member = id => S.members.find(m=>m.id===id);
const mName = id => member(id)?.name || '(eliminado)';
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isHX = v => v.type===HX;
function usedDays(mid, year){
  return S.vacations.filter(v=>v.memberId===mid && v.status==='Aprobada' && v.type==='Vacaciones' && v.start.slice(0,4)==String(year))
    .reduce((t,v)=>t+businessDays(v.start,v.end),0);
}
function offOn(dateS, includePending=false){
  return S.vacations.filter(v=>!isHX(v) && (v.status==='Aprobada' || (includePending && v.status==='Pendiente')) && inRange(dateS,v.start,v.end));
}
const SHIFT_COLORS = { 'Festivo':'#fde2e2', 'Mañana':'#f8cbad', 'Mutante':'#c6efce', 'Tarde':'#ffc000', 'Oficina':'#ffffff', 'Home office':'#e58ee0', 'Descanso':'#eceef2' };
const COVER = ['Mañana','Mutante','Tarde'];
function mondayOf(s){ const d=pd(s); d.setDate(d.getDate()-dow(d)); return fd(d); }
function weekIdx(s){ return Math.round((pd(mondayOf(s)) - pd(mondayOf(S.rotation.anchor)))/(7*864e5)); }
const mod = (a,n) => ((a%n)+n)%n;
let rotCache = new Map();
function onBreak(mid, w){ return S.rotation.breaks.some(b=>b.memberId===mid && w>=weekIdx(b.start) && w<=weekIdx(b.end)); }
function lineup(w){
  if(rotCache.has(w)) return rotCache.get(w);
  const R=S.rotation; let L;
  if(w<=0){ const n=R.order.length; L=new Array(n); R.order.forEach((id,i)=>L[mod(i+w,n)]=id); L=L.filter(id=>!onBreak(id,w)); }
  else {
    L = lineup(w-1).slice();
    if(L.length) L.unshift(L.pop());
    L = L.filter(id=>R.order.includes(id) && !onBreak(id,w));
    const back = R.order.filter(id=>!L.includes(id) && !onBreak(id,w))
      .map(id=>({id, pos:(R.breaks.filter(b=>b.memberId===id && weekIdx(b.end)===w-1).map(b=>b.returnPos)[0] ?? 99)})).sort((a,b)=>a.pos-b.pos);
    back.forEach(x=>L.splice(Math.min(x.pos,L.length),0,x.id));
  }
  rotCache.set(w,L); return L;
}
function positionOf(mid, s){ return lineup(weekIdx(s)).indexOf(mid); }
function memberAtPos(p, s){ return lineup(weekIdx(s))[p]; }
function roleShift(mid, s){ const p=positionOf(mid,s); if(p<0) return 'Descanso'; return S.rotation.positions[p].days[dow(pd(s))] || 'Descanso'; }
function shiftOf(mid, s){ const o=S.rotation.overrides[mid+'|'+s]; return o ? o.shift : (holidayOn(s) ? 'Festivo' : roleShift(mid,s)); }
function workHours(a,b){ return Math.max(0, hoursBetween(a,b) - MEAL_H); }
function shiftHours(sh){ const h=S.rotation.hours[sh]; return h ? workHours(h.start,h.end) : 0; }
function hoursBetween(a,b){ const [h1,m1]=a.split(':').map(Number),[h2,m2]=b.split(':').map(Number); let x=(h2*60+m2)-(h1*60+m1); if(x<0) x+=1440; return x/60; }
function guardPhone(team){ const p=(S.settings.guardPhones||{})[team]; return (p!=null && p!=='') ? p : (GUARD_PHONES_DEFAULT[team]||''); }
function fmtPhone(p){ const d=String(p).replace(/\D/g,''); return d.length===10 ? `${d.slice(0,2)} ${d.slice(2,6)} ${d.slice(6)}` : p; }
function nextMonday(today){ const d=pd(today); d.setDate(d.getDate()+(7-dow(d))); return fd(d); }
function memberDay(mid, s){
  const m=member(mid); if(!m) return {label:'', hours:'', h:0};
  const vac=S.vacations.find(v=>v.memberId===mid && v.status==='Aprobada' && !isHX(v) && inRange(s,v.start,v.end));
  if(vac) return {label:vac.type, hours:'', h:0, kind:'off'};
  const o=S.rotation.overrides[mid+'|'+s];
  let sh = o ? o.shift : null;
  if(!sh){
    if(S.rotation.order.includes(mid)) sh = shiftOf(mid,s);
    else if(holidayOn(s)) sh='Festivo';
    else if(m.fixed && m.fixed.days.includes(dow(pd(s)))) return {label:'Horario fijo', hours:`${m.fixed.start} – ${m.fixed.end}`, h:workHours(m.fixed.start,m.fixed.end), kind:'work'};
    else sh='Descanso';
  }
  if(sh==='Descanso') return {label:'Descanso', hours:'', h:0, kind:'rest'};
  if(sh==='Festivo') return {label:'Festivo · '+((holidayOn(s)||{}).name||''), hours:'', h:0, kind:'rest'};
  const hh=S.rotation.hours[sh];
  return {label:sh, hours:hh?`${hh.start} – ${hh.end}`:'', h:shiftHours(sh), kind: COVER.includes(sh)?'cover':'work'};
}
function activeNotices(a, b){ return (S.notices||[]).filter(n=>(!n.from||n.from<=b) && (!n.to||n.to>=a)); }
function buildWeeklyEmail(mid, today, reqs){
  const m=member(mid); const ws=nextMonday(today); const we=fd(new Date(pd(ws).getTime()+6*864e5));
  const days=[...Array(7)].map((_,i)=>fd(new Date(pd(ws).getFullYear(),pd(ws).getMonth(),pd(ws).getDate()+i)));
  const first=(m.name||'').split(' ')[0];
  const C={ink:'#1d2433',mut:'#6b7385',line:'#e3e7ee',red:'#b42318',redbg:'#fde8e8',warn:'#8a5a00',warnbg:'#fff4dc',blue:'#1f4fb8',bluebg:'#e8f0fe',ok:'#17663a'};
  const myGuardWeek=S.oncall.find(g=>g.memberId===mid && overlaps(g.start,g.end,ws,we));
  const rowsD=days.map((s,i)=>{ const d=memberDay(mid,s); const dt=pd(s);
    const tag = d.kind==='cover' ? `<span style="background:${SHIFT_COLORS[d.label]||'#eee'};padding:1px 8px;border-radius:6px">${esc(d.label)}</span>` : esc(d.label);
    return `<tr style="color:${d.kind==='rest'||d.kind==='off'?C.mut:C.ink}"><td style="padding:6px 0;border-bottom:1px solid ${C.line}">${DAYS[i]} ${dt.getDate()}</td><td style="padding:6px 0;border-bottom:1px solid ${C.line}">${tag}</td><td style="padding:6px 0;border-bottom:1px solid ${C.line};text-align:right">${esc(d.hours)}</td></tr>`; }).join('');
  const totalH = days.reduce((t,s)=>t+memberDay(mid,s).h,0);
  const pos = S.rotation.order.includes(mid) ? positionOf(mid,ws) : -1;
  const roleName = pos>=0 ? S.rotation.positions[pos].name : (m.fixed?'Horario fijo':'');
  const nextG = S.oncall.filter(g=>g.memberId===mid && g.end>=today).sort((a,b)=>a.start.localeCompare(b.start)).slice(0,3);
  const wk = s => Math.round((pd(mondayOf(s))-pd(ws))/(7*864e5));
  const R = Object.entries(reqs||{}).map(([id,r])=>Object.assign({id},r)).filter(r=>r.memberId===mid && ['Pendiente','Esperando compañero','Por aprobar'].includes(r.status));
  const inc = Object.entries(reqs||{}).map(([id,r])=>Object.assign({id},r)).filter(r=>r.targetMemberId===mid && r.status==='Esperando compañero');
  const yr=ws.slice(0,4), tot=m.vacDays??S.settings.defaultDays, used=usedDays(mid,yr);
  const lu = lineup(weekIdx(ws));
  const coverTxt = ['Mañana','Mutante','Tarde'].map(r=>{ const i=S.rotation.positions.findIndex(p=>p.name===r); return i>=0&&lu[i]?`${r}: ${esc(mName(lu[i]).split(' ')[0])}`:''; }).filter(Boolean).join(' · ');
  const gTeam = ['Colaboración','MM'].map(t=>{ const g=S.oncall.find(x=>(x.team||'Colaboración')===t && overlaps(x.start,x.end,ws,we)); return `Guardia ${t}: ${g?esc(mName(g.memberId)):'sin asignar'} · ${esc(fmtPhone(guardPhone(t)))}`; }).join('<br>');
  const aus = S.vacations.filter(v=>v.status==='Aprobada' && !isHX(v) && overlaps(v.start,v.end,ws,we)).map(v=>`${esc(mName(v.memberId))} (hasta ${nice(v.end)})`);
  const hols = days.map(s=>holidayOn(s)).filter(Boolean);
  const nots = activeNotices(ws,we);
  const sec = (t, body) => `<p style="margin:18px 0 6px;font-size:15px;font-weight:bold;color:${C.ink}">${t}</p>${body}`;
  const sameM = pd(ws).getMonth()===pd(we).getMonth();
  const subject = `Tu semana del ${pd(ws).getDate()}${sameM?'':' de '+MONTHS[pd(ws).getMonth()].toLowerCase()} al ${pd(we).getDate()} de ${MONTHS[pd(we).getMonth()].toLowerCase()}${roleName?' · '+roleName:''}${myGuardWeek?' + Guardia':''}`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6f9;padding:20px"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid ${C.line};border-radius:12px;padding:22px;color:${C.ink};font-size:14px;line-height:1.55">
    <p style="margin:0;font-size:20px;font-weight:bold">Hola, ${esc(first)}</p>
    <p style="margin:4px 0 0;color:${C.mut}">Tu resumen para la semana del lunes ${nice(ws)} al domingo ${nice(we)}.</p>
    ${myGuardWeek?`<div style="margin-top:16px;background:${C.redbg};border:1px solid #f3b4b4;border-radius:8px;padding:10px 14px;color:${C.red}"><b>🚨 Tienes guardia esta semana</b><br>${esc(myGuardWeek.team||'Colaboración')} · ${nice(myGuardWeek.start)} al ${nice(myGuardWeek.end)} · Teléfono de guardia ${esc(fmtPhone(guardPhone(myGuardWeek.team||'Colaboración')))}</div>`:''}
    ${inc.length?`<div style="margin-top:12px;background:${C.warnbg};border-radius:8px;padding:10px 14px;color:${C.warn}"><b>🔄 Tienes ${inc.length} solicitud(es) de intercambio esperando tu respuesta.</b> Entra a la página para aceptar o rechazar.</div>`:''}
    ${hols.length?`<div style="margin-top:12px;background:#fde2e2;border-radius:8px;padding:10px 14px;color:${C.red}">🎉 Día festivo: ${hols.map(h=>`${esc(h.name)} (${nice(h.date)})`).join(', ')}</div>`:''}
    ${sec(`Tu horario${roleName?' · '+esc(roleName):''}`, `<table style="width:100%;border-collapse:collapse;font-size:13px">${rowsD}</table><p style="margin:6px 0 0;font-size:12px;color:${C.mut}">Incluye 1:30 h de comida por jornada · ${String(Math.round(totalH*10)/10).replace('.',',')} h efectivas en la semana.</p>`)}
    ${m.oncall!==false?sec('Tus próximas guardias', nextG.length?`<p style="margin:0;font-size:13px;color:${C.mut}">${nextG.map(g=>{ const w=wk(g.start); return `${nice(g.start)} – ${nice(g.end)} (${w<=0?'esta semana':w===1?'la siguiente':'en '+w+' semanas'})`; }).join('<br>')}</p>`:`<p style="margin:0;font-size:13px;color:${C.mut}">No tienes guardias próximas registradas.</p>`):''}
    ${sec('Tus solicitudes y vacaciones', `<p style="margin:0;font-size:13px;color:${C.mut}">${R.map(r=>`${r.kind==='vac'?esc(r.type)+' '+nice(r.start)+(r.end&&r.end!==r.start?' – '+nice(r.end):''):(r.kind==='swap'?'Intercambio de turno':'Intercambio de guardia')} · <span style="color:${C.warn}">${esc(r.status)}</span>`).join('<br>')}${R.length?'<br>':''}Saldo ${yr}: ${tot-used} de ${tot} días hábiles disponibles.</p>`)}
    <div style="border-top:1px solid ${C.line};margin-top:18px">
    ${sec('Del equipo la próxima semana', `<p style="margin:0;font-size:13px;color:${C.mut}">${coverTxt?coverTxt+'<br>':''}${gTeam}${aus.length?'<br>Ausentes: '+aus.join(', '):''}</p>`)}
    ${nots.length?`<div style="margin-top:12px;background:${C.bluebg};border-radius:8px;padding:10px 14px;color:${C.blue}"><b>📣 Avisos</b><br>${nots.map(n=>esc(n.text)).join('<br>')}</div>`:''}
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:${C.mut}">Consulta todo en <a href="https://mreyse.github.io/control-equipo/" style="color:${C.blue}">mreyse.github.io/control-equipo</a>. Este correo se envía automáticamente cada viernes.</p>
  </div></div>`;
  return {subject, html};
}
