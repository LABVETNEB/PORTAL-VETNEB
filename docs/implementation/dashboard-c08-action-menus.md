# C08 · Menús de acciones y contexto

## Estado

**C08 = implementado en el árbol local**, sobre `main@f4589a5a` (PR-NAV-08 #1863). Publica `OverflowMenu`, `ContextMenu`, `ActionMenu` y `SubMenu` (más `ActionMenuItem`) sobre una única superficie de menú. No adopta ningún módulo productivo, no inicia C09 y no toca C05.

Validado sobre el estado Git real: ver «Verificación». Dos cohortes cierran en FAILED por fallos de navegación preexistentes, reproducidos en `HEAD`.

## Contrato extraído del rector

| Fuente | Contrato |
|---|---|
| §50 C08 | `OverflowMenu` · `ContextMenu` · `ActionMenu` · `SubMenu` (ítem 32 px), dependencia B15 |
| §46 (única geometría canónica) | Ítem: 32 px, `min-width` 200, `padding 0 12px`, radio 0, sin borde ni sombra, body-sm. Superficie: alto auto, `min` 200, `padding 8px 0`, radio 8, sin borde, elevación 2 |
| §26 fila «Ítem de menú» | 48 px en < 768 (táctil) |
| §9 principio 8 | Menús, no diálogos, para acciones de ítem |
| §26 y §45.2 | Elevación sólo en menús, diálogos y overlays (nivel 2 para menú); chrome persistente sin sombra |
| §54 C06–C09 | unit + E2E + axe |
| §56.4 | Menús por teclado: Tab, Shift+Tab, Enter, Escape |

§25.2 mide 198 px de `min-width` en Drive; §46 declara que su tabla es la única canónica, así que rige 200 px.

## Owner

- **Ubicación:** `frontend/src/features/dashboard/presentation/surfaces/ActionMenu.tsx`, módulo `"use client"` publicado por `presentation/surfaces`. La carpeta `presentation/menus/` de §47.1 queda diferida, igual que el resto de la taxonomía destino: las primitivas C01–C07 también viven en `surfaces`.
- **Una implementación:** `MenuSurface` (interna) es el único `role="menu"` del frontend. Las cuatro primitivas la componen; ninguna duplica teclado, foco ni posicionamiento.
- **Dependencias:** `react`, `react-dom` (`createPortal`), `lucide-react`, `ui/button` y `cn`. Sin dependencias nuevas.

### API

| Primitiva | Responsabilidad | Props |
|---|---|---|
| `ActionMenu` | Trigger con texto + menú | `trigger`, `children`, `label?`, `align?` (`start`), `disabled?`, `triggerClassName?` |
| `OverflowMenu` | Adaptador de `ActionMenu` con trigger de sólo icono (⋮) | igual, con `label` obligatorio y `align` `end` por defecto |
| `ContextMenu` | El mismo menú abierto sobre una región del host | `label`, `menu`, `disabled?`, `children: (region) => ReactNode` |
| `SubMenu` | Ítem que abre un nivel anidado | `label`, `children`, `disabled?`, `icon?` |
| `ActionMenuItem` | Acción | `children`, `onSelect`, `disabled?`, `icon?` |

`ContextMenu` no agrega nodos al DOM: entrega `onContextMenu` y `onKeyDown` para que el host los aplique a su propio elemento (una fila `tr`, un `li`, un `article`), de modo que la geometría del host no cambia.

### Comportamiento

- **Estado:** cada raíz (`ActionMenu` o `ContextMenu`) es dueña de su estado abierto/cerrado; cada superficie, de cuál de sus submenús está abierto (uno por nivel). El host no recibe ni controla ese estado.
- **Apertura:** clic, Enter, Space y ArrowDown abren en el primer ítem; ArrowUp abre en el último. `ContextMenu` abre con clic derecho (en el puntero) y con Shift+F10 o la tecla ContextMenu (sobre el elemento enfocado).
- **Menú nativo preservado:** sobre una selección de texto que alcanza al destino del evento (lo contiene o lo cruza; una selección en otra fila no cuenta, review de #1864) o sobre un campo editable (`input`, `textarea`, `select`, `contenteditable`), `ContextMenu` no abre ni cancela el evento: copiar y pegar siguen en el menú del navegador.
- **Teclado en el menú:** ArrowUp/ArrowDown con vuelta, Home, End, type-ahead por primera letra, ArrowRight/Enter/Space abren un submenú, ArrowLeft lo cierra.
- **Cierre:** Escape cierra un nivel por pulsación. Tab cierra todo sin atrapar el foco. Clic exterior cierra todo sin ejecutar nada. Un cambio de tamaño o un scroll del viewport cierra el menú en vez de dejarlo descolocado.
- **Foco:** al cerrar por Escape, Tab o selección, el foco vuelve al elemento desde el que se abrió; al cerrar un submenú, a su ítem padre. Tras un clic exterior el foco queda donde el usuario hizo clic.
- **Disabled:** `aria-disabled="true"`, enfocable y anunciado; no ejecuta `onSelect` ni abre su submenú, por teclado ni por puntero.
- **Acción:** `onSelect` se ejecuta una sola vez, después de cerrar todos los niveles y devolver el foco. El owner no navega, no llama al backend y no conoce selección, paginación ni capacidad.
- **ARIA:** `role="menu"` con `aria-orientation="vertical"` y nombre (por el trigger, por el ítem padre o por `label`); `role="menuitem"` con `tabIndex={-1}`; `aria-haspopup="menu"`, `aria-expanded` y `aria-controls` en el trigger y en el ítem de submenú.
- **Sin transición ni primer cuadro oculto:** la superficie se coloca en un layout effect, antes del pintado, y lleva `transition-none`. Con `prefers-reduced-motion`, la regla global `* { transition-duration: 0.01ms !important }` hace transicionar toda propiedad; una superficie revelada después de colocarse seguía computando `visibility: hidden` cuando su primer ítem debía recibir el foco, y el menú abría sin foco.
- **Posicionamiento:** `position: fixed` en un portal a `[data-dashboard-portal-root]` (con `document.body` como reserva), para heredar los tokens del shell sin participar del layout. La superficie se invierte cuando no hay lugar (arriba del trigger, al otro lado del ítem padre, hacia atrás desde el puntero) y luego se acota con 8 px de margen en ambos ejes. Nunca es más ancha que el viewport menos 16 px.
- **Eventos a través del portal:** la superficie detiene la propagación React de teclado, clic y `contextmenu`, para que una acción de menú no dispare handlers de la fila o región que lo aloja.

### Geometría

| Elemento | ≥ 768 px | < 768 px |
|---|---|---|
| Ítem | 32 px, `0 12px`, radio 0, 13/20 px w400 | 48 px |
| Superficie | `min-width` 200, `8px 0`, radio 8, `--clinical-shadow-md` (la receta que `--dash-elevation-menu` nombra), sin borde | igual, `max-width: 100vw − 16px` |
| Trigger `ActionMenu` | 32 px de alto | 44 px de alto |
| Trigger `OverflowMenu` | 32 × 32 | 44 × 44 |

El host puede fijar otra geometría de trigger con `triggerClassName` cuando su fila tiene un alto congelado. C08 no agrega CSS, tokens ni reservas: sólo clases de utilidad.

## Adopter

**Ninguno en C08.** Decisión derivada de la arquitectura real:

- El único módulo con baseline zero-scroll limpio en la auditoría previa, Clínicas admin, tiene una sola acción por fila («Editar»). Sustituirla por un menú de un ítem agrega un clic sin aportar nada, y obliga a realinear el contrato A01 y el E2E del drawer.
- Los módulos con varias acciones por fila (Informes y Tokens admin) son el piloto C17 y el lote C18, y arrastran los 11 fallos zero-scroll de causa no demostrada.
- Auditoría está cercada por los guards C06/C07 (sin `onClick`, roles ni `onKeyDown` en la tabla).

Las primitivas se observan en ejecución dentro del `WorkspaceScaffold` real (B15) mediante un arnés de navegador, junto al owner C06 y la toolbar C07, igual que B16 y C01. La adopción por módulo es C17+.

## Fuera de alcance

C04, C05 (BLOCKED), C09 (`BulkActionMenu`, acciones bulk), C10–C26, backend, API, DB, FSM de navegación, `limit`, `offset`, pager, pitch, reservas A03, CSS global y el rector.

## Guards realineados

- `C06 · C05 and C08+ stay unstarted…` prohibía los cuatro nombres en todo `frontend/src`. C08 los entrega, así que esa cerca conserva `BulkActionMenu` (C09) y los cuatro nombres quedan cercados por el bloque C08 al owner y su barril.
- `frontend-visual-consistency` prohíbe `onContextMenu` en todo `frontend/src` (junto a `onCopy`, `onCut`, `onPaste`, `onSelectStart`, `onMouseDown` y `onTouchStart`) para que la interfaz no le quite al usuario copiar ni el menú del navegador. El rector exige `ContextMenu` en C08: es una contradicción entre ambas fuentes. Se resolvió con una excepción de un único archivo y un único handler (el owner C08, sólo `oncontextmenu`), condicionada por el guard C08 a que el owner ceda el menú nativo sobre texto seleccionado y campos editables y a que ningún otro archivo use `onContextMenu`. Los otros seis handlers siguen prohibidos también en el owner. **Requiere confirmación de Nico**; la alternativa es retirar `ContextMenu` de C08.
  - Revisión posterior: la exención cubre el archivo entero, y el guard C08 sólo contaba la presencia de la regla de cesión. Seis mutaciones aditivas dentro del owner pasaban en verde (un `onContextMenu` incondicional en el trigger, la superficie cancelando en vez de detener la propagación, una salida temprana en `keepsNativeMenu`, un `preventDefault` antes de ceder, un listener nativo `contextmenu` y `document.oncontextmenu`). El guard C08 ahora fija la superficie exenta: exactamente tres sitios `onContextMenu` con su forma, ocho `preventDefault(`, tres `addEventListener(`, ningún `contextmenu` nativo y `keepsNativeMenu` sin salida previa. Las seis quedan rechazadas.
  - Límite preexistente, no abierto por C08: `frontend-visual-consistency` busca los nombres de props (`oncopy`, `oncontextmenu`…), así que un `addEventListener("contextmenu" | "copy", …)` en cualquier otro archivo nunca fue detectado, tampoco en `main`.
- `dashboard-foundation-tokens` restringe los tokens `--dash-*` a `styles/dashboard`, `components/dashboard` y `app/dashboard`. No se tocó: el owner consume `--clinical-shadow-md`, que es global, y el guard C08 fija que `--dash-elevation-menu` siga apuntando a esa receta.

No se debilitó ni se omitió ningún otro guard.

## Verificación

Estado Git real, con el owner en el índice. Una tarea pesada por vez.

| Gate | Resultado |
|---|---|
| RED previo (guard C08 sin owner) | FAILED 3/3 como se esperaba |
| RED en E2E, corregido en el owner | Con reduced motion el menú abría sin foco (10/12 en rojo); el submenú abierto por hover se cerraba solo (1/12 en rojo) |
| Guards `test/architecture/**` + `test/unit/ui/**` | PASSED 2908/2909, 1 omitido preexistente |
| Mutation proof del owner (guard C08) | 28 mutaciones en memoria, todas rechazadas (19 originales + 7 de la superficie exenta + 2 del alcance de la selección) |
| E2E C08 (`dashboard-b11-workspace-header`, `-g C08`) | PASSED 12/12 |
| Spec B11–C08 completo + C04 (`admin-clinics-column-sort`) | PASSED 70/70 |
| A02 + A08 | PASSED 42/42 |
| A03 + A05 | PASSED 31/31, sin recaptura |
| `dashboard-zero-scroll-mobile-boundary` | PASSED 8/8 |
| `e2e:visual-contract` | FAILED: 860 pasan, 10 fallan, 1 omitido, 32.0 min. Ningún fallo es de C08 (ver abajo) |
| `e2e:admin-mobile` | FAILED: 157 pasan, 2 fallan, 4.0 min. Ningún fallo es de C08 (ver abajo) |
| Frontend typecheck, lint y build; `typecheck:test`; `security:public-surface`; `e2e:verify-catalog` 7/7; `git diff --check` | PASSED |
| `pnpm validate:local` | NOT_RUN: gates de backend; C08 no toca `server/` |
| Visual Linux | BLOCKED en Win32 |

### Fallos de las cohortes y su control

Cada control repite los mismos tests con las fuentes productivas en `HEAD` (barril restaurado y owner fuera del árbol), y restaura C08 verificando por hash.

| Fallo | Con C08 | Con `HEAD` | Clasificación |
|---|---|---|---|
| Matriz FSM `KNOWN_RESIDUAL_D10` (F4×S1, F4×S2, F7×S2 ×2) | falla en las 3 corridas | falla | Preexistente |
| Modelo FSM, seed `0x4e415606`, corridas 19/20 y 20/20 | falla en las 3 corridas | falla | Preexistente |
| Puntero real, «clinic return to the committed module» | falla | falla | Preexistente |
| Zero-scroll «clinic perfil public profile editor sections fit», 1366×768 | 1 de 2 | falla | Preexistente, intermitente |
| Rail de clínica, «operaciones» | 3 de 4 | 1 de 4 | Preexistente, intermitente |
| Admin mobile ops/core: la navegación termina en `?module=admin` | 2 de 30, tests distintos cada vez | 2 de 30 | Preexistente, intermitente |
| B06 búsqueda global | falla en cohorte, pasa aislado | pasa | Intermitente, misma firma `?module=admin` |
| FSM clínica «full route … stalls» | 2 de 3 | pasa (1 corrida) | Intermitente; sin reproducción en `HEAD` |

Ningún módulo productivo importa el owner, así que C08 no tiene camino de código hacia la navegación. El último renglón es el único que no quedó demostrado como preexistente.

### Revalidación en la máquina destino (`21a3589e` + endurecimiento del guard)

Las dos cohortes anteriores corrieron sobre `next dev`. CI usa el runner de producción (`next start` sobre el build), y ahí se repitió.

| Gate | Resultado |
|---|---|
| Build con el entorno de CI; marcadores del owner (`data-action-menu`, mensaje del contexto) en `.next` | PASSED; 0 archivos (control positivo: la toolbar C07 sí está). El owner no llega al bundle |
| `e2e:ci` en el runner de producción (79 specs; contiene los 32 de `visual-contract` y los 15 de `admin-mobile`) | PASSED: 1440 pasan, 1 omitido, 0 fallan, 4.7 min. Incluye C08 12/12 y todos los renglones de la tabla anterior |
| FSM clínica, tests «full route» × 30, runner de producción | PASSED 240/240 |
| FSM clínica, tests «full route» × 30, `next dev` | FAILED 239/240: «full route … stalls» 30/30; falla 1 vez «Back then Forward…» (`Back is in flight`: el Back no emite su payload) |
| Guards `test/architecture/**` + `test/unit/ui/**` | PASSED 2908/2909, 1 omitido preexistente |
| `pnpm test` | FAILED 5318/5320: 1 omitido y 1 fallo ambiental, `e2e-global-03b` exige una DB que esta máquina no tiene |
| Frontend lint, typecheck y build; `typecheck:test`; `security:public-surface`; `e2e:verify-catalog` 7/7; `git diff --check` | PASSED |
| `e2e:visual-contract` y `e2e:admin-mobile` sobre `next dev` | NOT_RUN: sus specs ya corrieron en el runner que usa CI |
| Control en `next dev` sin el owner | NOT_RUN: una tasa de 1/240 no se separa de 0 con un lote razonable; el owner no tiene efectos a nivel de módulo |

Los fallos de las cohortes son del runner `next dev`, no del producto compilado ni de C08. El caso «full route … stalls» no se reprodujo en 60 corridas (30 por runner).

## Hallazgo zero-scroll preexistente

La auditoría anterior registró 11 fallos zero-scroll en overview, tokens, informes, auditoría y usuarios/roles, con Clínicas admin en PASSED, de causa no demostrada. C08 no modifica ningún módulo, hoja de estilo ni contrato zero-scroll; no se atribuyen a C04 ni a C08 y no se re-congeló ningún baseline.

En esta sesión A08 (21/21), los contratos zero-scroll desktop (45/45 en la primera pasada) y el límite mobile (8/8) pasaron. Los fallos observados en specs `*-no-scroll` de admin mobile no son de geometría: la navegación previa a la medición se pierde y la URL queda en `?module=admin`, también en `HEAD`. Es una hipótesis razonable para aquellos 11 fallos, no una demostración: no se reprodujo el conjunto original.

## Riesgos residuales

- Un menú con más ítems de los que caben en el alto del viewport no tiene scroll interno (lo prohíbe el contrato zero-scroll): con ítems de 48 px caben 10 a 320 × 568. Los hosts deben agrupar con `SubMenu`.
- En viewports estrechos un submenú que no cabe al costado se superpone a su padre; ArrowLeft y Escape vuelven al nivel anterior.
- `ContextMenu` abierto con el puntero sin nada enfocado no tiene a dónde devolver el foco al cerrarse.
- Dentro de un `ModuleDialog` de Radix, el portal del menú queda fuera del focus trap del diálogo; ese caso no está cubierto y debe probarse al adoptar.
- Sin adopter productivo, el código no entra al bundle hasta C17+.
- La cesión del menú nativo en pantallas táctiles (pulsación larga para seleccionar texto dentro de una región con `ContextMenu`) no está medida: el E2E despacha `contextmenu` sintético. Debe probarse en un dispositivo real al adoptar.
- Desde C17+ un módulo toma el menú contextual con `{...region}`, sin escribir `onContextMenu`: `frontend-visual-consistency` deja de verlo y la garantía pasa a ser la regla de cesión del owner, fijada por el guard C08 y el E2E.

## Rollback lógico

Revertir el commit C08. Sin datos ni backend.
