# DRV · C26 — Auditoría de las mejoras DRV y preparación de C26

## Estado base, autorización y alcance

- Rama `docs/dashboard-drv-c26-readiness`, creada por Nico desde `main@ca032b1adab978a9268a956deba44e3b4ffcf8e9` (PR-DRV-02, #1900). `origin/main` coincide. La rama no está publicada.
- Árbol al iniciar: sin cambios tracked, sin staged, sin stashes. Untracked preservado: `frontend/AGENTS.md`, que regenera `next dev` (bloque de reglas de Next.js, no es un contrato del repositorio). Worktrees ajenos intactos: `C:/PORTAL-VETNEB-C17` y `C:/PORTAL-VETNEB-D10`. El único `AGENTS.md` tracked es el raíz.
- Autorización de Nico (2026-10-21): crear este documento de auditoría y planificación. Sin commit, push ni PR. Sin modificar documentos rectores, untracked, stashes ni worktrees. Sin implementar mejoras productivas. Sin iniciar C25 ni C26.
- Riesgo: R0 (lecturas de Git, GitHub y código) y R1 docs-only (este archivo). No hay R2 ni R3.
- Fuentes:
  - `AGENTS.md` (raíz).
  - Rector: `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` (§38, §46, §50, §54–§58, §62, §63).
  - Referencia Drive: `docs/audit/GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md` (`PROPOSED`; §II, §IV–§VI, §X, §XIV).
  - Propuesta v2: `docs/audit/PROPUESTA_EVOLUCION_DASHBOARD_VETNEB_DESDE_DRIVE.md`, leída con `git show` desde `origin/docs/dashboard-drive-evolution-proposal@6ac9695d`. No está en `main` y no tiene PR.
  - Actas: `dashboard-c25-microgeometry.md`, `dashboard-bug03-semantic-search-landmarks.md`, `dashboard-drv03-forced-colors-overlay-focus.md`, `dashboard-drv02-skip-to-content.md`.
- Método: cada estado se verificó en `main@ca032b1a` (con `git grep` y `git show`) y en GitHub (con `gh pr view`, `gh pr list` y `gh run list`). Un estado que viene de un acta y no se pudo reverificar se marca como tal.
- Excluido: implementación, CSS, tests, fixtures, baselines, catálogo E2E, backend, dependencias, CI, la propuesta v2, la referencia Drive, el rector, `docs/audit/README.md` y `docs/SOURCES_OF_TRUTH.md`.

## 1. Matriz DRV-01 a DRV-13

Los IDs `DRV-nn` son **hallazgos** de la propuesta v2 (§10). Los IDs `PR-DRV-nn` son **PRs propuestas** (§15). Las dos numeraciones no coinciden.

| Hallazgo | Tema | Decisión v2 | PR asociada | Estado real en `main@ca032b1a` |
| --- | --- | --- | --- | --- |
| DRV-01 | Columnas de tabla por viewport, no por contenedor | Investigar (medir antes) | PR-DRV-07 (tramo C) | **ABIERTO**: 0 `@container` |
| DRV-02 | Columnas fijas en la cuadrícula C24 | Investigar; después de C26 | PR-DRV-08 (tramo C) | **ABIERTO**: 3 / 3 / 2 columnas fijas |
| DRV-03 | Filtros aplicados invisibles entre 768 y 1279 px y en móvil (S2/S3) | Diferir después de C26 | PR-DRV-06 (tramo C) | **ABIERTO** |
| DRV-04 | Chips de filtros activos en S6/S7 | Diferir; D-03 | — | **ABIERTO** (sin decisión D-03) |
| DRV-05 | `role="search"` en S1–S7 y `aria-label` inválido en S5 | Adoptar antes de C26 | PR-BUG-03 (alcance reducido por la v2) | **IMPLEMENTADO en el alcance v2** (#1899). PR-BUG-03 en el alcance del rector: **PARCIAL** (P2-05 abierto; ver §2) |
| DRV-06 | `ActionMenu` de un solo ítem que duplica «Ver» | Decisión D-04; después de C26 | PR-DRV-09 (tramo C) | **ABIERTO** |
| DRV-07 | Truncados sin valor completo (C25 F-T1..F-T7) | Diferir; D-06 | PR-DRV-05 (F-T1), PR-DRV-10 (F-T2..F-T7) | **ABIERTO** |
| DRV-08 | Enlace de salto en el dashboard | Conveniente antes de C26 | PR-DRV-02 | **IMPLEMENTADO** (#1900) |
| DRV-09 | Foco invisible en forced-colors en portales a `body` | Obligatorio antes de C26 | PR-DRV-03 | **IMPLEMENTADO** (#1898) |
| DRV-10 | Panel de detalle lateral B16 sin consumidor | Diferir (depende de DRV-01) | — | **ABIERTO** (0 consumidores) |
| DRV-11 | Interlineado y hover de los tokens frente a §45.2 | Diferir; D-08 | — | **ABIERTO** (divergencia documental) |
| DRV-12 | App bar de 68.11 px a 1280 × 720 (B3) | Correctivo separado; D-05 | B3 | **ABIERTO** |
| DRV-13 | Deuda geométrica C25 (D5, D6, D7, D8) | Diferir; D-07 | D7 con R13 propia | **ABIERTO**; D8 BLOCKED |

Recuento: 3 implementados, 10 abiertos. Los tres implementados son exactamente los tres que la v2 situaba antes de C26 (§15.2 y §15.3). Ningún abierto es prerrequisito de C26 según la v2. Los prerrequisitos reales de C26 no son DRV (§7.1, §8).

**PR-BUG-03: alcance v2 frente al del rector.** El rector (§55) asigna a PR-BUG-03 tres hallazgos: P2-04 (`aria-label` sobre `div` sin rol), P2-18 (sin `role="search"`) y P2-05 (sin `aria-describedby` ni live region de conteo; rector §38, líneas 1539-1541). La v2 (R-03) excluyó P2-05 por considerarlo cubierto, y #1899 cerró sólo P2-04 y P2-18. P2-05 sigue parcial (§2). Por eso DRV-05 está implementado y PR-BUG-03 **no** está completo.

Los diez abiertos no tienen la misma naturaleza:

| Naturaleza | Hallazgos | Qué los desbloquea |
| --- | --- | --- |
| Hipótesis que hay que medir | DRV-01, DRV-02, DRV-03 | Sonda (ex PR-DRV-04) |
| Esperan una decisión funcional | DRV-04 (D-03), DRV-06 (D-04), DRV-07 (D-06) | Decisión de Nico |
| Diferido por diseño | DRV-10 | Resultado de DRV-01 |
| Divergencia documental, sin defecto demostrado | DRV-11 | D-08 |
| Correctivo del rector, no una mejora DRV | DRV-12 (B3) | D-05 y R13 |
| Deuda de C25 tras R13 o C05 | DRV-13 (D5–D8) | D-07, R13, C05 |

## 2. Estado real de cada mejora contrastado con `main`

| Hallazgo | Evidencia en `main@ca032b1a` |
| --- | --- |
| DRV-01 | `git grep "@container\|container-type" frontend/src` devuelve 0 resultados. Hay columnas reveladas por viewport (`md:`/`lg:`/`xl:`/`2xl:table-cell`) en cinco tablas: `AdminAuditDenseTable.tsx` (4), `AdminParticularTokensCard.tsx` (4), `AdminReportsCard.tsx` (4), `AdminSessionsReadOnlyCard.tsx` (4) y `AdminUsersRolesReadOnlyCard.tsx` (2). Es el mismo censo que la v2 |
| DRV-02 | `ContentGrid columns={3}` en `AdminReportsCard.tsx:778` y `AdminClinicsManagementCard.tsx:760`; `columns={2}` en `InformesReportsList.tsx:739`. Las filas son `collectionGridRows(effectiveLimit, n)` |
| DRV-03 | S3: los chips están dentro de `hidden min-w-0 flex-1 xl:flex` (`AdminReportsCard.tsx:697-699`) y se repiten en el `AdvancedFilterSheet` (`:735`). S2: el mismo envoltorio `xl:flex` (`AdminParticularTokensCard.tsx:1380-1382`), sin sheet. No hay recuento de filtros aplicados en ningún disparador |
| DRV-04 | `<ActiveFilterChips` sólo tiene 3 usos productivos, todos en S2/S3. S6 y S7 no tienen ninguno |
| DRV-05 | `role="search"` en S1 `AdminAuditFilterBar.tsx:61`; S2 `AdminParticularTokensCard.tsx:990,1387`; S3 `AdminReportsCard.tsx:551`; S4 `AdminClinicsManagementCard.tsx:537,689`; S5 `AdminUsersRolesReadOnlyCard.tsx:420,724`; S6 `ClinicInformesWorkspaceSummary.tsx:222`; S7 `ClinicParticularTokensCard.tsx:750`. Se conservan los de `informes/page.tsx:176` y `AdminReportsUploadPanel.tsx:254`. El `aria-label` de S5 ya está sobre un elemento con rol |
| DRV-06 | `AdminReportsCard.tsx:801-802` (tarjeta) y `:897-898` (tabla): `ActionMenu` `hidden xl:inline-flex`, cuyo único `ActionMenuItem` es «Ver detalle» → `openReportDetail` |
| DRV-07 | F-T1: la tabla de escritorio de `logistica/visitas/page.tsx` trunca dirección (`:225`, `max-w-[180px]`) y notas (`:241`, `max-w-[150px]`) sin detalle. `FieldVisitDetailDialog` sólo se monta en la lista móvil (`:179`). F-T2..F-T7: sin cambios desde el acta C25 (no se tocaron sus owners) |
| DRV-08 | `DashboardShellRouter.tsx:8,31` monta `SkipToContent`. `id="main-content"` en `admin/page.tsx:756`, `ClinicDashboardShell.tsx:93` **y** `dashboard/error.tsx:25` (ver §14, divergencia 1) |
| DRV-09 | El bloque `dashboard-drv03-forced-colors-overlay-focus` está en `styles/dashboard/interactions.css:98-128` y está dentro de `@media (forced-colors: active)` |
| DRV-10 | `ModuleSurface.tsx:38` declara `details?: ReactNode`. `git grep "details={"` en `frontend/src` devuelve 0 consumidores |
| DRV-11 | `tokens.css:135` `--dash-state-hover-opacity: 0.06` (claro), `:228` `0.10` (oscuro); `:186` `--dash-text-body-size: 0.8125rem`; `:188` leading `1.25`. Rector §45.2: 8 % y 13/20 |
| DRV-12 | `frontend/e2e/fixtures/dashboard-geometry-baseline.ts` contiene 42 apariciones de `68.11`. El escalón `@media (max-height: 760px)` está en `responsive.css:107` y otros cinco puntos |
| DRV-13 | Sin cambios de runtime en navegación móvil, gaps ni táctiles desde #1891. D5/D6/D7 son los del acta C25; D8 depende de C05 (BLOCKED, rector §50) |

**P2-05 (anuncio de conteo), independiente de DRV-05.** `CollectionPager` (`DashboardPager.tsx:166`) anuncia siempre en la variante `compact` (`:197`, exige `total`). En las demás variantes sólo anuncia cuando recibe `rangeLabel` (`:228-230`). Ninguno de los owners de S2, S3 y S4 pasa `rangeLabel` (`git grep rangeLabel` en `app/dashboard/admin/` sólo encuentra Sesiones, Usuarios y roles, Intentos fallidos y los módulos móviles de operaciones). Esto confirma el acta PR-BUG-03: P2-05 está **parcial**, y la afirmación R-03 de la v2 («cubierto por los pagers») no se sostiene para S2/S3/S4.

## 3. Evidencias de la referencia Drive

Cada fila cita la referencia (`GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md`) con su estado de evidencia. Los valores INFERIDO o NO RESUELTO sólo admiten `NO_COMPARABLE` (Drive §XIII.1).

| Hallazgo | Evidencia Drive | Estado de la evidencia | Peso para VETNEB |
| --- | --- | --- | --- |
| DRV-01 | §VI.1: umbrales de tabla 744 / 832 / 1126 px de **contenedor**. §VI.4: con el viewport fijo en 1440 × 900, ocultar el rail ensancha la tabla de 1087 a 1127 px y las columnas pasan de 140/140/88/48 a 215/215/88/192 | DERIVADO por prueba controlada | Demuestra el mecanismo, no el problema en VETNEB. El truncado VETNEB entre 1024 y 1440 px **no está medido** |
| DRV-02 | §V.3: 6/5/4/4/3/2 columnas a 1920/1536/1440/1366/1280/1024; regla `floor((w + 16) / 236)`, gap 16 px | Regla DERIVADA en 7/7 anchos | Referencia de proporción. La v2 rechaza `auto-fit` porque rompe `collectionGridRows` |
| DRV-03, DRV-04 | §II.1: toolbar de filtros `div[role=toolbar]` 456.53 × 40 en y = 131, invariante en 11 resoluciones (§II.4). §IV.7: chips de 32 px, radio 8, separación 8 px | OBSERVADO | El estado del filtro está siempre a la vista. VETNEB lo oculta bajo 1280 px |
| DRV-05 | §X.1: 1 landmark `search`; §II.1: `form[role=search]` | Comprobado por recuento | Cerrado en VETNEB: 1 landmark nombrado por barra |
| DRV-06 | §IV.5: 6 / 2 / 1 botones por fila según el contenedor (≥ 1127, 745–1126, ≤ 744 px); `aria-haspopup` = `menu` en el botón de menú | OBSERVADO | El menú de fila agrupa acciones secundarias **reales**. En VETNEB duplica la primaria |
| DRV-07 | §IV.4: `text-overflow: ellipsis` sin mecanismo de valor completo evaluado | OBSERVADO (estilo) | **No es modelo**: PR-TRUNC es más estricto que Drive |
| DRV-08 | §II.1 y §X.2: `div[role=navigation]` fuera de pantalla con 3 botones que aparecen en y = 4 al recibir foco | Comprobado | Cerrado en VETNEB con un botón y un destino |
| DRV-09 | §X.2: `:focus-visible` 60/60; anillo por outline 36/60. §VI.2: hay reglas `(forced-colors: active)`, pero su efecto no se evaluó (§X.5) | Comprobado / no evaluado | VETNEB ya supera la evidencia de Drive en forced-colors (outline real medido por E2E) |
| DRV-10 | Panel de detalle A4 NO RESUELTO (§XIV.5 punto 1); el rector deriva 336 px | NO RESUELTO | NO_COMPARABLE |
| DRV-11 | §III.6: 14 / 400 / 20; hover 8 % (§IV.3, §IV.4) | OBSERVADO | Coincide con el 8 % de §45.2, no con el token de 6 % |
| DRV-12 | §II.4: header de 64 px invariante en 11 resoluciones | OBSERVADO | VETNEB es 55.33 px, salvo 68.11 a 1280 × 720 |
| DRV-13 | §X.4: 223 de 322 controles entre 24 y 43 px, **sólo escritorio**; §VI.5: no hay layout móvil | OBSERVADO | No aporta evidencia móvil: no cambia la prioridad de D5–D7 |

**Contradicciones Drive ↔ rector que siguen abiertas** (Drive §XIV.4): buscador 722 vs 834 px e input 616 vs 728 px. Ninguna bloquea una decisión de este documento: el buscador de la app bar de VETNEB navega módulos, no contenido.

## 4. Estado de las PRs

Lectura de GitHub del 2026-10-21 (`gh pr view` / `gh pr list` / `gh run list`).

### 4.1 Fusionadas, relevantes para DRV y C26

| PR | Título | Head | Merge commit | `mergedAt` (UTC) |
| --- | --- | --- | --- | --- |
| #1891 | C25 partial focus and typography hardening | `feat/dashboard-c25-microgeometry-post-c16` | `b06f75c0` | 2026-10-19T04:16:13Z |
| #1892 | docs(audit): archive Google Drive UI research reference | `docs/google-drive-ui-reference-archive` | `d1283a4f` | 2026-10-19T13:40:48Z |
| #1897 | C23b PR5 S6 informes — R13 completa | `feat/dashboard-c23b-pr5-clinic-informes-s6` | `9dfb5024` | 2026-10-20T23:26:42Z |
| #1898 | DRV03 forced-colors overlay focus | `fix/dashboard-drv03-forced-colors-overlay-focus` | `ceb77bd3` | 2026-10-21T12:01:10Z |
| #1899 | BUG03 semantic search landmarks | `fix/dashboard-bug03-semantic-search-landmarks` | `a696daec` | 2026-10-21T17:41:53Z |
| #1900 | DRV02 skip to content | `fix/dashboard-drv02-skip-to-content` | `ca032b1a` | 2026-10-21T22:46:14Z |

### 4.2 Abiertas

| PR | Título | Relación |
| --- | --- | --- |
| #1874 | chore(deps): npm-frontend-low-risk (5 updates) | Dependabot. Fuera de scope; R2 |
| #1869 | chore(deps): github-actions-low-risk (4 updates) | Dependabot. Fuera de scope; R2 |

No hay ninguna PR abierta de DRV, C25 o C26. Tampoco hay ninguna PR, abierta o cerrada, desde `docs/dashboard-drive-evolution-proposal` ni con «C26» en el título.

### 4.3 CI de `main` posterior a C23b

| Commit | Backend CI | Frontend CI |
| --- | --- | --- |
| `9dfb5024` (#1897) | success | success |
| `ceb77bd3` (#1898) | success | **failure** (run `39596304982`: `frontend-heavy-validation` y `validate-frontend`) |
| `a696daec` (#1899) | success | success |
| `ca032b1a` (#1900) | success | success (run `39688878126`, relectura del 2026-10-21) |

El fallo de `ceb77bd3` está en `frontend-heavy-validation` (y por arrastre en `validate-frontend`): un único test falló, `e2e/regression/dashboard-c23-responsive-integral.spec.ts:213`, «C23a · phone overlays of the shell › an open overlay closes when the viewport leaves the phone» (`1 failed` en el log del run `39596304982`). No es el C-11 #32 que registra el acta PR-BUG-03, que afectó a otro head y otro spec. El commit siguiente (`a696daec`) pasó sin cambios en ese spec, lo que apunta a un fallo intermitente. Esta auditoría no lo diagnosticó. C26 no debe tomar ninguno de estos runs como evidencia: su validación corre sobre su propio head (AGENTS §5.7).

### 4.4 Pendientes (sin PR)

| Elemento | Tipo | Bloqueo |
| --- | --- | --- |
| G11 (correctivos + cobertura 21 × 2) | Prerrequisito de C26 | Inventario §17 |
| C26 | Slot del rector | G11, D-11, D-01(c); D-12 para G12 |
| Propuesta v2 | Docs, `PROPOSED` | Sin PR; su adopción como documento es decisión de Nico |
| Corrección documental D-09 | Docs | Toca el rector y su índice: necesita autorización propia |
| PR-DRV-05 a PR-DRV-10, B3, D7 | Tramo C | Decisiones D-03 a D-07, sonda y R13 (§10) |
| P2-05 en S2/S3/S4 | Correctivo de accesibilidad | Decisión de qué anunciar por variante (acta PR-BUG-03) |

## 5. Diferencias funcionales y visuales que siguen abiertas

Esta tabla lista sólo las diferencias que **no** son intencionales. Las ocho diferencias intencionales de la v2 §8 se mantienen: fila de 36 px, drawer/rail en lugar de sidebar fija, sin rail derecho, paginación adaptativa, detalle en diálogo, tabla semántica, identidad visual y buscador de módulos.

| # | Diferencia | Tipo | Viewports | Origen | Hallazgo |
| --- | --- | --- | --- | --- | --- |
| F1 | Filtros aplicados no visibles en S2/S3 bajo 1280 px; S2 no los muestra en ningún sitio | Funcional (estado) | 360–1279 | §2 DRV-03 | DRV-03 |
| F2 | S6/S7 sin chips de filtros activos | Funcional | Todos | §2 DRV-04 | DRV-04 |
| F3 | Siete truncados sin valor completo (F-T1..F-T7) | Funcional (información) | Según superficie | Acta C25 §2.1 | DRV-07 |
| F4 | Menú de fila de Informes admin sin acción secundaria | Funcional (teclado) | ≥ 1280 | §2 DRV-06 | DRV-06 |
| F5 | P2-05: S2/S3/S4 sin anuncio de conteo o de página | Accesibilidad | Todos | §2 | PR-BUG-03 del rector (la v2 y #1899 lo excluyeron) |
| V1 | Columnas por viewport con discontinuidad del contenedor en 1279 → 1280 (`main` 1200 → 1025, DERIVADO de A02 en la v2) | Visual / densidad | 1024–1440 | §2 DRV-01 | DRV-01 |
| V2 | Tarjetas de cuadrícula anchas a 1920 (3 columnas) | Visual | ≥ 1440 | §2 DRV-02 | DRV-02 |
| V3 | App bar de 68.11 px a 1280 × 720 (+12.11 px sobre §46) | Visual / geometría | 1280 × 720 | A02 | DRV-12 |
| V4 | Etiqueta 9.6/9.6 de la barra móvil, gaps de 6 px, 1 151 táctiles < 44 px | Visual / accesibilidad móvil | < 768 | Acta C25 D5–D7 | DRV-13 |
| V5 | Fila de 36 px (§46: 40) | Geometría | Todos | C05 BLOCKED | DRV-13 (D8) |
| V6 | Hover del 6 % frente al 8 % de §45.2 | Visual | Todos | `tokens.css:135` | DRV-11 |

## 6. Estado y deuda técnica de C25

**C25 = PARTIAL** (acta C25 §10, #1891). Estado verificado en `main@ca032b1a`:

| ID | Estado al fusionar C25 | Estado actual | Evidencia |
| --- | --- | --- | --- |
| D1 | Corregido en el shell | Corregido; además, **cerrado en los overlays portados a `body`** | #1898, `interactions.css:98-128`. El acta DRV-03 midió 25 controles en RED y 0 en GREEN |
| D2 | Corregido (PR-BUG-02 absorbido) | Corregido | #1891 |
| D3 | Sin desviación | Sin desviación | Acta C25 |
| D4 | F-T1..F-T7 sin mecanismo | **Abierto** | §2 DRV-07 |
| D5 | Etiqueta 9.6/9.6 | **Abierto** (A02 `bottomNav` / A03, R13) | Acta C25 |
| D6 | Gaps de 6 px | **Abierto** (A03, R13) | Acta C25 |
| D7 | 1 151 táctiles < 44 px | **Abierto** (A02/A03, R13) | Acta C25 |
| D8 | Fila 40, cabecera 36, pager 40 | **BLOCKED** por C05 | Rector §50, §60 |
| C23b | Abierto | **Cerrado**: `C23B_BAND_LEDGER` y `C23B_WIDE_LEDGER` vacíos | `dashboard-c23-responsive-integral.test.ts:459-460`, #1897 |
| Portales a `body` | Pendiente | **Cerrado** | #1898 |

**Lectura.** C25 tiene cerrado todo lo que no mueve geometría. Lo que queda (D4–D8) exige un cambio funcional, R13 o la salida de C05. Ninguno se resuelve sin una autorización que hoy no existe. C25 seguirá PARTIAL al iniciar C26: eso es exactamente la decisión D-11.

## 7. Precondiciones de D-11 y D-12

**Procedencia de las decisiones.** D-01, D-11 y D-12 sólo existen en la propuesta v2 (§19). La v2 está `PROPOSED`, no está en `main` y no tiene PR. El rector no define decisiones D-xx. Esto tiene dos consecuencias:

- D-11 deja de lado una dependencia literal del rector (§50: C26 → C25). Si Nico la aprueba, la decisión debe quedar **registrada por escrito** (en el acta de C26 o en una enmienda docs-only del rector). Una aprobación en el chat no deja traza en el repositorio.
- D-01(c) coincide con el texto literal de §54 («Gates de §58 verdes»). No reescribe ningún criterio.

Las dos son independientes: se puede aprobar una sin la otra.

| | D-11 | D-01(c) |
| --- | --- | --- |
| Qué decide | **Iniciar** C26 con C25 en PARTIAL | **Cerrar** C26 contra §58, con el acta de §62 aparte |
| Relación con el rector | Excepción a §50 | Lectura literal de §54 |
| Fuente | v2 §19.2 (`PROPOSED`) | v2 §19.1 (`PROPOSED`) |

### 7.1 D-11 — Iniciar C26 con C25 en PARTIAL

El rector declara C26 → C25 (§50, §54). La v2 recomienda iniciar C26 **después de PR-DRV-03**, con D5–D8 registrados como deuda. D-11 resuelve sólo la dependencia de C25. **No** resuelve G11, que el rector exige «antes de C26» (§58) y que hoy bloquea el inicio (§8).

| Precondición | Estado | Evidencia |
| --- | --- | --- |
| PR-DRV-03 fusionada (residual de portales de C25) | CUMPLIDA | #1898 MERGED |
| PR-BUG-03 fusionada (correctivo obligatorio de la v2) | CUMPLIDA | #1899 MERGED |
| PR-DRV-02 fusionada (conveniente) | CUMPLIDA | #1900 MERGED |
| C23b cerrado (G9) | CUMPLIDA | Ledgers vacíos (§6) |
| Deuda C25 (D4–D8) registrada con owner y salida | CUMPLIDA en el acta C25 §9 y en §6 de este documento | — |
| **Decisión explícita de Nico** de aceptar C26 → C25 PARTIAL | **PENDIENTE** | Sin registro |
| G11 en PASSED (rector §58, «antes de C26»; no es una precondición de D-11, pero sí del inicio de C26) | **NOT_RUN**, con una violación seria ya conocida | §8 |

D-11, considerada aislada, no tiene bloqueo técnico: sólo falta la decisión. El **inicio de C26** sigue bloqueado por G11 aunque D-11 se apruebe.

### 7.2 D-12 — G12 de staging (R3)

| Precondición (rector §58 G12, AGENTS §3.1, §17) | Estado |
| --- | --- |
| C26 completo (G12 es «tras C26») | PENDIENTE |
| Entorno de staging nombrado y confirmado como no productivo | **BLOCKED**: no hay entorno nombrado en ninguna autorización |
| Deploy Live sobre el commit exacto de C26 | PENDIENTE (no existe el commit) |
| Tenants y usuarios de prueba controlados (Clinic A / B), nunca datos de una clínica real | **BLOCKED**: sin datos de prueba declarados |
| Protocolo de evidencia sanitizada (acta mínima de AGENTS §17) | Definido por política; sin ejecución |
| Ventana de observación de 48 h de 4xx/5xx y su fuente de métricas | **BLOCKED**: `docs/ops/METRICS_BASELINE.md` es documental, sin colectores ni alertas (AGENTS §16) |
| **Delegación R3 específica de Nico** (entorno, target, operador) | **PENDIENTE** |

Sin esa delegación, G12 queda **BLOCKED**. La v2 (D-01(c) punto 1) concluye que entonces C26 no se puede declarar completo.

**Tensión interna del rector, sin resolver.** §54 cierra C26 con «Gates de §58 verdes», pero §58 programa G12 «Tras C26». Las dos lecturas son posibles:

- G12 forma parte del cierre de C26. Entonces C26 no cierra sin la operación R3.
- G12 es posterior al cierre de C26. Entonces C26 cierra con G11 y G12 queda como gate de rollout.

La v2 adopta la primera sin señalar el conflicto. Elegir la lectura es una decisión de Nico, que debe registrarse junto con D-01(c).

## 8. Gates G11 y G12

| Gate | Condición (rector §58) | Cuándo | Estado | Evidencia disponible en `main` |
| --- | --- | --- | --- | --- |
| G9 | Chrome ≤ 240 px a 1920 y ≤ 32 % en 768–1366 | Antes de C17 | PASSED (por guard) | Ledger C23b vacío |
| G10 | Piloto cerrado | Antes de C18 | Registrado como cerrado (acta C17, #1881), con sus límites | — |
| **G11** | axe sin violaciones críticas ni serias **en ambos temas** | **Antes de C26** | Gate formal NOT_RUN. Inventario local 21 × 2: **FAILED** (5 defectos reales, cobertura incompleta en clinic-tokens) | Ver abajo y §17 |
| **G12** | Staging, tenants de prueba, evidencia sanitizada, 48 h sin incremento de 4xx/5xx | **Tras C26** | **BLOCKED** (§7.2) | Ninguna |

**Cobertura axe actual (censo estático):**

- `@axe-core/playwright` `^4.13.0` está declarado en `frontend/package.json`.
- 17 specs usan `AxeBuilder`. 16 son del dashboard: B11, C10–C15, C24, C17–C22 y el orden de Clínicas. La 17.ª es la PWA pública.
- Los specs de lote C17–C22 acotan axe al módulo con `include(...)` y fallan sólo con violaciones `critical` o `serious`.
- `accessibility-axe-key-routes.spec.ts` (cohorte `extended`) cubre 4 rutas: `/`, `/login`, `/dashboard` y `/dashboard/admin`. Usa 2 viewports (1440 × 900 y 390 × 844), las etiquetas `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`, y exige 0 violaciones de cualquier impacto.
- **Ningún spec combina axe con el tema oscuro**: hay 0 archivos que contengan `AxeBuilder` y además `dark-gray` o `colorScheme: "dark"`.
- **Hay una regla desactivada como preexistente.** `clinic-c22-batch-2.spec.ts:258-259` desactiva `aria-progressbar-name` en `/dashboard/logistica/rutas` («Pre-C22 finding, outside this scope»). El acta C22 (línea 71) la califica de **seria**. El marcado sigue sin nombre en `main`: `logistica/rutas/page.tsx:252` (`role="progressbar"` con `aria-valuenow/min/max` y sin `aria-label` ni `aria-labelledby`). Lo mismo ocurre en `RoutePlanDetailDialog.tsx:70`. En cambio, `metricas/page.tsx:321` y `RoutePlanMetricDetailDialog.tsx:112` sí lo nombran.

**Consecuencia.** La cobertura actual es **parcial**: módulo por módulo, en tema claro, con viewports puntuales. No existe la matriz de 21 superficies × 2 temas. G11 está **NOT_RUN**. Además, ya hay una violación seria conocida que haría fallar G11 en `clinic-log-rutas`.

**G11 es un prerrequisito de C26, no una fase de C26.** El rector lo programa «Antes de C26» (§58). La cobertura 21 × 2 y los correctivos que revele van **antes** de iniciar C26 (§10). El inventario local de esa cobertura está en §17.

## 9. Requisitos de validación de C26

C26 es el nivel 13 del rector (§50, §54): «suite + axe + performance», cierre «Gates de §58 verdes». Contenido por dimensión y disponibilidad actual:

| Dimensión | Requisito del rector | Herramienta en `main` | Estado previsto |
| --- | --- | --- | --- |
| Regresión visual (§56.5, §57) | 21 superficies × 13 viewports × 2 temas × 9 estados = 4 914 capturas; aprobación manual lado a lado; artefactos fuera de `docs/` y de `test-results/` | `e2e:visual-linux`, `e2e:compare-visual-artifacts`, `e2e:visual-production-candidate`; A02/A08 como contratos geométricos | Ejecutable sólo en Linux/CI para los baselines Linux. En win32 está registrado como BLOCKED (memoria de proyecto; no reverificado aquí). Requiere decidir el subconjunto de estados que se aprueba (las 4 914 no tienen baseline) |
| Accesibilidad (§56.6) | axe en 21 × 2 temas; roles; etiquetas; orden de Tab; foco en forced-colors; contraste ≥ 4.5:1 y ≥ 3:1; táctiles ≥ 44 px; `prefers-reduced-motion`; anuncio de conteo por live region | Axe parcial (§8); forced-colors en 2 specs (DRV-02, DRV-03); `reducedMotion` en 35 specs | G11 NOT_RUN. Táctiles: **FAILED conocido** (D7, 1 151). Anuncio de conteo: **parcial** (P2-05 en S2/S3/S4) |
| Rendimiento (§56.7) | Re-renders, hidratación, layout shift, `ResizeObserver`, peso CSS, long tasks, peticiones de paginación por cambio de viewport, 768 × 600 | Ningún spec usa `PerformanceObserver`, `layout-shift`, `longtask` ni tracing (0 archivos en `frontend/e2e`) | **NOT_AVAILABLE**: hay que construir la sonda dentro de C26, sin nueva dependencia (Playwright ya expone CDP y tracing) |
| Contratos | A01, A02 21/21, A03 195/195 + 234/234, A05 15/15, A08 21/21 | Existen | Deben seguir en PASSED sobre el head de C26 |
| Gates estáticos (AGENTS §6, frontend) | `lint` → `typecheck` → `build` → `security:public-surface` | Existen | Obligatorios |
| Cohortes | Mínima suficiente por paths, con la pertenencia verificada en `frontend/e2e/suites/catalog.ts` | `visual-contract`, `admin-mobile`, `extended` | `e2e:full` sólo con pedido explícito de Nico |
| Required checks | `validate-pr-governance`, `qga-workflow-security`, `validate-backend`, `validate-frontend` en SUCCESS sobre el head de C26 | Configuración efectiva de GitHub | Sólo del head propio (AGENTS §5.7) |
| Cierre | Por gate de §58 con estado canónico (D-01(c)); acta de programa §62 aparte y sin reescribir criterios | — | §62.15 (G11), §62.16 (FAILED, D7), §62.17 (FAILED, C05/B3) se registran tal cual |

**Alcance de «axe» en C26 frente a §56.6 (depende de D-01(c)).** §54 resume las pruebas de C26 como «suite + axe + performance». §56.6, en cambio, enumera más que axe. Incluye objetivos táctiles ≥ 44 px, que hoy son **FAILED** (D7, 1 151 controles) y requieren R13, y el anuncio de conteo por live region, que hoy es **parcial** (P2-05 en S2/S3/S4). Si la validación de accesibilidad de C26 se lee como todo §56.6, C26 no puede pasar sin D7 y P2-05. Si se lee como los gates de §58 (D-01(c)), esos dos puntos se registran como FAILED o parcial en el acta de §62 sin bloquear C26. La lectura debe fijarse al decidir D-01(c).

**Validación mínima previa propuesta (sin escrituras):** antes de la primera PR de C26, Nico decide el subconjunto de estados de §57 que entra en la aprobación manual. Sin esa decisión, «regresión visual aprobada» no tiene un criterio medible.

## 10. Roadmap según la propuesta v2

La v2 (§15.6) fija tres PRs antes de C26 y difiere el tramo C. Su estado real:

| Tramo | Elemento | Orden v2 | Estado |
| --- | --- | --- | --- |
| A, obligatorio | PR-DRV-03 | 1 | MERGED (#1898; verificado por lectura de GitHub) |
| A, obligatorio | PR-BUG-03 (alcance v2) | 2 | MERGED (#1899); el alcance del rector sigue PARCIAL (P2-05) |
| B, conveniente | PR-DRV-02 | 3 | MERGED (#1900) |
| Decisiones previas a C26 | D-01(c), D-11, D-12 | — | **PENDIENTES** |
| Prerrequisito G11 (no estaba en la v2) | G11-a (nombres accesibles), G11-b (IDREF de `ModuleTabs`), G11-c (contraste), G11-d (cobertura 21 × 2) | — | **PENDIENTE**: inventario hecho (§17.8) |
| Nivel 13 | C26 | — | NOT_STARTED; bloqueado por G11 |
| C, después de C26 | PR-DRV-05 (F-T1) | — | Pendiente de D-06 |
| C | PR-DRV-06 (recuento de filtros S2/S3) | — | Pendiente de la sonda |
| C | PR-DRV-07 (container queries, tabla piloto) | — | Pendiente de la sonda con beneficio demostrado |
| C | PR-DRV-08 (cuadrícula por contenedor con alto mínimo) | — | Pendiente de la sonda |
| C | PR-DRV-09 (`ActionMenu` de Informes admin) | — | Pendiente de D-04 |
| C | PR-DRV-10 (F-T2..F-T7) | — | Pendiente de D-06 |
| C | B3 (app bar a 1280 × 720) | — | Pendiente de D-05 (R13) |
| C | D7 (táctiles ≥ 44 px) | — | Pendiente de D-07 (R13) |
| Docs | D-09 (registros desactualizados) | — | PR docs-only con autorización propia |

**Propuesta de secuencia** (derivada de §8, §9 y §17; no es una autorización).

**Pre-C26 · G11.** Una PR test-only que agrega specs que fallan no puede fusionarse, porque los required checks la bloquean. Por eso el orden es:

1. **Inventario RED local** de la cobertura axe 21 × 2. No se fusiona. Está ejecutado en §17.
2. **Correctivos**, uno por familia de violaciones (AGENTS §4). El primero ya está identificado: el nombre de `role="progressbar"` en Rutas.
   - Aceptación: la regla deja de reportarse en las combinaciones afectadas, y se retira el `disableRules(["aria-progressbar-name"])` de C22 sin debilitar nada más.
3. **PR de cobertura G11** (test-only), con el spec 21 × 2 en verde.
   - Aceptación: 42/42 combinaciones con 0 violaciones `critical`/`serious`, sin `disableRules` salvo excepción justificada por escrito.

**C26** (después de G11 y de D-11):

1. **C26-1 · Sonda de rendimiento (§56.7).** Test-only.
   - Aceptación: los registros de cada métrica de §56.7 por superficie quedan en un acta con su entorno. La sonda corre en la cohorte `evidence` o `extended`, fuera de `ci`.
   - No fija umbrales hasta tener una baseline. Puede absorber la sonda geométrica (ex PR-DRV-04) si Nico lo autoriza.
2. **C26-2 · Regresión visual (§57).**
   - Aceptación: el subconjunto de estados que Nico decida, ejecutado en Linux/CI y aprobado manualmente, con la lista de capturas aprobadas.
   - Sin la decisión del subconjunto, esta PR no tiene criterio medible.
3. **C26-3 · Acta de cierre de C26** contra §58 y acta de programa §62 sin reescribir criterios (D-01(c)).
4. **G12** sólo con la delegación R3 de D-12 y la lectura de la tensión §54/§58 (§7.2).

**Independencia.** La PR de cobertura G11 y C26-1 modifican los mismos archivos de catálogo y censo (`frontend/e2e/suites/catalog.ts`, `test/architecture/e2e-suite-catalog-completeness.test.ts`, `test/architecture/e2e-completeness-workflow.test.ts`). Por eso son **secuenciales**, no paralelas. Los correctivos de G11 dependen del inventario y son independientes entre sí si tocan owners distintos. La división de C26 en tres PRs sigue la regla de PR mínimo (AGENTS §4). Nico puede unificarlas si prefiere un C26 único; esa es una decisión de scope, no técnica.

## 11. Dependencias, riesgos y autorizaciones necesarias

### 11.1 Dependencias

| Elemento | Depende de | Tipo |
| --- | --- | --- |
| C26 (inicio) | D-11 **y** G11 PASSED (rector §58) | Decisión + gate |
| C26 (cierre) | D-01(c) y la lectura de G12 (§7.2) | Decisión |
| G11 | Inventario 21 × 2 (§17); correctivos; spec de cobertura en verde | Correctivos frontend + test-only |
| G12 | C26 en `main`; D-12 (R3); staging y tenants de prueba; fuente de métricas 4xx/5xx | Delegación R3 + entorno |
| Regresión visual | Runner Linux; decisión sobre el subconjunto de estados | Entorno / decisión |
| Tramo C | Sonda; D-03 a D-07; R13 por superficie | Evidencia / decisión |

### 11.2 Riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- | --- |
| RC-1 | axe en tema oscuro revela violaciones de contraste no medidas (rector §63) | Alta | Alto (bloquea G11) | Ejecutar C26-1 primero; cada familia de violaciones va en un correctivo separado; ningún `disableRules` sin justificación escrita |
| RC-2 | Declarar C26 completo con G12 sin ejecutar | Media | Crítico (cierre falso) | D-01(c): G12 BLOCKED impide declarar C26 completo |
| RC-3 | Reescribir §62 para cerrar el programa | Media | Alto | D-01(b) rechazada por la v2; acta de programa con estados canónicos |
| RC-4 | Fallos intermitentes de `validate-frontend` (C23a en `main@ceb77bd3`; C-11 #32 en el head de la PR #1899) contaminan la evidencia de C26 | Media | Medio | Validar sólo el head de C26; no reintentar a ciegas; diagnóstico separado si reaparece |
| RC-5 | La sonda de rendimiento introduce flakiness en las cohortes de CI | Media | Medio | Cohorte `evidence` o `extended`, fuera de `ci`, hasta tener baseline |
| RC-6 | La regresión visual de 4 914 capturas no es ejecutable con la RAM local (AGENTS §8) | Alta | Medio | Linux/CI; subconjunto decidido; una tarea pesada por vez |
| RC-7 | Actas desactualizadas frente al código (§14) inducen decisiones erróneas | Media | Medio | D-09 ampliado (§14) |
| RC-8 | Dependabot #1874 / #1869 se fusionan durante C26 y mueven el baseline | Baja | Medio | Capturar el head de C26 al iniciar; revalidar si `main` avanza |

### 11.3 Autorizaciones necesarias

| Autorización | Nivel | Actor |
| --- | --- | --- |
| D-11 (C26 con C25 PARTIAL) | Decisión de producto | Nico |
| D-01(c) (cierre de C26 contra §58; §62 en un acta aparte) | Decisión de gobierno | Nico |
| Correctivos de G11 y PR de cobertura 21 × 2 (pre-C26) | R1 por correctivo; R2 si tocan tokens globales | Nico autoriza; el agente ejecuta |
| Excepción escrita a una regla axe (`disableRules`) | Decisión | Nico |
| Subconjunto de estados para la regresión visual | Decisión | Nico |
| D-12 (G12 en staging) | **R3**, con entorno, target y operador nombrados | Nico, con delegación específica |
| Commit, push y PR de cada entrega | R2 (AGENTS §5.3) | Nico delega o ejecuta |
| D-09 (corrección documental del rector, de la referencia y del índice) | Docs-only sobre fuentes rectoras | Nico |
| Tramo C (D-03 a D-07, R13) | R1/R2 + R13 | Nico, por PR |

## 12. Delimitación de archivos para futuras PRs

Paths verificados en `main@ca032b1a`. Una PR por fila; ninguna fila mezcla scopes.

| PR futura | Scope | Archivos esperados | Fuera de scope |
| --- | --- | --- | --- |
| G11 · correctivos (pre-C26) | frontend, uno por familia | Ver §17.4 (archivos por violación); guard o E2E dirigido por correctivo | Mezclar familias; tocar tokens globales sin R2 |
| G11 · cobertura 21 × 2 (pre-C26) | test-only (E2E) | Spec nuevo en `frontend/e2e/platform/accessibility/`; `frontend/e2e/suites/catalog.ts`; censos de `test/architecture/e2e-suite-catalog-completeness.test.ts` y `test/architecture/e2e-completeness-workflow.test.ts`; reutiliza `frontend/e2e/helpers/dashboard-geometry-matrix.ts` y `frontend/e2e/helpers/session.ts`; retirar `disableRules` de `clinic-c22-batch-2.spec.ts:259` | Código productivo, fixtures A02/A03 |
| C26-1 sonda de rendimiento | test-only | Spec nuevo en la cohorte `evidence` o `extended`; catálogo y censos (en serie con la de cobertura); acta | Umbrales en `ci` sin baseline |
| C26-2 regresión visual | test-only + artefactos fuera del repo | Specs `visual-linux` existentes; `e2e/scripts/compare-visual-artifacts.mjs` (sólo uso) | Aprobación automática |
| C26-3 acta de cierre | docs-only | `docs/implementation/dashboard-c26-validation-rollout.md` | Editar §58 o §62 |
| D-09 | docs-only | `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` (§50, §54, bloque de actualizaciones), `docs/audit/GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md:21`, `docs/audit/README.md`; actas con desvíos de §14 | Código |
| PR-DRV-05 (F-T1) | frontend | `frontend/src/app/dashboard/logistica/visitas/page.tsx`; `FieldVisitDetailDialog.tsx` (sólo reutilización); guard C22 | Otras rutas de Logística |
| PR-DRV-06 | frontend | `AdminReportsCard.tsx`, `AdminParticularTokensCard.tsx`; guards C17/C18; A01 | Chips en 768–1279 sin medición |
| PR-DRV-07 | frontend | `AdminReportsCard.tsx` (tabla piloto); CSS de dashboard si hace falta la declaración de contenedor | `components/ui/table.tsx` (guard C01) |
| PR-DRV-08 | frontend | `frontend/src/features/dashboard/presentation/surfaces/ContentGrid.tsx` y `frontend/src/features/dashboard/presentation/surfaces/collection-view.ts`; los tres consumidores (§2 DRV-02); guard C24 | `auto-fit` |
| PR-DRV-09 | frontend | `AdminReportsCard.tsx:801-802,897-898`; guard C17 | Endpoints y descriptores firmados nuevos |
| P2-05 S2/S3/S4 | frontend (accesibilidad) | `AdminParticularTokensCard.tsx`, `AdminReportsCard.tsx`, `AdminClinicsManagementCard.tsx` (pasar `rangeLabel` o una live region propia); `DashboardPager.tsx` sin cambios | Cambiar la paginación |
| B3 / D7 | frontend + R13 | `styles/dashboard/responsive.css` (escalón `max-height: 760px`), `navigation.css`, módulos móviles; baselines A02/A03 con autorización | Mezclarlas entre sí o con C26 |

## 13. Próxima acción concreta

1. **Resolver G11 antes de C26**: aplicar los correctivos del inventario de §17, uno por familia, y luego la PR de cobertura 21 × 2 en verde. Es trabajo previo a C26 y no necesita D-11.
2. **En paralelo, Nico decide** D-11, D-01(c) y la lectura de G12 (§7.2), y deja la decisión registrada por escrito.
3. Con G11 en PASSED y D-11 aprobada, C26 puede iniciarse.
4. D-12 (R3) sólo se ejecuta después de C26.

## 14. Divergencias documentales detectadas (reportadas, no corregidas)

| # | Documento | Registro | Realidad verificada | Impacto |
| --- | --- | --- | --- | --- |
| 1 | `docs/implementation/dashboard-drv02-skip-to-content.md` (líneas 9 y 108) | «`dashboard/error.tsx` excluido; renderiza su `<main>` sin `id`» | #1900 incluye el commit «keep skip target in error state»: `error.tsx:25` tiene `id="main-content"`, con guard | Medio: el riesgo residual que declara el acta ya está resuelto |
| 2 | Propuesta v2 §0 R-03 y §10 DRV-05 | «P2-05 cubierto por las live regions de los pagers» | S2/S3/S4 no pasan `rangeLabel` (§2). Coincide con el acta PR-BUG-03 | Medio: P2-05 es un requisito de §56.6 que C26 debe evaluar |
| 3 | Propuesta v2 §10 DRV-09 y acta C25 §8 | `UploadReportModal` está entre los overlays afectados | 0 consumidores productivos de `<UploadReportModal` (lo corrigió el acta DRV-03) | Bajo |
| 4 | Acta C25 §Dependencia y §9 | «C23b sigue abierto» | Ledgers vacíos tras #1897 | Bajo: histórico |
| 5 | `GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md:21` | «PR #1892 (abierta)» | MERGED, `d1283a4f` | Bajo (D-09 #1) |
| 6 | Rector §50 (`:1833`) y §54 | C04 «IN_PROGRESS … READY_FOR_IMPLEMENTATION» | C04 completo (#1822, #1825) | Alto: invita a reimplementar (D-09 #2) |
| 7 | Rector §50 (`:1837-1855`) | C08–C26 sin estado | Ver §4 y v2 §4.2; C25 = PARTIAL | Medio (D-09 #3) |
| 8 | Propuesta v2 | `PROPOSED`, sólo en una rama remota sin PR | — | Medio: el roadmap que este documento sigue no está en `main` |

Ninguna se corrige aquí: tocar el rector, la referencia Drive o la propuesta está fuera de la autorización. Las cuatro primeras amplían D-09.

## 15. Validaciones de este documento

| Gate (AGENTS §6, solo docs) | Estado |
| --- | --- |
| `git diff --check` | PASSED (exit 0; el diff tracked está vacío y este archivo es untracked) |
| Espacios finales y marcadores de conflicto en este archivo | PASSED (`grep -c` con exit esperado y 0 coincidencias) |
| Tablas Markdown: mismo número de columnas en cada fila de cada tabla | PASSED (script `awk` sobre el archivo, exit 0) |

Las revisiones sin comando (lectura de tablas y encabezados, contraste de paths y líneas citados con `main@ca032b1a`) no tienen un estado canónico de §6. Se registran como hechas: cada cita se verificó con `git grep`, `git show` o `sed` durante la auditoría y de nuevo en la corrección (§18).
| Lint, typecheck, build, `security:public-surface`, E2E | NOT_RUN: docs-only, sin código |
| `pnpm test` | NOT_RUN: los lectores canónicos sólo leen archivos tracked y este documento no lo está; ningún guard enumera `docs/implementation/dashboard-*` |

## 16. Riesgo residual y estado final

- El censo de consumidores es estático (`git grep`) y puede no detectar usos indirectos.
- No se ejecutó ninguna medición runtime: DRV-01/02/03 siguen siendo hipótesis medibles, como en la v2.
- La regresión visual en win32 consta como BLOCKED en un registro previo, no reverificado aquí.
- **Estado del documento: READY** como auditoría y planificación.
- **Estado para iniciar C26: BLOCKED.** Faltan G11 en PASSED (inventario FAILED, §17.7) y las decisiones D-11 y D-01(c).
- C26 no se inició. No hubo commit, push, PR ni escrituras remotas.

## 17. Inventario G11 (pre-C26)

### 17.1 Método y entorno

- **Autorización:** Nico (2026-10-21), inventario local sin corrección productiva, sin modificar tests versionados, sin commit.
- **Instrumento:** sonda temporal `frontend/e2e/g11-probe/g11-axe-probe.spec.ts`, fuera del catálogo, **borrada al terminar**, con el mismo patrón que la sonda C25. Reutiliza sin modificarlos los helpers de A02 de `frontend/e2e/helpers/dashboard-geometry-matrix.ts`: las 21 `DASHBOARD_GEOMETRY_SURFACES`, las sesiones `populated`, `installSurfaceMocks`, `assertSurfaceLoaded`, `waitForLayoutSettled`, `resizeSurfaceViewport` y `suppressNextDevChrome`.
- **Tema:** `localStorage["vetneb-theme-mode"]` = `normal` o `dark-gray` antes de la carga, más `emulateMedia({ colorScheme })`. Se verificó `html[data-theme]` en las 42 combinaciones: 42/42 aplicaron el tema pedido.
- **axe:** `@axe-core/playwright` sobre el documento completo, con las etiquetas `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` y **sin `disableRules`**. Se registran todas las violaciones. El gate considera sólo `critical` y `serious` (rector §58).
- **Viewports:** la matriz principal de G11 (21 × 2 = 42) se midió a **1366 × 768**. La misma carga se redimensionó a **390 × 844** como medición complementaria (42 registros más). Como el rector no fija los viewports de G11, eso queda como decisión (§17.7).
- **Entorno:** Windows (`win32`), `next dev` con la API de fixture en 3107, Chromium de Playwright, `reducedMotion: reduce`, head `ca032b1a`. Una sola tarea pesada (AGENTS §8).
- **Ejecuciones:**
  - Matriz completa: `42 passed (3.3m)`, exit 0.
  - Re-ejecución de las 12 combinaciones con hallazgos, para capturar el `failureSummary` de axe: `12 passed`, exit 0. Los resultados coincidieron.
- **Higiene:**
  - Sonda borrada; `git status` sólo muestra los dos untracked previos.
  - `frontend/next-env.d.ts` sin cambios; puertos 3000 y 3107 libres al terminar.
  - `test-results/` está ignorado y fuera del diff. `playwright-report/` ya existía y está ignorado.
  - La salida JSON de la sonda quedó fuera del repositorio. Contiene sólo datos sintéticos del fixture.

### 17.2 Resultados de las 42 combinaciones (matriz principal, 1366 × 768)

| Superficie | Tema `normal` | Tema `dark-gray` |
| --- | --- | --- |
| admin-hub | PASS | PASS |
| admin-resumen | PASS | PASS |
| admin-informes | PASS | PASS |
| admin-tokens | PASS | PASS |
| admin-clinicas | PASS | PASS |
| admin-auditoria | PASS | PASS |
| admin-usuarios | PASS | PASS |
| admin-sesiones | PASS | PASS |
| admin-precios | **FAIL** · V-2 | **FAIL** · V-2 |
| admin-mantenimiento | PASS | PASS |
| admin-estado | PASS | PASS |
| clinic-informes | PASS | PASS |
| clinic-informes-full | PASS | PASS |
| clinic-tokens | PASS, **cobertura incompleta** (§17.4) | **FAIL** · V-5, cobertura incompleta |
| clinic-logistica | PASS | PASS |
| clinic-logistica-full | PASS | PASS |
| clinic-log-rutas | **FAIL** · V-1 | **FAIL** · V-1 |
| clinic-log-visitas | PASS | PASS |
| clinic-log-metricas | PASS | PASS |
| clinic-operaciones | PASS | PASS |
| clinic-perfil | PASS | PASS |

Recuento principal: **36 PASS y 6 FAIL**. Las dos combinaciones PASS de clinic-tokens no auditan el estado operativo (§17.4).

**Complementario a 390 × 844** (fuera de la matriz principal): 36 PASS y 6 FAIL. Las que fallan:

- admin-informes: V-3 en los dos temas.
- clinic-informes y clinic-logistica: V-4 en `normal`.
- clinic-tokens: V-5 en `dark-gray`.

V-1 y V-2 no aparecen en 390 × 844, porque esas variantes móviles no renderizan la tabla de Rutas ni las pestañas de Precios.

### 17.3 Violaciones y diagnóstico causal

| ID | Regla axe | Impacto | Dónde | Nodos | Componente y causa | Evidencia (`failureSummary`) | Clase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **V-1** | `aria-progressbar-name` | serious | clinic-log-rutas, los dos temas, 1366 | 3 (una por fila) | `frontend/src/app/dashboard/logistica/rutas/page.tsx:252`: un `div` con `role="progressbar"` y `aria-valuenow/min/max`, sin `aria-label` ni `aria-labelledby`. El porcentaje visible está en un `<span>` hermano que no está asociado al progressbar. `RoutePlanDetailDialog.tsx:70` repite el patrón, pero no se midió en runtime porque la sonda no abre diálogos | «aria-label attribute does not exist or is empty …» | **Defecto real.** Es el hallazgo pre-C22 que `clinic-c22-batch-2.spec.ts:258-259` desactiva. Queda confirmado en runtime |
| **V-2** | `aria-valid-attr-value` | critical | admin-precios, los dos temas, 1366 | 1 | `frontend/src/components/dashboard/ModuleTabs.tsx:129,133,168` arma `id` y `aria-controls` como `${baseId}-tab-${tab.id}` con el `id` de pestaña crudo. `AdminPricingEditorCard.tsx:726` pasa como id el nombre de la categoría («Histopatologia E2E» en el fixture). Con un espacio, `aria-controls` se interpreta como lista de IDREF y apunta a ids que no existen | «Invalid ARIA attribute value: aria-controls="…-panel-Histopatologia E2E"» | **Defecto real**, disparado por datos: cualquier nombre de categoría con espacios lo reproduce. Afecta a todo consumidor de `ModuleTabs` con ids no normalizados |
| **V-3** | `button-name` | critical | admin-informes, los dos temas, 390 | 1 | `frontend/src/app/dashboard/admin/AdminReportsCard.tsx:703-717`, botón «Actualizar». El icono es `aria-hidden` y el texto es `<span className="hidden sm:inline">`, así que por debajo de 640 px el botón no tiene nombre accesible | «Element does not have inner text … aria-label attribute does not exist …» | **Defecto real** |
| **V-4** | `color-contrast` | serious | clinic-informes y clinic-logistica, `normal`, 390 | 1 por superficie | `frontend/src/components/dashboard/FullModuleRouteControl.tsx:28`: `text-vetneb-teal` sobre `bg-vetneb-teal/10`, 12 px, peso normal. El token de tema claro está en `globals.css:48` (`--vetneb-teal: 177 64% 31%`) | «contrast of 3.92 (foreground #1c827d, background #e2efef, 9.0pt) … Expected 4.5:1» | **Defecto real** de color. No se reportó a 1366: la diferencia de fondo compuesto entre anchos no se diagnosticó |
| **V-5** | `color-contrast` | serious | clinic-tokens, `dark-gray`, 1366 y 390 | 1 | `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx:857`: la franja de estado usa `text-destructive` cuando hay `errorMessage`. El token oscuro está en `globals.css:1888` (`--destructive: 355 62% 52%`) | «contrast of 3.03 (foreground #d03945, background #25292c, 9.0pt) … Expected 4.5:1» | **Defecto real** de color en tema oscuro, **expuesto por un estado ambiental**: el fixture responde 404 al endpoint de tokens de clínica (§17.4) |

### 17.4 Defectos reales frente a fallos ambientales

- **Defectos reales: 5** (V-1 a V-5). Ninguno depende del entorno para existir. V-2 y V-5 necesitan un dato o un estado concreto para manifestarse, y los dos ocurren en producción: categorías con espacios y cualquier error de carga.
- **Fallo ambiental de cobertura: clinic-tokens.** La sesión `populated` de clínica no tiene servido el endpoint de tokens de clínica. El fixture cae en `if (!hasPopulatedAdminSession(request))` y devuelve 404 «E2E populated session required» (`frontend/e2e/fixtures/admin-populated-api-server.mjs:1547-1549`). La superficie se audita en su **estado de error**, no en el operativo. `assertSurfaceLoaded` lo acepta porque la definición A02 de `clinic-tokens` (`dashboard-geometry-matrix.ts:435`) no declara ese banner como prohibido. Coincide con la evidencia faltante del rector §63 («el fixture no puebla tokens de clínica»).
- **Fallos de ejecución: 0.** 42/42 combinaciones ejecutadas, tema aplicado en 42/42 y 0 timeouts.

### 17.5 Límites de la cobertura

- La matriz principal usa 1 viewport, 1366 × 768. El complementario agrega 390 × 844. Los otros 11 viewports canónicos no se auditaron.
- Sólo se midió el estado cargado: no se abrieron diálogos, menús, sheets ni overlays. Por ejemplo, `RoutePlanDetailDialog`, que tiene el mismo patrón que V-1, sólo está verificado estáticamente.
- clinic-tokens se midió en estado de error (§17.4).
- Win32 con `next dev`. Linux y `next start` no se ejecutaron.

### 17.6 Estado por superficie

**PASS** (en los dos temas, sin violaciones `critical`/`serious` en ninguno de los dos viewports medidos): admin-hub, admin-resumen, admin-tokens, admin-clinicas, admin-auditoria, admin-usuarios, admin-sesiones, admin-mantenimiento, admin-estado, clinic-informes-full, clinic-logistica-full, clinic-log-visitas, clinic-log-metricas, clinic-operaciones y clinic-perfil. Son **15**.

**FAIL**: admin-precios (V-2), clinic-log-rutas (V-1), admin-informes (V-3, sólo a 390), clinic-informes (V-4, sólo a 390) y clinic-logistica (V-4, sólo a 390). Son **5**.

**BLOCKED** para el estado operativo: clinic-tokens. Además, V-5 la hace FAIL en tema oscuro.

### 17.7 Estado global de G11

**G11 = FAILED** en este inventario local:

- 2 reglas `critical` (V-2, V-3) y 3 hallazgos `serious` (V-1, V-4, V-5).
- La cobertura además es incompleta: clinic-tokens no está en estado operativo y faltan 11 viewports y los overlays.

G11 no puede declararse PASSED. Este inventario no es la ejecución formal del gate: esa corresponde a la PR de cobertura sobre su propio head.

**Decisión pendiente (nueva):** qué viewports, estados y overlays define G11. El rector sólo fija «21 superficies, ambos temas» (§56.6, §58). La propuesta mínima es 1366 × 768 + 390 × 844, con los overlays de PR-DRV-03.

### 17.8 Correcciones necesarias y su delimitación

| PR propuesta | Causa | Archivos | Tests | Riesgo |
| --- | --- | --- | --- | --- |
| G11-a · nombres accesibles | V-1, V-3 | `logistica/rutas/page.tsx:248-256` y `logistica/RoutePlanDetailDialog.tsx:66-75` (nombre del progressbar, con el patrón de `metricas/page.tsx:321-325`); `admin/AdminReportsCard.tsx:703-717` (nombre del botón «Actualizar» en todos los anchos) | Retirar `disableRules(["aria-progressbar-name"])` de `clinic-c22-batch-2.spec.ts:259` sin agregar ninguna otra exclusión; aserción axe acotada en la spec C17 a 390 × 844; guard de owner si un censo ancla el JSX | Bajo: sólo atributos, sin cajas nuevas (A02/A03 neutros) |
| G11-b · IDREF válidos en `ModuleTabs` | V-2 | `components/dashboard/ModuleTabs.tsx` (normalizar el sufijo de `id` y `aria-controls` en `:129,133,168` y el `getElementById` de `:114`). Revisar la misma construcción en `ModuleCard.tsx:241,404` y `AdminSectionTabs.tsx:135-166` | Unit o E2E: pestaña con espacios → `aria-controls` resuelve a un elemento existente; teclado de pestañas intacto; guards de `ModuleTabs` | Bajo–Medio: `ModuleTabs` es compartido; no cambia la geometría |
| G11-c · contraste | V-4, V-5 | `components/dashboard/FullModuleRouteControl.tsx:28` (color de texto del control) y `ClinicParticularTokensCard.tsx:857` (texto de error en oscuro). Si la corrección pasa por `--vetneb-teal` o `--destructive` en `globals.css`, es un cambio **global de tokens: R2**, con verificación del resto de consumidores | axe `color-contrast` en las superficies afectadas y en ambos temas; contrato de tokens B03 si cambia un token | Medio: un cambio de token afecta a todo el producto |
| G11-d · cobertura 21 × 2 (test-only) | Gate formal + V-5 en estado operativo | Spec de cobertura (§12); stub hermético de tokens de clínica, como los cinco stubs de A02 (`dashboard-geometry-matrix.ts`, sección «Hermetic surface stubs»), sin tocar el fixture compartido; catálogo y censos | 42/42 sin `critical`/`serious` | Bajo; va después de G11-a, -b y -c |

**Orden.** G11-a, -b y -c son independientes entre sí: owners distintos y causas distintas. G11-d va al final, porque una spec en rojo no puede fusionarse.

## 18. Registro de correcciones de la revisión previa a C26

La revisión R0 del 2026-10-21 detectó 15 inconsistencias en la versión inicial de este documento. Todas se corrigieron sobre el mismo archivo, sin tocar fuentes rectoras.

| ID | Gravedad | Inconsistencia | Corrección | Sección | Evidencia |
| --- | --- | --- | --- | --- | --- |
| I-01 | Alta | DRV-05 se igualaba a «PR-BUG-03 implementado» | DRV-05 implementado en el alcance v2; PR-BUG-03 en el alcance del rector PARCIAL por P2-05 | §1, §10 | Rector §55 (`:1993`), §38 (`:1539-1541`); §2 P2-05 |
| I-02 | Alta | La cobertura axe era la fase «C26-1» | G11 pasa a ser prerrequisito anterior a C26, con su propia secuencia | §8, §10, §12 | Rector §58 (G11 «Antes de C26») |
| I-03 | Alta | «D-11 no tiene bloqueo técnico» presentado como suficiente para iniciar C26 | D-11 resuelve sólo C25. El inicio de C26 depende además de G11 | §7.1, §11.1 | Rector §58 |
| I-04 | Alta | No mencionaba la violación axe conocida | `aria-progressbar-name` en Rutas, desactivado en C22 y presente en el marcado | §8, §17 | `clinic-c22-batch-2.spec.ts:258-259`; `rutas/page.tsx:252`; `RoutePlanDetailDialog.tsx:70`; acta C22 l. 71 |
| I-05 | Media | «2 entradas del dashboard» con axe | Cobertura parcial: 16 specs por módulo, tema claro, filtro critical/serious | §8 | Censo `git grep AxeBuilder` |
| I-06 | Media | El fallo de `main@ceb77bd3` se atribuía a C-11 #32 | Era C23a (`dashboard-c23-responsive-integral.spec.ts:213`) | §4.3, RC-4 | Run `39596304982`, `--log-failed` |
| I-07 | Media | Adoptaba sin señalarlo que G12 forma parte del cierre de C26 | Se registra la tensión entre §54 y §58 como decisión de Nico | §7.2 | Rector §54 (`:1981`), §58 (`:2085`) |
| I-08 | Media | D-11 y D-01(c) presentadas como decisiones ordinarias | Procedencia `PROPOSED`, D-11 como excepción a §50 y exigencia de registro escrito | §7 | v2 §19; rector §50 |
| I-09 | Media | Sub-PRs de C26 presentadas como independientes y sin criterios medibles | Serie obligada por los censos compartidos; criterios de aceptación por PR | §10, §12 | `catalog.ts` y censos compartidos |
| I-10 | Media | §56.6 sin consecuencias | D7 y P2-05 frente a las dos lecturas de D-01(c) | §9 | Rector §54, §56.6 |
| I-11 | Baja | «EXECUTED» para PRs fusionadas por Nico | MERGED, verificado por lectura | §10 | AGENTS §13 |
| I-12 | Baja | «PASSED» para revisiones sin comando | PASSED sólo para comandos con exit 0; el resto se registra como hecho | §15 | AGENTS §6 |
| I-13 | Baja | «G11 sería FAILED por omisión» | NOT_RUN, con FAILED esperado en Rutas | §8 | AGENTS §6 |
| I-14 | Baja | «10 ABIERTO» como una única categoría | Tabla de seis naturalezas | §1 | §2 |
| I-15 | Baja | Path `presentation/.../ContentGrid.tsx` | Paths completos verificados | §12 | `git ls-files` |

Verificaciones adicionales hechas durante la corrección:

- Frontend CI sobre `ca032b1a` terminó en success.
- El path de los helpers A02 se verificó: `frontend/e2e/helpers/dashboard-geometry-matrix.ts`.
