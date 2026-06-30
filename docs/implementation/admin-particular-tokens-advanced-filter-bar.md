# Admin Particular Tokens Advanced Filter Bar

## Objetivo

Implementar una barra de filtros avanzada en Dashboard Administración -> Tokens particulares, alineada visualmente con el patrón existente de Auditoría y sin modificar backend, base de datos, dependencias, navegación global ni contratos API.

## Estado base

- Rama: `feat/admin-particular-tokens-filter-bar`.
- Base inspeccionada: `0932ca2 fix(dashboard): remove workspace header divider (#1188)`.
- Worktree inicial: limpio.
- Scope auditado: `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`, `AdminAuditFilterBar.tsx`, tests front/admin existentes y documentación en `docs/implementation`.

## Scope incluido

- Barra avanzada compacta en `admin-particular-tokens`.
- Aplicación y limpieza de filtros sobre las filas cargadas del módulo.
- Tests nativos PNPM para presencia, campos reales, aplicación/limpieza y no regresión de Auditoría.
- Documentación de implementación.

## Scope excluido

- Backend.
- DB, Drizzle, migraciones y schema.
- Auth, cookies, CSRF, rate limits, CORS y CSP.
- Contratos API.
- Dependencias, `package.json`, `pnpm-lock.yaml` y workflows.
- Navegación global, sidebar y layout general del dashboard.

## Campos reales filtrados

La tabla inferior real expone estos campos y la barra filtra sobre ellos:

- Token: últimos 4 visibles (`tokenLast4`, mostrado como `****xxxx`).
- Clínica: nombre resuelto o fallback `Clínica #ID`.
- Informe: `reportId` visible o estado `Sin vínculo`.
- Paciente / tutor: `petName` y `tutorLastName`.
- Estado: `Activo` / `Inactivo` desde `isActive`.
- Fecha Desde/Hasta: rango sobre `createdAt`.

No se agregó filtro de email/destinatario porque ese dato no está visible en la tabla inferior; aparece en el flujo de alta/dialog, no en la grilla operativa solicitada.

## Decisión sobre fecha

Se usó `createdAt` para Desde/Hasta porque es la fecha principal persistente de la tabla (`Creado`). `lastLoginAt` también aparece como `Último acceso`, pero es opcional y puede estar vacío; por eso no es la fecha operativa principal para un rango estable.

## Cambios

- Se reemplazó el filtro simple por clínica por una barra avanzada horizontal/wrap responsive.
- Se agregaron estados `filterDraft` y `appliedFilters`.
- Se agregaron helpers de matching para token, clínica, informe, paciente/tutor, estado y rango de creación.
- Se carga el catálogo de clínicas al montar el módulo para resolver nombres visibles y permitir filtro por nombre o ID.
- Se mantienen `PAGE_SIZE=9`, paginación existente y llamadas API actuales.
- Se usa `filteredTokens` / `filteredMobileTokens` para desktop y mobile sin introducir scroll horizontal ni scroll interno artificial.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `test/frontend-admin-particular-tokens.test.ts`
- `test/admin-tokens-enterprise-density.test.ts`
- `docs/implementation/admin-particular-tokens-advanced-filter-bar.md`

## Validaciones ejecutadas

- `pnpm test`: pasó, 2892 tests, 0 fallos.
- `pnpm build`: pasó.
- `pnpm security:public-surface`: pasó, sin hallazgos públicos; marcadores server-only existentes en frontend/src/proxy.ts.
- `pnpm --dir frontend lint`: pasó.
- `pnpm --dir frontend typecheck`: pasó.
- `pnpm --dir frontend build`: pasó.

## Riesgo / regresión

- Riesgo bajo-medio: al no tocar backend ni contrato API, los filtros se aplican sobre la página operativa cargada por la paginación existente, no sobre una búsqueda global server-side.
- Riesgo visual bajo: se reutiliza densidad, altura y patrón de Auditoría, sin divisores nuevos sobre el header cerrado por #1188.
- Auditoría queda cubierta por test de no regresión de su barra existente.

## Verificación visual

Capturas no ejecutadas en esta entrega. La verificación manual recomendada es abrir:

`https://www.vetneb.com.ar/dashboard/admin?module=admin-particular-tokens`

y revisar desktop, notebook, tablet, Android e iOS sin overflow horizontal y con botón Aplicar visible.

## Estado final

Implementación lista para validaciones y revisión manual. Sin commit, sin push, sin PR y sin stage.
