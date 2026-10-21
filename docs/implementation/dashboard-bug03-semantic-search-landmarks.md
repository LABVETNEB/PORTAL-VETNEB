# PR-BUG-03 · Landmarks de búsqueda del Dashboard

## Baseline, autorización y alcance

- Base: `main@ceb77bd3a875142c860e76bc41bd98a4f702e0e2` (`origin/main` igual); rama local nueva `fix/dashboard-bug03-semantic-search-landmarks`.
- Nico autorizó implementación y validación local R1. No delegó stage, commit, push, PR ni merge.
- Al iniciar, el árbol tracked y el índice estaban limpios. Se preservaron `frontend/AGENTS.md`, `frontend/CLAUDE.md`, los stashes y el único worktree existente.
- Alcance: P2-18 (landmarks `search` nombrados en S1–S7) y P2-04 (nombre ARIA válido del contenedor de S5). Sin cambios de CSS, geometría, filtros, requests, paginación ni nodos DOM.
- Rector: `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` (§38, §55). La propuesta v2 se consultó desde `origin/docs/dashboard-drive-evolution-proposal` (§10 DRV-05 y §15.2), sin editarla.

## Evidencia RED

- El nuevo guard estructural, incorporado al test B05 que ya verifica las superficies JSX, falló en los diez nodos previstos: S1, S2 escritorio y móvil, S3, S4 escritorio y móvil, S5 escritorio y móvil, S6 y S7. Todos carecían de `role="search"`.
- Playwright, antes del cambio productivo, obtuvo cero resultados para `getByRole("search", { name: "Filtros avanzados de informes" })` en S3 escritorio.
- S5 tenía `aria-label="Filtros de usuarios y roles"` sobre un `div` sin rol.

## Solución S1–S7

| Superficie | Owner semántico existente | Corrección |
| --- | --- | --- |
| S1 Auditoría | `FilterBar` escritorio y hoja móvil | `role="search"`; nombres existentes preservados |
| S2 Tokens admin | `FilterBar` escritorio; `<form>` de búsqueda rápida móvil | `role="search"` en ambos; nombre añadido al formulario móvil |
| S3 Informes admin | `FilterBar` escritorio y hoja móvil | `role="search"`; nombres existentes preservados |
| S4 Clínicas admin | Contenedor inmediato del input en escritorio y móvil | `role="search"` y `aria-label="Buscar clínicas"` en ambos; acciones administrativas quedan fuera |
| S5 Usuarios y roles | Banda de filtros escritorio y banda de búsqueda móvil | `role="search"` en ambas; el nombre de escritorio pasa a ser válido y la banda móvil recibe nombre |
| S6 Informes clínica | `FilterBar` escritorio y diálogo móvil | `role="search"`; nombres existentes preservados |
| S7 Tokens clínica | `FilterBar` escritorio y diálogo móvil | `role="search"`; nombres existentes preservados |

`FilterBar.tsx` ya propaga estas props al `<form>` real y no se modificó. Las variantes ocultas conservan su visibilidad previa; no se agregó wrapper, formulario anidado, clase, handler ni estilo.

## Evidencia GREEN y gates

| Gate | Estado |
| --- | --- |
| Guard PR-BUG-03 dentro de B05 | PASSED 10/10 |
| Guards arquitectónicos afectados y A01 operativo | PASSED 78/78 antes de realinear PRE-C05; B05 34/34 y B11 51/51 después |
| E2E dirigido con `getByRole("search", { name })`, unicidad visible y flujos de filtro/pager/acciones | PASSED 14/14 |
| A02 geometría congelada | PASSED 21/21 superficies, 273/273 viewports |
| A03 `limit`/`offset` congelados | PASSED 16/16 tests, 195/195 registros primarios, 234/234 hojas |
| `pnpm --dir frontend lint`, `typecheck`, `build`; `pnpm security:public-surface` | PASSED cada uno |
| `pnpm --dir frontend e2e:verify-catalog` | PASSED 7/7; no cambió el catálogo |
| `pnpm validate:local` | FAILED: typecheck y typecheck:test pasaron; `pnpm test` terminó con 5422 passed, 1 failed y 1 skipped de 5424. El build raíz no corrió por fail-fast |
| `pnpm build` raíz, ejecutado separado tras el fail-fast | PASSED |
| E2E-GLOBAL-03B | BLOCKED: falta `DATABASE_URL` o `SUPABASE_DB_URL` hacia la DB aislada local `portal_vetneb_ci`; aborta antes de Fastify |

El guard PRE-C05 de Clínicas anclaba el tag móvil sin atributos. Se realineó con el mismo tag y los nuevos atributos semánticos, manteniendo la posición de búsqueda bajo las acciones y la condición `md:hidden`. La primera suite completa también detectó que un guard nuevo sin `git add` queda fuera del inventario tracked; sus aserciones se integraron al guard B05 existente. No se debilitó ningún contrato ni se incluyó ese archivo temporal en la entrega.

## P2-05: estado independiente

La propuesta v2 afirma que los pagers ya cubren P2-05. La cobertura es **parcial**: S1, S5, S6 y S7 contienen anuncios `aria-live` en al menos un pager, pero S2, S3 y S4 conservan pagers o estados de página sin anuncio equivalente. En S3, `CollectionPager` sólo monta su live region cuando recibe `rangeLabel`, y este consumidor no lo pasa. Los `aria-describedby` localizados en S4 y S7 describen campos ajenos al conteo de colección. Por tanto, P2-05 sigue abierto y requiere una decisión propia sobre qué conteos y cambios de página anunciar en cada variante; este PR no añade comportamiento de anuncios.

## Exclusiones, riesgo y rollback

- Excluidos: P2-05, CSS, A02/A03/A05/A08 baselines, C25/C26, PR-DRV-02, backend, DB, dependencias, CI y trabajo en la propuesta v2.
- Riesgo residual: sin la DB local aislada no se puede cerrar `validate:local`; no se observó regresión atribuible al cambio semántico. P2-05 permanece parcialmente descubierto.
- Rollback lógico: retirar los atributos semánticos añadidos y las aserciones PR-BUG-03 de B05, restaurar el ancla PRE-C05 y las aserciones E2E previas. No hay migración ni estado persistido.
- Estado: implementación local terminada; publicación **BLOCKED** hasta validar E2E-GLOBAL-03B y `validate:local` con la DB aislada.
