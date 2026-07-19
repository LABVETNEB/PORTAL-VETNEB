# M06 — Primer caso de uso de application: SLA overdue (Fase B de Logistics)

> **Tipo:** Extracción de caso de uso (application) + puerto mínimo, detrás del
> contrato por-ruta existente. **Cero cambios de comportamiento observable.**
> **Scope primario:** backend runtime + tests + documentación de apoyo.

## 1. Base exacta

- **Rama:** `refactor/backend-modularization-m06-logistics-sla-overdue-use-case`.
- **Base `main` / HEAD:** `3c24154c764979b8314ebb5441066368c2fd510f`
  — test(architecture): close Logistics domain phase (M05) (#1501).
- **Working tree inicial:** limpio · **Índice inicial:** vacío.
- **Documento rector:** `docs/audit/backend-enterprise-modularization-program-audit.md`
  (ID `ARCH-AUDIT-110`), §8 Fase B.

## 2. Autorización

R2 explícita de Nico para M06: "implementar el primer caso de uso Logistics SLA
overdue y sus puertos mínimos, limitado al alcance y archivos propuestos, sin
cambios de contrato HTTP, auth, DB, schema, infraestructura ni milestones
posteriores". No cubre M07+.

## 3. Objetivo

Extraer la consulta de instancias SLA activas overdue de
`GET /api/logistics/sla/overdue` a un caso de uso en
`server/features/logistics/application/`, dependiente de un puerto mínimo de
lectura derivado del seam `LogisticsSlaNativeRoutesOptions`, preservando
exactamente el comportamiento observable actual.

## 4. Scope incluido

- Crear la capa application de Logistics con código real: caso de uso
  `createListOverdueActiveSlaInstances`, puerto `LogisticsSlaReadRepository` y
  barrel `index.ts`.
- Adaptar el handler `/overdue` de `server/routes/logistics-sla.fastify.ts` para
  delegar en el caso de uso (composición del adaptador a nivel plugin desde
  `deps`).
- Test unitario nuevo del caso de uso; actualización del contrato de fuente de la
  ruta; integración existente intacta y verde.
- Documentación: README de application, esta nota y status §8 del rector.

## 5. Scope excluido

- `/policies`, `/instances`, `/summary` siguen llamando a `deps` directamente
  (adelgazarlos es M07+/M16).
- Sin cambios en `db-logistics.ts`, queries, transacciones, schema, migraciones.
- Sin DI container, service locator, repositories genéricos, unit of work, event
  bus, ni archivo nuevo de `infrastructure`.
- Sin puertos para políticas, `/instances` ni `/summary` (sin consumidor real).
- Sin guard nuevo en `test/architecture/**` (la extensión global de guards de
  application corresponde a M11).
- Sin cambios de auth, sesión, permisos, CORS, headers, CI, dependencias.

## 6. Estado previo

- Fase A (dominio) cerrada en M05; `server/features/logistics/application/` era
  docs-only (sólo README).
- El handler `/overdue` invocaba directamente
  `deps.listOverdueActiveClinicSlaInstances(parsed.params)` tras auth → permisos
  → parsing.
- Seam existente: `LogisticsSlaNativeRoutesOptions`
  (`server/routes/logistics-sla.fastify.ts`), con
  `listOverdueActiveClinicSlaInstances?: (params) => Promise<SlaInstance[]>` y
  carga default lazy desde `db-logistics.ts` en `loadDefaultDeps`.

## 7. Diseño del puerto

`server/features/logistics/application/ports/logistics-sla-read-repository.ts`:

- Una sola operación semántica: `listOverdueActiveClinicSlaInstances(input)`.
- Input estructural `ListOverdueActiveSlaInstancesInput<TTargetType extends string>`
  con `clinicId`, `dueAtOrBefore: Date`, `targetType?`, `limit?`, `offset?` —
  espejo tipológico de `ListOverdueActiveClinicSlaInstancesParams` sin importar
  `db-logistics.ts` ni `drizzle/schema.ts`.
- Genérico `TSlaInstance` para el tipo de entidad: preserva las referencias
  reales del adapter (en la ruta se infiere `SlaInstance` y `SlaTargetType` sin
  casts) y no filtra tipos concretos de DB hacia application.
- Cero imports en el archivo (100% tipos propios). Sin `any`.

## 8. Diseño del caso de uso

`server/features/logistics/application/list-overdue-active-sla-instances.ts`:

- Factory `createListOverdueActiveSlaInstances(repository)` → función
  `(input) => Promise<TSlaInstance[]>`.
- Devuelve directamente la promesa del puerto: exactamente una llamada, cero
  estado global, cero mutación de input/resultado, cero clonación, cero parsing,
  cero serialización, cero captura de errores (el error original del puerto
  llega por identidad).
- Unit-testable con `repository stub + input → Promise<instances>` sin Fastify
  ni DB; el test de retorno comprueba identidad (`assert.strictEqual`).

`index.ts` exporta únicamente la superficie M06 (factory + 3 tipos).

## 9. Adaptación desde `LogisticsSlaNativeRoutesOptions`

En `logisticsSlaNativeRoutes`, tras resolver `deps` (inyectadas o default lazy
desde `db-logistics.ts`, que se conserva sin cambios):

```ts
const listOverdueActiveSlaInstances = createListOverdueActiveSlaInstances({
  listOverdueActiveClinicSlaInstances: deps.listOverdueActiveClinicSlaInstances,
});
```

- Se construye una sola vez por registro del plugin (no por request).
- El handler `/overdue` mantiene su secuencia: auth → permisos → parsing → 400
  actual → `await listOverdueActiveSlaInstances(parsed.params)` → serialización
  y envelope actuales.
- No se creó infraestructura paralela: el seam de Options **es** el mecanismo de
  puertos de facto del repositorio (rector §2.5); duplicarlo con DI/adaptadores
  en archivos nuevos está prohibido por el programa corregido.

## 10. Cambios por archivo

- `server/features/logistics/application/ports/logistics-sla-read-repository.ts` — **CREATED** (puerto).
- `server/features/logistics/application/list-overdue-active-sla-instances.ts` — **CREATED** (caso de uso).
- `server/features/logistics/application/index.ts` — **CREATED** (barrel M06).
- `server/features/logistics/application/README.md` — **MODIFIED** (capa deja de ser docs-only).
- `server/routes/logistics-sla.fastify.ts` — **MODIFIED** (import del barrel,
  composición del adaptador, delegación del handler `/overdue`). Handlers de
  `/policies`, `/instances`, `/summary` intactos.
- `test/unit/application/logistics/list-overdue-active-sla-instances.test.ts` — **CREATED**.
- `test/integration/adapters/controllers/logistics-sla-routes-api.test.ts` — **MODIFIED**
  (contrato de delegación M06; ver §12).
- `test/integration/adapters/controllers/logistics-sla-routes-integration.fastify.test.ts` — **UNCHANGED**
  (cobertura existente suficiente; verde sin modificaciones — no se debilitó ni
  eliminó ningún assert).
- `docs/implementation/m06-logistics-sla-overdue-use-case.md` — **CREATED** (esta nota).
- `docs/audit/backend-enterprise-modularization-program-audit.md` — **MODIFIED** (status §8 Fase B).

## 11. Contratos HTTP preservados

`GET /api/logistics/sla/overdue` y `OPTIONS /api/logistics/sla/overdue` sin
cambios: endpoint, prefijo, métodos, status codes (200/400/401/403), payload
(`success/count/instances/pagination/dueAtOrBefore`), textos de error, headers,
CORS, cookies, auth, permisos, scope clínico, fechas ISO, orden de validaciones,
orden observable de efectos, límites de paginación (default 50, cap 100, offset
inválido → 0) y fallback `new Date(now())`. `/policies`, `/instances` y
`/summary` no fueron tocados.

## 12. Tests

- **Unit (nuevo):** forwarding exacto con valores no-default (incluida identidad
  de la instancia `Date` y del input completo), una sola llamada al puerto,
  retorno por identidad sin mutación (`strictEqual` de array, elemento, `Date` y
  objeto anidado), propagación del error original por identidad, y frontera de
  imports de application (escaneo de import specifiers, no texto libre).
- **Contrato de fuente (actualizado):** la ruta importa el caso de uso del
  barrel; el puerto se compone desde `deps` antes de registrar handlers; el
  bloque delimitado del handler `/overdue` delega en el caso de uso y ya no
  contiene `deps.listOverdueActiveClinicSlaInstances`; auth → permisos → parsing
  → consulta en ese orden; la carga default `dbLogistics.listOverdueActiveClinicSlaInstances`
  sigue presente en la zona de composición; las otras tres rutas conservan sus
  llamadas directas a `deps`; application sin imports de HTTP/DB.
- **Integración (sin cambios):** stubs por Options siguen funcionando; 401/
  sesiones/cookie-clear/CORS/OPTIONS/scope/cutoff/paginación/400 verdes. El 403
  por rol es inalcanzable con roles reales (ambos roles tienen
  `canViewLogisticsSla: true`; `normalizeClinicUserRole` normaliza cualquier
  valor desconocido a `clinic_staff`), por lo que no se agregó un test 403 nuevo.

## 13. Validaciones (estados canónicos)

| Gate | Comando | Estado |
| --- | --- | --- |
| 1 — unitario nuevo | `pnpm exec tsx --test test/unit/application/logistics/list-overdue-active-sla-instances.test.ts` | PASSED (5/5) |
| 2 — dirigidos M06 | `pnpm exec tsx --test <unit + api + integración>` | PASSED (31/31) |
| 3 — `pnpm validate:local` | typecheck + typecheck:test + test + build | PASSED (ver reporte) |
| 4 — `pnpm security:public-surface` | — | PASSED (ver reporte) |
| 5 — PR Governance local | requiere evento PR/`workflow_dispatch` con HEAD commiteado | BLOCKED |
| 6 — `git diff --check` | — | PASSED (ver reporte) |
| 7 — scope y artefactos | `git status`/`git diff --name-only`/índice | PASSED (ver reporte) |

Gate 5: el validador (`scripts/governance/pr-governance-validator.mjs`) sólo
soporta `GITHUB_EVENT_NAME=pull_request` (con base/head SHA del evento) o
`workflow_dispatch` (rango `HEAD^..HEAD` ya commiteado). PR Governance requiere
un evento/PR y un HEAD commiteado; las escrituras Git pertenecen a Nico.

## 14. Riesgos residuales

- El contrato de delegación delimita el handler `/overdue` por marcadores de
  fuente (`("/overdue", async` → `app.get("/summary"`); si M16 reordena los
  handlers, esos marcadores deben realinearse en el mismo PR (patrón ya asumido
  por los source-contracts del repo).
- El puerto es estructural y genérico: un cambio de firma en
  `ListOverdueActiveClinicSlaInstancesParams` se propaga por inferencia (falla
  typecheck, no runtime) — comportamiento deseado.
- La capa application aún no tiene guard de arquitectura propio (M11); hasta
  entonces la frontera la fijan el test unitario y el contrato de fuente.

## 15. Rollback independiente

Revert de un único PR: el handler `/overdue` vuelve a invocar
`deps.listOverdueActiveClinicSlaInstances` inline, se retiran los tres archivos
de application, el test unitario y los asserts nuevos del contrato. No depende
de revertir M05 ni afecta `db-logistics.ts`, Options, ni ninguna otra ruta.
Mismo artefacto `dist/index.js` en deploy.

## 16. Estado final

M06 implementado: la capa application de Logistics existe con un caso de uso
real y su puerto mínimo; el handler `/overdue` delega; comportamiento observable
idéntico; gates locales verdes (Governance BLOCKED por diseño hasta que exista
PR).

## 17. Readiness

- **M06: cerrado** (al merge de este PR).
- **M07 (UC route-plans lectura + generate-heuristic): no autorizado y no
  iniciado.** Cada milestone posterior requiere autorización R2 propia.
