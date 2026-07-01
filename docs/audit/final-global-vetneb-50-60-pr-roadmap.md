# Final Global VETNEB — Auditoría de cierre del bloque #1164–#1222 y roadmap de los próximos 50–60 PRs

> **PR-FINAL-0 — docs-only.** Auditoría global final que cruza las auditorías y los 59 PRs mergeados
> entre 2026-06-29 y 2026-07-01 (#1164–#1222) y los convierte en un roadmap único, priorizado y
> trazable de 57 PRs (R-01..R-57; R-58/R-59 reservados condicionales — rango 50–60 preservado).
> **No implementa código. No modifica ningún documento existente.**
> Ampliado por **PR-GA-1 (docs-only)** con la evaluación de herramientas §5.5, sin cambiar
> hallazgos, severidades ni la numeración R-01..R-55 ya publicada.

---

## 0. Confirmaciones de sesión

| Campo | Valor |
|---|---|
| Fecha | 2026-07-01 |
| Repositorio | Portal VETNEB (`C:\PORTAL-VETNEB`) |
| Base | `main @ 5d3a565 feat(admin): adapt users roles server pagination to viewport (#1222)` |
| Rama de este PR | `docs/global-vetneb-final-audit-roadmap` |
| Working tree inicial | Limpio |
| Modelo | Fable 5 (`claude-fable-5`) |
| Esfuerzo | Máximo |
| Skill principal | `vetneb-web-end-to-end-global` |
| Skills complementarias | `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` · `vetneb-lanzamiento-mantenimiento` |
| Guardrails aplicados | Protocolo VETNEB de las skills cargadas: docs-only; sin `git add/commit/push/gh pr`; sin tocar frontend/src, backend, API, auth, DB, migrations, deps, lockfiles, CI, snapshots ni secretos; PNPM/PowerShell como entorno de referencia |
| ZIPs de skills | **No se tocó, copió, descomprimió ni versionó ningún ZIP/carpeta de skills.** Las skills se invocaron exclusivamente por el mecanismo estándar de sesión. |
| Alcance de archivos | **Un único archivo nuevo:** `docs/audit/final-global-vetneb-50-60-pr-roadmap.md`. Cero archivos existentes modificados. |

**Fuentes obligatorias leídas (18):** las 8 auditorías de `docs/audit/` y los 10 documentos de
`docs/implementation/` listados en §2, más el historial git de `main` para la lista exacta #1164–#1222.

---

## 1. Resumen ejecutivo

### 1.1 Qué quedó realmente mejor desde el 29/06

1. **Backend CORS deduplicado** (#1164–#1170): los helpers de origen ahora son compartidos en rutas
   admin, públicas, auth, logística, study-tracking y SLA. Cualquier hardening futuro de CORS se hace
   en un solo lugar.
2. **Higiene de repo cerrada con evidencia** (#1172–#1187): módulo `shared/` muerto eliminado, deps
   frontend no usadas removidas (core, radix, tooling eslint), artefactos históricos purgados,
   taxonomía documental cerrada y CI que salta PRs docs-only.
3. **Lote 0 visual del roadmap de ingeniería EJECUTADO COMPLETO** (#1197–#1203): PR-VIS-1..7 reales
   (dark-mode muerto, badge tokenizado, `user-select` acotado, tokens de elevación/gradiente/focus,
   primitivas select/textarea/label, FilterBar unificado, primitivas token-card). El drift de marca
   señalado por la auditoría visual quedó materialmente reducido.
4. **Red de regresión visual creada** (#1204–#1209): axe en rutas clave, 30 baselines Chromium-Linux
   (público + autenticado + stress, 5 viewports) y workflow manual `workflow_dispatch`. Nivel 2 de la
   matriz de PR-VIS-10, sin gate todavía — por decisión fundada, no por omisión.
5. **Contrato adaptativo de cardinalidad pasó de doctrina a producción** (#1211–#1222): matriz global
   → piloto Clínica Tokens → foundation `useAdaptiveItemsPerPage` → baseline e2e observable → 3
   módulos cliente migrados (Tokens, Informes summary, Maintenance dry-run) → política de servidor
   escrita (PR-SRV-0) → **2 módulos Admin servidor migrados y con dualidad desktop/mobile colapsada**
   (Sessions #1221, Users/Roles #1222), con anti-race, recompute de offset y shims de compatibilidad.
6. **Logística clínica rediseñada** (#1219): lista compacta + `ModuleDialog`, sin inner-scroll ni
   detalle inline, patrón alineado con Informes summary.

### 1.2 Hallazgo rector de esta auditoría: asimetría visual vs software

El bloque 29/06–01/07 ejecutó **~10 PRs del carril visual** del `total-engineering-roadmap`
(PR-VIS-0..9 equivalentes) y **0 PRs del carril de software duro**: PR-SEC-2 (ADR + guard
anti-IDOR), PR-SEC-1 (sanitizar 4xx), PR-DX-1, PR-CLEAN-1 backend, PR-TYPE-1, PR-LINT-1, PR-COV-1,
PR-FE-TEST-1, PR-E2E-1 y PR-OBS-1 siguen todos **Pending**, exactamente como el 30/06. La deuda
más severa del sistema (ENG-P1-001, aislamiento multi-tenant sin defensa en profundidad) no avanzó
ni siquiera en su fase docs+test que **no requiere autorización alguna**. Este roadmap corrige esa
asimetría: intercala el lote 0 de software (F6) sin frenar el momentum server-adaptive (F1).

### 1.3 Deuda abierta VISIBLE para el usuario

| Deuda | Superficie | Evidencia |
|---|---|---|
| 5 módulos Admin con cardinalidad fija + `matchMedia` (gap muerto en pantallas altas, clipping bajo zoom, dualidad desktop/mobile viva) | Clínicas, Informes workflow, Tokens admin, Auditoría, Alertas login | PR-SRV-0 §4 (inventario), matriz §4.1 |
| Ruta full `/dashboard/informes` fija en 6 filas | Clínica | PR-SRV-0 §4 (#8) |
| Overflow interno **medido** del hub Clínica: 12px en tablet 768×1024 y **238px en mobile 390×844** (`dashboard-inline-list`) | Clínica hub | `global-adaptive-dashboard-contract-baseline.md` (deuda observada, no corregida) |
| Tokens Clínica: fetch cap fijo `limit: 10` — en viewports altos la medición puede pedir más filas de las que el fetch trae → reaparece el gap | Clínica Tokens | `clinic-tokens-adaptive-rows-per-page.md` (scope excluido) |
| Particular sin polish premium móvil ni timeline; experiencia autenticada nunca validada | Particular | baseline #1214: sólo entrada pública no autenticada |
| Logística full-pages (visitas/rutas/métricas) sin contrato adaptativo verificado | Clínica | matriz §4.2: **NO CONFIRMADO** |
| Público: cero baseline visual y cero first-fold e2e fuera de `/` y `/login` | Público | PR-VIS-10 §2 |

### 1.4 Deuda técnica INVISIBLE pero crítica

Sin cambios desde el 29/06 (toda con ID vigente en `total-software-engineering-audit.md`):

- **ENG-P1-001** — RLS = 0, conexión privilegiada; aislamiento 100% de aplicación sin red DB.
- **ENG-P1-006 / ENG-P2-006** — observabilidad console-only (#1185 la *documentó*, no la resolvió).
- **ENG-P1-002/003/005** — cobertura sin medir, frontend sin unit tests, backend sin linter.
- **ENG-P1-004 ≡ VIS-P0-001** — E2E Chromium-only contra `next dev`; cero WebKit/Firefox/device real.
- **ENG-P2-001** (leak pg-code en 4xx, CWE-209) · **ENG-P2-008** (CSP report-only) ·
  **ENG-P2-002** (zod v3/v4 dual) · **ENG-P1-007** (`api.ts` 2371 LOC) · **ENG-P2-009** (sin IaC).
- Nueva deuda invisible generada por el propio bloque: `MasterDetailWorkspace` es **código muerto
  pinneado por tests** que afirma `overflow-y-auto` + `calc(100vh-13rem)` — patrones que el contrato
  global prohíbe (evidencia: `adaptive-master-detail-workspace.md`); shims de compatibilidad
  `AdminMobileSessionsModule`/`AdminMobileUsersModule` (`return null`) pendientes de limpieza final.

---

## 2. Matriz de auditorías usadas

| # | Documento | Aporte real | Riesgo que cubre | Limitación | Cómo aumenta el valor de los próximos PRs |
|---|---|---|---|---|---|
| 1 | `audit/design-system-contract.md` | Congela reglas de gobierno visual (1 causa raíz/PR, tokens obligatorios, no-scroll, mobile/tablet/desktop) | Drift de marca y mega-PRs visuales | No cierra VIS-P1-001 (extracción `globals.css` diferida); subordinado a los rectores | Sus no-go son el checklist heredado de todo PR visual de este roadmap (F1–F8) |
| 2 | `audit/global-zero-scroll-adaptive-dashboard-matrix.md` | Matriz módulo×familia×estrategia con evidencia real (constantes, `matchMedia`, overflow) + 13 reglas de contrato | Migrar cardinalidad a ciegas; gap/clipping/scroll | Parcialmente desactualizada: Sessions/Users ya migrados; PR-MD-1 quedó bloqueado; estrategias por módulo superadas por PR-SRV-0; logística rutas/métricas NO CONFIRMADO | Sigue siendo el inventario canónico de lo pendiente (Clinics/Reports/Tokens/Audit/Alerts/informes-route) — alimenta R-01..R-16 |
| 3 | `audit/pr-vis-10-visual-regression-matrix.md` | Inventario exacto (3 specs, 30 PNG, 5 viewports) + niveles 0–4 + checklist pre-gate | Activar un gate visual prematuro y flaky | No midió runtime CI real ni reproducibilidad en Actions | Define el camino Level 2→3 con criterios objetivos → R-24..R-27 |
| 4 | `audit/pr-vis-11-manual-visual-regression-workflow.md` | Workflow manual operativo + procedimiento formal ante diff visual | Regresión visual inoperable o aprobaciones sin proceso | El workflow **no registra aún ninguna corrida**; evidencia = 0 | Da el mecanismo exacto para producir la evidencia que el gate exige (R-24) |
| 5 | `audit/total-engineering-roadmap.md` | Orquesta los 52 hallazgos VIS+ENG en 48 PRs con dependencias duras, gates y autorizaciones | Ejecutar sin orden, sin trazabilidad, sin precedencias (coverage antes de thresholds, baseline antes de CSS global, OBS antes de RLS) | No incorpora la vía adaptativa/enterprise (PR-ENT/GLOBAL/SRV/CORE) → doble contabilidad y colisiones de IDs (§4.1) | Este roadmap hereda sus precedencias duras y resuelve las colisiones con la tabla de equivalencias §4.2 |
| 6 | `audit/total-software-engineering-audit.md` | 26 hallazgos ENG con evidencia dura (RLS=0, `logger:false`, 2896 tests sin %) | Fuga cross-tenant, incidentes ciegos, regresión sin red | Estática, sin acceso productivo; su lote 0 sigue sin ejecutarse | Define F6/F7 de este roadmap con IDs estables y validaciones ya escritas |
| 7 | `audit/total-visual-engineering-audit.md` | 26 hallazgos VIS; dictamen honesto ("premium profesional, no extremo certificable") | Drift visual silencioso; falta de garantías de ingeniería visual | Pre-#1197..#1209: varios hallazgos ya cerrados; su estado necesita re-baseline documental | La lista VIS restante (NAV-1, TYPO-1, STATE-1, CSS-1, CATALOG, CLEANUP) queda registrada como fase visual diferida (§6, nota F8) |
| 8 | `audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md` | North star + 5 capas + scoring de 18 propuestas + waves; anti-sobreingeniería explícita (registries sólo con 2º consumidor) | Features sueltos sin sistema; abstraer antes de tiempo | Depende de NO CONFIRMADO backend (bulk/export/SLA/search); scores son asesoría | Prioriza los quick-wins frontend-only (Alert Center, Timeline, Audit Inspector) agendados en F8 |
| 9 | `implementation/adaptive-items-per-page-foundation.md` | Contrato del hook global (`containerNode`, fallback, clamps, rAF, sanitización) | Re-implementación divergente de medición por módulo | No migra módulos por sí mismo | Todo PR adaptativo restante consume el mismo contrato sin re-diseñarlo |
| 10 | `implementation/global-adaptive-dashboard-contract-baseline.md` | Baseline e2e observable (scroll interno medido, cardinalidad comparada 1080 vs 720) + deuda medida del hub | Regresión geométrica silenciosa al migrar | Informativa, no gate; Particular autenticado sin fixture | Convierte cada migración en verificable; su deuda medida origina R-10 y R-17 |
| 11 | `implementation/server-adaptive-pagination-strategy.md` | Política por módulo (HY/OF/RF), recompute de offset, anti-race, colapso de dualidad; segmentación en 3 subgrupos servidor | El riesgo P1 de red/carreras de la familia C | Tokens admin sin `total`; volumen de Alertas sin confirmar; informes-route sin diseño de traspaso viewport→server component | Es el contrato de ejecución literal de R-01..R-07 |
| 12 | `implementation/admin-sessions-server-adaptive-pagination.md` | Primer patrón servidor completo: runtime único, shim, request-id anti-race, selectores e2e preservados | Dualidad y `matchMedia` en el módulo de mayor sensibilidad (sesiones) | Un solo módulo | Plantilla literal para los 5 módulos servidor restantes |
| 13 | `implementation/admin-users-roles-server-adaptive-pagination.md` | Segunda ejecución + solución al contrato legacy de 9 filas (piso `minItems` en desktop) | Inestabilidad cross-platform de la medición (margen sub-pixel) | La excepción de piso fijo contradice el contrato puro de medición (registrada, no silenciada) | Documenta cómo tratar contratos legacy de N filas al migrar los siguientes módulos |
| 14 | `implementation/clinic-tokens-adaptive-rows-per-page.md` | Piloto: probe de token CSS `--dash-row-h`, descuento de `thead`, preservación de fallback | Cardinalidad fija en el módulo de mayor gap | Fetch cap 10 fijo quedó fuera de scope → contradicción interna (§4.3) | Patrón de medición de fila real reutilizado por todos los módulos posteriores |
| 15 | `implementation/clinic-logistics-master-detail-workspace.md` | Rediseño validado: lista compacta + `ModuleDialog`, sin `dashboard-inline-scroll` | Inner-scroll y detalle inline en logística summary | No toca rutas full-page de logística | Valida el patrón que R-12..R-14 replican en las rutas full |
| 16 | `implementation/adaptive-master-detail-workspace.md` | Condición de parada documentada: `MasterDetailWorkspace` sin consumidores runtime, pinneado por tests con overflow prohibido | Tocar código muerto con contratos activos | Deja la primitiva viva como deuda | Habilita R-15 (eliminación) con la evidencia ya reunida |
| 17 | `implementation/admin-client-adaptive-dashboard-module.md` | Maintenance dry-run adaptativo; descarta Pricing con razón de diseño (wizard 1 ítem/página intencional) | Migrar por inercia un módulo cuyo contrato de diseño lo prohíbe | Sólo familia A admin | Fija que Pricing es QA-no-scroll-only: evita un PR erróneo futuro |
| 18 | `implementation/next-client-adaptive-dashboard-module.md` | Informes summary (familia B) medible con detalle en dialog | Master-detail con lista mal medida | No toca la ruta full de informes | Patrón lista+dialog medible reutilizado por logística y por R-07 |

---

## 3. Matriz de PRs recientes #1164–#1222 por bloque

59 PRs verificados en `git log`. Los bloques se solapan deliberadamente donde un PR sirve a dos ejes
(p. ej. #1221/#1222 son Admin **y** adaptive).

| Bloque | PRs | Qué deuda redujo | Qué deuda NO redujo | Qué valor habilita |
|---|---|---|---|---|
| **Backend cleanup (CORS)** | #1164–#1168, #1170 (código) + #1169, #1171 (cierres docs) | Duplicación de origin-helpers en 6 grupos de rutas; superficie de mantenimiento CORS | CSP report-only (ENG-P2-008), leak 4xx (ENG-P2-001), observabilidad (ENG-P1-006), RLS (ENG-P1-001) | Hardening CORS futuro en un solo punto; menos ruido para el lote 0 backend (F6) |
| **Frontend/shared/deps cleanup** | #1172–#1179, #1183 | Módulo `shared/` muerto; deps core/radix/eslint sin uso; artefactos históricos huérfanos | zod dual major (ENG-P2-002), `api.ts` monolítico (ENG-P1-007), `MasterDetailWorkspace` muerto | Lockfile más chico (menos supply-chain); refactors F8 sobre árbol limpio |
| **Visual system (PR-VIS + filtros)** | #1188–#1191, #1197–#1203 | VIS-P1-003/004/008/006 y VIS-P2-001/002 cerrados; VIS-P1-005 (FilterBar) y VIS-P1-002 (token-card, fase visual) ejecutados; filtros avanzados admin/clínica | Extracción `globals.css` (VIS-P1-001 f2), NAV/TYPO/STATE/CATALOG/CLEANUP, dominio duplicado tokens (ENG-P2-004) | PRs visuales futuros con tokens/primitivas estables; regresión visual con menos ruido de base |
| **Visual regression + a11y** | #1204–#1207, #1209 (+#1208 docs) | VIS-P0-002 parcial (baselines existen); VIS-P1-007 parcial (axe rutas clave) | **Cross-browser sigue 100% abierto** (VIS-P0-001 ≡ ENG-P1-004); gate inexistente; runtime CI sin medir; reproducibilidad Actions sin probar | Aprobar/rechazar diffs con evidencia; camino Level 2→3 definido |
| **Adaptive dashboard (fundación/contrato)** | #1211, #1212–#1215 (+#1210 visión) | Cardinalidad fija en piloto; ausencia de hook global; ausencia de baseline geométrico e2e | Los 6 módulos servidor restantes; hub clínica; particular; fetch cap tokens | Toda migración posterior es composición del mismo contrato + verificable por e2e |
| **Admin** | #1217, #1221, #1222 (+#1189, #1190 filtros) | 2/8 módulos servidor migrados con dualidad colapsada y `matchMedia` eliminado; Maintenance (familia A) adaptativo; filtros avanzados | Clinics/Reports/Tokens/Audit/Alerts/informes-route fijos; `matchMedia`-cardinalidad vivo en 3 módulos; shims y `MOBILE_PAGE_SIZE` residuales | Patrón servidor probado 2× (HY, anti-race, recompute) listo para replicar en serie |
| **Clínica** | #1212, #1213, #1216, #1219 (+#1191 filtros) | Tokens e Informes summary adaptativos; logística summary sin inner-scroll ni detalle inline | Hub con overflow medido (12/238px); logística full-pages sin verificar; fetch cap 10 en Tokens | Familias A y B cerradas en las summaries; patrón dialog validado para las rutas full |
| **Docs/release/gobernanza** | #1169, #1171, #1180–#1182, #1184–#1187, #1192–#1196, #1208, #1210, #1211, #1218, #1220 | Taxonomía docs cerrada; CI docs-skip; deuda de observabilidad **documentada**; rectores publicados (2 auditorías totales + roadmap + contrato DS + advisory + matriz + política servidor) | Ninguna deuda de runtime (por diseño); la observabilidad quedó documentada pero no resuelta | Trazabilidad completa: este roadmap existe porque ese corpus existe |

**Lectura transversal:** 24 de los 59 PRs son docs-only (~41%). Es correcto para una fase de
gobernanza, pero la proporción debe invertirse en la próxima ventana: este roadmap fija ~85% de PRs
con efecto en runtime o en red de pruebas.

---

## 4. Cruce de hallazgos: duplicaciones, contradicciones y huecos

### 4.1 Duplicaciones detectadas

1. **Dos sistemas de roadmap coexisten sin reconciliar.** `total-engineering-roadmap` (48 PRs,
   espacio VIS/ENG) y la vía adaptativa/enterprise (matriz §11 + advisory §16 + PR-SRV-0, espacio
   PILOT/CORE/SRV/OPS/ADMIN/CLINIC). Ninguno referencia al otro. Riesgo real: doble contabilidad de
   la misma deuda y PRs "ya hechos" que siguen Pending en el tablero del otro documento. **Este
   documento unifica ambos en el espacio R-xx (§6) con la tabla de equivalencias §4.2.**
2. **PR-VIS-7 (#1203) vs PR-DUP-1 (ENG-P2-004):** mismo par de archivos
   (`AdminParticularTokensCard` + `ClinicParticularTokensCard`). La extracción **visual** ya se hizo;
   la extracción de **dominio/hook** sigue abierta. Riesgo: darla por cerrada. → R-48.
3. **Cross-browser triplicado** (VIS-P0-001 ≡ ENG-P1-004; y Level 4 de la matriz VR): tres documentos
   lo describen, cero lo ejecutó. La regresión visual Chromium-Linux **no** lo cierra. → R-38 + R-39.
4. **FilterBar unificado (#1202) vs `SmartFilterBar` (advisory CORE-6):** posible solape. Regla de
   este roadmap: CORE-6 **no se abre** sin verificar primero qué le falta al contrato de #1202
   (persistencia/medición) — si el delta es chico, se hace como extensión, no como primitiva nueva.
5. **Dos redes de verificación geométrica/visual** (baseline adaptativa #1214 vs snapshots
   #1205–#1207): complementarias, no duplicadas — pero ambas Chromium-only, y las dos quedarán
   afectadas por las migraciones server-adaptive (diffs esperados). → R-26 coordina la regeneración.

### 4.2 Contradicciones detectadas (con resolución)

| # | Contradicción | Documentos | Resolución adoptada por este roadmap |
|---|---|---|---|
| C1 | El roadmap ENG define PR-VIS-9 con "diff>threshold **bloquea** P0/P1"; PR-VIS-10 (#1208) manda expresamente **no** activar gate (Level 2 primero) | roadmap §7 vs pr-vis-10 §5 | Prevalece la evidencia de #1208/#1209: gate sólo tras corridas limpias medidas → R-27 |
| C2 | La matriz ordenaba PR-MD-1 sobre `MasterDetailWorkspace`; la ejecución probó que **no tiene consumidores runtime** y está pinneado por tests con `overflow-y-auto`+`calc(100vh)` prohibidos por el propio contrato | matriz §11 vs adaptive-master-detail-workspace | La primitiva es deuda muerta pinneada: se elimina con sus contratos (R-15), no se adapta |
| C3 | La matriz §4.1 recomendaba "re-fetch debounced" para Sessions/Roles; PR-SRV-0 decidió **HY** y así se implementó (#1221/#1222) | matriz vs PR-SRV-0 §5 | PR-SRV-0 prevalece; la matriz queda como inventario, no como política |
| C4 | "PR-SRV-2" = lote Clinics/Tokens/Informes/Reports en la matriz, pero el PR mergeado #1222 usó "PR-SRV-2" para Users/Roles | matriz §11 vs implementation SRV-2 | Numeración por módulo, nunca por lote: R-01..R-07 (1 módulo = 1 PR) |
| C5 | Regla del contrato: "cardinalidad sólo por medición" vs Users/Roles desktop con **piso fijo `minItems=9`** para preservar `expectNinePopulatedRows` | matriz §3 vs implementation SRV-2 | Excepción aceptada y registrada; se revisa cuando se regeneren los contratos desktop legacy (nota en R-26) |
| C6 | Piloto Tokens: `rowsPerPage` medido (hasta 50) convive con fetch cap fijo `limit: 10` → en viewports altos reaparece el gap que el piloto vino a eliminar | clinic-tokens §scope excluido | Contradicción interna reconocida → R-16 (superset de fetch derivado) |
| C7 | Colisiones de IDs: `PR-VIS-10`/`PR-VIS-11` significan una cosa en el roadmap ENG (proyectos webkit/firefox; Lighthouse) y otra en los PRs mergeados (#1208 matriz VR; #1209 workflow manual). `PR-CLEAN-1` = handler backend legacy (roadmap ENG) y también = limpieza `matchMedia`/`MOBILE_PAGE_SIZE` (matriz) | roadmap ENG vs merges | Tabla de equivalencias: webkit/firefox → **R-38**; CWV/Lighthouse → registrado fuera de ventana; handler backend → **R-31**; limpieza matchMedia → **R-08** |

### 4.3 Deuda que sigue visible aunque los PRs técnicos fueron correctos

Los PRs #1212–#1222 son técnicamente correctos y sin embargo el usuario final **todavía ve**: gap
muerto/clipping en 5 módulos Admin, 238px de overflow en el hub Clínica mobile, 6 filas fijas en la
ruta full de informes, y un Particular sin polish. La lección operativa: **la fundación no reduce
deuda visible por sí sola; sólo la reduce la migración módulo a módulo.** Por eso F1–F4 de este
roadmap son migraciones y fixes visibles, no más fundación.

### 4.4 Roles NO auditados de forma completa

| Rol/superficie | Estado de auditoría | Hueco concreto | PR que lo cierra |
|---|---|---|---|
| **Particular autenticado** | ❌ Nunca validado | Sin fixture e2e de sesión particular; baseline #1214 sólo cubre la entrada pública no autenticada | R-17, R-18 |
| **Público (más allá de `/` y `/login`)** | ❌ Parcial | Sin baseline visual ni first-fold e2e en servicios/precios/clinicas/contacto/profesionales/particulares-landing; axe sólo en "rutas clave" | R-20..R-23 |
| **Logística full-pages (rutas/métricas)** | ❌ NO CONFIRMADO en la propia matriz | Paginación/overflow jamás verificados | R-11..R-14 |
| **Mobile Android/iOS real** | ❌ Cero evidencia | Todos los documentos lo marcan "QA manual obligatorio"; ninguno lo ejecutó | R-39 + regla §8.6 |
| **Auth/permisos** | ⚠️ Sólido estático, sin red | Sin ADR ni guard anti-IDOR (test); proxy admin revela ruta (redirect vs 404) | R-28, R-33 |
| **Admin** | ✅ El rol mejor auditado (matriz + PR-SRV-0 + 3 migraciones) | Restan 5 módulos servidor | R-01..R-06 |
| **Clínica** | ✅ Bien auditado en summaries | Hub y rutas full | R-10..R-16 |

---

## 5. Riesgos consolidados P1/P2/P3

| Superficie | Sev | Riesgo | Evidencia | Mitigación (PR) |
|---|---|---|---|---|
| **Admin** | P1 | `matchMedia` decide cardinalidad en Clinics/Reports/Tokens (gap/clipping + dualidad + doble fetch) | PR-SRV-0 §4, subgrupo 2 | R-02, R-03, R-05 |
| **Admin** | P1 | Tokens admin sin `total` en el endpoint → sin `pageCount`, clamp imposible | PR-SRV-0 §5 (bloqueado) | R-04 (decisión) → R-05 |
| **Admin** | P2 | Auditoría de alto volumen: re-fetch sin medir payload real | PR-SRV-0 §5 | R-06 |
| **Admin** | P2 | Shims compat + `MOBILE_PAGE_SIZE` residuales tras migraciones | implementation SRV-1/2 | R-08, R-09 |
| **Admin** | P3 | Pricing wizard: riesgo de "migración" errónea a más-filas | admin-client doc | Regla: QA no-scroll only |
| **Clínica** | P1 | Overflow interno medido del hub: 238px en 390×844 | baseline #1214 | R-10 |
| **Clínica** | P2 | Logística full-pages sin contrato verificado (NO CONFIRMADO) | matriz §4.2 | R-11..R-14 |
| **Clínica** | P2 | Tokens: fetch cap 10 vs medición >10 → gap en pantallas altas | §4.3-C6 | R-16 |
| **Clínica** | P3 | `MasterDetailWorkspace` muerto pinneado con overflow prohibido | #1218 | R-15 |
| **Particular** | P1 (de rol) | Superficie autenticada jamás auditada; sin fixture | baseline #1214 | R-17, R-18 |
| **Particular** | P2 | iOS `dvh`/safe-area/touch sin device QA | matriz familia F | R-18, R-39 |
| **Particular** | P3 | Timeline simple ausente (confianza/claridad) | advisory §7.3 | R-19 |
| **Público** | P2 | Sin baseline visual ni first-fold fuera de `/` y `/login` | PR-VIS-10 §2 | R-20, R-21 |
| **Público** | P2 | axe sólo en rutas clave | #1204 | R-22 |
| **Auth/permisos** | P1 | Sin guard anti-IDOR ni ADR de aislamiento (fase docs+test, sin autorización requerida, aún no hecha) | ENG-P1-001 f1 | R-28 |
| **Auth/permisos** | P1 | Acciones enterprise futuras sin `useActionPermissions` central → fuga de acción por rol | advisory §13 | R-43 **antes** de R-44 |
| **Auth/permisos** | P2 | Proxy admin sin cookie → redirect (revela ruta) en vez de 404 | ENG-P3-005 | R-33 |
| **Mobile Android/iOS** | P1 | Cero evidencia en device real de todo el bloque adaptativo | todos los docs QA | R-39 + regla §8.6 |
| **Zero-scroll externo** | P2 | Regresión de scroll global al migrar los server restantes | baseline e2e existente | e2e dirigido por PR (regla §8.8) |
| **Zero-scroll interno** | P1 | Hub clínica (medido) + módulos admin fijos bajo zoom alto | #1214 + matriz | R-10 + F1 |
| **Visual regression** | P1 | Cross-browser = 0 (WebKit/Firefox/iOS) pese a triple diagnóstico | VIS-P0-001 ≡ ENG-P1-004 | R-38, R-39 |
| **Visual regression** | P2 | Workflow manual sin ninguna corrida registrada; runtime/reproducibilidad desconocidos | #1209 | R-24 |
| **Visual regression** | P2 | Baselines autenticados quedarán obsoletos con las migraciones F1 (diffs esperados) | #1206/#1207 | R-26 (regeneración autorizada) |
| **Visual regression** | P2 | Spec público sin guard de plataforma → riesgo de snapshots win32 accidentales | PR-VIS-10 §4 | R-25 (política) |
| **Server-adaptive** | P1 | Migrar sin la plantilla SRV-1/2 (anti-race + recompute) reintroduce carreras de offset | PR-SRV-0 §3 | Regla §8.9 |
| **Server-adaptive** | P2 | Caps de superset (32/36) sin telemetría de payload | SRV-1/2 | Medir payload en cada PR F1 |
| **Server-adaptive** | P2 | Excepción `minItems=9` (contrato legacy) silenciosamente replicada en módulos donde no aplica | SRV-2 | Justificación explícita por PR |
| **Cleanup/release** | P1 | Lote 0 de software (SEC/DX/CLEAN/TYPE) congelado en Pending desde el 30/06 | roadmap ENG §24 | F6 completa |
| **Cleanup/release** | P2 | Observabilidad console-only documentada (#1185) sin resolver | ENG-P1-006 | R-50 |
| **Cleanup/release** | P2 | Cobertura/lint/unit sin medición → thresholds imposibles | ENG-P1-002/003/005 | F7 |
| **Cleanup/release** | P3 | Re-fragmentación documental (≈20 docs nuevos en 3 días) | este corpus | R-55 (índice + closeout) |

---

## 5.5 Evaluación de herramientas para máximo valor global

Evaluación explícita de herramientas nuevas o no incorporadas que pueden elevar el valor global,
con decisión razonada por fila para **no** convertir el roadmap en una lista inflada de tooling.

**Criterio de decisión (anti-inflación):**

- **Adoptar** — no agrega dependencia ni CI, o ya tiene PR receptor R-xx; valor inmediato.
- **Evaluar** — requiere un PR chico con autorización ⚠ y una verificación previa barata.
- **Diferir** — correcta pero exige estabilidad previa (gate visual, prod-mode, logger).
- **Rechazar** — duplica una capacidad suficiente ya existente o agrega ruido operativo.

**Contrato de adopción (obligatorio):** ninguna herramienta se considera adoptada sin registrar en
su doc de implementación **dueño, comando de ejecución, output esperado y rollback**. Sin esos 4
campos, la herramienta no cuenta para el criterio release-ready (§10.6).

| ID | Herramienta / familia | Deuda que ataca | Valor específico para VETNEB | Coste/riesgo | Decisión | PR receptor | Autorización |
|---|---|---|---|---|---|---|---|
| T-01 | Playwright trace/artifacts policy (`trace: on-first-retry` + retención definida) | Fallos e2e/VR sin evidencia diagnosticable (riesgo señalado por PR-VIS-10 §4) | Cada fallo del workflow #1209 y de las suites deja trace navegable; menos reruns ciegos | Nulo en deps; peso de artifacts acotado por retención | **Adoptar** | Política en R-25; activación técnica dentro de R-27 (ya ⚠ CI) | No (docs) → ⚠ CI en R-27 |
| T-02 | Gobernanza de baselines visuales (owner, entorno autorizado, procedimiento de update) | Baselines obsoletos/falsos positivos; snapshots win32 accidentales | Es literalmente la condición Level 3 del checklist de #1208 | Nulo (docs) | **Adoptar** (ya es el objetivo de R-25/R-26) | R-25, R-26 | No / ⚠ baselines |
| T-03 | `@axe-core/playwright` como fixture común | Setup axe duplicado por spec al extender cobertura a11y | Dep **ya instalada** por #1204; una fixture única extiende a11y sin copy-paste ni dep nueva | Nulo (test-only) | **Adoptar** | R-22 | No |
| T-04 | CodeQL / GitHub code scanning | ~33k LOC backend sin análisis semántico de seguridad (complementa, no reemplaza, el lint de R-34) | Detección de flujos inseguros (injection, path traversal, taint) que ESLint no ve, sobre datos clínicos multi-tenant | En repos privados exige GHAS (licencia paga); workflow CI nuevo | **Evaluar** | R-56 (decisión) → R-58 reservado (implementación ⚠ CI) | ⚠ CI condicionada a R-56 |
| T-05 | Lighthouse CI / performance budgets | CWV sin medir (VIS-P2-009) | Presupuestos de performance para las páginas públicas SEO prerenderizadas | Requiere prod-mode E2E (R-37) y gate visual estable; tooling CI | **Diferir** | Registro en R-55; fuera de ventana (ya declarado en §6) | ⚠ tooling/CI |
| T-06 | Dependabot + dependency review | Supply-chain sin revisión de diff de deps por PR | Dependabot **ya adoptado** (npm raíz+frontend+actions, weekly) y `pnpm audit` ya corre en CI; `dependency-review-action` agregaría diff de vulnerabilidades en cada PR | Requiere dependency graph (GHAS en repos privados) | Dependabot: **ya adoptado** · review: **Evaluar** | R-56 (misma decisión GHAS) → R-59 reservado (⚠ CI) | ⚠ CI condicionada a R-56 |
| T-07 | Semgrep custom rules | Patrones prohibidos (matchMedia-cardinalidad, overflow, secretos) | Bajo marginal: el repo ya institucionalizó grep-guards/source-contract tests **nativos** en `pnpm test` (R-08 agrega otro) y R-34 cubre lint estático | Dep + CI + ruleset propio a mantener; duplica el patrón nativo | **Rechazar** (revisable sólo si los guards nativos demuestran quedarse cortos) | — | — |
| T-08 | Sentry u OpenTelemetry (error-tracking / telemetry) | ENG-P1-006: incidentes ciegos | Error-tracking con contexto y alertas; **pero** VETNEB maneja datos clínicos multi-tenant → enviar errores a SaaS externo es una decisión de privacidad/datos, no de tooling | SaaS externo sin decisión de privacidad = no-go §5.5.1; OTel self-hosted = complejidad alta prematura | **Diferir** (R-50/pino primero; decisión de privacidad explícita antes de cualquier SaaS) | R-50 (precedencia) + registro en R-55; implementación en la ventana siguiente (F7 ENG) | ⚠⚠ (privacidad/datos) |
| T-09 | Allure / Monocart reporting | Legibilidad de reportes de test | Nulo marginal: Playwright HTML report + traces (T-01) cubren el caso completo | Dep nueva + otro artefacto que retener y aprender | **Rechazar** (aplica no-go §5.5.1 punto 5) | — | — |
| T-10 | Knip / depcheck (dead-code & deps scan) | Re-acumulación de código/exports/deps muertos: la limpieza #1172–#1187 fue 100% manual y `MasterDetailWorkspace` muerto (R-15) lo prueba | Automatiza como baseline lo que costó ~10 PRs de auditoría manual; corre local, informativo, sin gate | Dev-dep ⚠; falsos positivos iniciales que triagear | **Evaluar → Adoptar como baseline informativo** | R-57 | ⚠ dep |
| T-11 | GitHub Actions artifact retention policy | Artifacts sin contrato (qué se sube, con qué nombre, cuánto vive) | #1209 ya fija 14 días e `if-no-files-found: ignore`; falta la política escrita (qué retener ante diff, naming por suite/run) | Nulo (docs) | **Adoptar** | R-24/R-25 | No |
| T-12 | Device real QA kit Android/iOS (matriz de devices propios + checklist + formato de evidencia) | Cero evidencia device real (riesgo P1 de §5) | Kit propio, barato y repetible para `dvh`/safe-area/touch; un device farm SaaS (BrowserStack et al.) queda **Diferido** por costo + decisión de privacidad | Horas de QA manual | **Adoptar** (kit documentado) | R-39 | No (manual) |

**Resultado neto:** 5 **Adoptar** (todas dentro de R-xx existentes; cero dependencia nueva salvo lo
ya instalado), 3 **Evaluar** (dos condicionadas a una única decisión GHAS en R-56, más knip en
R-57), 2 **Diferir** con precedencia explícita y 2 **Rechazar** con razón registrada. Ninguna
herramienta entra sin fila T-xx, sin PR receptor ni sin contrato de adopción.

### 5.5.1 No-go tooling

- **Prohibido agregar herramientas por prestigio o moda:** toda incorporación exige fila T-xx con
  la deuda concreta que ataca y su PR receptor.
- **Prohibido meter varias herramientas en un mismo PR** (un tooling por PR — regla heredada del
  roadmap ENG F2; R-56 decide en conjunto, pero R-58/R-59 implementan por separado).
- **Prohibido activar gates blocking sin baseline medido:** aplica por igual a CodeQL, knip,
  Lighthouse y visual regression — primero corrida informativa, después gate.
- **Prohibido sumar SaaS externo sin decisión explícita de privacidad/datos:** VETNEB maneja datos
  clínicos multi-tenant; ningún error-tracker, device farm ni analytics recibe tráfico sin esa
  decisión firmada por Nico.
- **Prohibido agregar reporters si Playwright HTML report + traces cubren el caso** (T-09 rechazada
  por esta regla).

---

## 6. Roadmap final — 57 PRs (R-01..R-57, más R-58/R-59 reservados condicionales)

**Convenciones.** ID canónico `R-xx` (los números GitHub reales se asignarán al mergear, estimados
#1223+ en este orden). Validación base de todo PR de código: `pnpm test` ·
`pnpm --dir frontend lint` · `pnpm --dir frontend typecheck` · `pnpm --dir frontend build` ·
`pnpm validate:local` · e2e dirigido del módulo; se lista abajo sólo lo adicional. Prohibiciones
globales de todo PR salvo autorización explícita: backend, API, auth, DB, migrations, deps,
lockfiles, CI/workflows, snapshots, `globals.css` fuera de scope declarado. Los PRs marcados **⚠**
requieren autorización previa de Nico y no bloquean al resto.

### FASE 1 — Cierre server-adaptive Admin (R-01..R-09)

**R-01 · `feat(admin): adapt failed-login alerts server pagination to viewport`**
- Objetivo: migrar Alertas login (subgrupo 1: `total` disponible) con la plantilla SRV-1; colapsar `AdminMobileCommandModule`. Paso previo dentro del PR: confirmar volumen real (read-only) y elegir OF cap 25 vs RF según PR-SRV-0 §5.
- Rol/superficie: Admin · Alertas de login. Tipo: frontend logic. **Diferencia visual: SÍ** (filas según viewport; sin gap con dataset ≥ filas).
- Permitidos: `AdminFailedLoginAlertsReadOnlyCard.tsx`, `AdminMobileCommandModule.tsx` (shim), tests source-contract del módulo, bloque propio de la spec e2e admin-mobile-ops, doc de implementación.
- Prohibidos: otros módulos Admin, backend/API, `globals.css`, snapshots.
- Depende de: PR-SRV-0 (#1220), patrón #1221/#1222. Riesgo: P2.
- Valor: cierra el subgrupo servidor más simple restante y deja 3/8 módulos con dualidad colapsada.

**R-02 · `feat(admin): adapt clinics management server pagination to viewport`**
- Objetivo: eliminar `effectivePageSize` por `matchMedia` (subgrupo 2, peor acoplamiento); HY cap 36; preservar selección del drawer de edición al recomputar; `hasNext` por página llena documentado (sin `total` confirmado).
- Rol: Admin · Clínicas. Tipo: frontend logic. **Visual: SÍ.**
- Permitidos: `AdminClinicsManagementCard.tsx`, módulo mobile correspondiente (shim), tests del módulo, bloque e2e propio, doc.
- Prohibidos: backend (no pedir `total` nuevo en este PR), otros módulos.
- Depende de: R-01 (o directamente de #1222 si Nico prioriza). Riesgo: **P1** (drawer + heurística sin total).
- Valor: primer módulo con `matchMedia`-cardinalidad eliminado; deuda visible mayor de Admin.

**R-03 · `feat(admin): adapt reports workflow server pagination to viewport`**
- Objetivo: unificar `limit`/`offset` divergentes por rama mobile/desktop; HY cap 36; filtros server-side resetean `offset` a 0.
- Rol: Admin · Informes workflow. Tipo: frontend logic. **Visual: SÍ.**
- Permitidos: `AdminReportsCard.tsx`, módulo mobile (shim), tests, bloque e2e, doc. Prohibidos: `AdminReportsUploadPanel`, backend.
- Depende de: R-02 (patrón mm-cardinalidad probado). Riesgo: P1.
- Valor: el módulo operativo diario de Admin queda adaptativo con filtros coherentes.

**R-04 · `docs(admin): confirm particular tokens total contract`**
- Objetivo: verificar (read-only) si el endpoint de tokens admin puede exponer `total`; decidir OF+"cargar más" (sin backend) vs cambio backend ⚠; dejar la decisión escrita.
- Rol: Admin · Tokens. Tipo: docs-only. **Visual: NO** (deuda que elimina: bloqueo explícito de PR-SRV-0 §5).
- Permitidos: sólo `docs/**`. Depende de: —. Riesgo: P3.

**R-05 · `feat(admin): adapt particular tokens server pagination to viewport`**
- Objetivo: ejecutar la decisión de R-04 (default sin backend: OF con cap + "cargar más", `hasNext` sin `pageCount`); colapsar dualidad.
- Rol: Admin · Tokens particulares. Tipo: frontend logic. **Visual: SÍ.**
- Permitidos: `AdminParticularTokensCard.tsx`, módulo mobile (shim), tests, bloque e2e, doc. Prohibidos: backend salvo que R-04 lo autorice ⚠.
- Depende de: R-04. Riesgo: P1 (sin total; archivo de 1.9k LOC).
- Valor: último módulo con `matchMedia`-cardinalidad; coordina con R-48 (no mezclar dominio aquí).

**R-06 · `feat(admin): adapt audit server pagination to viewport`**
- Objetivo: RF debounced (alto volumen) con medición de payload previa dentro del PR; colapsar `AdminMobileAuditModule`.
- Rol: Admin · Auditoría. Tipo: frontend logic. **Visual: SÍ.**
- Permitidos: `AdminAuditCard.tsx`, `AdminAuditDenseTable.tsx`, `admin/page.tsx` (estado `page`), módulo mobile (shim), tests, bloque e2e, doc.
- Depende de: R-03. Riesgo: P2. Valor: única superficie RF del sistema, validando la tercera estrategia de PR-SRV-0.

**R-07 · `feat(dashboard): adapt informes full route server pagination`**
- Objetivo: diseñar y ejecutar el traspaso viewport→server component (client wrapper) para `/dashboard/informes`; RF con `limit` derivado.
- Rol: Clínica · Informes full route. Tipo: frontend logic. **Visual: SÍ.**
- Permitidos: `app/dashboard/informes/page.tsx` + wrapper cliente nuevo, tests, e2e propio, doc. Prohibidos: `ClinicInformesWorkspaceSummary` (ya migrado), backend.
- Depende de: R-06 (patrón RF probado). Riesgo: P1 (server component).

**R-08 · `cleanup(frontend): remove mobile page size and matchMedia cardinality sources`**
- Objetivo: PR-CLEAN-1 de la matriz: borrar `MOBILE_PAGE_SIZE` y todo `matchMedia` de cardinalidad residual; agregar **grep-guard test** que falle si reaparecen.
- Rol: Admin transversal. Tipo: cleanup. **Visual: NO** (deuda que elimina: fuentes ilegítimas de cardinalidad; criterio medible de la matriz §10.7/10.8).
- Permitidos: constantes/uso residual en `frontend/src/app/dashboard/admin/**`, test guard nuevo en `test/`, doc. Prohibidos: cualquier cambio de comportamiento.
- Depende de: R-01..R-07 completos. Riesgo: P2.

**R-09 · `cleanup(admin): remove admin mobile compat shims`**
- Objetivo: eliminar los shims `return null` (`AdminMobileSessionsModule`, `AdminMobileUsersModule` y los que agreguen R-01..R-06) y sus imports/tests residuales.
- Rol: Admin. Tipo: cleanup. **Visual: NO** (deuda: código muerto post-colapso).
- Depende de: R-08. Riesgo: P3.

### FASE 2 — Clínica restante y limpieza estructural (R-10..R-16)

**R-10 · `fix(clinic): remove hub inline-list internal overflow`**
- Objetivo: corregir la deuda **medida** por #1214: 12px (768×1024) y 238px (390×844) de scroll interno en `dashboard-inline-list` del hub; promover esa medición de informativa a asertiva para el hub.
- Rol: Clínica · hub. Tipo: frontend visual. **Visual: SÍ** (hub sin recorte en tablet/mobile).
- Permitidos: `ClinicDashboardWorkspaceController.tsx`, bloque hub del spec `dashboard-viewport-zoom-adaptability.spec.ts`, doc. Prohibidos: `globals.css` salvo el bloque del hub con autorización.
- Depende de: —. Riesgo: P2.

**R-11 · `docs(clinic): audit logistics full routes adaptive contract`**
- Objetivo: cerrar los NO CONFIRMADO de la matriz (visitas/rutas/métricas full-page): paginación real, overflow, familia; definir scope exacto de R-12..R-14.
- Tipo: docs-only. **Visual: NO.** Depende de: —. Riesgo: P3.

**R-12 / R-13 / R-14 · `feat(clinic): adapt logistics {visitas|rutas|metricas} full route`**
- Objetivo: un PR por ruta full de logística, aplicando el patrón validado (lista compacta + dialog o adaptive rows según lo que R-11 determine).
- Rol: Clínica · Logística. Tipo: frontend visual/logic. **Visual: SÍ.**
- Permitidos: la página de la ruta correspondiente + tests + e2e propio + doc. Prohibidos: las otras dos rutas, summary ya rediseñado, backend logistics.
- Depende de: R-11. Riesgo: P2 cada uno.

**R-15 · `cleanup(frontend): remove dead MasterDetailWorkspace primitive`**
- Objetivo: eliminar `MasterDetailWorkspace.tsx` (0 consumidores runtime, evidencia #1218) y los source-contract tests que pinnean su `overflow-y-auto`/`calc(100vh-13rem)`.
- Tipo: cleanup. **Visual: NO** (deuda: código muerto que contradice el contrato global y confunde a futuros PRs).
- Permitidos: la primitiva + sus tests pinneadores (`frontend-dashboard-reports-master-detail.test.ts` y afines, sólo las aserciones sobre la primitiva) + doc. Depende de: decisión explícita de Nico (alternativa: mantener como reserva, documentada). Riesgo: P3.

**R-16 · `feat(clinic): derive tokens fetch limit from adaptive superset`**
- Objetivo: resolver C6 — el fetch de Clínica Tokens pasa de `limit: 10` fijo a superset con cap coherente con `maxRows` de la medición (patrón HY cliente).
- Rol: Clínica · Tokens. Tipo: frontend logic. **Visual: SÍ** en pantallas altas (sin gap con >10 tokens).
- Permitidos: `ClinicParticularTokensCard.tsx` (sólo la capa fetch/paginado), tests, e2e parity, doc. Prohibidos: API (el endpoint ya acepta `limit`).
- Depende de: —. Riesgo: P2.

### FASE 3 — Particular (R-17..R-19)

**R-17 · `test(e2e): add particular authenticated session fixture`**
- Objetivo: crear el fixture e2e de sesión particular token-gated autenticada (hueco declarado de #1214) y el primer baseline no-scroll autenticado del rol.
- Tipo: e2e/test-only. **Visual: NO** (deuda: rol completo sin red de verificación).
- Permitidos: fixtures e2e, spec nuevo o bloque en el spec global, doc. Prohibidos: producción, backend.
- Depende de: —. Riesgo: P2 (contrato de fixture).

**R-18 · `feat(particular): polish authenticated viewport-fit states`**
- Objetivo: sub-contrato F completo en `/particulares` autenticado: `100dvh` + safe-area + touch ≥44px + estados loading/empty/error estables.
- Rol: Particular. Tipo: frontend visual. **Visual: SÍ** (mobile).
- Permitidos: `components/public/ParticularesContent.tsx`, tests, e2e del rol, doc. Prohibidos: paginación (no aplica por contrato), auth.
- Depende de: R-17. Riesgo: P2.

**R-19 · `feat(particular): add simple case timeline`**
- Objetivo: timeline simple del caso sobre `getParticularStudyTrackingCase` + `StudyTimeline` (QW del advisory §7.3).
- Tipo: frontend visual. **Visual: SÍ.** Depende de: R-18. Riesgo: P2.

### FASE 4 — Público (R-20..R-23)

**R-20 · `test(e2e): add public routes first-fold baseline`**
- Objetivo: first-fold/no-overflow e2e para servicios, precios, clinicas, contacto, profesionales y particulares-landing (hoy 0 cobertura geométrica).
- Tipo: e2e. **Visual: NO.** Depende de: —. Riesgo: P3.

**R-21 · `test(frontend): extend public visual baselines to remaining routes` ⚠ (baselines)**
- Objetivo: extender los snapshots públicos más allá de `/` y `/login`; agregar guard `linux` al spec público (riesgo win32 señalado por #1208).
- Tipo: e2e/snapshots. **Visual: NO.** Depende de: R-20, R-24. Riesgo: P2 (peso de suite — medir runtime antes).

**R-22 · `test(frontend): extend axe checks to remaining routes`**
- Objetivo: axe en el resto de rutas públicas + módulos dashboard migrados (dep ya instalada por #1204).
- Tipo: e2e. **Visual: NO.** Depende de: R-20. Riesgo: P3.

**R-23 · `fix(public): resolve defects surfaced by public baselines`**
- Objetivo: PR contingente con los defectos que R-20/R-22 revelen (scope definido por evidencia, 1 causa raíz por PR — si hay varias, se subdivide).
- Tipo: frontend visual. **Visual: SÍ.** Depende de: R-20/R-22. Riesgo: P2.

### FASE 5 — Visual regression: de Level 2 a Level 3 (R-24..R-27)

**R-24 · `docs(qa): record first manual visual regression runs`**
- Objetivo: Nico dispara el workflow #1209 (suites public/authenticated/stress); se documenta runtime real, reproducibilidad de los 30 PNG en Actions y calidad de artifacts — el checklist exacto de PR-VIS-10 §7.
- Tipo: docs-only (evidencia). **Visual: NO.** Depende de: acceso GitHub Actions (manual). Riesgo: P3.

**R-25 · `docs(qa): define visual baseline update policy and owner`**
- Objetivo: política de actualización de baselines (entorno autorizado, comando, revisión), owner de aprobación visual y procedimiento anti-win32/darwin.
- Tipo: docs-only. **Visual: NO.** Depende de: R-24. Riesgo: P3.

**R-26 · `test(frontend): regenerate authenticated baselines post server-adaptive` ⚠ (baselines)**
- Objetivo: regeneración **autorizada** de los baselines autenticados/stress tras F1 (los diffs por filas adaptativas son esperados); registrar la excepción `minItems=9` de Users/Roles en la política.
- Tipo: e2e/snapshots. **Visual: NO.** Depende de: F1 completa + R-25. Riesgo: P2.

**R-27 · `ci: promote visual regression to minimal blocking gate` ⚠ CI**
- Objetivo: Level 3 con subset mínimo justificado, sólo si R-24 registró ≥2 corridas limpias y R-26 estabilizó baselines.
- Tipo: CI. **Visual: NO.** Depende de: R-24, R-25, R-26. Riesgo: P2.

### FASE 6 — Seguridad e higiene de software (lote 0 ENG) (R-28..R-33)

**R-28 · `docs+test(security): tenant isolation ADR and anti-IDOR guard`** *(= PR-SEC-2; sin autorización requerida)*
- Objetivo: ADR del modelo de aislamiento app-layer-vs-RLS + test-guard que falle si una ruta clínica usa `getReportById` sin scope. 0 runtime.
- Tipo: security (docs+test). **Visual: NO** (deuda: ENG-P1-001 f1 + ENG-P3-006 — la más valiosa por esfuerzo del backlog completo).
- Permitidos: `docs/governance/adr-*.md`, `test/tenant-isolation-guard.test.ts`. Depende de: —. Riesgo: P3 (bajo, alto valor).

**R-29 · `fix(server): sanitize pg-code 4xx responses` ⚠ backend** *(= PR-SEC-1)*
- Objetivo: 400 de pg-code (23505/23503/22P02/42703) con mensaje genérico, `requestId` intacto; test de no-leak. Tipo: security. **Visual: NO** (CWE-209). Depende de: autorización backend. Riesgo: P3.

**R-30 · `chore(scripts): include security public-surface in validate:local` ⚠ package** *(= PR-DX-1)* — gate local = CI. **Visual: NO.** Riesgo: P3.

**R-31 · `cleanup(server): remove legacy error handler` ⚠ backend** *(= PR-CLEAN-1 del roadmap ENG)* — handler Express muerto (ENG-P3-007). **Visual: NO.** Riesgo: P3.

**R-32 · `chore(server): type logger arguments` ⚠ backend** *(= PR-TYPE-1)* — quitar `any[]` sin cambiar API (ENG-P3-002). **Visual: NO.** Riesgo: P3.

**R-33 · `fix(frontend): admin page 404 without cookie and react-hooks rules`** *(= PR-ENG-CLEANUP-1)*
- Objetivo: evaluar/implementar 404 (no redirect) para la página admin sin cookie + reactivar reglas `react-hooks/*` por archivo (ENG-P3-005/001).
- Tipo: security/cleanup frontend. **Visual: parcial** (404 admin observable). Depende de: —. Riesgo: P2.

### FASE 7 — Medición e infraestructura de test (R-34..R-39, todas ⚠ deps/CI, un tooling por PR)

**R-34 · `chore(ci): add backend lint baseline` ⚠ deps+CI** *(= PR-LINT-1)* — ESLint/Biome backend sin formateo masivo, sin blocking inicial. **Visual: NO** (33k LOC sin análisis estático). Riesgo: P3. Precede a los refactors R-47/R-48.

**R-35 · `chore(ci): add coverage measurement without threshold` ⚠ deps+CI** *(= PR-COV-1)* — c8, baseline % publicado, sin umbral (precedencia dura: medir antes de exigir). **Visual: NO.** Riesgo: P3.

**R-36 · `test(frontend): add unit test foundation for lib api` ⚠ deps** *(= PR-FE-TEST-1)* — vitest + testing-library, primera suite sobre `lib/api.ts`. **Visual: NO.** Depende de: idealmente después de R-47 (split) o antes con re-export estable. Riesgo: P3.

**R-37 · `ci(e2e): run smoke against production build` ⚠ CI** *(= PR-E2E-1 f1)* — smoke E2E contra `next build && next start` (hoy todo corre contra `next dev`). **Visual: NO.** Riesgo: P2.

**R-38 · `ci(e2e): add webkit and firefox smoke projects` ⚠ CI** *(= PR-VIS-10 del roadmap ENG; resuelve la colisión C7)* — subset crítico cross-browser; primer cierre real de VIS-P0-001/ENG-P1-004. **Visual: NO.** Depende de: R-37 (coordinación en `playwright.config.ts`). Riesgo: P2.

**R-39 · `docs(qa): device QA matrix Android iOS evidence`** — ejecución manual en devices reales (barra dinámica, safe-area, touch) sobre los módulos migrados + Particular; evidencia con capturas fuera de `test-results/`; ejecuta el kit **T-12** de §5.5. Tipo: docs/QA manual. **Visual: NO** (pero valida todo lo visual del bloque). Depende de: F1–F3. Riesgo: P2.

#### Extensión F7 derivada de §5.5 (R-56/R-57 numerados después de R-55 para no renumerar el bloque publicado; su ventana de ejecución lógica es esta fase)

**R-56 · `docs(security): github advanced security viability decision`**
- Objetivo: decidir T-04 (CodeQL) y T-06 (dependency review) con una única verificación read-only: visibilidad del repo, disponibilidad/costo de GHAS, lenguajes cubiertos. Si viable → habilita los reservados **R-58** (workflow CodeQL, ⚠ CI) y **R-59** (dependency-review-action, ⚠ CI), un tooling por PR. Si no viable → cierre documentado como Rechazo con condición de reapertura.
- Rol/superficie: transversal · seguridad. Tipo: docs-only. **Visual: NO** (deuda: T-04/T-06 sin decisión).
- Permitidos: sólo `docs/**`. Prohibidos: workflows, deps, todo código.
- Depende de: —. Riesgo: P3. Autorización: no (la implementación reservada sí: ⚠ CI).

**R-57 · `chore(frontend): add knip dead-code baseline` ⚠ dep**
- Objetivo: T-10 — knip como dev-dep con **baseline informativo** (sin gate) y triage inicial de falsos positivos documentado. Protege el valor de la limpieza #1172–#1187 contra re-acumulación; habría detectado `MasterDetailWorkspace` (R-15) automáticamente.
- Rol/superficie: transversal · cleanup. Tipo: cleanup/tooling. **Visual: NO.**
- Permitidos: `package.json`/`frontend/package.json` (dev-dep, autorizada ⚠), config knip, doc. Prohibidos: eliminar código en este PR (cada hallazgo genera su propio PR), CI gate.
- Depende de: R-15 (evita el ruido del muerto ya conocido) + autorización ⚠ dep. Riesgo: P3.
- Valor: la detección de deuda muerta deja de depender de auditorías manuales; contrato de adopción (§5.5) con dueño/comando/output/rollback en su doc.

### FASE 8 — Enterprise quick-wins, arquitectura y release (R-40..R-55)

**R-40 · `feat(dashboard): alert center severity view`** *(= OPS-5)* — severidad+deduplicación+agrupación sobre `getDashboardNotifications`/`getAdminFailedLoginAlerts`; frontend-only (score 41 del advisory). **Visual: SÍ.** Riesgo: P2.

**R-41 · `feat(dashboard): entity activity timeline panel`** *(= OPS-6)* — correlación entidad↔eventos sobre `StudyTimeline`+tracking+`getAuditEntries`. **Visual: SÍ.** Riesgo: P2.

**R-42 · `feat(admin): audit inspector filters and detail`** *(= ADMIN-5)* — de tabla densa a herramienta de investigación (actor/entidad/correlación). **Visual: SÍ.** Depende de: R-06. Riesgo: P2.

**R-43 · `refactor(frontend): action registry and permission gate`** *(= CORE-4; P1 de permisos)* — `DashboardActionRegistry` + `useActionPermissions` con test por rol; **obligatorio antes de cualquier menú de acciones**. Anti-sobreingeniería: recién aquí hay ≥2 consumidores (R-40/R-41/R-42). **Visual: NO.** Riesgo: **P1** (permisos).

**R-44 · `feat(dashboard): entity action menu and feedback`** *(= CORE-5)* — `EntityActionMenu` + `ActionFeedbackToast` consumiendo R-43. **Visual: SÍ.** Depende de: R-43. Riesgo: P2.

**R-45 · `feat(clinic): clinic command center home`** *(= CLINIC-4)* — home accionable (informes del día, tokens activos, casos en proceso). **Visual: SÍ.** Depende de: R-40. Riesgo: P2.

**R-46 · `feat(dashboard): smart empty states`** *(= CLINIC-5)* — sin-datos/sin-permisos/error/filtro-vacío con acción sugerida, geometría estable. **Visual: SÍ.** Riesgo: P3.

**R-47 · `refactor(frontend): split lib api by domain`** *(= PR-API-1)* — `api.ts` (2371 LOC) → `api/*` con re-exports, sin cambio de comportamiento. **Visual: NO.** Depende de: R-34 (lint primero). Riesgo: P2.

**R-48 · `refactor(frontend): extract particular tokens shared domain hook`** *(= PR-DUP-1; completa lo que #1203 dejó abierto — §4.1.2)* — hook de dominio compartido admin↔clínica, especializado por rol. **Visual: NO.** Depende de: R-05, R-47. Riesgo: P2.

**R-49 · `chore(deps): unify zod major` ⚠ deps** *(= PR-ZOD-1)* — un solo major en el workspace; precede a contratos compartidos. **Visual: NO.** Riesgo: P2.

**R-50 · `feat(server): structured logger with request id` ⚠ backend** *(= PR-OBS-1; resuelve la deuda que #1185 sólo documentó)* — pino detrás de `logInfo/logWarn/logError`, niveles por env, migración gradual, sin secretos/PII. **Visual: NO.** Precedencia dura para cualquier trabajo DB futuro. Riesgo: P2.

**R-51 · `feat(frontend): enforce content security policy`** *(= PR-CSP-1)* — enforcing sólo tras revisar reportes report-only; e2e sin violaciones. **Visual: NO.** Riesgo: P2.

**R-52 · `infra: add render blueprint` ⚠ infra** *(= PR-INFRA-1)* — `render.yaml` (build/start/health/env names) sin secretos. **Visual: NO.** Riesgo: P3.

**R-53 · `docs(governance): pinning policy and second reviewer DoD`** *(= PR-DOCS-GOV-1)* — ENG-P3-003/004. **Visual: NO.** Riesgo: P3.

**R-54 · `feat(admin): admin command center risk home`** *(= ADMIN-6)* — home Admin de riesgo (alertas críticas, sesiones sospechosas, health) sobre R-40/R-42. **Visual: SÍ.** Depende de: R-40, R-42. Riesgo: P2.

**R-55 · `docs(release): global roadmap closeout and readiness sign-off`**
- Objetivo: closeout de este roadmap contra §10: estado real por PR, greps de criterios medibles, deudas residuales declaradas (RLS, OPS-DRILL, QA-PROD — fuera de esta ventana, ⚠⚠), índice documental actualizado, y **cierre del ledger de tooling §5.5**: decisión final por cada T-xx (incluidas las Diferidas T-05/T-08 y el resultado de R-56) con contrato de adopción (dueño/comando/output/rollback) verificado para cada adoptada.
- Tipo: docs-only. **Visual: NO.** Depende de: R-01..R-54, R-56, R-57 (y R-58/R-59 si la decisión R-56 los habilitó). Riesgo: P3.

> **Fuera de ventana (declarado, no olvidado):** PR-RLS-1 y PR-OPS-DRILL-1 (⚠⚠ DB/productivo),
> PR-VIS-CSS-1 (extracción `globals.css`, requiere gate visual estable = post R-27), PR-SHARED-1,
> PR-BE-SVC-1, VIS-NAV/TYPO/STATE/CATALOG, Lighthouse/CWV (T-05), error-tracking/telemetry SaaS
> (T-08, previa decisión explícita de privacidad/datos) y la Fase 7 productiva del roadmap ENG.
> Quedan encadenados a las precedencias duras heredadas: OBS (R-50) + coverage (R-35) + ADR/guard
> (R-28) **antes** de RLS; baseline visual con gate (R-27) **antes** de mover `globals.css`.

---

## 7. Separación por rol

| Rol | PRs del roadmap | Resultado al completarlos |
|---|---|---|
| **Admin** | R-01..R-09, R-42, R-54 (+R-05/R-48 tokens) | 8/8 módulos servidor adaptativos; cero `matchMedia`-cardinalidad; cero `MOBILE_PAGE_SIZE`; dualidad colapsada; auditoría como herramienta de investigación; home de riesgo |
| **Clínica** | R-10..R-16, R-45, R-46 (+R-07 informes full) | Hub sin overflow medido; logística full verificada/migrada; tokens sin gap en pantallas altas; command center operativo |
| **Particular** | R-17..R-19 (+R-39 device) | Rol auditado por primera vez de punta a punta: fixture, polish móvil premium, timeline |
| **Público** | R-20..R-23 (+R-21 baselines, R-22 axe) | Todas las rutas públicas con red geométrica, visual y a11y |
| **Auth/permisos** | R-28, R-29, R-33, R-43 | Guard anti-IDOR + ADR; 4xx sin leak; admin 404; permisos de acción centralizados con test por rol |
| **Mobile transversal** | R-18, R-39 + regla §8.6 en F1/F2 | Evidencia device real Android/iOS registrada; `dvh`/safe-area/touch validados donde el contrato lo exige |

---

## 8. Reglas de calidad para los próximos PRs

1. **1 PR = 1 objetivo = 1 causa raíz.** Nunca lotes (lección C4: "PR-SRV-2 lote" degeneró en numeración ambigua).
2. **No agrupar módulos.** Cada módulo Admin/Clínica migra en su propio PR con su propio bloque e2e.
3. **No tocar backend/API/auth/DB/deps/lockfiles/CI salvo autorización explícita** de Nico, marcada ⚠ en el PR y en su doc de implementación (los R-xx ⚠ de este roadmap ya lo declaran).
4. **Todo PR visual debe producir diferencia visible antes/después**, con evidencia (capturas fuera de `test-results/` o diff de baseline autorizado). Si no hay diferencia visible, el PR está mal clasificado.
5. **Todo PR técnico invisible debe declarar qué deuda elimina** con ID trazable (ENG-*/VIS-*/fila de §5) y cómo se verifica (grep, test-guard, métrica).
6. **Todo PR mobile valida Android/iOS representativos** — mínimo viewports e2e 390×844 + 360×740; device real acumulado en R-39.
7. **Numeración canónica R-xx** en título del doc de implementación; si un documento rector usa otro ID, se cita la equivalencia (§4.2) — prohibido crear nuevos espacios de IDs.
8. **Todo PR sobre dashboards corre el e2e geométrico dirigido** (`dashboard-viewport-zoom-adaptability` + spec del módulo) además del gate global.
9. **Todo PR server-adaptive** preserva el contrato e2e existente (selectores `data-*` legacy), colapsa la dualidad desktop/mobile en runtime único (nunca crea variantes nuevas), usa la plantilla SRV-1/2 (request-id anti-race + recompute de offset + fallback antes de medir) y registra el payload del cap elegido.
10. **`next-env.d.ts` modificado se restaura antes de validar** (`git checkout -- frontend/next-env.d.ts`), como en #1219.
11. **Docs por PR**: cada PR de código deja su `docs/implementation/*.md` con base, scope, exclusiones, validaciones ejecutadas y riesgo residual — el estándar ya establecido por #1212–#1222.
12. **Git manual lo hace Nico**: la IA nunca ejecuta `git add/commit/push` ni `gh pr *`.
13. **Toda herramienta nueva pasa por §5.5**: fila T-xx con deuda concreta + PR receptor + contrato
    de adopción (dueño/comando/output/rollback); rige el No-go tooling §5.5.1 sin excepciones.

---

## 9. Próximo PR recomendado

**R-01 · `feat(admin): adapt failed-login alerts server pagination to viewport`.**

Justificación: (a) continúa el momentum server-adaptive con el módulo más simple restante
(`total` expuesto, `PAGE_SIZE=5`, volumen bajo-medio); (b) completa el subgrupo 1 de PR-SRV-0
(matchMedia sólo como gate) antes de abordar el subgrupo 2 (matchMedia-cardinalidad, más riesgoso);
(c) reutiliza la plantilla #1221/#1222 sin decisiones nuevas salvo OF-vs-RF, que el propio PR
resuelve con una verificación read-only de volumen; (d) colapsa `AdminMobileCommandModule`, dejando
3/8 dualidades cerradas.

**En paralelo y sin autorización requerida:** R-28 (ADR + guard anti-IDOR, docs+test) es el PR de
mayor valor/esfuerzo de todo el backlog y lleva dos días ejecutable sin ejecutarse. Si Nico prefiere
un solo PR: R-01 primero; si acepta dos ramas secuenciales el mismo día: R-01 → R-28.

---

## 10. Criterio de cierre final del proyecto (release-ready)

### 10.1 Checks obligatorios (gate global por PR y al cierre)

`git diff --check` · `pnpm test` · `pnpm typecheck` · `pnpm typecheck:test` · `pnpm build` ·
`pnpm --dir frontend lint` · `pnpm --dir frontend typecheck` · `pnpm --dir frontend build` ·
`pnpm security:public-surface` · `pnpm validate:local` — todo verde en `main`, working tree limpio,
0 PRs abiertos, sin `next-env.d.ts` modificado.

### 10.2 E2E obligatorios

- Suites por capas existentes (smoke, admin-mobile, visual-contract, public-clinic) verdes.
- `dashboard-viewport-zoom-adaptability` con las aserciones de scroll interno **promovidas a gate**
  para todas las superficies migradas (hub incluido, post R-10).
- Bloques e2e de los 8 módulos Admin servidor + specs de parity mobile clínica + spec Particular
  autenticado (R-17) verdes ×3 corridas.

### 10.3 Smoke staging (protocolo `vetneb-lanzamiento-mantenimiento`)

Backend `/health` y `/api/health` · rutas públicas 200 · privado sin cookie protegido · admin sin
cookie → 404 (post R-33) · acciones críticas reales por sección · auditoría sin secretos.

### 10.4 Evidencia visual

- ≥2 corridas limpias del workflow VR en Actions registradas (R-24) y baselines regenerados con
  autorización post-migraciones (R-26); gate mínimo activo (R-27).
- Capturas before/after archivadas para cada PR "Visual: SÍ".
- Matriz device real Android/iOS con evidencia (R-39).

### 10.5 Documentación final

- Un doc de implementación por PR de código + closeout por fase.
- R-55 mergeado: estado real por R-xx, greps de criterios medibles, deudas residuales declaradas.
- **Ledger de tooling (§5.5) cerrado:** cada T-xx con decisión final registrada
  (Adoptar/Evaluar/Diferir/Rechazar, incluida la evidencia de R-56 sobre GHAS) y, para cada
  herramienta adoptada, **dueño + comando + output esperado + rollback** documentados en su doc de
  implementación. Una herramienta sin esos 4 campos no cuenta como adoptada.
- Índice `docs/audit/README.md`/`SOURCES_OF_TRUTH.md` reconciliado (sin re-fragmentación).

### 10.6 Criterios medibles para declarar release-ready

| Criterio | Verificación |
|---|---|
| Constantes de cardinalidad sólo como fallback | grep: 0 usos de `PAGE_SIZE` gobernando query/render sin hook |
| `MOBILE_PAGE_SIZE` = 0 · `matchMedia`-cardinalidad = 0 | grep-guard de R-08 en verde |
| Dualidad Admin colapsada | 0 `AdminMobile*Module` con fetch propio; shims eliminados (R-09) |
| Scroll interno medido = 0 en superficies migradas | e2e §10.2 |
| Guard anti-IDOR activo | test de R-28 en suite |
| Roles auditados 6/6 | §7 completo, incluido Particular autenticado |
| Lote 0 software cerrado | R-28..R-33 mergeados |
| Medición existente | lint backend + coverage baseline + ≥1 suite unit FE + smoke prod-build + smoke WebKit/Firefox |
| Tooling sin inflación | Ledger §5.5 completo: 0 herramientas en el repo sin fila T-xx; 0 adoptadas sin contrato de adopción (dueño/comando/output/rollback); Rechazos y Diferidos con razón vigente, no vencida |

**Declaración honesta de cierre:** aun cumpliendo todo lo anterior, el proyecto se declara
**release-ready operativo**, no "ingeniería extrema certificable": RLS (ENG-P1-001 f2),
backup/restore drill, QA productivo autenticado y CWV productivos permanecen como ventana siguiente
(⚠⚠), con sus precedencias ya satisfechas por R-28/R-35/R-50. El sign-off final (equivalente a
PR-CERT-1) sólo puede firmarse contra esa ventana, y este documento lo deja explícito para que
ningún closeout futuro lo declare cerrado por omisión.

---

## Validaciones de cierre de este PR (docs-only)

- **Sigue siendo un único archivo markdown:** PR-GA-1 amplía el mismo archivo untracked
  (`docs/audit/final-global-vetneb-50-60-pr-roadmap.md`); no se creó ningún archivo adicional.
- **Cero archivos existentes tocados:** ni docs previos, ni rectores, ni índices.
- **Cero cambios en código/tests/deps/CI:** no se tocó `server/`, `frontend/`, `test/`,
  `.github/`, packages, lockfiles, snapshots ni `.claude/`.
- **La evaluación de herramientas §5.5 es documental:** no instala dependencias, no crea
  workflows, no configura tooling. Toda adopción real ocurre en su PR receptor R-xx con su
  autorización correspondiente (⚠ marcada por fila).
- `git diff --check` — aplica; sin salida esperada.
- `git status --short --untracked-files=all` — debe mostrar únicamente
  `?? docs/audit/final-global-vetneb-50-60-pr-roadmap.md`.
- `pnpm test` / builds — no ejecutados: sin cambios de código, specs, deps ni manifests (precedente
  #1208/#1220).

*Documento generado como PR-FINAL-0 y ampliado por PR-GA-1 (ambos docs-only). No implementa código
ni tooling, no modifica documentos existentes ni severidades/conteos de los rectores; donde los
actualiza de hecho (módulos ya migrados, PR-MD-1 bloqueado, colisiones de IDs, decisiones de
herramientas) lo hace por referencia y equivalencia, nunca por edición. Pendiente de
stage/commit/push/PR por Nico según protocolo.*
