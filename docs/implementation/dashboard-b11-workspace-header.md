# B11 — WorkspaceHeader canónico

```text
BASE_SHA              = b3f6bdd3ed7f1d128e8550c4240c191019ca5c26
RAMA                  = feat/dashboard-b11-workspace-header
DEPENDENCIA           = B10 (ClinicDashboardShell unificado)
ALTURA_OBJETIVO       = 40px ± 2px
OWNER                 = components/dashboard/WorkspaceHeader.tsx
PRESENTATION_BOUNDARY = features/dashboard/presentation/layout/index.ts
```

## 1. Scope

B11 reemplaza la cabecera ad hoc de `DashboardModuleWorkspace` por un primitive
presentation-pure compartido. El contrato comprende título, descripción accesible,
acción leading opcional, acciones opcionales y una única banda plana de workspace.

Incluido:

- `WorkspaceHeader` en `components/dashboard` y export desde `presentation/layout`.
- Composición desde `DashboardModuleWorkspace`, sin cambiar la API de los controllers.
- Tokens y CSS de la banda de 40px.
- Semántica `aria-labelledby` / `aria-describedby` con descripción `sr-only`.
- Guard estático B11, spec E2E B11 y alta en el catálogo.
- Realineación A02 dirigida a B11, sin absorber el catch-up histórico B09.
- A03: 12 cambios Win32 atribuibles a B11. Las cinco hojas de drift preexistente
  detectadas quedan FUERA de este PR; A08 validado sin baseline propio.

No-alcance:

- B15 (`WorkspaceScaffold`) y `DashboardPageHeader`.
- App bar superior B06, drawer/rail, bottom navigation y navegación responsive B09.
- Backend, DB, endpoints, auth, dependencias, lockfile, workflows o CI.
- Cambiar el régimen compacto de app bar para viewports bajos.

## 2. Owner antes / después

```text
ANTES
DashboardModuleWorkspace
└── <div className="dashboard-workspace-header"> + título + descripción + volver

DESPUÉS
DashboardModuleWorkspace
└── <WorkspaceHeader title description leadingAction>
    └── <header data-workspace-header="true"> (owner único)
```

`presentation/workspace` no existe: la frontera canónica es `presentation/layout`, que
publica el implementation compatible alojado en `components/dashboard`.

Los dos consumidores directos siguen siendo
`AdminDashboardWorkspaceController` y `ClinicDashboardWorkspaceController`. En conjunto
cubren 15 módulos adaptativos: 10 admin (`admin`, `admin-report-upload`, `admin-health`,
`admin-clinics`, `admin-particular-tokens`, `admin-pricing`, `admin-sessions`,
`admin-users-roles`, `audit-log`, `admin-maintenance`) y 5 clínica (`operaciones`,
`informes`, `logistica`, `perfil`, `tokens`). No se agregó un segundo owner.

## 3. Contrato de presentación y accesibilidad

| Propiedad | Contrato |
|---|---|
| Altura | `--dash-workspace-header-h: 40px` |
| Banda | `--dash-workspace-header-band: 2px` → `[38, 42]` |
| Título | 14px / 20px / peso 600 |
| Geometría | ancho 100%, una fila, radio 0, elevación 0 |
| Padding inline | `--dash-space-4` (16px) |
| Semántica | `section` enlazada a `h2` y descripción mediante ids estables de `useId` |
| Descripción | permanece en el DOM como `sr-only`; sale del flujo visual permanente |

La acción «Volver» usa una altura de 40px dentro del workspace desktop. En admin móvil,
la cabecera de workspace continúa oculta por el contrato B09; la acción táctil visible no
se achicó ni se duplicó.

## 4. Deep links y shell

La migración no toca `?module=`, filtros, paginación, rutas completas ni mecanismos de
restore/back-forward. El spec verifica admin y clínica por deep link, exactamente un app
shell y, en clínica móvil, exactamente una navegación publicada. No se modifican
transportes, endpoints, métodos ni payloads.

## 5. Decisión de scope para A02 / A03 / A08

### A02 — geometría

```text
A02_TARGETED_REALIGNMENT = PASSED
```

Se midieron únicamente las 15 superficies que consumen `DashboardModuleWorkspace`. La
fixture realinea sus ocho viewports desktop/tablet: **120 registros**, todos con deltas
confinados a `moduleHeader.height` y geometría descendiente de la banda de 40px.

Los 75 registros móviles de esas superficies permanecen byte-idénticos a HEAD. Así B11 no
absorbe el drift histórico B09 observado en app bar, module rail y bottom navigation. También
quedan intactos admin hub, las cinco rutas completas de clínica, el helper A02 y todo Linux.
La metadata global `baseCommit` / `capturedAt` se preserva porque esto es un overlay dirigido,
no una recaptura completa.

### A03 — límites adaptativos

```text
A03 = PASSED 16/16
B11_WIN32_TARGETED_REALIGNMENT = 12 leafKey / 56 campos
PREEXISTING_A03_DRIFT_DETECTED = 5 leafKey / 29 campos · NOT_B11 · NOT_IN_THIS_PR
```

B11 causes targeted adaptive-capacity changes where recovered vertical budget crosses a row
threshold. La fixture Win32 realinea 12 hojas / 56 campos de consumidores
`DashboardModuleWorkspace` directamente atribuibles a la banda canónica de 40px y a la
descripción fuera del flujo permanente.

Durante esa validación aparecieron cinco hojas / 29 campos de drift preexistente: tres
`admin-particular-tokens` mobile, una `admin-pricing` mobile y una
`logistics-bounded-canvas` full-route. **No se absorben en este PR**: conservan sus valores
de base. Las cinco viven estrictamente por debajo de 768px, donde el header de workspace es
`display:none`, de modo que B11 no puede ser su causa; congelarlas aquí convertiría
regresiones ajenas en resultados esperados y A03 dejaría de detectarlas. Quedan para una tarea
de baseline propia. Linux no se derivó desde Win32. La corrida posterior determina el estado
final: **PASSED 16/16**, `195/195` registros primarios y `234/234` hojas.

### A08 — zero scroll

```text
A08 = PASSED
A08_BASELINE = UNCHANGED
```

La evidencia previa de esta misma implementación ejecutó la matriz completa 21×13:
`document`, `body`, shell y main conservaron el contrato exacto de no-scroll en los 273
pares superficie/viewport. El cleanup no cambia source runtime B11 y no repite esa matriz.

Esto no invalida el contrato probado directamente por B11: `WorkspaceHeader` mide 40 ±2px,
la descripción queda fuera del flujo permanente mediante contenido `sr-only`, las relaciones
`aria-labelledby` / `aria-describedby` permanecen válidas, no aparece scroll del documento
y los deep links se preservan.

## 6. Tests y gates

| Gate | Resultado |
|---|---|
| Guard estático B11 | **PASSED** · 7/7 |
| `B11_TARGETED_E2E` | **PASSED** · 4/4 |
| A02 dirigido | **PASSED** · 15 superficies × 8 viewports · 120 registros |
| A02 móvil | **UNCHANGED** · 75/75 registros B09 preservados desde HEAD |
| A03 | **PASSED** · 16/16 · 195 primarios / 234 hojas · 12 B11; 5 preexistentes detectados y NO absorbidos |
| A08 | **PASSED** · evidencia previa 21/21 · 273 combinaciones |
| `pnpm --dir frontend lint` | **PASSED** · evidencia previa; no repetido por cleanup |
| `pnpm --dir frontend typecheck` | **PASSED** · evidencia previa; no repetido por cleanup |
| `pnpm --dir frontend build` | **PASSED** · evidencia previa; no repetido por cleanup |
| `pnpm security:public-surface` | **PASSED** · evidencia previa; no repetido por cleanup |

## 7. Riesgos residuales

1. A02 móvil y las cinco hojas A03 conservan drift Win32 preexistente hasta una tarea de
   baseline independiente; B11 no lo convierte en deuda propia ni lo congela como esperado.
2. El régimen compacto del app bar superior para alturas cortas no pertenece a B11.
3. B15 todavía debe consolidar el scaffold; B11 deliberadamente sólo fija el owner del header.

## 8. Rollback lógico

El rollback elimina `WorkspaceHeader`, restaura el markup inline en
`DashboardModuleWorkspace`, revierte los tokens/reglas B11 y devuelve catálogo, guards, los
120 registros A02 dirigidos y los 12 registros A03 de B11 a su estado anterior. A08 no cambia. No existe migración, estado persistido ni cambio de contrato
HTTP. La reversión es enteramente frontend y de composición/estilo.

## 9. Estado local de entrega

La entrega queda sobre `feat/dashboard-b11-workspace-header`, con HEAD base intacto, cambios
B11 sin stage, staging vacío, cuatro stashes preservados y sin commit, push ni PR.
