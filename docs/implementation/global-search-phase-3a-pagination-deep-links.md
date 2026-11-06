# GLOBAL-SEARCH-3A · Paginación universal y navegación profunda (frontend)

## 1. Estado base

- Base: `origin/main@87c2b6cc5aee9fcbd3e36d4e6787ed54e2e219cb` (#1967 motor, #1968 UI, #1969 lectura por id, todas fusionadas).
- Rama: `feat/global-search-3a-frontend` (la rama `feat/global-search-3a-deep-links` quedó en `75cf7530`, sin commits; moverla requiere operaciones NO-DELEGABLE).
- Scope primario: **frontend runtime**. Sin cambios de backend, migraciones ni dependencias.

## 2. Auditoría de contratos

| Contrato | Hallazgo | Consecuencia |
| --- | --- | --- |
| `GET /api/search` y `/api/admin/search` | cada entidad se ordena por separado con un orden total (rango, recencia, `id`); `offset` sólo con una entidad; `limit` 1..25; `offset` ≤ 500 | «Todo» puede paginarse exacto en el cliente (§3); el tope de 500 es el único límite real |
| `GET /api/reports/:reportId` (#1969) | lectura por id del tenant de la sesión, 404 uniforme | Informes de Clínica abre un informe fuera de la página cargada |
| `GET /api/admin/report-workflow/:id` (#1969) | ítem de workflow por id, misma forma que el listado | Informes de Admin abre el detalle de un informe fuera de la página cargada |
| Tokens, seguimientos sin informe, clínicas, usuarios | sin lectura por id | llevan a su módulo con el ancla de fila existente; posiciona la fila sólo si la página cargada la contiene (pendiente: GLOBAL-SEARCH-3B) |

## 3. Paginación universal

Un único contrato para Clínica, Admin, «Todo» y cada categoría (`frontend/src/lib/global-search-pager.ts` + `useGlobalSearchPager`):

- Cada entidad es un flujo consumido estrictamente en el orden del servidor. Una página de «Todo» es una **mezcla k-way** de esos flujos con el mismo comparador que usa el servidor (rango, recencia, orden de entidad, `id`). Una mezcla k-way emite cada fila de cada flujo exactamente una vez: no hay duplicados ni omisiones, y el orden es estable. Una categoría es el caso k = 1.
- Antes de cada página se pide, por entidad abierta, una ventana de una sola entidad (`kinds=<k>&offset=<consumido>&limit=<capacidad>`): como mucho una solicitud por entidad y página (3 en Clínica, 5 en Admin para «Todo»; 1 por categoría).
- Tamaño de página = capacidad medida del lienzo (`useDashboardCanvasCapacity`, pitch fijo de 52 px). Cambiar consulta, filtros, categoría o tamaño reinicia en la página 1; la sesión en vuelo se aborta (`AbortController`) y sus respuestas se descartan. «Anterior» reutiliza las páginas ya leídas.
- Controles «Anterior» / «Página N» / «Siguiente», deshabilitados en los extremos; anuncio `aria-live` (`sr-only`). El contador visible «N resultados en M categorías» se eliminó: el backend devuelve ventanas, no totales.
- **Límite real del backend**: `offset` ≤ 500 por entidad, es decir hasta 525 registros por entidad. Al llegar ahí, el paginador lo indica («afiná la búsqueda») y no pide fuera de rango. Levantarlo exige un cambio backend (cursor por entidad), propuesto como PR backend independiente.

## 4. Diálogo y móvil

- «Filtros» va inmediatamente después de la última categoría, en el mismo flujo (sin `ml-auto`).
- Los filtros avanzados abren una superficie propia que reemplaza la lista mientras está abierta («Ver resultados» / «Limpiar filtros»); la lista nunca gana scroll.
- Cabecera y filtros compactados; objetivos táctiles ≥ 44 px. Enter en el campo cierra el teclado virtual.
- El diálogo se apila en `z-80`, por encima de la barra móvil (60), la navegación inferior (65/70), el menú overflow (75) y los proxies de chips de `ModuleCard` (64). Antes quedaba debajo del chrome móvil.
- Corrección acotada en `mobile-chrome.css`: con el menú overflow abierto, los proxies invisibles de chips de `ModuleCard` (fijos, `z-index: 64`, en `body`) dejan de recibir punteros; antes un toque sobre un ítem del menú pintado encima de una fila de chips activaba el chip.

Capacidad medida (Chromium, Clínica, «Todo»):

| Viewport | Filas por página | Scroll lista / documento | Paginador visible y tocable |
| --- | ---: | --- | --- |
| 320×640 | 6 | 0 / 0 | sí |
| 360×740 | 9 | 0 / 0 | sí |
| 375×667 | 7 | 0 / 0 | sí |
| 390×844 | 11 | 0 / 0 | sí |
| 412×915 | 12 | 0 / 0 | sí |
| 430×932 | 12 | 0 / 0 | sí |
| 844×390 | 2 | 0 / 0 | sí |
| 1366×768 | 9 | 0 / 0 | sí |
| 1920×1080 | 9 (diálogo acotado a 46 rem) | 0 / 0 | sí |

## 5. Navegación profunda

- Destino tipado: informes (y seguimientos con informe) → `/dashboard/informes?reportId=<id>` (Clínica) y `/dashboard/admin?module=admin-report-upload&reportId=<id>` (Admin).
- Clínica: `page.tsx` resuelve el id en el servidor con `GET /api/reports/:reportId` cuando no está en la primera página; `InformesReportsList` lo mantiene seleccionado a través de los re-fetch de capacidad, muestra el detalle (diálogo donde el panel de escritorio no está pintado) y marca «no está en la página actual». Un 404 se anuncia («no existe o no está disponible para esta clínica») en lugar de seleccionar otro informe.
- Admin: `AdminReportsCard` lee `?reportId=` (`useRequestedReportId`) y abre el detalle con `GET /api/admin/report-workflow/:id`, con la forma propia del ítem del servidor.
- Recarga, Back y Forward funcionan porque el destino es estado de URL.
- Volver a la búsqueda: la sesión (consulta, filtros, categoría, página y registro abierto) vive en memoria por superficie durante la vida de la pestaña; la barra conserva la consulta y «Ver todos los resultados» la restaura. No se guarda en almacenamiento del navegador (las consultas contienen nombres de pacientes y tutores).

## 6. Validación

Ver el cuerpo de la PR. Resumen: pager unit (7) y contrato cliente (8) PASSED; spec E2E global-search 24/24 ×3 (72/72); `visual-contract` 1139 PASSED; `admin-mobile` 166 PASSED; `public-clinic` 371/374 con 3 fallos de `dashboard-clinic-metric-run-parity` (Logística, no tocado) que pasan 168/168 aislados ×2; A03, A05, G11, borde zero-scroll móvil y specs extendidos de Informes PASSED; A02 20/21 con `clinic-log-visitas` +2,76 px local (idéntico antes y después de este cambio; E2E Completeness Linux SUCCESS en #1968 y #1969).

## 7. Pendiente

- Backend: cursor por entidad para recorrer más allá de 525 registros por entidad (PR backend independiente, requiere autorización R2).
- GLOBAL-SEARCH-3B: lecturas por id de tokens, seguimientos, clínicas y usuarios para abrir esos registros fuera de la página cargada.
- GLOBAL-SEARCH-3C: rate limit del lado servidor (la paginación de «Todo» multiplica las solicitudes por entidad).
