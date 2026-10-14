# C10 · SuperSearchField

## Estado base y contrato

Rama `feat/dashboard-c10-super-search-field`, basada en `0b40f83d` (C09, PR #1865). El roadmap `AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` §§7, 45–50 fija un campo primario de 40 px, radio 20 px y ancho `clamp(280px, 44%, 832px)` dentro de una región de 56 px. B15 compone el slot `filters` sin asumir consultas; A05 protege las reservas geométricas y el `limit` adaptativo. A02, A03 y A08 protegen geometría, paginación y zero-scroll.

## Auditoría y decisión de adopción

S1 usa un formulario GET y query string; S2, S3, S6 y S7 usan drafts y aplicación manual; S4 y S5 filtran al cambiar. `FilterBar` es el contenedor compartido de cinco superficies; S4 y S5 tienen campos propios. Sus siete mecanismos y los parámetros, resultados, filtros y paginación están protegidos por §7.8. El roadmap divide campo (C10), chips y overflow (C11), y sheet móvil (C12), sin designar un consumidor para reemplazar en C10. Por ello C10 publica una primitiva presentacional controlada y la monta en un arnés de navegador dentro de `WorkspaceScaffold`. Ningún buscador productivo se migra aquí.

## API y comportamiento

`SuperSearchFieldProps` exige `label`, `value` y `onValueChange`. Admite `placeholder`, `disabled`, `busy`, `clearLabel`, atributos nativos de input y `ref` al campo. El consumidor conserva el estado y decide cuándo buscar. La limpieza emite una sola cadena vacía y devuelve el foco al input; su botón no envía formularios. Enter conserva el submit nativo del host; Escape no tiene acción universal. No hay debounce, requests, parámetros URL, navegación ni estado de consulta propios. El campo expone `role="searchbox"`, etiqueta asociada, foco visible y `aria-busy`; el icono y el indicador de carga son decorativos.

La ref compuesta conserva el cleanup retornado por una callback ref de React 19 y mantiene identidad estable mientras no cambie la ref del consumidor. Si la callback no retorna cleanup, recibe `null` al desprenderse; las refs objeto se limpian al desmontar o reemplazar el input.

## Geometría y validación

El input mide 40 px con radio 20 px, usa tokens existentes y ancho adaptable, sin CSS global. El arnés confirma 56 px para el host y prueba 1920×1080, 1366×768, 1280×720, 834×1194, 768×1024, 390×844 y 320×568. Comprueba valor vacío, edición, actualización externa, pegado y texto largo, IME, Enter, Escape, disabled, busy, limpieza, foco y ausencia de navegación. Incluye axe. Una mutación temporal de radio 20→21 px hizo fallar el E2E geométrico; tras restaurar el archivo, volvió a pasar.

Gates observados antes del follow-up, sobre `b0e24e27`: guard C10 RED antes de la implementación y GREEN después; C10 E2E 8/8; A02 21/21 superficies, A03 195/195 registros primarios y 234/234 hojas, A05 15/15 consumidores, A08 21/21 superficies (73/73 tests combinados); B15 6/6; catálogo 7/7; censo 01B 10/10 (621 assertions congeladas frente al techo 623); lint, typecheck, typecheck:test, build y security:public-surface PASSED. El radio mutado falló 1/1 y restaurado pasó 1/1.

La primera corrida completa de `e2e:visual-contract` terminó **FAILED** en `next dev`: 877 PASSED, 1 SKIPPED preexistente y 9 FAILED en contratos de navegación/shell ajenos a C10. Esos nueve casos se repitieron exactamente con el build del fixture servido por `next start`, `CI=true`, `VETNEB_E2E_PRODUCTION_RUNNER=1` y un worker: **PASSED 9/9**. La cohorte completa se repitió después sobre el mismo runner de producción con cuatro workers: **PASSED 886, SKIPPED 1**. Se conserva el fallo de dev como evidencia ambiental, sin atribuirlo a C10. `e2e:ci` completo no se ejecutó: C10 carece de adopter productivo, y se cubrió el spec nuevo, su cohorte visual y los contratos A02/A03/A05/A08/B15 solicitados.

## Follow-up de PR #1866

La revisión detectó que la callback ref previa descartaba el cleanup y cambiaba de identidad en cada render. El E2E RED observó `a:attach → a:null → a:attach` al actualizar el valor; la implementación corregida pasa 9/9 en el runner de producción. Una mutación temporal que sustituyó la llamada al cleanup por `ref(null)` volvió a poner la prueba en rojo. El arnés cubre además refs objeto, callbacks con y sin cleanup, cambio de callback, reemplazo del elemento, desmontaje y ausencia de cleanup duplicado.

Los cuatro fallos de `validate-backend` en el head publicado tenían dos causas C10: el spec nuevo excedía por 98 líneas la banda física de `frontend/e2e/**` y el guard C10 añadía un lector de archivos sin normalización; además, dos aserciones de conteo quedaron desactualizadas por el spec y la migración al lector canónico. El spec conserva sus escenarios en 61 líneas, el guard usa `readSourceFile`, y los conteos se realinearon a 111 specs y 423 importadores sin cambiar bandas ni pisos. Las cuatro pruebas dirigidas pasaron localmente (20/20 en el conjunto dirigido). `pnpm test` registró 5.328 PASSED, 1 SKIPPED y 1 test fallido por falta de DB aislada para `e2e-global-03b`; `validate:local` quedó BLOCKED por esa precondición. Frontend lint, typecheck, build, catálogo, seguridad y build backend pasaron. Esta evidencia es del árbol local corregido, todavía no del head publicado.

## Scope y rollback

El cambio se limita a la primitiva, el export, guard C10, spec E2E, catálogo y su censo causal. C11/C12, backend, CI, navegación, C05 y los buscadores existentes quedan fuera. El rollback lógico consiste en retirar esos archivos C10 y la entrada/censo correspondiente del catálogo; ningún dato ni contrato de consulta requiere rollback.
