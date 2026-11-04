# V10 — SuperSearchField píldora Drive (F0-D8)

Base: `main` 14df4e06. Una causa visual: la altura/forma del campo de búsqueda de contenido.

## 1. Cambio
- `SuperSearchField`: 48 px, radio 24 px, texto 16 px, íconos de 20 px, relleno `#e9eef6` sólo en claro (`dark-gray` conserva `hsl(var(--muted))`).
- Tokens propios `--dash-supersearch-*` en `tokens.css` (no acoplados a `--dash-drv-search-*` de V6). Sin cambios en handlers, filtros, submit, peticiones, permisos ni resultados.
- Consumidores alcanzados: `AdminReportsCard` (campo principal desde 768 px y campo en filtros móviles) y `AdminParticularTokensCard` (móvil). Los inputs convencionales de filtros y la búsqueda del encabezado (V6) no se tocan.

## 2. Medición (navegador real, Win32)
La banda real de Informes mide 41 px (campo 40 + 1 px de borde, `py-0`); el 56 px de `FilterRegion` es sólo el arnés C10, donde 48 px cabe redistribuyendo padding (4 px). En los consumidores productivos no hay holgura: la banda crece +8 px (Informes 41→49; Tokens móvil 390: 88→96). Sin scroll de documento (X/Y = 0/0).

## 3. R13 (autorizada por Nico 2026-11-04, limitada a A02/A03)
- **A03** (15×13, 234 hojas): 230 idénticas; 2 de V10 (`admin-report-upload` 1920×1080 18→17 y 834×1194 19→18, `limit`/`offset`/`secondPageCount`); 2 no absorbidas (`admin-particular-tokens` 375×812 y 412×915, procedencia "400 items"/"40 items", preexistente C23b/C05). Pérdida: 1 fila de 18/19 (≈5,4 %) en 2 de 13 viewports. Archivo: `dashboard-drv-v10-evidence/a03-affected-leaves.csv`.
- **A02** (21×13): `admin-informes` × 8 viewports ≥768 px, 47 campos fuera de tolerancia (`regions.filters|collection|collectionHeader|primaryContent.y`, `derived.chromeBeforePrimaryContentPx|Ratio`). Teléfonos y otras 20 superficies idénticos. Archivo: `a02-v10-fields.csv`. `clinic-log-visitas` (3 viewports, widths 937,94→940,70) es preexistente y no se absorbe.
- Sólo Win32. Linux se captura de forma independiente desde un E2E Completeness real sobre el HEAD; nada se copia entre plataformas. Tolerancias, aserciones y denominadores sin cambios.

## 4. G9
`chromeBeforePrimaryContent` de `admin-informes` tras V10: ratio ≤ 0,306 (máx. 1024×768) < 0,32 en los 8 viewports; px ≤ 235 en 6 de 8; 834×1194 (279,08) y 768×1024 (277,89) superan 240 px pero ya lo hacían antes (267,08 y 266,39) y su ratio es 0,234/0,271. Límites no ampliados.

## 5. Fidelidad (§65.7)
La sonda V1 mide el buscador del encabezado, no `SuperSearchField`; no se modificó. Medición suplementaria del componente contra las métricas `search.*` de V1: 4 de 4 métricas comparables pasan de DIFERENTE a IGUAL (altura, radio, tipografía, relleno claro); ninguna IGUAL en `main` cambia de estado; oscuro NO_COMPARABLE (F0-D6); ancho sin cambio y no medido. Archivo: `supersearch-probe-main-vs-v10.csv`. Texto permitido: «4 de 4 métricas comparables del componente SuperSearchField en IGUAL (antes 0 de 4)». No hay fidelidad total.

## 6. Contratos actualizados
`dashboard-c10-super-search-field.spec.ts` (48/24/16 y campo dentro de la banda; arnés con padding 4 px), `admin-c18-batch-1.spec.ts` (Tokens móvil 40→48 px) y guard C10 (tokens y relleno sólo claro).

## 7. Rollback
`git revert` del squash. Los baselines vuelven con el revert.
