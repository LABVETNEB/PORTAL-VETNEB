# C16 · ViewerThumbnails

## Estado base y alcance

Base: `172acf90` en `feat/dashboard-c16-viewer-thumbnails`, con C15 (#1877) integrado. El árbol tracked/staged estaba limpio; `frontend/AGENTS.md` y `frontend/CLAUDE.md` eran untracked previos y se preservaron. El viewer C15 ya tenía una `PdfSession` por PDF y un canvas principal. C16 agrega navegación visual reutilizable dentro del mismo diálogo, sin adopción de producto.

Incluido: `ViewerThumbnails`, extensión mínima de `PdfSession`, integración con `DocumentViewer`, pruebas dirigidas C16 y este registro. Excluido: backend, auth, DB, CSP, dependencias, workflows, C17–C22 y almacenamiento persistente.

## Diseño y auditoría previa

`PdfSession.load` hace una carga documental por sesión. `renderThumbnail` reutiliza el `PDFDocumentProxy` y asigna a cada página un canvas distinto del principal. La banda aparece sólo en PDF de más de una página; JPEG, PNG, WebP y PDF de una página conservan la geometría y los controles C15. Una miniatura única duplicaría la imagen principal sin aportar navegación.

La banda usa `IntersectionObserver` con el propio nav como root y 120 px de margen. Los botones existen para permitir selección directa de cualquier página; sólo las miniaturas próximas se renderizan. En escritorio el nav es lateral y tiene scroll vertical propio; en móvil va debajo del contenido y tiene scroll horizontal propio. El cambio de página mueve sólo ese nav; no invoca `scrollIntoView` sobre el documento.

El render principal suspende la cola de miniaturas y cancela sus tareas activas antes de usar el proxy de página. La cola permite dos miniaturas simultáneas. Cada miniatura cabe en 96 × 128 CSS px y usa como máximo DPR 2. Se conservan seis canvases terminados; puede haber otros dos en curso. Eso limita sus buffers RGBA a aproximadamente 1,5 MiB (8 × 192 × 256 × 4 bytes), aparte de las estructuras internas de PDF.js y del canvas principal. Al expulsar una miniatura se pone su canvas a 0 × 0; lo mismo sucede al cancelar o fallar. No hay blob URLs, data URLs, caché global ni almacenamiento persistente.

La revisión de #1878 detectó un ciclo cuando el área observada contenía más de seis páginas: cada expulsión volvía a marcar la miniatura como pendiente y la encolaba sin que hubiera cambiado la vista. Ahora la expulsión la deja en estado `evicted`, sin render automático mientras permanezca observada. Vuelve a solicitarse al salir y entrar en la zona observada o al seleccionar esa página. La caché conserva la página seleccionada y expulsa la más antigua entre las demás. Así el límite de seis canvases terminados y dos trabajos activos se mantiene incluso con más de seis páginas visibles. En el test RED, ocho o más páginas observadas provocaron 114 solicitudes adicionales en 60 fotogramas. En una corrida GREEN con runner de producción hubo 24 páginas observadas, 36 solicitudes, 19 completadas, 17 canceladas, 0 solicitudes repetidas de una página, pico de dos trabajos y seis bitmaps retenidos. Tras estabilizarse, durante otros 120 fotogramas no hubo nuevas solicitudes, cancelaciones ni expulsiones; los trabajos activos quedaron en cero.

Los aborts quitan trabajos pendientes de la cola o cancelan `RenderTask` activo. `destroy` cancela, espera las tareas y destruye la carga PDF.js. Los errores de una página no bloquean las demás; esa miniatura muestra un reintento propio. La página activa usa `aria-current="page"`, botones nativos y foco visible. La toolbar, Escape y el retorno de foco siguen bajo C15/Radix.

Las páginas aún no observadas permanecen `idle`: conservan su botón y número, pero no anuncian una carga inexistente. Sólo una solicitud real entra en `loading`; su botón expone la descripción accesible y la página seleccionada puede emitir un único `role="status"`. Los errores son locales y el reintento mantiene el mismo botón de página. Una miniatura expulsada muestra «Miniatura en espera» sin región viva.

## RED, GREEN y validaciones

RED: los contratos C16 fallaron antes de implementar por la ausencia del componente y de `renderThumbnail`.

GREEN: los contratos C16/C15 y los tres escenarios C16 en Chromium pasaron. Los PDF sintéticos usan colores distintos por página y el test comprueba píxeles del canvas, selección desde banda y toolbar, zoom, carga diferida, expulsión de caché, error y reintento individual, cambio de documento, axe, foco y scroll móvil. El contrato de sesión comprueba concurrencia 2, prioridad principal, una carga, error individual y cierre durante render.

`frontend-cross-build-continuity-contract` exige que todo archivo en `frontend/src` esté en el índice Git. `ViewerThumbnails.tsx` ya está tracked en el HEAD de #1878; el guard puede verificarse sin modificarlo.

Los conteos PRE del catálogo son `visual-contract=38`, `ci=85`, `extended=27` y `full=116`. C16 suma tres casos dentro del spec C15 ya catalogado; no agrega un spec ni cambia esos conteos, sus entradas o el ledger de imports diferidos.

## Resultado y riesgo residual

El presupuesto explícito cubre buffers de miniaturas, no la memoria interna del documento PDF.js. El DOM mantiene un botón por página; virtualización no se incorporó porque el render de bitmaps ya es diferido y acotado. Un PDF de miles de páginas podría requerir medir el costo de esos botones antes de agregar virtualización. No se guardan URLs firmadas ni bytes del documento en logs o almacenamiento.
