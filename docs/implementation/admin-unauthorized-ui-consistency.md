# PR fix/admin-unauthorized-ui-consistency — Entrega Codex

## Base

- Rama: `fix/admin-unauthorized-ui-consistency`.
- HEAD inicial: `1a76a2b fix(admin): hide clinic passwords by default (#1052)`.
- `main` local inicial: `1a76a2b fix(admin): hide clinic passwords by default (#1052)`.
- Working tree inicial: limpio.
- Entorno: Windows, PowerShell y PNPM.

## Scope incluido

- Auditoría del manejo frontend de respuestas Admin `401` y `403`.
- Clasificación tipada y copy seguro para ambos estados.
- Estado UI local y uniforme dentro del workspace Admin.
- Preservación de la redirección SSR existente para `401`.
- Propagación de `403` SSR al módulo que consumió la lectura.
- Tests contractuales para copy, seguridad, status y exclusión de empty states.

## Scope excluido

- Backend, DB, Drizzle, migraciones, schema y endpoints.
- Auth, cookies, sesiones, roles, permisos, CSRF, CORS, CSP y rate limits.
- Dependencias, `package.json`, `pnpm-lock.yaml`, CI, workflows y Dependabot.
- App Shell global, rediseño del dashboard y cambios visuales fuera de Admin.
- Contraseñas Clínica, hidratación Audit y E2E poblado ya cerrados.
- `.env`, secretos y datos reales.

## Auditoría previa

- `apiFetch` ya representaba respuestas fallidas mediante `ApiResponseError`,
  pero para errores 4xx podía propagar copy recibido del backend.
- Clínicas, Informes, Tokens, Pricing, Sesiones, Usuarios/Roles, Alertas,
  Maintenance y Schema usaban mensajes y layouts distintos.
- Clínicas, Informes y Tokens podían mostrar simultáneamente un error de carga y
  un empty state de datos inexistentes.
- Audit conservaba la redirección SSR de `401`, pero un `403` se transformaba en
  snapshot vacío; sus resúmenes auxiliares podían mostrar cero actividad.
- System Health absorbía cualquier error como lectura desconocida y Schema
  Health convertía el `401` en un `Error` sin status HTTP tipado.
- `ErrorState` no cubría la acción específica de volver a login ni el copy Admin
  requerido; se eligió un componente local para no ampliar superficies.

## Cambios realizados

### Contrato seguro 401/403

- `api-error.ts` define únicamente dos estados Admin válidos: `401` y `403`.
- `401` comunica sesión expirada y retorno al login.
- `403` comunica permisos insuficientes y contacto con Administración.
- Errores `404`, `429`, `5xx`, errores de red y errores no tipados no se
  reclasifican como auth.

### Normalización del cliente API

- Las respuestas `401/403` de rutas `/api/admin/*` se clasifican antes de leer
  el body de error.
- El `ApiResponseError.status` se conserva y su mensaje usa copy controlado.
- Schema Health aplica el mismo contrato aunque conserve su lectura especial de
  respuestas `200/503`.
- System Health vuelve a propagar solo `401/403`; sus fallos no-auth mantienen el
  fallback previo a estado desconocido.

### Estado UI uniforme

- `AdminAccessErrorState` reemplaza el contenido del workspace afectado.
- Usa semántica `role="alert"`, copy breve, layout responsive y acción a login
  solo para `401`.
- No renderiza errores técnicos, payloads, empty states ni detalle de roles.
- El store browser conserva solo el número `401 | 403`, se limpia al cambiar de
  módulo, volver al hub o salir de Admin y no persiste payloads.
- Los errores SSR se aplican solo al módulo que depende de la lectura: Audit,
  System Health u Overview; no bloquean módulos independientes.

## Comportamiento final

- `401` client-side: muestra “Sesión expirada” y “Volver a iniciar sesión”.
- `401` server-side: conserva la redirección segura existente a login.
- `403`: muestra “Acceso restringido”, permisos insuficientes y contacto con
  Administración.
- Error no-auth: conserva el flujo genérico o específico previo del módulo.
- Empty state legítimo: se conserva cuando la lectura fue exitosa y no hay datos.
- Empty state ante `401/403`: no se renderiza porque el workspace se sustituye.

## Tests agregados

- `test/frontend-admin-unauthorized-ui-consistency.test.ts` valida:
  - clasificación exclusiva de `ApiResponseError(401|403)`;
  - copy exacto y uniforme;
  - ausencia de `cookie`, `token`, `stack`, `Supabase`, `JWT`, `role_id`,
    `permission_id`, `HTTP 401/403`, `Unauthorized` y `Forbidden`;
  - normalización antes de leer copy del backend;
  - sustitución del workspace sin `EmptyState`;
  - preservación del redirect SSR `401` y propagación SSR `403`.

## Archivos modificados

- `frontend/src/lib/api-error.ts`.
- `frontend/src/lib/admin-access-error.ts`.
- `frontend/src/lib/api.ts`.
- `frontend/src/app/dashboard/admin/AdminAccessErrorState.tsx`.
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`.
- `frontend/src/app/dashboard/admin/page.tsx`.
- `test/frontend-admin-unauthorized-ui-consistency.test.ts`.
- `docs/implementation/admin-unauthorized-ui-consistency.md`.

## Validaciones

- TDD focal inicial: falló por ausencia del nuevo clasificador, como se esperaba.
- Test focal final: 5/5 aprobados.
- Contratos Admin colindantes: 36/36 aprobados.
- Primera ejecución de `pnpm test`: 2805/2812; siete contratos estáticos
  detectaron el import agrupado, dos firmas textuales cambiadas y el uso de
  `next/link` no permitido por el contrato global de navegación.
- Contratos focales después del ajuste a `PublicRouteControl`: 50/50 aprobados.
- `pnpm test` final: 2812/2812 aprobados.
- `pnpm build`: aprobado; bundle backend generado correctamente.
- `pnpm security:public-surface`: aprobado sin exposición pública; informó solo
  los dos identificadores server-only preexistentes en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: aprobado después del cambio final.
- `pnpm --dir frontend typecheck`: aprobado después del cambio final.
- `pnpm --dir frontend build`: aprobado; 25/25 páginas generadas y
  `/dashboard/admin` conserva render dinámico.

## Seguridad

- No se leen ni renderizan bodies de error `401/403` para rutas Admin.
- No se guardan mensajes, cookies, tokens, headers ni payloads en el store UI.
- No se modificaron sesiones, cookies, auth, roles ni permisos.
- No se leyeron, imprimieron ni incorporaron secretos reales.

## Riesgos residuales y QA humana

- El estado uniforme depende de que el servidor responda con status HTTP real;
  un fallo de red sin respuesta conserva el error genérico, deliberadamente.
- La normalización se limita a `/api/admin/*`; otras superficies mantienen sus
  contratos actuales.
- Nico debe realizar QA visual en desktop, laptop, tablet y móvil, además de
  teclado, foco, tema soportado, `401`, `403`, empty legítimo y error no-auth.

## Estado final y acciones manuales

- Los cambios quedan en working tree, sin stage, commit ni push.
- Ocho archivos pertenecen al scope: cuatro modificados y cuatro nuevos.
- `git diff --check`: aprobado sin errores de whitespace; Git informó avisos de
  conversión LF/CRLF para dos archivos existentes al volver a tocarlos.
- No se modificaron backend, DB, auth, dependencias, lockfile, CI ni App Shell.
- Stage, commit, push, creación del PR, checks remotos y merge quedan a cargo de
  Nico.
- Después del push y creación del PR: `gh pr checks --watch`.
