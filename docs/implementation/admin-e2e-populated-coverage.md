# Admin E2E populated coverage

## Base

- Rama: `test/admin-e2e-populated-coverage`.
- HEAD inicial: `31b368a fix(admin): guard audit hydration boundary (#1050)`.
- `main` inicial: `31b368a fix(admin): guard audit hydration boundary (#1050)`.
- Working tree inicial: limpio.

## Objetivo

Cerrar el P1 de cobertura E2E poblada para los módulos críticos de
Administración: Overview, Tokens, Reports, Audit y Users/Roles. La cobertura
debe validar datos operativos determinísticos, selección del módulo, errores de
navegador y el contrato no-scroll con nueve filas en 1366×768 y 1440×900.

## Scope incluido

- Fixture HTTP local y determinística para Playwright, sin red externa.
- Lecturas pobladas de auditoría, salud, tokens, informes y usuarios/roles.
- Asserts de contenido, ausencia de empty state, navegación activa, URL,
  `pageerror`, `console.error` relevante y no-scroll.
- Compactación desktop local de Tokens, Reports y Users/Roles para conservar
  nueve filas visibles en el viewport mínimo.
- Actualización de contratos estáticos de densidad afectados.

La compactación de producto se realizó después de que Nico autorizara
explícitamente ampliar el scope solo a:

- `AdminParticularTokensCard.tsx`.
- `AdminReportsCard.tsx`.
- `AdminUsersRolesReadOnlyCard.tsx`.

## Scope excluido

- Backend, DB, Drizzle, migraciones y endpoints.
- Auth, cookies reales, permisos, roles y sesiones productivas.
- Dependencias, `package.json`, lockfile, CI, workflows y Dependabot.
- `.env`, secretos y datos reales.
- Rediseños globales, componentes compartidos y otros módulos Admin o Clínica.
- P2 de contraseñas Clínica y P2 de manejo uniforme 401/403.

## Auditoría previa

- El spec real no-scroll ya tenía fixtures pobladas para Clínicas, Pricing y
  Sessions.
- Overview solo cubría el hub sin actividad poblada.
- Tokens y Users/Roles no estaban en la matriz real.
- Reports y Audit estaban presentes, pero sin respuesta poblada de sus
  endpoints.
- Audit ya conservaba el guard de hidratación agregado en #1050.
- El cliente API usa same-origin en browser y `NEXT_PUBLIC_API_URL` en SSR; por
  eso Overview y Audit requerían una API fixture accesible desde el proceso de
  Next, no solo interceptación de requests del navegador.

## Bloqueo encontrado y autorización

La primera corrida funcional con nueve filas pobladas demostró un defecto real
en 1366×768:

- Tokens: overflow vertical interno de 54 px.
- Reports: overflow vertical interno de 57 px.
- Users/Roles: superficie de 617 px dentro de 565 px, exceso de 52 px.
- Overview y Audit ya pasaban poblados en ambos viewports.
- Los cinco módulos pasaban en 1440×900.

No se redujeron fixtures, filas, asserts ni tolerancias. El trabajo se detuvo y
Nico autorizó una compactación de producto local en los tres componentes
afectados.

## Implementación E2E

### API fixture

`frontend/e2e/fixtures/admin-populated-api-server.mjs` expone exclusivamente
datos sintéticos y determinísticos en `127.0.0.1:3107`. La fixture poblada solo
responde cuando recibe la cookie E2E
`admin_session_id=e2e_populated_admin_session`; las demás sesiones conservan
respuesta 404 para no falsear otros specs.

La fixture cubre:

- 47 eventos totales y nueve eventos visibles de auditoría.
- salud operativa `ok` para Overview;
- nueve tokens enmascarados;
- nueve informes con estados representativos;
- nueve usuarios con roles Admin, Owner y Staff;
- notificaciones vacías para evitar el 404 conocido del topbar en este entorno.

`frontend/playwright.config.ts` inicia la fixture y configura el web server de
Next para usarla durante E2E. No se agregó ninguna dependencia.

### Asserts por módulo

- Overview: KPI 47/9, estado Operativo, actividad Login admin y ausencia del
  empty state de actividad.
- Tokens: `****4201`, paciente, clínica, estado, informe y diez filas de tabla
  contando el header.
- Reports: paciente, clínica, ID, etapa, archivo y diez filas contando el
  header.
- Audit: actor, evento/acción, fecha no vacía, total 47 y diez filas contando
  el header.
- Users/Roles: usuarios Admin/Clínica, roles Owner/Staff, clínica y diez filas
  contando el header.
- Todos: workspace, query del módulo, navegación `aria-current="page"`, ausencia
  de empty state, cero `pageerror`, cero `console.error` relevante y no-scroll.

El único mensaje filtrado es el diagnóstico exacto de Chromium que indica que
`upgrade-insecure-requests` se ignora dentro de una política CSP report-only.
No se filtran hydration mismatch, errores React ni errores de aplicación.

## Compactación local de producto

### Tokens

- Se redujeron solo en desktop padding del header y contenido, separación del
  toolbar y altura de métricas.
- Header de tabla de 32 px y filas de 32 px mediante `h-8` y `py-0.5`.
- Pager y controles desktop compactos; mobile conserva sus tamaños previos.
- Se preservan los nueve tokens, el enmascarado, estado, informe, fechas y
  acciones.

### Reports

- Se compactaron en desktop header, acciones, contenido y pager.
- Header y filas de tabla quedaron en 32 px sin ocultar columnas ni metadata.
- Se preservan nueve informes, paciente, clínica, estudio, estado, fecha,
  archivo y acción.

### Users/Roles

- Se compactaron en desktop header, KPI, filtros, padding del cuerpo y footer.
- Selects y botones mantienen nombre accesible y estados disabled.
- Header y filas de tabla quedaron en 32 px.
- Se preservan nueve usuarios, tipo, rol, clínica, fechas y cambio de rol.

No se agregó scroll regional, `overflow-y-auto`, ocultamiento de overflow ni
cambios en componentes compartidos.

## Archivos modificados

- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`.
- `frontend/e2e/fixtures/admin-populated-api-server.mjs`.
- `frontend/playwright.config.ts`.
- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`.
- `frontend/src/app/dashboard/admin/AdminReportsCard.tsx`.
- `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx`.
- `test/admin-tokens-enterprise-density.test.ts`.
- `test/admin-users-roles-enterprise-density.test.ts`.
- `docs/implementation/admin-e2e-populated-coverage.md`.

## Validaciones

- `node --check e2e/fixtures/admin-populated-api-server.mjs`, desde
  `frontend`: pasó.
- Tests contractuales focales de Tokens, Reports y Users/Roles: 47/47.
- E2E focal poblado final:
  `pnpm exec playwright test e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts --grep "admin (overview|tokens|reports|audit|users and roles) populated"`,
  desde `frontend`: 10/10.
- `pnpm test`: 2806/2806.
- `pnpm build`: pasó.
- `pnpm security:public-surface`: pasó sin hallazgos de exposición pública;
  informó únicamente dos marcadores server-only esperados en
  `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: pasó.
- `pnpm --dir frontend typecheck`: pasó.
- `pnpm --dir frontend build`: pasó, 25/25 páginas generadas.

Una ejecución intermedia de `pnpm test` terminó 2797/2806 porque `next dev`
había regenerado `frontend/next-env.d.ts` con la ruta `.next/dev`. Se restauró
el contenido versionado mediante parche, el archivo quedó fuera del diff y la
repetición completa pasó 2806/2806.

## Resultado

- Overview: poblado y no-scroll en 1366×768 y 1440×900.
- Tokens: nueve filas pobladas y no-scroll en ambos viewports.
- Reports: nueve filas pobladas y no-scroll en ambos viewports.
- Audit: nueve eventos poblados, guard de errores limpio y no-scroll en ambos
  viewports.
- Users/Roles: nueve filas pobladas y no-scroll en ambos viewports.

## Riesgos residuales

- El contrato depende de conservar el presupuesto vertical compacto y el page
  size de nueve filas.
- Cambios futuros en tipografía, chrome del App Shell o copy multilínea deben
  volver a ejecutar el E2E poblado en ambos viewports.
- La fixture es deliberadamente E2E y no valida integración con una DB real;
  valida el contrato de UI con payloads representativos y determinísticos.

## Estado final y acciones manuales

- Los cambios quedan sin stage, commit ni push.
- Nico debe revisar el diff y realizar QA humana responsive.
- Después de aprobar: stage, commit, push y creación del PR son manuales.
- Para observar checks después del push y creación del PR:
  `gh pr checks --watch`.
