# Repository Operational Ordering — Audit

> Documento de auditoría **docs-only**. **No modifica** código productivo, `frontend/src`,
> `server`, specs, helpers, fixtures, `test`, `.github/workflows`, `package.json`,
> `frontend/package.json`, `pnpm-lock.yaml`, Playwright config, `scripts`, `drizzle`/migrations,
> dependencias, screenshots ni archivos generados. Solo describe el **orden** actual del repositorio
> y propone los cambios mínimos de ordenamiento (docs/move/rename/scripts) que harán las próximas
> auditorías de Claude más rápidas, baratas, seguras y menos ambiguas. **No** es una auditoría de
> producto, arquitectura, seguridad profunda ni tecnología.

## 1. Executive Summary

**Estado actual del ordenamiento.** El repositorio está **funcionalmente sano pero
documentalmente sobrecargado**. El historial reciente muestra disciplina alta (PRs chicos de un
solo eje, closeouts, auditorías docs-only previas), pero la **documentación creció más rápido que
su índice**: hay **174 archivos bajo `docs/`** + **34 en `IMPLEMENTATION_NOTES/`**, repartidos en
~12 subcarpetas con **cinco convenciones de nombre de "PR doc" coexistiendo** y **sin ningún índice,
mapa de fuente-de-verdad ni README** en `docs/`. Claude, al iniciar cualquier tarea, no tiene un
punto de entrada: debe redescubrir qué doc es actual, cuál es histórico y cuál fue reemplazado, lo
que es la mayor fuga de tokens del repo.

**Bloqueadores principales a la eficiencia de Claude (orden de impacto):**

1. **`docs/audit/` (singular, actual) vs `docs/audits/` (plural, histórico)** — dos carpetas casi
   homónimas, **intencionalmente separadas** (confirmado en
   `IMPLEMENTATION_NOTES/chore-docs-organize-audit-implementation-notes.md`) pero **sin nota que lo
   declare en el árbol**. Cualquier agente nuevo las confunde y lee la equivocada.
2. **Sin índice ni mapa de fuente-de-verdad.** No existe `docs/README.md` ni
   `docs/audit/README.md`. Para saber "cuál es el doc vigente de X" hay que abrir varios.
3. **Sprawl en la raíz de `docs/`** — ~40 archivos sueltos (`pr-1`…`pr-10`, `pr0`…`pr5b`,
   `pr-815`…`pr-826`, `fix-*`, `audit-premium-*`, `production-readiness-*`) sin agrupar.
4. **Tres hogares de "implementation docs"** (`docs/implementation`, `docs/implementation-history`,
   `IMPLEMENTATION_NOTES`) — **sancionado por `AGENTS.md`**, pero sin nota que explique cuándo usar
   cada uno.
5. **Solape de fuentes de protocolo de IA**: `AGENTS.md`, `docs/protocol/vetneb-ai-working-protocol.md`,
   `.cursor/rules/*` (6 reglas) y las skills VETNEB describen el mismo protocolo en 4 lugares.

**Lo que ya está bien ordenado (no tocar):** `server/` (backend Fastify, 101 archivos, sub-foldered
`lib/routes/middlewares`), `scripts/` (21 archivos sub-foldered por dominio), `.github/workflows`
(solo 2 workflows claros), `frontend/e2e/helpers` y `frontend/e2e/fixtures` (mínimos: 1 + 1), y la
**raíz del repo** (limpia tras el doc-org previo: solo `README.md`, `SETUP.md`, `AGENTS.md` +
configs). La auditoría **E2E CI Layering** (#1095) es ejemplar y **ya tiene su scripts-only
ejecutado** (#1096).

**Qué ordenar primero:** un **índice de docs/audit + mapa de fuente-de-verdad** (docs-only, cero
riesgo) y una **nota disambiguadora `docs/audit` vs `docs/audits`**. Esto solo, sin mover nada,
elimina la mayor parte de la fuga de tokens.

**Qué NO tocar todavía:** ningún `frontend/src`, `server`, `test`, spec, helper, fixture, CI,
`package.json`, lockfile, Playwright config, `drizzle`/migrations ni `scripts`. **No** mover ni
renombrar archivos hasta que el índice exista y congele el mapa actual. **No** abrir PR-C3 (CI-only
de capas E2E): está fuera de este eje y requiere validación previa `unión == full`.

**Dictamen anticipado para §12:** el **PR-C2 scripts-only ya está hecho** (#1096 añadió
`e2e:smoke/admin-mobile/visual-contract/public-clinic/full`). Por tanto el próximo paso de
ordenamiento **no** es PR-C2; es **PR-O1 docs-only: índice de auditorías + mapa de fuente-de-verdad**.

---

## 2. Audited Base

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| HEAD (`git log -1 --oneline`) | `8e29cc2 test(e2e): add layered e2e scripts (#1096)` |
| HEAD esperado por la misión | `acdea9b … (#1095)` → **desfasado +2 commits** (`acdea9b` #1095 docs, luego `8e29cc2` #1096 scripts) |
| `origin/main` / `origin/HEAD` | `8e29cc2` (idéntico al HEAD local) |
| `git status --short --untracked-files=all` | **limpio** antes de crear este archivo |
| Fecha | 2026-06-23 |
| Plataforma | Windows / PowerShell / PNPM |
| Worktree | único (`C:/PORTAL-VETNEB`); sin worktrees adicionales |
| Branches locales | `main` + 1 rama vieja sin borrar: `test/admin-mobile-final-polish-shared-primitives` |
| Open PRs | **19, todas Dependabot** (#1018–#1038). **Ninguna** PR funcional abierta |

**Desfase de HEAD — implicación.** La misión esperaba `acdea9b` (#1095, la auditoría E2E layering
docs-only). El repo ya avanzó a `8e29cc2` (#1096), que es exactamente el **PR-C2 scripts-only**
descrito como "próximo paso" en esa auditoría. Esto **cambia el dictamen final**: el scripts-only de
capas E2E ya no es pendiente.

**Comandos read-only ejecutados (evidencia):**

```
git branch --show-current
git status --short --untracked-files=all
git log -1 --oneline
git log --oneline --decorate -n 30
git branch
git worktree list
gh pr list --state open
git ls-files docs IMPLEMENTATION_NOTES AGENTS.md .cursor .cursorignore README.md
git ls-files frontend/e2e test .github/workflows frontend/playwright.config.*
git ls-files frontend/src server backend scripts supabase legacy shared drizzle  (conteos)
git ls-files | group by top-level dir
git show --stat 8e29cc2            # diff de #1096 (scripts-only)
Grep "e2e" frontend/package.json   # confirmación de capas E2E
Grep status-markers en docs/       # freshness
```

**Read budget realmente usado (dentro de presupuesto):**

| Tipo | Presupuesto | Usado | Archivos |
| --- | --- | --- | --- |
| Docs completos | 6 | **3** | `docs/audit/e2e-ci-layering-strategy-audit.md`; `IMPLEMENTATION_NOTES/chore-docs-organize-audit-implementation-notes.md`; `AGENTS.md` |
| Config/workflow completos | 4 | **0** | (`frontend/package.json` solo por snippet/Grep) |
| Test/spec completos | 2 | **0** | — |
| Producción completos | 0 | **0** | — |
| Snippets de búsqueda | libre/targeted | ~8 | git ls-files, git show --stat, 2 Grep |

**Confirmación de scope.** Solo se crea `docs/audit/repository-operational-ordering-audit.md`.
No se modificó, movió, renombró ni borró ningún otro archivo. No se ejecutó `git add/commit/push`,
ni `gh pr`. No se instalaron dependencias. No se tocó `frontend/next-env.d.ts` (no se levantó
`next dev`).

---

## 3. Repository Structure Inventory

> Nota de mapeo: la misión nombra áreas prohibidas `backend` y `supabase` que **no existen como
> carpetas**. El backend real es `server/` (Fastify) y las migraciones viven en `drizzle/`. Se
> auditan bajo sus nombres reales.

| Área / path | Propósito inferido | Orden actual | Issue | Recomendación | Prio |
| --- | --- | --- | --- | --- | --- |
| `docs/audit/` (~31) | Auditorías **actuales** (kebab-case, en curso) | Medio | Sin README/índice; mezcla auditorías abiertas, closeouts y un informe backend mayúsculo (`INFORME_FINAL_BACKEND.md`, `IMPLEMENTACION_AUDITORIA.md`) que rompen el patrón | Añadir `docs/audit/README.md` índice con estado por archivo (docs-only) | **P0** |
| `docs/audits/` (~10) | Auditorías/planes **históricos** mayúsculos (`AUDIT_*`, `DASHBOARD_*_PLAN`) | Malo (ambiguo) | Nombre casi idéntico a `docs/audit/`; intencional pero **no declarado en el árbol** | Nota disambiguadora + marcar como histórico en el mapa SoT (docs-only). **No** mover/renombrar aún | **P0** |
| `docs/implementation/` (~30) | Notas de entrega de implementaciones (kebab-case) | Medio | Solapa conceptualmente con los otros dos hogares; sin índice | Indexar; **no** consolidar (sancionado por `AGENTS.md`) | P1 |
| `docs/implementation-history/` (PR-3…PR-15) | Historia de implementación pública/dashboard (Spanish `IMPLEMENTACION-PR-*`) | Bien (nombre dice "history") | Convención distinta a las otras carpetas; aceptable por ser histórica | Marcar "historical, avoid reading" en mapa SoT | P2 |
| `IMPLEMENTATION_NOTES/` (34, raíz) | Notas de entrega (mezcla `IMPLEMENTATION_*` mayúsc. movidas + kebab-case) | Medio | Tercer hogar de implementation docs; dos convenciones internas | Indexar; dejar como está (movido a propósito en doc-org PR) | P1 |
| `frontend/e2e` (42 specs) | Suite Playwright | Bien | Nombres por familia (`admin-mobile-*`, `dashboard-*`, `public-*`) claros; ya mapeados a capas en #1095/#1096 | **No mover** hasta que capas/CI estén estables (PR-C3) | P3 |
| `frontend/e2e/helpers` (1) | Helper compartido admin-mobile | Bien | Solo `admin-mobile-contracts.ts` (268 líneas) | No tocar | — |
| `frontend/e2e/fixtures` (1) | Mock API server global | Bien | Solo `admin-populated-api-server.mjs` (521 líneas); infra global | No tocar (blast radius total) | — |
| `test/` (404 archivos planos) | Suite backend/frontend/contract (node `--test`) | Aceptable-Malo | **Directorio plano de ~350 `.test.ts`**; difícil de escanear; subset `*.fastify.test.ts`, `*-invariants.test.ts`, `security-*` agrupables por nombre | **Solo diagnóstico**: posible carpeteo futuro **move-only**, pero `test` está prohibido en este eje → `requires later test-only audit` | P3 |
| `frontend/src` (158) | App Next.js | Fuera de scope | — | No evaluar (no es eje de ordenamiento) | — |
| `server/` (101; `lib` 41, `routes` 34, `middlewares` 7) | Backend Fastify (el "backend" de la misión) | Bien | Sub-foldered y claro | No tocar | — |
| `drizzle/` (38) | Migraciones/schema (el "supabase/migrations" de la misión) | Bien | — | No tocar | — |
| `legacy/` (3) | `drizzle-old/` SQL viejo + README | Aceptable | Marcado "legacy" en el path; bajo riesgo si nadie lo lee | Marcar "historical, do not read" en mapa SoT | P2 |
| `shared/` (3) | `errors.ts`, `const.ts`, `types.ts` compartidos | Bien | — | No tocar | — |
| `.github/workflows` (2) | `backend-ci.yml`, `frontend-ci.yml` | Bien | Claros; ya documentados en `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | No tocar en este eje | — |
| `.cursor/` (6 reglas `.mdc` + `.cursorignore`) | Reglas de IA para Cursor | Medio | Solapa con `AGENTS.md` y skills VETNEB | Apuntar a `AGENTS.md` como SoT en el mapa; no duplicar | P1 |
| `AGENTS.md` (raíz) | **Protocolo operativo de agentes (SoT)** | Bien | Es la fuente de verdad real del protocolo; podría enlazar al índice de docs | Designar SoT del protocolo en el mapa; añadir 1 línea al índice | P0 |
| Raíz del repo | `README.md`, `SETUP.md`, `AGENTS.md`, configs | Bien | Limpia tras `chore(docs): organize…` | No tocar | — |
| `docs/` (raíz, ~40 sueltos) | `pr-*`, `fix-*`, `audit-premium-*`, `production-readiness-*`, `release-readiness`, `review-governance`, `smoke-*`, `legal-*`, `entrega-*` | Malo | Sprawl sin agrupar; **5 convenciones PR-doc** coexisten | Indexar y clasificar (docs-only); agrupar move-only **solo después** del índice | P1 |

**Cinco convenciones de "PR doc" detectadas** (síntoma de naming inconsistente, no corregir por
move aún): `docs/pr-1`…`pr-10` · `docs/pr0`/`pr1`/`pr3b`/`pr5b` · `docs/pr-815`…`pr-826` ·
`docs/pr-history/PR-fix-*` · `docs/implementation-history/IMPLEMENTACION-PR-*`.

---

## 4. Documentation Freshness and Source-of-Truth Inventory

> Conciso y agrupado. "SoT" = fuente de verdad. "Leer en futuras auditorías" = vale abrir completo.

| Path / grupo | Tema | Estado | SoT | Leer en futuras auditorías | Recomendación |
| --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | Protocolo de trabajo del agente | **current** | **sí** | sí | SoT del protocolo. Único punto canónico |
| `docs/protocol/vetneb-ai-working-protocol.md` | Protocolo IA (prosa larga) | current/duplicado | no | solo si `AGENTS.md` ambiguo | Marcar "secundario de AGENTS.md" |
| `.cursor/rules/*.mdc` (6) | Reglas IA por dominio (Cursor) | current | no | no (resumen de AGENTS.md) | Mantener; no es SoT |
| `docs/audit/e2e-ci-layering-strategy-audit.md` | Estrategia capas E2E/CI | **current/closeout-parcial** | **sí** (E2E/CI) | sí | SoT de la estrategia de capas; PR-C1✔ PR-C2✔ |
| `docs/audit/admin-mobile-e2e-helper-optimization-closeout.md` | Cierre helper E2E admin-mobile | **closeout** | sí (cerrado) | no (ya cerrado) | No reabrir |
| `docs/audit/admin-mobile-*` (densidad, no-scroll, hub-stage, etc., ~18) | Admin Mobile densa/no-scroll | mayoría **closeout/current** | parcial | no (cerrados) | Indexar como bloque cerrado |
| `docs/audit/dashboard-horizontal-navigation-information-architecture.md` + `docs/implementation/dashboard-horizontal-shell-navigation.md` | Rediseño dashboard a nav horizontal | **current (en curso)** | **sí** (dashboard IA) | sí | SoT del rediseño activo (plan 11 PRs, 2026-06-18) |
| `docs/audit/2026-06-22-auditoria-algoritmica-dashboard.md` + `docs/audit/.../algorithmic audit roadmap` (#1075) | Auditoría algorítmica dashboard | **current/roadmap** | sí (roadmap) | sí | SoT del roadmap algorítmico |
| `docs/audits/DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md`, `DASHBOARD_NO_SCROLL_PREMIUM_REDESIGN_PLAN.md`, `DASHBOARD_SINGLE_VIEWPORT_APP_SHELL_PLAN.md` | Planes dashboard premium/single-viewport | **historical / likely superseded** por nav horizontal | no | **no** | Marcar "superseded by horizontal-nav" (requiere confirmación 1 línea) |
| `docs/audits/AUDIT_*` (production readiness, role communication, white-box) | Auditorías globales históricas | **historical** | no | no salvo necesidad | Marcar histórico en mapa |
| `docs/implementation-history/IMPLEMENTACION-PR-3…15` | Historia implementación pública/dashboard | **historical** | no | no | "avoid reading unless needed" |
| `docs/pr-history/PR-*` (~30) | Historia de PRs antiguos | **historical** | no | no | Histórico; no leer por defecto |
| `docs/pr-1…pr-10`, `pr0…pr5b`, `pr-815…pr-826` (raíz docs) | Notas PR antiguas dashboard/API | **historical** | no | no | Histórico; candidatos a agrupar (move-only futuro) |
| `docs/security/*` (RBAC_MATRIX, ENDPOINT_PERMISSION_MATRIX, ENDPOINT_TEST_MATRIX, csp-*) | Matrices de seguridad | **current** | **sí** (seguridad) | sí (solo el matrix relevante) | SoT de fronteras de seguridad |
| `docs/ops/*` (CI_PR_CHECKS_RUNBOOK, BACKUP_RESTORE_ROLLBACK, METRICS_BASELINE, production-readiness-audit) | Runbooks operativos | **current** | **sí** (release/ops) | sí | SoT de ops/release |
| `docs/PRODUCTION_PROGRESS_INVARIANTS.md` + `test/progress-production-invariants.test.ts` | Invariantes de progreso productivo | **current** (lockeado por test) | **sí** | sí | SoT de invariantes; cambios requieren test |
| `docs/logistics/*`, `docs/product/vetneb-platform-blueprint.md` | Blueprint/roadmap producto | current/reference | parcial | no salvo necesidad | Reference; fuera de eje ordenamiento |
| `docs/changelog/*` (CAMBIOS, CHANGELOG, CAMBIOS_EFICIENCIA) | Changelog | current/append | no | no | Append-only; no SoT |
| `docs/notes/*` (todo.md, NOTAS_TECNICAS, PENDIENTE_NORMALIZACION_CLINICS) | Notas sueltas/pendientes | **ambiguous** | no | no | Revisar si `PENDIENTE_*` sigue vigente (later audit) |

---

## 5. Closed, Open, and Ambiguous Work Blocks

| Bloque | PRs/docs relacionados | Estado | Closeout | Próxima acción | Riesgo si se re-audita de cero |
| --- | --- | --- | --- | --- | --- |
| **Admin Mobile E2E Helper Optimization** | #1089→#1094; `admin-mobile-e2e-helper-optimization-closeout.md`, `admin-mobile-whitebox-e2e-optimization-audit.md`, `admin-mobile-final-polish-e2e-overlap-audit.md` | **CERRADO** | **sí** | Ninguna | **Alto** — re-auditar repetiría trabajo ya cerrado y consumido en tokens |
| **E2E CI Layering Strategy** | #1095 (docs `e2e-ci-layering-strategy-audit.md`) + #1096 (scripts `e2e:*`) | **PR-C1 ✔ docs, PR-C2 ✔ scripts**; PR-C3 (CI) **pendiente, fuera de scope** | parcial (auditoría hace de plan vivo) | Validar `unión de capas == e2e:full` (test/local) → recién luego PR-C3 CI-only | **Alto** — el plan ya está escrito; rehacerlo es puro desperdicio |
| **Admin Mobile / Enterprise Density** | #1076→#1088, #1082→#1088; `admin-mobile-density-closeout.md`, `admin-enterprise-density-completion-audit.md`, `docs/implementation/admin-*-enterprise-density.md` | **CERRADO** | **sí** | Ninguna | **Alto** — bloque maduro con closeout y tests de densidad |
| **Admin Mobile No-scroll / Hub stage / Layer isolation** | #1067→#1074; `admin-mobile-final-polish-no-scroll-closeout.md`, `admin-mobile-hub-stale-layer-stage.md`; memoria `admin_mobile_hub_stage` | **CERRADO** | **sí** | Ninguna | **Alto** |
| **Dashboard horizontal-nav redesign** | `docs/audit/dashboard-horizontal-navigation-information-architecture.md`, `docs/implementation/dashboard-horizontal-shell-navigation.md`; memoria `dashboard_horizontal_nav_redesign` (plan 11 PRs, 2026-06-18) | **ABIERTO / en curso** | no | Continuar plan por su propio eje (no es eje de ordenamiento) | Medio — **debe** quedar marcado como SoT activo o se re-audita |
| **Algorithmic dashboard audit** | `2026-06-22-auditoria-algoritmica-dashboard.md`; #1075 algorithmic roadmap | **ABIERTO / roadmap** | no | Seguir roadmap; no mezclar con ordenamiento | Medio |
| **Dashboard Premium / Single-viewport / No-scroll (legacy plans)** | `docs/audits/DASHBOARD_*_PLAN.md`; `IMPLEMENTATION_NOTES/feat-dashboard-*` | **probable SUPERSEDED** por horizontal-nav | no | Marcar "superseded" en mapa (1 línea, requiere confirmación de Nico) | Medio — leerlos como vigentes induce decisiones obsoletas |
| **Security / sessions** | `docs/security/*` (RBAC/ENDPOINT/CSP matrices); ~40 `test/security-*`, `test/auth-*`, `test/*-session-last-access-contract` | **ESTABLE / mantenido** (no hay bloque abierto) | n/a | Solo `requires later domain-specific audit` si surge necesidad | Bajo — bien cubierto por tests/matrices |
| **Dependabot** | 19 PRs abiertas #1018–#1038 (Radix, lucide, supabase-js, tailwind, react-hook-form, **eslint 9→10**, **@playwright/test 1.60→1.61**) | **ABIERTO / sin tocar** | no | Eje propio; **no** mezclar con ordenamiento ni con capas E2E | Bajo para ordenamiento, pero acumulación = ruido en `gh pr list` |
| **Perspective scroll PR-24/PR-26** | memoria `pr24_perspective_audit`; `public-perspective-scroll.spec.ts` | **AUDITADO, correctivo propuesto** | no | Decisión de Nico (fuera de eje) | Bajo |
| **Rama local huérfana** | `test/admin-mobile-final-polish-shared-primitives` | **residuo** | n/a | Nico borra local cuando quiera (no es acción de IA) | Trivial |

---

## 6. E2E and Testing Organization Diagnosis

**Naming clarity — bien.** Los 42 specs usan prefijos de familia consistentes: `admin-mobile-*`
(13), `dashboard-*` (incl. `-no-scroll-contract`, `-mobile-parity`), `public-*`, más smokes
sueltos (`visual-smoke`, `theme-mode`, `login-hydration`, `contacto-hydration`). La auditoría
#1095 ya **mapeó cada spec a una capa** y verificó que la unión == 42 specs (7+13+11+11). Esto es
ordenamiento de testing **ya resuelto a nivel de nombres**.

**Helper organization — mínima y sana.** Un solo helper (`helpers/admin-mobile-contracts.ts`).
No hay sprawl de helpers. **No** crear estructura nueva.

**Fixture organization — mínima y crítica.** Un solo fixture (`fixtures/admin-populated-api-server.mjs`),
levantado por `webServer` en **toda** corrida. Blast radius total: **prohibido tocar** en cualquier
PR de ordenamiento.

**Specs grandes/ambiguos.** Sin specs "legacy/unclear": todos atribuibles a una familia. Los más
pesados (`dashboard-card-navigation-shell` = 75 tests, `public-clinics-b2b-operations` = 32,
`public-report-preview` = 31) están identificados y mapeados a capa. No requieren reordenamiento de
archivos; su costo se gestiona vía las capas E2E ya creadas.

**`test/` (raíz, ~350 planos) — única deuda de organización real de testing.** Directorio plano
enorme. Subconjuntos claros por nombre (`*.fastify.test.ts`, `*-invariants.test.ts`, `security-*`,
`logistics-*`, `admin-*`, `frontend-*`). Un carpeteo move-only mejoraría el escaneo, **pero `test`
está fuera del eje permitido** y mover ~350 archivos rompería rutas leídas por contratos
(p. ej. `package-scripts-contract.test.ts`, `production-readiness.test.ts` leen paths). → Clasificar
como **`requires later test-only audit` (move-only, alto riesgo, baja prioridad)**.

**Relación con PR-C2 scripts-only.** **Ya ejecutado** (#1096): `frontend/package.json` contiene
`e2e:smoke`, `e2e:admin-mobile`, `e2e:visual-contract`, `e2e:public-clinic`, `e2e:full`. El único
pendiente de ese hilo es **validar que la unión de capas reproduce `e2e:full`** y, recién entonces,
PR-C3 CI-only. Ninguno de esos dos es eje de ordenamiento de repo.

**¿Mover carpetas E2E ahora o después?** **Después, y probablemente nunca por ahora.** Mover specs
invalidaría los scripts de capa por-ruta recién creados (#1096 selecciona por `e2e/<archivo>.spec.ts`)
y la matriz spec→capa de #1095. **Regla: no mover specs hasta que capas + CI estén estables.**

**Recomendación exacta (organización de testing):** **no** hacer nada estructural en `frontend/e2e`
ni `test/` en este eje. Solo **documentar** en el índice: (a) que las capas E2E ya existen como
scripts, (b) que el siguiente paso es validación `unión==full` (no PR de ordenamiento), (c) que el
carpeteo de `test/` queda como later test-only audit.

---

## 7. Documentation and AI-Tooling Diagnosis

**¿Demasiadas fuentes dispersas para Claude? Sí.** Al arrancar, Claude enfrenta: `AGENTS.md` +
`docs/protocol/vetneb-ai-working-protocol.md` + `.cursor/rules/*` (6) + 6 skills VETNEB + 174 docs
sin índice. El **contenido de protocolo** es consistente entre las cuatro fuentes (verificado: las
skills y `AGENTS.md` repiten el mismo protocolo), así que el problema **no** es contradicción sino
**ausencia de un punto de entrada que diga "empieza aquí y lee solo esto"**.

**Solape concreto:**

| Fuente | Rol real | Veredicto |
| --- | --- | --- |
| `AGENTS.md` | Protocolo operativo canónico (entorno, git boundaries, seguridad, entrega, calidad ISO) | **SoT — conservar como único canónico** |
| `docs/protocol/vetneb-ai-working-protocol.md` | Misma materia en prosa larga | Secundario; enlazar desde el índice, no duplicar |
| `.cursor/rules/*.mdc` (6) | Reglas IDE-specific (Cursor) | Derivado; útil para Cursor, no SoT |
| Skills VETNEB (6) | Protocolo + know-how por dominio en runtime | Operacional; repiten protocolo de `AGENTS.md` |
| `docs/audit/**` | Estado de auditorías | Necesita índice para ser navegable |
| `IMPLEMENTATION_NOTES/**` + `docs/implementation*` | Entregas | Tres hogares sancionados; necesitan índice |

**¿Hace falta un README/índice operativo pequeño? Sí — es la recomendación central.** No un doc
nuevo grande, sino **dos artefactos docs-only chicos**:

1. **`docs/audit/README.md`** — índice de auditorías: por archivo, una línea con estado
   (`current` / `closeout` / `historical` / `superseded`) y si debe leerse completo. Evita que
   Claude abra 31 archivos para saber cuál importa.
2. **`docs/SOURCES_OF_TRUTH.md`** (o `docs/README.md`) — mapa por dominio: "para X, lee Y; evita Z".
   Convierte la §8 de esta auditoría en un artefacto vivo y corto.

**Cómo evitar leer docs obsoletos:** el mapa SoT marca explícitamente `historical` / `avoid reading`
para `docs/audits/AUDIT_*`, `docs/pr-history/*`, `docs/implementation-history/*`, `docs/pr-*` raíz y
`legacy/`. Una sola lectura del mapa (≈1 doc) reemplaza decenas de aperturas exploratorias.

**Documento que debe volverse el "mapa operativo":** **`AGENTS.md` para el protocolo** +
**`docs/SOURCES_OF_TRUTH.md` para la geografía de docs**. `AGENTS.md` gana una línea: "Índice de
documentación: ver `docs/SOURCES_OF_TRUTH.md`".

---

## 8. Recommended Sources of Truth by Domain

| Dominio | Fuente de verdad primaria | Secundaria | Histórico (no leer salvo necesidad) | Nota |
| --- | --- | --- | --- | --- |
| Protocolo de trabajo | `AGENTS.md` | `docs/protocol/vetneb-ai-working-protocol.md`, skills VETNEB | — | `.cursor/rules/*` derivado |
| Admin Mobile | `admin-mobile-density-closeout.md` + `admin-mobile-final-polish-no-scroll-closeout.md` | helper `e2e/helpers/admin-mobile-contracts.ts`; memoria `admin_mobile_*` | resto de `admin-mobile-*` audits (cerrados) | Bloque **cerrado**; no reabrir |
| Dashboard Admin | `docs/audit/dashboard-horizontal-navigation-information-architecture.md` | `docs/implementation/dashboard-horizontal-shell-navigation.md`; `2026-06-22-auditoria-algoritmica-dashboard.md` | `docs/audits/DASHBOARD_*_PLAN.md`, `docs/pr-2/pr-7` | Rediseño **activo** |
| Dashboard Clínica | `docs/implementation/clinic-enterprise-density-closeout.md` | `dashboard-clinic-*-mobile-parity.spec.ts` | `docs/pr-4-dashboard-clinic-command-center.md` | Paridad mobile estable |
| E2E / CI | `docs/audit/e2e-ci-layering-strategy-audit.md` | `frontend/package.json` (`e2e:*`), `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | — | PR-C1✔C2✔; falta validación unión==full → PR-C3 |
| Security / sessions | `docs/security/RBAC_MATRIX.md` + `ENDPOINT_PERMISSION_MATRIX.md` | `AGENTS.md` (invariantes), tests `security-*`/`auth-*` | — | Estable; cambios requieren test |
| Public / tokens / reports | `docs/implementation/clinic-public-profile-safe-surface.md`, `docs/security/ENDPOINT_TEST_MATRIX.md` | `docs/pr-history/PR-feat-report-workflow-*`, `docs/entrega-particular-email-generated-token.md` | `docs/pr-815…826` (raíz) | Múltiples docs; consolidar referencia vía índice |
| Production / release | `docs/ops/production-readiness-audit.md`, `docs/PRODUCTION_PROGRESS_INVARIANTS.md` | `docs/release-readiness.md`, `docs/staging-smoke-runbook.md`, `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | `docs/production-readiness-snapshot-2026-05-27.md` | Invariantes lockeados por test |
| Visual premium / no-scroll | `docs/implementation/dashboard-internal-no-scroll-contract.md` | specs `dashboard-*-no-scroll-contract`; memoria `dashboard_single_viewport_app_shell` | `docs/audits/DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md` | "Visual contract" = estructural, no pixel |
| Historical implementations | — | — | `docs/implementation-history/*`, `docs/pr-history/*`, `docs/pr-*` raíz, `legacy/` | **Avoid reading** salvo trazabilidad puntual |
| Dependency maintenance | `gh pr list` (Dependabot #1018–#1038) | `.github/` config | — | Eje propio; no mezclar |

---

## 9. Required Repository-Ordering Changes

> Todo lo siguiente es **repository-ordering only**. Prioridad P0 (primero) → P3 (último/diferido).

### P0 — Crear índice de auditorías (`docs/audit/README.md`)

- **Problema:** 31 archivos en `docs/audit/` sin índice; Claude abre varios para ubicarse.
- **Evidencia:** `git ls-files docs/audit` (31); no existe README (Grep confirmó ausencia de índice).
- **PR type:** docs-only.
- **Allowed scope:** crear `docs/audit/README.md` (tabla archivo→estado→leer-sí/no).
- **Non-scope:** no tocar los audits existentes; no mover/renombrar.
- **Probable files:** `docs/audit/README.md`.
- **Validación:** `git status --short`, `git diff --check`; lectura humana.
- **Rollback:** borrar el archivo.
- **Dependency:** ninguna (puede ir primero).

### P0 — Mapa de fuente-de-verdad por dominio (`docs/SOURCES_OF_TRUTH.md`)

- **Problema:** no hay mapa que diga "para X lee Y, evita Z"; §4/§8 viven solo en auditorías.
- **Evidencia:** ausencia de `docs/README.md`/`SOURCES_OF_TRUTH.md` (Grep).
- **PR type:** docs-only.
- **Allowed scope:** crear `docs/SOURCES_OF_TRUTH.md` (materializar §8); 1 línea opcional en
  `AGENTS.md` apuntando al mapa.
- **Non-scope:** no consolidar carpetas; no mover docs.
- **Probable files:** `docs/SOURCES_OF_TRUTH.md` (+ `AGENTS.md` 1 línea — autorización explícita de Nico por ser raíz).
- **Validación:** `git diff --check`; lectura humana.
- **Rollback:** borrar archivo / revertir la línea.
- **Dependency:** idealmente tras el índice P0 anterior.

### P0 — Nota disambiguadora `docs/audit` vs `docs/audits`

- **Problema:** carpetas casi homónimas, separación intencional pero no declarada.
- **Evidencia:** `chore-docs-organize-audit-implementation-notes.md` líneas 39–41 ("plural requested
  explicitly; singular `docs/audit/` unrelated and left untouched").
- **PR type:** docs-only (puede ir dentro del índice P0 o como sección del mapa SoT).
- **Allowed scope:** una sección/encabezado en `docs/SOURCES_OF_TRUTH.md` y/o nota al inicio de
  `docs/audit/README.md` y de un futuro `docs/audits/README.md`.
- **Non-scope:** **no** fusionar ni renombrar las carpetas.
- **Probable files:** `docs/SOURCES_OF_TRUTH.md`, `docs/audit/README.md`.
- **Validación:** lectura humana.
- **Rollback:** borrar la sección.
- **Dependency:** acoplada a los dos P0 anteriores.

### P1 — Clasificación de docs históricos vs actuales

- **Problema:** ~70 docs históricos (pr-history, implementation-history, pr-* raíz, AUDIT_*) se leen
  como si fueran vigentes.
- **Evidencia:** §4 de esta auditoría; convenciones de nombre múltiples.
- **PR type:** docs-only.
- **Allowed scope:** ampliar `docs/SOURCES_OF_TRUTH.md` con una sección "historical / avoid reading"
  enumerando carpetas/patrones. **Marcar por contenido, no mover.**
- **Non-scope:** no mover/renombrar/borrar; no tocar el contenido histórico.
- **Probable files:** `docs/SOURCES_OF_TRUTH.md`.
- **Validación:** lectura humana.
- **Rollback:** revertir sección.
- **Dependency:** tras P0.

### P1 — Marcar planes dashboard "superseded"

- **Problema:** `DASHBOARD_PREMIUM/NO_SCROLL/SINGLE_VIEWPORT_*_PLAN.md` probablemente reemplazados por
  el rediseño horizontal-nav.
- **Evidencia:** memoria `dashboard_horizontal_nav_redesign`; `docs/audit/dashboard-horizontal-navigation-information-architecture.md`.
- **PR type:** docs-only.
- **Allowed scope:** una línea de estado en el mapa SoT ("superseded by horizontal-nav, ver …").
  **Requiere confirmación de Nico** de que están superados.
- **Non-scope:** no editar los planes; no moverlos.
- **Probable files:** `docs/SOURCES_OF_TRUTH.md`.
- **Validación:** confirmación de Nico + lectura humana.
- **Rollback:** revertir la línea.
- **Dependency:** P0/P1.

### P1 — Índice del prompt-pack para futuras auditorías

- **Problema:** cada auditoría futura re-deriva contexto (qué leer, qué no, presupuesto).
- **Evidencia:** esta misión repite inventarios que ya existen en closeouts.
- **PR type:** docs-only.
- **Allowed scope:** sección en `docs/audit/README.md`: "antes de auditar, lee el mapa SoT; un
  dominio por auditoría; un archivo de salida; no reabrir bloques cerrados (§5)".
- **Non-scope:** no crear plantillas de código ni tooling.
- **Probable files:** `docs/audit/README.md`.
- **Validación:** lectura humana.
- **Rollback:** revertir sección.
- **Dependency:** tras índice P0.

### P2 — (Diferido) Agrupar `docs/` raíz suelta — **move-only**

- **Problema:** ~40 archivos sueltos en raíz de `docs/`.
- **Evidencia:** §3.
- **PR type:** move-only (futuro).
- **Allowed scope:** `git mv` de `docs/pr-*`, `docs/fix-*` a subcarpetas existentes (`docs/pr-history/`
  o nueva `docs/pr-archive/`).
- **Non-scope:** **no** ejecutar hasta que el índice/mapa exista y se valide que ningún test lee esos
  paths (precedente: el doc-org PR tuvo que actualizar 1 path en un test).
- **Probable files:** docs sueltas + posible 1 path en test (requiere autorización, igual que el
  precedente).
- **Validación:** `pnpm test` (paths), `git diff --check`.
- **Rollback:** revertir el move.
- **Dependency:** **después** de P0/P1.

### P3 — (Diferido) Carpeteo de `test/` — **requires later test-only audit**

- **Problema:** ~350 archivos planos en `test/`.
- **PR type:** move-only (fuera de este eje).
- **Allowed scope / non-scope:** **no** en este eje; `test` está prohibido. Solo se registra como
  deuda. Alto riesgo (contratos leen paths).
- **Validación / rollback / dependency:** N/A aquí.

---

## 10. Recommended Ordering PR Sequence

> PRs chicos, un solo eje, reversibles. Git lo ejecuta Nico.

### PR-O1 — docs-only: índice de auditorías

- **Objetivo:** crear `docs/audit/README.md` con estado por archivo (current/closeout/historical/superseded).
- **Por qué mejora eficiencia:** Claude ubica el doc vigente en 1 lectura en vez de N aperturas.
- **Allowed scope:** `docs/audit/README.md`.
- **Non-scope:** no tocar audits; no mover/renombrar; no CI/scripts/tests.
- **Validación:** `git status --short`, `git diff --check`, lectura humana.
- **Rollback:** borrar archivo.
- **Dependency:** ninguna. **Primero.**

### PR-O2 — docs-only: mapa de fuente-de-verdad + disambiguación audit/audits

- **Objetivo:** `docs/SOURCES_OF_TRUTH.md` (materializa §8) + nota `docs/audit` vs `docs/audits`;
  1 línea en `AGENTS.md` apuntando al mapa (con autorización de Nico).
- **Por qué:** un único punto que enruta cada dominio a su SoT y marca lo histórico.
- **Allowed scope:** `docs/SOURCES_OF_TRUTH.md` (+ `AGENTS.md` 1 línea).
- **Non-scope:** no consolidar carpetas; no mover docs.
- **Validación:** `git diff --check`, lectura humana.
- **Rollback:** borrar archivo / revertir línea.
- **Dependency:** tras PR-O1.

### PR-O3 — docs-only: clasificación histórica + planes superseded

- **Objetivo:** sección "historical / avoid reading" y marca "superseded by horizontal-nav" en los
  `DASHBOARD_*_PLAN`.
- **Por qué:** evita que auditorías futuras lean docs obsoletos como vigentes.
- **Allowed scope:** `docs/SOURCES_OF_TRUTH.md`.
- **Non-scope:** no editar/mover/borrar el contenido histórico.
- **Validación:** confirmación de Nico (superseded) + lectura humana.
- **Rollback:** revertir sección.
- **Dependency:** tras PR-O2.

### PR-O4 — (NO necesario) scripts-only de capas E2E

- **Estado:** **YA HECHO en #1096.** `frontend/package.json` tiene `e2e:smoke/admin-mobile/visual-contract/public-clinic/full`.
- **Acción real pendiente (otro eje, no ordenamiento):** validar `unión de capas == e2e:full` antes
  de cualquier PR-C3 CI-only. **No** abrir como PR de ordenamiento.

### PR-O5 — docs-only: prompt-pack index para futuras auditorías

- **Objetivo:** sección en `docs/audit/README.md` con reglas de §11 (un dominio/auditoría, un
  archivo de salida, no reabrir cerrados, leer mapa SoT primero).
- **Por qué:** reduce el costo fijo de arranque de cada auditoría.
- **Allowed scope:** `docs/audit/README.md`.
- **Non-scope:** sin tooling/plantillas de código.
- **Validación:** lectura humana.
- **Rollback:** revertir sección.
- **Dependency:** tras PR-O1.

### PR-O6 — (Diferido) move-only: agrupar `docs/` raíz suelta

- **Objetivo:** `git mv` de `docs/pr-*`/`docs/fix-*` a subcarpeta de archivo.
- **Por qué:** limpia la raíz de `docs/` que el índice ya habrá catalogado.
- **Allowed scope:** docs sueltas (+ posible 1 path en test, con autorización, precedente doc-org).
- **Non-scope:** no antes de PR-O1..O3; no mezclar con cambios de contenido.
- **Validación:** `pnpm test` (paths intactos), `git diff --check`.
- **Rollback:** revertir el move.
- **Dependency:** **solo** tras tener índice + mapa estables.

---

## 11. Rules for Future Audits

- Claude **no elige prioridades** sin una matriz (P0/P1/P2/P3) explícita.
- **Un dominio por auditoría.** No mezclar dominios en un solo archivo.
- **Un archivo de salida por auditoría**, en `docs/audit/`, con nombre kebab-case descriptivo.
- **Docs-only antes que implementación.** Auditar, luego (en PR aparte) implementar.
- **Scripts-only separado de CI-only.** Nunca tocar `.github/workflows` en el mismo PR que scripts.
- **Move-only separado de cambios de contenido.** Un PR mueve **o** edita, nunca ambos.
- **No reabrir bloques cerrados** (§5: Admin Mobile E2E Helper, Density, No-scroll) sin **nueva
  evidencia** documentada.
- **No mover archivos E2E** antes de que las capas (scripts) + CI estén estables.
- **No tocar CI** antes de validar localmente `unión de capas == e2e:full`.
- **No usar frameworks/librerías** como solución de ordenamiento (es un problema de docs, no de deps).
- **No mezclar** cambios visuales, de seguridad, de CI y de producto en un mismo PR.
- **No mezclar Dependabot** con trabajo funcional o de ordenamiento.
- **No tocar `frontend/next-env.d.ts`** (se regenera con `next dev`; revertir si se ensucia).
- **No ejecutar Git reservado a Nico** (`add`/`commit`/`push`/`merge`/`gh pr *`).
- **No usar comandos con `exit`.**
- **Leer primero el mapa SoT** (`docs/SOURCES_OF_TRUTH.md`) y el índice (`docs/audit/README.md`)
  antes de abrir docs individuales.

---

## 12. Final Recommendation

**Qué ordenar primero.** **PR-O1 docs-only: `docs/audit/README.md`** (índice de auditorías con
estado por archivo). Es el cambio de menor riesgo y mayor retorno: convierte 31 aperturas
exploratorias en 1 lectura. Inmediatamente después, **PR-O2** (mapa de fuente-de-verdad +
disambiguación `docs/audit`/`docs/audits`).

**¿Sigue siendo viable PR-C2 scripts-only "ahora"?** **No aplica: ya está hecho.** El HEAD actual
(`8e29cc2`, #1096) **ya añadió** los scripts de capa E2E a `frontend/package.json`. Lo que queda de
ese hilo es **validación** (`unión de capas == e2e:full`) y luego PR-C3 **CI-only** — y eso **no es
un PR de ordenamiento**; pertenece al eje E2E/CI y queda fuera de scope aquí.

**¿Debe ir un PR-O docs-index antes que PR-C2?** La pregunta queda superada porque PR-C2 ya se
mergeó. La regla a futuro es: **los PR-O docs-index (PR-O1/O2) van antes que cualquier PR-C3 CI-only**,
porque el índice/mapa reduce el costo de razonar sobre la matriz spec→capa y evita reauditar lo ya
cerrado.

**Qué NO tocar todavía.** `frontend/src`, `server`, `drizzle`/migraciones, `test`, specs, helpers,
fixtures, `.github/workflows`, `package.json`, `frontend/package.json`, `pnpm-lock.yaml`, Playwright
config, `scripts`, dependencias, secretos, producción, base de datos real, `frontend/next-env.d.ts`,
y **cualquier move/rename de archivos** hasta que el índice + mapa existan y congelen el estado actual.

**Próximo PR recomendado (exacto).** `PR-O1 docs-only` — crear `docs/audit/README.md` (índice de
auditorías con estado: current / closeout / historical / superseded, y "leer completo: sí/no").
Único archivo. Sin mover nada. Validación: `git status --short`, `git diff --check`, lectura humana.

**Cómo esta auditoría reduce tokens y mejora a Claude:**

- **Un mapa, no N aperturas:** futuras auditorías leen `docs/SOURCES_OF_TRUTH.md` (1 doc) en vez de
  explorar 174.
- **Bloques cerrados marcados (§5):** evita reauditar Admin Mobile E2E Helper / Density / No-scroll
  (alto ahorro: son los bloques más densos del historial reciente).
- **Histórico señalizado:** `docs/audits`, `pr-history`, `implementation-history`, `pr-*` raíz y
  `legacy/` marcados "avoid reading" → cero lecturas exploratorias inútiles.
- **Estado de PR-C2 aclarado:** ya hecho en #1096 → no se vuelve a planear ni implementar.
- **Reglas de scope (§11):** Claude no inventa prioridades ni mezcla ejes; cada auditoría futura
  arranca acotada.

---

## Final validation

```powershell
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

**Resultado esperado de esos comandos** (este PR solo agrega un archivo **untracked**):

- `git status --short --untracked-files=all` → `?? docs/audit/repository-operational-ordering-audit.md`
- `git diff --name-only` → vacío (no hay archivos tracked modificados)
- `git diff --stat` → vacío
- `git diff --check` → limpio (sin whitespace errors en cambios tracked)

> Los comandos de validación los ejecuta Nico manualmente. Esta auditoría **no** ejecuta
> `git add/commit/push`, `gh pr create/merge` ni ningún comando con `exit`.

---

## Nota de seguimiento (ejecución real, PR-CLEAN2, 2026-06-28)

Esta auditoría (§9 P2 / §10 PR-O6) había diferido el `move-only` de `docs/audits/`,
`IMPLEMENTATION_NOTES/`, `docs/implementation-history/` y los `pr-*.md` sueltos de la raíz de
`docs/` **hasta que existieran el índice de auditorías y el mapa de fuente-de-verdad**
(condición de dependencia explícita en §9/§10: "solo tras tener índice + mapa estables").

Esa condición ya se cumplió en PRs posteriores: `docs/audit/README.md` (PR-O1),
`docs/SOURCES_OF_TRUTH.md` (PR-O2/PR-SOT1) y `docs/HISTORICAL_DOCUMENTATION.md` (PR-O3) existen
y están vigentes. `docs/audit/final-repo-cleanup-engineering-audit.md` (§14, PR-CLEAN2) tomó esto
como base y ejecutó el move-only diferido:

- `docs/audits/` (10 archivos) → unificado dentro de `docs/audit/`.
- `IMPLEMENTATION_NOTES/` (raíz, 34 archivos) y `docs/implementation-history/` (13 archivos) →
  consolidados dentro de `docs/implementation/`.
- ~30 `pr-*.md`/`prN-*.md` sueltos de la raíz de `docs/` → recolectados en `docs/pr-history/`.

Los 3 tests de contrato que leían rutas exactas (`test/frontend-dashboard-filter-drawer-sticky-filters.test.ts`,
`test/global-e2e-production-readiness-contract.test.ts`, `test/production-readiness.test.ts`) se
actualizaron en el mismo PR, siguiendo el precedente de
`docs/implementation/chore-docs-organize-audit-implementation-notes.md`. Las tablas de inventario
de §3/§4/§8 de este documento describen el estado **anterior** a PR-CLEAN2 (2026-06-23); para la
ubicación física vigente, ver `docs/HISTORICAL_DOCUMENTATION.md` y `docs/SOURCES_OF_TRUTH.md`.
