# C09 · BulkActionMenu sobre SelectionToolbar

## Estado

**C09 = implementado en el árbol local**, sobre `main@b3be50a6` (C08 #1864). Publica `BulkActionMenu` y abre un slot `actions` en `SelectionToolbar`. No adopta ningún módulo productivo, no crea acciones de negocio ni de backend, no modifica C08 y no inicia C10.

## Contrato extraído del rector

| Fuente | Contrato |
|---|---|
| §50 C09 | `BulkActionMenu` sobre `SelectionToolbar`, dependencias C07 y C08 |
| §47.1 | `menus/` agrupa `OverflowMenu · ContextMenu · ActionMenu · BulkActionMenu · SubMenu` |
| §8 | `WorkspaceToolbar = DefaultToolbar ⇄ SelectionToolbar` |
| §9 principio 8 y §46 | Menús, no diálogos, para acciones; ítem 32 px (48 px en < 768), superficie `min` 200 px |
| §50 C06 / C07 | Un owner de selección por ID, persistente entre páginas; la toolbar sólo lee `selectedCount` y `clearSelection` |
| §54 C06–C09 y §56.4 | unit + E2E + axe; acciones masivas y menús por teclado |
| §52 | Informes admin es el candidato con «acciones masivas reales»; Auditoría es sólo lectura |

El rector no define ninguna operación masiva concreta ni su contrato de ejecución: C09 entrega el componente y sus interfaces.

## Owner

- **Ubicación:** `frontend/src/features/dashboard/presentation/surfaces/BulkActionMenu.tsx`, módulo `"use client"` publicado por `presentation/surfaces`. La carpeta `presentation/menus/` de §47.1 sigue diferida, igual que en C08.
- **Composición:** `useCollectionSelection` (C06) → `SelectionToolbar` (C07, slot `actions`) → `BulkActionMenu` (C09) → `ActionMenu` + `ActionMenuItem` (C08). No hay segunda superficie de menú, segundo owner de selección ni teclado propio: el archivo no declara roles, handlers, estado ni efectos.
- **Dependencias:** `lucide-react`, las dos primitivas C08 y el tipo `CollectionSelectionId` de C06 (sólo el tipo; nunca llama al hook). Sin dependencias nuevas, sin CSS y sin tokens.

### API

```ts
type BulkAction<Id> = {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: (selectedIds: readonly Id[]) => void;
  requires?: "single";
  disabledReason?: string;
} & ({ destructive?: false } | { destructive: true; confirmsBeforeRunning: boolean });

type BulkActionMenuProps<Id> = {
  selectedIds: readonly Id[];
  actions: readonly BulkAction<Id>[];
  pending?: boolean;
  label?: string; // "Acciones"
};
```

`SelectionToolbar` gana una prop opcional `actions?: ReactNode`, que se pinta dentro de su mismo `role="group"`, después de «Limpiar», y sólo mientras hay selección. La toolbar no sabe qué es una acción masiva.

### Decisiones

| Tema | Decisión |
|---|---|
| A · API | La de arriba. El host pasa `selection.selectedIds` y su lista de acciones. |
| B · Tipos de acción | Normal, de un solo elemento (`requires: "single"`) y destructiva (`destructive: true`). Sin submenús en C09. |
| C/D · Disponibilidad y disabled | Una acción no disponible es un ítem `aria-disabled`, enfocable, con su motivo visible y dentro del nombre accesible («Eliminar · Requiere confirmación»). Orden de motivos: acción en curso, destructiva sin confirmación, un solo elemento, motivo del host. |
| E · Individual y múltiple | `requires: "single"` se habilita sólo con exactamente 1 seleccionado; el resto corre con cualquier selección. |
| F · Entre páginas | El menú lee toda la selección del owner. Los IDs fuera de la página visible cuentan para la disponibilidad y viajan en el callback. |
| G · `clearSelection` | El menú nunca limpia ni reduce la selección. «Limpiar» sigue siendo de C07; después de una acción, limpiar o conservar es decisión del host. |
| H · Toolbar | Un slot en el grupo existente. Con 0 seleccionados no existe (ni el slot ni el menú). |
| I · Desktop y mobile | Trigger de 32 px desde 768; 44 × 44 px debajo, con sólo el icono debajo de 640 (igual que «Limpiar»). El margen `-my-0.5` evita que crezca la franja de 53 px. |
| J · Ejecución | Siempre el host. `onSelect` recibe una copia de los IDs, una vez por activación, después de que C08 cerró el menú y devolvió el foco. |
| K · Foco | El de C08: Escape, Tab y selección devuelven el foco al trigger, que no se deshabilita durante `pending`, así que no lo pierde. |
| L · Errores y parciales | Del host. El menú no muestra resultados; el host informa en su propia región y deja seleccionados los IDs fallidos con `deselect` de C06. |
| M · Cancelación | Escape, clic exterior y Tab cierran sin ejecutar y sin tocar la selección. Con `pending`, todas las acciones quedan deshabilitadas («Acción en curso») hasta que el host lo retira. C09 no define cómo abortar una operación en curso. |
| N · Destructivas | Una acción `destructive: true` exige declarar `confirmsBeforeRunning`. Con `false` queda deshabilitada («Requiere confirmación»). Con `true`, `onSelect` debe abrir la confirmación del host antes de cambiar nada. `ConfirmDialog` (§47.1) no existe todavía y no es parte de C09. |

El bloqueo no depende sólo de C08: el propio callback de C09 no llama al host cuando la acción no está disponible.

## Adopter

**Ninguno en C09.**

- El único consumidor de `SelectionToolbar` es Auditoría admin, que es una colección de sólo lectura (§52): no tiene ninguna acción masiva.
- No existe ningún endpoint ni contrato de ejecución masiva. Inventarlo sería crear negocio y backend, fuera de alcance.
- Las colecciones con acciones masivas reales (Informes y Tokens admin) son el piloto C17 y el lote C18.

El comportamiento se observa en un arnés de navegador dentro del `WorkspaceScaffold` real, con el owner C06 y la toolbar C07. El host del arnés es un sustituto controlado: registra los IDs que recibe, simula un resultado parcial y una operación en curso, y no llama a ningún backend. Prueba el contrato del menú, no una operación del producto.

## Fuera de alcance

C04, C05 (BLOCKED), C10–C26, `ConfirmDialog`, backend, API, DB, FSM de navegación, service worker, `limit`, `offset`, pager, pitch, reservas A03, CSS global y el rector. C08 no se modificó.

## Guards realineados

- Cuatro cercas prohibían el nombre `BulkActionMenu` en todo `frontend/src` (bloques C02, C03, C06 y C08). C09 lo entrega: el nombre queda cercado por el bloque C09 a su owner y al barril.
- La cerca C08 de «primitivas sólo en el owner y el barril» admite ahora al owner C09, que las compone. El bloque C09 fija que importa exactamente `ActionMenu` y `ActionMenuItem`.
- El censo de consumidores de `useCollectionSelection` (C06) excluye al owner C09: importa el tipo del ID desde ese módulo y el bloque C09 le prohíbe llamar al hook.
- El guard C07 no cambió: la toolbar sigue sin estado, sin menús y sin conocer `selectedIds`.

No se debilitó ni se omitió ningún guard.

## Verificación

Estado Git real, con el owner sin trackear y simulado como trackeado sólo para los guards. Una tarea pesada por vez. E2E sobre el runner de producción (`next start` con el build del entorno de CI).

| Gate | Resultado |
|---|---|
| RED previo (tests C09 sin owner) | FAILED como se esperaba: el owner no existía |
| RED en E2E, corregido en el owner | A 320 px el motivo «Sólo con un elemento seleccionado» se truncaba; se acortó a «Sólo un elemento» |
| Unit C06 + C07 + C09 (`dashboard-c06-collection-selection`) | PASSED 21/21 (C09: 5) |
| Guards B11–C09 (`dashboard-b11-workspace-header`) | PASSED 38/38 (C09: 4) |
| Mutation proof del menú (unit, en ejecución) | 12 mutaciones, todas rompen su flag |
| Mutation proof del owner (guard, estático) | 17 mutaciones, todas rechazadas |
| E2E C06–C09 (`dashboard-b11-workspace-header`, `-g "C0[6-9]"`) | PASSED 47/47 (C09: 8) |
| `e2e:ci` en el runner de producción (79 specs; incluye A08 y los specs de `visual-contract` y `admin-mobile`) | PASSED: 1448 pasan, 1 omitido preexistente, 0 fallan, 4.9 min |
| A02 + A03 + A05 (partición `extended`), runner de producción | PASSED 52/52, sin recaptura |
| `pnpm test` | FAILED 5327/5329: 1 omitido preexistente y 1 fallo ambiental, `e2e-global-03b` exige una DB que esta máquina no tiene |
| Frontend lint, typecheck y build; `typecheck:test`; `security:public-surface`; `e2e:verify-catalog` 7/7; `git diff --check` | PASSED |
| `pnpm validate:local` | NOT_RUN: C09 no toca `server/`; sus piezas aplicables corrieron por separado |
| Visual Linux | BLOCKED en Win32 |

### Geometría medida (arnés)

| Viewport | Host | Limpiar | Acciones | Ítem | Menú |
|---|---|---|---|---|---|
| 1920×1080, 1366×768, 1280×720, 834×1194, 768×1024 | 36 px (fila de cabecera) | 87,63 × 32 | 98,02 × 32 | 32 px | dentro del viewport, sin scroll |
| 390×844, 320×568 | 53 px (franja móvil) | 44 × 44 | 44 × 44 | 48 px | dentro del viewport, sin scroll |

El host mide lo mismo con 0 seleccionados y con la selección y el menú. Sin overflow del documento, sin solapamiento, contador sin truncar y motivos visibles completos en los siete viewports.

## Riesgos residuales

- **Foco tras una limpieza hecha por el host.** Si el host limpia la selección al terminar una acción, la toolbar se desmonta con el trigger enfocado y el foco cae al documento. La toolbar C07 sólo restaura el foco para su propio «Limpiar». El adopter (C17+) debe mover el foco al terminar, o C07 debe asumirlo en una tarea propia.
- **Confirmación por declaración.** `confirmsBeforeRunning: true` es una declaración del host; el menú no puede verificar que la confirmación exista. Debe revisarse en cada adopter hasta que haya `ConfirmDialog`.
- **Ancho en hosts reales.** El trigger suma 44 px más 8 px de separación en móvil. La franja de Auditoría a 320 px ya aloja el selector de página y «Filtros»; un host así debe medir su presupuesto al adoptar. El arnés no incluye «Filtros».
- **Texto largo.** Rótulo y motivo comparten una línea; a 320 px caben unos 45 caracteres antes de truncarse. El motivo sigue en el nombre accesible aunque se trunque a la vista.
- **Sin adopter productivo**, el código no entra al bundle hasta C17+.
- Heredados de C08: menús largos sin scroll interno, submenús superpuestos en ancho estrecho, portal fuera del focus trap de `ModuleDialog`, pulsación larga táctil no medida en dispositivo y límites del guard genérico de `onContextMenu`.
- Heredados de la arquitectura: D-10, DT-13, DT-15 y C05/R13. No se tocaron.
- Censo 01B: la métrica «assertions de censo congelado» está en 621 de un techo de 623. Los tests de C09 no la mueven, pero el margen es de 2.

## Rollback lógico

Revertir el commit C09. Sin datos ni backend.
