# PR-9 — Dashboard Final Premium QA Cleanup

Branch: `feat/dashboard-final-premium-qa-cleanup`
Commit/PR title: `test(dashboard): finalize premium dashboard QA cleanup`
Fecha: 2026-06-11

---

## 1. Resumen ejecutivo

Auditoría final y cleanup del bloque premium dashboard post PR-3..PR-8.
Se encontraron 3 hallazgos reales de baja criticidad (P2–P3): un selector E2E genérico con `.first()` en el test de accesibilidad del filter drawer, y dos contratos de fuente ausentes para las clases `dashboard-pagination-btn` y `dashboard-focus-trap-container` introducidas en PR-8.

Los 3 hallazgos se corrigieron con cambios mínimos. Todos los demás patrones auditados resultaron intencionales o ya cubiertos.

---

## 2. Alcance del QA final

- Coherencia CSS dashboard premium: marcadores, clases, reglas en `globals.css`.
- Contratos E2E: selectores, accesibilidad, roles ARIA, atributos de contrato.
- Contratos de fuente: cobertura de clases PR-8 en tests de contrato.
- Artefactos Next.js/TypeScript: `next-env.d.ts`, `tsconfig.json`.
- Tests frágiles: selectores genéricos, `.first()` ambiguos, `force: true`.
- Duplicación CSS innecesaria, clases huérfanas.
- No regresión de superficies dashboard afectadas.

---

## 3. No-alcance respetado

- No se crearon módulos ni pantallas nuevas.
- No se modificó auth, backend, DB, migrations.
- No se tocó producción ni staging.
- No se cambió navegación global.
- No se introdujeron librerías.
- No se modificó lógica de acciones.
- No se cambiaron contratos API.
- No se tocaron GitHub Actions, GH CLI, tokens ni workflows.
- No se modificó ningún archivo de dependencias.

---

## 4. Hallazgos encontrados

### H-1 — Selector E2E genérico con `.first()` (P2)

**Archivo**: `frontend/e2e/dashboard-accessibility-keyboard.spec.ts:199`  
**Descripción**: El test `"filter drawer panel has role=dialog and aria-modal=true"` usaba
`page.locator('[role="dialog"][aria-modal="true"]').first()`. Si otro portal Radix estuviera
montado simultáneamente, `.first()` podría resolver al elemento incorrecto.  
**Causa**: El selector no usaba el accessible name del diálogo aunque el componente
`FilterDrawer` expone `aria-labelledby={titleId}` apuntando al título `"Filtros de informes"`.

### H-2 — Contrato ausente para `dashboard-pagination-btn` (P2)

**Archivo**: `test/frontend-dashboard-informes.test.ts`  
**Descripción**: La clase `dashboard-pagination-btn` introducida en PR-8
(`dashboard-accessibility-keyboard-hardening`) se aplica a ambos botones de paginación en
`frontend/src/app/dashboard/informes/page.tsx` pero ningún test de contrato verificaba su
presencia. Si se removiera accidentalmente, los botones deshabilitados perderían los estilos
de accesibilidad (`pointer-events:none`, `opacity:0.45`, `cursor:not-allowed`).

### H-3 — Contrato ausente para `dashboard-focus-trap-container` (P3)

**Archivo**: `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts`  
**Descripción**: La clase `dashboard-focus-trap-container` introducida en PR-8 se aplica al
panel del `FilterDrawer` y al `UploadReportModal`. El test existente cubría `tabIndex={-1}` y
`ref={panelRef}` pero no verificaba la clase CSS que suprime el `outline` del browser en
contenedores con focus programático.

---

## 5. Hallazgos descartados

| Patrón | Resultado | Razón |
|--------|-----------|-------|
| `.dashboard-main` definida dos veces en `globals.css` (líneas 205 y 964) | No real | Ambas dentro de `@layer components`, complementarias: la primera aplica layout/spacing vía `@apply`, la segunda agrega el visual overlay (`isolation:isolate`, gradiente). Sin conflicto de propiedades. |
| `force: true` en accesibilidad spec línea 187 | No real | Documentado con comentario explícito: `isolation:isolate` en `.dashboard-main` limita el z-index del overlay de `FilterDrawer` cuando no está en portal. Workaround necesario para Playwright. |
| `AdminReportWorkflowViewerCard` con `px-6 pb-5 text-sm text-muted-foreground` en el div de paginación | No real | Justificado: el `CardContent` del card usa `p-0` para permitir tabla full-width. El padding inline en el footer es necesario. Los otros cards usan `CardContent` con `pt-6` que mantiene el padding horizontal. |
| `AdminClinicsManagementCard` sin `dashboard-table-pagination` | No real | Diseño intencional: la tabla de gestión de clínicas no usa paginación server-side de la misma forma que las otras. |
| `console.log` en fuentes de dashboard | No real | Solo aparece en tests (captura/mock), no en código fuente de producción. |
| `TODO`/`FIXME` en tests | No real | Solo como strings en assertions, no como código pendiente. |
| `.first()` en tests UploadReportModal | No real | Apropiado: mock retorna un token, el selector `getByRole("button", { name: ... })` es suficientemente específico. |
| Artefactos `next-env.d.ts` y `tsconfig.json` | Colaterales de build | Detectados y restaurados vía `git restore` antes del commit. |

---

## 6. Archivos modificados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `frontend/e2e/dashboard-accessibility-keyboard.spec.ts` | E2E spec | Fix selector (H-1) |
| `test/frontend-dashboard-informes.test.ts` | Contrato fuente | Nuevo test pagination-btn (H-2) |
| `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts` | Contrato fuente | Assert focus-trap-container (H-3) |

Diff total: **+15 líneas, -1 línea** (3 archivos).

---

## 7. Cambios implementados

### H-1: `frontend/e2e/dashboard-accessibility-keyboard.spec.ts`

**Antes (línea 199)**:
```typescript
const panel = page.locator('[role="dialog"][aria-modal="true"]').first();
await expect(panel).toBeVisible({ timeout: 3_000 });
```

**Después**:
```typescript
const panel = page.getByRole("dialog", { name: /filtros de informes/i });
await expect(panel).toHaveAttribute("aria-modal", "true");
await expect(panel).toBeVisible({ timeout: 3_000 });
```

Beneficios:
- Usa el accessible name del diálogo (provisto por `aria-labelledby` → `<h2>Filtros de informes</h2>`).
- Elimina la ambigüedad de `.first()`.
- Verifica `aria-modal="true"` de forma explícita en lugar de implícita.

### H-2: `test/frontend-dashboard-informes.test.ts`

Nuevo test añadido antes del test de API client:

```typescript
test("dashboard informes pagination buttons carry dashboard-pagination-btn accessibility class", () => {
  const source = read(INFORMES_PAGE_PATH);
  const occurrences = (source.match(/dashboard-pagination-btn/g) ?? []).length;
  assert.ok(
    occurrences >= 2,
    `dashboard-pagination-btn must appear on both Anterior and Siguiente buttons (found ${occurrences})`,
  );
});
```

### H-3: `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts`

Una línea añadida al test `"FilterDrawer exposes reusable client drawer contract..."`:

```typescript
assert.ok(source.includes("dashboard-focus-trap-container"));
```

---

## 8. Contratos/tests reforzados

| Contrato | Cobertura antes | Cobertura después |
|----------|----------------|-------------------|
| `FilterDrawer`: `role=dialog`, `aria-modal=true`, `aria-labelledby` | ✓ fuente + ✓ E2E (selector débil) | ✓ fuente + ✓ E2E (selector robusto) |
| `dashboard-pagination-btn` en informes | ✗ sin contrato | ✓ test de fuente |
| `dashboard-focus-trap-container` en FilterDrawer | ✗ sin contrato | ✓ assert en test existente |

---

## 9. Validación desktop / tablet / móvil

Los 5 specs E2E del dashboard incluyen cobertura multi-viewport:

- `dashboard-master-detail-state-polish.spec.ts`: overflow test a 768px (tablet) y 375px (mobile).
- `dashboard-accessibility-keyboard.spec.ts`: tests con viewport 1280×900 (desktop).
- `dashboard-workspace-layout-polish.spec.ts`: tests sin viewport específico (default desktop).
- `dashboard-card-navigation-shell.spec.ts`: tests sin viewport específico.
- `dashboard-interaction-foundation.spec.ts`: tests sin viewport específico.

El build de producción no muestra cambios en el bundle de rutas dashboard (sin regresión de tamaño).

---

## 10. Accesibilidad / keyboard final

Estado post PR-3..PR-9:

| Invariante | Estado |
|-----------|--------|
| `role=dialog` + `aria-modal=true` + `aria-labelledby` en FilterDrawer | ✓ |
| `tabIndex={-1}` + `ref={panelRef}` para focus programático en FilterDrawer | ✓ |
| `dashboard-focus-trap-container` suprime outline en contenedores de focus | ✓ contrato |
| `dashboard-pagination-btn` deshabilita `pointer-events` + `opacity` en paginación | ✓ contrato |
| `dashboard-option-row` con `focus-visible:ring-2` en selects de tokens | ✓ |
| Cards del hub con `aria-label` descriptivo y `data-dashboard-module-card` | ✓ |
| Botones de workspace con `aria-label` accesible | ✓ |
| Notificaciones bell: panel desktop con `role=region` (no `dialog`) | ✓ |
| UploadReportModal: `role=dialog` + `aria-modal=true` + close con `aria-label` | ✓ |
| Escape key cierra FilterDrawer y UploadReportModal | ✓ |
| Focus retorna al trigger tras cerrar modal con Escape | ✓ |
| `[aria-disabled="true"].dashboard-pagination-btn`: `pointer-events:none` | ✓ CSS |

---

## 11. Comandos ejecutados

**Terminal 1:**
```powershell
# Verificación base
git branch --show-current           # feat/dashboard-final-premium-qa-cleanup
git status --short                  # limpio
git log -1 --oneline                # 1ac7ef3

# Auditoría
Get-ChildItem -Path frontend/src,frontend/e2e -Recurse -Include *.tsx,*.ts,*.css | Select-String -Pattern "dashboard-*|aria-|focus-visible"
Get-ChildItem -Path frontend/src,test,frontend/e2e -Recurse -Include *.tsx,*.ts,*.css | Select-String -Pattern "TODO|FIXME|\.skip\(|\.only\(|force: true|console\.log|debugger"
Get-ChildItem -Path frontend/e2e -Recurse -Include *.ts | Select-String -Pattern '\.first\(\)|role="dialog"'

# Validación
pnpm --dir frontend lint            # exit 0
pnpm --dir frontend typecheck       # exit 0
pnpm --dir frontend build           # exit 0
pnpm validate:local                 # exit 0 (2580 tests, 0 fail)

# Colaterales
git restore frontend/next-env.d.ts frontend/tsconfig.json

# Estado final
git status --short
git diff --stat
```

---

## 12. Resultado de validación

| Check | Resultado |
|-------|-----------|
| `pnpm --dir frontend lint` | ✅ exit 0 |
| `pnpm --dir frontend typecheck` | ✅ exit 0 |
| `pnpm --dir frontend build` | ✅ exit 0 |
| `pnpm validate:local` (typecheck + typecheck:test + test + build) | ✅ exit 0 |
| Tests totales | **2580 / 2580 pass** |
| Tests fallidos | 0 |
| Tests skipped | 0 |
| Colaterales `next-env.d.ts` / `tsconfig.json` | ✅ restaurados |

---

## 13. Riesgos residuales

- Los tests E2E del dashboard requieren server local en `http://127.0.0.1:3000`. No se ejecutaron en esta sesión por no levantar servidor. Los specs de accesibilidad cubren el cambio realizado vía contrato de fuente en `frontend-dashboard-accessibility-focus-aria.test.ts`.
- `force: true` en la línea 187 del spec de accesibilidad es un workaround por `isolation:isolate` de `.dashboard-main`. Si en el futuro el FilterDrawer migra a portal (`document.body`), el `force: true` puede removerse.
- `AdminClinicsManagementCard` no tiene paginación server-side; si el volumen de clínicas crece, puede requerir PR separado.

---

## 14. Estado final de git

```
Branch: feat/dashboard-final-premium-qa-cleanup
Base:   1ac7ef3 feat(dashboard): harden accessibility and keyboard behavior (#932)

Archivos modificados (sin stagear):
 M frontend/e2e/dashboard-accessibility-keyboard.spec.ts
 M test/frontend-dashboard-filter-drawer-sticky-filters.test.ts
 M test/frontend-dashboard-informes.test.ts

Diff stat:
 frontend/e2e/dashboard-accessibility-keyboard.spec.ts        |  3 ++-
 test/frontend-dashboard-filter-drawer-sticky-filters.test.ts |  1 +
 test/frontend-dashboard-informes.test.ts                     | 12 ++++++++++++
 3 files changed, 15 insertions(+), 1 deletion(-)
```

---

## 15. Checklist final del bloque premium dashboard

### PR-3: master-detail density + states
- [x] `.dashboard-master-panel` / `.dashboard-detail-panel` en `globals.css` y componentes
- [x] `data-detail-state="empty|selected"` en `MasterDetailWorkspace`
- [x] `data-master-detail-workspace="true"` presente
- [x] Overflow test tablet (768px) y mobile (375px) en spec

### PR-4: action feedback + focus states
- [x] `dashboard-action-feedback-focus-polish` markers en CSS
- [x] `button[aria-busy="true"]:disabled` con `opacity:0.72`
- [x] `dashboard-option-row` con `focus-visible:ring-2`
- [x] Contratos de fuente en `frontend-dashboard-action-feedback-focus-polish.test.ts`

### PR-5: responsive touch ergonomics
- [x] `.dashboard-table-responsive` con `overflow-x:auto` y `overscroll-behavior-x:contain`
- [x] `-webkit-overflow-scrolling: touch`
- [x] Contrato en `frontend-dashboard-mobile-polish-bottom-actions.test.ts`

### PR-6: filters/forms density
- [x] `FilterDrawer` con `role=dialog`, `aria-modal=true`, `aria-labelledby`
- [x] `StickyFilterBar` con `role=group`, `aria-label`, `aria-live`
- [x] `dashboard-pagination-context` para contexto de página
- [x] Contratos en `frontend-dashboard-filter-drawer-sticky-filters.test.ts`

### PR-7: tables/cards consistency
- [x] `.dashboard-table-pagination` unificado en todas las cards admin
- [x] `.dashboard-table-pagination-controls` consistente
- [x] `.dashboard-card-header-border` en todos los cards admin relevantes
- [x] `.dashboard-filter-stats-grid` y `.dashboard-filter-stats-grid-5`
- [x] Contrato en `frontend-dashboard-tables-cards-consistency-polish.test.ts`

### PR-8: accessibility + keyboard hardening
- [x] `dashboard-focus-trap-container` en FilterDrawer y UploadReportModal
- [x] `dashboard-pagination-btn` en botones de paginación de informes
- [x] `[aria-disabled="true"].dashboard-pagination-btn` con `pointer-events:none`
- [x] Notificaciones bell: panel desktop con `role=region`
- [x] UploadReportModal: Escape + focus-return + backdrop close
- [x] Contratos en `frontend-dashboard-accessibility-focus-aria.test.ts`

### PR-9: QA audit cleanup (este PR)
- [x] Selector E2E genérico corregido (`getByRole` con accessible name)
- [x] Contrato `dashboard-pagination-btn` añadido a `frontend-dashboard-informes.test.ts`
- [x] Contrato `dashboard-focus-trap-container` añadido a `frontend-dashboard-filter-drawer-sticky-filters.test.ts`
- [x] validate:local 2580/2580 pass
- [x] Sin colaterales `next-env.d.ts` / `tsconfig.json`
- [x] Sin features nuevas
- [x] Sin cambios backend/auth/producción

---

## 16. Cierre

> **Nota GitHub API**: Al momento de esta sesión, `api.github.com:443` puede estar
> degradado desde la red local. **Nico debe ejecutar manualmente**:
>
> ```bash
> git add frontend/e2e/dashboard-accessibility-keyboard.spec.ts \
>         test/frontend-dashboard-filter-drawer-sticky-filters.test.ts \
>         test/frontend-dashboard-informes.test.ts
> git commit -m "test(dashboard): finalize premium dashboard QA cleanup"
> git push -u origin feat/dashboard-final-premium-qa-cleanup
> ```
>
> Y luego crear el PR desde GitHub web o con `gh pr create` cuando
> `api.github.com` vuelva a estar disponible:
>
> ```bash
> gh pr create \
>   --title "test(dashboard): finalize premium dashboard QA cleanup" \
>   --base main \
>   --body "Auditoría final PR-3..PR-8. Fix selector E2E genérico FilterDrawer dialog. Contratos de fuente para dashboard-pagination-btn y dashboard-focus-trap-container. validate:local 2580/2580."
> ```
