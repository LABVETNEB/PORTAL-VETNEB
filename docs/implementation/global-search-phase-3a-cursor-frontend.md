# GLOBAL-SEARCH-3A-CURSOR · Paginación por cursor (frontend)

## 1. Estado base

- Base: `origin/main@7852f88e256a940cf50f76b80149e12611516c51` (#1971, backend de cursores, fusionada).
- Rama: `feat/global-search-3a-cursor-frontend`, desde el worktree `C:\PORTAL-VETNEB-MAIN-LOCAL` (limpio salvo `frontend/AGENTS.md`, generado por `next dev`, sin tocar). El trabajo de Visitas en `C:\PORTAL-VETNEB` no se tocó.
- Scope primario: **frontend runtime** (+ su E2E, tests y realineaciones). Sin backend, migraciones, variables de entorno, workflows ni dependencias.

## 2. Contrato frontend

| | Antes (#1970) | Ahora |
| --- | --- | --- |
| Petición | `offset` ≤ 500 por entidad | primera ventana sin `cursor` (y sin `offset`); continuación `cursor=<nextCursor>` de **esa** entidad |
| Tipo | `GlobalSearchRequest` con `offset: number` | `GlobalSearchRequest = base & GlobalSearchPosition`, unión discriminada `{ offset } \| { cursor }`: el compilador impide combinarlos |
| Grupo | `{ kind, returned, hasMore }` | `+ nextCursor: string \| null`, normalizado en `api.ts`: string sólo si `hasMore` |
| Alcance | 525 registros por entidad, aviso «afiná la búsqueda» | **sin tope**: hasta `hasMore = false` |

- `buildGlobalSearchQueryString` lanza (no envía) un cursor con ≠ 1 entidad efectiva, vacío o > 512 caracteres; con cursor nunca escribe `offset`.
- Los demás consumidores (sugerencias de la barra, `useDashboardGlobalSearch`) siguen en la rama `offset` sin cambios.
- `searchDashboardGlobal` traduce **sólo** `400 "Cursor de búsqueda inválido"` de una petición **con cursor** a `GlobalSearchCursorRejectedError`; 401, 403, 429 y cualquier otro 400 conservan su tipo (`ApiResponseError`, `RateLimitError`).
- `credentials: include`, `cache: "no-store"` y versión de cliente sin cambios. Cursores sólo en memoria: nunca en `localStorage`, `sessionStorage`, cookies ni URL de la app.
- Corrección acotada en `apiFetch`: el aviso de desarrollo de error de red imprimía la ruta completa (con `q` y, en una continuación abortada, el cursor); ahora sólo el path.

## 3. Paginador por cursores (`lib/global-search-pager.ts`)

Cada flujo por entidad guarda: `kind`, `buffer` (filas leídas no paginadas, en orden del servidor), `cursor` (continuación), `started`, `exhausted` y `stalled`. El estado global guarda `emitted` (claves `kind:id` ya paginadas).

- Plan: por cada flujo abierto con menos filas que una página, una ventana de **25** (máximo del API): primera sin cursor, siguientes con el `nextCursor` recibido.
- Aplicación: descarta respuestas obsoletas (otro cursor, primera ventana repetida); filtra filas de otra entidad, ya emitidas o ya en buffer; `hasMore = false` agota el flujo.
- **Sin bucles**: `hasMore` sin cursor, el mismo cursor devuelto, o una ventana sin ninguna fila nueva terminan el flujo como `stalled` (la UI lo indica: «Página N · actualizá la búsqueda»). Con cualquier respuesta, el bucle de páginas del hook termina: o cada ronda produce una página, o todos los flujos quedan agotados.
- `GLOBAL_SEARCH_MAX_OFFSET` ya no interviene en el paginador; no hay tope de páginas ni de registros.

### «Todo» y el comparador

«Todo» es una mezcla k-way de flujos independientes (3 en Clínica, 5 en Admin). Auditoría del comparador: `compareGlobalSearchHits` usa la fecha **visible** (`date`), que no es la clave SQL (informes ordenan por `created_at` y muestran `upload_date`). Por eso el comparador **sólo elige entre cabezas** de flujos distintos y nunca reordena filas dentro de un flujo: cada entidad conserva exactamente el orden SQL recibido. Como antes de tomar una página cada flujo abierto tiene ≥ `pageSize` filas, la página es idéntica a la que daría la mezcla k-way del recorrido completo. Es el mismo criterio que la corrección de `mergeGlobalSearchHits` en #1971.

## 4. Hook (`useGlobalSearchPager`)

Se conservan debounce (250 ms), `AbortController`, descarte de respuestas obsoletas, caché de páginas («Anterior» no pide), reinicio ante cambio de consulta/filtros/categoría/capacidad, y separación Clínica/Admin (la clave incluye la superficie).

- **Restauración sin replay**: el último recorrido de cada superficie queda en memoria de módulo (nunca en storage; un logout recarga el documento y lo descarta). Al volver de un informe a la página N se reutilizan las páginas y los cursores ya leídos, sin volver a pedir las N páginas (antes: N rondas de hasta 5 solicitudes). Se reutiliza sólo con la misma clave y menos de 1 h 55 min de antigüedad (los cursores firman 2 h).
- Un error en una ventana aborta las ventanas hermanas en vuelo.
- Clasificación de errores (`errorKind`): `expired` (sólo el 400 de cursor), `auth` (401), `forbidden` (403), `invalid` (otro 400), `throttled` (429), `generic`. «Reintentar» sólo para `generic` y `throttled`; para `auth`/`forbidden`/`invalid` no hay reintento ciego.

## 5. Cursor vencido o rechazado

Ante `400 Cursor de búsqueda inválido` en una continuación: se descarta el recorrido (páginas y cursores; también el de memoria), se muestra «La búsqueda quedó desactualizada. Actualizala para seguir desde la primera página; se conservan el texto y los filtros.» con un botón explícito **«Actualizar búsqueda»**. Sólo ese clic reinicia en la página 1 con la misma consulta, categoría y filtros. No hay reintento automático y el cursor rechazado nunca se reenvía (verificado en E2E). Un 401/403/429/otro 400 jamás se interpreta como vencimiento.

## 6. Rendimiento y solicitudes

- Una categoría: 1 solicitud por cada 25 registros recorridos (≈ 1 cada 2–4 páginas según capacidad).
- «Todo»: como máximo 1 ventana por entidad abierta y recarga; primera página = 3 (Clínica) o 5 (Admin) solicitudes en paralelo; las entidades agotadas dejan de pedir. Medido (E2E, 2.167 registros en 3 entidades): ≤ 88 ventanas = ⌈2000/25⌉ + ⌈130/25⌉ + ⌈37/25⌉, 3 primeras ventanas.
- Nunca se descarga el resultado completo por adelantado; las páginas visitadas quedan en memoria (≈ 10.000 filas livianas en el peor caso medido).
- El debounce no es rate limiting: el límite por actor del servidor sigue pendiente (GLOBAL-SEARCH-3C).

## 7. Validación

Estados canónicos (AGENTS §6). `head` local: `feat/global-search-3a-cursor-frontend` sobre `7852f88e`, sin commit.

| Gate | Estado | Nota |
| --- | --- | --- |
| Unit pager + cliente + api-client (`node --test`, 3 archivos) | PASSED | 20 pager/cliente nuevos o realineados; recorridos 526, 2.000 y 10.000 por cursor; «Todo» 3 y 5 entidades (10.000 en Admin) |
| Guards afectados (01B, residual-determinism, rate-limit UX, catálogo, B06, capacidad) | PASSED | 91/91 tras realinear |
| `pnpm test` (raíz) | FAILED (ambiental) | 5.570 tests; los 4 fallos restantes son suites PostgreSQL que exigen `DATABASE_URL` → `portal_vetneb_ci` (sin DB local; ningún archivo backend o de integración cambió) |
| `pnpm --dir frontend lint` | PASSED | |
| `pnpm --dir frontend typecheck` | PASSED | |
| `pnpm --dir frontend build` | PASSED | con el env de build de CI |
| `pnpm security:public-surface` | PASSED | hallazgos `server-only` preexistentes en `proxy.ts` |
| `dashboard-global-search.spec.ts` (Chromium, `next dev`) | PASSED | 32/32; deep + «Todo» repetidos 3× estables |
| `e2e:visual-contract` (production runner) | ver §7.1 | |
| `e2e:extended` (A02/A03/A05/G11) | ver §7.1 | |
| Integración real con PostgreSQL de este frontend | NOT_RUN | los E2E usan `page.route`: evidencia de frontend; el recorrido SQL real está en #1971 |
| Staging | BLOCKED | sin autorización ni entorno (AGENTS §17) |

### 7.1 Cohortes

Production runner local (`CI=true`, `VETNEB_E2E_PRODUCTION_RUNNER=1`, build con el env de CI), Chromium:

- `e2e:visual-contract`: **FAILED** 1.146 passed / 1 failed. El fallo («admin finds every authorized entity…») ocurre en `hydratedInput` (la barra admin no hidrató en 30 s bajo la carga de la cohorte), antes de cualquier solicitud de búsqueda. Re-corrida aislada del spec completo en el mismo runner: **96/96 PASSED** (`--repeat-each 3`). Flake de hidratación bajo carga, no del paginador.
- `e2e:extended` (A02, A03, A05, G11 y demás): **FAILED** 303 passed / 1 failed. El único fallo es A02 `clinic-log-visitas`: ancho de contenido 940,7 vs 937,94 congelado (Δ 2,76 > tolerancia 2) en 1024×768, 834×1194 y 768×1024. El diálogo de búsqueda no se monta cerrado y este diff no toca la ruta de Visitas; es la superficie que el trabajo de Visitas sin commit en `C:\PORTAL-VETNEB` está realineando. No se ejecutó A/B contra `main` (requeriría stash o worktree, NO-DELEGABLE): atribución por evidencia, no por prueba. Baselines y tolerancias sin cambios. A03, A05 y G11: PASSED.
- A08 (arnés de mutación): NOT_RUN — no hay spec A08 en estas cohortes; los guards de catálogo/arquitectura que lo anclan pasan en `pnpm test`.

### 7.2 Evidencia E2E de cursor (frontend, `page.route`)

El stub modela el contrato de #1971: `nextCursor` por entidad firmado (stub) sobre superficie, tenant, consulta, filtros y entidad; 400 para cursor + `offset`, cursor con varias entidades, alterado, ajeno o vencido.

- Clínica, «Informes», 2.000 registros: recorrido hasta la posición 581 (> 525) en el orden exacto, sin repetidos, primera ventana sin cursor y todas las demás con cursor, sin `offset`; abre el informe 8420 en su módulo por id; volver a la búsqueda restaura página y registro **sin ninguna solicitud** (con el stub devolviendo 503 a cualquier ventana nueva); reload, Back y Forward.
- Clínica, «Todo», 2.167 registros (2.000 + 130 + 37, ritmos de agotamiento distintos): sin duplicados, sin omisiones, sin filas de la clínica B.
- Admin, «Informes», 700 registros de la clínica B: posición 561 → informe 7435 abierto por `GET /api/admin/report-workflow/7435`.
- Cursor vencido y alterado (390×844): aviso único, texto y categoría conservados, sin «Reintentar», cero scroll; reinicio sólo con «Actualizar búsqueda»; el cursor rechazado se envía una sola vez.
- 401/403/400/429 en una continuación: cuatro estados distintos, ninguno ofrece reinicio; 429 se reintenta.
- 375×667: página > 525 con capacidad exacta, lista sin scroll, paginador dentro del viewport, documento sin scroll.
- Capacidad y Zero Scroll en 320×640, 360×740, 375×667, 390×844, 412×915, 430×932, 844×390, **768×1024 (nuevo)**, 1366×768 y 1920×1080.

## 8. Limitaciones por cambios concurrentes

Keyset no es una fotografía (ver #1971 §5): una alta antes del cursor no se ve; una alta después se ve una vez; una baja pendiente desaparece sin desplazar otras; una fila que cruza el cursor hacia atrás se pierde en ese recorrido; una que cruza hacia adelante llegaría dos veces y el paginador la **deduplica** por `kind:id`. Las páginas ya vistas en memoria no se refrescan hasta un cambio de consulta, filtros o «Actualizar búsqueda».

## 9. Riesgos pendientes

- **3B**: tokens, seguimientos sin informe, clínicas y usuarios siguen sin lectura por id; abren su módulo y sólo posicionan la fila si está en la página cargada.
- **3C**: sin rate limit por actor en servidor; «Todo» genera hasta 5 solicitudes por recarga. El cliente ya distingue 429.
- **3D**: índices trigram; el costo por ventana lo domina el `ILIKE`, no la profundidad.
- Un recorrido restaurado de memoria puede mostrar datos de hasta ~2 h; al continuar más allá, un cursor vencido cae en el flujo de §5.
- `stalled` sólo aparece ante una respuesta incoherente del servidor; no tiene E2E (sí unit).

## 10. Archivos

- `frontend/src/lib/global-search.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/global-search-pager.ts`
- `frontend/src/components/dashboard/useGlobalSearchPager.ts`, `frontend/src/components/dashboard/DashboardGlobalSearchDialog.tsx`
- `frontend/e2e/platform/app-shell/dashboard-global-search.spec.ts`, `frontend/e2e/suites/catalog.ts`
- `test/unit/ui/frontend/frontend-global-search-pager.test.ts`, `test/unit/ui/frontend/frontend-global-search-client.test.ts`, `test/unit/ui/frontend/frontend-api-client-request.test.ts` (realineado: el aviso de red no imprime query)
- `docs/implementation/global-search-phase-3a-cursor-frontend.md`

## 11. No alcance

Backend, migraciones, dependencias, workflows, variables de entorno, baselines y tolerancias visuales, lecturas por id nuevas (3B), rate limit (3C), índices (3D), staging. Sin `git add`, commit, push, PR ni merge (no delegados).
