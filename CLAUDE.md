# Control de Equipo · Servicios de Colaboración

Página web para controlar **horarios rotativos, guardias, vacaciones/ausencias, festivos y solicitudes** del equipo de Servicios de Colaboración. Propietario: el dueño de la cuenta de GitHub `mreyse`.

> ⚠️ Este repositorio es **público**: no agregar nombres, correos, teléfonos personales, datos de salud ni ningún dato del equipo. Esa información vive solo en Firebase.

- **URL pública:** https://mreyse.github.io/control-equipo/
- **Código:** un solo archivo `index.html` (HTML + CSS + JS, sin build). Publicar = hacer commit y push a `main`; GitHub Pages lo sirve en 1–5 min.
- **Datos:** Firebase Realtime Database (proyecto `control-equipo-e46f2`, plan gratuito Spark). El código **no** contiene datos del equipo; todo se carga de Firebase al iniciar sesión.
- **Idioma:** toda la interfaz y la comunicación con el usuario en **español (México)**.

## Arquitectura

| Pieza | Detalle |
|---|---|
| Autenticación | Firebase Auth, correo/contraseña. Registro libre desactivado; los usuarios los crea el propietario en la consola. |
| Base de datos | `/controlEquipo` (todo el estado de la app en un objeto), `/editors/{uid}` (administradores), `/requests/{pushId}` (solicitudes de usuarios). |
| SDK | firebase compat 10.14.1 desde gstatic (app, auth, database). |
| Caché local | `localStorage` clave `controlEquipo.v2` (solo caché; la fuente de verdad es Firebase). |
| Migraciones | Banderas `S.mig3`, `S.mig4`, `S.mig5` en los datos; se aplican cuando entra un editor. |

### Roles
- **👑 Propietario:** UID `OjirKqjwMNX1xhXs6o3Ww23WsBH2` (constante `EDITOR_UID`). Único que agrega/quita administradores (Ajustes → Administradores).
- **✏️ Administrador:** UID presente en `/editors`. Edita todo y aprueba solicitudes.
- **👁 Solo lectura:** cualquier otro usuario autenticado. No ve alertas/conflictos, ni "Guardias por persona", ni saldos ajenos, ni Reglas/Datos en Ajustes. Puede enviar solicitudes.
- **Vinculación usuario ↔ integrante:** por **correo** (campo Correo de la ficha en Equipo = correo de Firebase Auth). Función `myMember()`.

### Reglas de Firebase vigentes
Ver `database.rules.json`. Resumen: lectura para cualquier autenticado; `/controlEquipo` solo propietario y editores; `/editors` solo propietario; `/requests` crear a su nombre, modificar solo creador o compañero destino (`targetEmail`), nadie puede marcar `Aprobada` salvo editores, no se puede borrar.

## Modelo de datos (`S`)
- `members[]`: `{id,name,group('Colaboración'|'MM'|'Desarrollo'),role,email,phone,color,vacDays,oncall,shifts,fixed:{start,end,days[]}|null}`
- `rotation`: `{anchor:'2026-11-09', order[memberIds], positions[{name,days[7]}], overrides{'mid|YYYY-MM-DD':{shift,note}}, breaks[{memberId,start,end,returnPos,reason}], hours{turno:{start,end}}}`
- `oncall[]` (guardias): `{id,memberId,team('Colaboración'|'MM'),type,start,end,notes}` — semanas lunes a domingo.
- `vacations[]`: `{id,memberId,type,start,end,tStart?,tEnd?,status,requestedAt,notes,fromRequest?}`
- `holidays[]`: festivos de empresa `{date,name}` o desactivación de un oficial `{date,off:true}`.
- `settings`: `{maxOff, defaultDays:18, guardPhones:{Colaboración,MM}, mail:{enabled,fromName,replyTo}}`
- `notices[]` (avisos): `{id,text,from?,to?,createdAt}` — se muestran en Resumen y en el correo semanal.
- `members[].mail` (bool): recibe el correo semanal (apagado por defecto; el propietario decide a quién).
- `/requests`: `kind` = `vac` | `swap` (turno) | `gswap` (guardia); estados: `Pendiente`, `Esperando compañero`, `Por aprobar`, `Aprobada`, `Rechazada`, `Cancelada`.

## Reglas de negocio
- **Rotación semanal (Colaboración, 9 roles):** Mañana, Mutante, Tarde, Oficina 1–6. Cada semana todos bajan una posición; el último pasa a Mañana. El orden de referencia (`rotation.anchor` + `rotation.order`) está en Firebase.
- **Patrón por rol (Lun–Dom):** Mañana L–V; Mutante descansa lunes, Mar–Vie Mutante, sábado Oficina; Tarde: Lun y Mar Oficina, Mié–Vie Tarde; Oficina 1: Lun y Mar Tarde, resto Oficina; Oficina 2–6: L–V Oficina.
- **Horarios:** Mañana 08:00–18:00 · Mutante 10:00–20:00 · Tarde 14:00–22:30 · Oficina 09:00–19:00 · Home office 09:00–19:00. **Todos incluyen 1:30 h de comida**; "Hrs" muestra horas efectivas.
- **MM** (3 integrantes): horario fijo 08:30–18:30 L–V; su propia rotación de guardia.
- Hay integrantes que solo participan en guardias (sin horarios) y uno de Desarrollo sin horarios ni guardias; se controla con `oncall`, `shifts` y `group`.
- **Pausas en la rotación** (`rotation.breaks`): la persona sale del rol durante la pausa, los demás siguen rotando y regresa en el rol indicado (`returnPos`).
- **Rotación de guardias Colaboración:** tantas semanas como integrantes con guardia (vista Guardias = 1 vuelta completa desde la semana actual). MM se adapta a esas mismas semanas.
- **Teléfonos de guardia:** editables en Ajustes (`settings.guardPhones`).
- **Vacaciones:** 18 días hábiles por año; festivos no cuentan. Tipo "Horas extras a cambiar" registra día + horas y no cuenta como ausencia.
- **Festivos:** LFT art. 74 calculados por año + festivos de empresa en Ajustes. En Horarios se muestran como "🎉 Festivo" salvo cambio manual.
- **"Sin cubrir"** solo se marca cuando el rol debería existir ese día (`expectedShift`).

## Correo semanal (viernes 16:00, hora de Monterrey)
- Lo envía **Google Apps Script** desde una **cuenta de Gmail dedicada** (miembro del proyecto de Firebase con rol Visor) que lee Firebase por REST con su token OAuth.
- Código en `mail/Code.gs` + `mail/appsscript.json`. **`mail/Code.gs` se genera** con `python3 tools/build_mail.py`, que copia de `index.html` el motor de horarios y `buildWeeklyEmail()`. Si cambias algo de horarios, guardias o del correo en `index.html`, **regenera `mail/Code.gs`** y avisa al usuario que debe volver a pegarlo en Apps Script.
- Solo se envía a integrantes con `mail === true` y correo registrado. Se activa/pausa en Ajustes → Correo semanal (`settings.mail.enabled`). Ajustes tiene vista previa por persona.
- Funciones de Apps Script: `probar()` (copias a la cuenta del bot), `enviarResumenSemanal()`, `instalarDisparador()`, `quitarDisparador()`.

## Preferencias de diseño del usuario (ya aplicadas)
- Calendario: vista predeterminada **Semana** (también Día y Mes). Ausencias y turnos **sin relleno**, solo línea de color a la izquierda. Guardia + vacaciones de la misma persona en **una sola línea** (🚨🌴).
- Resumen: tarjetas en orden **De guardia hoy · Ausentes hoy · Integrantes · Solicitudes pendientes**; luego Turnos de hoy (3 columnas: Turnos / Oficina / Horario fijo) a la izquierda y Próximas guardias (línea de tiempo) a la derecha; después Ausencias próximas; luego Pendientes/Mis solicitudes y Saldo; Conflictos al final (solo editores).
- Vista móvil: barra de navegación inferior y calendario en lista.

## Flujo de trabajo para cambios
1. Editar `index.html`.
2. Verificar sintaxis JS y probar en navegador headless (Firebase no carga en el sandbox; simular datos con `hydrate()`).
3. Commit en `main` y push. Avisar al usuario que recargue con **Ctrl + F5** en 1–5 min.
4. Si el cambio modifica datos ya guardados (horarios, roles, etc.), agregar una migración con bandera `S.migN` que se aplique al entrar un editor.
5. Si cambian permisos, entregar al usuario el JSON completo de reglas para pegar en Firebase → Realtime Database → Reglas, y actualizar `database.rules.json`.
