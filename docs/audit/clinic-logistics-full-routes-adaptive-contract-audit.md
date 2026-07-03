# Clinic logistics full routes adaptive contract audit

## Estado base

| Campo | Valor |
|---|---|
| Rama | `docs/clinic-logistics-full-routes-adaptive-contract-audit` |
| Base | `main` limpio |
| HEAD | `95a12e8 fix(clinic): remove hub inline-list internal overflow (#1273)` |
| R-10 | Cerrado (`#1273`, hub summary sin overflow interno) |
| R-11 | Docs-only. Sin cambios de código, sin CSS, sin backend, sin tests/e2e nuevos |
| Documento rector | `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` (R-11..R-14) |

## Archivos inspeccionados

- `frontend/src/app/dashboard/logistica/page.tsx`
- `frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx`
- `frontend/src/app/dashboard/logistica/visitas/page.tsx`
- `frontend/src/app/dashboard/logistica/rutas/page.tsx`
- `frontend/src/app/dashboard/logistica/metricas/page.tsx`
- `frontend/src/lib/api.ts` (`getLogisticsFieldVisits`, `getRoutePlans`, `getRoutePlanMetrics`)
- `server/fastify-app.ts` (registro de rutas `/api/logistics/*`)
- `server/routes/logistics-field-visits.fastify.ts` (handler `GET /`)
- `server/routes/logistics-route-plans.fastify.ts` (handler `GET /`)
- `server/lib/audit-log.ts` (`parsePositiveInt`/`parseOffset`, patrón compartido)
- `test/frontend-dashboard-logistica-visitas.test.ts`
- `test/frontend-dashboard-logistica-rutas.test.ts`
- `test/frontend-dashboard-logistica-metricas.test.ts`
- `frontend/e2e/dashboard-clinic-logistica-mobile-parity.spec.ts` (sólo cubre el summary, `ClinicLogisticaWorkspaceSummary`)
- `docs/implementation/clinic-logistics-master-detail-workspace.md`
- `docs/implementation/server-adaptive-pagination-strategy.md`

## Hallazgos por ruta

### visitas (`/dashboard/logistica/visitas`)

- **Carga de datos:** server component. Llama `getLogisticsFieldVisits(requestOptions, { throwOnError: true })` sin pasar `limit`/`offset` en la URL (`frontend/src/lib/api.ts:1396-1414` → `apiFetch("/api/logistics/field-visits", options)`, sin querystring).
- **Cardinalidad — hallazgo clave (revisa la evidencia inicial):** el endpoint backend (`server/routes/logistics-field-visits.fastify.ts:1017-1085`) **sí** soporta `limit`/`offset` vía querystring (`parsePositiveInt(request.query.limit, 50, 100)`, `parseOffset(request.query.offset)`), pero el cliente Next no los envía nunca. Efecto real: **no es "lista completa sin paginar"**, es **truncamiento silencioso al default del servidor (50 registros, offset 0)**. Si existen más de 50 visitas, las restantes desaparecen sin aviso, sin control de página y sin indicio en la UI de que hay más datos. Esto es más severo que "falta paginación": es una pérdida de datos visibles no señalizada.
- **`total`/`count` expuesto:** el endpoint devuelve `count` (cantidad de la página actual) y `pagination: { limit, offset }`, **no** un `total` de universo. Mismo perfil que "Tokens admin (particular)" en `server-adaptive-pagination-strategy.md` §4 (#5): sin `total`, no se puede calcular `pageCount`; sólo cabe `hasNext` por página llena.
- **Render:** tabla completa (`Table`/`TableBody`) con `visits.map(...)`, sin paginación cliente, sin `usePagedRows`, sin altura medida.
- **Overflow/scroll:** no hay `overflow-y-auto`, `overflow-auto`, `max-h`, `h-[...]`, `calc(...)`, `matchMedia` ni `ResizeObserver` en el archivo. La tabla crece verticalmente sin límite dentro de `dashboard-main`; el contrato Zero-Scroll depende exclusivamente de que nunca haya más de 50 filas cargadas (por el default del servidor), no de un mecanismo adaptativo real. Con 50 filas la tabla ya excede cualquier viewport sin scroll controlado — el "no overflow" observado hoy es casual, no diseñado.
- **Tests existentes:** `test/frontend-dashboard-logistica-visitas.test.ts` — 7 tests, todos *source-contract* (`assert.ok(source.includes(...))` sobre el string del archivo). Ninguno ejecuta el componente, ninguno valida runtime, cardinalidad real ni ausencia de scroll. No hay e2e propio (`frontend/e2e` no contiene ninguna spec para esta ruta).
- **Deuda:** (1) truncamiento silencioso a 50 sin exponer `total`; (2) sin paginación real ni "cargar más"; (3) sin contrato Zero-Scroll verificado en runtime/e2e; (4) filtros de servidor disponibles (`status`, `sourceType`, `sourceId`) no usados desde el cliente.
- **Recomendación R-12:** familia **OF con cap + "cargar más"** (igual que Tokens admin, no HY/RF, porque no hay `total`). Cap superset propuesto: 36-50 (alinear con el máximo actual del servidor, 100, pero acotar el payload). Debe: (a) pasar `limit` explícito al fetch; (b) exponer al usuario que hay más registros cuando `count === limit` (página llena ⇒ posible `hasNext`); (c) mantener `visitsLoadError` vs vacío real; (d) no introducir scroll interno — usar paginación real (offset) o carga incremental, no listar sin límite.

### rutas (`/dashboard/logistica/rutas`)

- **Carga de datos:** server component. Llama `getRoutePlans(requestOptions, { throwOnError: true })`, mismo patrón: sin `limit`/`offset` en la URL.
- **Cardinalidad:** idéntica al caso de visitas. `server/routes/logistics-route-plans.fastify.ts:1590-1688` soporta `limit`/`offset` (mismo `parsePositiveInt(..., 50, 100)`), sin `total`; el handler además tiene caché (`getCachedRoutePlansSnapshot`/`setCachedRoutePlansSnapshot`) por `cacheKey` que incluye `limit`/`offset` — la caché ya está preparada para paginación real, sólo el cliente Next no la usa.
- **Render:** tabla completa `routePlans.map(...)`, incluye barra de progreso por fila (`clinical-progress`), sin paginación ni virtualización.
- **Overflow/scroll:** igual que visitas — sin overflow/scroll/matchMedia/ResizeObserver en el archivo; el "no overflow" depende del tope de 50 filas del servidor, no de diseño adaptativo.
- **Tests existentes:** `test/frontend-dashboard-logistica-rutas.test.ts` — 6 tests, mismo patrón *source-contract* únicamente. Sin e2e propio.
- **Deuda:** misma que visitas: (1) truncamiento silencioso a 50; (2) sin `total`; (3) sin contrato runtime verificado; (4) filtros de servidor (`status`, `planningMode`, `objective`) no usados desde el cliente pese a estar soportados y cacheados.
- **Recomendación R-13:** mismo patrón que R-12 (**OF con cap + "cargar más"**), reutilizando la caché ya existente en el backend variando `limit`/`offset` en la `cacheKey`. Riesgo ligeramente menor que visitas porque ya hay caché de servidor lista.

### metricas (`/dashboard/logistica/metricas`)

- **Carga de datos:** server component. Primero `getRoutePlans(requestOptions, { throwOnError: true })` (mismo truncamiento a 50 sin `limit` explícito), luego, si hay planes, `Promise.all(routePlans.map(plan => getRoutePlanMetrics(plan.id, requestOptions, { throwOnError: true })))`.
- **Cardinalidad:** heredada de `getRoutePlans` (máx. 50 planes por el default de servidor). Cada elemento de `routeMetrics` viene de `getRoutePlanMetrics(planId)`, que llama a `/api/logistics/route-plans/{planId}/metrics` — un endpoint por plan, sin `limit`/`offset` (no aplica, es 1 recurso por plan).
- **Render:** tarjetas resumen agregadas (cumplimiento promedio, paradas completadas, duración promedio, planes analizados) + detalle por plan (`routeMetrics.map(...)`), todo calculado en el server component sobre el array completo recibido.
- **Fan-out N requests:** confirmado. Con hasta 50 planes (tope actual del truncamiento silencioso de `getRoutePlans`), esta ruta dispara **hasta 50 requests HTTP paralelos** (`Promise.all`) sólo para pintar el resumen. No hay batching, no hay endpoint de métricas agregadas por clínica, no hay límite superior propio distinto al heredado de `routePlans.length`. Es el mayor riesgo P1 de las tres rutas: cualquier crecimiento del número de planes escala linealmente el fan-out, sin cap independiente.
- **Overflow/scroll:** sin overflow/scroll/matchMedia/ResizeObserver; el detalle por plan es una lista vertical de tarjetas (`surface-soft`), no una tabla — mismo patrón "sin límite salvo el truncamiento heredado".
- **Tests existentes:** `test/frontend-dashboard-logistica-metricas.test.ts` — 6 tests, *source-contract* únicamente (incluye verificación de agregados y umbrales de badge, pero sobre el string fuente, no ejecución). Sin e2e propio.
- **Deuda:** (1) fan-out N requests sin cap propio (hereda el truncamiento de 50 de `routePlans`, pero el *diseño* no impone ningún límite independiente — si `getRoutePlans` cambiara su default, el fan-out escalaría sin control); (2) sin paginación en el detalle por plan; (3) sin contrato runtime verificado; (4) doble punto de fallo (`routePlansLoadError` y `routeMetricsLoadError`) ya cubierto en el código pero no probado end-to-end.
- **Recomendación R-14:** depende de R-12/R-13 en cuanto a paginación de `routePlans`, pero además requiere resolver el fan-out **antes o junto con** adoptar `limit`/`offset`: (a) acotar el número de planes para los que se piden métricas en el primer paint (p. ej. paginar `routePlans` primero, pedir métricas sólo de la página visible); (b) evaluar si existe/puede añadirse un endpoint agregado (`GET /api/logistics/route-plans/metrics?ids=...` o similar) — **fuera de scope de R-14 si implica backend nuevo**, documentar como bloqueo si el único camino es tocar backend. Riesgo más alto de los tres (P1 por el fan-out, no sólo P2 por cardinalidad).

## Matriz comparativa

| | visitas | rutas | métricas |
|---|---|---|---|
| Fuente de cardinalidad | servidor default (`limit=50`, sin `total`) | servidor default (`limit=50`, sin `total`), con caché ya preparada | heredada de `routePlans` (máx. 50) + 1 request por plan |
| `limit`/`offset` enviados por el cliente | No | No | No (para `routePlans`; no aplica a métricas por plan) |
| `total` expuesto por el endpoint | No | No | No |
| Paginación real | No | No | No |
| Overflow interno permitido/medido | No (ni permitido ni medido; depende del tope de 50) | No (ídem) | No (ídem) |
| Scroll global | No observado (mismo motivo: tope implícito de 50) | No observado | No observado |
| `dashboard-inline-list`/`overflow-y-auto`/`max-h`/`matchMedia`/`ResizeObserver` | Ninguno presente | Ninguno presente | Ninguno presente |
| Fan-out N requests | No | No | **Sí, hasta 50 en paralelo** |
| Duplicación con summary in-shell | Sí — `LogisticsCommandCenter` ya muestra `recentVisits = fieldVisits.slice(0, 5)` desde el mismo `fieldVisits` sin truncar en la carga (el hub también depende del truncamiento a 50 del hub `page.tsx`) | Sí — mismo patrón con `recentPlans` | No aplica (el hub no muestra métricas agregadas) |
| Tests | 7 source-contract, 0 runtime, 0 e2e | 6 source-contract, 0 runtime, 0 e2e | 6 source-contract, 0 runtime, 0 e2e |
| Recomendación | R-12 | R-13 | R-14 |

## Duplicación hub / full-page

`frontend/src/app/dashboard/logistica/page.tsx` (hub) llama a los mismos `getLogisticsFieldVisits`/`getRoutePlans` sin `limit`/`offset` (idéntico truncamiento a 50), y `LogisticsCommandCenter.tsx` recorta a los primeros 5 (`fieldVisits.slice(0, 5)`, `routePlans.slice(0, 5)`) para el resumen. Esto significa que el hub ya sufre el mismo truncamiento silencioso de origen (si hay más de 50 registros, ni el hub ni las rutas full los ven), aunque su superficie visual (5 filas) lo oculte. Migrar R-12/R-13 a paginación real con `limit`/`offset` explícitos no debería tocar el hub (fuera de scope), pero el hallazgo queda documentado porque explica por qué el hub "parece" sin overflow: nunca ve más de 50 registros para empezar.

## Riesgos P1/P2/P3

| Riesgo | Sev | Ruta(s) | Evidencia |
|---|---|---|---|
| Truncamiento silencioso a 50 registros sin exponer al usuario que hay más datos | **P1** | visitas, rutas (y hub, heredado) | `api.ts` no envía `limit`/`offset`; servidor default 50 sin `total` |
| Fan-out de hasta 50 requests paralelos para pintar el resumen de métricas | **P1** | métricas | `Promise.all(routePlans.map(...))` sin cap propio |
| Endpoint sin `total`: no se puede calcular `pageCount`, sólo `hasNext` por página llena | P2 | visitas, rutas | mismo perfil que Tokens admin en `server-adaptive-pagination-strategy.md` |
| Cero cobertura runtime/e2e del contrato Zero-Scroll en las 3 rutas full | P2 | visitas, rutas, métricas | tests existentes son 100% source-contract; sin specs en `frontend/e2e` |
| Filtros de servidor soportados (`status`, `sourceType`/`objective`/`planningMode`) no usados desde el cliente | P3 | visitas, rutas | querystrings del handler vs. llamada sin parámetros en `api.ts` |
| "No overflow" actual es casual (depende del tope de 50), no diseñado | P2 | visitas, rutas, métricas | ausencia total de mecanismo adaptativo/paginación en las 3 rutas |

## Scope recomendado R-12/R-13/R-14

Orden confirmado: **R-12 visitas → R-13 rutas → R-14 métricas** (no hay razón técnica fuerte para reordenar; métricas depende de resolver primero el patrón de paginación de `routePlans` en R-13, y además carga el riesgo adicional del fan-out, por lo que debe ir último).

### R-12 · `feat(clinic): adapt logistics visitas full route`

- **Archivo permitido:** `frontend/src/app/dashboard/logistica/visitas/page.tsx` (+ posible wrapper cliente nuevo si se requiere paginación interactiva, siguiendo el patrón de `informes` en R-07/#1269).
- **Test/e2e permitido:** `test/frontend-dashboard-logistica-visitas.test.ts` (actualizar contrato), un e2e propio nuevo (p. ej. `frontend/e2e/dashboard-logistica-visitas-adaptive.spec.ts`), doc `docs/implementation/*.md` propio.
- **Contrato esperado:** enviar `limit`/`offset` explícitos al fetch; exponer al usuario cuando hay más registros que la página actual (`count === limit` ⇒ posible más); paginación real (offset) o "cargar más"; mantener distinción `visitsLoadError` vs vacío real; sin overflow interno ni scroll global.
- **Riesgo:** P2 (sin `total`, patrón OF+cap ya validado en Tokens admin).
- **Validaciones mínimas:** source-contract test actualizado; e2e que verifique conteo de filas estable y ausencia de scroll en `html/body/main`; `pnpm typecheck:test`; sin tocar backend (los `limit`/`offset` ya existen en el endpoint).
- **Prohibiciones específicas:** no tocar `rutas/page.tsx`, `metricas/page.tsx`, `LogisticsCommandCenter.tsx`, `page.tsx` (hub), backend logistics, `globals.css`.

### R-13 · `feat(clinic): adapt logistics rutas full route`

- **Archivo permitido:** `frontend/src/app/dashboard/logistica/rutas/page.tsx` (+ wrapper cliente si aplica).
- **Test/e2e permitido:** `test/frontend-dashboard-logistica-rutas.test.ts`, e2e propio nuevo, doc propio.
- **Contrato esperado:** igual a R-12, aprovechando que el backend ya cachea por `limit`/`offset` (`buildRoutePlansListCacheKey`); no requiere cambios de caché, sólo que el cliente envíe los parámetros.
- **Riesgo:** P2.
- **Validaciones mínimas:** iguales a R-12; adicionalmente verificar que la caché de servidor (`getCachedRoutePlansSnapshot`) sigue funcionando con distintos `limit`/`offset` (sólo lectura/observación, sin tocar backend).
- **Prohibiciones específicas:** no tocar `visitas/page.tsx`, `metricas/page.tsx`, `LogisticsCommandCenter.tsx`, `page.tsx` (hub), backend logistics, `globals.css`.

### R-14 · `feat(clinic): adapt logistics metricas full route`

- **Archivo permitido:** `frontend/src/app/dashboard/logistica/metricas/page.tsx` (+ wrapper cliente si aplica).
- **Test/e2e permitido:** `test/frontend-dashboard-logistica-metricas.test.ts`, e2e propio nuevo, doc propio.
- **Contrato esperado:** (a) heredar la paginación de `routePlans` definida en R-13 (no repetir la lógica, reusar patrón); (b) acotar el fan-out de `getRoutePlanMetrics` al conjunto de planes efectivamente visible en la página actual (no a los 50 truncados); (c) si el fan-out no puede acotarse sin tocar backend, documentar el bloqueo explícitamente en el PR y limitar el scope a lo que sí es alcanzable sólo-frontend.
- **Riesgo:** **P1** (el más alto de los tres, por el fan-out no acotado, no sólo por cardinalidad de lista).
- **Validaciones mínimas:** iguales a R-12/R-13; adicionalmente medir/loggear (en el propio PR, no en producción) el número de requests disparados por carga para confirmar que quedó acotado al tamaño de página, no al total de planes.
- **Prohibiciones específicas:** no tocar `visitas/page.tsx`, `rutas/page.tsx`, `LogisticsCommandCenter.tsx`, `page.tsx` (hub), backend logistics (salvo que R-14 documente explícitamente que necesita un endpoint agregado, lo cual quedaría **fuera de scope de R-14** y requeriría un PR de backend aparte, no incluido en este roadmap).

## Validaciones recomendadas por PR futuro

1. Source-contract test actualizado por ruta (igual estilo a los 3 existentes), ampliado para verificar presencia de `limit`/`offset` explícitos en la llamada al cliente API.
2. E2E propio por ruta que valide: ausencia de scroll en `html/body/main`; conteo de filas/tarjetas estable entre resize (1080↔720, siguiendo el patrón de `dashboard-viewport-zoom-adaptability.spec.ts`); indicador de "hay más registros" visible cuando `count === limit`.
3. Para R-14 específicamente: verificación (test o e2e con mock de red) de que el número de requests de métricas no crece de forma ilimitada con el total de planes, sólo con el tamaño de página.
4. `pnpm test`, `pnpm typecheck:test` verdes en cada PR; `pnpm -C frontend lint` y `pnpm -C frontend typecheck` antes de e2e.
5. No regenerar snapshots visuales sin autorización explícita (regla global del roadmap).

## Confirmación docs-only

- Este PR (R-11) crea **un único archivo**: `docs/audit/clinic-logistics-full-routes-adaptive-contract-audit.md`.
- **No se modificó** `frontend/src/**`, `frontend/e2e/**`, `test/**`, backend/API/auth/DB/server, migrations, CI/workflows, deps/lockfiles, snapshots, `globals.css`, Admin, Particular ni Público.
- **No se implementó** R-12/R-13/R-14, R-15 (`MasterDetailWorkspace`) ni R-16 (Tokens Clínica).
- Todo el código citado (`server/routes/logistics-field-visits.fastify.ts`, `server/routes/logistics-route-plans.fastify.ts`, `frontend/src/lib/api.ts`, las 3 páginas full, `LogisticsCommandCenter.tsx`) fue **sólo leído**, nunca editado.
- **No se ejecutó** build ni e2e (no se cita evidencia visual/runtime adicional a la ya presente en `docs/implementation/clinic-logistics-master-detail-workspace.md` y `server-adaptive-pagination-strategy.md`).
- Validaciones ejecutadas: `git diff --check`, `pnpm test`, `pnpm typecheck:test` (ver sección de entrega).
