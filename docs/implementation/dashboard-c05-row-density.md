# C05 Row Density — BLOCKED CLOSEOUT

## Baseline

Base: `main` / `origin/main` en `4ef19ec9e5220c31175511fce87494f45cb84b83` (C03 fusionado por #1817). Rama local `feat/dashboard-c05-row-density`, sin worktree y sin commits propios. Investigación ejecutada el 2026-10-03 en Win32 Chromium. Estado final: **C05 = BLOCKED**, sin cambio de runtime.

## Objetivo

Fila estándar de colección de 40 px (§46) con el `limit` de A03 invariante en los 15 consumidores canónicos (§20.8) y los 13 viewports.

## Precondición

- C01 COMPLETE (`docs/implementation/dashboard-c01-collection-workspace.md`).
- A07 CLOSED (§20.9 del documento rector).
- C04 NOT_STARTED; no forma parte de C05 y no se tocó.

## Hallazgo de arquitectura

Pitch visual = pitch de capacidad.

- `frontend/src/styles/dashboard/tokens.css` (`dashboard-row-pitch-contract`) declara los tiers en px: `compact` 36, `regular` 44 (40 con `max-height: 760px`), `table` 48, `tall` 52/46, `card` 76/68, `block` 168, `form` 220.
- `frontend/src/styles/dashboard/zero-scroll.css` fija la fila visible (`block/min/max-block-size`, y la celda en tablas) a `--dash-row-pitch`.
- `frontend/src/hooks/useDashboardCanvasCapacity.ts` lee ese mismo `--dash-row-pitch` y `computeCapacity` calcula `floor((H − reserved + gap) / (pitch + gap))`.

Cambiar la altura visible cambia, por construcción, el input de capacidad. A07 cumplió su contrato histórico (owner único, cardinalidad estable frente a contenido y reservas); la separación entre pitch visual y pitch de capacidad no formaba parte de él y C05 reveló esa dependencia residual.

Tiers en uso por canvases adaptativos: `compact` en las 7 tablas admin desktop (Auditoría, Informes, Tokens, Clínicas, Usuarios y roles, Sesiones, Intentos fallidos; cabecera `table-head-dense` 32 px, gap 1 px) y en el catálogo de Precios móvil; `regular` en las listas móviles admin, Mantenimiento móvil, Informes clínica, Informes ruta completa, Logística y Tokens clínica. `tall`, `card`, `block` y `form` no son filas estándar de colección.

## Experimento

1. **Before.** `A03_TARGET_MODULES=admin-report-upload,admin-clinics`, spec `frontend/e2e/regression/dashboard-adaptive-limit-baseline.spec.ts`, `--reporter=list`, salida fuera del repositorio. PASSED 3/3; 26/26 hojas idénticas al baseline congelado.
2. **Mutación temporal.** Único cambio: `--dash-row-pitch-compact: 36px` → `40px` en `tokens.css`; `frontend/.next` eliminado antes de correr (AGENTS.md §7).
3. **After.** Misma corrida: FAILED en la aserción de baseline (`admin-clinics::w1024x768: frozen adaptive window`); 15/26 hojas con `limit` distinto.
4. **Revert.** Literal restaurado a `36px`; `git status` y `git diff` sin cambios; `next-env.d.ts` intacto.

## Resultados medidos

| Consumidor | Viewport | Before | After | Delta |
|---|---|---:|---:|---:|
| `admin-report-upload` | 1920 × 1080 | 19 | 17 | −2 |
| `admin-report-upload` | 1600 × 900 | 14 | 13 | −1 |
| `admin-report-upload` | 1440 × 900 | 14 | 13 | −1 |
| `admin-report-upload` | 1366 × 768 | 11 | 10 | −1 |
| `admin-report-upload` | 1280 × 720 | 9 | 9 | 0 |
| `admin-report-upload` | 1024 × 768 | 10 | 9 | −1 |
| `admin-report-upload` | 834 × 1194 | 20 | 18 | −2 |
| `admin-report-upload` | 768 × 1024 | 16 | 14 | −2 |
| `admin-report-upload` | 430 × 932 | 14 | 14 | 0 |
| `admin-report-upload` | 412 × 915 | 13 | 13 | 0 |
| `admin-report-upload` | 390 × 844 | 11 | 11 | 0 |
| `admin-report-upload` | 375 × 812 | 10 | 10 | 0 |
| `admin-report-upload` | 360 × 800 | 10 | 10 | 0 |
| `admin-clinics` | 1920 × 1080 | 20 | 18 | −2 |
| `admin-clinics` | 1600 × 900 | 15 | 14 | −1 |
| `admin-clinics` | 1440 × 900 | 16 | 14 | −2 |
| `admin-clinics` | 1366 × 768 | 12 | 11 | −1 |
| `admin-clinics` | 1280 × 720 | 11 | 10 | −1 |
| `admin-clinics` | 1024 × 768 | 12 | 11 | −1 |
| `admin-clinics` | 834 × 1194 | 23 | 20 | −3 |
| `admin-clinics` | 768 × 1024 | 18 | 16 | −2 |
| `admin-clinics` | 430 × 932 | 13 | 13 | 0 |
| `admin-clinics` | 412 × 915 | 13 | 13 | 0 |
| `admin-clinics` | 390 × 844 | 11 | 11 | 0 |
| `admin-clinics` | 375 × 812 | 10 | 10 | 0 |
| `admin-clinics` | 360 × 800 | 10 | 10 | 0 |

Drift: **15/26**. Las 15 hojas con drift son las de ≥ 768 px con `limit` ≥ 10; la única hoja ≥ 768 px con `limit` 9 no cambia, y las de < 768 px no usan el tier `compact`. Coincide con la aritmética del motor: con gap 1 px, `floor(usable / 41) < L` siempre que `L ≥ 10`.

*Inferencia matemática, no medida:* con el mismo algoritmo, `regular` 44 → 40 px puede aumentar el `limit` y una fila móvil de 48 px puede reducirlo. Ninguna de las dos variantes se ejecutó.

## Decisión

- R13 activado (§59–§60 del documento rector): si el `limit` cae, se revierte a 36 px con justificación medida.
- La fila `compact` conserva 36 px.
- Sin cambio de runtime, CSS, hooks ni aritmética de capacidad.
- Las convergencias que C01 (`CollectionHeader` 36 px dentro de canvas) y C02 (reserva compacta del pager 40 px) atribuían a C05 no se ejecutaron y quedan igualmente bloqueadas cuando alteren el canvas, la capacidad o A03.

## Prohibiciones respetadas

- Sin recaptura de A02 ni A03; baselines sin cambios.
- Sin cambio de `limit`, `offset`, page size ni breakpoints.
- Sin cambio del hook `useDashboardCanvasCapacity` ni de `computeCapacity`.
- Sin commit de runtime; la mutación existió sólo durante la corrida.
- Sin C04 (orden por columna) ni C06+ (selección, toolbars, menús).

## Condiciones de desbloqueo

C05 puede reabrirse sólo si ocurre una de estas condiciones:

- **A.** Se implementa y valida una separación explícita entre la altura visual de la fila y el pitch de capacidad (conceptualmente `visualRowHeightPx` frente a `capacityPitchPx`, o una arquitectura equivalente) sin drift A03.
- **B.** Nico autoriza explícitamente redefinir los baselines de `limit`/`offset` y ejecutar la recaptura completa requerida.

## Riesgos residuales

- El destino canónico de §46 (fila 40 px, `CollectionHeader` 36 px, `CollectionPager` 40 px) sigue sin alcanzarse en canvases adaptativos.
- La evidencia medida cubre dos consumidores `compact`; el resto se deriva de la misma aritmética y del baseline congelado.

## No alcance

Sin backend, API, auth, DB, migraciones, dependencias, lockfile, workflows, PWA, tests ni producción. Cierre documental únicamente.
