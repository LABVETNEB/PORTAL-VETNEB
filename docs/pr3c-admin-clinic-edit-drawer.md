# PR3C — feat(admin): add clinic edit drawer

## Summary

Reemplaza la edición inline masiva de clínicas en el panel admin por un **drawer lateral** accesible y compacto. La lista/tabla de clínicas queda en modo lectura; la edición se abre en un panel deslizable al hacer clic en "Editar".

No se tocaron: backend, auth, middleware, SEO, dependencias, lockfiles, tsconfig, next-env ni configuración global.

---

## UX behavior

| Acción | Comportamiento |
|--------|----------------|
| Clic en "Editar" | Abre drawer lateral derecho con datos de la clínica seleccionada |
| Editar nombre/email/teléfono + "Guardar datos" | Llama a `PATCH /api/admin/clinics/:id`, cierra drawer, recarga lista |
| Editar usuario/contraseña + "Guardar acceso" | Confirma si hay nueva contraseña, llama a `PATCH /api/admin/clinics/:id/users/:userId/credentials`, mantiene drawer abierto |
| "Cancelar" o botón X | Cierra drawer sin llamar API; búsqueda y paginación no se alteran |
| "Eliminar clínica" | Requiere `window.confirm` + `window.prompt` con nombre exacto; llama a `DELETE /api/admin/clinics/:id`; cierra drawer al éxito |
| Error en cualquier operación | Se muestra `role="alert"` dentro del drawer; drawer permanece abierto |
| Escape | Cierra drawer (excepto si hay operación en curso) |
| Clic fuera del drawer | Cierra drawer (excepto si hay operación en curso) |
| Apertura de otro Edit mientras hay uno abierto | Deshabilitado: botones "Editar" se deshabilitan mientras el drawer está abierto |

---

## Accessibility notes

- `Dialog.Root/Portal/Overlay/Content` de `@radix-ui/react-dialog` (ya incluido en el proyecto) proporciona `role="dialog"`, `aria-labelledby`, focus trap y cierre por Escape.
- `Dialog.Title` referenciado por `aria-labelledby` usando `useId()`.
- `Dialog.Close` con `aria-label="Cerrar panel de edición"`.
- Botón "Editar" de cada fila tiene `aria-label="Editar clínica {nombre}"`.
- Errores envueltos en `role="alert"` para anuncio a lectores de pantalla.
- `fieldset[disabled]` deshabilita todos los controles durante guardado.
- Foco inicial: Radix coloca el foco en el primer elemento focusable (botón de cierre en el header).
- Animaciones se respetan con `prefers-reduced-motion` vía las clases de `tailwindcss-animate`.
- No hay acciones críticas inaccesibles por teclado.

---

## Files changed

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx` | **Nuevo** | Componente drawer usando `@radix-ui/react-dialog` |
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | **Modificado** | Reemplaza edición inline por tabla compacta + drawer |
| `frontend/e2e/admin-clinic-edit-drawer.spec.ts` | **Nuevo** | Tests Playwright para comportamiento del drawer |
| `docs/pr3c-admin-clinic-edit-drawer.md` | **Nuevo** | Este documento |

---

## Tests added/updated

### `frontend/e2e/admin-clinic-edit-drawer.spec.ts`

Tests Playwright con intercepción de API (`page.route`). Todos los tests de comportamiento incluyen un guard que omite la ejecución si el admin redirige a `/login` sin autenticación (el entorno de CI/e2e requiere credenciales de admin válidas para los tests interactivos).

| Test | Cobertura |
|------|-----------|
| `scope guard` | Invariante de alcance documentada |
| `clinic list shows compact read-only rows with Edit button` | Lista compacta sin inputs inline; botón Editar visible y accesible |
| `clicking Edit opens the drawer with clinic data` | Drawer abre con `role="dialog"` y datos precargados |
| `drawer has accessible close button and title` | Cerrar/Guardar/Cancelar accesibles por nombre/rol |
| `cancel button closes drawer without saving` | Cierre sin llamada a API update |
| `Escape key closes the drawer when not saving` | Cierre por teclado |
| `saving clinic data calls update API and closes drawer` | API llamada con payload correcto; drawer cierra al éxito |
| `save error is displayed inside the drawer` | `role="alert"` en drawer; drawer permanece abierto |
| `opening drawer does not reset search query or pagination` | Búsqueda/paginación no se resetean al abrir/cerrar drawer |
| `clinic with no user shows drawer without credentials section` | Drawer sin sección "Acceso" cuando no hay usuario |

**Nota auth**: Los tests de comportamiento requieren que la página `/dashboard/admin` renderice el `AdminClinicsManagementCard`. Si el servidor redirige a `/login` (sin sesión admin válida), los tests se omiten con `test.skip()`. Para cobertura completa en CI, configurar `storageState` con sesión admin válida en `playwright.config.ts`.

---

## Validation results

Ejecutar en orden desde la raíz del repositorio:

```bash
pnpm test                          # backend tests
pnpm build                         # backend build
pnpm security:public-surface       # public surface audit
pnpm --dir frontend lint           # ESLint frontend
pnpm --dir frontend typecheck      # TypeScript frontend
pnpm --dir frontend build          # Next.js build
```

Comandos de integridad post-implementación:

```bash
git diff --check      # sin trailing whitespace
git status --short    # solo archivos dentro de scope
git diff --stat       # resumen de cambios
```

---

## CI navigation fix — stable tab IDs (commit fix over 46cbd22)

### Problema

`navigateToGestionTab` usaba `page.getByRole("tab", { name: /gestión/i })` y luego esperaba `#admin-clinics` (Card interna). Pero `AdminSectionTabs` generaba los IDs de tab/panel con `useId()` de React, produciendo valores como `:r0:-tab-gestion` — no predecibles, distintos en cada render SSR vs cliente, imposibles de usar como anclas estables.

### Causa raíz

`useId()` genera un ID único por instancia de componente, diseñado para evitar colisiones cuando hay múltiples instancias. `AdminSectionTabs` solo tiene una instancia global en el admin page, y `tab.id` ya es estable y único por diseño (`"sistema"`, `"gestion"`, etc.). El prefijo `useId()` no aportaba nada y hacía los IDs opacos.

### Cambios

**`frontend/src/app/dashboard/admin/AdminSectionTabs.tsx`**
- Eliminado `useId` del import y `const baseId = useId()`
- IDs de tab: `` `admin-section-tab-${tab.id}` `` (ej: `admin-section-tab-gestion`)
- IDs de panel: `` `admin-section-panel-${tab.id}` `` (ej: `admin-section-panel-gestion`)
- ARIA contracts intactos: `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`, `hidden`, navegación por teclado

**`frontend/e2e/admin-clinic-edit-drawer.spec.ts`** — `navigateToGestionTab`:
```typescript
const tab = page.locator('[role="tab"][aria-controls="admin-section-panel-gestion"]');
const panel = page.locator("#admin-section-panel-gestion");
await expect(tab).toBeVisible({ timeout: 5_000 });
await expect(tab).toBeEnabled();
await expect(async () => {
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 1_000 });
  await expect(panel).not.toHaveAttribute("hidden", { timeout: 1_000 });
  await expect(page.locator("#admin-clinics")).toBeVisible({ timeout: 1_000 });
}).toPass({ intervals: [300, 600, 1_000, 1_500], timeout: 8_000 });
```
- Selector estable por `aria-controls` (no regex de texto con tilde)
- Verifica `aria-selected="true"` — confirma que React procesó el click
- Verifica panel sin `hidden` — confirma que el tabpanel está activo
- Verifica `#admin-clinics` — confirma que el contenido es visible

**`test/frontend-dashboard-accessibility-focus-aria.test.ts`** — 2 líneas actualizadas para reflejar los nuevos strings en el fuente del componente.

---

## CI fix — E2E determinism (commit fix over 346aa95)

### Root cause

Los 9 tests de component behavior fallaban en CI con el error:

```
expect(page.getByRole("cell", { name: /Clínica Test/i }).first()).toBeVisible({ timeout: 8000 })
element(s) not found
```

**Causa principal**: `navigateToGestionTab` hacía click en el tab "Gestión" antes de que React hidratara la página. En CI con servidor Next.js arrancando en frío, el botón `<button role="tab">` existe en el HTML (SSR), pero el handler `onClick` de `AdminSectionTabs` aún no estaba conectado cuando Playwright disparaba el primer click. El click era un no-op, el panel permanecía con el atributo `hidden`, y `getByRole("cell")` nunca encontraba las celdas.

**Causa secundaria**: `test.skip()` enmascaraba fallos de setup en lugar de fallar explícitamente.

**No afectado**: el mock de GET `/api/admin/clinics` sí interceptaba correctamente (Playwright intercepta antes de llegar al servidor; sin proxy porque `NEXT_PUBLIC_API_URL=""` → `rewrites()` retorna `[]`). El componente sí montaba (todos los panels se renderizan en el DOM con `hidden`, no condicionales), y la respuesta del mock sí llegaba.

### Cambios en `frontend/e2e/admin-clinic-edit-drawer.spec.ts`

| Elemento | Antes | Después |
|----------|-------|---------|
| `navigateToGestionTab` | Click único, sin verificar que el panel se abrió | `expect(async()=>{click;check}).toPass({intervals:[300,600,1000,1500],timeout:8000})` — reintenta hasta que `#admin-clinics` sea visible |
| `mockAdminClinicsGet` | Patrón glob `**/api/admin/clinics**` | Predicate de URL: `url.pathname === "/api/admin/clinics"` — más preciso, no depende de glob |
| `mockAdminClinicsUpdate` | Patrón glob `**/api/admin/clinics/**` + check `.includes("/users/")` | Predicate de URL: `/^\/api\/admin\/clinics\/\d+$/.test(url.pathname)` — solo PATCH a IDs numéricos |
| `test.skip()` guards | Presentes en todos los tests de behavior | Eliminados — el admin page renderiza sin auth (no hay middleware de redirect) |
| Per-test routes (`/api/admin/clinics/1`) | Patrón glob | Predicate de URL `url.pathname === "/api/admin/clinics/1"` |

### Por qué el retry funciona

`expect(async () => { await click(); await expect(locator).toBeVisible({timeout:1000}); }).toPass(...)` reintenta la función entera si cualquier `expect` interno lanza. Primera iteración: click se dispara antes de hydration → handler no está conectado → panel no cambia → `#admin-clinics` sigue hidden → `toBeVisible` lanza → retry. Segunda iteración (300ms después): React ya hidró → `onClick` está conectado → panel abre → `#admin-clinics` visible → ✓.

### Validación post-fix (mismos resultados que antes)

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 2455 pass, 0 fail |
| `pnpm build` | dist/index.js 858.1 kb |
| `pnpm security:public-surface` | PASS |
| `pnpm --dir frontend lint` | 0 errores |
| `pnpm --dir frontend typecheck` | 0 errores |
| `pnpm --dir frontend build` | ok |
| `git diff --check` | CLEAN |
| `git status --short` | 1 archivo en scope (`e2e/admin-clinic-edit-drawer.spec.ts`) |

---

## CI fix — SSR webpack crash (commit fix over 544a06a)

### Problema

Los 9 tests de component behavior seguían fallando. El error del tab locator cambió su diagnóstico: Playwright mostraba `- text: Not Found` en el snapshot YAML — es decir, la página entera era la página 404 de Next.js, no el admin dashboard.

### Causa raíz

`ClinicEditDrawer.tsx` importa `@radix-ui/react-dialog`. El paquete `@radix-ui/react-dialog ^1.1.2` declara `"use client"` al inicio de su bundle ESM (`dist/index.mjs`). Esta directiva es válida para el runtime de React, pero provoca que webpack (Next.js 15) no pueda inicializar el módulo correctamente durante el server-side rendering (SSR):

```
⨯ [TypeError: __webpack_modules__[moduleId] is not a function] { digest: '4089801993' }
GET /dashboard/admin 500 in 15006ms
```

Aunque `AdminClinicsManagementCard` y `ClinicEditDrawer` son componentes `"use client"`, Next.js los incluye en el bundle SSR para generar el HTML inicial. Al importar `@radix-ui/react-dialog` de forma estática, el factory del módulo no es una función válida en ese contexto → 500. Next.js renderiza `/_not-found` como fallback → Playwright ve `- text: Not Found`.

El paquete estaba declarado en `package.json` pero nunca se había usado en el proyecto antes de PR3C, por lo que el error era silencioso hasta que nuestro spec intentó navegar a `/dashboard/admin`.

### Diagnóstico

```
# Reproducible localmente:
NEXT_PUBLIC_API_URL="" pnpm --dir frontend exec next dev --hostname 127.0.0.1
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/dashboard/admin
# → 500
```

### Cambio

**`frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx`**

Reemplaza el import estático de `ClinicEditDrawer` por un `next/dynamic` con `ssr: false`. Los imports de tipos (`ClinicDraft`, `CredentialsPayload`) se mantienen como type-only.

```typescript
// Antes:
import { ClinicEditDrawer, type ClinicDraft, type CredentialsPayload } from "./ClinicEditDrawer";

// Después:
import dynamic from "next/dynamic";
import type { ClinicDraft, CredentialsPayload } from "./ClinicEditDrawer";

const ClinicEditDrawer = dynamic(
  () => import("./ClinicEditDrawer").then((m) => m.ClinicEditDrawer),
  { ssr: false },
);
```

`ssr: false` excluye el módulo del bundle servidor → el factory de `@radix-ui/react-dialog` no se invoca durante SSR → sin 500 → la página renderiza correctamente (200).

El drawer sigue funcionando igual en el browser. La carga diferida no impacta la UX: el componente se monta en el cliente durante la hidratación y el drawer solo se abre después de interacción del usuario (`editingClinic !== null`).

### Validación post-fix

| Comando | Resultado |
|---------|-----------|
| `curl http://127.0.0.1:3000/dashboard/admin` | **200** (antes: 500) |
| `pnpm --dir frontend lint` | 0 errores |
| `pnpm --dir frontend typecheck` | 0 errores |
| `pnpm --dir frontend build` | ok |
| `pnpm test` | 2455 pass, 0 fail |
| `git diff --check` | CLEAN |
| `git status --short` | 1 archivo en scope (`AdminClinicsManagementCard.tsx`) |

---

## Risks / rollback notes

### Riesgos

- **Radix Dialog ya está instalado** (`@radix-ui/react-dialog ^1.1.2`): no hay riesgo de dependencia nueva.
- **Animación**: usa clases `tailwindcss-animate` (`data-[state=open]:animate-in`, etc.). Si `tailwindcss-animate` no está activado en el preset de Tailwind, las animaciones no aparecen pero el drawer funciona igual.
- **`window.confirm` / `window.prompt`**: siguen en uso para confirmación de contraseña y eliminación (misma lógica que antes, solo movida al drawer). En entornos donde estas APIs estén bloqueadas (jsdom, algunos browsers), la confirmación no puede completarse.
- **Edición concurrent de dos clínicas**: los botones "Editar" se deshabilitan mientras el drawer está abierto, por lo que no es posible abrir dos drawers simultáneos.

### Rollback

Si es necesario revertir este PR:

```bash
git revert HEAD  # revierte solo este commit
```

O restaurar el archivo anterior:
```bash
git checkout main -- frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx
git rm frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx
git rm frontend/e2e/admin-clinic-edit-drawer.spec.ts
```

La edición inline vuelve a estar activa automáticamente al restaurar `AdminClinicsManagementCard.tsx` del estado anterior.
