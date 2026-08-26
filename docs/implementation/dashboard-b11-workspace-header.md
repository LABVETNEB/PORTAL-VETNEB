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
- Realineación parcial A02 Linux basada exclusivamente en payloads reales del artifact
  de E2E Completeness; los registros sin captura Linux continúan pendientes.
- Realineación A03 Linux basada exclusivamente en las 234 observaciones reales del
  artifact; A08 validado sin baseline propio.

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

La acción «Volver» usa una altura de 40px dentro del workspace desktop. El `display:none`
mobile aplica únicamente a ADMIN por el contrato B09; CLÍNICA conserva `WorkspaceHeader`
en mobile.

## 4. Deep links y shell

La migración no toca `?module=`, filtros, paginación, rutas completas ni mecanismos de
restore/back-forward. El spec verifica admin y clínica por deep link, exactamente un app
shell y, en clínica móvil, exactamente una navegación publicada. No se modifican
transportes, endpoints, métodos ni payloads.

## 5. Decisión de scope para A02 / A03 / A08

### A02 — geometría

```text
A02_LINUX = 120 STALE / 56 REAL / 64 PENDING
```

Las observaciones A02 anteriores eran Win32 local, no una captura cross-platform. El artifact
Linux aporta únicamente los payloads reales de `admin-informes`, `admin-clinicas`,
`admin-tokens`, `admin-sesiones`, `admin-usuarios`, `admin-auditoria` y `clinic-informes`:
**56 registros desktop/tablet**. Solo esos registros se realinean en
`platformRecords.linux`.

Los otros **64 registros Linux** de ocho superficies verdes pero stale quedan sin modificar
hasta contar con captura Linux real. No se derivaron desde Win32 ni desde mensajes de fallo.
La metadata global `baseCommit` / `capturedAt` se preserva porque es un overlay parcial, no
una recaptura completa.

### A03 — límites adaptativos

```text
A03_LINUX = 234 OBSERVACIONES / 11 LEAVES / 33 CAMPOS
```

Las observaciones A03 anteriores eran Win32 local, no una captura cross-platform. Se usaron
las **234 observaciones Linux reales** del artifact para realinear exactamente **11 leaves** y
sus tres campos de capacidad (`limit`, `offset`, `secondPageCount`): **33 campos**. Los demás
leaves Linux, incluido `source`, quedan intactos; no hubo derivación desde Win32.

La reproducción dirigida Win32 de `clinic-logistica-summary::w430x932` midió
`limit=15`, `offset=15` y `secondPageCount=15`; se conserva el cambio `14 -> 15`.
Es una divergencia medida independientemente de Linux, no una copia entre plataformas.

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
| A02 Linux | **PENDING** · 56 registros reales aplicados / 64 registros Linux pendientes de captura real |
| A03 Linux | **PENDING** · 234 observaciones reales · 11 leaves / 33 campos realineados |
| A03 Win32 dirigido · `clinic-logistica-summary::w430x932` | **PASSED** · `limit/offset/secondPageCount = 15/15/15` · KEEP |
| E2E Completeness | **FAILED** · run 32931837176 (HEAD `c7dae9bd`); 2 failed/2 flaky tras realinear los 2 primeros baselines seriales |
| A08 | **PASSED** · evidencia previa 21/21 · 273 combinaciones |
| `pnpm --dir frontend lint` | **PASSED** · evidencia previa; no repetido por cleanup |
| `pnpm --dir frontend typecheck` | **PASSED** · evidencia previa; no repetido por cleanup |
| `pnpm --dir frontend build` | **PASSED** · evidencia previa; no repetido por cleanup |
| `pnpm security:public-surface` | **PASSED** · evidencia previa; no repetido por cleanup |

### 6.1 Captura visual Chromium-Linux (`Visual Regression Manual`)

`E2E Completeness` corre los specs `visual-regression-authenticated` y `visual-regression-stress`
en serie: cada nombre stale corregido exponía el siguiente (run 32893612037 falló en
`dashboard-320`/`stress-dashboard-320`; el commit `c7dae9bd` los realineó y el run 32931837176
falló recién en `dashboard-dark-gray-320` y `stress-dashboard-768`, deterministas 3/3 con
`maxDiffPixelRatio: 0.001` excedido 10x/30x). Para evitar seguir desbloqueando nombres de a uno,
se disparó una captura Linux completa fuera de ese loop:

- Workflow: `Visual Regression Manual` (`.github/workflows/visual-regression-manual.yml`),
  `workflow_dispatch` sobre `feat/dashboard-b11-workspace-header`.
- Run: `32981010974` · headSha `c7dae9bdb0949a74f36651f2b88dbded6d3ca843` · `ubuntu-latest` ·
  `conclusion=SUCCESS`.
- Inputs: `suite=all`, `update_snapshots=true`, `upload_artifacts=true`.
- Artifact: `visual-regression-all-snapshots-1` (id `9611484240`), descargado a una carpeta
  temporal fuera del repositorio para inventario y comparación SHA256/byte-for-byte contra el
  árbol de trabajo — nunca ejecutado ni regenerado en Windows.

De los 15 PNG de la familia `/dashboard` cubiertos por B11, **2 ya eran idénticos**
(`dashboard-320`, `stress-dashboard-320`, realineados en `c7dae9bd`) y **13 difirieron** y se
importaron desde el artifact, verificados byte-for-byte tras la copia:

```text
visual-regression-authenticated.spec.ts-snapshots/
  dashboard-dark-gray-320  dashboard-768  dashboard-dark-gray-768
  dashboard-1024  dashboard-dark-gray-1024
  dashboard-1536  dashboard-dark-gray-1536
  dashboard-1920  dashboard-dark-gray-1920
visual-regression-stress.spec.ts-snapshots/
  stress-dashboard-768  stress-dashboard-1024  stress-dashboard-1536  stress-dashboard-1920
```

Excluidos por scope aunque presentes en el artifact (`suite=all` corrió los 3 specs completos,
la importación no): `public-*`, `login-*`, `admin-dashboard-*`, `admin-dashboard-dark-gray-*`,
`stress-admin-dashboard-*` — ninguna de esas rutas cambia con B11.

Esta captura realinea los baselines pixel; **no resuelve** los 64 registros A02 Linux
pendientes de captura real (§6, fila A02 Linux), que siguen abiertos y bloquean el merge
independientemente de este resultado. La validación real de `E2E Completeness` sobre el nuevo
HEAD, una vez que Nico haga commit/push, queda pendiente de CI.

## 7. Riesgos residuales

1. Permanecen 64 registros A02 Linux sin captura real; B11 no está listo para merge mientras
   ese gap exista.
2. El régimen compacto del app bar superior para alturas cortas no pertenece a B11.
3. B15 todavía debe consolidar el scaffold; B11 deliberadamente sólo fija el owner del header.

## 8. Rollback lógico

El rollback elimina `WorkspaceHeader`, restaura el markup inline en
`DashboardModuleWorkspace`, revierte los tokens/reglas B11 y devuelve catálogo, guards, los
56 registros A02 Linux y los 11 leaves A03 Linux a su estado anterior. A08 no cambia. No existe migración, estado persistido ni cambio de contrato
HTTP. La reversión es enteramente frontend y de composición/estilo.

## 9. Estado local de entrega

La entrega queda sobre `feat/dashboard-b11-workspace-header`, con HEAD base intacto, cambios
B11 sin stage y sin commit, push ni escritura GitHub. La reproducción dirigida Win32 de
`clinic-logistica-summary::w430x932` conservó `15` en los tres campos medidos.
