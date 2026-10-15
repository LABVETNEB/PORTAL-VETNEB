# C13 · DetailsPane, DetailsHeader, DetailsTabs, DetailsMetadata y DetailsEmptyState

## Base, alcance y contrato

Base: `feat/dashboard-c13-details-pane` en `1f04f68a` (PR C12 #1868); `origin/main` coincide. El primer preflight encontró la rama sobre `21a3589e` (C08 sin squash, sin C09–C12). Nico la realineó a mano sobre `origin/main` y conservó la anterior como `feat/dashboard-c13-details-pane-stale`. `frontend/AGENTS.md` y `frontend/CLAUDE.md` siguen sin seguimiento y se preservan. `frontend/AGENTS.md` lo genera `next dev`; no está versionado, así que no es un `AGENTS.md` anidado según §2.

C13 publica cinco primitivas de presentación en `features/dashboard/presentation/details/`, como fija la taxonomía §47.1. Añade su barrel, un guard, un E2E, una entrada de catálogo y una regla CSS acotada. No adopta ningún módulo productivo: el piloto es C17 (Informes admin) y las migraciones son C18–C22 (§53). `DetailsActivity` y `DetailsActionDock` pertenecen a C14; visor y miniaturas, a C15–C16.

Matriz verificable:

| Fuente | Obligación C13 | Evidencia |
|---|---|---|
| §19, §34 P1-18/P3-10 | Un panel de detalle reutilizable en lugar de cuatro patrones, con estado vacío consistente | Cinco primitivas exportadas; `DetailsEmptyState` reutiliza `EmptyState`/`CollectionState` (C03) |
| §8, §46, B16 | 336 ±2 px; columna desde 1280; overlay entre 768 y 1279 sin reducir la colección; ancho completo bajo 768; control ≥44 px | E2E en siete viewports; ningún token ni selector B16 cambia |
| B16 | `UtilitySidePanel` es el owner de ancho, colapso y scroll | El guard prohíbe overflow, ancho, `aside`, portal y resize en C13; el E2E exige cero scrollers dentro del panel C13 |
| §45.2 | Foco real de 2 px; tipografía title-md / body-sm / label-sm | `outline` medido en el tab enfocado por teclado |
| PR-TRUNC | El detalle es superficie terminal: ningún valor oculto | `DetailsMetadata` y `DetailsHeader` usan `.dashboard-detail-value`; el guard prohíbe `truncate`, `line-clamp` y `nowrap`; el E2E mide clipping 0 con un token de 333 caracteres |
| A02/A03/A05/A08 | Geometría, `limit` y zero-scroll productivos congelados | Ningún consumidor productivo; la regla CSS nueva sólo matchea `[data-details-tabs]` |
| §50, §53 | Sin adopción S1–S7 | Sólo arnés de navegador |

## Auditoría S1–S7 y superficies de detalle

| Superficie | Patrón vigente | Selección | Tabs | Ausencia | Foco/scroll |
|---|---|---|---|---|---|
| S1 Auditoría | `AdminAuditDetailDialog` (`ModuleDialog`) por fila | Sin estado: un diálogo por fila | No | Valores siempre presentes | Radix Dialog; cuerpo `scrollableBody` |
| S2 Tokens admin | Diálogo con `detailTab` `summary`/`tracking` | `selectedTokenId` en la card | `role="tab"` ad hoc, sin roving ni flechas | `"—"` inline | Diálogo |
| S3 Informes admin | Diálogo `Informe #id` + `AdminReportWorkflowViewerCard` embebido | `selectedReportId` | No | `"—"` | Diálogo; visor embebido (C15) |
| S4 Clínicas | `ClinicEditDrawer` (Radix Dialog), edición | `editingClinic` | No | Campos de formulario | Drawer modal |
| S5 Usuarios y roles | `AdminUserRoleDetailDialog`, sólo lectura | Uno por fila | No | Etiquetas derivadas | Diálogo |
| S6 Informes clínica | Diálogo en `ClinicInformesWorkspaceSummary`; master-detail en `InformesReportsList` | `selectedReportId` | `dashboard-module-tab` sin `aria-controls`, `tabpanel`, roving ni flechas | `"—"` | Owner `data-informes-detail-scroll-owner` |
| S7 Tokens clínica | Diálogo con secciones en `ClinicParticularTokensCard` | `selectedTokenId` | Secciones ad hoc | `"—"` | Diálogo |

Lo visual y transversal pasa a C13: encabezado con título, contexto, identificador y slot de estado; pares `dt`/`dd` íntegros; ausencia accesible; tablist WAI-ARIA; estado vacío. Queda en cada consumidor: qué registro está activo, qué atributos existen y cómo se formatean (fechas, etiquetas, enmascarado `****last4`), qué secciones hay, qué tab está activo, qué se carga y cuándo, las acciones (C14) y la navegación. Las diferencias semánticas son reales: S4 edita, S1/S5 sólo leen y S2/S3/S6/S7 tienen ciclo de vida y documentos. C13 no las unifica. El censo PR-TRUNC sigue cubriendo los nueve diálogos vigentes; C13 no los modifica.

## API

- `DetailsPane({ label, children, busy? })`: es un `section` nombrado (`region`) con `aria-busy` opcional. No tiene ancho, alto, overflow ni estado.
- `DetailsHeader({ title, context?, identifier?, status?, headingLevel? = 2, titleId? })`. El nivel 2 es válido después del h1 de la app bar (Admin ≥768 oculta el h2 de workspace) y después del h2 de módulo. El consumidor puede elegir 3 o 4 cuando su jerarquía lo exige.
- `DetailsTabs({ label, tabs: { id, label, content, disabled? }[], activeId, onActiveIdChange })`. Es controlado y no guarda estado propio.
- `DetailsMetadata({ items: { id, label, value, mono? }[], missingLabel? = "Sin dato" })`. Si `items` está vacío, no renderiza nada.
- `DetailsEmptyState({ title, description?, icon? })`.

Ningún archivo importa `@/lib/api`, `@/app`, router, `URLSearchParams`, storage ni temporizadores. Tampoco usan `useState` ni `useReducer`. No hay dependencias nuevas.

## Responsabilidades con B16 y estado controlado

`WorkspaceScaffold` sigue siendo el owner de la composición y del colapso; `UtilitySidePanel`, del ancho, el overlay, el control de 44 px y el único scroll (`.dashboard-utility-side-panel-content`). C13 se monta en el slot `details` y no declara geometría. El contenido queda montado mientras el panel está contraído (`hidden`), así que el tab activo y la selección del consumidor sobreviven al colapso sin duplicarse.

La selección del registro pertenece a la colección consumidora; C13 sólo recibe lo que hay que mostrar. El tab activo es `activeId` del consumidor. Ante un id desconocido o deshabilitado, `DetailsTabs` renderiza el primer tab habilitado y no escribe de vuelta.

## Política de tabs

Tabs WAI-ARIA con activación automática, igual que `ModuleTabs`: ArrowLeft/ArrowRight con vuelta circular, Home y End. Los tabs deshabilitados se saltean y no responden al click. El roving tabindex deja sólo el activo en el orden de tabulación. Las flechas mueven el foco al tab nuevo y lo activan con una sola llamada; el click sobre el tab activo y los re-renders con callbacks nuevos no llaman a nadie. Cada tab tiene `aria-controls` hacia su `tabpanel` (`aria-labelledby`, `tabIndex=0`). Todos los paneles quedan montados y los inactivos van `hidden`, para que `aria-controls` nunca apunte a un id inexistente.

`ModuleTabs` no se reutilizó como componente: es no controlado (`defaultTabId`), monta sólo el panel activo y está acoplado a la altura de módulo (`flex-1`). Volverlo controlado obligaba a cambiar un componente compartido con cinco consumidores productivos. C13 reutiliza su gramática visual (`dashboard-module-tablist`, `dashboard-module-tab`, estado seleccionado) y su semántica de teclado. Los tabs de detalle ad hoc de S2 y S6 no tienen roving tabindex, flechas ni `tabpanel`. Ese hallazgo se reporta y su corrección queda para la adopción de cada módulo (C17–C22).

## Scroll, geometría y CSS

| Owner anterior | Owner nuevo | Propiedad | Valor anterior | Valor C13 | Efecto |
|---|---|---|---|---|---|
| `.dashboard-app-shell .dashboard-module-tab` (`--dash-tab-h`, 30–34 px) | `surfaces.css` · `[data-details-tabs] .dashboard-module-tab` bajo 768 px | `min-height` | 30.4–31.5 px medidos | 44 px | Objetivo táctil ≥44 px; `ModuleTabs` sin cambios |

Las utilidades de Tailwind viven en un layer y pierden contra esa regla sin layer, por eso se usa un selector más específico y no `!important` (la misma convención que B07/B12).

Medición en `next start` con contenido largo (28 atributos y token de 333 caracteres):

| Viewport | Panel | Colección | Modo |
|---|---:|---:|---|
| 1920×1080 | 336 | 1329 (termina en el borde del panel) | columna |
| 1366×768 | 336 | 775 | columna |
| 1280×720 | 336 | 689 | columna |
| 834×1194 | 336 | 755 = workspace | overlay |
| 768×1024 | 336 | 689 = workspace | overlay |
| 390×844 | 390 = workspace | — | ancho completo |
| 320×568 | 320 = workspace | — | ancho completo |

En todos: contenido del panel con scroll interno, overflow horizontal 0, control de 44×44, documento, `body`, `main` y scaffold sin scroll. No se tocaron el límite adaptativo A03 ni los tokens B16.

## Validación

Todas las corridas E2E usaron Chromium con el runner de producción de Frontend CI (`next start`, `NEXT_PUBLIC_API_URL` al fixture local), sin retries.

- A02/A03/A05/A08: PASSED, 73/73 en dos workers. A02 21/21 superficies, A03 16/16, A05 15/15, A08 21/21. Una corrida anterior quedó invalidada: los servidores se detuvieron mientras el runner seguía vivo y eso produjo 13 `ERR_CONNECTION_REFUSED`. No cuenta como evidencia.
- Zero-scroll (`dashboard-internal-no-scroll-contract`, `dashboard-real-app-shell-no-scroll-contract`, `dashboard-zero-scroll-mobile-boundary`), regresión B11/B15/B16/C01–C09, C10, C11, C12 y C13: PASSED, 172/172.
- Frontend lint, typecheck, `typecheck:test`, build y `security:public-surface`: PASSED. `git diff --check`: PASSED; los archivos nuevos se revisaron por separado y no tienen espacios finales.
- Guards y censo con los archivos C13 sin trackear: 62/84. Los fallos venían de la lectura tracked-only (`readSourceFile`) y de los conteos exactos del catálogo. Ese estado se resolvió con el staging manual de Nico, F1–F5 y el realineamiento autorizado que se detalla abajo.

- RED: guard C13 0/2 (los archivos no existían). E2E C13: `beforeAll` falló al empaquetar el barrel ausente (1 failed, 13 no ejecutados).
- GREEN: E2E C13 14/14 en Chromium, `next start`, un worker y sin retries. La primera corrida GREEN detectó dos defectos reales que se corrigieron: `heading-order` con h3 por defecto (antes del panel sólo había un h1 visible) y tabs de 30–31 px bajo 768.
- Mutation proof E2E: anular las teclas de navegación de tabs → FAILED (`toBeFocused`: `inactive`). Convertir `DetailsPane` en segundo scroll owner → FAILED (`overflowY` `auto`, esperado `visible`). Ambas fuentes se restauraron byte a byte.
- Mutation proof del guard: nueve mutaciones (export, red, estado propio, scroll owner, truncado, teclado, `tabpanel`, reutilización de `EmptyState` y nombre accesible).

### Corrida con los archivos C13 trackeados

Con los 11 paths en el índice, la primera ejecución de `pnpm test` dio FAILED: 5.321 pass, 14 fail y 1 skipped. Cuatro de esos fallos eran defectos propios de C13 y se corrigieron con autorización de Nico (F1, F2, F4 y F5). Cada uno pasó de RED a GREEN:

| ID | RED observado | Corrección | GREEN |
|---|---|---|---|
| F1 | guard C13: `owner de layout o scroll en DetailsPane.tsx`, por el identificador `UtilitySidePanel` en un comentario | comentario sin el identificador | guard C13 2/2 |
| F2 | mutation proof: la mutación `"ArrowRight"` no se detectaba porque el literal aparece dos veces | el contrato fija la línea `NAVIGATION_KEYS` completa y la mutación la vacía | 9/9 mutaciones detectadas |
| F4 | `dashboard-foundation-tokens.test.ts:812`: `--dash-shape-sm` consumido fuera de `.dashboard-app-shell` | `rounded-md` en el tabpanel | 25/25 junto con F5 |
| F5 | `e2e-residual-determinism.test.ts:122`: `waitForTimeout` (permitido: 0) | espera observable de `data-expanded` | 25/25; E2E C13 14/14 |

F3 (autorizado aparte): la banda `A0-20-REGISTRIES` cuenta los specs que declaran `const MAYÚSCULAS = [`. El guard C13 declaraba `const FILES = [` y llevaba la métrica de 133 a 134, fuera de 106 ± 27. Ahora el guard deriva sus módulos del barrel `index.ts` y exige que publique las cinco primitivas; si un módulo no aparece en el barrel, lo detecta como "módulo no publicado". Durante la corrección aparecieron dos efectos secundarios propios, y los dos se resolvieron sin tocar censos:

- El contrato de teclas de F2 estaba escrito como el string `const NAVIGATION_KEYS = [`, que también matcheaba el patrón de A0-20. Se reemplazó por un regex sin `const`.
- `function read(` sumaba un lector propio a `A0-13-READERS` (40 → 41). Se reemplazó por la arrow `readPrimitives`, que delega en `readSourceFile`.

Mutation proof con el tooling 01B: el guard sigue escaneado por A0-20 (sin exclusiones), la métrica actual es 133 y reintroducir `const FILES = [` la vuelve a 134. No se tocaron banda, ledger, pisos ni tolerancias.

La repetición de `pnpm test` dio **FAILED**: 5.327 pass, 8 fail y 1 skipped. Quedan siete conteos exactos sin autorizar y `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que falla por la ausencia de la DB aislada `portal_vetneb_ci`. Ese fallo es ambiental: `pnpm test` no se reporta como PASSED y `validate:local` queda BLOCKED.

Después de F1–F5: lint, typecheck, `typecheck:test`, `security:public-surface` y `git diff --check` (árbol e índice) PASSED. El E2E B15/B16/C01 + C13 dio 25/25 con un build equivalente al de Frontend CI. Una corrida intermedia sobre un build hecho sin `VETNEB_E2E_ALLOW_LOCAL_API` agotó los tiempos de `networkidle` en 11 casos B11. Esa corrida no cuenta como evidencia.

### Realineamiento autorizado de conteos exactos

Nico autorizó realinear 14 conteos exactos a sus valores POST medidos. Sólo cambian literales y comentarios de causa; lógica, cobertura y exclusiones quedan igual.

| Ubicación | PRE → POST |
|---|---|
| `test-global-01b-census-contract.test.ts:1721` (importadores del lector canónico) | 425 → 426 |
| `e2e-suite-catalog-completeness.test.ts`: workspace y catálogo | 113 → 114 |
| ídem: `regression` | 23 → 24 |
| ídem: `fixture` | 71 → 72 |
| ídem: `visual-contract` | 35 → 36 |
| ídem: `ci` | 82 → 83 |
| ídem: `full` | 113 → 114 |
| ídem: unión de cohortes | 82 → 83 |
| ídem: regex de entrada faltante | 112 → 113 |
| ídem: regex de entrada duplicada | 114 → 115 |
| ídem: selección compartida | 82 → 83 |
| `e2e-completeness-workflow.test.ts:333` | 113 → 114 |
| `dashboard-b11-workspace-header.test.ts` · `C03_EMPTY_CONSUMERS` | + `DetailsEmptyState.tsx` |

No cambian el ledger 01B (ancla 54.817), el piso 411, la banda A0-20 (133), A0-13 (40) ni las tolerancias.

Resultado: guards afectados, censo 01B y catálogo 121/121 PASSED; `e2e:verify-catalog` 7/7; `typecheck:test` y `git diff --check` PASSED. `pnpm test` termina **FAILED**: 5.334 pass, 1 fail y 1 skipped. El único fallo es ambiental: `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` requiere `DATABASE_URL` o `SUPABASE_DB_URL` para la DB aislada `portal_vetneb_ci`, ausente en este entorno. Por eso `validate:local` queda BLOCKED, y ninguna de las dos se reporta como PASSED.

## Riesgo residual y rollback lógico

El scroll del panel envuelve encabezado y tabs: con contenido largo la tablist se desplaza junto al contenido. Esto es deliberado (un único owner B16) y lo deberá revisar C17 frente al patrón de S6, que fija las acciones fuera del scroll (C14). `heading-order` depende del h2 de workspace oculto ≥768 en Admin; un consumidor con otra jerarquía debe pasar `headingLevel`. El teclado virtual y los lectores de pantalla reales no se probaron en dispositivo.

Rollback: retirar `presentation/details/`, la regla `dashboard-c13-details-tabs` de `surfaces.css`, el guard, el spec, la entrada de catálogo, los recuentos realineados y este documento. B15/B16 no cambian.
