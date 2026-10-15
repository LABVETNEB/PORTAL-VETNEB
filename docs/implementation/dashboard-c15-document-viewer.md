# C15 · DocumentViewer y ViewerToolbar

## Estado base y alcance

La rama `feat/dashboard-c15-document-viewer` partió de `5c5f74a6` (main con #1876 fusionada). `pdfjs-dist` ya estaba fijado en `6.4.299`. El árbol tracked y staged estaba limpio; se preservaron `frontend/AGENTS.md`, `frontend/CLAUDE.md`, cinco stashes y el worktree existente.

C15 publica un visor modal controlado, una toolbar, un adaptador PDF.js exclusivamente cliente y un contrato de fuente documental. No adopta ningún módulo S1–S7 ni modifica `ReportFileActions`, backend, CSP, CORS, dependencias, workflows o el owner de scroll del panel B16. C16 y las miniaturas quedan fuera.

## Contrato implementado

- El host entrega `open`, `onOpenChange`, título, fuente, orígenes HTTPS confiables y, si corresponde, un callback de descarga. El visor no infiere autorización por extensión de archivo ni ejecuta navegación o requests de dominio.
- Radix Dialog mantiene foco modal, Escape y bloqueo del fondo. El contenido dispone de un único scroll interno; al cerrar restaura el foco sin mover la página.
- El adaptador importa PDF.js dinámicamente en el navegador y fija un worker local del mismo paquete. Sólo dibuja la página activa en canvas. La toolbar presenta `numPages` real, navegación y zoom de 50–200%. Al cambiar página, zoom, documento o al cerrar, invalida la operación previa, cancela el RenderTask, espera su fin y destruye el loading task.
- Se admiten PDF, JPEG, PNG y WebP. Estados visibles: vacío, carga, error recuperable y fallback seguro. Las excepciones se sustituyen por mensajes genéricos; ni URL ni respuesta privada se muestran o registran.
- Se deshabilitan XFA y Wasm al abrir el PDF. No se importa el sandbox de PDF.js ni se copian los recursos `quickjs-eval.*` del paquete. El worker emitido en la compilación de prueba coincidió byte a byte con `pdf.worker.min.mjs` de `pdfjs-dist@6.4.299` (SHA-256 `9536359F1B8367850D485731CA1D5E45C159A7B7A0912325E539937AA21CEB18`). La distribución de recursos auxiliares de QuickJS queda fuera de C15.

## Pruebas y censos

El test de arquitectura C15 fue RED (0/2, archivos aún ausentes) y luego GREEN (2/2). El catálogo E2E pasó de 115 a 116 specs: regression 25→26, mocked 42→43, visual-contract 37→38, ci 84→85 y full 115→116. Sólo se realinearon esos conteos y las aserciones exactas derivadas; Ledger 01B, pisos, bandas y tolerancias quedaron intactos.

El E2E C15 ejecutó 5/5 en Chromium con documentos sintéticos: PDF multipágina, Worker creado y solicitado, terminación del Worker al cerrar, navegación, zoom, imágenes, URL rechazada, error recuperable, descarga delegada, foco, Escape, fullscreen y fallback, scroll modal y ausencia de la marca sintética privada en mensajes del navegador. Una aserción adicional detectó que el canvas anunciaba la página nueva antes de dibujarla; se corrigió. La revisión de la PR agregó una prueba RED/GREEN que alcanza ambos extremos de una imagen ampliada al 125 %, 150 % y 200 % en móvil y desktop. C13/C14 ejecutaron 22/22 en Chromium, incluidos B16 y mobile. Seguridad de superficie pública, lint, typecheck, catálogo y build Turbopack terminaron en PASSED.

Para verificar que Turbopack alcanza el adaptador, se creó una ruta temporal `c15-probe`, se compiló y se eliminó. Ese build emitió `pdf.worker.min.*.mjs` local, idéntico en SHA-256 al archivo instalado. La ruta no forma parte de la entrega.

Nico incorporó los ocho archivos nuevos al índice Git sin modificar el HEAD. El guard `frontend-native-link-preview-contract` se repitió de forma aislada y terminó **PASSED (9/9)**. No se cambió el staging manual ni fue necesaria una corrección de código.

La revisión de PR #1877 corrigió la promesa rechazada del import dinámico: dos llamadas concurrentes comparten un intento; tras el rechazo la caché se vacía y la siguiente llamada importa de nuevo, conservando los éxitos. La prueba dirigida pasó de RED a GREEN (3/3 en el guard C15). Los nueve fallos de Backend CI sobre el HEAD inicial se trazaron al spec y los guardas/censos afectados por C15: se reemplazó la espera temporal por una ruta pendiente observable, se hicieron analizables los matchers de `page.route`, se usó el lector canónico del guard de arquitectura, se realineó el recuento automático 115→116 y se declaró el chunk diferido de PDF.js en el ledger exacto. No se elevaron cotas ni se añadieron excepciones.

Los tres specs existentes de zero-scroll finalizaron dos veces en 52/53. El único fallo fue la aserción de hidratación del filtro móvil de Auditoría en `dashboard-real-app-shell-no-scroll-contract`: el HTML del `DashboardMobileNav` llegó con `aria-hidden="true"` y el cliente lo quitó. El mismo caso pasó aislado en la rama C15. Una copia temporal limpia de `main` en `5c5f74a6`, con la misma fixture y Playwright, reprodujo el mismo diff de hidratación en Webpack dev frío (FAILED 0/1) y pasó al repetirlo con el servidor caliente (PASSED 1/1); C15 pasó 1/1 bajo ese mismo modo Webpack. Al hacer esa comparación, el HEAD local y `main` eran el mismo commit; los archivos de navegación y el spec no difieren del `main` base de C15 y ningún consumidor productivo importa el visor. La copia y los procesos temporales se eliminaron. La evidencia apunta a una condición previa del renderizado/hidratación dependiente del entorno frío, sin causalidad de C15. El gate conjunto sigue **FAILED**; no se corrigió código ajeno al scope.

## Riesgo y estado

El host debe pasar sólo orígenes HTTPS efectivamente confiables y asegurar permisos/CORS del recurso. No se amplió CSP ni se creó proxy. Los PDF con recursos adicionales pueden requerir soporte de fuentes/CMap no cubierto por los documentos sintéticos C15; cualquier dependencia nueva o cambio de CSP/CORS exige un scope R2 separado. C15 queda **BLOCKED para READY_FOR_PR** únicamente por el gate conjunto de zero-scroll/hidratación aún FAILED en el entorno local; el guard de elementos embebidos ya está PASSED.
