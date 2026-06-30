# Total Engineering Roadmap

> **Tipo:** Roadmap integrado de ejecución (orquestación), no auditoría ni resumen.
> **Fecha:** 2026-06-30 · **Rama:** `docs/total-engineering-roadmap` · **Base obligatoria:** `main` `6cf2638 docs(audit): upgrade total visual engineering audit (#1194)` · **PRs abiertos:** 0 · **Working tree:** limpio salvo este propio documento (nuevo).
> **Naturaleza:** Documental (docs-only). El único artefacto generado es este archivo Markdown; **no** se modifica frontend, backend, tests, DB, migraciones, dependencias, lockfiles, workflows ni las dos auditorías fuente. Sin commit/push/PR.
>
> Este documento **orquesta** la ejecución del 100% de las mejoras descritas por las dos auditorías rectoras. **No las reemplaza, no re-deriva sus hallazgos, no altera severidades, no cambia IDs existentes, no inventa hallazgos nuevos y no contradice los documentos rectores.** Cada hallazgo `VIS-*` y `ENG-*` se mapea a un PR, gate, aceptación o justificación trazable. Lo visual/CSS es soberanía de la auditoría visual; la ingeniería de software dura es soberanía de la auditoría de software; este roadmap sólo secuencia, depende y certifica.

---

## 1. Executive Summary

**Propósito.** Convertir las dos auditorías rectoras vigentes en un **plan de ejecución por fases y PRs chicos, reversibles, testeables y trazables**, que permita cerrar el 100% de los hallazgos sin mega-PRs, sin saltar dependencias y sin ignorar autorizaciones.

**Fuentes rectoras (read-only obligatorias).**
1. `docs/audit/total-visual-engineering-audit.md` — capa visual/frontend (2 P0 · 8 P1 · 10 P2 · 6 P3 = **26**).
2. `docs/audit/total-software-engineering-audit.md` — ingeniería de software dura (0 P0 · 7 P1 · 12 P2 · 7 P3 = **26**).

**Alcance 100%.** Los **52 hallazgos** (26 + 26) quedan cubiertos: cada P0/P1/P2/P3 mapea a un PR concreto (existente o derivado de un "PR futuro"/acceso externo que las auditorías ya nombran), a un gate, a un criterio de aceptación o a una justificación de bundle. Ningún P0/P1 queda sin acción; ningún P2 sin PR o bundle razonado; ningún P3 sin cleanup/polish o maintenance.

**Dictamen actual (heredado, no re-derivado).**
- **Visual:** "Premium *profesional* hoy; NO aún excelencia visual extrema certificable" — porque falta infraestructura (regresión visual + cross-browser + a11y automatizado), no por estética. Los 2 P0 son **de proceso/infraestructura**.
- **Software:** "Apto para operación productiva actual; NO aún production-readiness extremo/multinacional" — encabezado por la **falta de defensa en profundidad de aislamiento de datos (sin RLS)** y la cobertura no medida. **0 P0** detectados.
- **Baseline combinado:** verde (las 7 validaciones obligatorias pasan en ambas auditorías).

**Objetivo final.** Llevar el producto a **excelencia visual extrema certificable** + **ingeniería extrema / multinacional**, cerrando los 8 gates visuales y los 8 gates de software, sin congelar el desarrollo, manteniendo `main` limpio y un PR/rama por vez.

**Cantidad aproximada de PRs.** **48 PRs** orquestados (1 opcional), distribuidos en 8 fases (0–7). El rango se justifica en §7: los 12 PRs `VIS-*` + 15 PRs `ENG-*` nombrados por las auditorías, más ~18 PRs derivados de los "PR futuro" / "post-*" / "acceso externo" que las auditorías ya describen sin asignarles ID, más los PRs de orquestación/certificación de fase. No se fuerza un número exacto; se respeta lo que ambos documentos justifican.

**Qué se logra al completar el roadmap.** Cross-browser activo (WebKit/Firefox + iOS real), regresión visual con baselines, cobertura medida, lint backend, a11y automatizado (axe), defensa en profundidad de datos (RLS + guard anti-IDOR), observabilidad mínima estructurada, IaC versionada, backup/rollback drills, QA visual productivo autenticado y sign-off de readiness — con el design system tokenizado, unificado y documentado.

**Qué NO se debe hacer (síntesis; detalle en §19/§libros fuente).** No rediseñar; no mega-PR; no activar regresión+cross-browser+Storybook en un solo PR; no introducir RLS sin ADR/guard previos + observabilidad + cobertura + rol no-privilegiado + plan de rollback en entorno no-prod; no tocar CSS global amplio sin baseline de regresión; no tocar color global sin contrast audit; no agregar deps/CI/DB sin autorización explícita; no mezclar refactor con funcionalidad crítica; no dejar `next-env.d.ts` modificado; no simular éxito ni ocultar fallos.

**Declaración de gobernanza.** Este roadmap **no reemplaza** las auditorías: las **orquesta**. Ante cualquier discrepancia, prevalece el documento rector de la dimensión correspondiente (visual → auditoría visual; software → auditoría de software).

---

## 2. Source Documents and Authority

| Documento | Rol | Estado | Hallazgos | Uso dentro del roadmap |
| --- | --- | --- | --- | --- |
| `docs/audit/total-visual-engineering-audit.md` | Rector **visual/frontend** (soberanía CSS/visual) | Vigente, baseline verde (publicado #1192, upgrade #1194) | 2 P0 · 8 P1 · 10 P2 · 6 P3 = **26** | Fuente de todos los `VIS-*`, PR-VIS-0…11, gates visuales 1–8, no-go visual, autorizaciones visuales |
| `docs/audit/total-software-engineering-audit.md` | Rector **ingeniería de software** (soberanía backend/DB/CI/seguridad) | Vigente, baseline verde (HEAD `8f6b1a2`) | 0 P0 · 7 P1 · 12 P2 · 7 P3 = **26** | Fuente de todos los `ENG-*`, PR-SEC/OBS/LINT/COV/…/RLS, gates de software 1–8, no-go de software, autorizaciones |
| `docs/audit/total-engineering-roadmap.md` (este) | **Orquestador** (no rector de hallazgos) | Nuevo (PR-ROADMAP-0) | 0 (no genera hallazgos) | Secuencia, dependencias, gates unificados, trazabilidad y briefs ejecutables |

**Documentos hermanos / no duplicar.** Ambas auditorías son complementarias entre sí y respecto de las 4 auditorías Wave 0 (`docs/audit/README.md`) y `docs/SOURCES_OF_TRUTH.md`. Este roadmap concilia con ellas y **no contradice** ninguna.

---

## 3. 100% Coverage Contract

Este roadmap se compromete explícitamente a:

- **Todos los P0/P1/P2/P3 cubiertos.** Los 52 hallazgos (26 visuales + 26 de software) aparecen en la matriz de trazabilidad §23.
- **Cada hallazgo mapea** a: un PR, un gate, un criterio de aceptación o una justificación (bundle/diferido/externo).
- **P0/P1 no pueden quedar sin acción.** Cada P0/P1 tiene un PR específico (no se agrupan entre sí), test/validación, rollback y owner/reviewer (heredado de §30/§36 de las fuentes).
- **P2 con PR o bundle razonado.** Cada P2 tiene PR propio o se agrupa por área (p.ej. observabilidad, a11y) si reduce ruido, con validación.
- **P3 a cleanup/polish o maintenance.** Los P3 se cierran en cleanup-bundles seguros o quedan en registro de deuda; nunca bloquean entregas críticas.
- **Autorización donde la auditoría lo marca.** Todo cambio de DB/CI/deps/infra/seguridad/productivo requiere autorización explícita (⚠ / ⚠⚠), reflejada en §17.
- **PRs chicos, reversibles y testeables.** Una causa raíz por PR, un scope, rollback lógico posible, validaciones del tipo de PR.

**Checklist de cobertura (estado inicial = abierto; se cierra al ejecutar):**

- [ ] VIS P0 cubiertos (VIS-P0-001 → PR-VIS-10/PR-E2E-1/PR-QA-DEVICES-1; VIS-P0-002 → PR-VIS-9).
- [ ] VIS P1 cubiertos (001 freeze+extracción; 002; 003; 004; 005; 006; 007; 008 → §23).
- [ ] VIS P2 cubiertos (001…010 → §23).
- [ ] VIS P3 cubiertos (001…006 → §23, cleanup-bundle visual).
- [ ] ENG P1 cubiertos (001…007 → §23).
- [ ] ENG P2 cubiertos (001…012 → §23).
- [ ] ENG P3 cubiertos (001…007 → §23, cleanup-bundle eng).
- [ ] Dependencias respetadas (§16).
- [ ] Autorizaciones marcadas (§17).
- [ ] Validaciones definidas (§18).
- [ ] No-go criteria incorporados (§19).

---

## 4. Consolidated Risk Picture

Riesgos visuales + software unificados. Severidad máxima = la mayor entre las fuentes que lo describen.

| Riesgo consolidado | Fuente | Severidad máxima | Impacto | Roadmap phase | PRs |
| --- | --- | --- | --- | --- | --- |
| Cross-browser ausente (Chromium-only) | VIS-P0-001 + ENG-P1-004 | **P0** | iOS Safari/WebKit/Firefox sin verificar; público iPhone; `next dev` no `next start` | F2 / F7 | PR-VIS-10, PR-E2E-1, PR-QA-DEVICES-1 |
| Regresión visual ausente (0 baselines) | VIS-P0-002 | **P0** | Drift silencioso en `globals.css` 3.262 LOC | F2 | PR-VIS-9 |
| RLS / defensa en profundidad ausente | ENG-P1-001 (+ENG-P3-006, ENG-P2-011) | **P1** | Un endpoint sin `clinicId` = fuga cross-tenant sin red DB | F1 (f1) / F6 (f2) | PR-SEC-2, PR-RLS-1 |
| Observabilidad insuficiente (console-only) | ENG-P1-006 (+ENG-P2-006) | **P1** | Incidentes ciegos; sin p95/p99/alertas/tracing | F4 | PR-OBS-1 |
| Cobertura no medida | ENG-P1-002 | **P1** | % real desconocido pese a 2896 tests | F2 | PR-COV-1 |
| Frontend sin unit tests | ENG-P1-003 | **P1** | `api.ts` 2371 LOC y cards 1.9k sin red unidad | F2 | PR-FE-TEST-1 |
| E2E no production-mode | ENG-P1-004 (+VIS-P0-001) | **P1/P0** | Bug sólo en build llega a prod; sin cross-browser | F2 | PR-E2E-1 |
| Backend sin lint | ENG-P1-005 | **P1** | ~33k LOC sin análisis estático | F2 | PR-LINT-1 |
| CSS global monolítico | VIS-P1-001 | **P1** | Alta superficie de regresión; DS implícito | F0 (freeze) / F3 (extracción) | PR-VIS-0, PR-VIS-CSS-1 |
| God-files / componentes gigantes | ENG-P1-007 + VIS-P1-002 | **P1** | Alto costo de cambio; regresión; doble mantención admin/clínica | F3 / F5 | PR-VIS-7, PR-API-1, PR-BE-SVC-1, PR-DUP-1 |
| Error leak 4xx (pg-code, CWE-209) | ENG-P2-001 | **P2** | Filtra constraint/columna en 400 | F1 | PR-SEC-1 |
| CSP report-only | ENG-P2-008 | **P2** | CSP no aplica (sólo reporta) | F4 | PR-CSP-1 |
| Caches/rate-limit in-memory | ENG-P2-010 | **P2** | No multi-instancia/restart-safe | F4 | PR-RL-DIST-1 |
| Migraciones forward-only | ENG-P2-011 | **P2** | Rollback de esquema manual | F6 | PR-RLS-1, PR-OPS-DRILL-1 |
| Design system drift (badge off-token, dark dual, filtros bespoke, gradiente/sombra hardcodeados) | VIS-P1-003/004/005/006 + VIS-P2-001/002 | **P1** | Drift de marca; dos lenguajes de estado | F1 / F3 | PR-VIS-1/2/3/5/6 |
| A11y/contrast automation ausente (axe) + `user-select` global + touch 32px | VIS-P1-007/008 + VIS-P2-003 | **P1** | Contraste sin medir; no se copia informe; ergonomía táctil | F1 / F2 / F3 | PR-VIS-4, PR-VIS-8, PR-VIS-6 |

> **Honestidad de severidad:** los P0 visuales son de **proceso/infraestructura** (no roturas activas de runtime); el riesgo de datos sin RLS es **P1** porque el aislamiento de aplicación funciona y está testeado (ausencia de defensa en profundidad, no frontera rota). Las severidades **no se suavizan**: se ejecutan en el orden que su dependencia/reversibilidad permite, no se reclasifican.

---

## 5. Roadmap Strategy

**Secuencia estratégica.** (1) primero **docs/test-only**; (2) luego **quick wins reversibles** (frontend en scope + cambios mínimos backend); (3) luego **medición** (cobertura, lint, unit, axe, regresión visual, cross-browser); (4) luego **gates CI/deps con autorización**; (5) luego **refactors seguros** (split puro, primitivas, service layer); (6) luego **DB/RLS/productivo** (defensa en profundidad con red previa); (7) por último **production QA real** y certificación.

**Justificaciones:**
- **Por qué no mega-PR.** Cada PR = una causa raíz, un scope, rollback lógico. Un mega-PR mezcla riesgos, hace irreversible el rollback y rompe la trazabilidad hallazgo→PR (No-Go §19; Do Not Do de ambas fuentes).
- **Por qué no empezar por RLS completo.** PR-RLS-1 es XL, de **baja reversibilidad** y riesgo DB alto; depende de ADR+guard (PR-SEC-2), observabilidad (PR-OBS-1) y cobertura (PR-COV-1) como red, y de un entorno **no-prod** con rol DB no-privilegiado y plan de rollback. RLS a ciegas = riesgo de caída productiva.
- **Por qué no empezar por visual regression CI completa.** Sin baseline estable, activar el gate genera flake/falsos positivos. Primero los quick wins de marca (bajo riesgo), luego baseline estable en rutas públicas, después extender y bloquear.
- **Por qué medir antes de exigir thresholds.** Cobertura (PR-COV-1) y lint (PR-LINT-1) entran **sin umbral bloqueante**: se mide y publica baseline; exigir thresholds sin medir rompe CI sin información.
- **Por qué separar visual, seguridad, backend, DB y CI.** Cada dominio tiene owner/reviewer, autorización y validación distintos (§17/§18). Mezclarlos acumula riesgo y oculta la causa raíz. "Un tooling por PR" es regla anti-deriva de ambas fuentes.

---

## 6. Phase Overview

| Fase | Objetivo | PRs aprox | Riesgo | Autorización | Resultado |
| --- | --- | ---: | --- | --- | --- |
| **F0 — Roadmap & Governance Baseline** | Mergear este roadmap + congelar DS/contratos + índice docs | 2–3 | Nulo | No (docs) | Plan rector operativo; freeze de patrones |
| **F1 — Low-Risk Quick Wins** | Cerrar quick wins visuales (lote 0) + seguridad/higiene backend (lote 0) | 10 | Bajo | Mayoría no; ⚠ backend puntual | Drift de marca reducido; ADR+guard anti-IDOR; 4xx sanitizado |
| **F2 — Measurement & Test Infrastructure** | Cobertura, lint backend, unit FE, axe, E2E prod-mode, cross-browser, regresión visual, mutation | 8 | Bajo-Medio | ⚠ deps/CI (uno por PR) | Se mide todo; red de regresión activa |
| **F3 — Visual System Hardening** | Unificar filtros/primitivas, extraer duplicación, extracción CSS, tipografía, contraste, motion, catálogo | 9 | Bajo-Medio | Mayoría frontend; ⚠ tooling (CWV/Storybook) | Design system tokenizado, unificado y documentado |
| **F4 — Security & Backend Reliability** | Observabilidad, CSP enforcing, rate-limit distribuido | 3 | Medio | ⚠ backend/deps | Operación diagnosticable; CSP aplica; límites robustos |
| **F5 — Architecture & Contract Extraction** | Split `api.ts`, service layer, contrato shared, zod unify, duplicación dominio | 5–7 | Medio | Mixto (frontend/⚠ deps/backend) | Bordes claros FE↔BE; menor costo de cambio |
| **F6 — Database/RLS & Operational Readiness** | RLS defensa-en-profundidad, IaC, rollback/restore | 3 | **Alto** | **⚠⚠ DB/infra/productivo** | Defensa en profundidad de datos; DR reproducible |
| **F7 — Production Validation & Certification** | QA visual prod, devices reales, CWV/p95-p99, incident/rollback drills, sign-off | 5 | Medio-Alto | **⚠ acceso externo/productivo** | Certificación de excelencia visual + ingeniería extrema |

---

## 7. Full PR Backlog

Corazón del documento. Orden = secuencia ejecutiva recomendada. Fuente = auditoría origen. **No se cambian IDs existentes** (`PR-VIS-0…11`, `PR-SEC-*`, etc.); los IDs **derivados** (marcados *(der.)*) corresponden a "PR futuro"/"post-*"/"acceso externo" que las auditorías ya describen sin asignarles ID — no son hallazgos nuevos.

| Orden | PR ID | Título | Fuente | Hallazgos | Fase | Scope | Autorización | Riesgo | Validaciones | Done |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PR-ROADMAP-0 | Crear este roadmap integrado | Roadmap | (orquesta 52) | F0 | docs | No | Nulo | `git diff --check`; `--name-only` solo `docs/**`; 7 validaciones | Doc mergeado; 0 código |
| 2 | PR-VIS-0 | DS contract freeze (`design-system-contract.md`) | VIS | VIS-P1-001 (freeze) | F0 | docs | No | Nulo | `git diff --check`; `--name-only` docs | Contrato DS congelado; conteo 26 estable |
| 3 | PR-DOCS-IDX-0 *(opc.)* | Indexar roadmap+auditorías en `README.md`/`SOURCES_OF_TRUTH` | ENG | ENG-P2-012 (parcial) | F0 | docs | No | Nulo | `git diff --check`; docs | Índice navegable |
| 4 | PR-SEC-2 | ADR aislamiento + guard anti-IDOR `clinicId` | ENG | ENG-P1-001 (f1), ENG-P3-006 | F1 | docs+test | docs+test | Bajo | `pnpm test`; `--name-only` docs+test | Test guard verde; ADR; 0 runtime |
| 5 | PR-SEC-1 | Sanitizar 4xx de pg-code (CWE-209) | ENG | ENG-P2-001 | F1 | backend | ⚠ backend | Bajo | `pnpm test`; `pnpm build` | 400 sin texto pg; `requestId` intacto |
| 6 | PR-DX-1 | `validate:local` incluye `security:public-surface` | ENG | ENG-P2-005 | F1 | package script | ⚠ package | Bajo | `pnpm validate:local` | Gate local = CI en superficie pública |
| 7 | PR-CLEAN-1 | Eliminar/unificar `error-handler.ts` legacy | ENG | ENG-P3-007 | F1 | backend | ⚠ backend | Bajo | `pnpm typecheck`; `pnpm test` | App sin handler muerto |
| 8 | PR-TYPE-1 | Tipar `logger.ts` (quitar `any[]`) | ENG | ENG-P3-002 | F1 | backend | ⚠ backend | Bajo | `pnpm typecheck` | `logger.ts` sin `any` |
| 9 | PR-VIS-1 | Eliminar dark-mode muerto o documentar theme único | VIS | VIS-P1-003 | F1 | frontend | frontend | Bajo-Medio | `theme-mode.spec`; typecheck/lint/build | 0 `dark:`; un solo mecanismo |
| 10 | PR-VIS-2 | Tokenizar status badge off-token | VIS | VIS-P1-004 | F1 | frontend | frontend | Bajo | E2E admin-reports; typecheck/lint/build | 0 colores crudos en el componente |
| 11 | PR-VIS-4 | Acotar `user-select:none` al chrome | VIS | VIS-P1-008 | F1 | frontend | frontend | Bajo | E2E no-scroll; manual de copia | Selección en contenido/informe; chrome no |
| 12 | PR-VIS-3 | Tokens elevación+gradiente+focus-ring | VIS | VIS-P2-001/002, VIS-P3-001/002 | F1 | frontend | frontend | Bajo-Medio | typecheck/build; `theme-mode.spec` | Tokens definidos; hover no-op corregido; `badge` `focus-visible` |
| 13 | PR-VIS-5 | Primitivas `ui/select|textarea|label` | VIS | VIS-P1-006 (f1) | F1 | frontend (`ui/*`) | frontend | Medio | typecheck/build | Primitivas accesibles; sin migrar call-sites |
| 14 | PR-LINT-1 | ESLint/Biome backend + paso CI (sin formateo masivo) | ENG | ENG-P1-005 | F2 | CI+deps | ⚠ deps+CI | Bajo | `pnpm lint` backend (nuevo) | Lint verde sin `--fix` masivo |
| 15 | PR-COV-1 | Cobertura c8 (no bloqueante, sin umbral) | ENG | ENG-P1-002 | F2 | deps+CI | ⚠ deps+CI | Bajo | `pnpm test:coverage` (nuevo) | Baseline % publicado |
| 16 | PR-FE-TEST-1 | vitest + testing-library; suite `lib/api.ts` | ENG | ENG-P1-003 | F2 | frontend+deps | ⚠ deps | Bajo | `pnpm --dir frontend test` (nuevo) | ≥1 suite unit verde |
| 17 | PR-VIS-8 | axe-core a11y en rutas clave | VIS | VIS-P1-007 | F2 | test+deps | ⚠ dep (axe) | Bajo | `@axe-core/playwright` | axe verde; contraste <4.5:1 corregido/registrado |
| 18 | PR-E2E-1 | E2E cross-browser + contra `next start` | ENG | ENG-P1-004 (+VIS-P0-001) | F2 | CI+test | ⚠ CI | Medio | E2E multi-browser + smoke prod | ≥2 browsers + build verde |
| 19 | PR-VIS-9 | Regresión visual: baselines + viewports + fixtures estrés | VIS | VIS-P0-002, VIS-P2-005, VIS-P2-010 | F2 | test+CI | ⚠ CI (baselines) | Medio (flake) | `toHaveScreenshot` + job separado | Baselines estables; diff>threshold bloquea P0/P1 |
| 20 | PR-VIS-10 | Proyectos Playwright `webkit`+`firefox` | VIS | VIS-P0-001 | F2 | test+CI | ⚠ CI (proyectos) | Bajo-Medio | E2E webkit+firefox subset | Smoke crítico verde en WebKit+Firefox |
| 21 | PR-MUT-1 *(der.)* | Piloto Stryker en módulo crítico | ENG | ENG-P2-007 | F2 | deps | ⚠ dep | Bajo | score de mutación baseline | Score baseline publicado |
| 22 | PR-VIS-6 | Unificar `FilterBar/FilterField` + touch ≥40px | VIS | VIS-P1-005, VIS-P2-003 | F3 | frontend (dashboard) | frontend + E2E no-scroll | Medio | E2E no-scroll + filtros por módulo | FilterBar único + `<Button>` + focus `ring-ring/85` |
| 23 | PR-VIS-7 | Extraer primitivas token-card compartidas | VIS | VIS-P1-002 | F3 | frontend (refactor) | frontend | Medio | E2E tokens admin+clínica | Primitivas extraídas; sin cambio visual |
| 24 | PR-VIS-CSS-1 *(der.)* | Extracción gradual `globals.css` por `@layer`/dominio | VIS | VIS-P1-001 (extracción diferida) | F3 | frontend (`globals`) | frontend (post-baseline) | Medio | typecheck/build + **PR-VIS-9 previo** | Bloques extraídos sin cambio visual |
| 25 | PR-VIS-11 | Lighthouse/CWV baseline + decisión perspective | VIS | VIS-P2-009, VIS-P2-007 | F3 | perf+CI | ⚠ tooling CWV | Bajo | Lighthouse/unlighthouse baseline | Baseline LCP/CLS/INP; perspective decidido |
| 26 | PR-VIS-NAV-1 *(der.)* | Nav horizontal desde `lg` (tablet) | VIS | VIS-P2-004 | F3 | frontend | frontend | Bajo | smoke 768/1024 | Nav full desde `lg`; sin overflow |
| 27 | PR-VIS-TYPO-1 *(der.)* | Escala tipográfica tokenizada + decisión display face | VIS | VIS-P2-006, VIS-P3-004 | F3 | frontend/marca | frontend/marca | Bajo | typecheck/build + regresión visual | Escala tokenizada; decisión de marca registrada |
| 28 | PR-VIS-STATE-1 *(der.)* | Doc mapping canónico estado↔stage | VIS | VIS-P2-008 | F3 | docs | No | Nulo | `git diff --name-only` docs | Mapping documentado; labels alineadas |
| 29 | PR-VIS-DS-CATALOG-1 *(der.)* | Catálogo DS / Storybook ligero | VIS | VIS-P3-003 | F3 | tooling | ⚠⚠ tooling | Bajo | build catálogo | DS documentado/catalogado |
| 30 | PR-VIS-CLEANUP-1 *(cleanup-bundle)* | Tap-highlight + inline styles | VIS | VIS-P3-005, VIS-P3-006 | F3 | frontend | frontend | Bajo | typecheck/lint/build | `active:` explícito; inline movido a clases |
| 31 | PR-OBS-1 | Logger estructurado (pino) + `requestId` + niveles | ENG | ENG-P1-006, ENG-P2-006 | F4 | backend | ⚠ backend (¿dep pino?) | Medio | smoke de logs; healthcheck | Logs JSON con nivel+`requestId`; sin secretos |
| 32 | PR-CSP-1 | Plan/medición → CSP enforcing | ENG | ENG-P2-008 | F4 | frontend | frontend (tras revisar reportes) | Medio | E2E sin violaciones CSP | CSP enforcing sin violaciones |
| 33 | PR-RL-DIST-1 *(der.)* | Rate-limit/caches distribuido o single-instance documentado | ENG | ENG-P2-010 | F4 | backend | ⚠ backend | Medio | test límite "tras reinicio" | Límite restart-safe o instancia única documentada |
| 34 | PR-API-1 | Partir `lib/api.ts` en `api/*` por dominio | ENG | ENG-P1-007, ENG-P2-003 (f1) | F5 | frontend | frontend | Bajo | typecheck + E2E | `api.ts` dividido; sin cambio de comportamiento |
| 35 | PR-BE-SVC-1 | Service layer en 1 ruta grande (piloto) | ENG | ENG-P1-007 | F5 | backend | ⚠ backend | Medio | tests de ruta | Contrato HTTP idéntico; negocio en service |
| 36 | PR-ZOD-1 *(der.)* | Unificar major de zod en el workspace | ENG | ENG-P2-002 | F5 | deps | ⚠ deps | Medio | typecheck+test ambos lados | Un solo major de zod |
| 37 | PR-SHARED-1 *(der.)* | Paquete `shared/` de contratos / decisión OpenAPI | ENG | ENG-P2-003 (f2) | F5 | arquitectura | ⚠ deps/arq | Medio | typecheck cross-package | Contratos compartidos o generación decidida |
| 38 | PR-DUP-1 *(der.)* | Extraer hook+UI compartida ParticularTokens (dominio) | ENG | ENG-P2-004 | F5 | frontend | frontend (coord. PR-VIS-7) | Medio | E2E tokens admin+clínica | Dominio dedup; especializado por rol |
| 39 | PR-ENG-CLEANUP-1 *(cleanup-bundle)* | react-hooks rules + proxy admin 404 | ENG | ENG-P3-001, ENG-P3-005 | F5 | frontend | frontend | Bajo | lint + E2E admin sin cookie | Rules reactivadas; 404 admin evaluado |
| 40 | PR-DOCS-GOV-1 *(der.)* | Política de pinning + DoD/segundo revisor | ENG | ENG-P3-003, ENG-P3-004 | F5 | docs | No | Nulo | `git diff --name-only` docs | Política y DoD documentados |
| 41 | PR-INFRA-1 | `render.yaml` blueprint (build/start/health/env names) | ENG | ENG-P2-009 | F6 | infra+docs | ⚠ infra | Bajo | lint YAML | Blueprint válido sin secretos |
| 42 | PR-RLS-1 | RLS defensa-en-profundidad + rol no-priv + rollback/down | ENG | ENG-P1-001 (f2), ENG-P2-011 | F6 | DB+docs | **⚠⚠ DB** | **Alto** | tests tenant DB en **no-prod** + plan rollback | RLS en no-prod; aislamiento DB testeado |
| 43 | PR-OPS-DRILL-1 *(der.)* | Backup/restore drill + estrategia rollback de migración | ENG | ENG-P2-011 (ops) | F6 | ops/docs | **⚠⚠ productivo** | Alto | restore drill documentado | RTO/RPO verificados (externo) |
| 44 | PR-QA-PROD-1 *(der.)* | QA visual productivo autenticado (dashboards) | VIS | VIS-P2-010 (prod), VIS Fase 5 | F7 | QA/docs | ⚠ acceso prod | Medio | matriz estados extremos + capturas | QA autenticado documentado |
| 45 | PR-QA-DEVICES-1 *(der.)* | Devices reales iOS/Android + Firefox/Edge/Safari | VIS | VIS-P0-001 (externo) | F7 | QA/docs | ⚠ devices/externo | Medio | matriz de devices + AT | Render real verificado |
| 46 | PR-PERF-PROD-1 *(der.)* | Lighthouse/CWV prod + p95/p99 latencia | VIS+ENG | VIS-P2-009 (prod), ENG §16 | F7 | QA/docs | ⚠ acceso prod | Medio | Lighthouse + APM/logs | Baseline perf productivo |
| 47 | PR-INCIDENT-1 *(der.)* | Logs/metrics/alerts + incident + rollback drill + SLOs | ENG | ENG-P1-006 (ops), Gate 8 | F7 | ops/docs | ⚠ productivo | Medio | drill de incidente/rollback | Incident readiness operativo |
| 48 | PR-CERT-1 *(der.)* | Sign-off final de readiness (DoD visual+software) | Roadmap | DoD §17 VIS + §20 ENG | F7 | docs | Product owner | Nulo | checklist §25 completo | Certificación firmada |

**Total: 48 PRs** (1 opcional). Distribución: F0=2(+1 opc) · F1=10 · F2=8 · F3=9 · F4=3 · F5=7 · F6=3 · F7=5. Rango 35–50 respetado; el número surge de los 27 PRs nombrados por las auditorías + 18 derivados de sus "PR futuro"/externos + 3 de orquestación/certificación, no de forzar una cifra.

**Reglas aplicadas:** docs-only al inicio (F0) · sin autorización antes de deps/CI/DB · DB nunca mezclada con visual · CI matrix nunca con refactor visual · observabilidad nunca con refactor de negocio · RLS nunca con cambio grande de schema · tokens nunca con rediseño · P3 sólo en cleanup-bundles seguros.

---

## 8. Phase 0 — Roadmap & Governance Baseline

Sin código productivo. Sólo documentación y congelamiento de contratos.

### PR-ROADMAP-0 — Crear este roadmap *(docs-only)*
- **Objetivo.** Mergear `docs/audit/total-engineering-roadmap.md` como orquestador de ejecución del 100% de ambas auditorías.
- **Archivos.** `docs/audit/total-engineering-roadmap.md` (este).
- **Tests.** Ninguno nuevo; verificar `git diff --name-only` = sólo `docs/**`.
- **Done.** Doc mergeado; conteos 26+26 estables; sin código.
- **Rollback.** Revertir el archivo.

### PR-VIS-0 — DS contract freeze *(docs)*
- **Objetivo.** Congelar el design system implícito en `docs/implementation/design-system-contract.md`: inventario de tokens, mapa de utilities de `globals.css`, reglas DS (§10 visual). Frena el patrón append-only y los cards >1k LOC.
- **Archivos.** `docs/implementation/design-system-contract.md` (nuevo) (+ opcional 1 línea de índice).
- **Tests.** Ninguno; docs-only.
- **Done.** Contrato DS publicado; sin tocar código.
- **Rollback.** Revertir el doc.

### PR-DOCS-IDX-0 *(opcional, docs)*
- **Objetivo.** Indexar este roadmap y ambas auditorías en `docs/audit/README.md` y conciliar con `docs/SOURCES_OF_TRUTH.md` (ENG-P2-012 parcial — continuidad de consolidación documental).
- **Archivos.** `docs/audit/README.md`, `docs/SOURCES_OF_TRUTH.md`.
- **Tests.** Ninguno; docs-only.
- **Done.** Índice navegable; sin contradicción con docs vigentes.
- **Rollback.** Revertir el índice.

---

## 9. Phase 1 — Low-Risk Quick Wins

Integra los **lote 0** de ambas auditorías, ordenado por menor riesgo y mayor valor. Cada PR es chico y reversible. (Briefs ejecutables en §22.)

- **PR-SEC-2** *(docs+test)* — ADR de aislamiento + guard anti-IDOR `clinicId` (ENG-P1-001 f1, ENG-P3-006). Máximo valor de seguridad, 0 runtime.
- **PR-SEC-1** *(backend ⚠)* — Sanitizar 4xx de pg-code (ENG-P2-001, CWE-209). S/reversible.
- **PR-DX-1** *(package ⚠)* — `validate:local` incluye `security:public-surface` (ENG-P2-005).
- **PR-CLEAN-1** *(backend ⚠)* — Eliminar handler legacy (ENG-P3-007).
- **PR-TYPE-1** *(backend ⚠)* — Tipar `logger.ts` (ENG-P3-002).
- **PR-VIS-1** *(frontend)* — Eliminar dark-mode muerto / theme único (VIS-P1-003).
- **PR-VIS-2** *(frontend)* — Tokenizar badge admin off-token (VIS-P1-004).
- **PR-VIS-4** *(frontend)* — Acotar `user-select` al chrome (VIS-P1-008).
- **PR-VIS-3** *(frontend)* — Tokens elevación/gradiente/focus + hover/focus fix (VIS-P2-001/002, VIS-P3-001/002).
- **PR-VIS-5** *(frontend `ui/*`)* — Primitivas select/textarea/label (VIS-P1-006 f1).

> Orden recomendado de retorno: PR-SEC-2 → PR-SEC-1 → PR-DX-1 → PR-CLEAN-1 → PR-TYPE-1 (lote 0 software); en paralelo PR-VIS-1 → PR-VIS-2 → PR-VIS-4 → PR-VIS-3 → PR-VIS-5 (lote 0 visual). No mezclar visual y backend en el mismo PR.

---

## 10. Phase 2 — Measurement & Test Infrastructure

"Un tooling por PR" (regla anti-deriva de ambas fuentes). **Medir antes de exigir thresholds.**

| PR | Qué mide/instala | Hallazgo | Autorización |
| --- | --- | --- | --- |
| PR-COV-1 | Cobertura backend (c8), **sin umbral** | ENG-P1-002 | ⚠ deps+CI |
| PR-LINT-1 | Lint backend (ESLint/Biome), ruleset mínimo, **sin formateo masivo** | ENG-P1-005 | ⚠ deps+CI |
| PR-FE-TEST-1 | Unit FE (vitest + testing-library), base `lib/api.ts` | ENG-P1-003 | ⚠ deps |
| PR-VIS-8 | a11y axe-core en rutas clave (contraste por estado) | VIS-P1-007 | ⚠ dep (axe) |
| PR-E2E-1 | E2E cross-browser + contra `next build && next start` | ENG-P1-004 (+VIS-P0-001) | ⚠ CI |
| PR-VIS-9 | Regresión visual `toHaveScreenshot` (baseline público primero) + viewports 320/768/1024/1536/1920 + fixtures estrés | VIS-P0-002, VIS-P2-005, VIS-P2-010 | ⚠ CI (baselines) |
| PR-VIS-10 | Proyectos Playwright `webkit`+`firefox` (subset crítico) | VIS-P0-001 | ⚠ CI (proyectos) |
| PR-MUT-1 | Piloto mutation (Stryker) en un módulo | ENG-P2-007 | ⚠ dep |

**Coordinación cross-browser:** PR-E2E-1 (prod-mode + projects) y PR-VIS-10 (subset visual WebKit/Firefox) atacan la **misma** raíz Chromium-only (ENG-P1-004 ≡ VIS-P0-001). Deben coordinarse en `playwright.config.ts`/CI para no duplicar configuración: PR-E2E-1 introduce el build de producción y la matriz; PR-VIS-10 añade el render visual divergente. La verificación en device/iOS real queda en F7 (PR-QA-DEVICES-1, acceso externo).

> Todo F2 requiere autorización ⚠ deps/CI: marcar explícitamente en cada PR.

---

## 11. Phase 3 — Visual System Hardening

Construye sobre tokens/primitivas de F1 y la red de regresión de F2.

- **PR-VIS-6** — Shared `FilterBar/FilterField` único + `<Button>` + focus único + touch ≥40px mobile (VIS-P1-005, VIS-P2-003). Estandariza también diálogos sobre `ModuleDialog`.
- **PR-VIS-7** — Extracción de primitivas token-card compartidas admin↔clínica, **sin cambio visual** (VIS-P1-002). Coordinar con PR-DUP-1 (F5, extracción de dominio/hook): misma dupla de archivos (`AdminParticularTokensCard` 1894 + `ClinicParticularTokensCard` 1604).
- **PR-VIS-CSS-1** *(der.)* — Extracción gradual de `globals.css` por `@layer`/dominio (VIS-P1-001 diferido). **Requiere PR-VIS-9 (baseline) mergeado** antes de mover bloques.
- **PR-VIS-11** — Lighthouse/CWV baseline + decisión perspective scroll (VIS-P2-009/007).
- **PR-VIS-NAV-1** *(der.)* — Nav horizontal desde `lg` (VIS-P2-004).
- **PR-VIS-TYPO-1** *(der.)* — Escala tipográfica tokenizada + decisión display face (VIS-P2-006, VIS-P3-004).
- **PR-VIS-STATE-1** *(der., docs)* — Mapping canónico estado↔stage (VIS-P2-008).
- **PR-VIS-DS-CATALOG-1** *(der., ⚠⚠)* — Catálogo DS/Storybook ligero, **después** de primitivas mínimas (VIS-P3-003).
- **PR-VIS-CLEANUP-1** *(cleanup-bundle)* — Tap-highlight `active:` explícito + inline styles a clases (VIS-P3-005/006).

> Reglas: no tocar color global sin PR-VIS-8 (axe) previo; no mover CSS global amplio sin PR-VIS-9; no romper contratos no-scroll (E2E por módulo).

---

## 12. Phase 4 — Security & Backend Reliability

- **PR-OBS-1** *(backend ⚠ pino)* — Logger estructurado detrás de `logInfo/logWarn/logError`, `level` por env, `requestId` por línea; migración **gradual** (error handler + rutas críticas; sin reescribir las 29 ocurrencias). Cubre ENG-P1-006 y ENG-P2-006. **Precedencia dura para PR-RLS-1** (no operar/ tocar DB a ciegas).
- **PR-CSP-1** *(frontend)* — Camino a CSP **enforcing** tras analizar reportes report-only (ENG-P2-008). No activar enforcing sin revisar reportes.
- **PR-RL-DIST-1** *(der., backend ⚠)* — Rate-limit/caches distribuido (DB/Redis) para limiters no-login, o documentar instancia única (ENG-P2-010).

> Logging/auth/session hardening: los invariantes de sesión/cookies/roles ya son senior (auditoría software §6.3) — **no se tocan** salvo el cableado del logger. Sin secretos/PII en logs. Validación layer (zod) ya presente; no se re-implementa.

---

## 13. Phase 5 — Architecture & Contract Extraction

- **PR-API-1** *(frontend)* — Partir `lib/api.ts` (2371 LOC) en `api/*` por dominio con re-exports, **sin cambio de comportamiento** (ENG-P1-007, ENG-P2-003 f1). Habilita PR-FE-TEST-1.
- **PR-BE-SVC-1** *(backend ⚠)* — Service layer en 1 ruta grande piloto (p.ej. `auth.fastify.ts`), contrato HTTP idéntico (ENG-P1-007).
- **PR-ZOD-1** *(der., deps ⚠)* — Unificar major de zod (v3 back / v4 front) (ENG-P2-002). Precede a contratos compartidos.
- **PR-SHARED-1** *(der., arq ⚠)* — Paquete `shared/` de tipos/validadores o decisión OpenAPI/zod compartido (ENG-P2-003 f2). Depende de PR-ZOD-1.
- **PR-DUP-1** *(der., frontend)* — Extraer hook+UI compartida ParticularTokens (dominio), especializar por rol (ENG-P2-004). Coordinar con PR-VIS-7 (misma dupla de archivos): PR-VIS-7 = primitivas visuales sin cambio de apariencia; PR-DUP-1 = lógica de dominio/hook.
- **PR-ENG-CLEANUP-1** *(cleanup-bundle, frontend)* — Reactivar `react-hooks/*` rules por archivo + evaluar 404 de página admin sin cookie (ENG-P3-001, ENG-P3-005).
- **PR-DOCS-GOV-1** *(der., docs)* — Política de pinning/ventana de actualización + DoD con segundo revisor (ENG-P3-003, ENG-P3-004).

> God-files: split puro, sin cambios funcionales (No-Go). PR-LINT-1 (F2) **antes** de PR-API-1/PR-BE-SVC-1 para evitar ruido en refactor.

---

## 14. Phase 6 — Database/RLS & Operational Readiness

⚠⚠ **Autorización DB/productiva obligatoria.** No avanzar sin entorno no-prod, rol DB no-privilegiado y plan de migración/rollback.

- **PR-INFRA-1** *(infra ⚠)* — `render.yaml` blueprint (build/start/health/env names) **sin secretos** (ENG-P2-009). Habilita DR/reproducibilidad (Gate 7).
- **PR-RLS-1** *(DB ⚠⚠)* — RLS defensa-en-profundidad con rol no-privilegiado + tests de aislamiento DB + estrategia de rollback/down (ENG-P1-001 f2, ENG-P2-011). **Precedencias duras:** PR-SEC-2 (ADR+guard) + PR-OBS-1 (observabilidad) + PR-COV-1 (cobertura) mergeados; sólo en **entorno no-prod** primero.
- **PR-OPS-DRILL-1** *(der., ops ⚠⚠ externo)* — Backup/restore drill real + RTO/RPO + estrategia de rollback por migración (ENG-P2-011 ops). Requiere acceso productivo (ver §27 software / open questions).

**Brechas que requieren acceso externo/productivo (no cerrables desde el repo):** existencia real de policies RLS en Supabase, rol/privilegios del backend, escalado de instancias (rate-limit in-memory), sink de logs, backups y restore probado. Documentadas como bloqueadas por acceso externo, **no como resueltas**.

---

## 15. Phase 7 — Production Validation & Certification

⚠ **Acceso externo/productivo.** Estas validaciones cierran lo que las auditorías marcan como "no verificable sin acceso productivo" (open questions §27 software / §37 visual). Hasta ejecutarlas, los gates 7/8 quedan **parciales**, no cerrados.

- **PR-QA-PROD-1** *(der.)* — QA visual productivo autenticado de dashboards (clínica/admin) + matriz de estados extremos (nombres largos, N filas, error API en vivo, sesión expirada) (VIS-P2-010 prod, Fase 5 visual).
- **PR-QA-DEVICES-1** *(der.)* — Devices reales iOS/Android + Firefox/Edge/Safari real + lector de pantalla (VoiceOver/NVDA/TalkBack) (VIS-P0-001 externo).
- **PR-PERF-PROD-1** *(der.)* — Lighthouse/CWV productivos (LCP/CLS/INP) + p95/p99 de latencia (VIS-P2-009 prod + ENG §16 perf).
- **PR-INCIDENT-1** *(der.)* — Logs/métricas/alertas reales + incident drill + rollback drill + SLOs/on-call (ENG-P1-006 ops, Gate 8).
- **PR-CERT-1** *(der.)* — Sign-off final de readiness contra el DoD visual (§17 visual) + DoD software (§20 software) + §25 de este roadmap.

---

## 16. Dependency Graph

Dependencias **duras** (bloqueantes) y **blandas** (recomendadas), unificadas visual+software.

| PR | Depende de | Bloquea | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| PR-ROADMAP-0 | — | toda la ejecución | Dura | Define scope/orden |
| PR-VIS-0 | — | PR-VIS-CSS-1 | Blanda | Freeze/contrato antes de extraer CSS |
| PR-SEC-2 | — | **PR-RLS-1** | **Dura** | ADR anti-IDOR (f1) **antes** de RLS (f2) |
| PR-VIS-3 | — | PR-VIS-6/7 | Blanda | Tokens antes de unificar componentes |
| PR-VIS-5 | — | PR-VIS-6 | Blanda | Primitivas antes de migrar filtros/forms |
| PR-VIS-6 | PR-VIS-3, PR-VIS-5 | — | Blanda | FilterBar usa tokens/primitivas |
| PR-VIS-7 | PR-VIS-5 | PR-DUP-1 (coord.) | Blanda | Primitivas visuales antes de dedup dominio |
| PR-COV-1 | — | **thresholds estrictos** | **Dura** | Medir **antes** de exigir umbral |
| PR-LINT-1 | — | lint blocking, PR-API-1, PR-BE-SVC-1 | Blanda | Baseline lint antes de blocking/refactor |
| PR-VIS-8 | — | **cambios de color globales** | **Dura** | axe/contrast **antes** de tocar color global |
| PR-VIS-9 | — | **cambios globales de CSS (PR-VIS-CSS-1)**; Gate 6 | **Dura** | Baseline visual **antes** de CSS global amplio |
| PR-VIS-10 | — | "cross-browser ready"; Gate 4 | Dura | Sin esto no se declara cross-browser |
| PR-E2E-1 | — | certification (F7) | Dura | **Production-mode E2E antes de certificación** |
| PR-FE-TEST-1 | PR-API-1 (blanda) | thresholds FE | Blanda | Módulos chicos más testeables |
| PR-API-1 | PR-LINT-1 (blanda) | PR-FE-TEST-1, PR-SHARED-1 | Blanda | Split limpio antes de unit/contratos |
| PR-ZOD-1 | — | PR-SHARED-1 | Dura | Un major de zod antes de schemas compartidos |
| PR-SHARED-1 | PR-ZOD-1 | contract tests estrictos FE/BE | Dura | **Decisión contrato/schema antes de contract tests** |
| PR-OBS-1 | — | **PR-RLS-1**, **PR-INCIDENT-1** | **Dura** | **Observabilidad antes de incident readiness y de tocar DB** |
| PR-CSP-1 | revisión report-only | Gate 2 (parcial) | Dura | Enforcing requiere análisis previo |
| PR-INFRA-1 | — | PR-OPS-DRILL-1, Gate 7 | Blanda | IaC habilita DR |
| PR-OPS-DRILL-1 | PR-INFRA-1 | **PR-RLS-1 irreversible**, Gate 7 | Dura | **Backup/restore antes de DB/RLS irreversible** |
| PR-RLS-1 | PR-SEC-2, PR-OBS-1, PR-COV-1, PR-OPS-DRILL-1 | Gate 2/6 | Dura | Defensa en profundidad con red previa |
| PR-CERT-1 | F0–F6 cerrados + F7 QA | — | Dura | Certificación sólo con todo lo previo |

**Precedencias clave exigidas por el enunciado (todas presentes arriba):** ADR anti-IDOR (PR-SEC-2) antes de RLS · coverage (PR-COV-1) antes de thresholds · lint baseline (PR-LINT-1) antes de blocking lint · visual baseline (PR-VIS-9) antes de CSS global · axe/contrast (PR-VIS-8) antes de color global · E2E production-mode (PR-E2E-1) antes de certification · observabilidad (PR-OBS-1) antes de incident readiness · backup/restore (PR-OPS-DRILL-1) antes de DB/RLS irreversible · contract/schema (PR-SHARED-1/PR-ZOD-1) antes de contract tests estrictos.

---

## 17. Authorization Roadmap

Roles, no personas (en proyecto solo-owner, "reviewer" = checklist + self-review disciplinado).

| Fase | PR | Tipo de autorización | Motivo | Quién debería aprobar |
| --- | --- | --- | --- | --- |
| F0 | PR-ROADMAP-0, PR-VIS-0, PR-DOCS-IDX-0 | Ninguna (docs) | Sin impacto runtime | Product owner |
| F1 | PR-SEC-2 | Ninguna (docs+test) | No toca runtime | Security reviewer + Staff full-stack |
| F1 | PR-SEC-1, PR-CLEAN-1, PR-TYPE-1 | ⚠ backend | Toca runtime backend | Staff full-stack (+ Security para SEC-1) |
| F1 | PR-DX-1 | ⚠ package script | Cambia gate local | DevOps/CI reviewer |
| F1 | PR-VIS-1/2/3/4/5 | Frontend (en scope) | Sin contrato/seguridad | Staff frontend + Design system reviewer |
| F2 | PR-LINT-1, PR-COV-1, PR-MUT-1 | ⚠ deps+CI | Supply-chain + gatekeeper | DevOps/CI reviewer + QA |
| F2 | PR-FE-TEST-1, PR-VIS-8 | ⚠ deps | Dependencia dev | QA/E2E reviewer |
| F2 | PR-E2E-1, PR-VIS-9, PR-VIS-10 | ⚠ CI | Tiempo CI + baselines/proyectos | QA/E2E reviewer + DevOps/CI |
| F3 | PR-VIS-6/7/NAV/TYPO/STATE/CLEANUP/CSS-1 | Frontend | UI en scope | Staff frontend + Design system reviewer |
| F3 | PR-VIS-11 | ⚠ tooling CWV | Tooling/CI | Performance reviewer |
| F3 | PR-VIS-DS-CATALOG-1 | ⚠⚠ tooling/servicio | Storybook/catálogo | DevOps/CI + Design system reviewer |
| F4 | PR-OBS-1, PR-RL-DIST-1 | ⚠ backend (¿dep?) | Runtime + posible dep | Staff full-stack + DevOps/Ops |
| F4 | PR-CSP-1 | Frontend (tras reportes) | Romper app vs proteger | Security reviewer + Staff frontend |
| F5 | PR-ZOD-1, PR-SHARED-1 | ⚠ deps/arq | Supply-chain + contrato | Staff full-stack |
| F5 | PR-BE-SVC-1 | ⚠ backend | Refactor runtime | Staff full-stack |
| F5 | PR-API-1, PR-DUP-1, PR-ENG-CLEANUP-1, PR-DOCS-GOV-1 | Frontend/docs | En scope | Staff frontend |
| F6 | PR-INFRA-1 | ⚠ infra | IaC/deploy | DevOps/CI reviewer |
| F6 | PR-RLS-1 | **⚠⚠ DB** + plan rollback | Riesgo de caída/datos | DB/Supabase reviewer + Security |
| F6 | PR-OPS-DRILL-1 | **⚠⚠ productivo** | Backup/restore real | Operations reviewer + DB/Supabase |
| F7 | PR-QA-PROD-1, PR-QA-DEVICES-1, PR-PERF-PROD-1 | ⚠ acceso prod/externo | Datos/devices reales | QA/E2E reviewer + Operations |
| F7 | PR-INCIDENT-1 | ⚠ productivo | Logs/alertas reales | Operations reviewer |
| F7 | PR-CERT-1 | Sign-off | Go/no-go final | Product owner |

---

## 18. Validation Matrix by Phase

| Fase | Validaciones mínimas | Validaciones adicionales | Gate |
| --- | --- | --- | --- |
| F0 | `git diff --check` · `git diff --name-only` (solo `docs/**`) | — | Gate 0 |
| F1 | Gate global (abajo) | `theme-mode.spec`, E2E no-scroll/admin afectado, test 400 sin pg, `pnpm validate:local` | Gate 1 |
| F2 | Gate global | `pnpm test:coverage`, `pnpm lint` backend, `pnpm --dir frontend test`, axe, E2E multi-browser, `toHaveScreenshot` | Gate 2/3 |
| F3 | Gate global | E2E no-scroll por módulo, regresión visual (PR-VIS-9 previo), grep hardcodes residuales | Gate 4 |
| F4 | Gate global | smoke de logs (sin secretos/PII), E2E sin violaciones CSP, test límite multi-instancia | Gate 5 |
| F5 | Gate global | typecheck cross-package, E2E tokens admin+clínica, tests de ruta piloto | Gate 5 |
| F6 | Gate global + `pnpm db:migrate` (CI Postgres) + `schema:verify` | tests tenant DB en no-prod, restore drill documentado, plan rollback | Gate 6 |
| F7 | Gate global | Lighthouse/CWV, p95/p99, matriz devices/estados extremos, incident/rollback drill | Gate 7/8 |

**Gate global previo a cualquier merge (de ambas auditorías):**
- `git diff --check`
- `pnpm test`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend build`
- `pnpm build`
- `pnpm security:public-surface`

**Regla `next-env.d.ts` (memoria `feedback_next_env_regeneration`).** Si Next modifica `frontend/next-env.d.ts`:
- `git restore --staged frontend/next-env.d.ts 2>$null`
- `git restore frontend/next-env.d.ts`
- repetir `pnpm test`

---

## 19. No-Go Criteria Consolidated

Unifica No-Go visual (§35 visual) + software (§41 software). Cualquiera **bloquea merge**.

| No-Go | Aplica a | Motivo |
| --- | --- | --- |
| DB sin rollback plan | DB/migration (PR-RLS-1) | Irreversible |
| Auth sin negative tests | Security | Frontera crítica |
| Tenant isolation sin anti-IDOR | Security/DB | Fuga de datos cross-tenant |
| Dependency sin autorización | deps | Supply-chain / lockfile |
| CI sin fallback | workflows | Romper gatekeeper sin revert |
| CSS global sin responsive/no-scroll/E2E | CSS/global | Regresión silenciosa |
| Dashboard sin E2E específico (rompe no-scroll) | dashboard | Contrato no-scroll es activo |
| Visual baselines sin política de actualización | regresión visual | Baselines obsoletos/falsos positivos |
| API contract change sin contract tests | API | Drift FE/BE |
| `next-env.d.ts` modificado sin restaurar | frontend build | Ruido/regresión |
| P0/P1 sin PR | cobertura | Rompe el contrato 100% |
| PR grande no reversible | refactor | Rollback difícil |
| Mezcla refactor + funcionalidad crítica | refactor | Riesgo acumulado |
| Tokens/color global sin contrast audit (axe) | tokens/color | Riesgo WCAG |
| CI visual activado sin baseline estable | CI visual | Flake |
| Regresión visual + cross-browser + Storybook juntos | tooling | Riesgo acumulado (un tooling por PR) |
| Secreto/PII en logs o respuesta | observability/security | Confidencialidad |
| Optimizar performance sin métricas reales | performance | Supuestos a ciegas |
| Cambio visual en línea de software (o viceversa) | scope | Soberanía de cada auditoría |

---

## 20. Roadmap Gates

| Gate | Condición de entrada | Condición de salida | Evidencia | Bloqueantes |
| --- | --- | --- | --- | --- |
| **Gate 0 — Roadmap merged** | Roadmap redactado | PR-ROADMAP-0 + PR-VIS-0 mergeados | `git diff --name-only` docs | — |
| **Gate 1 — Low-risk controls closed** | Gate 0 | Lote 0 VIS+ENG mergeado | E2E/tests por PR; baseline verde | F1 |
| **Gate 2 — Measurement exists** | Gate 1 | Cobertura medida + lint backend + unit FE + axe instalados (sin umbral) | Reporte c8, `pnpm lint`, suites | PR-COV-1/LINT-1/FE-TEST-1/VIS-8 |
| **Gate 3 — CI/test hardening active** | Gate 2 | E2E prod-mode + cross-browser + regresión visual baseline activos | E2E multi-browser, `toHaveScreenshot` | PR-E2E-1/VIS-9/VIS-10 |
| **Gate 4 — Visual system stabilized** | Gate 3 | Filtros/primitivas unificados, CSS extraído por fases, tipografía/contraste/motion | E2E no-scroll, regresión visual, axe | F3 |
| **Gate 5 — Backend/security reliability improved** | Gate 2 | Observabilidad estructurada + CSP enforcing + rate-limit robusto + service layer piloto | smoke logs, E2E CSP, tests ruta | F4/F5 |
| **Gate 6 — DB/RLS verified** | Gate 5 + PR-SEC-2/OBS-1/COV-1/OPS-DRILL-1 | RLS en no-prod con rol no-priv + tests DB + rollback | tests tenant DB, plan rollback | **⚠⚠** PR-RLS-1/INFRA-1 |
| **Gate 7 — Production readiness validated** | Gate 6 | QA visual prod + devices reales + CWV/p95-p99 + incident/rollback drill | Lighthouse, matriz devices, drills | **⚠ externo** F7 |
| **Gate 8 — Engineering excellence certification** | Gate 1–7 | DoD visual + DoD software + §25 completos; sign-off | Checklist §25 firmado | PR-CERT-1 |

---

## 21. 30/60/90 Day Execution Plan

> **No son fechas calendario estrictas.** Dependen de disponibilidad y autorizaciones (deps/CI/DB/productivo). Mantener **una rama/PR por vez** y `main` limpio. Las ventanas se solapan si hay autorizaciones disponibles.

| Ventana | Objetivo | PRs | Resultado esperado |
| --- | --- | --- | --- |
| **0–30 días** | Roadmap + lote 0 + arranque de medición | PR-ROADMAP-0, PR-VIS-0, PR-SEC-2, PR-SEC-1, PR-DX-1, PR-CLEAN-1, PR-TYPE-1, PR-VIS-1/2/4/3/5; arranque PR-LINT-1/COV-1 | Drift de marca reducido; ADR+guard anti-IDOR; 4xx sanitizado; medición iniciada |
| **30–60 días** | Test infra + cross-browser + regresión + sistema visual | PR-FE-TEST-1, PR-VIS-8, PR-E2E-1, PR-VIS-9, PR-VIS-10, PR-MUT-1, PR-VIS-6/7/CSS-1/11 | Red de regresión activa; cross-browser; design system unificado |
| **60–90 días** | Backend reliability + arquitectura + (inicio) DB/prod | PR-OBS-1, PR-CSP-1, PR-RL-DIST-1, PR-API-1, PR-BE-SVC-1, PR-ZOD-1, PR-SHARED-1, PR-DUP-1, PR-ENG-CLEANUP-1, PR-DOCS-GOV-1; arranque PR-INFRA-1/RLS-1 (no-prod) | Operación diagnosticable; bordes claros; preparación DB con red previa |
| **>90 días (autorización fuerte/externo)** | DB/RLS + readiness productivo + certificación | PR-INFRA-1, PR-OPS-DRILL-1, PR-RLS-1, PR-QA-PROD-1, PR-QA-DEVICES-1, PR-PERF-PROD-1, PR-INCIDENT-1, PR-CERT-1 | Defensa en profundidad; QA productivo; certificación |

---

## 22. First 10 PR Execution Briefs

Orden de ejecución 1–10. Listos para copiar como prompt. Todos respetan el protocolo VETNEB (cambio mínimo; sin tocar fuera de scope; Git manual lo hace Nico; sin commit/push/PR).

### Brief 1 — PR-ROADMAP-0 · crear el roadmap *(docs-only)*
- **Hallazgos.** Orquesta los 52 (no genera hallazgos).
- **Archivos probables.** `docs/audit/total-engineering-roadmap.md`.
- **Permitido.** Sólo documentación.
- **Prohibido.** Tocar frontend/backend/tests/deps/CI/DB; modificar las auditorías fuente. 0 código.
- **Tests.** Ninguno nuevo.
- **Validaciones.** `git diff --check` · `git diff --name-only` (solo `docs/**`) + gate global (docs-only no rompe nada).
- **Rollback.** Revertir el archivo.
- **Prompt.** "Crear `docs/audit/total-engineering-roadmap.md` orquestando el 100% de ambas auditorías. Docs-only. No tocar código ni las auditorías fuente. No commit/push."

### Brief 2 — PR-VIS-0 · DS contract freeze *(docs)*
- **Hallazgos.** VIS-P1-001 (freeze).
- **Archivos probables.** `docs/implementation/design-system-contract.md` (+ opc. índice).
- **Permitido.** Documentación (inventario tokens, mapa utilities, reglas DS §10 visual).
- **Prohibido.** Tocar `globals.css` u otro código. Congelar el patrón, no moverlo.
- **Tests.** Ninguno.
- **Validaciones.** `git diff --name-only` (solo `docs/**`).
- **Rollback.** Revertir el doc.
- **Prompt.** "Crear `design-system-contract.md` congelando tokens/utilities/reglas DS. Docs-only. No tocar CSS."

### Brief 3 — PR-SEC-2 · ADR aislamiento + guard anti-IDOR `clinicId` *(docs+test)*
- **Hallazgos.** ENG-P1-001 (f1), ENG-P3-006.
- **Archivos probables.** `docs/governance/adr-XXXX-tenant-isolation.md`, `test/tenant-isolation-guard.test.ts`.
- **Permitido.** Doc ADR + test de regresión estructural (verifica lecturas clínicas vía funciones scoped; `getReportById` sólo en `admin-*`).
- **Prohibido.** Tocar `server/db.ts`, rutas, migraciones, deps, CI. 0 runtime.
- **Tests.** El nuevo test falla si una ruta clínica usa `getReportById` sin scope.
- **Validaciones.** `pnpm test` · `git diff --name-only` (solo docs+test) + gate global.
- **Rollback.** Borrar ADR + test.
- **Prompt.** "Agregar ADR de aislamiento app-layer-vs-RLS + test-guard anti-IDOR `clinicId`. Docs+test only. 0 cambios de runtime. Estilo de los tests de contrato existentes."

### Brief 4 — PR-SEC-1 · sanitizar 4xx de pg-code *(backend ⚠)*
- **Hallazgos.** ENG-P2-001 (CWE-209).
- **Archivos probables.** `server/fastify-app.ts` (`getFastifyErrorStatus`/`setErrorHandler`).
- **Permitido.** Sólo el body de error: 400 de pg-code → mensaje genérico, conservando `requestId`.
- **Prohibido.** Cambiar status codes, rutas, zod, deps; alterar `{success,error,...}`.
- **Tests.** Test que dispara pg-code y verifica que `error`/`details` no contienen texto pg; incluye `requestId`.
- **Validaciones.** `pnpm test` · `pnpm build` + gate global.
- **Rollback.** Revertir el mapeo (1 función).
- **Prompt.** "Sanitizar 400 derivados de pg-code (23505/23503/22P02/42703) sin filtrar constraint/columna; conservar requestId. Cambio mínimo en un archivo. ⚠ backend."

### Brief 5 — PR-DX-1 · `validate:local` + `security:public-surface` *(package ⚠)*
- **Hallazgos.** ENG-P2-005.
- **Archivos probables.** `package.json` (scripts).
- **Permitido.** Agregar `security:public-surface` a `validate:local`.
- **Prohibido.** Tocar otros scripts/CI/deps.
- **Tests.** `pnpm validate:local` ejecuta la superficie pública y falla si rompe.
- **Validaciones.** `pnpm validate:local` + gate global.
- **Rollback.** Revertir el script.
- **Prompt.** "Incluir `security:public-surface` en `validate:local`. Sólo `package.json` scripts. ⚠ package."

### Brief 6 — PR-CLEAN-1 · eliminar handler legacy *(backend ⚠)*
- **Hallazgos.** ENG-P3-007.
- **Archivos probables.** `server/middlewares/error-handler.ts` + su test.
- **Permitido.** Eliminar/unificar el handler Express muerto (la app usa `setErrorHandler`); reasignar cobertura del test.
- **Prohibido.** Tocar el handler vivo en `fastify-app.ts`.
- **Tests.** `pnpm typecheck` + `pnpm test` verdes.
- **Validaciones.** Gate global.
- **Rollback.** Restaurar el archivo.
- **Prompt.** "Eliminar/unificar `error-handler.ts` legacy (muerto en prod). typecheck+test verdes. ⚠ backend."

### Brief 7 — PR-TYPE-1 · tipar `logger.ts` *(backend ⚠)*
- **Hallazgos.** ENG-P3-002.
- **Archivos probables.** `server/lib/logger.ts`.
- **Permitido.** Quitar `any[]`, tipar args.
- **Prohibido.** Cambiar la API pública del logger (no tocar callers).
- **Tests.** `pnpm typecheck`.
- **Validaciones.** Gate global.
- **Rollback.** Revertir tipos.
- **Prompt.** "Tipar args de `logger.ts` quitando `any[]`, sin cambiar la API pública. typecheck verde. ⚠ backend."

### Brief 8 — PR-VIS-1 · eliminar dark-mode muerto o documentar theme único *(frontend)*
- **Hallazgos.** VIS-P1-003.
- **Archivos probables.** `frontend/tailwind.config.ts`, `frontend/src/app/globals.css` (bloque `.dark`).
- **Permitido.** Quitar `.dark` + `darkMode:"class"` muertos (0 usos `dark:`) **o** documentar theme único; no tocar el dark real `[data-theme]`.
- **Prohibido.** Cambiar apariencia clara; introducir `dark:`; tocar otros bloques.
- **Tests.** `theme-mode.spec` verde; grep `0` `dark:`.
- **Validaciones.** typecheck/lint/build + `theme-mode.spec` + gate global.
- **Rollback.** Revertir config + bloque `.dark`.
- **Prompt.** "Eliminar dark-mode muerto (`.dark`/`darkMode:class`) o documentar theme único. Sin cambio visual. Si hay duda de que `.dark` sea muerto, detenerse y documentar."

### Brief 9 — PR-VIS-2 · tokenizar status badge off-token *(frontend)*
- **Hallazgos.** VIS-P1-004.
- **Archivos probables.** `frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx`.
- **Permitido.** Mapear `slate/sky/violet/emerald/amber` crudos a tokens `vetneb-*` o reusar `StatusBadge`; opcional icono/forma (WCAG 1.4.1).
- **Prohibido.** Cambiar la taxonomía de estados; tocar otros componentes.
- **Tests.** E2E admin-reports; visual del badge.
- **Validaciones.** typecheck/lint/build + E2E admin + gate global.
- **Rollback.** Revertir el componente.
- **Prompt.** "Tokenizar `AdminReportStatusBadge` sobre tokens de marca (preferir reuso de `StatusBadge`). 0 colores crudos. Sin cambiar taxonomía."

### Brief 10 — PR-VIS-4 · acotar `user-select:none` al chrome *(frontend)*
- **Hallazgos.** VIS-P1-008.
- **Archivos probables.** `frontend/src/app/globals.css` (regla base; mantener orden **antes** de los bloques de dashboard — memoria de scope tests).
- **Permitido.** Limitar `user-select:none` al chrome (nav/botones/topbar); permitir selección en contenido público e informes.
- **Prohibido.** Romper contratos no-scroll; reordenar bloques que rompan scope tests legacy.
- **Tests.** E2E no-scroll; verificación manual de copia en informe/IDs.
- **Validaciones.** typecheck/lint/build + E2E no-scroll + gate global.
- **Rollback.** Revertir la regla.
- **Prompt.** "Acotar `user-select:none` al chrome y permitir selección en contenido/informe. Confirmar que la regla queda antes de los bloques de dashboard en `globals.css`. No romper no-scroll."

---

## 23. Hallazgo → PR → Gate → Traceability Matrix

Cubre los **52** hallazgos. Estado inicial = **Pending** (sólo PR-ROADMAP-0 in progress). P3 agrupables con etiqueta `cleanup-bundle`.

### Visual (26)

| Hallazgo | Severidad | PR | Fase | Gate | Estado |
| --- | --- | --- | --- | --- | --- |
| VIS-P0-001 | P0 | PR-VIS-10 (+PR-E2E-1, PR-QA-DEVICES-1) | F2/F7 | 3/4/7 | Pending |
| VIS-P0-002 | P0 | PR-VIS-9 | F2 | 3/6→visual G6 | Pending |
| VIS-P1-001 | P1 | PR-VIS-0 (freeze) + PR-VIS-CSS-1 (extracción) | F0/F3 | 0/4 | Pending |
| VIS-P1-002 | P1 | PR-VIS-7 (+coord. PR-DUP-1) | F3/F5 | 4 | Pending |
| VIS-P1-003 | P1 | PR-VIS-1 | F1 | 1 | Pending |
| VIS-P1-004 | P1 | PR-VIS-2 | F1 | 1 | Pending |
| VIS-P1-005 | P1 | PR-VIS-6 | F3 | 4 | Pending |
| VIS-P1-006 | P1 | PR-VIS-5 | F1 | 1 | Pending |
| VIS-P1-007 | P1 | PR-VIS-8 | F2 | 3/5(visual) | Pending |
| VIS-P1-008 | P1 | PR-VIS-4 | F1 | 1 | Pending |
| VIS-P2-001 | P2 | PR-VIS-3 | F1 | 1/4 | Pending |
| VIS-P2-002 | P2 | PR-VIS-3 | F1 | 1/4 | Pending |
| VIS-P2-003 | P2 | PR-VIS-6 | F3 | 4 | Pending |
| VIS-P2-004 | P2 | PR-VIS-NAV-1 | F3 | 4 | Pending |
| VIS-P2-005 | P2 | PR-VIS-9 | F2 | 3 | Pending |
| VIS-P2-006 | P2 | PR-VIS-TYPO-1 | F3 | 4 | Pending |
| VIS-P2-007 | P2 | PR-VIS-11 | F3 | 7(visual) | Pending |
| VIS-P2-008 | P2 | PR-VIS-STATE-1 | F3 | 4 | Pending |
| VIS-P2-009 | P2 | PR-VIS-11 (+PR-PERF-PROD-1) | F3/F7 | 7 | Pending |
| VIS-P2-010 | P2 | PR-VIS-9 (+PR-QA-PROD-1) | F2/F7 | 8(visual) | Pending |
| VIS-P3-001 | P3 | PR-VIS-3 | F1 | 1 | Pending |
| VIS-P3-002 | P3 | PR-VIS-3 | F1 | 1 | Pending |
| VIS-P3-003 | P3 | PR-VIS-DS-CATALOG-1 | F3 | 4 | Pending |
| VIS-P3-004 | P3 | PR-VIS-TYPO-1 | F3 | 4 | Pending |
| VIS-P3-005 | P3 | PR-VIS-CLEANUP-1 `cleanup-bundle` | F3 | 4 | Pending |
| VIS-P3-006 | P3 | PR-VIS-CLEANUP-1 `cleanup-bundle` | F3 | 4 | Pending |

### Software (26)

| Hallazgo | Severidad | PR | Fase | Gate | Estado |
| --- | --- | --- | --- | --- | --- |
| ENG-P1-001 | P1 | PR-SEC-2 (f1) + PR-RLS-1 (f2) | F1/F6 | 2/6(sw) | Pending |
| ENG-P1-002 | P1 | PR-COV-1 | F2 | 4(sw) | Pending |
| ENG-P1-003 | P1 | PR-FE-TEST-1 | F2 | 4(sw) | Pending |
| ENG-P1-004 | P1 | PR-E2E-1 (+PR-VIS-10) | F2 | 5(sw) | Pending |
| ENG-P1-005 | P1 | PR-LINT-1 | F2 | 2 | Pending |
| ENG-P1-006 | P1 | PR-OBS-1 | F4 | 3/8(sw) | Pending |
| ENG-P1-007 | P1 | PR-API-1 + PR-BE-SVC-1 (+PR-VIS-7) | F5 | 5 | Pending |
| ENG-P2-001 | P2 | PR-SEC-1 | F1 | 2(sw) | Pending |
| ENG-P2-002 | P2 | PR-ZOD-1 | F5 | 5 | Pending |
| ENG-P2-003 | P2 | PR-API-1 (f1) + PR-SHARED-1 (f2) | F5 | 5 | Pending |
| ENG-P2-004 | P2 | PR-DUP-1 (+coord. PR-VIS-7) | F5 | 5 | Pending |
| ENG-P2-005 | P2 | PR-DX-1 | F1 | 1 | Pending |
| ENG-P2-006 | P2 | PR-OBS-1 | F4 | 3(sw) | Pending |
| ENG-P2-007 | P2 | PR-MUT-1 | F2 | 4(sw) | Pending |
| ENG-P2-008 | P2 | PR-CSP-1 | F4 | 2(sw) | Pending |
| ENG-P2-009 | P2 | PR-INFRA-1 | F6 | 7(sw) | Pending |
| ENG-P2-010 | P2 | PR-RL-DIST-1 | F4 | 5 | Pending |
| ENG-P2-011 | P2 | PR-RLS-1 + PR-OPS-DRILL-1 | F6 | 6/7(sw) | Pending |
| ENG-P2-012 | P2 | PR-DOCS-IDX-0 + continuo (SOURCES_OF_TRUTH) | F0 | 0 | Pending |
| ENG-P3-001 | P3 | PR-ENG-CLEANUP-1 `cleanup-bundle` | F5 | 5 | Pending |
| ENG-P3-002 | P3 | PR-TYPE-1 | F1 | 1 | Pending |
| ENG-P3-003 | P3 | PR-DOCS-GOV-1 | F5 | 5 | Pending |
| ENG-P3-004 | P3 | PR-DOCS-GOV-1 | F5 | 5 | Pending |
| ENG-P3-005 | P3 | PR-ENG-CLEANUP-1 `cleanup-bundle` | F5 | 5 | Pending |
| ENG-P3-006 | P3 | PR-SEC-2 | F1 | 2(sw) | Pending |
| ENG-P3-007 | P3 | PR-CLEAN-1 | F1 | 1 | Pending |

---

## 24. Progress Tracking Board

Estados: Pending · In progress · Merged · Blocked · Requires authorization · Deferred. Todos inician **Pending** salvo este roadmap.

| PR | Estado | Fecha | Resultado | Evidencia |
| --- | --- | --- | --- | --- |
| PR-ROADMAP-0 | In progress | 2026-06-30 | Redactado; pendiente merge manual (Nico) | Este archivo; 7 validaciones |
| PR-VIS-0 | Pending | — | — | — |
| PR-DOCS-IDX-0 | Pending (opc.) | — | — | — |
| PR-SEC-2 | Pending | — | — | — |
| PR-SEC-1 | Requires authorization (⚠ backend) | — | — | — |
| PR-DX-1 | Requires authorization (⚠ package) | — | — | — |
| PR-CLEAN-1 | Requires authorization (⚠ backend) | — | — | — |
| PR-TYPE-1 | Requires authorization (⚠ backend) | — | — | — |
| PR-VIS-1 | Pending | — | — | — |
| PR-VIS-2 | Pending | — | — | — |
| PR-VIS-4 | Pending | — | — | — |
| PR-VIS-3 | Pending | — | — | — |
| PR-VIS-5 | Pending | — | — | — |
| PR-LINT-1 | Requires authorization (⚠ deps+CI) | — | — | — |
| PR-COV-1 | Requires authorization (⚠ deps+CI) | — | — | — |
| PR-FE-TEST-1 | Requires authorization (⚠ deps) | — | — | — |
| PR-VIS-8 | Requires authorization (⚠ dep) | — | — | — |
| PR-E2E-1 | Requires authorization (⚠ CI) | — | — | — |
| PR-VIS-9 | Requires authorization (⚠ CI) | — | — | — |
| PR-VIS-10 | Requires authorization (⚠ CI) | — | — | — |
| PR-MUT-1 | Requires authorization (⚠ dep) | — | — | — |
| PR-VIS-6 | Pending | — | — | — |
| PR-VIS-7 | Pending | — | — | — |
| PR-VIS-CSS-1 | Deferred (post-baseline PR-VIS-9) | — | — | — |
| PR-VIS-11 | Requires authorization (⚠ tooling) | — | — | — |
| PR-VIS-NAV-1 | Pending | — | — | — |
| PR-VIS-TYPO-1 | Pending | — | — | — |
| PR-VIS-STATE-1 | Pending | — | — | — |
| PR-VIS-DS-CATALOG-1 | Requires authorization (⚠⚠ tooling) | — | — | — |
| PR-VIS-CLEANUP-1 | Pending | — | — | — |
| PR-OBS-1 | Requires authorization (⚠ backend/dep) | — | — | — |
| PR-CSP-1 | Pending (tras revisar reportes) | — | — | — |
| PR-RL-DIST-1 | Requires authorization (⚠ backend) | — | — | — |
| PR-API-1 | Pending | — | — | — |
| PR-BE-SVC-1 | Requires authorization (⚠ backend) | — | — | — |
| PR-ZOD-1 | Requires authorization (⚠ deps) | — | — | — |
| PR-SHARED-1 | Requires authorization (⚠ deps/arq) | — | — | — |
| PR-DUP-1 | Pending | — | — | — |
| PR-ENG-CLEANUP-1 | Pending | — | — | — |
| PR-DOCS-GOV-1 | Pending | — | — | — |
| PR-INFRA-1 | Requires authorization (⚠ infra) | — | — | — |
| PR-RLS-1 | Requires authorization (⚠⚠ DB) | — | — | — |
| PR-OPS-DRILL-1 | Blocked (acceso externo/productivo) | — | — | — |
| PR-QA-PROD-1 | Blocked (acceso productivo) | — | — | — |
| PR-QA-DEVICES-1 | Blocked (devices/externo) | — | — | — |
| PR-PERF-PROD-1 | Blocked (acceso productivo) | — | — | — |
| PR-INCIDENT-1 | Blocked (productivo) | — | — | — |
| PR-CERT-1 | Pending (sign-off final) | — | — | — |

---

## 25. Definition of Done for 100%

Checklist final (cierra Gate 8). Combina DoD visual (§17 visual) + DoD software (§20 software).

- [ ] Todos los **P0 cerrados** (VIS-P0-001/002 vía PR-VIS-9/10 + E2E prod + devices).
- [ ] Todos los **P1 cerrados** (8 VIS + 7 ENG, cada uno con PR específico, test, rollback, owner).
- [ ] Todos los **P2 cerrados** o aceptados con justificación (10 VIS + 12 ENG).
- [ ] **P3 cerrados** o registrados en maintenance (6 VIS + 7 ENG, cleanup-bundles).
- [ ] **Gates 0–8 aprobados.**
- [ ] **Cross-browser activo** (WebKit/Firefox CI + iOS/Android real).
- [ ] **Visual regression activa** (baselines + threshold + política de actualización).
- [ ] **Coverage medido** (backend c8 + unit FE).
- [ ] **Lint backend activo** (en CI).
- [ ] **A11y checks activos** (axe-core; contraste ≥4.5:1 por estado; touch ≥44px mobile; `user-select` acotado).
- [ ] **RLS/tenant isolation verificado** (ADR+guard + RLS no-priv + tests DB + rollback).
- [ ] **Observability mínima** (logs JSON con `requestId`, niveles, healthcheck; métricas/alertas definidas).
- [ ] **Backup/rollback drills** ejecutados (RTO/RPO; migración rollback/down).
- [ ] **Production QA real** (dashboards autenticados, estados extremos, CWV/p95-p99).
- [ ] **Docs actualizados** (design-system-contract, ADRs, SOURCES_OF_TRUTH; trazabilidad cerrada en §23/§24).
- [ ] **No PRs abiertos.**
- [ ] **`main` limpio** (sin `next-env.d.ts` modificado; baseline verde).

---

## 26. Final Recommendation

**Primer PR después del roadmap.** **PR-VIS-0** (DS contract freeze, docs) — o, si se prioriza seguridad, **PR-SEC-2** (ADR + guard anti-IDOR, docs+test). Ambos son docs/test-only, sin autorización extra, máximo valor.

**Primeros 5 PRs (orden de retorno).** PR-ROADMAP-0 → PR-VIS-0 → PR-SEC-2 → PR-SEC-1 → PR-DX-1 (cerrando en paralelo el lote 0 visual PR-VIS-1/2/4/3/5).

**Primeras autorizaciones necesarias.** (1) ⚠ backend para PR-SEC-1/CLEAN-1/TYPE-1; (2) ⚠ package para PR-DX-1; (3) ⚠ deps+CI para arrancar F2 (PR-LINT-1/COV-1). Las fuertes (⚠⚠ DB/productivo) recién en F6/F7.

**Qué evitar.** Mega-PRs; rediseñar; tocar RLS sin ADR/guard+observabilidad+cobertura+rol no-priv+rollback; mover `globals.css` sin baseline de regresión; tocar color sin axe; activar coverage+lint+e2e+mutation juntos; mezclar visual con software; dejar `next-env.d.ts` modificado; declarar "listo" lo que las auditorías dejan pendiente o requiere acceso externo.

**Resultado tras 10 PRs.** Lote 0 completo: drift de marca reducido (badge tokenizado, dark dual eliminado, tokens definidos, `user-select` acotado, primitivas creadas), ADR+guard anti-IDOR, 4xx sanitizado, higiene backend (logger tipado, handler muerto eliminado, `validate:local` reforzado). **Gate 1 cerrado.** Sin deuda nueva; baseline verde.

**Resultado tras 20 PRs.** F2 + arranque de F3: medición completa (cobertura, lint, unit FE, axe), red de regresión visual + cross-browser activa, mutation piloto, FilterBar/primitivas unificadas, extracción de duplicación iniciada. **Gates 2/3 cerrados, Gate 4 en progreso.** El producto ya se itera visualmente "con red".

**Resultado al 100% (48 PRs).** Defensa en profundidad de datos (RLS), observabilidad estructurada, IaC, contratos FE↔BE, design system tokenizado/unificado/documentado, QA visual productivo con devices reales, CWV/p95-p99 medidos, incident/rollback drills, **certificación de excelencia visual extrema + ingeniería extrema/multinacional** (PR-CERT-1). **Gates 0–8 aprobados; `main` limpio; 0 PRs abiertos.**

---

*Fin del roadmap. Documento de orquestación, docs-only; no implementa cambios, no toca frontend/backend/DB/migraciones/tests/deps/lockfiles/workflows ni modifica las dos auditorías fuente. Sin commit/push/PR. Orquesta el 100% de `total-visual-engineering-audit.md` (26) y `total-software-engineering-audit.md` (26).*
