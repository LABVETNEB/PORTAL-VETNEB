# PR-8 — feat(dashboard): harden accessibility and keyboard behavior

Branch: `feat/dashboard-accessibility-keyboard-hardening`
Date: 2026-06-10

---

## Objetivo

Endurecer accesibilidad y comportamiento por teclado en el dashboard admin/clinic/reportes:

- Auditar y reforzar `focus-visible` en controles interactivos
- Reforzar navegación por teclado en botones, links, listbox/selects, filtros, tablas y paginación
- Asegurar labels, `aria-label`, `aria-describedby`, `aria-live`, estados disabled/loading
- No regresar en cards, tablas, filtros/forms ni master-detail de PRs anteriores
- Mantener ergonomía responsive/touch
- Agregar tests e2e de contrato accesibilidad/teclado

---

## Diagnóstico previo

| Componente | Brecha detectada |
|---|---|
| `FilterDrawer` | Sin focus trap ni retorno de foco al cerrar; Escape no cerraba |
| `UploadReportModal` | Sin focus trap, sin Escape close, sin retorno de foco, sin `aria-describedby`, `useId` faltante, cierre por backdrop ausente |
| `ReportDownloadButton` | Botones de carga sin `aria-busy` |
| `informes/page.tsx` | Botones de fila sin `aria-label` descriptivo; paginación sin clases focusables |
| `DashboardNotificationsBell` | Panel desktop con `role="dialog"` incorrecto (debía ser `role="region"`) |

---

## Archivos modificados

### 1. `frontend/src/components/dashboard/FilterDrawer.tsx`

**Cambios:**
- `FOCUSABLE_SELECTOR` constante para focus trap sin dependencias externas
- `triggerRef` (`useRef<HTMLButtonElement>`) para retornar foco al trigger al cerrar
- `closePanel()` encapsula `setOpen(false)` + `requestAnimationFrame(() => triggerRef.current?.focus())`
- `useEffect([open])`: focus inicial en panel, handler `keydown` con Escape close + Tab/Shift+Tab trap cycling, cleanup `removeEventListener`
- Backdrop `div[aria-hidden]`: añadido `onClick={closePanel}`
- Botón cerrar: `onClick` cambiado de `setOpen(false)` a `closePanel()`
- Trigger `Button`: añadido `ref={triggerRef}`
- Panel `div`: clase `dashboard-focus-trap-container` + `tabIndex={-1}`

### 2. `frontend/src/components/dashboard/UploadReportModal.tsx`

**Cambios:**
- Imports React: `useEffect`, `useId` añadidos al import unificado
- `FOCUSABLE_SELECTOR` para focus trap nativo
- `modalRef` (`useRef<HTMLDivElement>`) para focus inicial en modal
- `triggerButtonRef` (`useRef<HTMLButtonElement>`) para retornar foco al trigger al cerrar
- `isSubmittingRef` (`useRef<boolean>`) para evitar stale closure en handler de teclado; sincronizado vía `useEffect([isSubmitting])`
- `modalDescriptionId` y `clinicListboxId` via `useId()` para IDs únicos sin colisión
- `useEffect([isOpen])`: focus inicial en modal, handler Escape (guarda `isSubmitting` vía ref, restaura foco) + Tab trap, cleanup
- `closeModal()`: añade `requestAnimationFrame(() => triggerButtonRef.current?.focus())`
- Backdrop `div`: `onClick={closeModal}`
- Modal `div`: `ref={modalRef}`, `tabIndex={-1}`, `dashboard-focus-trap-container`, `aria-describedby={modalDescriptionId}`, `onClick={(e) => e.stopPropagation()}`
- Párrafo descripción: `id={modalDescriptionId}`
- Botón cerrar: `aria-label="Cerrar modal de subir informe"`
- Listbox clínicas: `id={clinicListboxId}`
- Input búsqueda clínica: `aria-controls={clinicListboxId}`
- Mensaje éxito: `role="alert"` añadido
- Botón submit: `aria-busy={isSubmitting}`
- Trigger `Button`: `ref={triggerButtonRef}`

### 3. `frontend/src/components/dashboard/ReportDownloadButton.tsx`

**Cambios:**
- Botón Vista previa: `aria-busy={loadingAction === "preview"}`
- Botón Descargar: `aria-busy={loadingAction === "download"}`

### 4. `frontend/src/app/dashboard/informes/page.tsx`

**Cambios:**
- Botones de selección de fila: `aria-label` dinámico según estado seleccionado
  ```tsx
  aria-label={isSelected
    ? `Informe seleccionado: ${getReportTitle(report)}`
    : `Seleccionar informe: ${getReportTitle(report)}`}
  ```
- Botones paginación: clase `dashboard-pagination-btn` + `focus-visible:ring-2 focus-visible:ring-ring/85`
- Span de contexto paginación: clase `dashboard-pagination-context`

### 5. `frontend/src/components/dashboard/DashboardNotificationsBell.tsx`

**Cambios:**
- Panel desktop: `role="dialog"` → `role="region"` (semántica correcta: no es un diálogo modal, es un panel informativo expandido)
- Añadido `aria-label="Panel de notificaciones"` al `role="region"` para nombre accesible independiente

### 6. `frontend/src/app/globals.css`

**Cambios (sección `dashboard-accessibility-keyboard-hardening`):**
```css
/* dashboard-accessibility-keyboard-hardening:start */
@layer components {
  .dashboard-focus-trap-container:focus {
    outline: none;
  }
  [aria-disabled="true"].dashboard-pagination-btn,
  button:disabled.dashboard-pagination-btn {
    pointer-events: none;
    opacity: 0.45;
    cursor: not-allowed;
  }
}
/* dashboard-accessibility-keyboard-hardening:end */
```

### 7. `test/frontend-report-actions.test.ts`

**Cambios:**
- Línea 20: actualizado string de contrato de importación React para reflejar imports expandidos en `UploadReportModal.tsx`:
  - Antes: `'import { FormEvent, useRef, useState } from "react";'`
  - Después: `'import { FormEvent, useEffect, useId, useRef, useState } from "react";'`

---

## Tests e2e añadidos

**Archivo nuevo:** `frontend/e2e/dashboard-accessibility-keyboard.spec.ts`

| Suite | Tests |
|---|---|
| `FilterDrawer — keyboard & a11y (PR-8)` | 6 (aria-haspopup, aria-expanded, open, Escape+focus return, backdrop click, role/aria-modal, close button label) |
| `UploadReportModal — keyboard & a11y (PR-8)` | 6 (trigger visible, opens, aria-modal, Escape+focus return, backdrop click, close button label) |
| `Informes — accessible row actions (PR-8)` | 3 (filter bar region, pagination nav, table thead) |
| `ReportFileActions — aria-busy (PR-8)` | 1 (botón con aria-label de disponibilidad) |
| `DashboardNotificationsBell — desktop panel role (PR-8)` | 1 (role=region, no dialog) |
| `AdminSectionTabs — keyboard navigation (PR-8)` | 4 (tablist, aria-selected, ArrowRight, Home) |

---

## Patrones de accesibilidad implementados

### Focus trap sin dependencias externas

```typescript
const FOCUSABLE_SELECTOR =
  'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// En useEffect:
const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
const first = focusable[0];
const last = focusable[focusable.length - 1];
if (event.shiftKey && document.activeElement === first) {
  event.preventDefault(); last.focus();
} else if (!event.shiftKey && document.activeElement === last) {
  event.preventDefault(); first.focus();
}
```

### Retorno de foco al trigger (post-unmount)

```typescript
window.requestAnimationFrame(() => { triggerRef.current?.focus(); });
```

El `requestAnimationFrame` permite que React desmonte el panel antes de llamar a `focus()`, evitando que el foco quede en el vacío.

### Stale closure para isSubmitting en handler de teclado

```typescript
const isSubmittingRef = useRef(false);
useEffect(() => { isSubmittingRef.current = isSubmitting; }, [isSubmitting]);
// Dentro del handler de keydown (no recibe isSubmitting directamente):
if (e.key === "Escape") {
  if (isSubmittingRef.current) return;
  closeModal();
}
```

---

## Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `pnpm --dir frontend lint` | ✔ sin errores ni warnings |
| `pnpm --dir frontend typecheck` | ✔ sin errores TypeScript |
| `pnpm --dir frontend build` | ✔ build exitoso |
| `pnpm validate:local` (2579 tests) | ✔ pass: 2579, fail: 0 |
| Artifacts tsconfig/next-env | ✔ sin archivos fuera de scope en git diff |

---

## Estado final del repositorio

```
git diff --name-only
frontend/src/app/dashboard/informes/page.tsx
frontend/src/app/globals.css
frontend/src/components/dashboard/DashboardNotificationsBell.tsx
frontend/src/components/dashboard/FilterDrawer.tsx
frontend/src/components/dashboard/ReportDownloadButton.tsx
frontend/src/components/dashboard/UploadReportModal.tsx
test/frontend-report-actions.test.ts

Archivos nuevos (untracked):
frontend/e2e/dashboard-accessibility-keyboard.spec.ts
IMPLEMENTACION-PR-8-dashboard-accessibility-keyboard-hardening.md
```

---

## No-alcance explícito

- No se modificaron rutas API ni backend de negocio
- No se instalaron dependencias nuevas (focus trap nativo)
- No se tocaron migrations ni DB
- No se modificaron GitHub Actions, CI workflows ni configuración de autenticación
- No se tocó código de producción fuera del dashboard
- AdminSectionTabs: el tablist existente ya implementa `role="tablist"`, `role="tab"` y `aria-selected` — los tests e2e validan el contrato sin modificar el componente
