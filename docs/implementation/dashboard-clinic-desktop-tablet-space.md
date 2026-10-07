# Clinic desktop/tablet space pass (pre-C05)

## Base y alcance

Base: `main` en `ef547e2071e2df8b7f298460372c024f6818b2d2` (incluye #1828, compactación
admin desktop/tablet). Rama: `feat/dashboard-clinic-desktop-tablet-space`.

Scope primario único: frontend del Dashboard Clínica, desktop y tablet (≥768px).
Referencia visual autoritativa: las 5 capturas marcadas de `clinicas.zip` (rojo = eliminar,
amarillo = conservar y mover, flecha = destino). No es un rediseño: se retira chrome y se
suben controles existentes para ganar altura útil.

Fuera de alcance (deliberado): mobile (<768px), backend, API, auth, sesión, permisos,
`limit`/`offset`, lógica de paginación, C04, C05 (densidad/alto de fila), C06/C07,
Admin, rutas full de Informes/Logística (sólo se verifica que sigan funcionando),
dependencias, CI/workflows.

## Contrato implementado

- **Header de módulo recuperado ≥768px (Clínica).** Bloque CSS propio
  (`navigation.css`, `clinic-desktop-tablet-module-header-reclaim`) con las mismas
  declaraciones que Admin (#1828) y G-003 (<768px). La sección conserva su nombre accesible
  (`aria-labelledby`/`aria-describedby`). Las rutas full no tienen header y no cambian.
- **Corridas resumen retiradas en los 5 workspaces** (rojo en las 5 capturas): ya eran
  `hidden md:flex`, así que no pintaban en mobile; se retiran del DOM. Las 5 rutas full
  conservan las suyas.
- **Operaciones:** sin banda resumen; "Métricas operativas" queda sólo como nombre accesible
  de la sección (`md:sr-only`) y su descripción deja de pintarse desde 768px. Tabs y cards
  quedan al tope.
- **Informes:** `[filtros …][Abrir módulo completo]` en una banda. La barra declara como
  `flex-basis` el ancho que necesita su grilla: si filtros y CTA no entran juntos (1024–1440),
  el CTA pasa a una segunda línea alineado a la derecha en vez de comprimir campos. Desde/Hasta
  tienen `minmax(8.5rem, …)`: los inputs de fecha nativos ya desbordaban su pista en `main`
  y se solapaban con Aplicar.
- **Logística:** sin resumen; "Abrir módulo completo" alineado a la derecha.
- **Tokens:** sin descripción, sin resumen y sin la cabecera de lista ("Últimos tokens de la
  clínica / Lista paginada… / Pág. N"); `[filtros …][Actualizar][Generar token particular]` en
  una banda con el mismo criterio de wrap que Informes. Los mensajes de error/estado siguen
  pintándose.
- **Perfil (single-open):** avatar/logo siempre visible arriba; debajo, filas de apertura
  exclusiva Datos → Contacto → Contenido → Cambiar contraseña (`<button aria-expanded
  aria-controls>`), y al final `Visible en banco` + `Guardar perfil público`. Ancho acotado
  con el patrón `max-w-3xl` existente. Chips y filas manejan el mismo `activeTabId`. Mobile
  conserva chips, toolbar y resumen.
- **Paginación Clínica ≥768px:** sólo `Anterior`/`Siguiente`, centrados (Informes, Logística,
  Tokens). El rango sigue anunciado `sr-only`. En Logística es opt-in en el pager compartido
  (`pageStateRegime="phone-only"`): Admin y las rutas full no lo usan.

## Perfil: auditoría de estado

- `formState`, avatar, mensajes y `activeTabId` viven en `ClinicPublicProfileCard`. Cerrar
  Datos/Contacto/Contenido desmonta sus inputs sin perder valores (así ya ocurría con los
  tabs) y mantiene la validación nativa acotada a la sección abierta.
- `PasswordChangePanel` tenía estado propio y **se perdía** al cambiar de tab (se
  desmontaba). Ahora queda montado y oculto mientras está cerrado, en ambos regímenes.
- Un solo `<form id="clinic-public-profile-form">` (antes uno por tab, uno a la vez). El
  handler, el endpoint (`PATCH /api/clinic/profile`) y el payload no cambian. La regla
  preexistente de ocultar Guardar con "Cambiar contraseña" abierta se mantiene.
- Desde 768px, `PasswordChangePanel` (`embeddedFromMd`, opt-in) no pinta su encabezado
  "Seguridad", porque la fila ya lo nombra. Así entra a 1280×720 sin recorte.
- El avatar queda siempre montado (oculto en mobile fuera de "Estado"), así que el archivo
  seleccionado también persiste entre secciones.

## Geometría medida (Win32 Chromium, before = `ef547e20`, after = esta rama)

| Módulo | Primer control funcional | Tope de tabla/lista | Filas visibles | Alto de fila |
|---|---|---|---|---|
| Operaciones | +85px (todos) | — | — | — |
| Informes | +32.5 (768–1366) / +41.75 (≥1536) | +48 / +88 | +1 / +2 | 44 → 44 |
| Logística | +56 | +56 | dataset 3 → 3 | 52 → 52 |
| Perfil | +164 (avatar) | — | — | — |
| Tokens | +57.5 / +66.75 | +142 / +182 | +3 / +4 | 44 → 44 |

Viewports: 768×1024, 1024×768, 1366×768, 1536×960, 1920×1080. Scroll de documento = 0 en todos.

## Validación

Contratos dedicados: `test/architecture/dashboard-clinic-desktop-tablet-space.test.ts`
(CLINIC-DT, fuente) y `frontend/e2e/clinic/shell/dashboard-clinic-desktop-tablet-space.spec.ts`
(CLINIC-DT-SPACE, runtime: 6 viewports ≥768 + frontera 390×844).

- A02: 40 registros Win32 realineados (5 módulos × 8 viewports ≥768). Los 25 de teléfono y
  las 5 rutas full se re-observaron sin drift; corrida completa 21/21.
- A03: dirigido a los 3 leaves de Clínica, que ahora declaran `pageLabelRegime: "phone-only"`.
  24 leaves Win32 realineados (≥768: tamaño de página +1…+4); 15 de teléfono idénticos.
- A05: 15/15 sin cambios.
- Realineados causalmente: B11, B12, B14 (arquitectura + E2E), CMP-05 metric-run parity,
  módulo state parity, real app-shell, tokens mobile parity, evidencia post-UX1, contratos
  unitarios de Perfil/Tokens/Operaciones, S7/D-06 y censos del catálogo E2E y del lector
  canónico.

## Riesgo residual

- `platformRecords.linux` (A02) y `platformObservations.linux` (A03) de esos registros, y los
  12 PNG Linux de `/dashboard` ≥768 (claro, dark-gray y stress), quedan `PENDING_REAL_CI`:
  se promueven desde E2E Completeness y no se derivan de Win32. Los 320px no cambian.
- Tokens: la ventana de fetch se sigue calculando con la misma fórmula sobre la capacidad
  medida (`min(36, max(12, filas × 3))`). Con más filas, el `limit` de la request crece dentro
  del mismo tope; las dos páginas completas siguen cubiertas (máx. 18 filas a 834×1194).
- 1024–1440: en Informes y Tokens las acciones bajan a una segunda línea porque filtros y
  acciones no entran en una (decisión de no comprimir campos).
- Flake preexistente fuera de scope: `admin audit mobile filter keeps keyboard interaction
  hydration-safe` falla de forma intermitente (1/3) por `aria-hidden` del diálogo sobre la
  navegación admin antes de hidratar; archivos no tocados.
