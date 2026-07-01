# Admin/Clinic High-Volume Capacity — Auditoría e implementación propuesta (PR-CAP-1)

> **PR-CAP-1 — docs-only.** Auditoría técnica + propuesta de implementación para que Admin
> administre con solvencia **5000 usuarios de clínica** y Clínica administre **1000 informes**.
> No implementa código. Toda afirmación cita archivo/línea verificados al HEAD base.

---

## 0. Estado base y confirmaciones

| Campo | Valor |
|---|---|
| Fecha | 2026-07-01 |
| Base de referencia | `main @ 5d3a565 feat(admin): adapt users roles server pagination to viewport (#1222)` |
| Alcance | **Docs-only.** Un único archivo Markdown nuevo. |
| Relación con PR-GA-1 | `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` sigue **untracked** en el working tree. Este documento es un archivo independiente y **no debe mezclarse** con PR-GA-1: Nico los commitea/mergea como PRs documentales separados. |
| Modelo | Fable 5 (`claude-fable-5`) |
| Esfuerzo | Máximo |
| Skill principal | `vetneb-production-web-optimization-engineer` |
| Complementarias | `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` · `vetneb-web-end-to-end-global` · `vetneb-staff-senior-full-stack-engineer` |
| Guardrail | `vetneb-security-production-invariants` |
| ZIPs de skills | No se copió, descomprimió, editó ni versionó ningún ZIP/carpeta de skills. |
| Código/CI | No se tocó frontend, backend, tests, DB, auth, API, deps, lockfiles, CI, workflows ni snapshots. Sin `git add/commit/push/gh pr`. |

**Fuentes leídas (solo lectura):** `final-global-vetneb-50-60-pr-roadmap.md`,
`server-adaptive-pagination-strategy.md`, `admin-users-roles-server-adaptive-pagination.md`,
`AdminUsersRolesReadOnlyCard.tsx`, `server/db-admin-users-roles.ts`, `server/lib/list-pagination.ts`,
`dashboard/page.tsx`, `ClinicInformesWorkspaceSummary.tsx`, `frontend/src/lib/api.ts` (funciones
relevantes), `server/routes/reports.fastify.ts`, `dashboard/informes/page.tsx`,
`drizzle/schema.ts` (índices), `frontend/e2e/fixtures/admin-populated-api-server.mjs`.

---

## 1. Resumen ejecutivo con dictamen

**Admin · 5000 usuarios de clínica — PARCIALMENTE CUBIERTO.** La mecánica de servidor es sólida
(runtime único #1222, `limit≤36` adaptativo, `total`/`pageCount`, anti-race, recompute de offset,
cambio de rol in-place que funciona a cualquier profundidad de página). Lo que **no** existe es la
capa que convierte 5000 filas en administración real: **no hay búsqueda server-side de ningún tipo**
(`AdminUsersRolesQuery` sólo acepta `userType`/`role`/`limit`/`offset` —
[db-admin-users-roles.ts:39-44](server/db-admin-users-roles.ts)), la navegación es sólo
Anterior/Siguiente (≈139 páginas de 36), `ORDER BY clinic_users.username` **no tiene índice**
([schema.ts:213-217](drizzle/schema.ts): sólo `clinic_id` y `clinic_id+role`), cada request ejecuta
**dos `count(*)`** ([db-admin-users-roles.ts:158-174](server/db-admin-users-roles.ts)) y el fixture
e2e poblado sirve **29 usuarios** (3 admin + 26 clinic —
[admin-populated-api-server.mjs:476](frontend/e2e/fixtures/admin-populated-api-server.mjs)), por lo
que el volumen 5000 jamás fue ejercitado. Cierre: **búsqueda server-side + fixture 5000 + índices
tras EXPLAIN** (CAP-A1..A6). El cap 36 **no se toca**.

**Clínica · 1000 informes — BACKEND PREPARADO; frontend con dos correcciones puntuales.**
`/api/reports` ya pagina con `limit` (default 50, cap 100), `offset`, `total`, `totalPages` y tiene
`/search` con `query`/`studyType`/`status` scoped por clínica
([reports.fastify.ts:504-539, 553-602](server/routes/reports.fastify.ts)). **Corrección honesta al
enunciado:** la ruta full `/dashboard/informes` **ya usa** `getReportsPaginated`/`searchReportsPaginated`
con searchParams server-side ([informes/page.tsx:227-262](frontend/src/app/dashboard/informes/page.tsx));
no hay que "migrarla", hay que cerrar sus deltas (página fija de 6, navegación profunda, fixtures de
volumen). Los dos defectos reales: (1) el dashboard pide informes **sin `limit`** — el backend
aplica default **50** — y corta a 3 en memoria ([page.tsx:80, 100](frontend/src/app/dashboard/page.tsx)):
payload 16× mayor al necesario en cada carga del dashboard; (2) el summary filtra **in-memory sobre
3 recientes** con 7 campos ([ClinicInformesWorkspaceSummary.tsx:33-54](frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx)),
lo que a 1000 informes es una ilusión de búsqueda. Cierre: **`limit: 3` en dashboard + fixture 1000 +
alineación summary→full route** (CAP-C1..C6).

---

## 2. A — Administrador: 5000 usuarios de clínica

### A.1 Contrato actual confirmado (evidencia por línea)

| Afirmación | Estado | Evidencia |
|---|---|---|
| Runtime único colapsado (desktop `hidden md:flex` + mobile `md:hidden`, un solo fetch) | ✅ | [AdminUsersRolesReadOnlyCard.tsx:432, 679-682](frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx) |
| Usa `useAdaptiveItemsPerPage` (contenedor medido + fila real + descuento de header) | ✅ | :271-278 |
| `USERS_ROLES_SUPERSET_CAP = 36` como techo del `limit` | ✅ | :41, :277 |
| `limit`/`offset` server-side (`query.limit = effectiveLimit`) | ✅ | :284-292 |
| `total`, `pageCount`, `hasNextPage` derivados del snapshot | ✅ | :410-416 |
| Anti-race por request id (`latestRequestRef`, descarte de respuesta vieja) | ✅ | :300-317 |
| Cambio de rol in-place (`setSnapshot(map)`) sin refetch, con realce y auditoría | ✅ | :353-371; backend guard último owner en [db-admin-users-roles.ts:285-306](server/db-admin-users-roles.ts) |
| Recompute de offset al cambiar `effectiveLimit` (clamp contra `total`) | ✅ | :381-401 |
| Piso desktop `minItems=9` (excepción registrada C5 del roadmap global) | ✅ | :262-277 |
| Cap de servidor: `normalizeListPagination` → limit≤100, offset≤100000 | ✅ | [list-pagination.ts:1-4](server/lib/list-pagination.ts) |

### A.2 ¿5000 usuarios quedan realmente cubiertos hoy?

| Dimensión | ¿Cubierto? | Detalle |
|---|---|---|
| **Render** | **Sí** | Nunca se renderizan más de 36 filas; la medición adaptativa fija la cardinalidad. |
| **Red** | **Sí (por página)** | Payload por request ≤36 filas; sin fetch masivo posible (`MAX_LIST_LIMIT=100` de red de seguridad). |
| **Navegación por páginas** | **Parcial** | Sólo Anterior/Siguiente (:420-428). 5000/36 ≈ **139 páginas** secuenciales; no hay salto a página ni a rango. |
| **Búsqueda** | **NO** | `AdminUsersRolesQuery` no tiene ningún parámetro de texto. Encontrar 1 usuario entre 5000 exige paginar a mano. |
| **Filtros server-side existentes** | Sí, sólo `userType`/`role` | :153-156 del backend. A 5000, `role=clinic_staff` sigue devolviendo miles. |
| **Falta** | — | Búsqueda por `username`, `clinicName`, `clinicId`, localidad (`clinicPublicProfiles.locality`, ya joineada en :209). |

**Riesgos técnicos verificados a volumen 5000:**

1. **Offset profundo.** Paginación `OFFSET n` con `ORDER BY username`: Postgres descarta `n` filas
   ordenadas por request. En página 139, `offset≈4968` — con el modelo dual-source (admins primero,
   clinics después, [db-admin-users-roles.ts:178-185](server/db-admin-users-roles.ts)) el offset se
   traslada casi entero a la query de `clinic_users`. Coste O(offset) por request.
2. **`count(*)` repetido ×2.** Cada carga ejecuta `count(*)` sobre `admin_users` y `clinic_users`
   (:158-174). A 5000 filas es tolerable (~ms), pero se ejecuta también en cada cambio de filtro y
   cada re-fetch por resize; con búsqueda (CAP-A3) el count deberá incluir el predicado de búsqueda
   → medición obligatoria en CAP-A2.
3. **`ORDER BY username` sin índice.** `clinic_users` sólo indexa `clinic_id` y `clinic_id+role`
   ([schema.ts:213-217](drizzle/schema.ts)). Orden por `username` a 5000 = sort completo por request
   (top-N heap con LIMIT, pero el sort escanea todo el filtro). `admin_users.username` sí es unique
   (=índice, :223). **Índice propuesto: `clinic_users_username_idx`** — condicionado a EXPLAIN (CAP-A2/A6).
4. **Filtro `role` solo, sin `clinicId`.** `eq(clinicUsers.role, ...)` (:153-156) no puede usar
   `clinic_id_role_idx` (prefijo `clinic_id`) → seq scan del filtro a 5000. Mismo tratamiento: EXPLAIN.
5. **Join `clinics` + `clinicPublicProfiles` por página.** Con LIMIT ≤36 el join se resuelve sobre
   pocas filas si el sort es indexado; sin índice de sort, el planner puede joinear antes de ordenar.
   Verificable sólo con EXPLAIN (CAP-A2) — **NO CONFIRMADO** el plan real.
6. **Riesgo UX (el decisivo).** Navegar 139 páginas de 36 **no es administración real**: la
   capacidad no se logra con más filas por página sino con búsqueda que reduzca el espacio a <2
   páginas. El fixture actual (29 usuarios) nunca expuso este problema.

### A.3 Implementación propuesta (PRs chicos)

Detalle de scope/validaciones/autorización en la tabla §5.

- **CAP-A1 · test-only** — fixture 5000 usuarios: extender
  `frontend/e2e/fixtures/admin-populated-api-server.mjs` con un **generador determinista** (no 5000
  literales) para `/api/admin/users-roles` que honre `userType`/`role`/`limit`/`offset` y `total`
  reales; bloque e2e que asista: `total=5000`, página profunda navegable, ninguna respuesta >36 filas.
  Datos 100% sintéticos: sin nombres reales, sin hashes, sin tokens (guardrail de seguridad).
- **CAP-A2 · docs/backend-read-only** — documento EXPLAIN: correr `EXPLAIN (ANALYZE, BUFFERS)` en
  DB **local de desarrollo** seedeada (no producción, no staging) sobre las 4 queries reales (2
  counts + 2 pages con joins) a 5000 filas; registrar planes y proponer índices concretos
  (`clinic_users_username_idx`; evaluar `clinic_users_role_idx`). **No toca DB versionada**: es
  evidencia para CAP-A6.
- **CAP-A3 · backend/API ⚠** — búsqueda server-side: agregar `query` a `AdminUsersRolesQuery`
  (zod: string recortada, longitud cap ~80, sin regex del usuario). Predicado normalizado
  (`ILIKE`/`unaccent` según decisión CAP-A2) sobre `username`, `clinics.name`, `clinicId` (si es
  numérico) y `clinicPublicProfiles.locality`, aplicado **simétricamente** a las queries de datos y
  a los dos counts (el modelo dual-source obliga a filtrar admin y clinic con el mismo término).
  Tests de contrato backend: resultados, totales coherentes, sanitización, sin cambio de auth.
- **CAP-A4 · frontend** — SearchBar en `AdminUsersRolesReadOnlyCard` (ambas presentaciones del
  runtime único): input debounced conectado a `query`, **reset `offset=0`** en cada cambio (mismo
  patrón que los selects :504-507), integrado al `useMemo` del query (:284-292) para heredar el
  anti-race existente sin código nuevo de carrera; estados vacío/cargando estables.
- **CAP-A5 · test/e2e** — con fixture 5000: búsqueda reduce a <=1 página; **cambio de rol en página
  profunda** (offset alto) mantiene la fila actualizada in-place sin saltar de página; no-scroll
  del módulo intacto (bloque `users` de `admin-mobile-ops-modules-no-scroll.spec.ts` + spec desktop).
- **CAP-A6 · DB ⚠⚠** — migración de índices **sólo** los que CAP-A2 confirme con EXPLAIN
  (candidato principal: `clinic_users_username_idx`). Forward-only, autorización explícita, sin
  mezclar con ningún otro cambio.
- **CAP-A7 · opcional, fuera de ventana** — operaciones bulk de roles: bloqueado hasta que exista
  `useActionPermissions`/action registry (R-43 del roadmap global) + auditoría por ítem. No antes.

### A.4 No-go Admin

- **No cargar 5000 usuarios en memoria** (ni en frontend ni en fixture como respuesta única).
- **No virtualizar como sustituto de server pagination**: la virtualización renderiza lo que ya se
  trajo; el problema es qué se trae y cómo se encuentra.
- **No agregar bulk actions sin permisos centralizados** (R-43) ni auditoría por ítem.
- **No tocar DB sin EXPLAIN previo (CAP-A2) y autorización ⚠⚠** (CAP-A6).
- **No cambiar auth/roles en el mismo PR que la búsqueda**: CAP-A3 no toca `admin-auth`,
  cookies ni el guard de último owner.
- **No subir el cap 36 para "ver más"**: la capacidad se logra con búsqueda + server pagination;
  el cap es contrato del Zero-Scroll híbrido (PR-SRV-0 §5), no un cuello de botella.

---

## 3. B — Clínica: 1000 informes

### B.1 Contrato actual confirmado (evidencia por línea)

| Afirmación | Estado | Evidencia |
|---|---|---|
| Dashboard llama `getReports` y corta con `reports.slice(0, 3)` | ✅ **sin `limit`** — el backend aplica default **50** | [page.tsx:80, 100](frontend/src/app/dashboard/page.tsx); default 50 en [reports.fastify.ts:504](server/routes/reports.fastify.ts); `getReports` acepta `limit` y hoy no se le pasa ([api.ts:500-518](frontend/src/lib/api.ts)) |
| `ClinicInformesWorkspaceSummary` recibe `recentReports` (3) | ✅ | [page.tsx:146-149](frontend/src/app/dashboard/page.tsx) |
| Filtros del summary in-memory (7 campos: report/patient/status/study/file/from/to) | ✅ | [ClinicInformesWorkspaceSummary.tsx:36-54, 115+](frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx) |
| `usePagedRows` pagina localmente (con `useAdaptiveRowsPerPage`, #1216) | ✅ | :6, :23 |
| Backend `/api/reports` acepta `limit`/`offset` y devuelve `total`/`totalPages` | ✅ | [reports.fastify.ts:504-539](server/routes/reports.fastify.ts) |
| Backend `/api/reports/search` con `query`/`studyType`/`status` scoped por clínica | ✅ | :553-602; scope `getReadClinicScope` en :561 |
| Frontend tiene `getReportsPaginated` y `searchReportsPaginated` (page/pageSize→offset, cap 100) | ✅ | [api.ts:570-627](frontend/src/lib/api.ts) |
| **Ruta full `/dashboard/informes` YA es server-paginated con búsqueda server-side** | ✅ (corrige el enunciado) | [informes/page.tsx:227-262](frontend/src/app/dashboard/informes/page.tsx): `searchReportsPaginated` si hay `query`/`studyType`, si no `getReportsPaginated`; `page` por searchParam; links Anterior/Siguiente :637-657; `REPORTS_PAGE_SIZE=6` fijo :51 |
| Índices reports: `clinic_id`, `clinic_id+upload_date`, `clinic_id+study_type`, `clinic_id+current_status`, `status_changed_at` | ✅ | [schema.ts:276-292](drizzle/schema.ts) |
| Fixture e2e clínica devuelve `CLINIC_REPORTS` completo **sin paginar** | ✅ (hueco) | [admin-populated-api-server.mjs:493-494](frontend/e2e/fixtures/admin-populated-api-server.mjs) |

### B.2 ¿1000 informes quedan cubiertos hoy?

- **Summary: correcto como "recientes", incorrecto como administrador.** El summary NO debe
  administrar 1000 — su rol es mostrar recientes y derivar. Hoy cumple lo primero pero con dos
  defectos: el fetch trae 50 para mostrar 3 (payload y serialización 16× superiores en **cada**
  carga del dashboard, la página más visitada del rol), y su FilterBar de 7 campos filtra sobre 3
  filas: a 1000 informes el usuario cree buscar en su historial y busca en 3.
- **Full module `/dashboard/informes`: la superficie de administración real, con base ya correcta.**
  Server-paginated + búsqueda server-side ya operativas. Deltas a 1000: (a) `REPORTS_PAGE_SIZE=6`
  fijo → 167 páginas con sólo Anterior/Siguiente (la cardinalidad adaptativa de esta ruta ya está
  agendada como **R-07** del roadmap global; no se duplica aquí); (b) filtros del summary **no
  alineados** con `/search`: el server soporta texto+`studyType`+`status`, pero no rango de fechas
  ni archivo — los campos `from`/`to`/`file` del summary no tienen equivalente server-side
  (**NO CONFIRMADO** si `searchReports` en `db.ts` matchea `fileName`; verificar en CAP-C4);
  (c) volumen jamás ejercitado: el fixture clínica ignora `limit`/`offset` (evidencia arriba).
- **Rendimiento de búsqueda:** filtros estructurados (status/studyType/fecha) están cubiertos por
  los índices compuestos existentes. La búsqueda por **texto** (`query`) no tiene índice trigram;
  dentro del scope de una clínica (~1000 filas ya reducidas por `reports_clinic_id_idx`) un seq
  scan parcial es probablemente aceptable — **se mide, no se asume** (EXPLAIN en CAP-C6; regla de
  la skill: evidencia sobre suposiciones).

### B.3 Implementación propuesta (PRs chicos)

- **CAP-C1 · frontend** — dashboard pide sólo lo que muestra:
  `getReports(requestOptions, { limit: 3, offset: 0 }, { throwOnError: true })` en
  [page.tsx:80](frontend/src/app/dashboard/page.tsx); `slice(0, 3)` puede quedar como defensa. Nota
  de paridad: `getLogisticsFieldVisits` tiene el mismo patrón slice(0,3) (:90-101) — **NO
  CONFIRMADO** si esa API acepta `limit`; se registra como deuda análoga, fuera de este PR (1 PR =
  1 objetivo).
- **CAP-C2 · test-only** — fixture 1000 informes: la rama clínica del fixture
  ([admin-populated-api-server.mjs:493-494](frontend/e2e/fixtures/admin-populated-api-server.mjs))
  pasa a honrar `limit`/`offset`/`status` y a exponer `total`/`totalPages`, más una rama `/search`
  con `query`/`studyType`; generador determinista de 1000 informes sintéticos (sin datos clínicos
  reales, sin URLs firmadas).
- **CAP-C3 · frontend (re-scoped con honestidad)** — la ruta full ya es server-paginated; este PR
  cierra su navegación profunda: salto a primera/última página (y opcional input de página) sobre
  los links existentes (:637-657), `totalPages` visible, y filtro `reportId` verificado end-to-end.
  Coordinación explícita: **no toca `REPORTS_PAGE_SIZE`** (eso es R-07, cardinalidad adaptativa).
- **CAP-C4 · frontend** — alineación summary→full route: los filtros del summary dejan de fingir
  búsqueda global; se agrega CTA "Buscar en todos los informes" que deep-linkea a
  `/dashboard/informes?query=…&status=…` con el estado del filtro mapeable, y se documenta qué
  campos no tienen equivalente server (`from`/`to`/`file`) con decisión: agregarlos a `/search`
  (backend ⚠, PR aparte) o retirarlos del summary. Reset de página en cada cambio de filtro y
  estados loading/error/empty estables en la full route.
- **CAP-C5 · e2e** — con fixture 1000: búsqueda por texto, filtro `status`, filtro `studyType`,
  navegación profunda (página 167 y última), `totalPages` correcto, no-scroll y geometría estable
  de la full route y del summary.
- **CAP-C6 · DB ⚠⚠** — sólo si el EXPLAIN con dataset 1000 lo confirma: índice trigram
  (`pg_trgm`) sobre las columnas de texto que `searchReports` matchea. Requiere además decisión de
  extensión Postgres (⚠⚠). Los índices estructurados existentes ya cubren listado/filtros.
- **CAP-C7 · opcional, fuera de ventana** — export/bulk de informes: sólo con permisos
  centralizados (R-43) + auditoría de export (advisory §6.15/no-go); no en este bloque.

### B.4 No-go Clínica

- **No convertir el summary en grilla de 1000**: sigue siendo "recientes + derivación".
- **No traer 1000 (ni 50) informes al dashboard para cortar a 3** — CAP-C1 lo elimina.
- **No agregar infinite scroll**: el contrato VETNEB es paginado controlado + zero-scroll.
- **No tocar storage ni report download URLs** en este bloque (`ReportFileActions` intacto).
- **No mezclar subida de informes con navegación/listado** (`AdminReportsUploadPanel`/upload
  clínica fuera de scope).
- **No tocar auth/tenant isolation**: `getReadClinicScope` (:502, :561) es frontera intocable;
  los e2e de CAP-C5 deben re-asertar que una clínica no ve informes de otra (alinea con R-28).

---

## 4. Matriz de riesgos

| Sev | Superficie | Riesgo | Evidencia | Mitigación | PR receptor |
|---|---|---|---|---|---|
| **P1** | Admin Users/Roles | Sin búsqueda server-side: 5000 usuarios = 139 páginas secuenciales; administración inviable | [db-admin-users-roles.ts:39-44](server/db-admin-users-roles.ts); card sin input de texto | Búsqueda `query` backend + SearchBar | CAP-A3, CAP-A4 |
| **P1** | Admin Users/Roles | Volumen 5000 jamás ejercitado: fixture de 29 usuarios | [admin-populated-api-server.mjs:476](frontend/e2e/fixtures/admin-populated-api-server.mjs) | Fixture generador 5000 + e2e | CAP-A1, CAP-A5 |
| **P2** | Admin Users/Roles | `ORDER BY clinic_users.username` sin índice: sort de 5000 por request; degrada con offset profundo | [schema.ts:213-217](drizzle/schema.ts) | EXPLAIN → índice si confirma | CAP-A2 → CAP-A6 |
| **P2** | Admin Users/Roles | Doble `count(*)` por request (y por cada resize que cambie `effectiveLimit`) | [db-admin-users-roles.ts:158-174](server/db-admin-users-roles.ts) | Medir en CAP-A2; si pesa, cachear count por filtro (decisión post-EXPLAIN) | CAP-A2 |
| **P2** | Admin Users/Roles | Filtro `role` sin prefijo `clinic_id` no usa índice compuesto | [schema.ts:214-217](drizzle/schema.ts) + [db-admin-users-roles.ts:153-156](server/db-admin-users-roles.ts) | EXPLAIN; índice sólo si confirma | CAP-A2 → CAP-A6 |
| **P3** | Admin Users/Roles | Join `clinics`+`clinicPublicProfiles` con plan no verificado a 5000 | :201-223; **NO CONFIRMADO** | EXPLAIN documenta el plan | CAP-A2 |
| **P1** | Clínica dashboard | Fetch de 50 informes para mostrar 3, en la página más cargada del rol | [page.tsx:80,100](frontend/src/app/dashboard/page.tsx) + default 50 [reports.fastify.ts:504](server/routes/reports.fastify.ts) | `limit: 3` explícito | CAP-C1 |
| **P1** | Clínica summary | Filtros de 7 campos sobre 3 filas: falsa sensación de búsqueda en el historial | [ClinicInformesWorkspaceSummary.tsx:36-54](frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx) | CTA/deep-link a full route con query server-side | CAP-C4 |
| **P2** | Clínica full route | 1000/6 = 167 páginas sólo con Anterior/Siguiente | [informes/page.tsx:51, 637-657](frontend/src/app/dashboard/informes/page.tsx) | Salto primera/última + (R-07 sube filas/página) | CAP-C3 (+R-07) |
| **P2** | Clínica full route | Volumen 1000 jamás ejercitado; fixture ignora `limit`/`offset` | [admin-populated-api-server.mjs:493-494](frontend/e2e/fixtures/admin-populated-api-server.mjs) | Fixture 1000 paginado + e2e | CAP-C2, CAP-C5 |
| **P2** | Clínica search | Búsqueda por texto sin índice trigram; coste real dentro del scope clínica **NO CONFIRMADO** | [schema.ts:276-292](drizzle/schema.ts) sin índice de texto | EXPLAIN → `pg_trgm` sólo si confirma | CAP-C6 |
| **P3** | Clínica summary/full | Campos `from`/`to`/`file` sin equivalente en `/search` | [reports.fastify.ts:562-565](server/routes/reports.fastify.ts) | Decisión: extender `/search` (⚠) o retirar del summary | CAP-C4 (decisión) |
| **P3** | Clínica dashboard | `getLogisticsFieldVisits` con mismo patrón slice(0,3); `limit` **NO CONFIRMADO** | [page.tsx:90-101](frontend/src/app/dashboard/page.tsx) | Registrar; PR análogo fuera de este bloque | — (deuda registrada) |

---

## 5. Tabla de PRs propuestos

| PR | Tipo | Scope permitido | Prohibido | Validaciones | Autorización | Depende de | ¿Diferencia visual? |
|---|---|---|---|---|---|---|---|
| CAP-A1 | test-only | `frontend/e2e/fixtures/admin-populated-api-server.mjs` (generador 5000), spec/bloque e2e nuevo, doc | Producción, backend, snapshots | e2e dirigido + `pnpm test` + gate global | No | — | No |
| CAP-A2 | docs + read-only | Doc EXPLAIN (queries, planes, índices propuestos); DB local dev seedeada | DB versionada, migrations, staging/prod | Lectura; planes adjuntos en doc | No (read-only local) | CAP-A1 (dataset seed reutilizable) | No |
| CAP-A3 | backend/API | `server/db-admin-users-roles.ts` (+`routes/admin-users-roles.fastify.ts`), zod, tests contrato backend | Auth, cookies, roles, otros endpoints, DB schema | `pnpm test`, `pnpm build`, gate global | **⚠ backend/API** | — (CAP-A2 recomendado antes) | No |
| CAP-A4 | frontend | `AdminUsersRolesReadOnlyCard.tsx` (SearchBar ambas presentaciones), `api.ts` (param `query`), tests source-contract, doc | Otros módulos admin, `globals.css`, backend | Gate global + e2e bloque `users` | No | CAP-A3 | **Sí** (SearchBar visible) |
| CAP-A5 | e2e | Specs e2e users-roles (búsqueda, rol en página profunda, no-scroll) | Producción | e2e ×3 corridas | No | CAP-A1, CAP-A4 | No |
| CAP-A6 | DB | Migración índices confirmados por CAP-A2 (candidato: `clinic_users_username_idx`) | Cualquier otro cambio; mezclar índices no confirmados | `pnpm db:migrate` CI + `schema:verify` + EXPLAIN antes/después | **⚠⚠ DB** | CAP-A2 | No |
| CAP-A7 | opcional | Bulk roles (diferido) | Todo, hasta R-43 + auditoría por ítem | — | **⚠⚠** | R-43 roadmap global | — |
| CAP-C1 | frontend | `dashboard/page.tsx` (sólo el call `getReports` con `{limit:3, offset:0}`) | Summary, full route, visitas, backend | Gate global + e2e hub/informes summary | No | — | No (mismo render, menos payload) |
| CAP-C2 | test-only | Fixture clínica: `/api/reports` paginado + `/search`; generador 1000 | Producción, backend | e2e dirigido + `pnpm test` | No | — | No |
| CAP-C3 | frontend | `dashboard/informes/page.tsx` (salto primera/última, `totalPages` visible, `reportId` verificado) | `REPORTS_PAGE_SIZE` (es R-07), backend, summary | Gate global + e2e full route | No | CAP-C2 | **Sí** (controles de navegación) |
| CAP-C4 | frontend | Summary: CTA/deep-link con query mapeado; full route: reset página + estados estables; doc de decisión `from`/`to`/`file` | Extender `/search` (PR aparte ⚠ si se decide), storage/downloads | Gate global + e2e summary/full | No (la extensión de `/search`, si se decide, sí ⚠) | CAP-C3 | **Sí** (CTA visible) |
| CAP-C5 | e2e | Specs 1000 informes: query/status/studyType, página 167/última, `totalPages`, no-scroll, scope clínica re-asertado | Producción | e2e ×3 corridas | No | CAP-C2, CAP-C3 | No |
| CAP-C6 | DB | Índice trigram sólo si EXPLAIN 1000 lo confirma (+decisión extensión `pg_trgm`) | Cualquier otro cambio | Migración CI + EXPLAIN antes/después | **⚠⚠ DB** | CAP-C5 (dataset) + EXPLAIN | No |
| CAP-C7 | opcional | Export/bulk informes (diferido) | Todo, hasta R-43 + auditoría | — | **⚠⚠** | R-43 roadmap global | — |

Reglas heredadas de `final-global-vetneb-50-60-pr-roadmap.md` §8: 1 PR = 1 objetivo, docs por PR,
plantilla anti-race SRV-1/2 intocada, git manual de Nico. La serie CAP se intercala en la ventana
del roadmap global **sin renumerar R-xx** (es una pista de capacidad paralela; CAP-C3/C4 se
coordinan explícitamente con R-07).

---

## 6. Criterios de aceptación medibles

**Admin (cierre CAP-A):**
- Fixture determinista de **5000** usuarios servible por el fixture API (`total=5000` verificado por e2e).
- Ninguna respuesta de `/api/admin/users-roles` con más de **36** filas (`limit ≤ 36` asertado); cero fetch masivo.
- Búsqueda server-side operativa: un término de username/clinicName/clinicId/localidad reduce el resultado y `total` refleja el filtro.
- Cambio de rol funciona en página profunda (offset > 4900): fila actualizada in-place, sin salto de página, auditado.
- No-scroll del módulo intacto en desktop y mobile (specs existentes verdes).

**Clínica (cierre CAP-C):**
- Fixture determinista de **1000** informes con `limit`/`offset`/`total`/`totalPages`/`/search` honrados.
- Dashboard clínica fetchea informes con `limit=3` (asertable por fixture/e2e: request registrado con `limit=3`).
- Full `/dashboard/informes` navega hasta la página 167 y la última; `totalPages` correcto en UI.
- Filtros `query`/`status`/`studyType` server-side con reset de página; estados loading/error/empty estables.
- No-scroll de summary y full route intactos; scope por clínica re-asertado (cero informes cross-tenant en e2e).

---

## 7. Decisión de arquitectura

1. **Admin 5000 = server pagination (ya existente) + búsqueda server-side + índices medidos.**
   La virtualización NO es la solución principal: no resuelve red, ni counts, ni encontrabilidad.
   El cap híbrido 36 se mantiene como contrato Zero-Scroll (PR-SRV-0 §5); la solvencia la aporta
   la búsqueda, no más filas.
2. **Clínica 1000 = summary limitado (fetch 3) + full module server-paginated como única superficie
   de administración.** El summary deriva; el full route administra. La cardinalidad adaptativa del
   full route es R-07 (roadmap global) y no se duplica en la serie CAP.
3. **Todo trabajo de DB/índices queda bloqueado hasta EXPLAIN documentado (CAP-A2 / dataset CAP-C5)
   y autorización ⚠⚠.** Ningún índice entra "por las dudas"; los planes antes/después son la
   evidencia de cierre.

---

## 8. Roadmap recomendado (orden de ejecución)

| Orden | PR | Razón del orden |
|---|---|---|
| 1 | **CAP-C1** | Máximo impacto/riesgo mínimo: 1 línea de call-site elimina el fetch 16× en la página más visitada. |
| 2 | **CAP-A1 + CAP-C2** | Fixtures de volumen: sin ellos ningún criterio §6 es verificable; habilitan todo lo demás. |
| 3 | **CAP-C3** | Cierra navegación profunda del full route con backend ya listo; coordina con R-07 sin pisarlo. |
| 4 | **CAP-A3 → CAP-A4** | Búsqueda users/roles (backend ⚠ primero, UI después); es la pieza que convierte 5000 en administrable. |
| 5 | **CAP-A5 + CAP-C4 + CAP-C5** | Blindaje e2e sobre datasets de volumen + alineación summary→full. |
| 6 | **CAP-A2 → CAP-A6 / CAP-C6** | DB sólo después de evidencia EXPLAIN y con autorización ⚠⚠. |
| — | CAP-A7 / CAP-C7 | Diferidos a R-43 (permisos centralizados) fuera de esta ventana. |

**Próximo PR exacto tras esta auditoría: CAP-C1.**

---

## 9. Validaciones de cierre de este PR (docs-only)

- `git diff --check` — aplica; sin salida esperada.
- `git status --short --untracked-files=all` — debe mostrar **dos** untracked independientes:
  `?? docs/audit/admin-clinic-high-volume-capacity-implementation-audit.md` (este PR) y
  `?? docs/audit/final-global-vetneb-50-60-pr-roadmap.md` (PR-GA-1, pendiente, **no mezclar**).
- **Único archivo nuevo de este trabajo:** `docs/audit/admin-clinic-high-volume-capacity-implementation-audit.md`;
  cero archivos existentes modificados.
- Sin tests/build: docs-only, sin cambios de código, specs, deps ni manifests (precedente #1208/#1220).
- Sin `git add`, `git commit`, `git push` ni `gh pr create` — cierre manual de Nico por protocolo.

*Documento generado como PR-CAP-1 (docs-only). Toda la evidencia fue verificada por lectura al HEAD
base `5d3a565`; lo no verificable quedó marcado NO CONFIRMADO. No implementa código ni tooling.*
