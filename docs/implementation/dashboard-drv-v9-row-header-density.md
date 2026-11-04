# DRV V9 · Fila `compact` 44 px y cabecera densa 36 px (F0-D7, alternativa C)

| Campo | Valor |
| --- | --- |
| Rama | `feat/dashboard-drive-v9-row-header-density` (PR Draft) |
| Base | `origin/main` = `414df1cee20caefdf3acf808385094a2ae0483ee` (V8, PR #1956) |
| Decisión | F0-D7 aprobada por Nico, alternativa C. R13 autorizada (2026-11) para las 47 hojas A03 y los 132 campos A02 de §4–§5; Win32 aplicado en este PR, Linux pendiente de captura independiente desde E2E Completeness sobre el head publicado. PNG `visual-linux` no incluidos |
| Riesgo | R1 (CSS + realineación de guards). La recaptura de baselines es R13 y queda pendiente |

## 1. Cambio de runtime

`frontend/src/styles/dashboard/tokens.css`:

- `--dash-row-pitch-compact`: 40 → **44 px** (≥768 px). Un override `@media (max-width: 767px)` conserva **40 px** en teléfono.
- `table-head-dense`: `--dash-table-head-h` 32 → **36 px**.
- Sin cambio: `CollectionHeader` 36, `regular` 44, `table` 48, `tall`, `card`, alturas móviles.

Consumidores de `compact` (8): Auditoría, Clínicas, Intentos fallidos, Tokens, Informes, Sesiones, Usuarios y roles, y `AdminMobilePricingModule` (que por el override sigue en 40 px). Consumidores de `table-head-dense`: los 7 de escritorio.

Estilos computados medidos en Chromium sobre `tokens.css` (360, 430, 766, 767, 768, 769, 1024, 1920): `compact` = 40 px ≤767 y 44 px ≥768; cabecera densa 36 px en todos; `regular` 44 px; `table` 48 px.

## 2. Realineaciones en el mismo PR (no debilitan nada)

| Archivo | Cambio |
| --- | --- |
| `test/architecture/dashboard-admin-desktop-tablet-space.test.ts` | compact `["44px","40px"]`, cabecera 36 |
| `test/architecture/dashboard-b11-workspace-header.test.ts` | 4 listas de congelamiento: compact 44, cabecera 36 |
| `test/architecture/dashboard-b04-surface-token-migration.test.ts` | hash del bloque `dashboard-row-pitch-contract` re-congelado (`da6ec97a…` → `db066364…`) con nota |
| `frontend/e2e/regression/dashboard-limit-invariance.spec.ts` | A05: pitch esperado 44 (≥768) / 40 (teléfono) |
| `frontend/e2e/regression/dashboard-b11-workspace-header.spec.ts` | cabecera esperada 32 → 36 |
| `frontend/e2e/admin/reports/admin-reports-c17-pilot.spec.ts`, `frontend/e2e/regression/dashboard-c24-list-grid-toggle.spec.ts` | ventana de `admin-report-upload::w1366x768` 12 → 11 (derivada de A03) |

## 3. Medición (Win32, Chromium, sobre el árbol V9; baselines sin tocar)

| Gate | Estado | Evidencia |
| --- | --- | --- |
| Control `main` limpio: A03 | PASSED | matriz 15×13 |
| Control `main` limpio: A02 | FAILED preexistente | 9 campos de ancho de `clinic-log-visitas` (937,94 → 940,70), ver §5 |
| A03 sobre V9 | FAILED esperado (R13) | 47 hojas, §4 |
| A02 sobre V9 | FAILED esperado (R13) | 132 campos V9 + 9 preexistentes, §5 |
| A05 | PASSED 15/15 | 61 hojas `compact`: fila ≥ 44 px (40 teléfono), última fila dentro del canvas, canvas sin scroll |
| Guards dirigidos (6 archivos) | PASSED 98/98 | |
| `visual-contract` (incluye A08/Zero Scroll) | PASSED tras realinear | 1.ª corrida 1074/8 FAILED (5 C06 cabecera 32→36, C17 y C24 ventana 12→11, 1 spec de recuperación de petición sin relación); reejecución de esas 4 specs: 104 PASSED |
| `admin-mobile` | PASSED 166/166 | |
| G11 axe 21×2×2 | PASSED 42/42 | |
| lint, `typecheck`, `typecheck:test`, `build`, `security:public-surface` | PASSED | exit 0 |
| Sonda V1 main vs V9 | 0 registros IGUAL perdidos | §6 |

## 4. A03: 47 hojas afectadas

Detalle por hoja (`limit`, `offset`, `secondPageCount` base y V9, campos adicionales y si cambia `provenance`): `docs/implementation/dashboard-drv-v9-evidence/a03-affected-leaves.csv`.

| Módulo | Hojas | Pérdida de filas |
| --- | --- | --- |
| admin-clinics | 8/13 | 7,2 % |
| admin-sessions | 8/13 | 6,4 % |
| admin-users-roles | 8/13 | 5,8 % |
| admin-failed-login-alerts | 7/13 | 5,7 % |
| admin-report-upload | 8/13 | 5,3 % |
| admin-particular-tokens | 8/13 | 4,6 % |

Sin cambio: `admin-audit-log`, `admin-maintenance`, `admin-pricing` (las 5 hojas móviles idénticas campo a campo), las 3 superficies de clínica y las dos de logística. Pérdida total 2,3 %; el mínimo `limit` observado (2) preexiste. Los 3 campos de capacidad cambian siempre juntos (`limit`, `offset`, `secondPageCount`); las hojas `client-slice` mueven además `firstRenderedFixtureIndex`, `pageItemCount` y `secondPageFixtureIds`, y `provenance` lo restablece el texto de la observación.

**No son de V9 y no se absorben:** `admin-particular-tokens::w375x812` y `::w412x915` difieren sólo en `secondPageFixtureIds` y `provenance` (ya registradas como no absorbidas desde C23b y C05).

## 5. A02: 132 campos V9 frente a 9 preexistentes

- **V9 (132):** 6 superficies (`admin-informes`, `admin-clinicas`, `admin-tokens`, `admin-sesiones`, `admin-usuarios`, `admin-auditoria`) × 8 viewports ≥768 px: `regions.collection.height` 48, `derived.collectionCanvasHeight` 48, `regions.primaryContent.y` 18, `derived.chromeBeforePrimaryContentPx` 18. Ninguno en viewports <768 px. Archivo: `a02-v9-fields.csv`.
- **Preexistentes (9):** `clinic-log-visitas` a 1024×768, 834×1194 y 768×1024: `regions.collectionHeader.width`, `regions.primaryContent.width`, `derived.primaryContentWidth` 937,94 → 940,70. Fallan idénticos en `main` limpio y ya cuentan con autorización F0-D10 en un cambio test-only separado. Archivo: `a02-preexisting-clinic-log-visitas.csv`.

## 6. Fidelidad visual (sonda V1, 3 superficies × 6 viewports × 18 registros = 1044)

`main` y V9 se midieron con `DRV_V1_OUT` sobre el mismo árbol, cambiando sólo `tokens.css`. 487 registros IGUAL en `main`; **0 perdidos, 0 ganados**. Cambian 36 (admin-auditoría y admin-informes × 6 viewports × `tableHeader.height` 32→36, `tableRow.height` 40→44, `tableRow.pitch` 40→44); siguen DIFERENTE frente a Drive (48), con distancia 8 → 4 px. `clinic-informes` no cambia. Archivo: `v1-probe-main-vs-v9.csv`.

Esta fidelidad no es total: texto permitido, «las 3 métricas de altura de fila/cabecera de 2 superficies pasan de 8 a 4 px de Drive; ninguna llega a IGUAL».

## 7. Superficies de baja capacidad (V9, medidas en navegador real)

Última fila siempre por encima del pager, `elementFromPoint` sobre «Siguiente» = el propio botón, sin scroll de documento (X/Y = 0/0) ni de canvas, página 2 llena con «Anterior» habilitado. Filas visibles (1280×720 / 1366×768 / 768×1024): clinics 10/12/17, sessions 10/12/17, users-roles 11/12/17, report-upload 10/11/15, tokens 9/10/14, failed-login 4/5/10.

## 8. Matriz de recaptura R13 (Win32 aplicado; Linux pendiente)

Base: `414df1cee20caefdf3acf808385094a2ae0483ee` + cambios de esta rama. Win32 y Linux se capturan por separado y nunca se copia un valor entre sistemas.

| Baseline | Path | Alcance | Resultado esperado |
| --- | --- | --- | --- |
| A03 Win32 | `frontend/e2e/fixtures/dashboard-adaptive-limit-baseline.ts` | 47 hojas de `a03-affected-leaves.csv`, sólo campos de contrato | `limit`/`offset`/`secondPageCount` según el CSV; 187 hojas sin tocar |
| A03 Linux | idem, sección `linux` | mismas 47 hojas, desde un E2E Completeness real sobre el head | valores Linux observados; comprobar que coinciden hoja a hoja con Win32 antes de aceptar |
| A02 Win32 | `frontend/e2e/fixtures/dashboard-geometry-baseline.ts` | 132 campos de `a02-v9-fields.csv` | valores Win32 observados |
| A02 Linux | idem | sólo los campos fuera de tolerancia que reporte la comparación Linux | valores Linux observados |

Excluido: los 9 campos de `clinic-log-visitas`, las 2 hojas de `admin-particular-tokens` móvil, tolerancias, aserciones y cualquier otro baseline visual.

Reproducción: `pnpm exec playwright test e2e/regression/dashboard-adaptive-limit-baseline.spec.ts e2e/regression/dashboard-geometry-baseline.spec.ts --project=chromium` sobre `main` (control) y sobre la rama; capturas con `VETNEB_A02_GEOMETRY_CAPTURE=1`.

## 9. Bloqueo de fidelidad §65.7.3

La sonda V1 no incrementa métricas IGUAL (0 ganadas, 0 perdidas): mejora parcial de geometría (8 → 4 px respecto de Drive) que **no satisface literalmente** §65.7.3. No se modificó el comparador ni el documento rector. La PR permanece Draft y no es fusionable hasta que una decisión documental independiente adapte el criterio para V9 o una medición comparable lo cumpla.

## 10. Linux (E2E Completeness, run 41857253927, head `09453861`)

- Origen: run 41857253927, attempt 1, job 126669100128, `ubuntu-latest`, chromium, artifact `e2e-completeness-playwright-1`; 2142 PASSED y 7 FAILED (A03 matrix integrity y A02 en 6 superficies admin), idénticos en los 3 intentos.
- **A03 Linux:** 47 hojas autorizadas con cambio de contrato observado en Linux (205 campos); `limit`/`offset`/conteos coinciden hoja a hoja con los de Win32, observados de forma independiente. Las otras 187 hojas difieren sólo por redacción del sanitizer (`moduleId`, `leafKey`, `endpoint`, `query`, `provenance`) o por los ids de stub de tokens y maintenance; ningún `limit`/`offset`/conteo cambia fuera de las 47. Se excluyen `admin-particular-tokens` 375/412.
- **A02 Linux:** los 132 campos autorizados se promueven desde los actuales Linux (los 4 campos × superficies × viewports coinciden con el conjunto Win32). No se incorporó `clinic-log-visitas`, que no falla en Linux.
- **Hallazgo retenido (144 campos Linux, sin promover):** `regions.primaryContent.height`, `derived.primaryContentHeight` y `derived.primaryBlockHeight` en las 6 superficies × 8 viewports (36 → 44, tolerancia 4). En Win32 el valor congelado era 40 y 44 queda dentro de tolerancia, por eso no entraron en los 132; en Linux el valor congelado sigue siendo 36 y 44 queda fuera. La causa es V9 (fila 40 → 44), pero esas tres familias no están en la autorización R13: A02 Linux seguirá FAILED en esos 144 campos hasta que Nico autorice su promoción.
