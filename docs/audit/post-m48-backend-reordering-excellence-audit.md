# Post-M48 Backend Reordering — Independent Excellence Audit

> **Tipo:** Auditoría independiente **docs-only**. No implementa, no mueve archivos, no toca
> código, tests, `package.json`, lockfiles, CI ni schema. Único archivo nuevo bajo
> `docs/audit/`.
> **Base:** `main` · **HEAD:** `cb6f013e90d1363373a86f6bcce26bff68ac453e`
> test(architecture): certify backend modularization program (#1586).
> **Rama de auditoría:** `audit/backend-modularization-post-m48-excellence` (mismo SHA que
> `main` y `origin/main`).
> **Fecha:** 2026-07-28.
> **Objeto auditado:** programa completo de modularización backend M01–M48 y su
> certificación `CERTIFIED_WITH_RESIDUAL_RISKS` (PR #1586).
> **Modelo / esfuerzo:** Claude Fable 5 · effort máximo · extended thinking.
> **Skills aplicadas:** `VETNEB Production Web Optimization Engineer` (principal) ·
> `VeTNEB Staff/Senior Full-Stack Engineer` (co-principal) ·
> `VeTNEB Security Production Invariants` · `VeTNEB Protocolos Comunicación` ·
> `VeTNEB Briefing, Planificación, Diseño, Desarrollo y Pruebas` ·
> `VeTNEB Lanzamiento Mantenimiento`. Fuera de alcance: Web E2E Global, PWA, Admin
> Dashboard Operational Actions.
> **Principio de independencia:** ninguna afirmación de M48, del rector, de los closeouts
> ni de PR bodies se aceptó sin recomputarla contra código, AST, filesystem, Git history,
> blobs y GitHub read-only. Ante contradicción, prevaleció la evidencia ejecutable.

Etiquetas: `CONFIRMED` (recomputado en esta auditoría) · `MATCH` (coincide exactamente con
lo certificado) · `STALE` (afirmación documental superada por el estado real) ·
`PRE-EXISTENTE` (condición anterior a M01, preservada 1:1 por el programa).

---

## 1. Veredicto

```text
EXCELLENT_WITH_RESIDUAL_RISKS
```

**Score: 93 / 100.** Cero P0 · cero P1 · cero P2 · siete hallazgos P3 (§7).

La pregunta objetivo — *¿el reordenamiento backend empresarial de VETNEB fue completado de
manera excelente, íntegra, mantenible y segura?* — se responde así: **la arquitectura, la
preservación semántica, la seguridad acumulada y los guards son reproducibles y correctos
al 100 % de lo verificado; lo que impide `EXCELLENT` no es ningún defecto de código sino
la vigencia documental post-merge y tres residuos menores de calidad de guard/deuda
preexistente**, todos P3, ninguno estructural, todos con mitigación activa.

Esta auditoría intentó refutar la certificación M48 (censo, grafo, moves, guards,
seguridad, trazabilidad). No lo consiguió en ningún punto material: **todos los números
certificados se reprodujeron exactamente desde cero** con herramientas independientes
(§3–§5). Los riesgos residuales aceptados (SCC único, Auth congelado, KEEPs M46/M47, sin
RLS, sin cobertura instrumental) son deliberados, documentados, proporcionales y están
protegidos por guards ejecutables — cumplen la definición estricta de
`EXCELLENT_WITH_RESIDUAL_RISKS`.

Por qué no `EXCELLENT` (requiere documentación vigente correcta y cero gaps en guards):

1. ningún documento del repositorio registra el PR #1586; la matriz M48, la sección 18 de
   la certificación, el rector y el inventario presentan como vigente un estado pre-merge
   (F-2, `STALE`);
2. el resolver del guard M35b sigue sin normalizar imports sin extensión — review P2 del
   PR #1574 abierto y sin corrección causal (F-1);
3. deuda muerta preexistente en zona Auth congelada y en la cadena SLA-breach (F-3,
   `PRE-EXISTENTE`).

Por qué no `ACCEPTABLE_BUT_NOT_EXCELLENT`: esa categoría exige al menos un P2 o gaps
significativos; ningún hallazgo alcanza P2 — cada gap tiene defensa en profundidad que
preserva la capacidad real de detección (§7).

---

## 2. Fase A — Integridad post-merge [CONFIRMED]

| Precondición esperada | Resultado |
| --- | --- |
| HEAD = `main` = `origin/main` | `cb6f013e90d1363373a86f6bcce26bff68ac453e` ✓ |
| Working tree / índice | limpios (`--untracked-files=all` vacío) ✓ |
| Worktrees | uno (`C:/PORTAL-VETNEB`) ✓ |
| PRs abiertos | 0 ✓ |
| PR #1586 | `MERGED` 2026-07-28T15:27Z; mergeCommit = HEAD; checks `validate-backend` ×2, `validate-pr-governance`, `qga-workflow-security` todos `pass` ✓ |
| Rama M48 (`test/backend-modularization-m48-final-certification`) | eliminada local y remota ✓ |
| Review threads PR #1586 | 1 (P2 LOC infladas) — **resuelto causalmente**: el censo corregido del doc coincide con el recomputado (§3) ✓ |
| `C:\PORTAL-VETNEB-sec-deps-orphaned-20260724` | no inspeccionado ni modificado ✓ |

Higiene residual (no bloquea; ver F-7): 4 stashes (`stash@{0}` menciona una auditoría de
modularización previa a PR #1493), ramas locales sin mergear
`refactor/backend-modularization-m28-clinics-public-profile` y
`refactor/backend-modularization-m42-users-roles-domain-use-cases`, y remotas residuales
`chore/security-find-my-way-9-6-1`, `origin/refactor/...m28...`,
`security/brace-expansion-ghsa-3jxr-9vmj-r5cp`, `test/...m29-clinics-cross-tenant-closeout`.

## 3. Fases B–C — Trazabilidad y censo físico [CONFIRMED → MATCH]

**Trazabilidad M01–M48.** Los **49 squash SHAs** de la matriz final de M48 coinciden uno a
uno con el first-parent real de `main` (`git log f3e22a7..cb6f013`); los 6 closeouts
documentales separados (#1508, #1514, #1516, #1518, #1520, #1522) y los 16 commits
intercalados de seguridad/dependencias/gobernanza cuadran: 71 commits al baseline
`7a05cb8` + #1586 = 72. Los 4 squashes sin número de PR en el subject se verificaron por
GitHub (`#1513→27be4cf`, `#1519→5f99b5f`, `#1559→eb46092`, `#1560→6e1a91f`). Review
threads de los 56 PRs del programa: 11 en total, 9 resueltos, 2 sin resolver (F-1, F-4).

**Censo físico.** Recontado con script Node independiente (`git ls-files` + semántica LOC
del enunciado: CRLF→LF, vacío = 0, sin segmento vacío final, sin `.d.ts`):

| Métrica | Certificado M48 | Recomputado | Estado |
| --- | ---: | ---: | --- |
| Archivos TS `server/` | 227 | 227 | MATCH |
| LOC totales | 47.015 | 47.015 | MATCH |
| `server/features` | 149 / 16.980 | 149 / 16.980 | MATCH |
| `server/routes` | 35 / 23.033 | 35 / 23.033 | MATCH |
| `server/lib` (24 raíz + 3 http) | 27 / 3.863 | 27 / 3.863 | MATCH |
| `server/middlewares` | 7 / 861 | 7 / 861 | MATCH |
| raíz/entrypoints | 9 / 2.278 | 9 / 2.278 | MATCH |
| Features (9) — archivos y LOC por feature | tabla §8 M48 | idéntica dígito a dígito | MATCH |
| Rutas `*.fastify.ts` | 35 | 35 (cero no-fastify) | MATCH |

Diferencias de una línea encontradas: **cero**.

## 4. Fases D–F — Features, grafo AST y SCC residual [CONFIRMED]

**Capas (9 features).** Cero imports de Fastify en `server/features/**`; cero Drizzle
runtime / `env` / `fs` / `fetch` en capas `domain`; `server/lib` y `server/db.ts` sólo se
consumen desde `infrastructure` y composition roots (mayormente lazy). Clasificación:
Logistics **excelente** (4 capas reales, 12 puertos mínimos genéricos); Reports, Study
Tracking, Particular Access, Report Access, Users/Roles, Public Professionals
**correctas**; Pricing y Clinics **correctas-proporcionales** (servicios directos
documentados; no se fabricaron capas vacías — coherente con el ADR). Ninguna feature
infra- ni sobrearquitecturada.

**Grafo AST (analizador independiente, TypeScript compiler API):**

| Métrica | Certificado | Recomputado | Estado |
| --- | ---: | ---: | --- |
| Referencias cross-feature | 16 | 16 | MATCH |
| Runtime / type-only | 13 / 3 | 13 / 3 | MATCH |
| Dinámicas | 7 | 7 | MATCH |
| Aristas full = runtime | 7 | 7 (mismas siete) | MATCH |
| SCC full y runtime | único `particular-access ↔ reports` | ídem | MATCH |
| Cross-feature a internals | 0 | 0 (todo por barrels `index.ts`) | MATCH |
| `lib → features` / `features → routes|middlewares` | 0 | 0 | MATCH |
| Relativos irresolubles | 0 | 0 | MATCH |

**SCC residual (Fase F): benigno con guard.** El lado estático
(`particular-token.ts → reports/index.ts`) termina en dominio puro
(`serializeSafeReport`, sólo type-imports de schema) y en un lazy loader sin imports
estáticos (`reports-public-composition.ts`). El lado inverso
(`reports → particular-access`) es exclusivamente `await import()` dentro de loaders
async de defaults. **No existe evaluación circular eager, ni inicialización parcial, ni
riesgo TDZ.** El guard M45 congela las 16 referencias con archivo + destino + **modo**
(`|dynamic|`/`|static|`): un cierre eager futuro del ciclo rompería el guard. Reevaluación
independiente de C5: `NOT_RUN` es correcto. Riesgo: deliberado, documentado, protegido.

## 5. Fases G–J — Moves, legacy, `server/lib` y module-load [CONFIRMED]

**Equivalencia semántica (muestra de 17 moves, todas las fases).** Por blob de Git:
`route-planning`, `metrics`, `public-pricing-cache` y los 3 helpers M46 son **moves 1:1
byte-idénticos**; `db-logistics` (M12) difiere sólo en un header de 9 líneas de comentario
+ 3 specifiers (declarado), y su canónico es **blob-idéntico desde M12 hasta HEAD**;
`db-pricing`, `db-admin-clinics`, `study-tracking`, `token-study-tracking`,
`report-status`, `report-study-types`, `reports`, `db-admin-users-roles`: sólo specifiers
(1–5 líneas). Dos no-1:1 detectados, **ambos declarados y probados en su closeout**:
`sla-breach` (separación núcleo genérico `TInstance` / adaptador DB, M02b §"Separación
domain/infrastructure") y `professional-bank-eligibility` (desacople de
`report-study-types` con prueba de equivalencia lógica en M21 §"Prueba de equivalencia").
Refactors silenciosos, export drift, duplicación de singletons: **no encontrados**.

**Transacciones.** Base pre-M01: 11 call-sites `.transaction(` en 3 archivos
(`db.ts` 2, `db-logistics` 7, `db-admin-clinics` 2). HEAD: 11 en 3 archivos
(logistics 7, clinics 2, reports 2 — las 2 de `db.ts` migraron con el repositorio de
comandos de Reports). **Invariante transaccional preservada.**

**Legacy y shims.** Los 26 paths retirados de M48 §10 están **ausentes** (verificación
filesystem completa). 35/35 rutas importadas y registradas en `fastify-app.ts`. Cero
shims `export *` vencidos, cero paths recreados.

**`server/lib` (27 módulos).** Fan-in recomputado por resolución de imports:
`env` 46 · `cors-headers` 30 · `auth-security` 31 · `runtime-timing` 21 ·
`session-last-access` 18 · `fastify-admin-auth` 15 · `permissions` 14 · `rate-limit-store`
9 · `logger` 1 · `http-runtime` 2 — coincide con el recenso M46/M47/M48 (el inventario M01
subcontaba; ver F-4). **M46:** los tres módulos exactos en `server/lib/http` (fan-ins
1/2/1), sin barrel, sin duplicación, única dependencia interna `api-request-id →
api-response-security` (dentro de la frontera); blobs pre/post idénticos; CORS KEEP con 30
consumidores reproducidos. **M47:** 5 KEEP verificados presentes, `server/lib/infra`
ausente; el NO-GO se evalúa **prudente y correcto** — `env.ts` solo ya excede el límite de
30 paths y cruza Auth congelado; mover únicamente `logger` habría sido reclasificación
nominal (exactamente la sobreingeniería que el programa prohíbe).

**Module-load (Fase J).** Un único cliente Postgres (`db.ts`, top-level) y un único
cliente Supabase (`lib/supabase.ts`) — sin duplicación inducida por moves (los paths
legacy no existen, el module cache resuelve a un solo canónico). Cero
`setInterval`/`setTimeout` top-level en `lib`; `dotenv` sólo en `env.ts` (side effect de
carga preexistente y documentado). Composición de defaults de features: lazy
(`await import()` en loaders), sin cambio de orden de carga observable.

## 6. Fases K–N — HTTP, persistencia, seguridad y guards [CONFIRMED]

**HTTP.** Orden de hooks intacto en `fastify-app.ts`: request-id + security headers
(l.352) → `requireTrustedOriginForFastify` (l.357) → version-gate (l.358) → `onSend`
no-store (l.360); doble registro `/api/reports` en orden contractual `reports` (l.575) →
`reports-status` (l.580). **Thin real:** cero rutas importan `server/db.ts`; cero SQL
inline; el único `drizzle-orm` en rutas es `eq` en `admin-auth.fastify.ts` — realm Auth
**excluido del programa** (`PRE-EXISTENTE`). Las 10 rutas sin imports de features son
exactamente auth/audit/ops (fuera de features por diseño documentado M20).

**Auth `EXCLUDED_BUT_GUARDED` — verificado adversarialmente.** Diff completo
`f3e22a7..HEAD` sobre las superficies congeladas: `error-handler.ts` eliminado (M02,
huérfano declarado); `auth-security.ts` +`as const` (PR de dependencias #1558 intercalado,
type-level, ajeno al programa); `middlewares/particular-auth.ts` 1 línea (M44: specifier
del shim retirado → barrel canónico). **Ninguna lógica de Auth fue modificada por el
programa.** El lado "guarded" es real: 17 guards `test/architecture/security` + 10
contratos `test/security` ejecutados en verde (§8).

**Guards (Fase N).** El guard M48 (35 tests) **compone y ejecuta** M44/M45/M46 por
import real (no duplica ni infla conteos — al contrario, el doc subcuenta, ver F-2);
congela censo LOC por área y por feature **reconciliado contra el propio documento**
(detecta drift de árbol y de doc); fija ausencia de 24 paths legacy, 5 KEEP M47,
inexistencia de `lib/infra`, features y barrels exactos; y se auto-verifica determinista
(sin Git/red/procesos/fechas). El guard M45 es **path-aware y mode-aware**: congela las 16
referencias exactas (archivo, destino, static/dynamic, type-only), exige barrels, prohíbe
`lib→features` y `features→routes/middlewares`, y permite un único SCC. RED real
documentado y reproducible. Respuestas a las preguntas obligatorias: certifica
arquitectura real (no sólo documentación); **no** podría pasar con arquitectura
incorrecta en ninguna dimensión congelada; ejecuta M44–M46 correctamente; protege LOC,
grafo y riesgos residuales. Gap identificado: F-1 (M35b). Costo aceptado: F-5 (freeze de
LOC).

**Persistencia (Fase L).** Repositories en `infrastructure` por feature; ningún `db-*`
importa a otro; transacciones 1:1 (§5); orden persistencia → audit/email → respuesta
cubierto por contratos por-ruta ejecutados en verde; sin retries/outbox nuevos (limitación
preexistente documentada por el rector, no deuda del programa).

## 7. Hallazgos

| ID | Prioridad | Hallazgo | Evidencia | Mitigación vigente |
| --- | --- | --- | --- | --- |
| F-1 | **P3** (review original P2) | El resolver del guard M35b (`token-access-m35b-closeout.test.ts`, `resolveImportTarget`) no normaliza imports sin extensión: `import("../db-particular")` evadiría sus comparaciones `*.ts`. Review P2 del PR #1574 **sin resolver ni corregir**. | Lectura del guard actual; thread GitHub abierto | Defensa en profundidad: M44/M48 congelan la **ausencia** del path (`existsSync=false`), y un import a módulo inexistente rompe typecheck/runtime. Ninguna regresión real pasa el gate completo sin detección. |
| F-2 | **P3** | Verdad documental post-merge: **ningún documento registra el PR #1586**. La matriz M48 (fila M48: `NOT_RUN`, "HEAD sin cambio"), §18 ("PR: NOT_RUN · Merge: NOT_RUN"), el addendum "vigente" del rector y del inventario ("M48 — completado **localmente**") describen el estado pre-merge como actual. La tabla de validaciones certifica 32 tests del guard M48 / 580 arquitectura / 3.960 total; el artefacto mergeado da **35 / 583 / 3.963** (los 3 tests del fix de censo post-review). | Greps documentales + ejecución de suites §8 | Los closeouts M44–M46 con `NOT_RUN` son snapshots históricos legítimos (además congelados por el guard M48). Precedente interno de corrección: docs-PR de refresh post-merge (p.ej. #1508). El guard exige inclusión de marcadores, no exclusión: el refresh es posible sin tocar el guard. |
| F-3 | **P3** · PRE-EXISTENTE | Código muerto productivo: (a) los 4 middlewares de auth (`auth`, `admin-auth`, `clinic-permissions`, `particular-auth`) tienen **cero consumidores productivos** — ya era así en la base `f3e22a7` (las rutas hacen auth inline vía seam `Options`); viven sólo por sus tests. (b) La cadena SLA-breach (`sla-breach-db.ts`, 37 LOC, y el UC de dominio `markOverdueSlaBreaches`) no tiene consumidor productivo — tampoco lo tenía en la base. | Análisis de fan-in por imports resueltos; `git grep` en base y HEAD | (a) Zona Auth congelada: su retiro exige la secuencia C4, no este programa. (b) Preservación 1:1 fiel al mandato "reorganizar, no reescribir". Ambos inventariados aquí para decisión futura. |
| F-4 | **P3** | Inventario `server/lib` §4: fan-ins subcontados (excluyen consumidores intra-lib; `env` 42 vs 46-47 reales). Review P2 del PR #1496 **sin resolver ni aclarar** en el documento. | Thread GitHub abierto; recuento propio | Sin efecto causal: M46/M47/M48 recensaron independientemente (46/58) y el NO-GO sólo se refuerza con el fan-in mayor. |
| F-5 | **P3** (tradeoff deliberado) | El guard M48 congela LOC exactas por área y feature: **todo PR backend futuro deberá actualizar guard + tablas de la certificación**. Change amplification documental introducida conscientemente como tripwire post-certificación. | Guard M48, tests de censo | Es diseño intencional ("protege LOC"); el costo por PR es mecánico (2 constantes + 2 tablas). Registrarlo evita sorpresas en el primer PR post-programa. |
| F-6 | **P3** | El ADR rector de fronteras (ARCH-2) permanece en estado **Proposed**; su propia condición de paso a **Accepted** (piloto Logistics demostrado) se cumplió hace 10 fases. | `backend-boundary-adr.md` §Status | Documental; una línea de status en un docs-PR. |
| F-7 | **P3** | Higiene Git: 4 stashes antiguos y 5 ramas residuales (2 locales sin mergear, 3 remotas) ajenas al estado final certificado. | §2 | Limpieza manual [MANUAL-NICO]; ninguna contamina `main`. |

**P0: 0 · P1: 0 · P2: 0 · P3: 7.** Ningún hallazgo es regresión funcional, frontera rota,
ciclo peligroso, bypass de seguridad, legacy productivo activo ni certificación falsa.

## 8. Validaciones ejecutadas (estados canónicos)

| Comando | Estado | Resultado |
| --- | --- | --- |
| Baseline Git/GitHub completo (§13 del encargo) | PASSED | §2; divergencia de rama esperada resuelta con `git switch` a la rama de auditoría preexistente en el mismo SHA |
| Censo físico independiente (Node, TEMP) | PASSED | MATCH total (§3) |
| Grafo AST independiente (TS compiler API, TEMP) | PASSED | MATCH total (§4) |
| Guard M48 aislado | PASSED | **35 tests, 35 pass, 0 fail** (1.773 ms) |
| Arquitectura completa (`test/architecture/**`) | PASSED | **583 tests, 582 pass, 1 skip Windows esperado, 0 fail** (3.862 ms) |
| Seguridad dirigida (`architecture/security` + `test/security`) | PASSED | **199 tests, 199 pass, 0 fail** (1.597 ms) |
| `pnpm validate:local` (typecheck ×2 + test + build) | PASSED | **3.963 tests, 3.962 pass, 1 skip, 0 fail; build `dist/index.js` 922,4 kb** |
| `pnpm security:public-surface` | PASSED | 0 findings públicos; 2 markers server-only esperados (`frontend/src/proxy.ts`) |
| `git diff --check` | PASSED | exit 0 |
| `pnpm validate:local:schema` | BLOCKED | requiere DB real; prohibido cargar `.env` |

Nota operativa: los scripts auxiliares creados bajo `$env:TEMP` fueron eliminados al finalizar la auditoría; no quedaron outputs permanentes fuera de este informe.

## 9. Fases P–Q — Mantenibilidad y operabilidad (dictamen)

Con evidencia de §3–§6: el ownership es localizable por feature (9 fronteras reales +
matriz de 7 aristas congelada); el change amplification bajó de "188–202 tests ancla por
naming global" a fronteras por contexto con guards auto-descubiertos; los barrels expresan
APIs públicas reales (los 3 features sin barrel no son destino de imports); las
excepciones (servicios directos Pricing/Clinics, CORS KEEP, 5 KEEP M47, kernel
`permissions`) están delimitadas y escritas; el razonamiento local es posible (domain puro
→ UC → adapter → ruta thin). Operabilidad: mismo artefacto de deploy (922,4 kb), hooks y
health intactos, request-id/error envelope preservados, sin cambios de cold start
atribuibles (no se afirma mejora sin medición comparativa, coherente con el mandato).
Startup: singletons únicos y carga lazy de composición — sin regresión estructural.

## 10. Recomendaciones (no ejecutadas — todas docs/tests, futuras y opcionales)

1. **Docs-PR de cierre real de M48** (resuelve F-2 y F-6): registrar PR #1586 + fecha de
   merge en la matriz y en los addenda "vigentes" del rector/inventario; actualizar la
   tabla de validaciones a los conteos del artefacto mergeado (35/583/3.963) o marcarla
   explícitamente como medición pre-commit; pasar ARCH-2 a `Accepted`. El guard M48 no lo
   impide (exige inclusión de marcadores, no exclusión).
2. **Fix del resolver M35b** (F-1) con la normalización `.ts`/`index.ts` que ya usa M33, y
   cierre de los 2 review threads abiertos (#1496, #1574) según protocolo §24.
3. **Decisión explícita sobre la deuda muerta preexistente** (F-3): retiro de los 4
   middlewares auth dentro de la futura secuencia C4; decisión KEEP-con-nota o retiro de
   la cadena SLA-breach en un milestone menor.
4. **Higiene local** (F-7): revisión y limpieza manual de stashes y ramas residuales.

## 11. Riesgos residuales ratificados

SCC `particular-access ↔ reports` (benigno, mode-pinned por M45) · Auth fuera del
programa con suites verdes · CORS KEEP M46 y 5 KEEP M47 (proporcionales; NO-GO prudente) ·
aislamiento multi-tenant a nivel aplicación sin RLS (deuda estratégica pre-programa,
cubierta por IDOR/ownership/disclosure en verde) · cobertura instrumental C1 no ejecutada
(regresión basada en 3.963 tests deterministas). Todos deliberados, documentados y con
guard o suite que los vigila.

## 12. Estado final

- Diff de esta auditoría: **únicamente este archivo**.
- Working tree: limpio salvo este documento; sin artefactos.
- Comandos [MANUAL-NICO] pendientes (no ejecutados): `git add docs/audit/post-m48-backend-reordering-excellence-audit.md` · `git commit` · `git push -u origin audit/backend-modularization-post-m48-excellence` · `gh pr create` (scope `docs`) · checks · merge.

**Veredicto final: `EXCELLENT_WITH_RESIDUAL_RISKS` — 93/100.**
