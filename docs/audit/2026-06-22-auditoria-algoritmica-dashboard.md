# VETNEB — Auditoría Algorítmica de Dashboard Admin/Clínica

> Fecha: 2026-06-22 · Modo: solo auditoría y asesoramiento (sin cambios de código).
> Estado base: `main` @ `23bb932 fix(admin): add persistent mobile hub stage (#1074)`, working tree limpio.

## 1. Resumen ejecutivo

El sistema **ya es más maduro de lo que el briefing asume**. No es un dashboard "plano con márgenes manuales": tiene una arquitectura de App Shell no-scroll con cadena de altura `flex min-h-0`, un **layer de tokens fluidos `clamp()` keyed a vw/vh con escalones por altura** (`globals.css:2074-2206`), paginación/búsqueda **server-side** real en clínicas/informes/auditoría, e índices compuestos `clinic_id`-first que evitan cualquier scan global de 5M filas.

La conclusión central, contraria a la hipótesis del briefing, es:

- **`clamp()` NO es trabajo nuevo P1**: ya existe y funciona. Lo que falta es **completar su cobertura** (el hub cockpit y, sobre todo, **todo el shell mobile**, siguen en `rem` fijo + recorte `overflow:hidden`).
- **Grid/Flex/gap ya es la base estructural** y está bien ejecutada. No hay un problema masivo de márgenes manuales; hay focos puntuales.
- **Container Queries: cero uso, y son el upgrade de mayor relación valor/riesgo** porque hoy cada módulo duplica árbol mobile vs desktop por *viewport* (`md:hidden` / `hidden md:flex`). Tailwind v4.3 las soporta nativo, **sin dependencia nueva**.
- **La escala de 5.000 clínicas / 5M informes ya está esencialmente resuelta** a nivel de arquitectura de datos. El único riesgo real de escala es el `count(*)` repetido sobre `audit_log` y el coste de `OFFSET` profundo — ambos diferibles.
- **Command Bar / TanStack / MiniSearch / SSE / Redis / Kafka / micro-frontends**: ninguno es necesario ahora. Command Bar es el único con ROI claro a mediano plazo (P2).

**El problema real de "máxima densidad algorítmica" está en mobile, no en desktop**: mobile no escala fluido, **encaja recortando** (grid 2×3 fija + `line-clamp` + `overflow:hidden`), validado solo en 3 viewports. Ahí está el mayor retorno.

## 2. Estado base

```
branch:  main
HEAD:    23bb932 fix(admin): add persistent mobile hub stage (#1074)
status:  limpio (sin cambios, sin untracked)
```

Coincide con el estado esperado. Apto para auditoría.

## 3. Evaluación comparativa de técnicas

| Técnica | Estado actual en VETNEB | Veredicto | Prioridad |
|---|---|---|---|
| **`clamp()` / interpolación fluida** | Implementado parcialmente: tokens `--dash-*` (`globals.css:2083-2102`) + escalones `@media (max-height: 860/760/680)`. Aplicado a `dashboard-main`, rhythm, `module-surface/tabs` gap, tabs, panels, list-rows. **No** aplicado al cockpit interno ni a mobile. | **Completar, no introducir.** Es la base correcta de densidad fluida desktop. | **P1 (extensión)** |
| **CSS Grid / Flexbox / gap** | Maduro. Cadenas `flex min-h-0`, grids `repeat(2/3, minmax(0,1fr))`, `gap` tokenizado, `grid-auto-rows: minmax(0,1fr)` (`globals.css:1855-1858`). Márgenes manuales casi eliminados (rhythm vía selector). | **Mantener.** Focos menores (ver §7). | **P1 (limpieza puntual)** |
| **Container Queries / `cqw`** | **Cero uso.** Toda la responsividad es por viewport (`@media` + `md:`). Tailwind v4.3 → `@container`/`cqw` nativo, sin dep. | **Adoptar con estrategia, componente por componente.** Es el salto de sofisticación real. | **P2** |
| **CSS Anchor Positioning** | **No usado.** Overlays son CSS manual edge-pinned (kebab `position:absolute`, module-menu `position:fixed`, `globals.css:2444-2578`); Radix solo para Dialogs modales. Sin Popper/floating-ui. | **No adoptar ahora.** Los menús están anclados a bordes, no necesitan anchoring complejo; soporte cross-browser aún irregular. | **P3 / roadmap** |

## 4. Decisión recomendada para VETNEB

**Orden estricto:** consolidar y extender lo que ya existe (clamp + grid) → introducir container queries de forma quirúrgica → diferir command bar/anchor.

1. **PR-E (P1):** completar el sistema fluido a las dos zonas que hoy quedan en `rem` fijo: el **cockpit del hub** (desktop) y **el shell mobile** (que hoy encaja recortando). Esto ataca directamente "máxima densidad algorítmica" y "no hardcodear 360×740".
2. **PR-F (P2):** container queries en componentes reutilizables (cards/KPI/tablas) donde hoy se duplica árbol por viewport.
3. **PR-G (P2, mayormente verificación):** confirmar y blindar la escala ya existente; un solo correctivo real (count del audit).
4. **PR-H (P2):** Command Bar advisory/diseño.
5. **PR-I (P3):** overlays/anchor — solo auditoría/roadmap.

## 5. Qué usar primero y por qué

**`clamp()` extendido (PR-E) primero.** Razones:

- **Ya es la base instalada**: extenderla es bajo riesgo y coherente; no introduce paradigma nuevo.
- Ataca el déficit más visible: **mobile no es fluido**. Hoy el hub mobile es `grid-template-rows: repeat(3, minmax(0,1fr))` + tiles `rem` fijo + `-webkit-line-clamp: 2` + `overflow:hidden` (`globals.css:2690-2749`). En pantallas cortas o con fuente accesible aumentada, **recorta en vez de escalar** — cumple "no-scroll" pero rompe "máximo uso del espacio / nada fuera de límites".
- No requiere dependencias, no toca backend, y respeta el contrato no-scroll (los tokens solo *reducen* medidas dentro del frame existente).

## 6. Qué NO usar todavía y por qué

- **CSS Anchor Positioning**: los overlays están edge-pinned y funcionan; el anchoring real no aporta y el soporte (Safari/Firefox) todavía no es universal. Riesgo > valor.
- **MiniSearch / índice cliente**: la búsqueda ya es server-side y los datasets grandes nunca se cargan en memoria. Introducirlo sería **regresión de escala**.
- **TanStack Table**: la densidad/paginación/no-scroll ya están resueltas con primitivas propias (`usePagedRows`, `ModuleTabs`, tablas densas). TanStack añadiría peso de bundle sin resolver un problema abierto.
- **SSE/WebSocket, Redis, Kafka/RabbitMQ, micro-frontends**: sin evidencia de necesidad. Sobredimensionado para el patrón de carga actual.
- **Command Bar con acciones destructivas/impersonation**: el diseño sí, la ejecución no — riesgo de seguridad (acciones sin contexto). Solo P2 advisory.

## 7. Auditoría de exceso de espacios

Foco real (no generalizado — el grueso ya está tokenizado):

| Hallazgo | Ubicación probable | Recomendación |
|---|---|---|
| Cockpit del hub en `rem` fijo (launcher `padding:1rem`, grid `gap:0.7rem`/`0.45rem`, tile `padding:0.6rem`, icon `1.8rem`) — solo `gap` está tokenizado | `globals.css:1759-1830`, override parcial en `2171` | Migrar padding/gap/icon a tokens `--dash-*` o nuevos `--dash-tile-*`. |
| Márgenes manuales `mt-1/mt-2/mb-2` dentro de `surface-soft` (grids de salud) | `app/dashboard/admin/page.tsx:633-737` | Reemplazar por `gap`/`space-y` tokenizado en el contenedor. |
| Card header con valores arbitrarios hardcodeados (`text-[0.95rem]`, `text-[0.72rem]`, `py-2`, `[&_th]:h-9`, `py-1`) | `app/dashboard/admin/AdminClinicsManagementCard.tsx:276-487` | Candidato a `cqw`/tokens en PR-F para densidad coherente. |
| Columna rail del hero fija `minmax(0, 21rem)` | `globals.css:1841` | Revisar si en ≥1440px deja aire lateral; podría ser fluida. |
| Banda de tabs/secciones con gaps fijos `0.75rem` en `module-tabs` base (override de app-shell aplica token, pero el default no) | `globals.css:1911-1918` | Unificar al token para consistencia fuera del shell. |

**No hay** un problema sistémico de `space-around`/divisores redundantes; el `dashboard-workspace-header` mobile ya se elimina y reclama altura (`globals.css:2854-2878`).

## 8. Auditoría mobile

**Lo bueno:** App Shell absoluto (`html/body overflow:hidden`, surface `100svh`), app-bar opaca ≤49px, bottom-nav estable de 5 ítems, stage persistente opaco contra bleed-through (#1074), `env(safe-area-inset-*)` en top/bottom. Cumple "app mobile real / cero scroll".

**El déficit algorítmico (lo que el briefing pide):**

- **Encaje por recorte, no por escala.** Hub: `grid 2×3` fijo + `line-clamp:2` + `overflow:hidden`. Módulos: fuentes `0.64–0.72rem` y gaps `0.35–0.5rem` **fijos**. En 360×740/390×844/430×932 entra; fuera de eso (alturas cortas, landscape, font-scaling del SO) **se recorta**.
- **Validación estrecha:** los e2e prueban exactamente 3 viewports retrato (`e2e/admin-mobile-app-shell-absolute-no-scroll.spec.ts:5-9`). "No hardcodear 360×740" se cumple a medias.
- **Doble árbol por módulo:** clínicas/precios/salud/mantenimiento renderizan variante mobile **y** desktop en el DOM (`md:hidden` + `hidden md:flex`), duplicando markup.

**Recomendación:** PR-E aplica `clamp()` keyed a `svh`/`svw` a gaps/fuentes/tile-size del shell mobile, con escalón por altura corta. PR-F evalúa colapsar duplicación con container queries.

## 9. Auditoría desktop

**Lo bueno:** densidad alta real (clínicas a `PAGE_SIZE=9` filas densas que entran en 1366×768 sin scroll, `AdminClinicsManagementCard.tsx:55`), tabs para dividir módulos que antes desbordaban (resumen/alertas, servicios/runtime/esquema), tokens fluidos + escalones por zoom, master-detail inline disponible (`globals.css:2221-2250`).

**Tensión de producto a decidir:** el contrato no-scroll fuerza `PAGE_SIZE=9` en clínicas y bloquea el **25/50/100 real** que un software administrativo enterprise espera (ya documentado como deferido en el propio código, `AdminClinicsManagementCard.tsx:50-54`, y en memoria `project_dashboard_horizontal_nav_redesign`). **Decisión recomendada:** permitir scroll *intencional y acotado al body de la tabla* en desktop para densidades altas (alineado con el rediseño a nav horizontal ya auditado), sin romper el shell. Es un cambio de contrato, va en su propio PR (no en PR-E).

**Otros:** densidad ya buena; revisar solo el aire de la columna hero en pantallas anchas (§7).

## 10. Auditoría de escala (5.000 clínicas / 1.000 informes por clínica = 5M)

**Veredicto: la arquitectura de datos ya soporta la escala objetivo.** Evidencia:

- **Clínicas:** `listAdminClinics` con `limit/offset` + `count(*)` + `ILIKE` en nombre/email + `ORDER BY name,id` (`server/db-admin-clinics.ts:246-311`). 5.000 filas → trivial. `ILIKE '%x%'` es seq scan (sin índice trigram) pero irrelevante a 5k. Frontend ya hace search server-side con debounce 300ms (`AdminClinicsManagementCard.tsx:138-272`).
- **Informes (el caso de 5M):** **nunca se consultan globalmente.** `searchReports` filtra **siempre por `clinicId` primero** (`server/db.ts:779-814`), y los índices son compuestos `clinic_id`-first (`reports_clinic_id_idx`, `reports_clinic_upload_date_idx`, etc., `drizzle/schema.ts:276-289`). El `ILIKE` opera sobre ~1.000 filas de una clínica, no sobre 5M. **No existe el problema de scan masivo.**
- **Auditoría:** `limit/offset` + índices `event/created_at/actor` (`drizzle/schema.ts:421-437`).
- **Paginación:** offset/limit en todo; `MAX_LIST_LIMIT=100`, `MAX_LIST_OFFSET=100_000` (`server/lib/list-pagination.ts`). Sin cursor/keyset.
- **`usePagedRows`** es client-side **pero solo para datasets ya acotados en memoria** (`components/dashboard/usePagedRows.ts`); las listas grandes (clínicas/informes/auditoría) son server-side. Correcto.

**Riesgos reales (diferibles):**

1. **`count(*)` repetido**: `page.tsx` lanza 4 queries de auditoría + count en cada carga admin (`app/dashboard/admin/page.tsx:466-487`). Sobre un `audit_log` que crece a millones, el `count(*)` sin filtro es O(n) por request. → cache corto / count aproximado (`reltuples`) cuando crezca.
2. **`OFFSET` profundo** degrada (escanea+descarta), aunque acotado a 100k. → keyset/cursor solo si se requiere paginación profunda real.
3. **Sin índice trigram/full-text**: solo importaría si alguna vez se agrega búsqueda global cross-clínica (hoy no existe).

**Decisión:** **no rearquitecturar.** Verificar con un test de 5.000 clínicas y blindar el count del audit. Lo demás está bien.

## 11. Evaluación de arquitectura propuesta

| Componente | ¿Necesario ahora? | Veredicto |
|---|---|---|
| **Command Bar (Cmd+K)** | No hay ninguno; nav vía bottom-nav+kebab. | **P2.** Navegación + búsqueda de clínicas (endpoint existe) e informes (existe, per-clínica) sin backend nuevo. Acciones destructivas/impersonation **excluidas** del MVP. |
| **TanStack Table** | No. | **No.** Primitivas propias ya cubren densidad/paginación/no-scroll. Añadiría bundle sin resolver gap. |
| **MiniSearch** | No. | **No.** Sería regresión de escala (carga en memoria). Solo válido para subconjuntos ya cacheados y pequeños. |
| **SSE/WebSocket** | No. | **Roadmap.** Solo si se requieren alertas en vivo no invasivas; hoy polling/refresh basta. |
| **Redis** | No. | **Roadmap.** Justificable solo para cache de `count`/health o rate-limit distribuido a escala real. |
| **Kafka/RabbitMQ** | No. | **No (sobredimensionado).** Para bulk actions futuras: job queue simple en DB, no broker. |
| **Micro-frontends** | No. | **No.** Un solo Next App Router es adecuado; fragmentar añadiría complejidad sin beneficio. |

## 12. Recomendación sofisticada pero realista

**Sofisticación = terminar el sistema fluido + container queries quirúrgicas + un Command Bar de navegación seguro.** No reescribir. El sistema ya tiene los huesos correctos (App Shell, tokens, server-side data, índices). El valor incremental máximo está en: (a) **mobile fluido de verdad** (deja de recortar), (b) **eliminar duplicación de árbol con container queries**, (c) **Command Bar** como acelerador operativo enterprise sin riesgo de seguridad. Todo lo "grande" (brokers, micro-frontends, Redis) se descarta por sobredimensionamiento.

## 13. Roadmap por PRs chicos

### PR-E — Tokens fluidos: completar cobertura (P1)

- **Objetivo:** que la densidad escale fluido en el cockpit del hub (desktop) y en **todo el shell mobile**, eliminando el "encaje por recorte".
- **Alcance:** migrar a `clamp()`/tokens los `rem` fijos del cockpit (`globals.css:1759-1830`) y del shell mobile (`globals.css:2325-2825`): gutters, gaps, tile-size, fuentes, icon, bottom-nav/app-bar (keyed a `svh`/`svw` + escalón por altura corta).
- **NO tocar:** lógica de componentes, contrato `overflow:hidden`, JS, backend, deps.

### PR-F — Container Queries en componentes reutilizables (P2)

- **Objetivo:** que cards/KPI/tablas respondan a su contenedor, no al viewport; reducir duplicación `md:hidden`/`hidden md:flex`.
- **Alcance:** convertir `dashboard-cockpit-tile`, KPI cards y la card de clínicas en *containers* (`container-type: inline-size`) y consumir `cqw` (Tailwind v4.3, **sin dep**). Empezar por 1-2 componentes piloto.
- **NO tocar:** no refactor masivo; mantener árboles mobile/desktop donde difieren estructuralmente (tabla vs cards).

### PR-G — Verificación y blindaje de escala (P2)

- **Objetivo:** demostrar 5.000 clínicas / informes scoped y blindar el único correctivo.
- **Alcance:** test de 5.000 clínicas (paginación/búsqueda); cache corto o count aproximado para `audit_log`; documentar que reports es clinic-scoped por contrato. **Sin migrations salvo autorización.**

### PR-H — Command Bar advisory/diseño (P2)

- **Objetivo:** diseño conceptual (no código) de Cmd+K: comandos de navegación + búsqueda clínicas/informes, permisos por comando, confirmación de acciones, auditabilidad, equivalente mobile.
- **Alcance:** documento de arquitectura + contrato de endpoints (reusar `getAdminClinics`/`reports/search`). **Acciones destructivas/impersonation fuera del MVP.**

### PR-I — Overlays/anchor audit (P3)

- **Objetivo:** auditar kebab/module-menu/notificaciones/popovers y decidir Radix vs Anchor Positioning futuro.
- **Alcance:** solo diagnóstico + roadmap; **no** adoptar anchor positioning ahora.

> Nota de contrato (PR separado, fuera de E–I): si se quiere **25/50/100 real** en desktop, requiere relajar el no-scroll a scroll acotado al body de la tabla. Va alineado al rediseño a nav horizontal ya auditado en `docs/audit`.

## 14. Criterios de aceptación por PR

- **PR-E:** e2e no-scroll sigue verde **y se amplían viewports** (p.ej. 360×640, 412×915, landscape corto); ninguna métrica `scrollHeight>clientHeight+1`; ningún `line-clamp` recortando texto crítico en los nuevos tamaños; `pnpm --dir frontend lint/typecheck/build` + `pnpm validate:local` verdes; sin cambios de deps/backend.
- **PR-F:** componente piloto rinde igual o mejor en mobile/desktop; reducción medible de markup duplicado; tests de densidad existentes (`admin-overview-clinics-enterprise-density`, `admin-audit-enterprise-density`) alineados in-PR; sin dep nueva.
- **PR-G:** test de 5.000 clínicas pasa con tiempos acotados; no se carga dataset masivo en memoria; count del audit con coste acotado.
- **PR-H:** documento aprobado; cero código productivo; permisos y auditabilidad especificados.
- **PR-I:** documento aprobado; cero cambios runtime.

## 15. Riesgos

- **CSS de alta especificidad y `.next` cache:** editar `globals.css` con dev server caído sirve CSS viejo en Playwright → **borrar `frontend/.next`** antes de re-correr (`project_next_cache_stale_css_e2e`).
- **Tests source-contract que fijan estructura/densidad:** varios `test/*-contract.test.ts` y `*-enterprise-density.test.ts` pinnean `.tsx`/clases; **alinear en el mismo PR** (`project_dashboard_single_viewport_app_shell`).
- **Scope tests legacy por working-tree diff** y **regeneración de `next-env.d.ts`** tras e2e (`project_legacy_scope_tests_working_tree`, `feedback_next_env_regeneration`).
- **Regresión de bleed-through mobile:** el stage persistente (#1074) es frágil al stacking context; PR-E no debe introducir `transform`/`opacity`/`filter` nuevos en ancestros persistentes (`project_admin_mobile_hub_stage`).
- **Container queries:** riesgo de complejidad si se generaliza de golpe — limitar a pilotos.

## 16. Tests necesarios

- **E2E:** ampliar matriz de viewports mobile (alturas cortas + landscape); reusar el `readShellContract` existente; aserción nueva de "texto no recortado" donde aplique.
- **Source-contract:** actualizar density/estructura pinneadas que cambien.
- **Escala (PR-G):** seed/integration de 5.000 clínicas validando paginación, búsqueda y tiempos; contract de que reports es clinic-scoped.
- **Seguridad (PR-H, si avanza a código):** permisos por comando, separación `admin_session_id`/`app_session_id`, no exponer tokens/cookies, no cachear privados en SW.
- **Regresión:** `pnpm --dir frontend lint/typecheck/build` + `pnpm validate:local`.

## 17. Qué NO tocar

- Contrato no-scroll del App Shell y `overflow:hidden` de chrome mobile.
- Stage persistente / cadena de paint opaca anti-bleed-through (#1071–#1074).
- Navegación vía `PublicRouteControl` (no introducir `next/link` ni `<a>`) (`project_frontend_navigation_hardening`).
- Señal `admin-hub-reset` y la lógica de `activeModule` (`project_admin_controller_hub_reset_signal`).
- Backend, DB, migrations, dependencias, lockfiles, CI.
- Fronteras de seguridad: sesiones, RBAC, sanitización de auditoría, no exponer secretos.

## 18. Confirmación

- ✅ **No se modificó código** (solo lectura durante la auditoría).
- ✅ **No se crearon commits.**
- ✅ **No se abrió PR.**
- ✅ **No se tocó backend** (solo inspección de lectura para auditar escala).
- ✅ **No se tocaron dependencias / lockfiles / CI.**
- ✅ Working tree limpio en `main @ 23bb932` antes de este documento.

---

**Decisión final para VETNEB:** ahora → **PR-E** (terminar el sistema fluido, prioridad mobile). Después → **PR-F** (container queries quirúrgicas) y **PR-H** (Command Bar advisory). Verificación → **PR-G**. Diferir → **PR-I/anchor**, scroll desktop 25/50/100 (PR de contrato aparte), y descartar como sobredimensionado TanStack, MiniSearch, SSE, Redis, Kafka/RabbitMQ y micro-frontends.
