# C14 · DetailsActivity y DetailsActionDock

## Base y alcance

Base: `feat/dashboard-c14-details-activity` en `20fe745d`, igual a `origin/main`; C13 #1873 está fusionado. El árbol versionado estaba limpio. `frontend/AGENTS.md`, `frontend/CLAUDE.md` y cinco stashes preexistentes se preservan.

C14 añade dos primitivas de presentación en `features/dashboard/presentation/details/`. `DetailsActivity` recibe pasos ordenados y estados ya derivados; reutiliza `DetailsEmptyState` (C03) cuando no hay pasos. `StudyTimeline` mantiene su API y etiqueta por defecto como adaptador. La derivación de los cuatro pasos desde `Report` permanece en `InformesReportsList`.

`DetailsActionDock` recibe acciones, callbacks, motivos de deshabilitación y estado pendiente del host. Usa botones nativos a través de `Button`; queda pegado al borde inferior del scroll B16 para mantener visibles las acciones críticas sin crear otro scroller. No selecciona registros, navega, consulta datos ni mantiene estado de operación. No reemplaza `StickyActionBar`, `ActionMenu` ni `ReportFileActions`.

B15 conserva la composición y B16 el ancho, el colapso y el scroll de `UtilitySidePanel`. C13 conserva sus cinco primitivas. No hay adopción de módulos S1–S7: C17–C22 poseen esa migración. C15–C16, backend, auth, DB, workflows, dependencias y geometría productiva quedan fuera.

## Archivos y contratos

- Nuevos: `DetailsActivity.tsx`, `DetailsActionDock.tsx`, `dashboard-c14-details-activity.spec.ts`.
- Modificados: barrel `details/index.ts`, adaptador `StudyTimeline.tsx`, guard `dashboard-c13-details-pane.test.ts`, assertions de accesibilidad y master-detail que anclaban el render al path legado, catálogo E2E.
- Los controles del dock miden al menos 44 px de alto. No se crea otro scroll owner dentro del panel. La prueba de navegador mide el botón dentro del borde visible del scroll B16 y cubre cinco estados, vacío, orden, `aria-current`, disabled, pendiente, teclado, callback único, ausencia de requests/navegación y 1366×768, 390×844, 320×568.

## Evidencia y validación

- RED: el E2E C14 falló por exports `DetailsActivity` y `DetailsActionDock` ausentes; 1 fail, 4 no ejecutados.
- GREEN: E2E C13+C14, 22/22. Lint, typecheck frontend, typecheck test, build, `security:public-surface` y Ledger 01B: PASSED.
- El catálogo añadió un spec: 114→115 total, 24→25 regression, 72→73 fixture, 36→37 visual-contract, 83→84 CI. Nico autorizó la realineación de los literales exactos afectados; el catálogo pasa 7/7, el workflow 16/16 y Ledger 01B 10/10. El spec C14 fue incorporado al índice Git mediante staging manual.
- Nico incorporó las dos primitivas al índice. Los guards y tests de fuente previamente bloqueados pasan 52/52 tras ajustar el orden de exports del barrel al contrato C13.
- Contratos zero-scroll seleccionados: 52/53 PASSED. El caso de hidratación del filtro móvil de Auditoría falló de modo reproducible por discrepancia `aria-hidden` entre servidor y cliente en la navegación; no importa las nuevas primitivas C14. Se informa fuera de scope.

## Riesgo residual y rollback

En el arnés C14 a 320×568, `main` tiene `overflow:hidden` y `scrollTop=0`, mientras su `scrollHeight` aumenta al desbordar contenido largo dentro del único scroll owner B16. Documento y body no desbordan; la medición cruda de `scrollHeight` de `main` requiere revisión separada si se convierte en criterio para este escenario. No se modificó B16 para ocultar la señal.

Rollback lógico: retirar las dos primitivas, su export y el spec/catálogo; restaurar `StudyTimeline` y sus assertions previas. B15/B16 y los consumidores productivos no necesitan migración inversa.
