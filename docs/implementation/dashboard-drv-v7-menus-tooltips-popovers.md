# DRV V7 — Menús, tooltip y popovers con fidelidad a Google Drive

## Estado base

- Base: `main@6f2acd6f058f5ca1e0d9987170217c6996bb8851` (#1952, V6 fusionada).
- Rama: `feat/dashboard-drive-v7-menus-tooltips-popovers`.
- Fuente normativa: `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` §65.4 (filas «Menús», «Menús y popovers de filtro», «Tooltip»), §65.6 (V7) y §65.7.
- Referencia de medición: `docs/audit/GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md` §VII.2, §VIII.2, §VIII.3. Solo se comparan valores OBSERVADO.

## Alcance

Incluido: superficie del `ActionMenu` (y con ella `OverflowMenu`, `ContextMenu`, `SubMenu`, `BulkActionMenu` y `FilterOverflow`, que comparten la misma superficie), tooltip del `NavigationRail`, y la extensión de la sonda a esos estados.

Excluido: V8–V11, backend, DB, auth, web pública, dependencias, migraciones, rediseño funcional de filtros, notificaciones, lógica de filtros, consultas, parámetros URL y paginación.

## Auditoría de overlays

| Overlay | Naturaleza | Decisión V7 |
| --- | --- | --- |
| `ActionMenu`, `OverflowMenu`, `ContextMenu`, `SubMenu` (`role="menu"`, una sola implementación) | Menú | Superficie V7 |
| `FilterOverflow` («+N filtros»), `BulkActionMenu` | Menú sobre la misma superficie | Superficie V7; **no** es un popover de filtro de Drive: lista filtros *aplicados* para quitarlos |
| `DashboardNotificationsBell` | Panel informativo (`role="region"`/`dialog`) | Sin cambios |
| `DashboardMobileKebabMenu` | Panel de ajustes móvil (< 768) | Sin cambios |
| Chips de filtros aplicados | Chip con acción de quitar | Sin cambios: no se convierten en disparadores (RM-07/C12 no autorizado) |
| Popover de filtro de Drive (radio 8, ítems 40, `padding 8px 0`, iconos 24/18) | **No existe equivalente funcional en VETNEB** | No se aplica; las tres métricas quedan NO_COMPARABLE |

Disparadores reales: el `ActionMenu` solo se renderiza en `admin-informes` (acciones por informe, visible desde 1280). `admin-auditoria` y `clinic-informes` no tienen menú. El tooltip solo existe donde existe el rail compacto (768–1279): en la matriz V1, el viewport 1024 × 768. Desde 1280 el drawer muestra la etiqueta completa.

## Cambios

1. `ActionMenu.tsx`: superficie con radio 4 px; en tema claro fondo `#ffffff` y sombra exacta `rgba(0,0,0,.2) 0 2px 4px -1px, rgba(0,0,0,.14) 0 4px 5px 0, rgba(0,0,0,.12) 0 1px 10px 0`. Las variantes se anclan en `:root:not([data-theme=dark-gray])`, no en `.dashboard-app-shell`, porque la superficie cae a `document.body` si falta el portal root. El tema oscuro conserva `bg-popover` y `--clinical-shadow-md` hasta F0-D6. Un `outline` transparente de 1 px solo se pinta en `forced-colors`, donde la sombra se descarta. Ítems (32 px desde `md`, 48 px táctil debajo, `px-3`, 13/400/20) y `min-width` 200 ya estaban en el destino y no cambian; el hover se conserva (NO RESUELTO en Drive).
2. `DashboardTooltip.tsx` (nuevo): `#303030` / `#f2f2f2`, 12/400/16, `letter-spacing .1px`, radio 4, padding 4 × 8, `box-shadow: none`, sin transición. Abre con hover de mouse/pen (retardo 300 ms) y con foco de teclado (`:focus-visible`); nunca con táctil. Cierra con Escape, blur, `pointerdown`, scroll, resize y al salir (gracia de 120 ms; permanece abierto con el puntero encima, WCAG 1.4.13). `aria-describedby` solo mientras está abierto; `role="tooltip"`. Posicionamiento fijo con volteo y recorte al viewport. Sin dependencia nueva.
3. `NavigationRail.tsx`: envuelve cada ítem en `DashboardTooltip` y retira el `title` nativo (evita el tooltip duplicado). `aria-label`, `aria-current`, navegación y handlers de activación no cambian.
4. Sonda V7 separada (`dashboard-drv-v7-overlay-fidelity-probe.spec.ts`, `drive-ui-reference.v7-overlays.json`): reutiliza el clasificador, los tipos y el esquema de V1 sin tocarlos.
5. Contratos duros `dashboard-drv-v7-overlays.spec.ts`, guard de arquitectura `dashboard-drv-v7-menus-tooltips.test.ts` y test unitario `dashboard-drv-v7-overlay-fidelity.test.ts`.

### Por qué no Radix

`@radix-ui/react-tooltip` sigue instalado, pero su `asChild` inyecta un `ref` en el hijo. `PublicRouteControl` escribe `ref={markControlHydrated}` y luego `{...props}`: el `ref` de Radix lo sobrescribiría y perdería el marcador de hidratación del que depende `theme-init.js`. Modificar ese componente queda fuera de alcance. La primitiva propia no usa refs en el trigger.

## Evidencia de fidelidad antes/después (§65.7)

Sonda V7 sobre `main@6f2acd6f` (fuentes de `main` con la sonda V7) y sobre V7, 3 superficies × 6 viewports = 18 registros por lado, tema claro. 18/18 PASSED en ambos.

| Componente | Estado | `main` | V7 |
| --- | --- | ---: | ---: |
| Menú | IGUAL | 30 | **45** |
| Menú | DIFERENTE | 15 | **0** |
| Tooltip | IGUAL | 0 | **27** |
| Tooltip | AUSENTE | 27 | **0** |
| Popover de filtro | NO_COMPARABLE | 54 | 54 |

Monotonía: 0 métricas IGUAL de `main` pasaron a otro estado. Por métrica del menú (admin-informes, 1280–1920):

| Métrica | `main` | V7 |
| --- | --- | --- |
| `menu.surface.background` | DIFERENTE (`rgb(248, 251, 252)`) | IGUAL (`rgb(255, 255, 255)`) |
| `menu.surface.radius` | DIFERENTE (8px) | IGUAL (4px) |
| `menu.surface.boxShadow` | DIFERENTE | IGUAL |
| `menu.surface.paddingBlock`, `menu.item.height`, `.paddingInline`, `.fontSize`, `.fontWeight`, `.lineHeight` | IGUAL | IGUAL |

Tooltip (rail, 1024 × 768, las tres superficies): `background`, `color`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `radius`, `padding` y `boxShadow` en IGUAL; contraste medido 11,79 : 1.

Texto permitido: «45 de 45 métricas comparables en IGUAL para el menú, en admin-informes ≥ 1280»; «27 de 27 para el tooltip, en las tres superficies a 1024 × 768». No se afirma fidelidad total.

## NO_COMPARABLE y diferencias inevitables

- `min-width`: Drive 320 (laboratorio) frente a 198 (rector) es NO RESUELTO; rige 200 (§46).
- Hover de ítem simple: sin cambio medible en Drive; VETNEB conserva el suyo.
- Ítems deshabilitados, submenús, texto secundario de atajos, retardo y offsets del tooltip: no medidos o INFERIDO en Drive. VETNEB no tiene consumidores de `SubMenu`.
- Popover de filtro (radio 8, ítems 40, iconos 24/18): sin equivalente funcional.
- Diálogos modales: sin evidencia comparable; se mantiene §46.
- Tema oscuro: sin cambios hasta F0-D6.
- Foco: se conserva el anillo de 2 px (restricción superior de accesibilidad).
- Objetivos táctiles: el ítem de 48 px debajo de `md` no se reduce a 32 px.

## Accesibilidad

Menú: `role="menu"`/`menuitem`, `aria-labelledby` al disparador, foco inicial en un ítem, flechas/Home/End/typeahead, Escape y retorno del foco al disparador, cierre por presión exterior, Tab sin trampa, axe sin violaciones, contraste de texto ≥ 4,5 : 1. Tooltip: `aria-describedby` válido, sin `title` duplicado, texto igual al nombre accesible (que no cambia), Escape deja el foco en el control, axe sin violaciones, contraste 11,79 : 1, outline visible bajo `forced-colors`, sin animación (cubre `prefers-reduced-motion`), sin apertura táctil. El tooltip nunca es el único portador: la etiqueta corta es visible y `aria-label` lleva el nombre completo.

## Validaciones

Estado observado al traspaso (Windows, sin CI todavía). Solo se marca PASSED lo que se vio terminar con código 0.

| Gate | Estado | Nota |
| --- | --- | --- |
| Tests dirigidos V7 (arquitectura + unitario de la sonda) | PASSED | 7 + 5 casos |
| `pnpm test` (5474 pruebas) | FAILED solo en `e2e-global-03b` → BLOCKED | Falta `DATABASE_URL`/`SUPABASE_DB_URL`; las otras 5472 pasaron en la última corrida |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm --dir frontend lint` / `typecheck` | PASSED | exit 0, con el código final |
| `pnpm --dir frontend build` | PASSED | exit 0 (corrido antes del último cambio solo de tests/catálogo/spec) |
| `pnpm security:public-surface` | PASSED | exit 0; hallazgos `server-only` preexistentes en `proxy.ts` |
| `git diff --check` | PASSED | |
| Sonda V7 antes/después | PASSED | 18/18 por lado |
| `dashboard-drv-v7-overlays.spec.ts` | PASSED | 9/9 (corrida previa a retirar `waitForTimeout`: 4/4 de tooltip re-verificados) |
| `visual-contract` | FAILED (10) | 1052 pasadas. 9 × C08 «geometry and viewport clamping» esperaban radio 8 px: realineado a 4 px en este PR, **sin re-verificar** → NOT_RUN (interrumpida). 1 × `dashboard-c24-list-grid-toggle` «same page, same order»: no toca overlays, sin verificar aislado → NOT_RUN |
| A02/A03/A05/A08 por separado, G11, `e2e:smoke` | NOT_RUN / cubiertos solo por `visual-contract` | A08 corre dentro de `visual-contract`; sin fallos de A08 observados |
| CI Linux sobre el HEAD | PENDING | |

Realineaciones (AGENTS §4, sin debilitar): catálogo E2E 128 → 130 specs (`regression` 33, `fixture` 81, `evidence` 3, `visual-contract` 49, `ci` 96, `full` 130), censo del lector canónico 436 → 438, bandas 01B re-ancladas 78 → 99 (specs de arquitectura) y 123 → 156 (archivos de `frontend/e2e`), prueba del rail (`title` → `DashboardTooltip`) y radio de C08 8 → 4 px.

## Riesgos residuales

- La apertura del tooltip por hover usa un retardo de 300 ms que no proviene de Drive (retardo NO RESUELTO).
- `aria-describedby` repite en lectores de pantalla el nombre ya expuesto por `aria-label`; es el comportamiento estándar de los tooltips y se prefiere a un tooltip sin relación ARIA.
- El `DashboardTooltip` solo tiene un consumidor (el rail). Otros `title=` nativos del dashboard no se migran en V7.
- Sin baselines A02/A03/`visual-linux` nuevos: V7 no cambia geometría de documento; no se solicita autorización R13.

## Rollback lógico

`git revert` del squash de la PR V7. No hay migraciones, datos ni configuración que deshacer.
