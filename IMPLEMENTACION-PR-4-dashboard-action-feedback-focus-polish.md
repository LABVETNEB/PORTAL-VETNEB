# PR-4 — Dashboard Action Feedback & Focus Polish

## 1. Resumen ejecutivo

Polish visual de feedback de acciones en el dashboard: estado activo (press scale) en todos los
botones, spinner de carga con `aria-busy` en 7 tarjetas admin, cursor-wait CSS para loading,
y focus-visible en botones de fila de opciones de clínica. Sin cambios de lógica ni contratos.

## 2. Scope aplicado

- Añadir `active:scale-[0.98]` + `transform` a la transición base de `Button`.
- Añadir sección CSS `dashboard-action-feedback-focus-polish` en `globals.css`.
- Añadir `aria-busy` + `Loader2` spinner a los botones de carga en 7 tarjetas admin:
  `AdminClinicsManagementCard`, `AdminFailedLoginAlertsReadOnlyCard`,
  `AdminSessionsReadOnlyCard` (Actualizar + Revocar),
  `AdminSchemaHealthStatusCard`, `AdminUsersRolesReadOnlyCard`,
  `AdminMaintenanceDryRunCard`, `AdminPricingEditorCard`.
- Añadir clase `dashboard-option-row` a botones de opción de clínica en
  `AdminParticularTokensCard` y `UploadReportModal`.
- Nuevo test de contrato `frontend-dashboard-action-feedback-focus-polish.test.ts`.
- Actualizar test `frontend-admin-maintenance-dry-run-card.test.ts` para reflejar nueva firma.

## 3. No-alcance respetado

- Sin cambios de lógica, handlers, contratos API ni rutas.
- Sin auth, middleware, DB, migrations, producción ni staging.
- Sin nuevas dependencias.
- Sin rediseño de layout ni navegación global.
- Sin cambios de copy masivo.
- Sin ocultar acciones existentes.
- Sin tocar `package.json`, `tsconfig.json`, `next-env.d.ts`, `layout.tsx` ni `page.tsx`.
- Sin tocar superficies públicas ni módulos no relacionados al dashboard.

## 4. Archivos modificados

| Archivo | Tipo |
|---|---|
| `frontend/src/components/ui/button.tsx` | Modificado |
| `frontend/src/app/globals.css` | Modificado |
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | Modificado |
| `frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | Modificado |
| `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | Modificado |
| `frontend/src/app/dashboard/admin/AdminSchemaHealthStatusCard.tsx` | Modificado |
| `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | Modificado |
| `frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx` | Modificado |
| `frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx` | Modificado |
| `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` | Modificado |
| `frontend/src/components/dashboard/UploadReportModal.tsx` | Modificado |
| `test/frontend-admin-maintenance-dry-run-card.test.ts` | Modificado (contrato actualizado) |
| `test/frontend-dashboard-action-feedback-focus-polish.test.ts` | Nuevo |

## 5. Cambios implementados

### `button.tsx`
- `transition-[...,transform]`: se agrega `transform` a la lista de propiedades animadas.
- `active:scale-[0.98]`: feedback de press para todos los usos de `<Button>`.

### `globals.css` — sección nueva `dashboard-action-feedback-focus-polish`
- `button[aria-busy="true"]` → `cursor: wait` (diferencia estado cargando de disponible).
- `button[aria-busy="true"]:disabled` → `opacity: 0.72` (distingue loading de disabled puro).
- `.dashboard-option-row` → `focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-55`.

### Tarjetas admin (7 archivos)
- Import `Loader2` de `lucide-react`.
- `aria-busy={isPending ? true : undefined}` (o `isRevoking`, `isLoading` según corresponda).
- `{isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}` antes del texto.
- Textos de carga preservados íntegros para no romper tests existentes.

### `AdminParticularTokensCard.tsx` y `UploadReportModal.tsx`
- Clase `dashboard-option-row` agregada a los botones `role="option"` del selector de clínica.

### `frontend-admin-maintenance-dry-run-card.test.ts`
- Actualizada la aserción de firma del botón "Analizar limpieza" para incluir `aria-busy`.

## 6. Acciones/estados cubiertos

| Estado | Antes | Después |
|---|---|---|
| Hover | Solo color/border | + border/bg animados |
| Active (press) | Sin feedback | `scale(0.98)` en todo `<Button>` |
| Cargando (loading) | Solo texto, mismo aspecto que disabled | Spinner `Loader2` + `aria-busy="true"` + `opacity: 0.72` + `cursor: wait` |
| Disabled puro | `opacity: 0.55` + `pointer-events-none` | Sin cambio (comportamiento correcto) |
| Option row focus | Sin ring | `focus-visible:ring-2` |
| Option row disabled | Sin visual | `opacity-55 + pointer-events-none` |

## 7. Accesibilidad focus-visible

- `button.tsx`: ya tenía `focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2` — se preserva.
- Botones option-row (`role="option"`): se agrega `focus-visible:ring-2 focus-visible:ring-ring/85` via `.dashboard-option-row`.
- `aria-busy="true"`: screen readers anuncian estado de procesamiento activo.
- `aria-hidden="true"` en todos los `<Loader2>`: no contamina flujo de lectura.

## 8. Responsive: desktop / tablet / móvil

- `active:scale-[0.98]` aplica globalmente (CSS transform, sin breakpoints necesarios).
- `.dashboard-option-row` aplica globalmente.
- `button[aria-busy="true"]` aplica globalmente.
- No se modificó layout ni clases de breakpoint existentes.

## 9. Tests agregados o reforzados

### Nuevo: `test/frontend-dashboard-action-feedback-focus-polish.test.ts`
- 16 tests que verifican:
  - `button.tsx` tiene `active:scale-[0.98]` y `transform` en transición.
  - `globals.css` tiene delimitadores, `cursor: wait`, `.dashboard-option-row`.
  - 7 tarjetas admin tienen `aria-busy` y `Loader2` import.
  - Botón "Revocar" en sessions tiene `aria-busy={isRevoking ? true : undefined}`.
  - Option-row buttons usan `dashboard-option-row` en ambas tarjetas.
  - Spinners tienen `aria-hidden="true"`.
  - Handlers reales de API se mantienen conectados.
  - Scope guard (sin archivos bloqueados modificados).

### Actualizado: `test/frontend-admin-maintenance-dry-run-card.test.ts`
- Firma del botón "Analizar limpieza" actualizada para incluir `aria-busy`.

## 10. Comandos ejecutados

```powershell
# Terminal 1
pnpm --dir frontend lint        # Sin errores
pnpm --dir frontend typecheck   # Sin errores
pnpm --dir frontend build       # Build exitoso
pnpm validate:local             # 2551 tests, 0 fallos
```

## 11. Resultado de validación

```
ℹ tests 2551
ℹ pass  2551
ℹ fail  0
```

Build Next.js: exitoso (todas las rutas estáticas y dinámicas compiladas).
Backend build: exitoso (dist/index.js 859.8kb).

## 12. Riesgos residuales

- `active:scale-[0.98]` aplica a TODO `<Button>` incluyendo los de la parte pública. Es
  visual-only y reversible. No afecta lógica.
- `opacity: 0.72` para `aria-busy + disabled` usa especificidad de atributo. Si Tailwind actualiza
  su generación de `disabled:opacity-55`, el override podría necesitar revisión. Riesgo bajo.
- `dashboard-option-row` está definido via `@apply` en `globals.css`. Si la clase se usa fuera del
  contexto de un listbox, el `focus-visible:ring-offset-1` podría verse diferente al estándar
  `ring-offset-2`. Riesgo bajo (uso acotado).

## 13. Estado final de git

```
 M frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx
 M frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx
 M frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx
 M frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx
 M frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx
 M frontend/src/app/dashboard/admin/AdminSchemaHealthStatusCard.tsx
 M frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx
 M frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx
 M frontend/src/app/globals.css
 M frontend/src/components/dashboard/UploadReportModal.tsx
 M frontend/src/components/ui/button.tsx
 M test/frontend-admin-maintenance-dry-run-card.test.ts
?? test/frontend-dashboard-action-feedback-focus-polish.test.ts
```

12 archivos modificados, 1 nuevo. Sin stage, sin commit, sin push.

---

## Instrucciones manuales para Nico

```powershell
# Terminal 1 — desde C:\PORTAL-VETNEB

# 1. Revisar el diff
git diff --stat
git diff

# 2. Stagear
git add frontend/src/components/ui/button.tsx
git add frontend/src/app/globals.css
git add frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx
git add frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx
git add frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx
git add frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx
git add frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx
git add frontend/src/app/dashboard/admin/AdminSchemaHealthStatusCard.tsx
git add frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx
git add frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx
git add frontend/src/components/dashboard/UploadReportModal.tsx
git add test/frontend-admin-maintenance-dry-run-card.test.ts
git add test/frontend-dashboard-action-feedback-focus-polish.test.ts

# 3. Verificar
git status

# 4. Commit
git commit -m "feat(dashboard): polish action feedback and focus states"

# 5. Push
git push -u origin feat/dashboard-action-feedback-focus-polish

# 6. Crear PR
gh pr create --title "feat(dashboard): polish action feedback and focus states" --body "Polish visual de feedback de acciones en el dashboard admin.

## Cambios
- active:scale-[0.98] en todos los Button (press feedback)
- aria-busy + Loader2 spinner en 7 tarjetas admin (loading vs disabled visible)
- cursor: wait CSS para botones con aria-busy
- dashboard-option-row focus-visible para botones de listbox de clínica
- opacity: 0.72 para loading (vs 0.55 disabled puro)

## No-alcance
Sin cambios de lógica, auth, DB, API contracts, layout ni dependencias nuevas.

## Tests
2551 tests, 0 fallos. Nuevo test de contrato PR-4 (16 casos)."

# 7. Monitorear
gh pr checks --watch

# 8. Merge (cuando CI pase)
gh pr merge --squash --delete-branch

# 9. Limpieza local
git checkout main
git pull
git branch -d feat/dashboard-action-feedback-focus-polish
```
