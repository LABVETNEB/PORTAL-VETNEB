# PR-UX0 — Product/UX Dashboard Baseline Audit

Fecha: 2026-06-26  
Rama: audit/product-ux-dashboard-baseline  
Base: fcad364 chore(deps): bump @radix-ui/react-dropdown-menu from 2.1.16 to 2.1.18 (#1027)  
Tipo: auditoría documental / baseline producto UX  
Scope: dashboard privado Admin + Clínica  
Implementación: no incluida en este PR

## 1. Objetivo

Establecer una línea base documental para retomar el bloque producto/UX dashboard desde `main` limpio, antes de implementar cambios visuales u operativos.

El objetivo del bloque posterior será llevar el dashboard de Administración y Clínica a una experiencia premium de software administrativo real:

- Sin scroll externo del documento.
- Sin scroll operativo interno de módulos.
- Navegación clara por módulos.
- Máxima densidad útil sin saturación visual.
- Paridad real desktop / móvil Android / iOS.
- Diseño institucional moderno, estable y profesional.
- Conservación de backend, API, auth, DB, dependencias, lockfiles y CI fuera de scope salvo orden explícita.

## 2. Alcance de esta auditoría

Incluido:

- Inventario estático de archivos dashboard.
- Identificación de contratos existentes no-scroll / App Shell.
- Identificación de superficies con riesgo de overflow/scroll.
- Confirmación de validaciones frontend base.
- Confirmación de tests E2E existentes relacionados.
- Priorización P1/P2 para PRs posteriores.

Excluido:

- Cambios de UI.
- Cambios de CSS productivo.
- Cambios en backend/API/auth/DB.
- Cambios de dependencias.
- Cambios de lockfiles.
- Cambios de CI.
- Ejecución o modificación de Playwright en este PR documental.

## 3. Estado base confirmado

Comandos ejecutados antes de crear este documento:

- `git branch --show-current`
- `git status --short --untracked-files=all`
- `git log -1 --oneline`
- `git fetch --prune`
- `git status -sb`
- `gh pr list --state open`
- `git branch -r --no-merged origin/main`
- `git branch`

Resultado observado:

- Rama base inicial: `main`.
- Working tree limpio.
- HEAD/main/origin/main: `fcad364 chore(deps): bump @radix-ui/react-dropdown-menu from 2.1.16 to 2.1.18 (#1027)`.
- PRs abiertos: 0.
- Ramas remotas no mergeadas: 0.
- Ramas locales antes de PR-UX0: solo `main`.
- Rama creada para este PR: `audit/product-ux-dashboard-baseline`.

## 4. Validaciones frontend base

El package frontend real es:

- `portal-vetneb-frontend`

Validaciones ejecutadas desde `C:\PORTAL-VETNEB\frontend`:

- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm build`

Resultado:

- ESLint OK.
- TypeScript OK.
- Next.js build OK.
- Build generado con Next.js 16.2.7 / Turbopack.
- Rutas dashboard privadas presentes en build:
  - `/dashboard`
  - `/dashboard/admin`
  - `/dashboard/informes`
  - `/dashboard/logistica`
  - `/dashboard/logistica/metricas`
  - `/dashboard/logistica/rutas`
  - `/dashboard/logistica/visitas`

Nota operativa:

- `corepack pnpm --filter frontend ...` no matchea workspace.
- Para este repo, las validaciones frontend deben ejecutarse dentro de `.\frontend` o usando el nombre real del package si se decide filtrar.

## 5. Inventario de archivos dashboard principales

Archivos/directorios identificados:

- `frontend/src/app/dashboard`
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`
- `frontend/src/components/dashboard`
- `frontend/src/components/dashboard/AdminDashboardSidebar.tsx`
- `frontend/src/components/dashboard/ClinicDashboardSidebar.tsx`
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`
- `frontend/src/components/dashboard/DashboardHorizontalNav.tsx`
- `frontend/src/components/dashboard/DashboardHubHero.tsx`
- `frontend/src/components/dashboard/DashboardLogoutControl.tsx`
- `frontend/src/components/dashboard/DashboardModuleHub.tsx`
- `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx`
- `frontend/src/components/dashboard/DashboardNotificationsBell.tsx`
- `frontend/src/components/dashboard/DashboardPageHeader.tsx`
- `frontend/src/components/dashboard/DashboardRefreshButton.tsx`
- `frontend/src/components/dashboard/DashboardShellRouter.tsx`
- `frontend/src/components/dashboard/DashboardSidebar.tsx`
- `frontend/src/components/dashboard/DashboardSidebarFrame.tsx`
- `frontend/src/components/dashboard/DashboardTopbar.tsx`
- `frontend/src/components/dashboard/PrivateDashboardShell.tsx`
- `frontend/src/lib/dashboard-last-module.ts`
- `frontend/src/lib/dashboard-server-auth.ts`

## 6. Contratos no-scroll existentes detectados

Se detectaron contratos explícitos de App Shell / single viewport:

### 6.1 `ModuleSurface.tsx`

El componente declara un frame estándar de módulo single-viewport para App Shell. Su comentario indica que el cuerpo `dashboard-module-body` debe llenar el espacio disponible y quedar acotado al viewport sin scroll operativo.

Impacto:

- Es una base correcta para el objetivo no-scroll.
- Debe ser preservada y usada como contrato central.
- Los módulos posteriores deben adaptarse a este frame en lugar de crear superficies scrollables aisladas.

### 6.2 `ModuleTabs.tsx`

El componente declara tabs height-aware para App Shell. Su comentario indica que el tablist permanece fijo y que los módulos cambian contenido dentro del mismo viewport con zero scroll.

Impacto:

- Es una base correcta para navegación segmentada sin salto de layout.
- Debe validarse en móvil y desktop con contenido real.
- Debe evitar que cada tab cree scroll propio salvo excepciones técnicas justificadas.

### 6.3 `usePagedRows.ts`

El hook documenta que App Shell lo usa para limitar cuántas filas renderiza un módulo y mantener el body dentro de un viewport desktop sin scroll, preservando acceso al dataset por paginación.

Impacto:

- Es una estrategia correcta para reemplazar scroll por paginación.
- Debe aplicarse de manera uniforme en módulos con listas/tablas.
- Debe validarse con datos poblados, no solo estados vacíos.

## 7. Superficies con riesgo UX / scroll / overflow

### 7.1 `StickyFilterBar.tsx`

Se detectó:

- `sticky top-3`
- `overflow-hidden`
- `overflow-x-auto`
- `overscroll-x-contain`

Riesgo:

- Puede generar scroll horizontal interno en filtros.
- Puede interferir con el contrato no-scroll si queda dentro de un módulo ya acotado.
- Puede ser aceptable como micro-scroll horizontal de chips/filtros, pero debe quedar documentado como excepción si se conserva.

Criterio para PR posterior:

- En desktop: preferir wrapping compacto, segmentación o layout por densidad antes que scroll horizontal.
- En móvil: permitir carrusel horizontal solo si no produce scroll vertical ni tapa acciones primarias.

### 7.2 `UploadReportModal.tsx`

Se detectó:

- Overlay con `overflow-y-auto`.
- Listbox de clínicas con `max-h-44 overflow-y-auto`.

Riesgo:

- Modal puede introducir scroll vertical interno.
- En móviles chicos puede ser necesario, pero debe controlarse para no generar doble scroll documento + modal.
- El buscador/listbox puede saturar la altura útil si no se acota correctamente.

Criterio para PR posterior:

- Modal puede tener scroll interno solo como excepción controlada de accesibilidad y contenido largo.
- No debe mover ni desbloquear scroll del dashboard base.
- El foco debe quedar atrapado dentro del modal.
- En móvil debe priorizar estructura bottom-sheet/full-height controlada.

### 7.3 `frontend/src/components/ui/table.tsx`

Se detectó:

- `overflow-auto` en wrapper de tabla.

Riesgo:

- Tablas genéricas pueden crear scroll interno no deseado dentro de módulos dashboard.
- En App Shell, tablas deben preferir:
  - paginación,
  - columnas priorizadas,
  - master-detail,
  - cards adaptativas,
  - densidad responsive.

Criterio para PR posterior:

- No usar tablas con overflow libre dentro de módulos no-scroll.
- Si una tabla requiere overflow horizontal técnico, debe quedar como excepción puntual y testeada.

### 7.4 `StatsCards.tsx`

Se detectó:

- `overflow-hidden` en cards métricas.

Riesgo:

- Bajo riesgo funcional.
- Puede cortar textos largos si el contenido no está medido.
- En móvil debe validarse que no oculte valores ni labels críticos.

Criterio para PR posterior:

- Mantener si mejora estabilidad visual.
- Validar con textos largos y zoom.

## 8. Tests E2E existentes relevantes

Se detectó una cobertura importante ya existente para dashboard, no-scroll, móvil, Admin y Clínica:

### Admin mobile / no-scroll

- `admin-mobile-app-shell-absolute-no-scroll.spec.ts`
- `admin-mobile-bottom-navigation-no-scroll.spec.ts`
- `admin-mobile-config-modules-no-scroll.spec.ts`
- `admin-mobile-core-modules-no-scroll.spec.ts`
- `admin-mobile-final-polish-no-scroll.spec.ts`
- `admin-mobile-hub-launcher-no-scroll.spec.ts`
- `admin-mobile-module-layer-isolation.spec.ts`
- `admin-mobile-ops-modules-no-scroll.spec.ts`
- `admin-mobile-status-modules-no-scroll.spec.ts`
- `admin-clinics-mobile-card-layout.spec.ts`
- `admin-tokens-mobile-toolbar-layout.spec.ts`

### Dashboard global

- `dashboard-accessibility-keyboard.spec.ts`
- `dashboard-app-shell-visibility-contract.spec.ts`
- `dashboard-card-navigation-shell.spec.ts`
- `dashboard-global-masked-master-detail.spec.ts`
- `dashboard-interaction-foundation.spec.ts`
- `dashboard-internal-no-scroll-contract.spec.ts`
- `dashboard-master-detail-state-polish.spec.ts`
- `dashboard-mobile-shell-nav-contract.spec.ts`
- `dashboard-real-app-shell-no-scroll-contract.spec.ts`
- `dashboard-single-viewport-app-shell.spec.ts`
- `dashboard-viewport-zoom-adaptability.spec.ts`
- `dashboard-workspace-layout-polish.spec.ts`

### Clínica dashboard

- `dashboard-clinic-controller-workspace-parity.spec.ts`
- `dashboard-clinic-informes-mobile-parity.spec.ts`
- `dashboard-clinic-logistica-mobile-parity.spec.ts`
- `dashboard-clinic-mobile-nav-stage-parity.spec.ts`
- `dashboard-clinic-module-state-parity.spec.ts`
- `dashboard-clinic-perfil-mobile-operability.spec.ts`
- `dashboard-clinic-tokens-mobile-parity.spec.ts`

Impacto:

- El proyecto ya tiene una base de regresión amplia.
- El problema pendiente probablemente no es falta de intención contractual, sino brecha entre contrato, fixture, viewport real y percepción visual/operativa en dispositivos.
- Los próximos PRs deben usar estos tests como guardrail y, cuando sea necesario, agregar evidencia visual/manual o fixtures poblados.

## 9. Diagnóstico producto/UX baseline

### 9.1 Estado positivo

- Existe App Shell dashboard.
- Existen controladores separados para Admin y Clínica.
- Existen contratos explícitos single-viewport/no-scroll.
- Existen tests E2E específicos para no-scroll.
- Existen rutas privadas dashboard correctamente compiladas.
- Existen componentes reutilizables para superficies, tabs, navegación, topbar y sidebar.

### 9.2 Brecha principal

La brecha no parece ser ausencia total de arquitectura, sino falta de una validación producto/UX integral que combine:

- viewport real,
- datos poblados,
- navegación por módulos,
- acciones primarias visibles,
- ausencia de scroll documento,
- ausencia de scroll operativo interno,
- jerarquía visual premium,
- consistencia Admin/Clínica,
- Android/iOS,
- densidad sin saturación.

### 9.3 Riesgo central

Un dashboard puede pasar tests técnicos de no-scroll y seguir sintiéndose visualmente pobre o poco operativo si:

- los módulos no priorizan tareas,
- las acciones quedan dispersas,
- hay demasiada superficie decorativa,
- el contenido útil no está comprimido con criterio,
- los filtros/listas fuerzan scroll,
- el móvil usa una adaptación técnica pero no una experiencia pensada como software.

## 10. Contrato UX recomendado para próximos PRs

Todo PR posterior de producto/UX dashboard debe respetar:

### 10.1 Contrato viewport

- El dashboard privado debe comportarse como app shell, no como página pública.
- El documento no debe requerir scroll vertical para operar módulos principales.
- El módulo activo debe ocupar una región acotada.
- La navegación debe estar siempre disponible.
- Las acciones primarias deben estar visibles o a un toque.

### 10.2 Contrato de módulo

Cada módulo debe definir:

- Objetivo operativo principal.
- Acción primaria.
- Estado vacío.
- Estado loading.
- Estado error.
- Estado con datos.
- Estado con muchos datos.
- Estrategia de densidad.
- Estrategia móvil.

### 10.3 Contrato mobile

En Android/iOS:

- Sin scroll externo del documento en dashboard.
- Bottom navigation estable si aplica.
- Header compacto.
- Una tarea principal por pantalla.
- Cards densas sin acumulación vertical excesiva.
- Acciones críticas persistentes o muy cercanas.
- Sin overlays que generen doble scroll.

### 10.4 Contrato visual premium

- Menos aspecto de página, más aspecto de software.
- Superficies sobrias, jerarquizadas y consistentes.
- Métricas compactas y útiles.
- Master-detail cuando el contenido crece.
- Tabs/segmentos para dividir operación sin cambiar de página.
- Tablas solo cuando aporten valor real; si no, cards/listas densas.
- Nada de texto nuevo innecesario: conservar contenido actual salvo necesidad funcional.

## 11. Priorización propuesta

### P1 — Auditoría runtime visual con evidencia

Crear un PR documental o de test que capture evidencia real Admin/Clínica en:

- Desktop.
- Android viewport.
- iOS viewport.
- Datos poblados.
- Módulos críticos.

Objetivo:

- Confirmar dónde aparece scroll real.
- Confirmar qué módulo rompe densidad.
- Confirmar si el problema es shell, módulo, modal, tabla, filtros o datos.

### P1 — Corrección módulo por módulo Admin

PRs chicos, uno por superficie:

1. Hub / inicio Admin.
2. Clínicas.
3. Auditoría.
4. Alertas.
5. Informes.
6. Tokens.
7. Sesiones.
8. Configuración/precios/sistema si aplica.

Cada PR debe:

- tocar solo frontend dashboard,
- mantener API intacta,
- correr lint/typecheck/build,
- correr E2E específico si corresponde,
- incluir evidencia si modifica no-scroll.

### P1 — Corrección módulo por módulo Clínica

PRs chicos, uno por superficie:

1. Hub / inicio Clínica.
2. Informes.
3. Logística.
4. Tokens particulares.
5. Perfil.
6. Notificaciones.
7. Configuración/password si aplica.

### P2 — Normalización de componentes compartidos

Después de resolver P1:

- Unificar reglas de `ModuleSurface`.
- Unificar patrón de toolbar.
- Unificar patrón de filtros.
- Unificar patrón de listados paginados.
- Unificar patrón de estado vacío/loading/error.
- Unificar criterio de excepción para scroll técnico.

### P2 — Evidencia ISO / calidad

Mapear los próximos cambios contra:

- ISO/IEC 25010: usabilidad, mantenibilidad, fiabilidad.
- ISO/IEC 25000 SQuaRE: calidad de producto.
- ISO 9001: trazabilidad y control documental.
- ISO/IEC 5055: prevención de defectos estructurales.
- ISO/IEC 15504 SPICE: proceso incremental verificable.
- ISO 27001: no afectar auth/session/security.
- ISO/IEC 14598: evaluación de producto por evidencia.

## 12. Reglas de implementación posteriores

Para los próximos PRs de producto/UX dashboard:

- Una rama por PR.
- No push directo a main.
- No mergear con checks rojos.
- No modificar backend/API/auth/DB/deps/lockfiles/CI salvo orden explícita.
- Usar PowerShell.
- Usar PNPM vía Corepack.
- Ejecutar desde `frontend`:
  - `corepack pnpm lint`
  - `corepack pnpm typecheck`
  - `corepack pnpm build`
- Si se toca comportamiento no-scroll, correr E2E específico.
- Usar `gh pr checks --watch` sin pasar número de PR.
- Al cerrar PR, limpiar main y verificar:
  - `git checkout main`
  - `git pull --ff-only`
  - `git fetch --prune`
  - `git status --short`
  - `git log -1 --oneline`
  - `gh pr list --state open`
  - `git branch -r --no-merged origin/main`
  - `git branch`

## 13. Decisión de PR-UX0

Este PR no implementa cambios visuales.

Decisión:

- Aprobado avanzar a PRs chicos posteriores.
- El primer PR posterior recomendado es `audit/dashboard-runtime-visual-evidence` si se quiere evidencia antes de tocar UI.
- Si se decide implementar directamente, el primer PR recomendado es `fix(admin-dashboard-hub-product-ux-density)` con alcance exclusivo en hub/inicio Admin.
