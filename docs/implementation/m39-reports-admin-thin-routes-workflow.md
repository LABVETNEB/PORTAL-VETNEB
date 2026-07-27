# M39 — Reports admin thin routes + workflow

## Identificación

- Milestone: M39.
- Rama:
  `refactor/backend-modularization-m39-reports-admin-thin-routes-workflow`.
- Baseline exacto: `67739dd695db444a6fb6fae2be75738ff8a27f3e`.
- Predecesor: M38 / PR #1577.
- Riesgo: R2 estructural backend autorizado específicamente para M39.
- Git/GitHub: stage, commit, push, PR y merge reservados a Nico.
- M40 y M41: `NOT_RUN`.

## Scope y censo

M39 adelgaza exclusivamente `admin-reports.fastify.ts` y
`admin-report-workflow.fastify.ts`. No modifica `fastify-app.ts`, rutas
clínicas, domain M36, comandos M38, adapters M37, schema, migraciones,
dependencias, CI ni frontend.

Clasificación source-aware:

- A: guards y contratos cuyos anchors de coordinación se movieron desde rutas
  o `server/db-report-workflow.ts` hacia application, composition o
  infrastructure;
- B: `report-route-service.test.ts` y
  `reports-admin-thin-routes.test.ts`;
- C: integraciones HTTP, auth, CORS, CSRF, timing, M36–M38 y adapters M37; sus
  expectativas semánticas permanecen.

## Arquitectura antes y después

Antes, las rutas resolvían defaults concretos y coordinaban storage,
persistencia, Particular Token, Study Tracking, notificaciones y auditoría. El
workflow administrativo consultaba y actualizaba DB desde
`server/db-report-workflow.ts`.

Después:

```text
route HTTP
  → composition lazy
    → application/report-route-service.ts
      → operaciones inyectadas
    → infrastructure/db-report-workflow.ts
```

`createReportRouteService` expone signed preview, signed download, upload
administrativo, listado workflow, cambio de stage y cambio de special stain.
Application no conoce Fastify, status codes, DB, Drizzle, schema runtime,
storage o audit concretos. El contexto de auditoría entra como valor opaco.

`report-route-composition.ts` es el único bridge M39. Reutiliza
`createOrEditReport` y `getReportById` M38, inyecta
`createReportWorkflowNotification` M37 y carga defaults concretos de forma
lazy. La inyección completa por Options no carga esos defaults.

`db-report-workflow.ts` conserva selección, ISO/nullability, joins,
`normalizeListPagination`, default 20, máximo 21, orden por `uploadDate`,
`createdAt` e `id` descendentes, limit/offset, lookup `limit(1)`, timestamps,
reload y mensajes. La comunicación M37 se inyecta y permanece best-effort.

`server/db-report-workflow.ts` queda como shim de re-export sin queries,
mapping, DB ni side effects, pendiente de retiro en M41.

## Contratos preservados

Options públicas:

- `AdminReportsNativeRoutesOptions`: mismos campos y firmas, incluido
  `upsertReport`;
- `AdminReportWorkflowNativeRoutesOptions`: mismos campos y firmas.

Prefijos:

- `/api/admin/reports`;
- `/api/admin/report-workflow`.

Endpoints:

- `OPTIONS /upload`;
- `GET /:reportId/preview-url`;
- `GET /:reportId/download-url`;
- `POST /upload`;
- `OPTIONS /`;
- `OPTIONS /:id/stage`;
- `OPTIONS /:id/special-stain`;
- `GET /`;
- `PATCH /:id/stage`;
- `PATCH /:id/special-stain`.

Se preservan CORS, preflight, trusted origin, auth y session last-access,
cookies, multipart/Multer, MIME y límite, parsing, status codes, payloads,
mensajes exactos, serialización segura, timer, request logging y ausencia de
limiter local.

## Orden de side effects

Upload:

```text
trusted origin → resolve → auth → multipart → IDs → clinic → file → token
→ ownership → storage → metadata M36 → createOrEditReport M38
→ Particular Token / Study Tracking → report_delivered attempt
→ REPORT_UPLOADED audit → 201
```

Con token se conserva tracking por token, fallback por report, update del
token, fallback local si retorna null y ensure con autoría admin/clinic.
Sin token no se crea tracking; sólo se lleva a delivered uno ya existente y
no-delivered.

`report_delivered` conserva payload exacto, no se duplica si la etapa previa ya
era delivered y captura únicamente su propio error con logging seguro.

Workflow:

```text
trusted origin → auth → validación HTTP → read → update → reload
→ comunicación M37 best-effort → audit → 200
```

La auditoría conserva eventos, metadata y request-like distintos de upload y
workflow. Errores inesperados de storage, DB y audit se propagan.

## Guards y validación

Los guards se realinean al owner nuevo sin aceptar rutas alternativas, reducir
conteos o debilitar expectativas. El guard M39 exige topología, fronteras,
Options, endpoints, shim temporal, ausencia de consumidores runtime legacy y
M40 ausente.

Estados actuales:

- tests B M39: `PASSED` (23/23, exit code 0);
- cohorte dirigida completa: `PASSED` (171/171, exit code 0);
- `pnpm validate:local`: `PASSED` (typecheck, typecheck:test, 3.829
  tests passed, 1 skipped, 0 failed, y build; exit code 0);
- `pnpm security:public-surface`: `PASSED` (exit code 0);
- `pnpm audit --prod`: `PASSED` (sin vulnerabilidades conocidas, exit code
  0);
- `pnpm audit`: `PASSED` (sin vulnerabilidades conocidas, exit code 0);
- `git diff --check`: `PASSED` (exit code 0);
- schema, migraciones, DB real, Playwright, staging y producción: `NOT_RUN`.

Durante fail-fast, la primera cohorte dirigida detectó siete anchors históricos
desactualizados. Tras realinearlos al owner M39, el foco específico pasó 36/36
y la repetición completa pasó 171/171. El primer `validate:local` ejecutado
completamente detectó errores de tipos, y el siguiente siete anchors adicionales
en la suite global; corregidas esas fronteras, la repetición final quedó en
`PASSED`.

## Riesgos y rollback

El riesgo residual se concentra en equivalencia de wiring y en anchors
source-aware; las integraciones HTTP y call logs cubren comportamiento y orden.
No se agrega compensación por storage, retry, queue ni outbox.

Rollback: restaurar coordinación en las dos rutas y la implementación en el
shim, retirar los tres archivos M39, sus exports, tests y realineaciones. No
requiere schema, migraciones ni cambios de datos.

## Estado final

Implementación local validada. Git/GitHub manuales permanecen `NOT_RUN`.
