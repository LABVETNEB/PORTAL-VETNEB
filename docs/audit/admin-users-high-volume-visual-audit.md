# Auditoría visual — Admin Usuarios/Roles con fixture high-volume 5000

- **Fecha:** 2026-07-02
- **Base commit:** `1ba7bb2` — test(admin): cover mobile users workspace with high-volume fixture (#1251)
- **Rama:** `audit/admin-users-high-volume-visual-review`
- **Bloque auditado:** CAP-A1 (#1249 fixture 5000 + contrato API), CAP-A2 (#1250 desktop real), CAP-A3 (#1251 mobile real)
- **Tipo:** auditoría visual real (inspección humana de screenshots + métricas de runtime), complementaria a los tests verdes del bloque. Solo documentación/evidencia; cero cambios en código productivo.

## Scope

Módulo Admin **Usuarios y roles** (`?module=admin-users-roles`) del dashboard `/dashboard/admin`, renderizado real contra el fixture CAP-A1 de 5000 usuarios (9 legacy + 249 admins sintéticos + 4742 usuarios de clínica sintéticos). Desktop (tabla + footer de paginación) y mobile (card-list + AdminMobileOpsPager).

## Método

1. Spec Playwright **temporal** (eliminado tras la corrida, nunca versionado) que replica byte a byte el setup de CAP-A2/CAP-A3:
   - Sesión admin poblada: cookie `admin_session_id=e2e_populated_admin_session`.
   - Opt-in high-volume: `page.route` sobre GET `/api/admin/users-roles` reescribiendo la URL con `dataset=high-volume`. Producción intacta: el `AdminUsersRolesReadOnlyCard` real emite sus requests normales; solo la URL de red gana el flag.
   - Servidores levantados por la config Playwright existente (fixture API `127.0.0.1:3107` + `next dev` `127.0.0.1:3000`).
2. Por cada estado: screenshot PNG (animaciones deshabilitadas, `reducedMotion: reduce`) + JSON de métricas de runtime (overflow por superficie, peor scroll interno, inventario tipográfico con ratio de contraste WCAG calculado, candidatos a truncamiento con clip en px, geometría de filas/items/selects, textos de paginación y totales).
3. Inspección visual humana de los 15 PNG, incluyendo crops ampliados 3x de regiones sospechosas.
4. Verificación de causa raíz de los hallazgos visuales contra el DOM real (`elementFromPoint` + computed styles en sesión viva) y contra el código fuente (solo lectura).

## Viewports auditados

| Viewport | Densidad adaptativa observada | Páginas (5000) |
|---|---|---|
| Desktop 1440x900 | 11 filas (~40.5–41 px/fila) | 455 |
| Desktop 1366x768 | 9 filas | 556 |
| Mobile 390x844 | 12 items (~44.5–45.5 px/item) | 417 |
| Mobile 360x740 | 10 items | 500 |
| Mobile 430x932 (opcional) | 14 items | 358 |

## Estados auditados

- Primera página (los 5 viewports).
- Página siguiente (1440, 1366, 390, 360).
- Filtro `Tipo usuario = Admin` → 250 usuarios (1440, 1366, 390).
- Filtro `Tipo usuario = Clínica` + `Rol = Owner clínica` → 2375 usuarios (1440, 1366, 390).

Total: 15 estados capturados.

## Evidencia generada

15 screenshots versionados en `docs/audit/assets/admin-users-high-volume/` (~2.1 MB total). Justificación de versionado: el repo no tiene tooling de regresión visual (P0 conocido de `total-visual-engineering-audit.md`); estos PNG quedan como baseline reproducible del workspace bajo carga 5000 para comparación manual futura.

| Archivo | Tamaño |
|---|---|
| desktop-1440x900-p1.png | 216 KB |
| desktop-1440x900-p2.png | 196 KB |
| desktop-1440x900-filter-admin.png | 196 KB |
| desktop-1440x900-filter-clinic-owner.png | 228 KB |
| desktop-1366x768-p1.png | 195 KB |
| desktop-1366x768-p2.png | 175 KB |
| desktop-1366x768-filter-admin.png | 174 KB |
| desktop-1366x768-filter-clinic-owner.png | 201 KB |
| mobile-390x844-p1.png | 77 KB |
| mobile-390x844-p2.png | 59 KB |
| mobile-390x844-filter-admin.png | 59 KB |
| mobile-390x844-filter-clinic-owner.png | 95 KB |
| mobile-360x740-p1.png | 71 KB |
| mobile-360x740-p2.png | 55 KB |
| mobile-430x932-p1.png | 84 KB |

Las métricas JSON por estado (overflow, contraste, truncamiento, geometría) se generaron en scratchpad de sesión; sus números relevantes están consolidados en este documento.

## Resultado ejecutivo

**El comportamiento high-volume del módulo es visualmente sólido: 0 px de overflow en las cuatro superficies (html/body/main/workspace) en los 15 estados, densidad adaptativa correcta, paginación y totales coherentes en todos los cortes, contraste AA en toda la tipografía medida.** El objeto del bloque CAP (que 5000 usuarios no rompan el contrato visual no-scroll ni la operabilidad) está cumplido.

Sin embargo, la inspección visual encontró **1 hallazgo P1 preexistente y ortogonal al dataset** (texto de los selects de filtro desktop amputado verticalmente ~2.4 px en el 100% de los estados desktop) y 3 P2 de pulido. Ninguno es causado ni amplificado por el volumen 5000.

- **P0: ninguno.**
- **P1: 1** (no específico de high-volume; global a los selects desktop del dashboard).
- **P2: 3. P3: 3.**

## Hallazgos por severidad

### P0 — bloquea uso / scroll grave / UI rota

Ninguno. Explícitamente: con 5000 usuarios no aparece scroll externo ni interno, la UI no se rompe en ningún viewport/estado, y la paginación 455/556/417/500/358 páginas es operable y entendible.

### P1 — problema visual/operativo importante

**F1 — Texto de los selects de filtro desktop recortado verticalmente (todos los estados desktop).**
El value text de `Tipo usuario` y `Rol` ("Todos", "Admin", "Clínica", "Owner clínica") se renderiza con el ~40% inferior de los glifos amputado por el borde inferior del control. Verificado a zoom 3x en los 8 screenshots desktop y contra el DOM vivo.
**Causa raíz (verificada en sesión):** el control usa `field-select h-8 text-xs md:h-7` → en `md+` alto 28 px con `padding-top: 8px` + `padding-bottom: 8px` y fuente 12 px: content-box de 12 px para un line box de ~14.4 px (`line-height: normal`) → ~2.4 px de recorte inferior. En mobile el control es más alto (36 px) y no recorta.
**Alcance:** clase compartida — afecta a los selects desktop de otros módulos del dashboard, no solo a Usuarios/Roles. Es la misma familia de defecto que ya se corrigió en mobile (`admin-mobile-sessions-select-clipping-density-10.md`).
**No es causado por high-volume** (se reproduce con cualquier dataset), pero es lo único que "rompe" la lectura premium del módulo a primera vista en desktop.

### P2 — mejora visual deseable

**F2 — Ellipsis inconsistente en timestamps CREADO/ACTUALIZADO (desktop).**
Columnas de fecha de 152 px justas: los timestamps cuyo formato usa dígitos anchos (0, 6, 8, 9) desbordan exactamente 2 px y truncan a `07:00 a. ...` / `12:00 p. ...`, mientras filas vecinas con el mismo formato pero dígitos angostos (1, 5) se muestran completas. Medido: clip de 2 px en 4 TDs en `desktop-1440x900-p2`, 3 en `filter-clinic-owner`, 1–2 en el resto. El efecto es aleatorio a la vista (algunas filas con "…", otras no) y se percibe como dato inconsistente en una vista orientada a trazabilidad/auditoría.

**F3 — Settle tardío del límite adaptativo + hueco de ~1 fila en 1440x900.**
Observado en runtime durante la captura: el límite adaptativo pinta 12 filas en el primer paint y re-mide a 11 (reflow visible con el dataset cargado; la corrida inicial del spec falló por esa carrera, con rango real `12–22`). El resultado estable deja un vacío de ~55 px (≈1 fila) entre la fila 11 y el footer en 1440x900. En 1366x768 las 9 filas cierran contra el footer sin void.

**F4 — Mobile: doble chip "Admin" y slot de acción inconsistente con desktop.**
En mobile cada fila admin muestra `admin_operaciones [Admin] … [Admin]`: un chip junto al username (tipo) y otro chip en el slot derecho donde las filas de clínica tienen el botón `Cambiar`. Sin encabezados de columna, la duplicación es redundante/ambigua y el chip derecho puede leerse como botón. Desktop resuelve el mismo caso con el texto `No editable` — inconsistencia desktop↔mobile de semántica del slot de acción.

### P3 — refinamiento menor

**F5 — Rango "1–N de TOTAL" no visible en mobile.** El span `aria-live` del rango existe pero es sr-only (clip medido 65–83 px); visualmente el pager solo muestra `Pág. X / Y` y el total vive en el header (`5000 usuarios`). Correcto para a11y y defendible por densidad, pero es una asimetría menor con desktop (que muestra `1–11 de 5000` + `Pág. 1 / 455` + `11 por página`).

**F6 — Textura de grid del fondo expuesta como "banda segmentada".** Entre la nav horizontal y la superficie del módulo (y bajo el footer en 900 px de alto) asoma una franja de ~15 px del fondo de `main.dashboard-main`, cuyo `background-image` es un grid graph-paper intencional (`linear-gradient 90deg/180deg à 1px`). Verificado por DOM: es diseño, no bleed-through ni capa stale. A zoom parece una fila de cards recortada; a densidad normal es sutil. Opcional atenuar el patrón en los insets.

**F7 — Vacío bajo el último item mobile (~1 item) con pager anclado.** En 390x844 y 360x740 queda un colchón de ~50–70 px entre el último item y el pager anclado abajo. Es el contrato deliberado de pager anclado (`admin-mobile-tokens-pagination-bottom.md`); se anota solo como observación de densidad.

## Observaciones desktop

- Jerarquía clara y estable en los 8 estados: título del card → strip de totales (`Total filtrado / Admins / Clínicas`) → filtros + `N por página` → tabla → footer de paginación. Nada salta de posición al paginar ni al filtrar.
- Totales siempre coherentes con el fixture: 5000/250/4750 sin filtro; 250/250/0 con `Admin`; 2375/0/2375 con `Clínica + Owner clínica`. Rango y `Pág. X / Y` correctos en cada corte (455, 556, 23, 28, 216, 264 páginas).
- Columnas bien alineadas (Usuario 245 px, Tipo 136, Rol 190, Clínica 349, Creado/Actualizado 152, Acción 136 en 1440); filas uniformes 40.5–41 px; badges de Tipo/Rol legibles; `No editable` correctamente atenuado en filas admin.
- La primera slice preserva los usuarios legacy al frente (`admin_operaciones`, `usuario_clinica_01…08`) y la página 2 entra limpia en los sintéticos — el orden determinista del fixture se percibe visualmente.
- Defectos visibles: F1 (selects) en el 100% de los estados; F2 (ellipsis de fechas) disperso; F3 (void de ~1 fila) solo en 1440x900.

## Observaciones mobile

- La card-list es más legible que la tabla a igual densidad: username en 12 px semibold (contraste 14.2:1), línea secundaria `ID · clínica` en 11 px muted (6.4:1), chips de rol claros, botón `Cambiar` con área táctil adecuada; items de 44.5–45.5 px — buen estándar táctil.
- Filtros `Tipo`/`Rol` en fila propia, 36 px de alto, **sin el recorte de texto de desktop**.
- Paginación anclada abajo, siempre visible, `Pág. 1 / 417` legible; `Siguiente`/`Anterior` con estados enabled/disabled correctos en todos los cortes (500 páginas en 360x740 se opera igual de bien).
- Header con total vivo (`5000 usuarios` → `2375 usuarios` al filtrar) — el usuario nunca pierde el contexto del corte activo.
- Defecto visible: F4 (doble chip Admin). F5/F7 menores.

## No-scroll visual

Cumplido de forma **perfecta y medida** en los 15 estados: `scrollHeight − clientHeight = 0` y `scrollWidth − clientWidth = 0` en html, body, `main.dashboard-main` y el workspace del módulo; peor overflow interno de descendientes: 0/0. El único elemento con `overflow-auto` declarado es el wrapper de la tabla desktop y su scroll real es 0 px. Visualmente: sin scrollbars, sin contenido cortado por el viewport, pager y footer siempre dentro de pantalla. El dataset de 5000 usuarios **no** compromete el contrato single-viewport en ningún viewport auditado.

## Densidad y legibilidad

- Densidad adaptativa correcta y proporcional al alto disponible (9→11 filas desktop; 10→12→14 items mobile). Nunca renderiza más que la slice pedida (jamás el fixture completo).
- Tipografía: cuerpo 12 px, secundarios 11 px, valores de totales 18 px semibold. Contraste medido: mínimo 6.13:1 (texto muted `#485F70` sobre superficie clara), tinta principal 13.6–14.2:1 — AA cumplido en todo lo medido, incluso para los tamaños de 11 px.
- Truncamiento: el único truncamiento visible con contenido del fixture es F2 (fechas, 2 px). Usernames largos (`usuario_clinica_fixture_0016`) caben completos en todos los viewports auditados, incluido 360 px.

## Paginación / filtros

- Desktop: footer con rango (`1–11 de 5000`), contexto (`Pág. 1 / 455`), `Anterior`/`Siguiente`, más `11 por página` sobre la tabla. Completo, visible y entendible; deja operar 455–556 páginas sin ambigüedad.
- Mobile: `Pág. X / Y` + botones, total en header; rango exacto solo para screen readers (F5).
- Filtros: visibles y usables en ambos formatos; los cambios de filtro resetean a página 1, actualizan strip de totales, rango y page count de forma atómica (sin estados intermedios incoherentes en las capturas).

## Comparación con objetivo "dashboard premium administrativo"

Con 5000 usuarios el módulo se comporta como software administrativo serio: layout inmóvil, cifras coherentes en todos los cortes, densidad razonada por viewport, sin scroll accidental, sin saltos. La estructura ya no se ve tosca ni frágil.

Lo que todavía resta puntos de percepción premium, en orden: **F1** (selects desktop con texto amputado — es lo primero que un ojo entrenado nota y transmite descuido), **F2** (ellipsis aleatorio en fechas — transmite dato inconsistente), **F3** (void de una fila en 1440x900 + reflow del primer paint), **F4** (chips duplicados en mobile). Todos son de pulido fino, ninguno estructural; corregidos F1/F2, el módulo queda a nivel premium en ambos formatos.

## Riesgos remanentes

- Evidencia capturada solo en Chromium (limitación P0 ya registrada en `total-visual-engineering-audit.md`); el recorte F1 depende del alto de line box y podría variar por motor/fuente del sistema.
- Sin regresión visual automatizada, estos PNG son baseline manual: una futura regresión de layout con high-volume solo se detectaría repitiendo este ejercicio.
- El settle 12→11 de F3 es también un riesgo de flakiness para futuros specs que precomputen aritmética de paginación en 1440x900 (la corrida de captura lo sufrió literalmente).
- Estados no cubiertos por esta auditoría: dark mode, zoom del navegador ≠100%, y combinaciones de filtro sin resultados (0 filas) — quedan para una pasada posterior si se desea exhaustividad.

## Recomendación final

**El bloque CAP (CAP-A1/A2/A3) puede cerrarse visualmente.** Su objeto — validar que el workspace real Admin Usuarios/Roles absorbe 5000 usuarios sin romper no-scroll, densidad, paginación ni coherencia de totales — queda verificado con evidencia visual y numérica, sin P0 y sin ningún hallazgo causado por el volumen.

El P1 encontrado (F1) es **preexistente, global a los selects desktop del dashboard y ortogonal al dataset**, por lo que no debe bloquear el cierre de este bloque, pero sí debe corregirse antes de declarar el módulo "premium". Se proponen PRs chicos de seguimiento (sin implementar aquí, fuera de scope):

1. **PR-CAP-V1 (P1, chico):** corregir el recorte vertical de `.field-select` en desktop (reducir padding vertical o fijar `line-height` compatible con `md:h-7`; alternativa: volver a `h-8` en desktop). Alcance: clase/componente compartido + captura de verificación. Alinear en el mismo PR los source-contract tests que fijen la clase, si los hay.
2. **PR-CAP-V2 (P2, chico):** eliminar el ellipsis aleatorio de CREADO/ACTUALIZADO: `font-variant-numeric: tabular-nums` en las celdas de fecha o +6 px de ancho mínimo de columna (o formato de fecha compacto sin meridiem).
3. **PR-CAP-V3 (P2, chico):** revisar el redondeo del límite adaptativo en 1440x900 para eliminar el void de ~1 fila y el reflow 12→11 del primer paint (medición estable antes del primer render o distribución del remainder).
4. **PR-CAP-V4 (P2, chico):** mobile: reemplazar el chip derecho `Admin` por el equivalente de `No editable` (o diferenciar visualmente tipo vs rol) para alinear la semántica del slot de acción con desktop.

## Confirmaciones de scope

- ✅ No se tocó producción, backend real, API real, auth ni DB (todo contra fixture local `127.0.0.1:3107` + dev server local; los requests de captura llevaban `dataset=high-volume` solo en el wire local).
- ✅ No se modificó nada bajo `frontend/src/` (ni `dashboard/admin/`, ni `AdminMobileUsersModule`, ni `AdminMobileOpsPager`, ni `AdminUsersRolesReadOnlyCard`) — solo lectura para diagnóstico.
- ✅ No se tocaron deps, lockfiles, CI/workflows, `globals.css` ni `frontend/next-env.d.ts` (el dev server lo regeneró durante la captura y fue revertido a su estado de repo antes de las validaciones).
- ✅ No se modificaron specs existentes; la captura usó un spec temporal nuevo, eliminado tras la corrida.
- ✅ skills.zip intacto (no usado, no copiado, no descomprimido).
- ✅ Sin `git add`, sin commit, sin push, sin PR.
