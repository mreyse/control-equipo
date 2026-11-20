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
/*__ENGINE__*/
