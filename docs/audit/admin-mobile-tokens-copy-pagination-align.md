# Fix quirúrgico — Mobile Tokens: paginador centrado + copy del modal "Generar token"

## Rama y base

- Rama: `fix/admin-mobile-tokens-copy-pagination-align`
- HEAD base: `b0a985d fix(admin): anchor mobile tokens pagination (#1078)`
- Working tree base: limpio (verificado antes de crear rama)

## Problema observado

En el módulo mobile **Tokens** del dashboard Administrador:

1. El footer del paginador mostraba un rango lateral izquierdo (`1–6`, `1–10`, etc.) que el bloque pidió eliminar, dejando `Anterior / Pág. X / Siguiente` centrados.
2. El modal "Generar token particular":
   - Tenía un campo **"ID informe vinculado"** (input numérico libre, opcional) que no correspondía a la búsqueda/selección de clínica.
   - El copy `Generar token particular` desbordaba el margen lateral en mobile (título del modal y CTA final).
   - La botonera del paso final (`Limpiar / Anterior / Generar token particular`) podía exceder el ancho útil del modal en viewports angostos (360–430px).

## Scope

- Único componente tocado: [`AdminParticularTokensCard.tsx`](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx) (módulo Tokens del dashboard Administrador) y sus specs/guardrails asociados.
- Cambios estrictamente de copy, estructura de paginador mobile y layout del footer del modal de creación.

## No alcance (no tocado)

Backend, API, DB, auth, lógica de negocio ajena, contratos de tokens fuera del modal afectado, módulo **Clínica** (`ClinicParticularTokensCard.tsx` y su suite de tests quedaron intactos), dependencias, lockfiles, CI, Hub, Auditoría, Clínicas, Sesiones, Mantenimiento, desktop (salvo el ajuste mínimo de grilla descrito abajo), otros módulos admin, rutas públicas, producción.

## Archivos modificados

| Archivo | Motivo |
|---|---|
| [`frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx) | Implementación: paginador centrado, copy del modal, campo "Clínica vinculada", footer sin overflow |
| [`frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts`](../../frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts) | TDD: reforzar/agregar tests que cubren los 4 requisitos del bloque |
| [`test/frontend-admin-particular-tokens.test.ts`](../../test/frontend-admin-particular-tokens.test.ts) | Guardrail: quitar `admin-token-report-id` de la lista de inputs sensibles (el input ya no existe) |
| [`test/progress-production-invariants.test.ts`](../../test/progress-production-invariants.test.ts) | Guardrail: idem, quitar la misma referencia obsoleta en el set de invariantes |

## Implementación aplicada

### A) Paginador Tokens mobile
- Se eliminó el `<span>{mobileRangeStart}–{mobileRangeEnd}</span>` y las variables derivadas `mobileRangeStart`/`mobileRangeEnd` (quedaron sin uso).
- El contenedor del footer del paginador pasó de `justify-between` a `justify-center`, alojando directamente `Anterior`, `Pág. X` y `Siguiente` (se removió el `<div>` interno que ya no hace falta).
- Se preservó `data-admin-mobile-core-pager="true"`, el anclaje inferior (`border-t`, `pt-1.5`, `shrink-0`) y no se tocó ningún `overflow`.
- El paginador **desktop** (`rangeStart`/`rangeEnd`, sección `hidden md:flex`) no fue modificado — es un bloque separado, no comparte JSX con el mobile.

### B) Modal "Generar token" — copy y campo
- `title="Generar token particular"` → `title="Generar token"` (ModuleDialog).
- CTA final: `"Generar token particular"` → `"Generar token"`.
- Label `"Clínica"` (paso 1, el input que ya implementaba búsqueda/selección de clínicas registradas vía `getAdminUsersRoles` + listbox filtrable) → `"Clínica vinculada"`. Se reutilizó el mecanismo existente, sin crear un campo nuevo.
- Se eliminó el bloque `"ID informe vinculado"` (input numérico libre `reportId`, opcional, sin uso real en el flujo de alta — el vínculo informe↔token particular se gestiona desde `AdminReportsUploadPanel.tsx`, no desde este modal). El campo `Email del particular` pasó a ocupar el ancho completo de la grilla (`md:col-span-2`) para no dejar una celda vacía en desktop.
- `formState.reportId`, `parseOptionalReportId` y el envío de `reportId: null` en el payload **se mantienen intactos** en el código (no se tocó el contrato `AdminParticularTokenCreatePayload` de `api.ts`); solo se quitó el control visible. El campo simplemente nunca se completa desde la UI ahora.

### C) Modal "Generar token" — footer/botonera
- Contenedor del footer: se agregó `flex-wrap` (antes solo `flex ... justify-between`) como red de seguridad de layout.
- Grupo derecho (`Anterior` + CTA): se agregó `flex-wrap` y `justify-end`.
- Combinado con el copy corto (`Generar token` en vez de `Generar token particular`), se validó por medición real (`boundingBox()` en Playwright) que ningún botón excede el viewport en 360/390/430px, y que la altura de touch target permanece en 36px (`size="sm"` → `h-9`).

## Tests agregados/reforzados (TDD)

Todos en [`admin-tokens-mobile-toolbar-layout.spec.ts`](../../frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts):

1. **`assertPagerHasNoRangeText`** (nuevo helper): falla si aparece cualquier texto con forma `N–M`/`N-M` dentro del paginador mobile. Aplicado a los casos de página completa (10 tokens) y dataset corto (6 tokens) — antes el test de dataset corto exigía que `"1–6"` **sí** fuera visible; ahora exige lo contrario.
2. **`assertPagerControlsCentered`** (nuevo helper): mide `boundingBox()` de `Anterior`/`Siguiente` contra el contenedor del paginador y exige que el margen izquierdo y derecho sean iguales (tolerancia 6px) — verifica centrado real, no una clase CSS.
3. **Nuevo test `admin tokens create dialog uses linked-clinic search and short copy`** (uno por viewport mobile):
   - Abre el modal, confirma que `"Generar token particular"` y `"ID informe vinculado"` no existen (`toHaveCount(0)`).
   - Completa la búsqueda de clínica (`"Clínica vinculada"`), selecciona una opción mockeada (`/api/admin/users-roles`) y confirma que el input refleja la clínica elegida.
   - Avanza los 3 pasos (completando los campos obligatorios reales del formulario) y en el paso final mide `Limpiar`/`Anterior`/`Generar token`: ningún botón se recorta a izquierda/derecha del viewport, altura ≥36px, y no hay overflow horizontal de página.

Se confirmó la fase roja: los 9 tests nuevos/reforzados fallaron contra el código pre-fix exactamente en los puntos esperados (rango visible, copy largo presente) antes de implementar.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend exec playwright test frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts` | ✅ 12/12 |
| `pnpm --dir frontend exec playwright test frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` | ✅ 13/13 |
| `pnpm --dir frontend exec playwright test` (specs de regresión #1074/#1076: `admin-mobile-hub-stale-layer-stage`, `admin-mobile-app-shell-absolute-no-scroll`, `admin-mobile-config-modules-no-scroll`, `admin-mobile-status-modules-no-scroll`, `admin-mobile-hub-launcher-no-scroll`) | ✅ 60/60 |
| `pnpm test` (raíz) | ✅ 2815/2815 |
| `pnpm --dir frontend lint` | ✅ sin hallazgos |
| `pnpm --dir frontend typecheck` | ✅ sin errores |
| `pnpm --dir frontend build` | ✅ build de producción exitoso |
| `pnpm build` (raíz, backend) | ✅ bundle generado |

Nota operativa: cada corrida de `next dev` (Playwright) o `next build` reescribe `frontend/next-env.d.ts` (archivo autogenerado, comentario "should not be edited"). Se restauró a su estado committeado (`git checkout -- frontend/next-env.d.ts`) después de cada corrida para no ensuciar el diff final — comportamiento ya documentado como guardrail conocido del repo.

## Confirmaciones explícitas

- ✅ Rango izquierdo del paginador (`1–6`/`1–10`/equivalente) eliminado del footer mobile de Tokens.
- ✅ `Anterior / Pág. X / Siguiente` quedan centrados horizontalmente (verificado por medición de bounding box, no solo por clase CSS).
- ✅ El footer del paginador sigue anclado al borde inferior interno del módulo (test `assertPagerAnchoredToModuleBottom` sigue pasando).
- ✅ `ID informe vinculado` → ya no existe en el modal; existe `Clínica vinculada`.
- ✅ El campo `Clínica vinculada` busca/selecciona una clínica registrada (reutiliza el mecanismo de búsqueda ya existente — no es input libre de "informe").
- ✅ `Generar token particular` → `Generar token` en título del modal y CTA final.
- ✅ Botonera final del modal (`Limpiar`/`Anterior`/`Generar token`) entra dentro del ancho útil en 360/390/430px, sin desbordar el margen lateral, con touch targets ≥36px.
- ✅ Sin scroll global ni interno introducido.
- ✅ Sin `overflow:auto`/`overflow:scroll` agregado (verificado con `git diff | Select-String`).
- ✅ #1074 (anti-ghosting / stale layer stage) y #1076 (tokens fluidos mobile) preservados — specs de regresión asociadas pasan 60/60.
- ✅ No se tocó backend, API, DB, auth, Clínica (`ClinicParticularTokensCard.tsx` y su spec quedaron intactos), dependencias, lockfiles, CI, Hub, Auditoría, Clínicas, Sesiones, Mantenimiento, desktop (salvo el `md:col-span-2` cosmético del campo Email tras retirar el campo vecino), otros módulos admin.

## Riesgo residual

- El campo "ID informe vinculado" permitía, opcionalmente, vincular un informe ya existente al token particular en el momento de la creación. Esa capacidad de UI desaparece (el contrato de API sigue soportando `reportId: null | number`, no se tocó); el vínculo informe↔token sigue disponible por la vía ya existente y más usada: `AdminReportsUploadPanel.tsx` (selección de token particular al subir el informe). Si algún flujo operativo dependía de fijar el `reportId` *en el momento del alta* del token, ese atajo ya no está disponible desde este modal.
- El `flex-wrap` agregado al footer del modal es una red de seguridad de layout; en los anchos probados (360/390/430px) el contenido entra en una sola línea, pero si en el futuro se alarga el texto de algún botón del footer, podría pasar a dos líneas en vez de desbordar (comportamiento intencional y validado, no un bug).

## Comandos manuales para Nico (no ejecutados por Claude)

```powershell
git status --short --untracked-files=all
git add frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx test/frontend-admin-particular-tokens.test.ts test/progress-production-invariants.test.ts docs/audit/admin-mobile-tokens-copy-pagination-align.md
git status --short --untracked-files=all
git commit -m "fix(admin): align mobile tokens pagination and modal copy"
git push -u origin fix/admin-mobile-tokens-copy-pagination-align
gh pr create --title "fix(admin): align mobile tokens pagination and modal copy" --body "..."
gh pr checks --watch
```
