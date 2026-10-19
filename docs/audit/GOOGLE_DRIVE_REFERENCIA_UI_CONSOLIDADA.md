# GOOGLE DRIVE — REFERENCIA UI CONSOLIDADA

**Tipo:** evidencia técnica de referencia sobre la interfaz web de Google Drive (producto externo).
**Repositorio:** LABVETNEB/PORTAL-VETNEB
**Origen de la evidencia:** laboratorio local REA-LAB (fuera de este repositorio), ejecuciones del 2026-10-18 y 2026-10-19.
**Naturaleza del cambio:** docs-only. No modifica código, tests, configuración, dependencias ni documentos rectores.

| Campo | Valor |
| --- | --- |
| Document owner | Dashboard / Frontend domain owner |
| Domain | Referencia externa: interfaz web de Google Drive (vista «Mi unidad») |
| Lifecycle status | REFERENCE (evidencia; no rector) |
| Authoritative source role | Evidencia medida de Google Drive para comparaciones futuras. **No** es fuente de implementación del dashboard. |
| Fuente rectora del rediseño Drive-like | [AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md](./AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md) (sin cambios) |
| Effective date | 2026-10-19 |
| Last verified date | 2026-10-19 |
| Review cadence | Ante una nueva ejecución de medición o ante cambios visibles de Google Drive |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Evidence or approval reference | Manifiestos de laboratorio con SHA-256 (§XIV.2); incorporación pendiente de PR docs-only gestionado por Nico |

> **Relación con la fuente rectora.** La auditoría `AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` sigue siendo la **única fuente autorizada para planificar e implementar** el rediseño Drive-like (índice de `docs/audit/README.md` y `docs/SOURCES_OF_TRUTH.md`). Este documento no fija destinos, no define programas ni PR y no reemplaza sus §24–§26. Registra **qué mide Google Drive** con trazabilidad completa, para que una auditoría comparativa futura pueda contrastar mediciones. Las divergencias entre ambas fuentes se listan en §XIV.4 sin resolverse.

> **Privacidad.** Ningún valor de este documento procede de texto, nombres de archivos, URLs, identificadores, correos ni contenido de la cuenta inspeccionada. Sólo hay geometría, estilos calculados, roles ARIA, atributos de estado enumerados y recuentos. Los recuentos (37 elementos, 18 carpetas, 19 archivos) son las únicas cifras derivadas del contenido.

---

## Índice

- [I. Alcance y metodología](#i-alcance-y-metodología)
- [II. Arquitectura general](#ii-arquitectura-general)
- [III. Sistema visual](#iii-sistema-visual)
- [IV. Tablas y listados](#iv-tablas-y-listados)
- [V. Vista cuadrícula](#v-vista-cuadrícula)
- [VI. Responsive y breakpoints](#vi-responsive-y-breakpoints)
- [VII. Estados interactivos](#vii-estados-interactivos)
- [VIII. Navegación y menús](#viii-navegación-y-menús)
- [IX. Paneles laterales](#ix-paneles-laterales)
- [X. Accesibilidad](#x-accesibilidad)
- [XI. Animaciones y microinteracciones](#xi-animaciones-y-microinteracciones)
- [XII. Matriz de cobertura](#xii-matriz-de-cobertura)
- [XIII. Especificación de comparación con VETNEB](#xiii-especificación-de-comparación-con-vetneb)
- [XIV. Procedencia y validación](#xiv-procedencia-y-validación)

---

## I. Alcance y metodología

### I.1 Objetivo

Disponer de una especificación verificable y reproducible de la interfaz observable de Google Drive (geometría, sistema visual, tipografía, responsive, estados, menús, paneles y accesibilidad), utilizable como referencia de medición sin depender del laboratorio ni de esta conversación.

### I.2 Objeto inspeccionado y condiciones

| Condición | Valor |
| --- | --- |
| Aplicación | `https://drive.google.com`, ruta `/drive/my-drive` (Mi unidad), vista **lista** salvo §V |
| Contenido de la vista | 37 elementos: 18 carpetas y 19 archivos (recuento) |
| Navegador | Chrome/155.0.8059.80, perfil aislado de laboratorio, sesión autenticada |
| Viewport nativo | 1920 × 945 CSS px (ventana 1920 × 1032), DPR 1 |
| Tema | Claro (INFERIDO de los colores medidos: fondo `rgb(255,255,255)`, texto `rgb(31,31,31)`) |
| Fechas | Run 1: 2026-10-18 · Run 2 y ampliaciones: 2026-10-19 (≈ 03:02 → 04:38 UTC) |

### I.3 Herramientas

| Herramienta | Versión | Uso |
| --- | --- | --- |
| CDP directo (Node.js 24, sin dependencias) | — | Conexión sólo a `127.0.0.1:9222`, una única pestaña de origen `https://drive.google.com` |
| `drive-cdp-metrics.mjs` | v2 (run 1) · v3 (run 2) | Captura completa de componentes por viewport |
| `drive-cdp-explore.mjs` | v4 | Extracción pasiva, capturas adicionales, breakpoints, hover/foco, scroll, menús |
| `drive-cdp-interact.mjs` | v5 | Operaciones autorizadas A1, A5–A8 (cuadrícula, árbol, diálogos, menú de título, rail) |
| REA MCP | — | Sólo `list_browser_targets` (verificación de pestaña). `inspect_web_page` **no** se usó: exporta URLs con identificadores privados |

Método común:

- Funciones de página fijas y auditadas, ejecutadas en un **mundo aislado**.
- Lecturas permitidas: `getBoundingClientRect`, `getComputedStyle` (también de `::before` y `::after`), `tagName`, `role` y atributos de estado ARIA enumerados.
- Texto: sólo se detecta su caja con `Range`; el contenido no se lee.
- Salida: se reconstruye campo por campo con un esquema de lista blanca, se valida con gramáticas CSS y con un validador final que rechaza correos, URLs, identificadores largos y caracteres fuera de ASCII imprimible, y se escribe versionada sin sobrescribir.
- Pruebas offline: v3 15/15, v4 19/19, v5 18/18.

### I.4 Viewports

| Grupo | Viewports | Método |
| --- | --- | --- |
| Referencia | 1920 × 945 (nativo), 1920 × 1080, 1440 × 900, 1366 × 768 | Captura completa v3 (run 1 y run 2) |
| Adicionales | 1536 × 864, 1280 × 800, 1024 × 768, 768 × 1024, 390 × 844, 375 × 667, 320 × 568 | Captura completa v3 vía v4 |
| Barrido | 179 firmas de ancho entre 320 y 1920 px, alto 900 | Búsqueda binaria a 1 px con confirmación |

Toda la emulación usa `Emulation.setDeviceMetricsOverride` con DPR 1 y `mobile: false`. Los anchos ≤ 768 representan **una ventana de escritorio estrecha**, no un dispositivo móvil, táctil ni con user agent móvil.

### I.5 Clasificación de la evidencia

| Estado | Significado |
| --- | --- |
| **OBSERVADO** | Valor leído directamente del navegador |
| **DERIVADO** | Calculado a partir de valores observados y verificado en todos los puntos medidos de su intervalo |
| **INFERIDO** | Hipótesis compatible con los datos, sin demostración suficiente |
| **NO RESUELTO** | Sin evidencia suficiente |
| **NO APLICA** | La categoría no corresponde al componente |

### I.6 Restricciones de privacidad aplicadas

- No se leyó `innerText`, `textContent`, `value`, `placeholder`, `aria-label`, `href`, `src`, `title`, `name` ni `id`.
- No se accedió a cookies, almacenamiento, tráfico de red ni DOM completo.
- No se tomaron capturas de pantalla.
- No se abrió, editó, compartió, descargó ni eliminó ningún archivo.
- No se aplicó ningún filtro ni se escribió texto.

Toda interacción fue una transacción con estado previo, medición, restauración y verificación.

### I.7 Limitaciones de cobertura (resumen; detalle en §XII)

- **A2, A3 y A4 pendientes:** selección, menú contextual de archivo y panel de detalles. No se llegó a identificar sin ambigüedad, en el navegador del laboratorio, la vista con los elementos ficticios de prueba.
- **A8 parcial:** los paneles de aplicaciones del rail derecho no se abrieron, porque mostrarían datos de servicios de la cuenta.
- **Estados no observados:** pressed, loading, `checked=true` y fila seleccionada.
- **Fuera de alcance:** tema oscuro, otra altura de viewport, otro DPR, zoom real y emulación móvil real.

---

## II. Arquitectura general

### II.1 Regiones a 1920 × 945 (OBSERVADO)

Coordenadas `x,y ancho×alto` en px CSS.

| Región | Elemento / rol | Caja | Notas |
| --- | --- | --- | --- |
| Header | `header[role=banner]` | 0,−1 1920×64 | Fondo `rgba(0,0,0,0)`, sin sombra, `position: relative`, `z-index: 986` |
| Logotipo | `a` | 20,9 102.02×48 | Texto «Product Sans» 22 px / 400 / 48 px |
| Buscador | `form[role=search]` | 256,7 722×48 | Ver §II.3 |
| Botones del header | `div[role=button]` / `button` | 40×40 en x = 1514, 1558, 1602, 1649; botón tonal 108×40 en x = 1702; `a[role=button]` 40×40 en x = 1818 y 1866 | 10 botones visibles |
| Botón principal | `button` | 16,71 113.81×56 | Fondo blanco, radio 16 px, padding 16 / 20 px, sombra de 3 capas (§III.4). Fuera de `role=navigation`. Función («Nuevo») INFERIDA |
| Sidebar | `nav[role=navigation]` | 16,143 224×454 | Árbol 224×320 en 16,143 (§VIII.1) |
| Título de página | `div[role=button][aria-haspopup=true]` | 261,79 152.72×40 | Radio 100 px; texto 24 px / 400 / 32 px «Google Sans»; abre el menú de §VIII.2. Función de breadcrumb INFERIDA |
| Toolbar de filtros | `div[role=toolbar]` | 273,131 456.53×40 | 4 chips (§IV.7) |
| Toolbar de vista | `div[role=toolbar]` | 1658,63 194×64 | Conmutador lista/cuadrícula (`radiogroup`) y botón de detalles 32×32 |
| Contenedor principal | `div[role=main]` | 257,175 1607×754 | `display: flex`; fondo transparente |
| Contenedor de scroll | `c-wiz` | 257,175 1607×754 | `overflow-y: scroll`, `scrollHeight` 1924, scroll máximo 1170 |
| Tabla | `table[role=grid]` | 277,175 1567×1824 | 20 px de inset lateral dentro de `main` |
| Rail derecho | `div[role=complementary]` | 1864,63 56×882 | `tablist` 56×826 con 5 `tab` 56×56; conmutador 56×56 en 1864,889 |
| Navegación de salto | `div[role=navigation]` fuera de pantalla | 448.72,−1000 1022.58×48 | 3 botones que aparecen en y = 4 al recibir foco (§X.2) |

### II.2 Documento y capas (OBSERVADO)

| Propiedad | Valor |
| --- | --- |
| `body` | `min-width: 1000px` · `overflow-x: auto` · `overflow-y: hidden` · fondo `rgb(255,255,255)` |
| Shell | `display: grid` de 1920×945; el área de trabajo es otro grid desde y = 63 con `min-width` de 468 px |
| Cabecera de tabla | `thead` `position: sticky` · `top: 0` · `z-index: 2300` · fondo blanco |
| Menús GM3 | `z-index: 2300` |
| Tooltips | `z-index: 6000` |
| Contenedores de scroll | 1 (el del listado) |
| Estabilidad observada | 0 entradas `layout-shift` con la pestaña ya cargada; FCP registrado de 660 ms; 5 498 elementos DOM estables a 0, 1 y 3 s. El desplazamiento durante la carga no se evaluó |

### II.3 Buscador (OBSERVADO)

| Elemento | Valor |
| --- | --- |
| Formulario | 722×48 en 256,7 · fondo `rgb(233,238,246)` · radio 24 px · borde inferior 1 px · transición `background, width 0.1s ease-in, ease-out` |
| Input | 616×20 en 313,22 · «Google Sans» 16 px / 400 · color `rgb(31,31,31)` · posición absoluta |
| Segundo input superpuesto | Misma caja · color `rgb(192,192,192)` (texto fantasma de autocompletado: INFERIDO) |
| Botones internos | 56×46 en x = 257, 877 y 921 · padding 5 px · sin radio · el de búsqueda tiene capa `::before` con transición de opacidad 0.3s |

### II.4 Relaciones geométricas (DERIVADO, verificadas en todos los anchos medidos)

| Regla | Intervalo | Anchos verificados |
| --- | --- | ---: |
| `main.width = viewport − 313` (rail visible) | viewport ≥ 1000 | 140 |
| `main.width = 687` | viewport < 1000 (documento fijo en 1000) | 9 |
| `main.width = viewport − 273` (rail oculto) | 1280, 1440, 1920 | 3 |
| `grid.width = main.width − 40` (20 px por lado) | 320–1920 | 149 |
| `toolbar_vista.x = viewport − 262` | 1366–1920 | 4 |
| `Σ anchos de columna = grid.width − 10` | 320–1920 | 149 |
| Buscador: ver §VI.3 | — | — |

Invariantes en 11 resoluciones (OBSERVADO):
- header de 64 px;
- sidebar de 224 px en x = 16, que no colapsa;
- `main` en x = 257, y = 175;
- tabla en x = 277;
- fila de 48 px;
- toolbar de filtros de 456.53×40;
- 10 botones del header.

A 320 × 568 la sidebar mide 216 px, por una barra de desplazamiento con altura reducida (DERIVADO de §VIII.1).

---

## III. Sistema visual

### III.1 Paleta (OBSERVADO; roles DERIVADOS del uso)

Fuente: `drive-design-tokens.json`, en el viewport nativo, más estados de hover y foco, menús y tooltips. Hay 30 colores únicos, con recuento de apariciones por uso.

| Hex | Valor CSS | Apariciones | Uso dominante | Rol |
| --- | --- | ---: | --- | --- |
| `#444746` | `rgb(68,71,70)` | 149 | texto 61, iconos, hover, foco | Texto secundario e iconos |
| `#1f1f1f` | `rgb(31,31,31)` | 126 | texto 71, capa de hover | Texto primario; capa de estado |
| `#000000` | `rgb(0,0,0)` | 64 | texto 14, foco | Texto de controles nativos |
| `#4d90fe` | `rgb(77,144,254)` | 33 | contorno de foco | Anillo de foco 1 px |
| `#0b57d0` | `rgb(11,87,208)` | 31 | contorno de foco, acento | Acento; anillo de foco GM3 |
| `#ffffff` | `rgb(255,255,255)` | 26 | fondos, menús | Superficie |
| `#747775` | `rgb(116,119,117)` | 25 | bordes 24 | Borde de chip |
| `#c7c7c7` | `rgb(199,199,199)` | 8 | bordes | Separador de fila/cabecera |
| `#f2f2f2` | `rgb(242,242,242)` | 8 | texto de tooltip | Texto sobre tooltip |
| `#303030` | `rgb(48,48,48)` | 7 | fondo de tooltip | Tooltip |
| `#004a77` | `rgb(0,74,119)` | 5 | texto/icono | Texto sobre selección |
| `#c2e7ff` | `rgb(194,231,255)` | 3 | fondo | Elemento activo / seleccionado |
| `#e9eef6` | `rgb(233,238,246)` | 1 | fondo | Buscador |
| `#d3e3fd` | `rgb(211,227,253)` | 1 | fondo | Botón tonal del header |
| `#f8fafd` | `rgb(248,250,253)` | 1 | fondo (hover) | Superficie secundaria |
| `#dde3ea` | `rgb(221,227,234)` | 2 | fondo (foco) | Foco por teclado en la navegación (§VII.3) |
| `#0842a0` | `rgb(8,66,160)` | 1 | texto | Acento oscuro |
| `#c0c0c0` | `rgb(192,192,192)` | 1 | texto | Texto fantasma del buscador |
| `#1a72e7` | `rgb(26,114,231)` | 2 | contorno de foco | Variante de foco |
| `#6991d6` | `rgb(105,145,214)` | 2 | fondo (foco) | Variante de foco |

Translúcidos observados:
- **Foco:** `rgba(60,64,67,0.1)` en el botón 40×40 del header con foco; además `rgba(232,234,237,0.984)`, `rgba(66,133,244,0.118)` y `rgba(241,243,244,0.992)`.
- **Sombras:** `rgba(0,0,0,0.2|0.14|0.12)` y `rgba(60,64,67,0.3|0.15)`.
- **Borde:** `rgba(100,121,143,0.12)`.

**Capas de estado (OBSERVADO):**
- hover `rgb(31,31,31)` al **8 %** (opacidad 0.08), en `::before` o `::after` de botones de icono, cabeceras de columna y filas;
- en chips, `rgb(68,71,70)` al 8 %;
- foco en los botones del buscador: opacidad de `::before` ≈ 0.11–0.12.

### III.2 Superficies y bordes (OBSERVADO)

| Superficie / borde | Valor |
| --- | --- |
| Página y tabla | `rgb(255,255,255)` |
| Header | Transparente, sin sombra |
| Buscador | `rgb(233,238,246)` |
| Mosaicos y tarjetas de la cuadrícula | `rgb(240,244,249)` (§V) |
| Elemento activo de la navegación | `rgb(194,231,255)` |
| Fila y cabecera | `border-bottom: 1px solid rgb(199,199,199)` |
| Chip | `1px solid rgb(116,119,117)` (48 apariciones) |
| Separador de menú | 1 px `rgb(199,199,199)` (diálogos de filtro) |

### III.3 Radios (OBSERVADO)

| Radio | Dónde |
| --- | --- |
| 4 px | Menús del header y del título; tooltip |
| 8 px | Chips; menús y diálogos de chips; cabeceras (capa) |
| 12 px | Mosaicos y tarjetas de la cuadrícula; avatar 24×24 de los diálogos |
| 16 px | Radio del conmutador de vista; botón principal |
| 18 px | Botones de 36×36 (filas, toolbars) |
| 20 px | Botones de 40 px; botón de cabecera de tabla 108.53×40; botones de diálogo |
| 22 px | Botón tonal 108×40 del header |
| 24 px | Buscador |
| 100 px | Elementos de navegación; botón de título |
| 9999 px / 50 % | Botones circulares de icono |
| `min(100%, 20px)` | Botón 40×40 del header en x = 1649 (resuelve los 16 valores `[filtrado]` de run 2) |

### III.4 Sombras y elevación (OBSERVADO)

| Uso | `box-shadow` |
| --- | --- |
| Menús GM3 (header, chips) | `rgba(0,0,0,0.2) 0 2px 4px -1px, rgba(0,0,0,0.14) 0 4px 5px 0, rgba(0,0,0,0.12) 0 1px 10px 0` |
| Menú *legacy* del header (x = 1558) | `rgba(60,64,67,0.3) 0 1px 2px 0, rgba(60,64,67,0.15) 0 2px 6px 2px` |
| Botón principal | `rgba(0,0,0,0.2) 0 3px 1px -2px, rgba(0,0,0,0.14) 0 2px 2px 0, rgba(0,0,0,0.12) 0 1px 5px 0` |
| Barra de navegación de salto | `color(srgb 0 0 0 / 0.14) 0 3px 4px 0, color(srgb 0 0 0 / 0.12) 0 3px 3px -2px, color(srgb 0 0 0 / 0.2) 0 1px 8px 0` |
| Foco por teclado en la navegación | `color(srgb 0 0 0 / 0.1) 0 1px 2px 0` |
| Header, tabla, chips, tooltip | `none` |

No hay sombra en el chrome persistente. La elevación se reserva a menús, al botón principal y a la barra de salto.

### III.5 Espaciado y densidad

| Medida | Valor | Estado |
| --- | --- | --- |
| Padding no nulo más frecuente | 9 px (84; botones de 36), 8 (16), 3 (12), 5 (12), 6 (10), 12 (9), 20 (6), 17 (4) | OBSERVADO |
| Margin no nulo más frecuente | 4 px (36), 8 (16), 2 (12), 6 (8) | OBSERVADO |
| `gap` de toolbar | 200 px (barra de salto); 16 px (cuadrícula) | OBSERVADO |
| Valores no nulos múltiplos de 4 / de 8 | 37 % / 16 % de 252 | OBSERVADO |
| Escala de 4 u 8 px | **No demostrada** (escala mixta) | INFERIDO |
| Altura de fila de la tabla | 48 px | OBSERVADO |
| Elemento de navegación | 224×32, paso 32, grupos separados 16 px | OBSERVADO |
| Chips y radios de vista | 32 px de alto | OBSERVADO |
| Opciones de menú | 32 px (header y título) / 40 px (chips) | OBSERVADO |

### III.6 Tipografía (OBSERVADO)

| Tamaño / peso / line-height | Letter-spacing | Uso | Color |
| --- | --- | --- | --- |
| 14 / 400 / 48 px | normal | Celdas de la tabla | `rgb(68,71,70)` |
| 14 / 500 / 20 px | normal | Nombre de archivo, navegación destacada | `rgb(31,31,31)`, `rgb(11,87,208)`, `rgb(8,66,160)` |
| 14 / 400 / 26 px | normal | Elementos de navegación | `rgb(31,31,31)`; activo `rgb(0,74,119)` |
| 14 / 500 / 48 px | normal | Cabeceras de columna | primera `rgb(31,31,31)`, resto `rgb(68,71,70)` |
| 14 / 500 / 16 px | normal | Chips | `rgb(68,71,70)` |
| 14 / 400 / 20 px | normal | Texto base (`body`), opciones de menú de chips | `rgb(31,31,31)` |
| 13 / 400 / 20 px | normal | Menús del header | `rgb(31,31,31)` |
| 12 / 400 / 16 px | 0.1 px | Tooltip | `rgb(242,242,242)` |
| 12 / 500 / normal | normal | Texto auxiliar del buscador | `rgb(116,119,117)` |
| 16 / 400 | — | Input de búsqueda («Google Sans») | `rgb(31,31,31)` |
| 22 / 400 / 48 px | normal | Logotipo («Product Sans») | `rgb(31,31,31)` |
| 24 / 400 / 32 px | normal | Título de página («Google Sans») | `rgb(31,31,31)` |

- **Familias declaradas:**
  - `"Google Sans Text", "Google Sans", Roboto, Arial, sans-serif` (base);
  - `"Google Sans Flex", …` (destacados);
  - `"Product Sans", Arial, sans-serif` (logotipo);
  - `Roboto, Arial, sans-serif` (opciones del menú *legacy*).
- **Fuentes cargadas** (`FontFace` en estado `loaded`, OBSERVADO): «Google Sans Text» 400 y 500, «Product Sans» 400.
- **Renderizado efectivo NO RESUELTO:** «Google Sans» y «Google Sans Flex» (su hoja es de otro origen; `document.fonts.check` no lo demuestra).
- **Roboto:** caras declaradas sin cargar.
- **Truncado:** una línea con `white-space: pre` o `nowrap` y `text-overflow: ellipsis` en celdas, navegación y chips.

### III.7 Iconografía (OBSERVADO)

| Región | Tamaños |
| --- | --- |
| Header | svg 24 y 40 px, fill `rgb(68,71,70)`; img (avatar/logotipos) 32–44 px |
| Navegación | svg 20×20; chevron 12×12 |
| Toolbars | 18–20 px |
| Filas | img 24×24 (tipo de archivo); svg 16, 18 (acciones, 4 por fila a ≥ 1480 px) y 24 |
| Menús | 20 px (título y header); 24 y 18 px (chips); 40×24 (menú del header) |
| Cuadrícula | 24 px (carpeta), 16 px (cabecera de tarjeta) |

---

## IV. Tablas y listados

### IV.1 Estructura (OBSERVADO)

- **Tabla:** `table[role=grid]` → `thead > tr[role=presentation] > th` (5) y `tbody > tr[role=row] > td`.
- **Roles de celda:** no hay `role=gridcell` ni `role=columnheader` explícitos.
- **`aria-sort`:** ausente.
- **Filas:** 37 en el DOM.

### IV.2 Columnas por viewport (OBSERVADO)

Formato `x relativa a la tabla / ancho` de las celdas `td`. En cada viewport se compararon 8 filas; todas las columnas son coherentes entre filas. `*` marca la cabecera desalineada (x de la cabecera).

| Viewport | Tabla | Col. 0 | Col. 1 | Col. 2 | Col. 3 | Col. 4 |
| --- | ---: | --- | --- | --- | --- | --- |
| 1920 × 945 / 1080 | 1567 | 1 / 847 | 848 / 215 | 1063 / 215 | 1278 / 88 | 1366 / 192 * 1372 |
| 1536 × 864 | 1183 | 1 / 463 | 464 / 215 | 679 / 215 | 894 / 88 | 982 / 192 * 988 |
| 1440 × 900 | 1087 | 1 / 661 | 662 / 140 | 802 / 140 | 942 / 88 | 1030 / 48 * 1036 |
| 1366 × 768 | 1013 | 1 / 587 | 588 / 140 | 728 / 140 | 868 / 88 | 956 / 48 * 962 |
| 1280 × 800 | 927 | 1 / 501 | 502 / 140 | 642 / 140 | 782 / 88 | 870 / 48 * 876 |
| 1024 × 768 | 671 | 1 / 473 | 474 / 140 | 614 / 48 * 620 | — | — |
| 768 / 390 / 375 / 320 | 647 | 1 / 449 | 450 / 140 | 590 / 48 * 596 | — | — |

- **Columna 0:** única flexible, con `flex-grow: 1`, `flex-basis: 384px` y `min-width: 384px`. Las demás son fijas (`flex-grow: 0`, base igual al ancho). Transición `width, flex-basis 0.25s ease-in-out` (OBSERVADO).
- **Función de cada columna:** NO RESUELTA, porque no se lee texto y no hay `aria-sort` ni `columnheader`. Que la última sea la de acciones es INFERIDO (contiene los botones por fila).

### IV.3 Cabecera (OBSERVADO)

| Propiedad | Valor |
| --- | --- |
| Fila | 1567×48 · flex · padding-right 2 px · 14 px / 500 / 48 px · color `rgb(68,71,70)` · borde inferior 1 px `rgb(199,199,199)` |
| Celdas `th` | 46 px de alto (y = 1 dentro de la fila) · flex · `align-items: center` · padding `0 8px 0 6px` (última: 0) |
| Sticky | `top: 0` · `z-index: 2300` · fondo blanco; permanece en y = 175 al desplazar 240, 960 y el máximo |
| Hover | Capa `::after` del tamaño de la celda (847×46 en la col. 0), `rgb(31,31,31)` al 8 % |
| Control interno | `button` 108.53×40 en 1732.47,179 · radio 20 · padding 12/16 px (función INFERIDA: ordenación/vista) |

**Anomalía registrada:**
- La cabecera de la **última columna** está desplazada **+6 px** respecto de sus celdas en las 11 resoluciones (en 1024 y menos, la columna 2 de 3). El ancho coincide.
- La celda de cabecera anterior deja un hueco de 6 px (`gap_to_next = 6`).
- **Causa NO RESUELTA.**

### IV.4 Filas y celdas (OBSERVADO)

| Propiedad | Valor |
| --- | --- |
| Fila `tr[role=row]` | 1567×48 a 1920 · flex · line-height 48 px · padding-right 2 px · borde inferior 1 px `rgb(199,199,199)` · paso 48 px |
| Celda `td` | 48 px · `align-items: center` · padding `0 6px` (col. 0: `0 24px 0 0`; última: 0) |
| Tipografía | Nombre 14 px / 500 / 20 px `rgb(31,31,31)`; resto 14 px / 400 `rgb(68,71,70)` |
| Hover | Texto de celdas `rgb(68,71,70)` → `rgb(31,31,31)`; capa `rgb(31,31,31)` al 8 % de 1565×47 (la identidad del nodo es INFERIDA por desalineación de índices) |
| Foco por teclado | Una sola parada de Tab para todo el listado (fila 0); indicador no localizado en el elemento ni en sus pseudo-elementos (NO RESUELTO) |
| Truncado | `text-overflow: ellipsis` en el texto de celdas |

### IV.5 Botones por fila (OBSERVADO)

| Contenedor | Por fila | Detalle |
| --- | ---: | --- |
| ≥ 1127 px | 6 | Toolbar de acciones 144×36 con 4 botones 36×36 (x = 1655, 1691, 1727, 1763 a 1920) + botón de menú 36×36 (x = 1799) + `div[role=button]` 47×48 |
| 833–1126 px | 2 | `div[role=button]` 47×48 + botón 36×36 con `aria-haspopup` |
| ≤ 744 px | 1 | — |
| Estilo | — | Padding 9 px · radio 18 px · color `rgb(68,71,70)` (el de menú: `rgb(31,31,31)`) · `outline-width: 3px` |

`aria-haspopup` por fila (1920): `dialog` ×2, `false` ×2, `menu` ×1.

### IV.6 Recuentos corregidos (OBSERVADO)

En run 1 los selectores amplios contaban también los controles de cada fila. Run 2 los separó; los valores de run 1 se conservan.

| Selector | Run 1 (1920) | Fuera de la tabla | Dentro de las filas |
| --- | ---: | ---: | ---: |
| `[role=toolbar]` | 39 | 2 | 37 (1 por fila) |
| Botones de toolbar | 155 | 7 | 148 (4 × 37); 222 botones de fila en total |
| `[role=main] [aria-haspopup]` | 185 | 0 | 185 (5 por fila) |

**Corrección posterior:** los 4 chips de filtro **sí** tienen `aria-haspopup`: `menu`, `dialog`, `dialog` y `menu`. El selector de run 2 no los encontraba porque los chips están fuera de `role=main` (y = 131, mientras `main` empieza en y = 175).

### IV.7 Chips de filtro (OBSERVADO)

| Propiedad | Valor |
| --- | --- |
| Anchos | 82.83, 114.22, 128.28, 99.2 px · alto 32 · separación 8 px (x = 277, 367.83, 490.05, 626.33) |
| Estilo | `div[role=button]` · radio 8 · borde 1 px `rgb(116,119,117)` · fondo blanco · 14 / 500 / 16 px `rgb(68,71,70)` · margin-left 4 px · icono 18 px |
| Hover | Capa `rgb(68,71,70)` al 8 %; icono de 18 → 20 px y fill `rgb(68,71,70)` → `rgb(0,0,0)`; cambia la estructura interna (5 → 6 descendientes visibles) |

### IV.8 Selección (A2)

**NO RESUELTO.** No hay evidencia de fila seleccionada, casilla ni toolbar contextual de selección; la operación A2 está pendiente. La única evidencia es negativa: tabular hasta la fila **no** la selecciona (`aria-selected=true` siguió en 0).

### IV.9 Scroll y virtualización (OBSERVADO)

- Con el `scrollTop` en 0, 240, 960 y el máximo (1170) hay siempre 37 filas en el DOM, de las que entre 14 y 16 son visibles.
- El DOM mantiene 5 498 elementos en todas las posiciones; no hay reciclado ni carga incremental con este volumen.
- La virtualización en listas largas queda NO RESUELTA.

---

## V. Vista cuadrícula

Fuente: operación A1, `drive-grid-view.json`. Se cambió a cuadrícula, se midió y se volvió a lista con restauración **PASS**.

### V.1 Estructura (OBSERVADO)

- **Contenedor:** `div[role=row]` con `display: grid`, `gap: 16px` y pistas iguales.
- **Elementos:** `div[role=gridcell]`.
- **Secciones:** sin encabezados con rol en `main`; carpetas y archivos se distinguen sólo por la geometría (DERIVADO).

### V.2 Elementos (OBSERVADO a 1920 × 945)

| Elemento | Cantidad | Dimensiones | Estilo |
| --- | ---: | --- | --- |
| Mosaico de carpeta | 18 | 246.83×48 · paso vertical 65 px | Fondo `rgb(240,244,249)` · radio 12 · icono 24 px en x+12 · caja de texto en x+48 (14 / 500 / 20 `rgb(31,31,31)`) · botón de menú 32×32 a la derecha (x+211) |
| Tarjeta de archivo | 19 | 246.83×246.84 (cuadrada) · paso vertical 263–264 px | Fondo `rgb(240,244,249)` · radio 12 · banda superior de 48 px (icono 16 px en x+16, texto en x+48, menú 32×32) · miniatura **sólo como contenedor geométrico** 230.83×219.28 en x+8, y+48 |
| Separación horizontal entre cajas | — | 17 px (las celdas miden 1 px menos que su pista de 16 px de gap) | — |

**Hover sobre una tarjeta:**
- **Capa de fondo:** pasa de `rgb(240,244,249)` a `rgb(68,71,70)` con opacidad 0.15. El nodo exacto es INFERIDO.
- **Tooltip:** el mismo estilo que en la lista (§VII.2).
- **Restauración:** al retirar el ratón no queda ningún cambio.

### V.3 Columnas por ancho (OBSERVADO; regla DERIVADA)

| Viewport | Contenedor | Columnas | `grid-template-columns` | gap |
| --- | ---: | ---: | --- | --- |
| 1920 | 1567 | 6 | 247.83 px × 6 | 16 px |
| 1536 | 1183 | 5 | 223.80 px × 5 | 16 px |
| 1440 | 1087 | 4 | 259.75 px × 4 | 16 px |
| 1366 | 1013 | 4 | 241.25 px × 4 | 16 px |
| 1280 | 927 | 3 | 298.33 px × 3 | 16 px |
| 1024 | 671 | 2 | 327.5 px × 2 | 16 px |
| 1000 | 647 | 2 | 315.5 px × 2 | 16 px |

- **Regla DERIVADA** (7/7 anchos): `columnas = floor((ancho_contenedor + 16) / 236)`. Equivale a pistas de mínimo ≈ 220 px con gap de 16 px; el intervalo compatible con todas las mediciones para la pista mínima es **219.75–223.8 px**.
- **Relación con las `@container` de 236 px:** el paso de 236 px coincide con la familia `@container (width >= 248px) and (width < 484px)`, …, pero sus límites exactos no coinciden con la fórmula. NO RESUELTO.
- **Invariantes:**
  - mosaico de carpeta de 48 px de alto en todos los anchos;
  - tarjetas cuadradas, salvo a 1000 px, donde conviven tarjetas de 315×315 y 315×327 (anomalía: causa NO RESUELTA).

---

## VI. Responsive y breakpoints

Fuentes: `drive-breakpoints.md`, `drive-explore.breakpoints.*.json` (179 firmas), capturas completas en 11 resoluciones y prueba controlada A8.

### VI.1 Umbrales comprobados a 1 px (OBSERVADO; mecanismo con su estado)

| Umbral (viewport) | Por debajo | Desde el umbral | Mecanismo | Estado del mecanismo |
| --- | --- | --- | --- | --- |
| **999 → 1000** | Desbordamiento horizontal; documento fijo en 1000 | Sin desbordamiento | `body { min-width: 1000px }` y `@media only screen and (min-width: 62.5rem)` | DERIVADO |
| **1023 → 1024** | Buscador = viewport − 674 | Buscador = viewport − 694 (349 → 330) | `@media only screen and (min-width: 33.75rem) and (max-width: 63.9375rem)` (540–1023 px) | DERIVADO |
| **1097 → 1098** | 3 columnas `[col0,140,48]`; 1 botón por fila | 4 columnas `[col0,140,140,48]`; 2 botones | `@container (inline-size > 744px) and (inline-size <= 832px)` (tabla 744 → 745) | **DERIVADO por prueba controlada** (§VI.4) |
| **1185 → 1186** | 4 columnas | 5 columnas `[col0,140,140,88,48]` | `@container (inline-size > 832px) and (inline-size <= 1126px)` (tabla 832 → 833) | DERIVADO |
| **1246 → 1247** | Toolbar de vista de 184 px | 194 px | `@media only screen and (max-width: 77.9rem)` (≤ 1246.4 px) | DERIVADO |
| **1415 → 1416** | Buscador = viewport − 694 | Buscador fijo en 722 | Sin `@media` coincidente; compatible con un ancho máximo de 722 px | INFERIDO |
| **1479 → 1480** | Columnas 140 / 140 / 88 / 48; sin toolbar de fila | 215 / 215 / 88 / 192; toolbar de 4 × 36 px más menú | `@container (inline-size > 1126px)` (tabla 1126 → 1127) | **DERIVADO por prueba controlada** (§VI.4) |

- **Equivalencia `rem`:** la de las media queries usa el tamaño inicial de 16 px; se presupone, no se midió.
- **Contenedor de las container queries:** el grid de lista mide `viewport − 353`. Que el contenedor consultado sea exactamente la tabla es INFERIDO; la dependencia del ancho del contenedor está demostrada en §VI.4.

### VI.2 Inventario de reglas CSS legibles (OBSERVADO)

- **Hojas:** 7 de 8 son legibles, con 30 331 reglas en total; una hoja de otro origen no es legible.
- **`@media`:** 85 condiciones distintas, entre ellas `(min-width: 960px)`, `(max-width: 960px)`, `(prefers-reduced-motion)`, `(forced-colors: active)` y `(prefers-color-scheme: dark)`.
- **`@container`:** 51 condiciones distintas. Destacan las familias de pasos de **236 px** (`(width >= 248px) and (width < 484px)` … `(width >= 2372px) and (width < 2608px)`) y de **177 px** (`(width >= 189px) and (width < 366px)` … `(width >= 1782px) and (width < 1959px)`), además de las de la tabla (744 / 832 / 1126 px), `floating-toolbar-slot (max-width: 856 | 616 | 336px)` y `filter-toolbar (width < 435px)`.

### VI.3 Ancho del buscador (DERIVADO, 150 anchos)

| Viewport | Ancho del buscador | Anchos verificados |
| --- | --- | ---: |
| ≥ 1416 | 722 (tope) | 12 |
| 1024–1416 | viewport − 694 | 114 |
| 1000–1023 | viewport − 674 | 15 |
| < 1000 | 326 (documento fijo en 1000) | 9 |

### VI.4 Prueba controlada de container queries (A8)

Con el **mismo viewport** (1440 × 900), ocultar el rail derecho ensancha `main` en 40 px. La tabla cambia de comportamiento siguiendo el ancho del contenedor, no el del viewport:

| Viewport | Rail | Ancho de la tabla | Columnas 1–4 | Toolbar de fila |
| --- | --- | ---: | --- | --- |
| 1440 | visible | 1087 | 140 / 140 / 88 / 48 | no |
| 1440 | oculto | 1127 | 215 / 215 / 88 / 192 | sí |
| 1280 | oculto | 967 | 140 / 140 / 88 / 48 | no |

### VI.5 Comportamiento por debajo de 1000 px (OBSERVADO)

- El documento conserva 1000 px de ancho y aparece desplazamiento horizontal.
- A 768, 390, 375 y 320 la geometría es idéntica: `main` 687, tabla 647, 3 columnas y buscador 326.
- No hay layout móvil con `mobile: false`. El comportamiento con emulación móvil real queda NO RESUELTO.

---

## VII. Estados interactivos

Fuentes: `drive-explore.states.*.json`, `drive-component-states.json`, `drive-explore.menus.*.json` y las operaciones A1, A5, A6, A7 y A8.

- **Hover:** se aplicó con `mouseMoved` sin clic, comprobando antes el elemento con `elementFromPoint`.
- **Foco:** 60 pulsaciones de Tab, sin Enter ni espacio.

### VII.1 Matriz de estados

| Estado | Componentes con evidencia | Estado de la evidencia |
| --- | --- | --- |
| Default | Todos los de §II–§V | OBSERVADO |
| Hover | Botones de icono del header y de toolbar, botón de búsqueda, chip, cabecera de columna, fila, botón de menú de fila, tarjeta de cuadrícula | OBSERVADO |
| Hover sin cambio medible | Elementos de navegación, formulario de búsqueda, radios de vista, opciones de menú del título | OBSERVADO (el efecto, si existe, está en otro nodo: NO RESUELTO) |
| Focus / focus-visible | 30 paradas de Tab (2 ciclos idénticos) | OBSERVADO |
| Selected | Elemento activo de la navegación; radio de vista marcado | OBSERVADO |
| Expanded | 5 menús del master, 2 diálogos de filtro, menú del título con 4 submenús, árbol lateral | OBSERVADO |
| Collapsed | Árbol lateral; rail derecho oculto | OBSERVADO |
| Disabled | 2 botones del diálogo de fecha con color `rgba(16,16,16,0.3)` | INFERIDO (por color) |
| `checked=false` | `menuitemcheckbox` de los menús de chips y de los diálogos | OBSERVADO |
| `checked=true`, pressed/active, loading, fila seleccionada, indeterminate | — | NO RESUELTO |

### VII.2 Hover (OBSERVADO)

| Componente | Cambio | Aplicado en 80 ms |
| --- | --- | --- |
| Botón de icono del header (40×40) | `::before` pasa a `display: block`, 40×40, radio 9999, fondo `rgb(31,31,31)`, opacidad 0.08 | Sí |
| Botón de icono de toolbar (32×32) | Igual, a 32×32 | Sí |
| Botón de búsqueda (56×46) | Opacidad de `::before` 0 → 0.08 (transición 0.3s); opacidad del svg 0.5 → 1 | **No: 0.033 a los 80 ms (en curso)** |
| Chip | §IV.7 | Sí |
| Cabecera de columna | `::after` del tamaño de la celda, al 8 % | Sí |
| Fila | §IV.4 | Sí |
| Botón de menú de fila | color / fill `rgb(31,31,31)` → `rgb(68,71,70)` | Sí |
| Tarjeta de cuadrícula | §V.2 | — |

**Tooltip (OBSERVADO en 7 objetivos):**
- fondo `rgb(48,48,48)` y texto `rgb(242,242,242)`;
- 12 / 400 / 16 px, letter-spacing 0.1 px;
- radio 4 px, padding `4px 8px`, alto 26 px;
- `z-index: 6000`, sin sombra;
- aparece debajo del disparador.

Estaba visible a los 2 s; el retardo exacto de aparición quedó NO RESUELTO.

### VII.3 Foco (OBSERVADO)

| Variante de anillo | Paradas (de 60) | Dónde |
| --- | ---: | --- |
| `outline: 1px solid rgb(77,144,254)` | 22 | Navegación de salto, botón tonal, enlaces de la sidebar, título, control de cabecera, botones de fila, `tablist` lateral |
| `outline: 1px solid rgb(11,87,208)` | 12 | Botones de icono GM3 del header (además: fondo blanco, borde `rgb(77,144,254)`, capa `::before`) |
| `outline: 2px solid rgb(11,87,208)` | 2 | Botón de detalles 32×32 |
| Sin outline | 24 | Logotipo (sólo `outline-offset` 0 → 1 px), campo de búsqueda, fila, radio, botón principal; botones del buscador con capa `::before` ≈ 0.115 |

**Foco por teclado en la navegación (A5):**
- **Elemento inactivo:** fondo `rgb(221,227,234)`.
- **Elemento activo:** conserva `rgb(194,231,255)`.
- **Comunes a ambos:** sombra `color(srgb 0 0 0 / 0.1) 0 1px 2px 0`, padding de 3 → 2 px y ancho del grupo de 203 → 205 px.

---

## VIII. Navegación y menús

### VIII.1 Árbol lateral (A5, OBSERVADO)

| Propiedad | Valor |
| --- | --- |
| Árbol | `div[role=tree]` 224×320 en 16,143 · `overflow-y: hidden` · una sola parada de Tab (foco itinerante) |
| Elementos | 9 `treeitem` de 224×32; y = 143, 175, 207 · 255, 287, 319 · 367, 399, 431 (grupos separados 16 px) |
| Superficie interactiva | `div[role=link]` 224×32 · padding 0 3 px · radio 100 px |
| Contenido | `div[role=group]` 203×28 en x = 34 (sangría de 18 px) · icono 20×20 en x = 34 · texto 14 / 400 / 26 px |
| Activo | `aria-selected=true` · fondo `rgb(194,231,255)` · texto e icono `rgb(0,74,119)` |
| Expandibles | 2 `treeitem` con `aria-expanded`, uno de ellos el activo · chevron 12×12 en x = 22 |
| Enlaces inferiores | `a` 175×40 en 34,483 · `a` 213×56 en 34,536 (función INFERIDA: almacenamiento) |
| Encabezado | `div[role=heading]` de nivel 2, visible |

**Expansión** (ArrowDown y ArrowRight sobre el elemento activo, sin clics; restauración **PASS**):

| Medida | Antes | Expandido |
| --- | --- | --- |
| Elementos visibles | 9 | 27 (recuento) |
| Sangría por nivel | — | **16 px**: chevron x 22 → 38, icono x 34 → 50, grupo de 203 → 179 px |
| Chevron | `matrix(1,0,0,1,0,0)` | `matrix(0,1,−1,0,0,0)` (90°), transición 0.1s |
| Ancho del árbol | 224 | 216 (barra de desplazamiento de 8 px) |
| Alto del árbol | 320 | 896 · `overflow-y: hidden` en el árbol |

ArrowLeft vuelve a 9 elementos.

**Orden de Tab** (30 paradas por ciclo):
1. Navegación de salto (3).
2. Logotipo.
3. Campo de búsqueda.
4. Botones del buscador (2).
5. Botones del header (7).
6. Botón principal.
7. Árbol (1 parada).
8. Enlaces inferiores (2).
9. Título.
10. Radio marcado.
11. Botón de detalles.
12. Chips (1 parada).
13. Control de cabecera.
14. Fila 0.
15. Botones de la fila.
16. `tablist` lateral.
17. Conmutador del rail.

**Roving tabindex** en el árbol, los chips, el radiogroup y las filas (INFERIDO; las flechas sólo se probaron en el árbol).

### VIII.2 Menú del título (A7, OBSERVADO; restauración PASS)

| Propiedad | Valor |
| --- | --- |
| Disparador | 261,79 152.72×40 · `aria-expanded` false → true |
| Menú | 320×338 en 261,119 (bajo el título, alineado a la izquierda) · padding 8 px · radio 4 px · foco inicial dentro del menú |
| Opciones | 9 `menuitem` de 320×32 · padding `0 12px` · icono 20 px en x+12 · texto en x+48 · en algunas opciones, texto secundario alineado a la derecha (atajos: INFERIDO) |
| Separadores | 2, de 17 px de alto |
| Opciones con submenú | 5 (`aria-haspopup=menu`, flecha 20 px en x+288) |
| Submenús (4 abiertos por hover) | Aparecen en x = 581 (borde derecho del padre), alineados a la y de la opción · opciones 320×32 · padding 8 px · 2 o 3 opciones |
| Hover en una opción simple | Sin cambios en el elemento, sus pseudo-elementos ni sus descendientes (NO RESUELTO) |

### VIII.3 Menús del header y de chips (master, OBSERVADO; estado verificado tras cada uno)

| Disparador | Menú | Caja | Anclaje | Opciones | Estilo |
| --- | --- | --- | --- | --- | --- |
| Header, x = 1514 | `menu`, 1 `menuitemcheckbox` | 1514,51 320×48 | Bajo el disparador, alineado a la izquierda | 320×32; icono 40×24 | Fondo blanco · radio 4 · sombra GM3 · `z-index: 2300` · 13 / 400 / 20 · `min-width: 320` · transición `height, margin-top, opacity 0.267s` |
| Header, x = 1558 | `menu`, 4 `menuitem`, 2 separadores | 1354,51 244.17×170 | **Alineado al borde derecho** (1598) | 244×32 · padding `6px 30px` · Roboto 14 px | *Legacy*: sombra `rgba(60,64,67,…)` · padding vertical 6 px · separadores de 1 px |
| Header, x = 1602 | `menu`, 4 `menuitem` | 1322,51 320×144 | **Alineado al borde derecho** (1642) | 320×32 · padding `0 12px` | Igual que el de x = 1514 |
| Chip 1 (82.83×32) | `menu`, 19 `menuitemcheckbox` | 277,167 249.2×665 | Bajo el chip, a la izquierda | 241×40 · iconos de 24 y 18 px | Radio 8 · padding `8px 0` · `max-height: 665px` · `overflow-y: auto` · 14 / 400 / 20 |
| Chip 4 (99.2×32) | `menu`, 2 `menuitemcheckbox` | 626,167 192×96 | Bajo el chip, a la izquierda | 192×40 · iconos de 24 px | Radio 8 · `min-width: 192` |

- **Apertura:** el disparador pasa a `aria-expanded=true`.
- **Cierre:** Escape cierra el menú y restablece `false` (5/5).
- **Opciones checkbox:** todas en `aria-checked=false`.
- **Cerca del borde derecho:** los menús se alinean a la derecha. La regla general es INFERIDA con 3 casos; el reposicionamiento al redimensionar no se probó.

### VIII.4 Diálogos de filtro (A6, OBSERVADO; restauración PASS en cada uno)

| Disparador | Diálogo | Contenido estructural |
| --- | --- | --- |
| Chip 2 (114.22×32, `aria-haspopup=dialog`) | 317.55×303 en 368,167 · radio 8 · bajo el chip, a la izquierda | Campo de texto 249.55×20 con foco inicial · 4 opciones de 317.55×48, cada una con imagen 24×24 de radio 12 y flecha de 20 px, y un submenú de 3 opciones de 192×40 · separador 1 px `rgb(199,199,199)` · opción final de 40 px con icono de 14 px |
| Chip 3 (128.28×32, `aria-haspopup=dialog`) | 272.86×301 en 490,167 · radio 8 | 6 opciones `menuitemcheckbox` de 256×40 (la última abre otro diálogo) · 2 botones de 155.75×24.5 con `aria-haspopup=dialog` · 3 botones de 40 px con radio 20 y padding `0 12px`; 2 de ellos en estado deshabilitado INFERIDO |

No se escribió en el campo ni se aplicó ningún filtro.

---

## IX. Paneles laterales

### IX.1 Rail derecho (A8, OBSERVADO; restauración PASS tras la incidencia de §XIV.3)

| Propiedad | Visible | Oculto |
| --- | --- | --- |
| Rail | `role=complementary` 56×882 en 1864,63 · `tablist` 56×826 · 5 `tab` de 56×56 | No renderizado |
| Conmutador | 56×56 en 1864,889 | 56×56 en **1888**,889 (parcialmente fuera del viewport: 32 px visibles) |
| `main` (1920) | 1607 (viewport − 313) | 1647 (viewport − 273) |
| Tabla (1920) | 1567 · col. 0 de 847 | 1607 · col. 0 de 887 |
| Toolbar de vista (x) | 1658 | 1698 (+40) |
| 1440 × 900 | tabla 1087, columnas estrechas, sin toolbar de fila | tabla 1127, columnas anchas, toolbar de fila (§VI.4) |
| 1280 × 800 | tabla 927 | tabla 967, columnas estrechas |

El reflow sólo afecta al ancho del contenedor principal y a lo que depende de él. Header, sidebar y buscador no cambian.

### IX.2 Paneles no medidos

| Panel | Estado | Motivo |
| --- | --- | --- |
| Panel de detalles de archivo (A4) | **NO RESUELTO (pendiente)** | Requiere un elemento de prueba identificado sin ambigüedad en el navegador del laboratorio |
| Paneles de aplicaciones del rail (5 pestañas) | **NO RESUELTO** | Abrirlos mostraría datos de servicios de la cuenta, fuera de lo autorizado |

La fuente rectora registra un panel de detalle de **336 px** derivado de capturas propias (rector §25.2, «Panel de detalle *(derivado)* 336 = 1607 − 1271»). El laboratorio **no** midió ese panel, por lo que aquí no se confirma ni se refuta.

---

## X. Accesibilidad

Esto no es una auditoría WCAG completa y no declara conformidad. Cada resultado se marca como comprobado, indicio o no evaluado.

### X.1 Estructura semántica (comprobado por recuento)

- **Landmarks:**
  - `banner` 1;
  - `navigation` 3 (2 visibles, una de salto);
  - `main` 1;
  - `search` 1;
  - `complementary` 3 (1 visible);
  - `region` 3 (1 visible);
  - `contentinfo` 0.
- **Encabezados:**
  - 3 en total: nivel 1 en el header (no visible), nivel 2 en la navegación (visible) y un `h2` no visible;
  - **ninguno dentro de `main`**.
- **Patrones ARIA:** `tree`/`treeitem` (con `aria-selected` y `aria-expanded`), `menu`/`menuitem`/`menuitemcheckbox` (con `aria-checked`), `radiogroup`/`radio` (con `aria-checked`) y `tablist`/`tab` (con `aria-selected`). La tabla no expone `aria-sort`.
- **Regiones vivas:** 2 elementos `aria-live`/`status` visibles; sus anuncios no se evaluaron.

### X.2 Teclado y foco

| Aspecto | Resultado | Tipo |
| --- | --- | --- |
| Ciclo de Tab | 30 paradas, sin trampas ni entrada en iframes | Comprobado |
| Enlaces de salto | 3 botones fuera de pantalla que aparecen en y = 4 con foco | Comprobado |
| `:focus-visible` | 60/60 paradas | Comprobado |
| Anillo por outline | 36/60; el resto usa una capa o no tiene indicador localizado (fila, campo de búsqueda) | Comprobado (estilos) / indicio |
| Escape | Cierra los 7 overlays abiertos (5 menús y 2 diálogos) y el menú del título | Comprobado |
| Selección por foco | Tab no selecciona filas | Comprobado |
| Flechas | Sólo probadas en el árbol (ArrowDown, ArrowRight, ArrowLeft, ArrowUp) | Comprobado en el árbol |

### X.3 Contraste (fórmula WCAG 2.x sobre 21 grupos de texto)

| Texto | Fondo | Tamaño | Relación | AA |
| --- | --- | --- | ---: | --- |
| `rgb(31,31,31)` | blanco | 14 px | 16.48 | Cumple |
| `rgb(68,71,70)` | blanco | 14 px | 9.39 | Cumple |
| `rgb(31,31,31)` | `rgb(248,250,253)` | 13–22 px | 15.76 | Cumple |
| `rgb(0,74,119)` | `rgb(194,231,255)` | 14 px | 7.20 | Cumple |
| `rgb(11,87,208)` | `rgb(248,250,253)` | 14 / 500 | 6.11 | Cumple |
| `rgb(8,66,160)` | `rgb(211,227,253)` | 14 / 500 | 7.04 | Cumple |
| `rgb(242,242,242)` | `rgb(48,48,48)` | 12 px | 11.79 | Cumple |
| **`rgb(116,119,117)`** | **`rgb(233,238,246)`** | **12 / 500** | **3.89** | **No alcanza 4.5 (indicio)** |

- **Resultado global:** 20/21 grupos cumplen AA.
- **Elementos no textuales (indicios):** borde de chip 4.53, anillo `rgb(77,144,254)` 3.12, anillo `rgb(11,87,208)` 6.39 y separador de fila 1.69 (es decorativo). La evaluación de 1.4.11 queda incompleta.

### X.4 Objetivos táctiles y nombres

- **Lado menor de los 322 controles visibles:**
  - menos de 24 px: 2 (el input de búsqueda de 616×20 y su copia, dentro de un formulario de 48 px);
  - de 24 a 43 px: 223;
  - 44 px o más: 97.
- **Nombre accesible** (sólo presencia, sin leerlo):
  - 225 controles tienen `aria-label` o `aria-labelledby`;
  - 93 tienen texto renderizado;
  - 4 no tienen ninguno de los dos: un iframe fuera de pantalla, el input de búsqueda, la toolbar de vista y el `tablist` lateral. Es un indicio, porque podrían tener `title` o `<label>`.

### X.5 Reflow y preferencias

- **Reflow:** a 960 px (≈ 200 % de zoom de una ventana de 1920 px) el documento conserva 1000 px y produce desplazamiento horizontal. Es un indicio relevante para 1.4.10, medido por emulación y no con zoom real.
- **Preferencias:** existen reglas `prefers-reduced-motion`, `forced-colors` y `prefers-color-scheme: dark`; su efecto no se evaluó.

---

## XI. Animaciones y microinteracciones

### XI.1 Transiciones declaradas, con duración distinta de 0 (OBSERVADO)

| Propiedad | Duración | Timing | Elementos |
| --- | --- | --- | ---: |
| `border-radius` | 0.35s | `cubic-bezier(0.27, 1.06, 0.18, 1)` | 24 (radios de vista, botón tonal, botón de cabecera) |
| `width, flex-basis` | 0.25s | `ease-in-out` | 10 (celdas y cabeceras) |
| `color, background, box-shadow` | 0.2s, 0.2s, 0.4s | `cubic-bezier(0.4, 0, 0.2, 1)` | 5 (botones de icono GM3) |
| `all` | 0.3s | `cubic-bezier(0.4, 0, 0.2, 1)` | 5 |
| `border-radius` | 0.35s | `cubic-bezier(0.4, 0.1, 0.5, 1.4)` | 4 |
| `opacity` | 0.25s | `ease-out` | 2 |
| `box-shadow` | 0.25s | `ease` | 1 |
| `background, width` | 0.1s, 0.1s | `ease-in, ease-out` | 1 (formulario de búsqueda) |
| `background-color` | 0.3s | `ease` | 1 |

Otras transiciones observadas en estados:
- `box-shadow 0.08s` en el botón principal;
- `height, margin-top, opacity 0.267s` en los menús GM3;
- opacidad de `::before` 0.3s en el botón de búsqueda;
- 0.1s en el chevron del árbol;
- `transform` del chevron: `matrix(0,1,−1,0,0,0)`, es decir, 90° (§VIII.1).

### XI.2 Comprobadas en movimiento

- **Transición en curso:** sólo la opacidad de `::before` del botón de búsqueda, con valor intermedio de 0.033 a los 80 ms.
- **Cambios ya completos a los 80 ms:** el resto de los hovers medidos.

### XI.3 Animaciones

- **En reposo:** ninguna animación en curso.
- **`@keyframes` declarados:** 72, entre ellos anillos de foco GM3, ripple MDC, entrada y salida de chips, indicadores de progreso, *shimmer* y la animación de menú de Drive. Los nombres de más de 20 caracteres se acortan en la evidencia.

---

## XII. Matriz de cobertura

### XII.1 Por categoría (23 componentes funcionales; observado o derivado / aplicable)

Fuente: `drive-coverage-matrix.json` (maestra). El ajuste interactivo está en `drive-interactive-coverage.json`.

| Categoría | Maestra | Tras A1–A8 |
| --- | ---: | --- |
| Estructural | 18/23 | 20/23 (+ tarjeta de cuadrícula y diálogo) |
| Geométrica | 18/23 | 20/23 |
| Visual | 18/23 | 20/23 |
| Tipográfica | 10/15 | 11/15 (+ tarjeta de cuadrícula) |
| Interactiva | 15/23 | 17/23 |
| Responsive | 11/23 | 13/23 (+ cuadrícula en 7 anchos, rail) |
| Accesibilidad | 18/23 | 20/23 |

**Siguen sin cobertura:** casilla de fila, panel de detalles y menú contextual de fila (A2–A4).

### XII.2 Por estado (maestra)

| Estado | Cobertura | Cambios tras A1–A8 |
| --- | ---: | --- |
| default | 18/23 | + tarjeta y diálogo |
| hover | 8/20 | + tarjeta de cuadrícula |
| focus-visible | 15/20 | + foco por teclado en la navegación |
| expanded | 2/14 | + árbol, título, diálogos |
| selected | 2/13 | sin cambios (A2 pendiente) |
| checked | 4/9 | sin cambios |
| pressed | 0/19 | sin cambios |
| disabled | 0/7 | INFERIDO en 2 botones de diálogo |
| loading | 0/6 | sin cambios |

### XII.3 Operaciones interactivas

| Op | Estado | Restauración |
| --- | --- | --- |
| A1 Vista cuadrícula | COMPLETADA | PASS |
| A2 Selección simple y múltiple | **PENDIENTE** | — |
| A3 Menú contextual de archivo | **PENDIENTE** | — |
| A4 Panel de detalles | **PENDIENTE** | — |
| A5 Árbol lateral | COMPLETADA | PASS |
| A6 Diálogos de filtros | COMPLETADA | PASS |
| A7 Menú del título | COMPLETADA (4/5 submenús) | PASS |
| A8 Paneles laterales | **PARCIAL**: rail completado; paneles de aplicaciones NO RESUELTOS | Primera transacción FAIL, restaurada y verificada; repetición PASS |

**Motivo de A2–A4:**
- Exigen operar sólo sobre elementos ficticios identificados sin leer nombres.
- La vista con los elementos de prueba no llegó a estar abierta en la pestaña de Drive del navegador del laboratorio: el target CDP siguió en `/drive/my-drive` en dos verificaciones.
- No se interactuó con ningún archivo.

---

## XIII. Especificación de comparación con VETNEB

Contrato técnico para una auditoría comparativa futura. **No contiene mediciones de VETNEB ni afirma que algún componente cumpla o incumpla.** Los destinos de implementación los fija exclusivamente la fuente rectora (§26 y §45–§46 de `AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md`).

### XIII.1 Procedimiento

1. **Medición de VETNEB:** usar el mismo método (geometría y estilos calculados, sin texto) y las mismas resoluciones: 1920 × 945, 1920 × 1080, 1440 × 900, 1366 × 768, 1280 × 800 y 1024 × 768.
2. **Mapeo:** asociar cada componente de VETNEB a un identificador de esta tabla, o marcarlo NO COMPARABLE.
3. **Clasificación:** cada métrica se clasifica como IGUAL (dentro de la tolerancia), DIFERENTE, AUSENTE o NO COMPARABLE.
4. **Valores no observados:** un valor de Drive con estado INFERIDO o NO RESUELTO sólo admite NO COMPARABLE.
5. **Agregación:** el resultado se informa por categoría, sin puntuación única.

### XIII.2 Criterios

| Categoría | Métrica de referencia (Drive) | Valor | Estado | Tolerancia propuesta |
| --- | --- | --- | --- | --- |
| Posición | Inicio del contenido | `main` en y = 175, x = 257 | OBSERVADO | ±1 px |
| Posición | Inset de la tabla | 20 px por lado | DERIVADO | ±1 px |
| Dimensiones | Header | 64 px | OBSERVADO | ±1 px |
| Dimensiones | Sidebar | 224 px en x = 16 | OBSERVADO | ±1 px |
| Dimensiones | Rail derecho | 56 px | OBSERVADO | ±1 px |
| Dimensiones | Fila / paso | 48 / 48 px | OBSERVADO | ±0.5 px |
| Dimensiones | Chip / radio de vista | 32 px de alto | OBSERVADO | ±0.5 px |
| Dimensiones | Opción de menú | 32 px (header/título) · 40 px (chips) | OBSERVADO | ±0.5 px |
| Dimensiones | Buscador | 722 × 48 (tope); fórmulas de §VI.3 | OBSERVADO / DERIVADO | ±1 px |
| Tipografía | Base | 14 px / 400 / 20 px «Google Sans Text» | OBSERVADO | exacta |
| Tipografía | Celdas / cabeceras | 14 / 400 / 48 · 14 / 500 / 48 | OBSERVADO | exacta |
| Tipografía | Tooltip | 12 / 400 / 16, letter-spacing 0.1 px | OBSERVADO | exacta |
| Espaciado | Padding de celda | `0 6px` (col. 0: `0 24px 0 0`) | OBSERVADO | ±1 px |
| Espaciado | Gap de chips / cuadrícula | 8 px / 16 px | OBSERVADO | ±1 px |
| Color | Texto primario / secundario | `#1f1f1f` / `#444746` | OBSERVADO | ΔE ≤ 2 |
| Color | Selección | `#c2e7ff` sobre `#004a77` | OBSERVADO | ΔE ≤ 2 |
| Color | Capa de hover | `#1f1f1f` al 8 % | OBSERVADO | opacidad ±0.01 |
| Bordes | Fila / chip | 1 px `#c7c7c7` / 1 px `#747775` | OBSERVADO | exacta |
| Bordes | Radios | §III.3 | OBSERVADO | ±0.5 px |
| Responsive | Umbrales | 1000, 1024, 1098, 1186, 1247, 1416, 1480 (viewport) · 744, 832, 1126 (contenedor de tabla) | OBSERVADO / DERIVADO | ±1 px |
| Responsive | Columnas de la cuadrícula | `floor((w + 16) / 236)` | DERIVADO | exacta en los 7 anchos |
| Estados | Hover / foco | §VII.2–§VII.3 | OBSERVADO | exacta en color y opacidad |
| Estados | Selección / menú contextual / detalles | — | NO RESUELTO | NO COMPARABLE |
| Interacciones | Menús | Anclaje bajo el disparador, alineación derecha cerca del borde, Escape cierra | OBSERVADO / INFERIDO | cualitativa |
| Accesibilidad | Foco visible / contraste / objetivos | 60/60 · 20/21 AA · 24 px o más | OBSERVADO | criterio WCAG aplicable |

### XIII.3 Reglas de interpretación

- Los valores de Drive describen **un producto externo en un estado concreto** (tema claro, cuenta con 37 elementos, Chrome 155). No son requisitos para VETNEB.
- Una diferencia medida **no es** un defecto de VETNEB salvo que la fuente rectora lo fije como destino.
- Si este documento y la fuente rectora difieren sobre un valor de Drive (§XIV.4), la comparación debe registrar ambos valores con su procedencia.

---

## XIV. Procedencia y validación

### XIV.1 Ejecuciones

| Ejecución | Fecha (UTC) | Script | Contenido | Restauración |
| --- | --- | --- | --- | --- |
| Run 1 | 2026-10-18 | v2 | 4 viewports de referencia, 14/20 componentes, 12 176 valores CSS | Emulación limpiada; restauración **no verificada** (pestaña oculta) |
| Run 2 | 2026-10-19 03:02 | v3 | 4 viewports, columnas resueltas, recuentos corregidos, 16 972 valores CSS | VERIFICADA |
| Maestra: pasiva | 2026-10-19 03:46–03:50 | v4 | 3 ejecuciones; la válida es la de 03:50 (las 2 primeras quedan sustituidas, sin dejar de conservarse) | VERIFICADA |
| Maestra: capturas | 2026-10-19 03:50 | v4 + v3 | 7 viewports adicionales | VERIFICADA |
| Maestra: breakpoints | 2026-10-19 03:50 y 03:53 | v4 | 81 + 98 firmas | VERIFICADA |
| Maestra: scroll / estados / menús | 2026-10-19 03:56–03:58 | v4 | Scroll, hover, 60 Tabs, 5 menús | VERIFICADA |
| Interactiva | 2026-10-19 04:29–04:38 | v5 | A1, A5 (×2), A6, A7, A8 (×2), a8r, verify (×4) | 11 PASS y 1 FAIL resuelto (§XIV.3) |

Valores CSS válidos acumulados:
- run 1: 12 176;
- run 2: 16 972;
- maestra: 105 577;
- interactiva: 30 280.

Los filtrados por diseño (73 en la maestra) están desglosados en la evidencia. Los recuentos no se suman como «calidad»: hay datos repetidos entre viewports y ejecuciones.

### XIV.2 Fuentes e integridad (SHA-256 verificados el 2026-10-19)

Rutas relativas al directorio de resultados del laboratorio (`web-drive/results/`), fuera de este repositorio. Integridad comprobada contra los manifiestos:
- maestra 28/28;
- línea base (run 1, run 2 y herramientas previas) 18/18;
- interactiva 24/24.

| Archivo | SHA-256 |
| --- | --- |
| `archive/run1-2026-10-18/drive-ui-metrics.json` | `2D0DC913163188518DC167B3E75CF517BD6E64C7C54BA0F5625DFE3CF444FE6A` |
| `drive-ui-metrics.2026-10-19T03-02-08-347Z.json` (run 2) | `B1CD20B4BB66860D7E0C1E78B3173A9CE715300842D3C09595E04BDF7D554C1A` |
| `master-2026-10-19/drive-evidence-manifest.json` | `6FE9F49ACD29BCCBEB5B3A55BEB51BC8370C0BB366DEEE5C6CBD9D7752DC1B90` |
| `master-2026-10-19/DRIVE_MASTER_AUDIT.md` | `559C069291A7943FBF81D4035D5FCDA4D7502AAB96D056534028B1077CAAD906` |
| `master-2026-10-19/drive-design-tokens.json` | `77D817DC2F6DDC92D789A51DFCB4C3A48652AC3E7BB87A004017789D6523BABD` |
| `master-2026-10-19/drive-tables-and-grids.json` | `B3CCE6BCE78313ED91B6CEE7C1A988B7E2D09ED47CC340C6FDA52BE6174F7A6D` |
| `master-2026-10-19/drive-breakpoints.md` | `600AE5C4FA6AAFC7CBDF3223D76DC8466D735A724DD19FF67BE580AC0EE67774` |
| `master-2026-10-19/drive-coverage-matrix.json` | `3CE4E2E8449350A46AC6866322159988EDE714E5440CBE68B2F56EC338A24150` |
| `master-2026-10-19/drive-explore.passive.2026-10-19T03-50-11-244Z.json` | `D1EFEC96BA1CD4BE4ADA54E8E86957946F0BD64F23433629201BEB906E22E1C0` |
| `master-2026-10-19/drive-explore.captures.2026-10-19T03-50-15-161Z.json` | `23AB7EB2244A01B4C7976B5FA5FF521BB91A0D3356198A973FD96964AC388A71` |
| `master-2026-10-19/drive-explore.breakpoints.2026-10-19T03-50-46-121Z.json` | `64BF48047CD208DFDE2BD15E0D58F9D9C802E3DAB0AAD9C8905131621BE5F70C` |
| `master-2026-10-19/drive-explore.breakpoints.2026-10-19T03-53-42-253Z.json` | `F00B9786737629683CE3F94751AC834FA32611D16FB5E470C7273954B430A0A9` |
| `master-2026-10-19/drive-explore.states.2026-10-19T03-56-23-211Z.json` | `4C5AC0C14DC57C324EE569B86344CC9C4892B2085BFB04BD10FAA821DF3F0F23` |
| `master-2026-10-19/drive-explore.menus.2026-10-19T03-58-21-423Z.json` | `2BE0095F9EABC4AF06216EDD335771554C7FFB54E7CB3E013827D2789E412D28` |
| `master-2026-10-19/drive-explore.scroll.2026-10-19T03-56-18-847Z.json` | `6F58AC2B0D76F380C1196E2929EB13067A018FC037C1757D65D869D39C54E82B` |
| `interactive-2026-10-19/drive-interactive-evidence-manifest.json` | `DF944D372F66251DBC90CE639D0745C394C919E3B897AB78C7B12EC20FAEF83E` |
| `interactive-2026-10-19/DRIVE_INTERACTIVE_AUDIT.md` | `3E82C07F6B1A6C65DFC80E9D42E0380B2C4F63F614A20D94FB35CB25D7F1367C` |

Herramientas:

| Herramienta | SHA-256 |
| --- | --- |
| `drive-cdp-metrics.mjs` (v3) | `7F27965BA762AFA3ABF30BEBB8E7C5E6CA645C9EA18404EB187590B5FE38CF5C` |
| `drive-cdp-explore.mjs` (v4) | `B4E6F93E4A9E5D8CDDB88368FE753A1ECBD8D484D293EDC705574A3FCCF13EE6` |
| `drive-cdp-interact.mjs` (v5) | `CF5C02BA9216DE796864E1910C3196C29B3642DD2C38DB077607EC34DB4E502C` |

### XIV.3 Correcciones posteriores incorporadas (precedencia por evidencia, no por fecha)

| # | Afirmación anterior | Corrección | Evidencia que prevalece |
| --- | --- | --- | --- |
| 1 | Run 1: columnas NO RESUELTAS | 5 columnas medidas (`th`/`td` sin rol) | Run 2 |
| 2 | Run 1: toolbar 39, botones 155, filtros 185 | Separados: 2 / 7 / 0 fuera de la tabla (§IV.6) | Run 2 |
| 3 | Run 2: «los chips no tienen `aria-haspopup`» | **Falso**: 2 `menu` y 2 `dialog`; el selector se limitaba a `role=main` | Maestra (inventario pasivo) |
| 4 | Run 2: 16 radios `[filtrado]` | Valor `min(100%, 20px)` (función CSS) | Maestra (diagnóstico de radios) |
| 5 | Run 1: restauración del viewport no verificada | VERIFICADA desde run 2 con pestaña visible | Run 2 y siguientes |
| 6 | Run 1: «desaparecen 2 grupos de iconos y 2 tipográficos por debajo de 1920» | Efecto de regiones solapadas; el único grupo que desaparece es el de iconos de acción de fila (148) | Run 2 |
| 7 | Maestra: «los breakpoints de tabla serían container queries» (coincidencia numérica) | Demostrado por prueba controlada | Interactiva A8 |
| 8 | Maestra: «`[role=tooltip]` visible» | 189 tooltips inactivos con caja; los visibles se detectan por opacidad efectiva | Maestra v4 |
| 9 | Maestra: tipografía de la región `overlay` (185) | Corresponde a tooltips inactivos dentro de filas; no es texto visible | Maestra (anomalía registrada) |
| 10 | Interactiva: primera transacción A8 en FAIL | Causa: conmutador parcialmente fuera del viewport. Restaurada con `a8r` (PASS), verificada en solo lectura y repetida (PASS) | Interactiva |

### XIV.4 Contradicciones no resueltas con la fuente rectora

La fuente rectora registra valores de Drive tomados de capturas propias: viewport 1920 × 911, grupo «Principal», §25.1. No se modifican. Las divergencias con el laboratorio (1920 × 945) son:

| Propiedad | Rector (§24–§25) | Laboratorio | Estado |
| --- | --- | --- | --- |
| Buscador | 834 × 48 · `max-width 832px` | 722 × 48 (tope a ≥ 1416) | **NO RESUELTO**: condiciones de captura distintas (viewport, fecha, estado, cuenta) |
| Input de búsqueda | 728 × 20 · inset 57 / 49 | 616 × 20 en x = 313 | **NO RESUELTO** |
| Panel de detalle | 336 px (derivado) | No medido (A4 pendiente) | NO COMPARABLE |
| Gap del sistema | 8 px dominante (44–82 ocurrencias/estado) | No se midió esa métrica; el gap de chips es 8 px y el de la cuadrícula 16 px | NO COMPARABLE (métricas distintas) |

Valores **coincidentes**:
- header de 64 px, transparente y sin sombra;
- rail de 56 px;
- datos en y = 175, x = 257;
- fila de 48 px;
- chip de 128.28 × 32 con radio 8, borde 1 px `rgb(116,119,117)`, 14 / 16 / 500 y `aria-haspopup="dialog"`;
- opción de menú de 32 px, 13 / 20 px, padding `0 12px`, ancho 320;
- transición del buscador de 0.1s;
- sin desbordamiento horizontal a 1920.

### XIV.5 Limitaciones preservadas

1. A2, A3 y A4 pendientes; A8 parcial (paneles de aplicaciones).
2. Función semántica de las columnas NO RESUELTA (no se lee texto).
3. Fuente renderizada de «Google Sans» y «Google Sans Flex» NO RESUELTA.
4. Causa del +6 px de la última cabecera NO RESUELTA.
5. Retardo exacto de los tooltips NO RESUELTO.
6. Estados pressed, loading, `checked=true` y selección NO RESUELTOS.
7. Virtualización con listas largas NO RESUELTA (37 elementos).
8. Contenido de las reglas activadas por media y container queries NO EXPORTADO (sólo las condiciones).
9. Una hoja de estilo de otro origen no se pudo leer.
10. Tema oscuro, otras alturas, otro DPR, zoom real y emulación móvil real fuera de alcance.
11. Anomalía de tarjetas de 315 × 327 a 1000 px sin causa.
12. Los recuentos (37 / 18 / 19 / 27) dependen del contenido de la cuenta inspeccionada y no son propiedades de Drive.

### XIV.6 Validación de este documento

- **Cifras:** todas proceden de los datasets anteriores, leídos por programa y sin transcripción de memoria.
- **Privacidad:** no hay texto, nombres de archivos o carpetas, correos, identificadores de Drive, URLs privadas, cookies, tokens, perfiles de navegador ni capturas. Los hashes son digests de integridad de archivos, permitidos por AGENTS.md §9.
- **Alcance:** docs-only. No se modificó código, tests, configuración, dependencias ni los documentos rectores (`AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md`, `docs/audit/README.md`, `docs/SOURCES_OF_TRUTH.md`).
- **Indexación:** este documento no está incorporado al índice vigente de `docs/audit/README.md`. Su incorporación, como referencia o como complemento, corresponde a una decisión de Nico mediante PR docs-only, conforme a la regla de mantenimiento de ese índice.
