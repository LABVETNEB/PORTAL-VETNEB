# C05 Row Density — compact 40 px (R13)

## Estado base

- Rama `feat/dashboard-c05-row-density-40px-20261025` sobre `main` @ `ebe88a7c434f029dba44c76d1dd96e9adec2e871` (PR #1922).
- Cierre anterior (2026-10-03, base `4ef19ec9`): C05 = BLOCKED, R13 = TRIGGERED. Este documento lo reemplaza.
- Autorización: Nico autorizó R13 el 2026-10-25 — `compact` 36→40 px con nuevos `limit` en las hojas medidas y recaptura real de A02/A03 (Win32 local; Linux desde CI).

## Scope

Incluido: el token `--dash-row-pitch-compact`, la realineación de los guards que lo congelaban, el contrato C05 dentro de A05 y la recaptura Win32 dirigida de A02 y A03.

Excluido: `regular` 44 px, `--dash-table-head-h` 32 px, `CollectionHeader` 36 px (C01) y `CollectionPager` 40 px (C02), el término de gap de 1 px, backend, dependencias, CI, C25 D4–D8, C26 y el documento rector (§50/§54/§59–60 quedan para un PR docs-only propio).

## Auditoría previa: por qué la alternativa A es imposible

Pitch visual = pitch de capacidad: `zero-scroll.css` bloquea filas y celdas a `--dash-row-pitch`, y `useDashboardCanvasCapacity` lee ese mismo token para `floor((H − reserved + gap) / (pitch + gap))`.

Medición con una sonda Playwright temporal (reutiliza `prepareContext` y `prepareLeafFirstPage` de A03; 15 consumidores × 13 viewports; borrada al terminar). En línea base reproduce las 61 hojas `compact` del baseline congelado (0 diferencias).

| Hallazgo | Medido |
|---|---|
| Mutación 36→40 px con el mismo canvas | 50/61 hojas `compact` cambian `limit` (−1..−3); H del canvas idéntico; 0 desbordes |
| Render a 40 px calculando con 36 px | déficit físico en 49/61 hojas, máx. 76.6 px (clipping o solape con el pager) |
| Ganancia constante de canvas que conserve todos los `limit` | intervalo VACÍO en clinics, report-upload, sessions y users-roles: el déficit crece 4 px por fila y el chrome es constante |
| Chrome objetivo C01/C02 (header 36, pager 40) frente a hoy (32 / 43.19) | ≈ +1 px neto: no libera espacio |

Ejemplos del déficit (`reserva + L × 40 + (L − 1) × gap − H`): `admin-clinics` 1920 × 1080 H 875.14, L 22 → 57.9 px; `admin-sessions` 834 × 1194 H 995.36, L 26 → 101.6 px; `admin-pricing` 412 × 915 H 681.3, L 16 → 48.7 px. Recuperar 50–100 px dentro de la tarjeta exigiría quitar la barra de la colección o el paginador.

Decisión: alternativa B (R13), autorizada.

## Cambios

| Archivo | Cambio |
|---|---|
| `frontend/src/styles/dashboard/tokens.css` | `--dash-row-pitch-compact: 40px`; comentario del término de gap corregido con la medición nueva |
| `test/architecture/dashboard-admin-desktop-tablet-space.test.ts` | "frozen until C05" → contrato positivo: una sola declaración `compact`, 40 px |
| `test/architecture/dashboard-b11-workspace-header.test.ts` | 4 listas de congelamiento ahora fijan el valor C05 (40 px); `regular`, cabecera y paginación siguen congelados |
| `test/architecture/dashboard-b04-surface-token-migration.test.ts` | hash del bloque `dashboard-row-pitch-contract` re-congelado con nota de causa (mismo método; reproduce el hash de HEAD antes del cambio) |
| `frontend/e2e/admin/reports/admin-reports-c17-pilot.spec.ts`, `frontend/e2e/regression/dashboard-c24-list-grid-toggle.spec.ts` | ventana de `admin-report-upload::w1366x768` 14 → 12 (filas, `limit`/`offset`, tarjetas, "N seleccionados"), el valor A03 realineado |
| `frontend/e2e/regression/dashboard-limit-invariance.spec.ts` | contrato C05 por hoja: token 40 px, filas pintadas = `limit`, cada fila ≥ 40 px, la última termina dentro del canvas, el canvas no hace scroll; cardinalidad esperada 61 hojas `compact` |
| `frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts` | A03 Win32: 50 hojas / 222 campos |
| `frontend/e2e/fixtures/dashboard-geometry-baseline.ts` | A02 Win32: 48 registros / 240 campos |

## Nuevos `limit` (A03 Win32)

| Consumidor | 1920 | 1600 | 1440 | 1366 | 1280 | 1024 | 834 | 768 |
|---|---|---|---|---|---|---|---|---|
| admin-clinics | 22→20 | 18→16 | 18→16 | 14→13 | 13→12 | 15→13 | 26→23 | 21→19 |
| admin-report-upload | 22→19 | 17→15 | 17→15 | 14→12 | 12→11 | 13→11 | 23→21 | 18→17 |
| admin-sessions | 22→20 | 18→16 | 18→16 | 14→13 | 13→11 | 14→13 | 26→23 | 21→19 |
| admin-users-roles | 23→20 | 18→16 | 18→16 | 15→13 | 13→12 | 15→13 | 26→23 | 21→19 |
| admin-failed-login-alerts | 14→13 | 10→9 | 10→9 | 6 | 5→4 | 7→6 | 16→15 | 12→11 |
| admin-particular-tokens | 18 (tope) | 16→14 | 16→14 | 13→11 | 11→10 | 13→11 | 18 (tope) | 17→15 |

`admin-pricing` (móvil): 360 13→12, 375 13→12, 390 14→13, 412 16→14, 430 16→15. `admin-audit-log` queda en 9 (tope del consumidor). Ninguna hoja no-`compact` cambió. `offset` = nuevo `limit` tras una página siguiente.

## Recaptura

- **A03.** Control sobre la base: PASSED 234/234. Dos capturas en frío completas (`.next` borrado antes de cada una): byte-idénticas. Overlay por línea con orden de claves conservado y autoprueba de re-serialización (0 fallos). Movidos: 39 hojas server-request (`limit`, `offset`, `secondPageCount`, `provenance`) y 11 client-slice (`limit`, `offset`, `firstRenderedFixtureIndex`, `secondPageFixtureIds`, `pageItemCount`, `secondPageCount`).
  - NO absorbido: `admin-particular-tokens::{w375x812, w412x915}` difieren sólo en `secondPageFixtureIds`/`provenance`. El control sobre la base observa los mismos valores, así que no tienen relación con C05; ya figuraban como no absorbidos desde C23b.
- **A02.** Control sobre la base: PASSED 21/21. Dos capturas locales `VETNEB_A02_GEOMETRY_CAPTURE=1`: 273/273 registros idénticos. 96 campos fuera de tolerancia (`regions.collection.height`, `derived.collectionCanvasHeight`, que miden la tabla: cabecera + filas) y 144 dentro de tolerancia justo en el borde de 4 px (`derived.primaryBlockHeight` 36/37→40, `derived.primaryContentHeight`, `regions.primaryContent.height`), todos en las mismas 6 superficies × 8 viewports.
  - NO absorbido: anchos de `admin-clinicas` a 768 × 1024 (887.63→887.52, 0.11 px).
- **Linux.** PENDIENTE: requiere la captura real de `E2E Completeness` sobre el head publicado; `platformObservations.linux` y `platformRecords.linux` no se tocaron.

## Validaciones (Win32 local, 2026-10-25)

| Gate | Estado | Evidencia |
|---|---|---|
| Guards de arquitectura dirigidos (desktop-tablet-space, b11, capacity-single-owner, b04) | PASSED | 81/81 + 12/12 |
| A03 `dashboard-adaptive-limit-baseline` | PASSED | 234/234 contra el baseline realineado (control previo sobre la base: PASSED) |
| A02 `dashboard-geometry-baseline` | PASSED | 21/21 contra el baseline realineado (control previo: PASSED) |
| A05 `dashboard-limit-invariance` + contrato C05 | PASSED | 15/15; 61 hojas `compact` verificadas. Prueba de mutación: con `compact` en 36 px el contrato falla (`C05 compact pitch token`) |
| `e2e:visual-contract` (incluye A08) | FAILED | 1025/1027; los 2 fallos son ajenos a C05, ver abajo |
| `e2e:admin-mobile` | PASSED | 160/160 |
| `e2e:ci` | FAILED | 1586/1598; los 12 fallos son ambientales, ver abajo |
| `pnpm --dir frontend lint` / `typecheck` / `build` | PASSED | exit 0 |
| `pnpm security:public-surface` | PASSED | exit 0 |
| `pnpm validate:local` | FAILED (ambiental) | 5434/5436; único fallo `e2e-global-03b` (sin `DATABASE_URL`); `typecheck` y `typecheck:test` pasaron; `pnpm build` aparte: PASSED |
| A02/A03 Linux | BLOCKED | requiere la captura real de CI sobre el head publicado |

Fallos ajenos a C05, aislados:

- `dashboard-c23-responsive-integral` (kebab / Notificaciones, `waitForRequest` 30 s): falla dentro de la cohorte con 36 px y con 40 px; pasa aislado y con el archivo completo con 40 px (13/13). Intermitente bajo carga, preexistente.
- `dashboard-b06-workspace-app-bar` (Enter en búsqueda → `?module=audit-log`, aterriza en `?module=admin`): falla dentro de la cohorte con 40 px; el archivo completo pasa 2/2 con 40 px. Carrera de navegación bajo carga; no toca filas `compact`.
- `public-document-cache-policy` (11): `next dev` responde `no-store` donde el spec espera la variante de dev; falla igual con 36 px. Sólo es decidible con el runner productivo de CI.
- `dashboard-clinic-informes-mobile-parity` (1): `net::ERR_NO_BUFFER_SPACE` del sistema operativo; aislado 5/5.

## Riesgo residual

- Densidad: una a tres filas menos por página en escritorio y una o dos en Precios móvil; más paginación.
- `E2E Completeness` (no required) fallará en A02/A03 Linux hasta el commit de realineación Linux.
- El término de gap de 1 px sobrerreserva (L − 1) px por canvas en las tablas `compact`, que avanzan 40 px exactos. Es la dirección segura y no se tocó.
- Preexistente: en `admin-report-upload` a 768 y 834 px hay filas de 42.66 px (una fila de tabla puede crecer por encima de su celda); entran en el canvas.

## Estado final

PATCH_READY local, Win32. Pendientes: commit/push/PR ([MANUAL-NICO] o delegación explícita), overlay Linux desde CI y el PR docs-only del documento rector.
