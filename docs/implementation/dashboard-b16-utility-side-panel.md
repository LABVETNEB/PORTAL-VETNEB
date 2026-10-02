# B16 · UtilitySidePanel

## Base y alcance

Base local: `codex/dashboard-b15-workspace-scaffold`, `HEAD` y `origin/main` en `0abfa974a83f3c0a36b3902ab0785a427acf9efe`. B15 permanece sin commit y sus cambios se conservaron en el mismo árbol. B16 añade sólo el contenedor utilitario optativo; no migra contenido funcional ni inicia el Programa C.

Antes de B16, `WorkspaceScaffold` componía `header → toolbar → filters → collection → details → footer`, pero `details` era un slot neutral sin owner lateral. El censo de runtime halló detalle inline en Informes clínica y `StudyTimeline`, un diálogo en Auditoría, el drawer de edición de Clínicas, un visor embebido en Informes admin, diálogos de carga y un popover de notificaciones. `NavigationDrawer` y `NavigationRail` son navegación izquierda; no son paneles utilitarios. No había `UtilitySidePanel` ni `DetailsPane` reutilizable. Ningún módulo entrega contenido al slot `details` todavía.

Después de B16, el mismo scaffold conserva el árbol previo cuando `details` está vacío. Si un consumidor suministra contenido genérico al slot, el scaffold mantiene `toolbar`, `filters` y `collection` en la región primaria y monta un solo `UtilitySidePanel` a la derecha; `footer` permanece después de ambas regiones. `WorkspaceScaffold` sigue siendo el owner del layout. El panel se exporta desde `features/dashboard/presentation/layout`; su implementación permanece en el archivo seguido por Git `components/dashboard/ModuleSurface.tsx`, junto al scaffold B15.

## Contrato

API de la primitive: `expanded: boolean`, `onExpandedChange(expanded: boolean)`, `children: ReactNode`, `label?: string`. El scaffold es el owner del estado de colapso y arranca contraído. El slot `details` sólo aporta contenido; la primitive no hace fetch, no conoce módulos ni altera datos, selección, filtros, navegación o paginación.

Ancho expandido nominal: 336 px, tolerancia ±2. `COLLAPSED_WIDTH_CONTRACT = NOT_SPECIFIED`: el panel contraído ocupa sólo el ancho intrínseco del control táctil de 44 px; no se declara un segundo token geométrico. Desde 1280 px participa como columna lateral. Entre 768 y 1279 px se superpone dentro del workspace sin reducir la colección; por debajo de 768 px ocupa el ancho disponible del workspace, conforme a la especificación responsive del documento rector. No se crea drawer ni ruta nueva.

El contenido del panel tiene su propio owner de overflow (`.dashboard-utility-side-panel-content`); el scaffold y el documento no adquieren scroll. La prueba B16 usa contenido genérico corto y comprueba cero overflow exterior expandido y contraído. Un consumidor futuro con contenido largo deberá probar su contrato de scroll frente al de la colección antes de migrarse en Programa C.

El botón permanece en el DOM al contraer; tiene nombre accesible, `aria-expanded`, `aria-controls`, activación por teclado, foco preservado y contorno medido. El panel es un `aside` nombrado. El control mide al menos 44 × 44 px.

## Ledger CSS

| Owner anterior | Owner nuevo | Propiedad | Valor anterior | Valor B16 | Efecto |
|---|---|---|---|---|---|
| Ninguno | `tokens.css` | `--dash-utility-panel-w` | ausente | 336 px | único ancho expandido |
| Ninguno | `surfaces.css` | layout del slot lateral | ausente | flex; overlay bajo 1280 px | preserva la región primaria |
| Ninguno | `surfaces.css` | ancho móvil | ausente | 100 % bajo 768 px | no crea scroll horizontal |
| Ninguno | `surfaces.css` | overflow del contenido | ausente | `auto`, acotado al panel | documento sin scroll |
| Ninguno | `surfaces.css` | foco y control | ausente | 44 × 44 px; contorno 2 px | foco y toque visibles |

## Verificación

- A02: PASSED, 21/21 superficies y 273/273 combinaciones; baseline sin cambios.
- A03: PASSED, 16/16 casos, 195/195 registros primarios y 234/234 hojas; fixture sin cambios.
- A05: PASSED, 15/15 consumidores; no cambia `limit`.
- A08: PASSED, 21/21 superficies sobre 13 viewports; documento y `main` sin scroll.
- Regresión B10–B15: PASSED, 91/91 casos E2E. El spec catalogado B11 incorpora tres casos B16 adicionales, para 94/94.
- B16: guard de arquitectura y tres casos E2E PASSED. El harness E2E monta el componente real en el scaffold real con el CSS de la app; no añade una ruta ni contenido de detalle al producto. Midió 336 px a 1366 y 1024 px, y 390 px a 390 px; cubre apertura, colapso, reapertura, foco, estado accesible y zero scroll.
- Guards de arquitectura/UI seleccionados: PASSED, 107/107.
- Cohorte `e2e:visual-contract`: PASSED, 529 aprobados y 1 omitido por la suite. La primera corrida detectó seis advertencias React de keys en vistas administrativas pobladas; `Children.toArray` normaliza el array recibido por el scaffold sin alterar nodos DOM ni geometría. Los seis casos aislados y la cohorte completa pasaron después de la corrección.
- Frontend lint, typecheck, build y `security:public-surface`: PASSED.
- `git diff --check`: PASSED.

El runner emitió mensajes `ECONNRESET` del servidor de prueba durante la cohorte paralela; no quedaron casos fallidos en la corrida final.

## Riesgo y rollback lógico

El riesgo residual es la composición futura de contenido largo con una colección que ya posea scroll interno. B16 no monta panel en rutas productivas mientras no exista contenido autorizado. Para volver al estado B15 se retiran la primitive y su export, el layout condicional del slot `details`, los selectores y token B16, y los asserts B16 del spec/guard; los adaptadores y contratos de B15 permanecen. No se ejecutó `git revert`.

Programa C queda fuera: sin `DetailsPane`, viewer, inspector, formularios de módulo, selección, acciones de negocio ni migración de módulos. El siguiente ID del roadmap, después de B16, es C01.
