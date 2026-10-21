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

## Corrección local posterior a PR #1899 (HEAD `30d23ba5`)

GitHub Actions en ese HEAD registró dos fallos de `strict mode violation` en E2E Completeness (run `39611116223`): los dos `moduleRoot.getByLabel("Rol")` de las pruebas móviles de CAP-A3 y PR-CAP-QA1 también alcanzaban el nuevo landmark `search` llamado «Buscar usuarios y roles». El `<select>` móvil permanece dentro de su `<label>Rol</label>` y expone el rol `combobox` con nombre exacto `Rol`. En ambos specs se sustituyó únicamente ese locator por `getByRole("combobox", { name: "Rol", exact: true })`. Los `getByLabel("Rol")` de escritorio ya están acotados al contenedor de filtros. No cambió producción ni la semántica S1–S7.

El run de Frontend CI `39611116537` falló en C-11 #32 antes del segundo clic: tras seleccionar «Tokens» durante un restore pendiente de «Logística», `expectShown("tokens")` no encontró su workspace. El `error-context.md` sanitizado mostraba el panel de «Operaciones»; la captura mostraba «Tokens» activo en la navegación con ese panel todavía visible. El trace confirma que el fallo ocurrió después del primer clic. El spec, la fixture y los owners de navegación no difieren entre la base `ceb77bd3` y el HEAD de la PR. El caso aislado y el spec completo con `next dev` pasaron (1/1 y 43/43). No se modificaron el router, la fixture, los tiempos ni las aserciones de C-11.

Validación local de la corrección: casos de filtro dirigidos 4/4 PASSED; CAP-A3 y PR-CAP-QA1 completos 21/21 PASSED; selección de landmarks S1–S7, B05 y PRE-C05 48/48 PASSED; guards arquitectónicos B05/B11 85/85 PASSED; `frontend lint`, `typecheck`, `build` y `security:public-surface` PASSED. La PR debe ejecutar nuevamente los checks requeridos sobre el futuro HEAD publicado; los checks del HEAD `30d23ba5` no validan esta corrección local.

### C-11 #32: diagnóstico acotado posterior

La instrumentación temporal y sanitizada, retirada del diff, siguió módulo de URL, workspace, `aria-current`, longitud del historial y clases de requests. En las ejecuciones locales de producción con un build inicial sin `NEXT_PUBLIC_API_URL`, el restore retenido dejó URL bare, workspace y navegación en `operaciones`, historial de longitud 2 y RSC de `logistica` pendiente. El primer clic cambió workspace y navegación a `tokens` mientras la URL seguía bare; se registraron los RSC retenidos de `logistica` y `tokens`. El segundo clic mostró `logistica` en ambos componentes. Tras liberar los payloads, se verificaron URL `?module=logistica` y workspace, pero `networkidle` agotó 30 s. Al vencer, el único request activo era `/api/app-version`: `AppVersionGate` lo solicita en producción y la fixture tiene un handler 200 para él. El build inicial no había incorporado el rewrite `/api/*` hacia la fixture, porque se había compilado sin las variables de Frontend CI. Ese timeout fue una reproducción local mal configurada, no evidencia de un defecto de C-11.

Con el build rehecho con `NEXT_PUBLIC_API_URL=http://127.0.0.1:3107`, `VETNEB_E2E_ALLOW_LOCAL_API=1` y `VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS=1`, como en Frontend CI, C-11 #32 pasó aislado (1/1) y el spec clínico completo pasó con cuatro workers (43/43). `networkidle` terminó sin modificar el test. La divergencia del primer clic en CI sigue sin mecanismo probado: el trace y la captura muestran navegación activa `tokens` con workspace `operaciones`, pero no exponen el estado interno del owner ni una cronología suficiente del commit para atribuirla a hidratación, fixture, router o carga concurrente. No reapareció con el build correcto. El provider, controller, drawer y spec C-11 coinciden con `main@ceb77bd3`; PR-BUG-03 no los modificó directamente.

**Dictamen: escenario C, BLOCKED para declarar `validate-frontend` recuperado.** El timeout local quedó explicado y eliminado al igualar la configuración de build de CI; no justifica cambiar `networkidle`. Falta demostrar la causa del fallo inicial de CI. La prueba adicional mínima es publicar las correcciones de los dos selectores y observar `validate-frontend` en el nuevo HEAD; si C-11 #32 reaparece, una reproducción instrumentada debe registrar en el primer clic el estado del owner, URL, workspace, navegación y comienzo/fin de ambos RSC. Hasta entonces no se cambia la máquina, fixture ni test C-11. Los únicos archivos preparados son los dos specs de «Rol» y esta nota.

## P2-05: estado independiente

La propuesta v2 afirma que los pagers ya cubren P2-05. La cobertura es **parcial**: S1, S5, S6 y S7 contienen anuncios `aria-live` en al menos un pager, pero S2, S3 y S4 conservan pagers o estados de página sin anuncio equivalente. En S3, `CollectionPager` sólo monta su live region cuando recibe `rangeLabel`, y este consumidor no lo pasa. Los `aria-describedby` localizados en S4 y S7 describen campos ajenos al conteo de colección. Por tanto, P2-05 sigue abierto y requiere una decisión propia sobre qué conteos y cambios de página anunciar en cada variante; este PR no añade comportamiento de anuncios.

## Exclusiones, riesgo y rollback

- Excluidos: P2-05, CSS, A02/A03/A05/A08 baselines, C25/C26, PR-DRV-02, backend, DB, dependencias, CI y trabajo en la propuesta v2.
- Riesgo residual: sin la DB local aislada no se puede cerrar `validate:local`; C-11 #32 conserva un fallo en el HEAD publicado de CI cuya causa inicial aún no está demostrada. P2-05 permanece parcialmente descubierto.
- Rollback lógico: retirar los atributos semánticos añadidos y las aserciones PR-BUG-03 de B05, restaurar el ancla PRE-C05 y las aserciones E2E previas. No hay migración ni estado persistido.
- Estado: corrección local de los dos selectores terminada; recuperación de `validate-frontend` **BLOCKED** por C-11 #32 y pendiente de checks en un HEAD nuevo. E2E-GLOBAL-03B y `validate:local` siguen pendientes de la DB aislada.
