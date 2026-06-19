# Dashboard Mobile Whitebox Visual Audit

## Base

- Rama: `audit/dashboard-mobile-whitebox-visual`.
- Base esperada: `f7e67be docs(admin): close enterprise density audit block (#1054)`.
- Scope: auditoría visual/caja blanca mobile del dashboard.
- Tipo de cambio: documentación únicamente.
- Objetivo operativo: identificar errores mobile en Android/iOS y proponer PRs chicos para corregirlos sin mezclar producto, backend, auth ni dependencias.

## Evidencia visual recibida

Las capturas mobile muestran el dashboard en ancho aproximado de teléfono Android/iOS con fallas operativas severas:

- Header superior comprimido.
- Tabs horizontales truncadas.
- Cards de módulos superpuestas.
- Grilla de módulos demasiado densa para mobile.
- Tablas con overflow horizontal.
- Botones cortados.
- Paginadores pisando filas.
- Contenido inferior oculto por zona segura/barra inferior.
- Truncado excesivo de títulos y acciones.
- Layout operativo difícil o imposible de usar con una mano.

Aunque las capturas corresponden a Administración, el problema se clasifica como compartido porque el repo usa shell y componentes dashboard comunes también para Clínica.

## Mapa whitebox detectado

### Shell compartido

Archivos candidatos principales:

- `frontend/src/components/dashboard/PrivateDashboardShell.tsx`.
- `frontend/src/components/dashboard/DashboardTopbar.tsx`.
- `frontend/src/components/dashboard/DashboardHorizontalNav.tsx`.
- `frontend/src/components/dashboard/DashboardShellRouter.tsx`.
- `frontend/src/components/dashboard/DashboardPageHeader.tsx`.
- `frontend/src/components/dashboard/DashboardModuleHub.tsx`.
- `frontend/src/components/dashboard/DashboardHubHero.tsx`.
- `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx`.
- `frontend/src/components/dashboard/CompactPager.tsx`.
- `frontend/src/components/dashboard/ModuleSurface.tsx`.
- `frontend/src/components/dashboard/ModuleTabs.tsx`.
- `frontend/src/components/dashboard/FilterDrawer.tsx`.
- `frontend/src/components/dashboard/StickyActionBar.tsx`.
- `frontend/src/components/dashboard/StickyFilterBar.tsx`.
- `frontend/src/components/dashboard/MasterDetailWorkspace.tsx`.

### Dashboard Clínica

Archivos candidatos principales:

- `frontend/src/app/dashboard/page.tsx`.
- `frontend/src/app/dashboard/ClinicCommandCenter.tsx`.
- `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`.
- `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`.
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`.
- `frontend/src/components/dashboard/ClinicDashboardSidebar.tsx`.
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`.
- `frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`.
- `frontend/src/components/dashboard/PasswordChangePanel.tsx`.
- `frontend/src/components/dashboard/UploadReportModal.tsx`.
- `frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx`.

### Dashboard Admin afectado por shell compartido

Archivos candidatos principales:

- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`.
- `frontend/src/app/dashboard/admin/AdminCommandCenter.tsx`.
- `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx`.
- `frontend/src/app/dashboard/admin/AdminReportsCard.tsx`.
- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`.
- `frontend/src/app/dashboard/admin/AdminAuditCard.tsx`.
- `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx`.

### E2E/tests relacionados

El repo ya contiene tests dashboard, no-scroll, viewport y mobile, pero la evidencia visual demuestra que no bloquean este caso real de Android/iOS:

- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`.
- `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts`.
- `frontend/e2e/dashboard-single-viewport-app-shell.spec.ts`.
- `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`.
- `frontend/e2e/dashboard-workspace-layout-polish.spec.ts`.
- `frontend/e2e/dashboard-app-shell-visibility-contract.spec.ts`.
- `test/frontend-dashboard-mobile-polish-bottom-actions.test.ts`.
- `test/mobile-production-parity-invariants.test.ts`.
- `test/frontend-dashboard-clinic-command-center.test.ts`.
- `test/frontend-dashboard-clinic-tokens.test.ts`.
- `test/frontend-dashboard-informes.test.ts`.

## Hallazgos P1

### P1-1 — Hub de módulos no apto para mobile

Evidencia:

- En la captura de Resumen, las cards de módulos aparecen en grilla comprimida.
- Hay truncado agresivo: `Administrac`, `Subir...`, `Estado d...`, `Tokens...`, `Ver mant...`.
- Cards se superponen con contenido inferior de tokens/listas.

Riesgo:

- La navegación por módulos deja de ser confiable.
- El usuario toca cards parcialmente visibles o superpuestas.
- En Clínica ocurrirá lo mismo si el hub usa el mismo componente.

Archivos candidatos:

- `DashboardModuleHub.tsx`.
- `DashboardHubHero.tsx`.
- `ClinicCommandCenter.tsx`.
- `AdminCommandCenter.tsx`.
- `ClinicDashboardWorkspaceController.tsx`.
- `AdminDashboardWorkspaceController.tsx`.

Propuesta:

- Mobile no debe usar grilla de 3 columnas.
- Cambiar mobile a lista compacta de módulos o 1 columna.
- En `min-width >= 480px`, permitir 2 columnas.
- Mantener grilla premium solo en tablet/desktop.
- Evitar cards absolutas/flotantes que puedan superponerse.

### P1-2 — Navegación horizontal mobile inestable

Evidencia:

- Tabs cortadas: `Toker`.
- En Auditoría/Usuarios, la nav queda desplazada y se pierde el principio de la lista.
- Active tab no garantiza contexto completo.

Riesgo:

- Navegación confusa.
- Módulos críticos quedan ocultos fuera del viewport.
- En iOS/Android puede variar por ancho, zoom de fuente y safe area.

Archivos candidatos:

- `DashboardHorizontalNav.tsx`.
- `DashboardTopbar.tsx`.
- `PrivateDashboardShell.tsx`.
- `DashboardShellRouter.tsx`.

Propuesta:

- Nav mobile con labels cortas controladas:
  - `Inicio`
  - `Informes`
  - `Tokens`
  - `Perfil`
  - `Logística`
  - `Salir`
- Scroll horizontal solo dentro de nav, no documento.
- Active item debe auto-centrarse o permanecer visible.
- No truncar nombres críticos de forma ambigua.
- Evitar que la nav herede labels desktop.

### P1-3 — Header mobile consume demasiado ancho

Evidencia:

- Título `Administ...`.
- Subtítulo `Auditoría, repo...`.
- Botón `Cerrar sesión` ocupa demasiado espacio.
- Íconos de tema/notificaciones suman presión horizontal.

Riesgo:

- El header deja poco espacio a navegación y contenido.
- En Clínica el nombre de clínica puede ser largo y romper igual o peor.

Archivos candidatos:

- `DashboardTopbar.tsx`.
- `DashboardPageHeader.tsx`.
- `PrivateDashboardShell.tsx`.

Propuesta:

- Crear variante mobile del topbar.
- En mobile:
  - usar nombre corto o rol/surface corto;
  - mover logout a icon button o menú compacto;
  - ocultar subtítulo largo o mostrarlo en segunda línea con clamp controlado;
  - conservar accesibilidad con `aria-label`.
- Mantener botón textual grande solo en tablet/desktop.

### P1-4 — Tablas desktop renderizadas en mobile

Evidencia:

- En Clínicas, la tabla muestra columnas cortadas y overflow horizontal.
- Se ve `CLÍNICA`, `CONTACTO`, `USU...`, pero no toda la fila.
- La tabla obliga a desplazamiento horizontal o deja datos invisibles.

Riesgo:

- El usuario no puede operar filas completas.
- Acciones pueden quedar fuera del viewport.
- En Clínica, informes/tokens/perfil pueden sufrir el mismo patrón.

Archivos candidatos:

- `AdminClinicsManagementCard.tsx`.
- `AdminReportsCard.tsx`.
- `AdminParticularTokensCard.tsx`.
- `AdminAuditCard.tsx`.
- `AdminUsersRolesReadOnlyCard.tsx`.
- `ClinicParticularTokensCard.tsx`.
- `ClinicInformesWorkspaceSummary.tsx`.

Propuesta:

- En mobile, tablas deben transformarse en listas/cards compactas.
- No usar tabla horizontal para datos operativos críticos.
- Cada item mobile debe contener:
  - identificador principal;
  - metadata esencial;
  - estado;
  - acción principal visible.
- Mantener tablas solo desde breakpoint tablet/desktop.

### P1-5 — Acciones y toolbars cortadas

Evidencia:

- En Tokens, botón `Actualizar` queda cortado hacia la derecha.
- Filtros y tabs internas ocupan más ancho que el viewport.

Riesgo:

- Acciones críticas quedan inaccesibles.
- Mobile deja de ser operativo.

Archivos candidatos:

- `ClinicParticularTokensCard.tsx`.
- `AdminParticularTokensCard.tsx`.
- `AdminReportsCard.tsx`.
- `AdminClinicsManagementCard.tsx`.
- `StickyFilterBar.tsx`.
- `FilterDrawer.tsx`.

Propuesta:

- Toolbars mobile en 1 columna o 2 filas.
- Botón primario ancho completo o alineado en fila propia.
- Filtros secundarios en drawer.
- Nunca permitir que una acción principal quede fuera del viewport.

### P1-6 — Paginadores pisan contenido

Evidencia:

- En Auditoría, filas y paginador se pisan.
- Se ve contenido inferior parcialmente oculto.
- En Tokens se percibe corte inferior del pager.

Riesgo:

- El usuario no puede leer la última fila ni operar paginación con precisión.
- En Android/iOS puede empeorar por barra inferior/safe area.

Archivos candidatos:

- `CompactPager.tsx`.
- `AdminAuditCard.tsx`.
- `AdminParticularTokensCard.tsx`.
- `AdminReportsCard.tsx`.
- `ClinicParticularTokensCard.tsx`.
- `DashboardModuleWorkspace.tsx`.
- `ModuleSurface.tsx`.

Propuesta:

- Paginador debe ocupar una fila reservada dentro de la card.
- No usar overlay sobre lista.
- Lista debe calcular filas visibles según viewport.
- Agregar padding inferior con `env(safe-area-inset-bottom)` donde corresponda.
- Evitar `bottom-0` o `fixed` dentro de cards salvo contrato explícito.

### P1-7 — Falta contrato real Android/iOS

Evidencia:

- Hay tests de viewport/no-scroll/mobile, pero no detectaron estos errores visuales reales.
- Las capturas muestran fallos que deberían bloquear CI.

Riesgo:

- Regresiones mobile seguirán entrando aunque CI esté verde.
- Android/iOS quedan fuera del contrato operativo.

Archivos candidatos:

- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`.
- `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`.
- `frontend/e2e/dashboard-single-viewport-app-shell.spec.ts`.
- `test/mobile-production-parity-invariants.test.ts`.

Propuesta:

- Agregar contrato E2E mobile real con viewports:
  - `360x740`
  - `375x812`
  - `390x844`
  - `412x915`
  - `430x932`
- Validar:
  - document width <= viewport width;
  - ningún elemento interactivo crítico fuera del viewport;
  - nav activa visible;
  - sin superposición de cards;
  - pager no solapa última fila;
  - acciones principales visibles;
  - no horizontal scroll global;
  - safe area inferior respetada.

## Hallazgos P2

### P2-1 — Truncado excesivo de copy crítico

Evidencia:

- Títulos y acciones se cortan demasiado.
- Algunos labels quedan ambiguos.

Propuesta:

- Definir labels mobile cortos de forma manual.
- Evitar depender de `truncate` para elementos de navegación.
- Usar copy alternativo por breakpoint.

### P2-2 — Exceso de densidad visual en mobile

Evidencia:

- Mobile intenta replicar la densidad desktop.
- Hay demasiados badges, cards y métricas por pantalla.

Propuesta:

- Mobile debe priorizar tarea principal.
- Métricas secundarias deben compactarse o colapsarse.
- Filtros avanzados deben ir a drawer.

### P2-3 — Inconsistencia entre módulos

Evidencia:

- Informes se aproxima a lista mobile.
- Clínicas mantiene tabla.
- Tokens mezcla tabs, filtros, lista y botones en ancho insuficiente.
- Auditoría usa lista densa con pager conflictivo.

Propuesta:

- Crear contrato común de `MobileOperationalList`.
- No necesariamente componente nuevo al primer PR, pero sí patrón documentado:
  - header;
  - toolbar;
  - list rows;
  - pager reservado;
  - acción principal visible.

## Propuesta de PRs chicos

### PR Mobile-1 — auditoría + contrato E2E mobile

Scope:

- Documentar auditoría.
- Agregar E2E mobile que reproduzca fallos.
- No corregir producto todavía.

Objetivo:

- Convertir las capturas en contrato técnico.
- Hacer visible qué módulos fallan.

### PR Mobile-2 — shell mobile

Scope:

- `PrivateDashboardShell`.
- `DashboardTopbar`.
- `DashboardHorizontalNav`.
- `DashboardPageHeader`.
- Safe area / `100dvh`.

Objetivo:

- Header y nav usables en Android/iOS.
- Sin overflow horizontal global.

### PR Mobile-3 — hub mobile

Scope:

- `DashboardModuleHub`.
- `DashboardHubHero`.
- `ClinicCommandCenter`.
- `AdminCommandCenter` si comparte patrón.

Objetivo:

- No superposición.
- Lista o 1 columna mobile.
- Cards tocables y legibles.

### PR Mobile-4 — listas mobile por módulo Clínica

Scope:

- `ClinicParticularTokensCard`.
- `ClinicInformesWorkspaceSummary`.
- `ClinicLogisticaWorkspaceSummary`.
- `ClinicPublicProfileCard`.
- `PasswordChangePanel` si aplica.

Objetivo:

- Clínica operativo en mobile.

### PR Mobile-5 — admin module parity

Scope:

- Solo si después de arreglar shell/hub quedan fallos Admin.
- Cards Admin de Clínicas/Tokens/Auditoría/Usuarios.

Objetivo:

- Admin no vuelve a romper mobile.

## Criterios de aceptación final

Para Android/iOS:

- No horizontal scroll global.
- Header usable.
- Tabs visibles y navegables.
- Módulo activo claro.
- Ningún botón principal cortado.
- Ninguna card superpuesta.
- Ninguna tabla desktop en mobile.
- Paginador no pisa contenido.
- Safe area inferior respetada.
- Operable con una mano en 360px de ancho.
- E2E mobile bloquea regresión.

## Recomendación

El primer cambio debe ser documental + E2E. No conviene empezar compactando al azar porque las capturas muestran fallas de arquitectura responsive compartida.
