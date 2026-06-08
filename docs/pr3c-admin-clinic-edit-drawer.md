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
