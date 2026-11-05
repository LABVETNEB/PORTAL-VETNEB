# Dashboard list font-size parity between themes

## Estado base

`main` @ `473d087c` (PR #1958, V10). El bloque `dashboard-drv-v2-neutral-tables` de
`frontend/src/styles/dashboard/tables.css` fijaba `font-size` solo bajo
`:root:not([data-theme="dark-gray"])`. En `dark-gray` cada elemento conservaba el tamaño de
su componente (`text-xs`, `text-sm`, tamaños responsivos), de modo que las listas se veían
más pequeñas que en modo claro.

## Scope

Incluido: igualar el `font-size` computado de las listas entre `normal` y `dark-gray`, con el
modo claro como referencia canónica.

Excluido: colores, pesos, `line-height`, `letter-spacing`, espaciado, alturas, anchuras,
paginación, capacidad adaptativa, baselines, tolerancias y componentes V10/V11.

## Cambio

Las cuatro declaraciones `font-size` (cabecera 14px, celda 14px, fecha `td.tabular-nums`
0.75rem, texto secundario 14px) se extrajeron de los selectores exclusivos del modo claro a
reglas neutrales al tema con prefijo `:root:root` (misma especificidad que los selectores
originales). Los demás valores del modo claro no cambian; los elementos con tamaño propio
(11 px y 12 px) siguen resolviéndose con el tamaño de su componente en ambos temas.

## Medición (Chromium, 21 superficies × 5 viewports, 2.537 elementos de lista)

Viewports: 1920×945, 1366×768, 1280×720, 834×1194, 390×844.

| Claro → oscuro (antes) | Elementos |
| --- | --- |
| 14 → 12 | 1387 |
| 14 → 13 | 555 |
| 14 → 11 | 427 |
| 14 → 9.92 | 79 |
| Total con diferencia (cambio en vivo + recarga persistida) | 1524 por viewport/superficie |
| Después | 0 |

Tamaños del modo claro cambiados respecto de `main`: 0 de 2.537.

El contrato `e2e/regression/dashboard-list-font-size-theme-parity.spec.ts` mide la propiedad
CSS con tolerancia 0 px (cambio de tema en vivo sin recarga y recarga con tema persistido) y
compara el censo del modo claro con `dashboard-list-font-size-light-baseline.ts`, tomado de
`main`.

## Validaciones

Ver la descripción de la PR para los estados canónicos finales. `clinic-log-visitas` (A02,
ancho 937,94→940,70) es una deriva preexistente documentada en V9/V10 y no se absorbe.

## Riesgo residual

El oscuro adopta 14 px donde antes usaba 12/13 px; el `line-height` del oscuro no se
modifica. Las alturas de fila quedan protegidas por A02/A03/A05/A08.
