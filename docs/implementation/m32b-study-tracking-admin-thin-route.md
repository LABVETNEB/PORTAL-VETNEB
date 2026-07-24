# M32b — Study Tracking admin thin route

## Estado y alcance

- Milestone: M32b de Fase G.
- Base exacta: `d48ae11dd1c4080fb81bfc8e1025ddd0ae914419`.
- Rama:
  `refactor/backend-modularization-m32b-study-tracking-admin-thin-route`.
- Instrucciones aplicables: `AGENTS.md` raíz; no existen `AGENTS.md` anidados.
- M31: cerrado.
- M32: cerrado en PR #1566.
- M32b: implementado localmente.
- M33: no iniciado.

El cambio adelgaza exclusivamente
`server/routes/admin-study-tracking.fastify.ts`. Las rutas clínica y particular
permanecen byte-identical. No se modifican dominio, infraestructura,
repository/shim, DB, auth, email, auditoría concreta, CORS, schema,
dependencias, frontend ni workflows.

## Censo de transporte

La superficie conserva siete endpoints funcionales y cinco OPTIONS:

| Método | Path | Semántica |
| --- | --- | --- |
| GET | `/notifications` | lista global o filtrada por clínica |
| PATCH | `/notifications/:notificationId/read` | acknowledge global |
| PATCH | `/notifications/read-all` | global o clinic-scoped |
| POST | `/` | crea para la clínica explícita |
| GET | `/` | lista global o clinic-scoped |
| GET | `/:trackingCaseId` | resuelve global o clinic-scoped |
| PATCH | `/:trackingCaseId` | actualiza global o clinic-scoped |
| OPTIONS | `/` | preflight |
| OPTIONS | `/notifications` | preflight |
| OPTIONS | `/notifications/:notificationId/read` | preflight |
| OPTIONS | `/notifications/read-all` | preflight |
| OPTIONS | `/:trackingCaseId` | preflight |

Los 22 campos públicos de `AdminStudyTrackingNativeRoutesOptions` se
preservan. Una inyección completa evita cargar defaults; los defaults se
resuelven una vez por registro del plugin, nunca por request.

## Arquitectura antes y después

Antes, los handlers coordinaban directamente persistencia Study Tracking,
referencias, vínculo token/informe, reglas de entrega, timestamps de etapa,
notificaciones, email best-effort y auditoría. La ruta tenía 1244 LOC, 39843
bytes, 10 declaraciones de import y 16 call sites directos al repository Study
Tracking desde handlers.

Después:

- la ruta conserva CORS/trusted-origin, auth y sesión admin, parsing,
  validación HTTP/Zod, actor y contexto HTTP de auditoría, mapping de
  resultados, serialización, status/payload, timers y logging;
- `createAdminStudyTrackingOperations` compone los casos de uso M31 y posee la
  coordinación create/update;
- `AdminStudyTrackingReferenceRepository` modela sólo clínica, informe global,
  token particular y actualización del vínculo token/informe;
- los puertos M31 de query, command, notificaciones y auditoría se reutilizan;
- `loadAdminStudyTrackingPersistence()` selecciona nueve operaciones desde el
  barrel canónico `infrastructure/index.ts`;
- la composición ocurre una vez por registro del plugin;
- la ruta queda en 848 LOC, 25326 bytes y 10 declaraciones de import;
- los call sites directos al repository Study Tracking desde handlers quedan
  en cero.

La reducción es de 396 LOC, equivalente a 31,83 %. Mantener el mismo número de
imports no oculta dependencias: se eliminan los imports de dominio para
orquestación y cualquier acceso a shim/infra desde la ruta, sustituidos por el
barrel público de application.

## Operaciones admin

La superficie application expone:

1. `listAdminStudyTrackingNotifications`;
2. `acknowledgeAdminStudyTrackingNotification`;
3. `acknowledgeAllAdminStudyTrackingNotifications`;
4. `listAdminStudyTrackingCases`;
5. `resolveAdminStudyTrackingCase`;
6. `createAdminStudyTrackingCase`;
7. `updateAdminStudyTrackingCase`.

Las operaciones simples forman una frontera administrativa cohesiva. Create y
update coordinan referencias, ownership, dominio, persistencia, vínculo,
notificaciones, email y auditoría, con resultados discriminados para los
errores esperables y sin status HTTP.

## Contratos preservados

La autoridad continúa siendo admin global. `clinicId` sigue siendo opcional:
su ausencia usa consultas globales y su presencia selecciona consultas
clinic-scoped. Create usa la clínica explícita validada. Mark-one continúa
global y read-all conserva ambos modos. No se agrega sesión clínica, permiso
nuevo ni RLS.

PATCH mantiene la precedencia contractual:

1. trusted-origin;
2. auth admin;
3. parse de `trackingCaseId`;
4. selección de `clinicId` desde body raw con precedencia sobre query;
5. resolución global o clinic-scoped de `current`;
6. 404 si no existe;
7. validación Zod del body;
8. 400 si el body es inválido;
9. operación application de actualización.

Esta separación deliberada en resolución y actualización evita cambiar 404 por
400. Parsing de Fastify y Zod no entra en application.

Create preserva el orden: referencias y ownership, reglas de entrega, creación,
vínculo token/informe, notificación de tinción, timestamp/fallback, email
best-effort, auditoría del caso y auditoría de la notificación.

Update preserva: referencias y ownership, cálculo condicional de entrega,
defaults de etapa, update, vínculo, notificación/timestamp/email de tinción
requerida, notificación resuelta, notificación de etapa, auditoría del caso y
auditorías de las notificaciones en su orden histórico. Se conservan mensajes,
labels, flecha `→`, metadata, null/undefined, fallback y propagación de errores.

El email continúa siendo best-effort. Sólo se captura el fallo del envío; no
hay retry, queue, outbox, compensación ni persistencia adicional. Los logs no
agregan destinatarios ni datos sensibles. Application recibe el contexto HTTP
de auditoría como valor opaco y usa el puerto M31; no importa la implementación
concreta.

## Evidencia ejecutable

- Unit tests de operaciones admin: **PASSED**, 19/19.
- Guard M32b: registry exacto, Options, imports/barrels, handlers thin,
  composición, consumidores, rutas protegidas y ausencia de M33: **PASSED**,
  9/9.
- Integración admin: todos los endpoints y OPTIONS, 200/201/204/400/401/403/404,
  CORS/trusted-origin, sesión ausente/inválida/expirada, clear-cookie,
  paginación, scopes, ownership, precedencia PATCH, notificaciones, email,
  auditoría y serialización: **PASSED**, 16/16.
- Guards existentes de application, infrastructure, suite completeness,
  auditoría, actor, ownership, validation cutoff, mutaciones y atribución se
  actualizan sólo donde el ancla legítima pasó de route a application.
- Las integraciones clínica/particular y sus hashes protegen la regresión M32.

Resultados finales:

- cohorte dirigida: **PASSED**, 258 pass, 0 skip, 0 fail;
- `pnpm typecheck`: **PASSED**;
- `pnpm typecheck:test`: **PASSED**;
- `pnpm validate:local`: **PASSED**, 3668 pass, 1 skip, 0 fail; build
  **PASSED**;
- `pnpm security:public-surface`: **PASSED**;
- `git diff --check`: **PASSED**.

La primera ejecución de `validate:local` terminó **FAILED** por un fallo
file-level transitorio de
`test/unit/ui/public/frontend-public-seo-contract.test.ts`, fuera del scope
M32b. El test pasó 11/11 aislado sin cambios y la repetición completa quedó
**PASSED** con el conteo anterior.

## Allowlist real y excepción justificada

El diff se limita al allowlist productivo, documentación y tests M32b de la
consigna. El único path adicional es
`test/architecture/study-tracking-clinic-particular-thin-routes.test.ts`: su
guard M32 anterior exigía que la ruta admin permaneciera en el hash pre-M32b.
Se actualiza para seguir protegiendo únicamente las rutas clínica y particular
byte-identical; no se debilitan sus invariantes.

## Riesgos y rollback

El riesgo principal es alterar orden, precedencia o fallback al separar la
coordinación. Se mitiga con call logs unitarios, resultados por identidad,
tests de mensajes/metadata, integración HTTP y guards AST/source-only. No hay
cambio de datos, SQL, schema ni dependencia.

Rollback: revertir el commit M32b restaura la coordinación inline y retira la
superficie application/puerto/composición admin. No requiere migración,
compensación ni reparación de datos.
