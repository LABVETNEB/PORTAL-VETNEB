# PR-LOGISTICA-REDESIGN-1 — Rediseño master-detail de Logística clínica

## PR

`feat(clinic): redesign logistics master-detail workspace`

Rama: `feat/clinic-logistics-master-detail-redesign`

## Base

`main @ 83b2ac0` — `docs(dashboard): document blocked master-detail scope (#1218)`

## Scope

Rediseñar únicamente la superficie `ClinicLogisticaWorkspaceSummary` del dashboard clínico para
eliminar la dependencia de `.dashboard-inline-scroll` y del detalle inline expandido, sin clipping
en mobile, sin scroll global y sin tocar CSS global.

Fuera de scope (no tocado): `MasterDetailWorkspace.tsx`, rutas full-page de informes/logística,
backend, API, auth, DB, CI, deps, lockfiles, snapshots, `globals.css`.

## Skills elegidas

- **Principal:** `vetneb-production-web-optimization-engineer`.
- **Complementarias:** `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`,
  `vetneb-web-end-to-end-global`, `vetneb-staff-senior-full-stack-engineer`.
- **Guardrail:** `vetneb-security-production-invariants`.
- **Modelo:** Claude Opus 4.8 (`claude-opus-4-8`), esfuerzo alto.

## Archivos modificados

1. `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`
2. `frontend/e2e/dashboard-clinic-logistica-mobile-parity.spec.ts`
3. `docs/implementation/clinic-logistics-master-detail-workspace.md`
4. `test/frontend-dashboard-home.test.ts` — sólo el test de contrato de Logística
   (líneas 233-248), alineado al nuevo contrato `ModuleDialog` con autorización explícita
   (precedente #958). No se tocó ningún otro test del archivo.

## Cambio de contrato visual

Antes:

- Lista con inner-scroll (`.dashboard-inline-scroll`).
- Detalle renderizado inline debajo de la fila seleccionada
  (`.dashboard-inline-detail` / `[data-detail-state="selected"]`).
- `selectedVisitId` inicial apuntaba a la primera visita, abriendo detalle al render.

Ahora:

- Lista compacta fija dentro de `[data-clinic-logistics-list-panel="true"]` /
  `[data-clinic-logistics-list-body="true"]`, sin inner-scroll y sin clipping.
- Cada fila es un botón `[data-clinic-logistics-row="true"]`, operable por teclado, con
  `aria-haspopup="dialog"` y `aria-label` claro.
- Detalle movido a `ModuleDialog` controlado (`[data-clinic-logistics-detail-dialog="true"]`),
  renderizado vía portal (no debajo de la fila).
- `selectedVisitId` inicial `null`: no abre detalle en el render inicial.
- El detalle muestra: clínica, estado, fecha programada, fecha completada (si existe), dirección
  y la acción “Abrir visitas en módulo completo”.
- Cierre del dialog limpia `selectedVisitId`.

Se conserva: `ModuleSurface`, toolbar, CTA “Abrir módulo completo”, error state con
`DashboardRefreshButton`, empty state y `recentVisits` como fuente única (sin cambios de API ni
payload).

## Por qué se eligió `ModuleDialog`

Alinea la superficie de Logística con el patrón ya validado en `ClinicInformesWorkspaceSummary`:
lista compacta fija + detalle en dialog centrado y capado al viewport. Esto elimina el inner-scroll
y el detalle inline sin reintroducir scroll global ni clipping en mobile, y sin necesidad de
`MasterDetailWorkspace` (que no tiene consumidor runtime real). El dialog aporta título/descripción
accesibles y cierre estándar por overlay/escape.

## Validaciones ejecutadas

- `pnpm test` — 2907 pass / 0 fail.
- `pnpm -C frontend typecheck` — OK.
- `pnpm -C frontend lint` — OK.
- `pnpm -C frontend e2e -- e2e/dashboard-clinic-logistica-mobile-parity.spec.ts` — 3 pass
  (360x740, 390x844, 430x932).
- `pnpm -C frontend e2e:public-clinic` — 116 pass.
- `pnpm -C frontend build` — OK.

Nota: `pnpm test` fallaba inicialmente por `frontend/next-env.d.ts` regenerado a path de dev por
una corrida previa de e2e; se restauró con `git checkout -- frontend/next-env.d.ts` antes de
validar. El build de producción vuelve a dejar el path de producción.

## Confirmaciones de invariantes

- No se tocó backend, API, auth, DB, CI, deps, lockfiles ni snapshots.
- No se tocó `globals.css` ni `MasterDetailWorkspace.tsx`.
- No se tocaron rutas full-page de informes/logística.
- El ZIP/carpeta de skills no fue copiado, descomprimido, editado ni agregado al repo; sólo se
  observaron nombres y descripciones para elegir el modo de trabajo.
