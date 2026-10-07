# Admin desktop/tablet space pass (pre-C05)

## Base y alcance

Base: `main` en `57bda7edfbf064529eac6e25fa022cdec660f455` (incluye #1826, compactación
mobile pre-C05, y #1827). Rama: `feat/dashboard-admin-desktop-tablet-space`.

Scope primario único: frontend del dashboard de Administración, desktop y tablet
(≥768px). Referencia visual: las 11 capturas marcadas de `administrador.zip` (rojo =
eliminar, amarillo = mover, flecha = destino). No es un rediseño: se retira chrome y se
reubican controles existentes para ganar altura útil.

Fuera de alcance (deliberado): backend, endpoints, `limit`/`offset`, cálculo de
capacidad, C04 (sorting), C06/C07 (semántica de selección), C05 (densidad/alto de fila),
mobile (<768px, resultado de #1826), Clínica, dependencias, CI/workflows.

## Contrato implementado

- **Inicio retirado en todos los anchos.** El controlador ya no pinta el hub ni lo enlaza
  (drawer ≥1280 y rail 768–1279 pierden el ítem Inicio). El estado sin módulo (ruta
  desnuda, `?hub=1` heredado o `?module=` inválido) resuelve al módulo de aterrizaje con
  el patrón de #1826: último módulo válido, si no `DEFAULT_ADMIN_MODULE = "admin"`
  (Resumen), con `history.replaceState` (sin loops ni entradas de historial extra).
- **Header de módulo recuperado ≥768px (solo admin).** La banda de 40px del
  `WorkspaceHeader` (título + "Vista general") se oculta con las mismas declaraciones que
  G-003 aplica <768px (`navigation.css`, bloque
  `admin-desktop-tablet-module-header-reclaim`). La sección conserva su nombre accesible
  (`aria-labelledby`). Clínica conserva su header.
- **Por módulo** (rojo retirado / amarillo reubicado):
  - Informes: sin descriptor ni tira "entregados · con tinción · Página"; Actualizar y
    Subir informe arriba a la derecha; filtros debajo.
  - Clínicas: sin descriptor; `[buscador] [Nueva clínica] [Actualizar]` en una fila;
    paginador al pie.
  - Auditoría: sin header "Registro operativo", corrida eventos·roles·avisos ni
    "N coincidencias"; la barra C07 se pinta en la fila de cabecera de la tabla, al lado
    del checkbox de página (mismo criterio que la tira mobile), como overlay que no altera
    la geometría de la fila.
  - Sesiones: sin header ni métricas; Cambiar contraseña y Actualizar en la banda de
    filtros; el error de carga queda visible y anunciado (`role="alert"`) en esa banda con
    las filas stale en pantalla. El P2 mobile de #1826 no cambia.
  - Usuarios y roles: sin header ni métricas; Actualizar al final de la banda de filtros;
    feedback de error/cambio de rol visible y anunciado ahí; "Ir a página" retirado.
  - Tokens: sin header ni tira de métricas; "Cargar más" se conserva en el lugar de
    Siguiente. La página desktop queda topeada en 18 filas (decisión de Nico): la
    altura recuperada llegaba a 21 filas en 1920×1080 y 834×1194 y la ventana inicial
    fija (`limit` = 2 × 18 = 36) dejaba de cubrir dos páginas completas; el tope
    mantiene el `limit` congelado.
  - Precios: sin "Lista de precios"; Guardar todos y Actualizar en la barra de pestañas
    (`ModuleTabs` con región de acciones opt-in). Pestañas Citología/Histopatología
    separadas. Cada estudio es una fila de formulario compacta (mismo `<form>`, mismos
    campos y mensajes) y la categoría completa entra en una vista; si algún día no entra
    en el canvas medido, pagina como respaldo en lugar de hacer scroll.
  - Mantenimiento: sin "Estado de esquema"; Reintentar en la barra de pestañas
    (`ModuleTabsActions`). Estado › Esquema conserva su header.
  - Resumen / Estado: solo se retira la banda del header.
- **Paginación admin desktop/tablet:** solo `Anterior` + `Siguiente`, centrados. Sin
  números, página actual, total, rango ni "N por página" pintados (el rango queda
  anunciado `sr-only` donde ya se anunciaba). La lógica de `limit`/`offset`, el estado de
  página y los `disabled` no cambian. Incluye la variante compacta compartida
  (`CollectionPager`, consumidores solo admin) y el paginador de Alertas.

## Precios: auditoría de datos

`PRICE_DATA_SOURCE = GET /api/admin/pricing` (catálogo completo en una sola lectura),
sin `limit` ni `offset`; la paginación era solo de cliente (`usePagedRows`). Mostrar todo
no requiere cambio de backend ni de contrato.

## Validación

Ver el informe del PR para los estados canónicos. Contratos dedicados:
`test/architecture/dashboard-admin-desktop-tablet-space.test.ts` (ADMIN-DT) y los
realineamientos causales de B05/B08/B09/B11/B13/B14, C02/C06/C07 y los specs E2E que
fijaban el hub de escritorio, el header de 40px o el texto de paginación.

## Riesgo residual

- A02: registros Win32 de las 11 superficies admin ≥768px realineados (88); los 55
  registros de teléfono re-observados sin drift. `platformRecords.linux` queda
  desactualizado hasta una corrida de E2E Completeness (no se deriva desde Win32).
- A03/A05: el helper (`dashboard-adaptive-limit-matrix.ts`) ya no depende del texto
  "Pág. N" desde 768px: los leaves admin declaran `pageLabelRegime: "phone-only"` y
  ahí exigen el label AUSENTE y prueban la página 2 con Anterior habilitado y filas
  distintas de la página 1 (más la request única con `offset > 0` en server-request).
  Win32: 69 leaves ≥768px realineados desde una corrida completa (234/234, integridad
  PASSED); `A03_ADMIN_REPORTS` pasó de 40 a 80 para que Informes siga llenando dos
  páginas. `platformObservations.linux` de esos leaves queda pendiente de CI.
- Auditoría, Informes, Usuarios y Tokens ganan altura pero no filas en el fixture: su
  techo de filas lo fija la capacidad congelada (`limit`), no el chrome.
