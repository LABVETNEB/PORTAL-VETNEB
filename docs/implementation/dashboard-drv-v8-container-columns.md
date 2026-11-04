# DRV-01 · Columnas de tabla por ancho de contenedor (V8)

Estado base: `origin/main` 23f747db (V7 #1955 fusionada). Rama: `feat/dashboard-drive-v8-container-columns`.

## Alcance

Incluido (un único scope primario, `frontend runtime`): visibilidad de columnas secundarias de las cinco tablas admin (Auditoría, Usuarios y roles, Informes, Sesiones, Tokens) según el ancho del marco de la tabla; la prop opt-in `containerColumns` de `Table`; el bloque CSS `dashboard-drv-v8-container-columns` en `tables.css`; el contrato E2E, la sonda de evidencia y la realineación causal de censos y de tres specs que codificaban el comportamiento por viewport.

Excluido deliberadamente: alturas de fila y cabecera (V9), `limit`/`offset`/`effectiveLimit`, paginación, orden y `aria-sort`, filtros y URL, endpoints, permisos, diálogos de detalle, superficies PR-TRUNC, SuperSearchField (V10), tema oscuro (V11), cuadrículas (DRV-02), C04, backend/DB/dependencias, web pública.

## Causa

Las columnas secundarias usaban `lg:table-cell` / `xl:table-cell`, es decir, el ancho del viewport. A 1280 px el rail (~80 px) pasa a drawer (~256 px) y el marco de la tabla baja de 1132,75 a 956,75 px mientras `xl:` revelaba una columna más. Medido en el HEAD actual: Auditoría pasaba de 0 a 19 celdas truncadas, Sesiones de 0 a 42, Informes de 0 a 9, Usuarios de 0 a 9.

## Cambio

- `Table` acepta `containerColumns`; si está activa, el marco (wrapper existente, ya único dueño del scroll) recibe `dashboard-table-columns-container` = `container: dashboard-table / inline-size`. La contención de tamaño en línea no altera altura, cabecera sticky, scroll ni canvas adaptativo.
- Cada `th`/`td` con `hidden lg:table-cell` / `hidden xl:table-cell` pasa a `data-column-tier`. `tables.css` oculta el tier por debajo de su umbral con `@container`. Sin JavaScript de medición. Se conservan `table/thead/tbody/tr/th/td` y `aria-sort`.
- Umbrales medidos con un barrido de 20 anchos (fixture y long-text), no copiados de Drive:

| tier | umbral del marco | columnas | fundamento medido |
|---|---|---|---|
| `secondary` | 52 rem (832 px) | Informes Fecha, Sesiones Creada, Tokens Último acceso | 0 truncadas desde 882 px; a 819 px la tabla base ya trunca |
| `secondary-wide` | 56 rem (896 px) | Auditoría Entidad | a 882 px trunca 8 celdas, a 957 px 0 |
| `tertiary` | 72 rem (1152 px) | Auditoría Detalle, Usuarios Creado, Sesiones Expira, Tokens Creado | 0 truncadas desde 1166 px (Detalle es texto libre y trunca por diseño, igual que en main a 1920) |
| `tertiary-wide` | 80 rem (1280 px) | Informes Archivo | 9 truncadas a 1166 px, 8 a 1264 px, 0 desde 1362 px |

La composición es monótona en el ancho del marco: un marco mayor nunca muestra menos columnas.

## Evidencia DRV-01 (sonda V8, `DRV_V8_OUT`)

Antes = `origin/main`; después = V8; mismos datos sintéticos (fixture poblado y dataset long-text), tema claro, mismo servidor de fixtures.

### Fixture poblado
| Tabla | Viewport | Contenedor | Cols antes→después | Truncadas antes→después |
|---|---|---:|---|---|
| auditoria | 1024x768 | 882 | 6→5 | 8/54→0/45 |
| auditoria | 1279x800 | 1133 | 6→6 | 0/54→0/54 |
| auditoria | 1280x800 | 957 | 7→6 | 19/63→0/54 |
| auditoria | 1366x768 | 1034 | 7→6 | 15/63→0/54 |
| auditoria | 1440x900 | 1107 | 7→6 | 13/63→0/54 |
| auditoria | 1920x945 | 1577 | 7→7 | 11/63→11/63 |
| usuarios | 1024x768 | 882 | 6→6 | 0/54→0/54 |
| usuarios | 1279x800 | 1133 | 6→6 | 0/54→0/54 |
| usuarios | 1280x800 | 957 | 7→6 | 9/63→0/54 |
| usuarios | 1366x768 | 1034 | 7→6 | 9/63→0/54 |
| usuarios | 1440x900 | 1107 | 7→6 | 4/63→0/54 |
| usuarios | 1920x945 | 1577 | 7→7 | 0/63→0/63 |
| informes | 1024x768 | 882 | 7→7 | 0/63→0/63 |
| informes | 1279x800 | 1133 | 7→7 | 0/63→0/63 |
| informes | 1280x800 | 957 | 8→7 | 9/72→0/63 |
| informes | 1366x768 | 1034 | 8→7 | 9/72→0/63 |
| informes | 1440x900 | 1107 | 8→7 | 9/72→0/63 |
| informes | 1920x945 | 1577 | 8→8 | 0/72→0/72 |
| sesiones | 1024x768 | 882 | 6→6 | 0/78→0/78 |
| sesiones | 1279x800 | 1133 | 6→6 | 0/84→0/84 |
| sesiones | 1280x800 | 957 | 7→6 | 42/98→0/84 |
| sesiones | 1366x768 | 1034 | 7→6 | 39/91→0/78 |
| sesiones | 1440x900 | 1107 | 7→6 | 0/112→0/96 |
| sesiones | 1920x945 | 1577 | 7→7 | 0/119→0/119 |
| tokens | 1024x768 | 882 | 6→6 | 0/54→0/54 |
| tokens | 1279x800 | 1133 | 6→6 | 0/54→0/54 |
| tokens | 1280x800 | 957 | 7→6 | 0/63→0/54 |
| tokens | 1366x768 | 1034 | 7→6 | 0/63→0/54 |
| tokens | 1440x900 | 1107 | 7→6 | 0/63→0/54 |
| tokens | 1920x945 | 1577 | 7→7 | 0/63→0/63 |

### Dataset long-text
| Tabla | Viewport | Contenedor | Cols antes→después | Truncadas antes→después |
|---|---|---:|---|---|
| auditoria | 1024x768 | 882 | 6→5 | 8/54→0/45 |
| auditoria | 1279x800 | 1133 | 6→6 | 0/54→0/54 |
| auditoria | 1280x800 | 957 | 7→6 | 19/63→0/54 |
| auditoria | 1366x768 | 1034 | 7→6 | 15/63→0/54 |
| auditoria | 1440x900 | 1107 | 7→6 | 13/63→0/54 |
| auditoria | 1920x945 | 1577 | 7→7 | 11/63→11/63 |
| usuarios | 1024x768 | 882 | 6→6 | 2/54→2/54 |
| usuarios | 1279x800 | 1133 | 6→6 | 2/54→2/54 |
| usuarios | 1280x800 | 957 | 7→6 | 10/63→2/54 |
| usuarios | 1366x768 | 1034 | 7→6 | 10/63→2/54 |
| usuarios | 1440x900 | 1107 | 7→6 | 5/63→2/54 |
| usuarios | 1920x945 | 1577 | 7→7 | 2/63→2/63 |
| informes | 1024x768 | 882 | 7→7 | 3/63→3/63 |
| informes | 1279x800 | 1133 | 7→7 | 3/63→3/63 |
| informes | 1280x800 | 957 | 8→7 | 12/72→3/63 |
| informes | 1366x768 | 1034 | 8→7 | 12/72→3/63 |
| informes | 1440x900 | 1107 | 8→7 | 12/72→3/63 |
| informes | 1920x945 | 1577 | 8→8 | 4/72→4/72 |
| sesiones | 1024x768 | 882 | 6→6 | 0/78→0/78 |
| sesiones | 1279x800 | 1133 | 6→6 | 0/84→0/84 |
| sesiones | 1280x800 | 957 | 7→6 | 42/98→0/84 |
| sesiones | 1366x768 | 1034 | 7→6 | 39/91→0/78 |
| sesiones | 1440x900 | 1107 | 7→6 | 0/112→0/96 |
| sesiones | 1920x945 | 1577 | 7→7 | 0/119→0/119 |
| tokens | 1024x768 | 882 | 6→6 | 1/54→1/54 |
| tokens | 1279x800 | 1133 | 6→6 | 1/54→1/54 |
| tokens | 1280x800 | 957 | 7→6 | 1/63→1/54 |
| tokens | 1366x768 | 1034 | 7→6 | 1/63→1/54 |
| tokens | 1440x900 | 1107 | 7→6 | 1/63→1/54 |
| tokens | 1920x945 | 1577 | 7→7 | 1/63→1/63 |

A 1279 y 1280 px, las cinco tablas muestran la misma composición y 0 celdas truncadas (dataset poblado). `rowHeight`, `headerHeight`, `rowCount`, altura del pager y las peticiones `limit`/`offset` son idénticos antes y después en los 80 casos de la matriz estándar.

## Fidelidad V1

Sonda V1 (`DRV_V1_OUT`, 3 superficies × 6 viewports) sobre `origin/main` y V8: IGUAL 487, DIFERENTE 435, NO_COMPARABLE 96, AUSENTE 26 en ambos; 0 métricas cambiaron de estado. La sonda V1 no se modificó. No se afirma fidelidad visual total.

## Capturas

Antes/después a 1279×800, 1280×800, 1366×768 y 1920×945 (cinco tablas): `C:\PORTAL-VETNEB-V7-evidence\shots-before` y `shots-after` (fuera del diff y de `test-results/`).

## Validación

Ver el cuerpo de la PR para estados y evidencia por gate.

## Excepciones y diferencias no comparables

- Las columnas de Drive cuya función sigue NO RESUELTA no reciben función semántica. No se adopta el `min-width: 1000px` del documento Drive (contradice Zero Scroll).
- Las vistas de tarjetas móviles de Informes conservan sus spans `lg:inline`/`xl:inline` (no son tablas; fuera de DRV-01).
- Specs realineados causalmente (no debilitados): `admin-c19-batch-2` (columnas ocultas ahora por ancho de marco), `dashboard-real-app-shell-no-scroll-contract` (Archivo visible solo con marco ≥ 80 rem, y presente en DOM), tests de arquitectura de `Table`, B11 y censos E2E.

## Riesgo residual y rollback

Los umbrales se midieron con el fixture sintético; datos reales más largos pueden pedir ajustar un tier (un valor en `tables.css`). Rollback: revertir el PR; no hay datos ni contratos de API asociados.
