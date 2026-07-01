# VETNEB Enterprise Operational Platform — Extreme Excellence Advisory

> **PR-ENT-0 — Enterprise advisory + operational model (docs-only).**
> Documento de auditoría/asesoría estratégica. No implementa código.

---

## 1. Estado base

| Campo | Valor |
|---|---|
| Fecha del documento | 2026-07-01 |
| Repositorio | Portal VETNEB (`C:\PORTAL-VETNEB`) |
| Rama base esperada | `main` |
| Rama de este PR | `docs/vetneb-enterprise-operational-platform-advisory` |
| HEAD base auditado | `0aad5c0 ci: add manual visual regression workflow (#1209)` |
| Alcance | **Docs-only.** Un único archivo Markdown. |
| Cambios de código | **Ninguno.** No toca frontend/src, backend, API, auth, DB, migrations, deps, lockfiles, snapshots, CI, workflows ni tests. |

**Relación con auditorías previas.** Este documento consolida y eleva la serie:

1. *Auditoría Zero-Scroll Adaptive Dashboard (global)* — diagnóstico de cardinalidad fija, `matchMedia` como fuente de cardinalidad, dualidad desktop/mobile en Admin, scroll interno rígido en master-detail.
2. *Dossier PR-PILOT-1 (Clínica · Tokens)* — especificación del primer PR de código (hook `useAdaptiveRowsPerPage` + token `--dash-row-h`).
3. *Enterprise Advisory (asesoría de producto)* — reencuadre de VETNEB como plataforma operacional.

**Relación con PRs:**

- **PR-ENT-0 (este documento):** gobernanza y modelo operacional. Docs-only.
- **PR-GLOBAL-0:** matriz global Zero-Scroll (documental). Complementario, puede fusionarse o quedar separado.
- **PR-PILOT-1 (futuro, primer código):** hook adaptativo + token + Clínica Tokens. Depende de la aprobación de esta visión.

Este PR **no habilita ejecución de código**: fija el contrato conceptual sobre el que se ejecutarán los PRs posteriores.

---

## 2. Resumen ejecutivo extremo

VETNEB está en un **punto de inflexión ventajoso y poco común**: su backend ya expone las primitivas de una plataforma operacional (auditoría, notificaciones tri-rol, tracking/timeline, health, sesiones, roles, pricing, clínicas, informes, tokens), pero su frontend las presenta como **pantallas-tabla aisladas**.

- **No alcanza con corregir scroll.** El scroll/gap/clipping es el síntoma; la causa es que la unidad de interacción es "la página", no "la entidad y su acción".
- **No se trata de agregar botones.** Más acciones sueltas aumentan el ruido sin aumentar la capacidad operativa. El valor está en un **sistema** de entidades, estados y acciones.
- **El backend ya permite plataforma operacional.** Las capacidades de trazabilidad, alertas y estado ya existen como datos; falta componerlas.
- **El salto está en frontend:** composición, arquitectura de interacción, jerarquía visual, workflows por rol y gobernanza.
- **Tres abstracciones centrales** convierten features sueltos en plataforma:
  1. **Entity model** — clínica/informe/token/sesión/usuario/caso/particular como entidades de primera clase.
  2. **Action Graph** — acciones declarativas por entidad × estado × rol, con permisos y auditoría centralizados.
  3. **Adaptive contract** — Zero-Scroll + cardinalidad medida como sustrato universal.

Con esas tres piezas, Command Center, Work Queues, Entity 360, Alert Intelligence, Audit Inspector y Timeline se vuelven **composición reutilizable, en su mayoría frontend-only sobre endpoints ya existentes**. El riesgo se concentra y se difiere: servidor-admin (PR-SRV-0), y bulk/export/search-global/SLA (backend, **NO CONFIRMADO**).

---

## 3. North Star de VETNEB

> **Frase rectora:** *VETNEB debe operar como un centro de comando clínico-administrativo — un sistema donde cada entidad tiene identidad, estado, historial y acciones — no como una colección de pantallas.*

- **Qué lo separa de un portal web común:** el portal muestra datos; la plataforma **conduce trabajo** — sabe qué requiere atención, quién puede actuar, qué pasó antes y qué sigue.
- **Qué lo separa de una tabla administrativa:** la tabla lista registros; la plataforma **modela entidades con ciclo de vida** (estados, timeline, acciones auditables, alertas vinculadas).
- **Qué lo convierte en software operacional:** la unidad de interacción deja de ser "la página" y pasa a ser "la entidad y su acción", accesible desde cualquier vista (tabla, queue, palette, 360, timeline).

**Principios rectores (invariantes de producto):**

| Dominio | Principio |
|---|---|
| **Módulo** | Un solo contrato: shell medido → región adaptativa → pager derivado. Cero cardinalidad fija como verdad. |
| **Pantalla** | Zero-scroll real, densidad tokenizada, jerarquía por prioridad/estado, cada pixel con función. |
| **Acción** | Declarativa, filtrada por rol, auditable si es sensible, con feedback y confirmación destructiva. |
| **Evento** | Todo cambio de estado deja rastro; la trazabilidad es un atributo de la entidad, no un módulo. |
| **Seguridad** | El permiso se evalúa en un solo lugar (`useActionPermissions`); ninguna vista expone acciones fuera de rol. |
| **Consistencia multi-rol** | Admin, Clínica y Particular comparten lenguaje visual y de estados; difieren en foco, no en calidad. |

---

## 4. Modelo operacional por capas

Cinco capas que convierten features sueltos en sistema.

### Capa 1 — Entidades

| Entidad | Qué resuelve | Aporta | Conexión existente | Falta | Prioridad |
|---|---|---|---|---|---|
| Clínica | Identidad de la organización | Clinic 360, gestión multi-clínica | `getAdminClinics` | `EntityDescriptor` (frontend) | Alta |
| Usuario | Actor con rol | Roles, auditoría por actor | `getAdminUsersRoles` | descriptor+permisos | Alta |
| Informe | Unidad de trabajo clínico | Work queue, 360, acciones | `getReports*`, `getReport*Url` | descriptor | Alta |
| Token | Acceso particular | 360, reenvío, estado | `get*ParticularTokens` | descriptor | Alta |
| Sesión | Actividad autenticada | Seguridad, Session 360 | `getAdminSessions`, `getClinicSession` | descriptor | Media |
| Evento de auditoría | Rastro de cambio | Inspector, evidencia | `getAuditEntries`, `AdminAuditSnapshot` | correlación entidad↔evento | Alta |
| Caso / tracking | Ciclo de vida del estudio | Timeline, estado | `get*StudyTrackingCases` | descriptor | Alta |
| Particular | Destinatario del informe | Vista premium, timeline simple | `getParticularSession`, `getParticularStudyTrackingCase` | descriptor | Media |
| Alerta | Señal accionable | Alert Center | notificaciones tri-rol, `getAdminFailedLoginAlerts` | severidad/deduplicación (frontend) | Alta |
| Tarea operativa | Trabajo pendiente | Work queue, home por rol | inferible de estados existentes | modelo de tarea (**NO CONFIRMADO** que exista como entidad) | Media |

### Capa 2 — Estados

| Estado | Situación | Fuente |
|---|---|---|
| pendiente | Existe (tracking `reception`) | inferible de tracking |
| activo | Existe (`isActive` tokens) | dato directo |
| en proceso | Existe (`processing/evaluation/report_development`) | tracking stages |
| completado | Existe (`delivered`) | tracking |
| **vencido** | **NO CONFIRMADO** — requiere deadlines/SLA | backend |
| bloqueado | **NO CONFIRMADO** | por verificar |
| requiere acción | Inferible (pendiente + rol) | composición frontend |
| riesgo | Inferible (failed-logins, sesión sospechosa) | composición |
| error | Existe (`ErrorState`, report workflow) | dato/estado |
| auditado | Existe (evento de auditoría) | `getAuditEntries` |

- **Existentes / inferibles frontend:** pendiente, activo, en-proceso, completado, requiere-acción, riesgo, error, auditado.
- **Requieren backend / NO CONFIRMADO:** vencido, próximo-a-vencer, bloqueado (dependen de deadlines/SLA no confirmados).

### Capa 3 — Acciones

`ver · abrir-detalle · copiar · descargar · reenviar · generar · subir · revisar · exportar · auditar · resolver · marcar · navegar-a-relacionada`

- **Por qué declarativas:** una acción definida una vez (id, label, icono, permiso, handler, auditable?) se reutiliza en tabla, 360, palette y queue sin duplicar JSX.
- **Por qué por entidad × rol × estado:** "reenviar token" sólo aplica a un token activo y a un rol autorizado; el registro codifica esa validez en un solo lugar.
- **Por qué auditar sensibles:** reenviar, eliminar, exportar y operaciones masivas deben dejar rastro (la auditoría ya existe como backend) — es requisito de gobernanza, no opción.

### Capa 4 — Vistas

`command-center · work-queue · tabla/lista-adaptativa · timeline · inspector · detalle · health-panel · alert-center`

Cada vista es una **composición de las capas 1–3**: la misma entidad se presenta en tabla, queue, 360 o timeline — mismos datos, distinto lente. Base existente: `ModuleSurface`, `ModuleTabs`, `MasterDetailWorkspace`, `StudyTimeline`, `AdminAuditCard`.

### Capa 5 — Gobernanza

`permisos-por-rol · auditoría-de-acción-sensible · confirmaciones · rollback · visual-regression · e2e-no-scroll/no-gap · docs-por-PR · closeout-por-bloque`

Base existente: auditoría backend, suite e2e, visual regression manual (#1205–1209), source-contract tests, precedente de docs por PR (`docs/implementation/`). Falta: `useActionPermissions` central y gate progresivo de e2e/visual.

---

## 5. Contrato adaptativo como prerequisito

**Sin este contrato, toda herramienta nueva hereda gap muerto, clipping o scroll accidental.** Es el sustrato de todo lo demás.

| Pieza | Definición | Estado |
|---|---|---|
| Zero-Scroll Adaptive Dashboard | Shell viewport-fitted (`h-dvh overflow-hidden`) + cadena `min-h-0` + densidad fluida | **Ya resuelto** (auditorías previas) |
| Cardinalidad medida | Nº de filas/cards derivado de la altura real del contenedor | **Falta** |
| `useAdaptiveItemsPerPage` | Hook: mide contenedor → `itemsPerPage` (genérico de `useAdaptiveRowsPerPage`) | Falta (PR-CORE-1) |
| `AdaptivePaginatedRegion` | Primitiva body+región+pager | Falta (PR-CORE-2) |
| `--dash-row-h` | Token de altura de fila/card integrado a la densidad existente | Falta (PR-PILOT-1) |
| Eliminar `PAGE_SIZE` como verdad | La constante pasa a **fallback**, no gobierna cardinalidad | Falta |
| Eliminar `MOBILE_PAGE_SIZE` | Cero cardinalidad por dispositivo | Falta (PR-CLEAN-1) |
| Eliminar `matchMedia` de cardinalidad | `matchMedia` sólo puede elegir variante de presentación (tabla vs cards), nunca cuántos ítems | Falta |
| pageSize fijo como fallback | Único rol legítimo de la constante | Contrato |

**Estrategia cliente:** `itemsPerPage` derivado → `usePagedRows(items, itemsPerPage)` (ya clampa `currentPage`). Fallback fijo inicial. Sin red.

**Estrategia servidor:** requiere decisión formal (PR-SRV-0) entre over-fetch de superset, re-fetch con `limit` derivado (debounced), o híbrido. **Bloqueo previo obligatorio para cualquier módulo Admin de servidor.**

---

## 6. Propuestas enterprise extremas

Tipo: **QW** frontend-only · **H** hybrid · **BR** backend-required · **ST** estratégico futuro.

### 6.1 Enterprise Command Center
- **Qué:** centro de *prioridades* (qué requiere atención / vencido / cambió / riesgo / acciones rápidas), no un launcher de módulos.
- **Rol:** Admin y Clínica. **Problema:** el operador no sabe "qué hacer hoy". **Valor:** reduce time-to-action.
- **Tipo:** QW. **Base:** `getDashboardStats`, `getDashboardNotifications`, `getAdminSystemHealth`, tracking. **Dep.:** adaptive contract. **Riesgo:** P2 (agregación multi-fuente). **Prioridad:** Alta. **PR:** CLINIC-4 / ADMIN-6. **Validación:** e2e no-scroll + estados parciales.

### 6.2 Operational Work Queues
- **Qué:** bandejas por estado (informes pendientes/cargados, tokens activos, sesiones recientes, alertas) como unidad de trabajo.
- **Rol:** Admin/Clínica. **Problema:** el estado se busca a mano en tablas genéricas. **Valor:** menos búsqueda manual.
- **Tipo:** H. **Base:** reports/tracking/sessions. **Dep.:** adaptive+registry. **Riesgo:** P2. **Prioridad:** Alta. **PR:** OPS-3/4. **Validación:** e2e rows-variable + filtro por estado.

### 6.3 Entity 360° View
- **Qué:** vista unificada por entidad (datos + timeline + acciones + auditoría + alertas + estado).
- **Rol:** Admin/Clínica. **Problema:** data dispersa entre módulos. **Valor:** ≤1 vista por tarea.
- **Tipo:** QW/H. **Base:** endpoints por entidad + `StudyTimeline`. **Dep.:** registry+timeline. **Riesgo:** P2. **Prioridad:** Alta. **PR:** OPS-6+. **Validación:** e2e 360 + correlación.

### 6.4 Action Graph / Action Registry
- **Qué:** acciones declarativas por entidad × rol × estado, auditables — elimina botones aislados.
- **Rol:** todos. **Problema:** acciones dispersas y duplicadas. **Valor:** reutilización + seguridad centralizada.
- **Tipo:** QW. **Base:** endpoints de acción existentes. **Dep.:** permisos. **Riesgo:** P2 (registro) / P1 (permisos). **Prioridad:** Alta. **PR:** CORE-4. **Validación:** test por rol.

### 6.5 Smart Command Palette
- **Qué:** buscar + navegar + **accionar** + abrir entidad + iniciar flujo + saltar a saved view.
- **Rol:** Admin (10 módulos) y Clínica. **Problema:** navegación lenta para power-users. **Valor:** velocidad enterprise.
- **Tipo:** QW→H. **Base:** `searchReports*`, módulos. **Dep.:** registry+permisos. **Riesgo:** P2. **Prioridad:** Media-Alta. **PR:** OPS-1. **Validación:** navegación + no exponer acción sin permiso. **NO CONFIRMADO:** search global cross-entity.

### 6.6 Saved Views 2.0
- **Qué:** vistas por rol / sugeridas / de-riesgo / recientes; compartibles a futuro.
- **Rol:** Admin/Clínica. **Problema:** re-filtrado manual. **Valor:** operación repetible.
- **Tipo:** QW→BR. **Base:** filtros existentes. **Dep.:** localStorage (fase 1). **Riesgo:** P2. **Prioridad:** Media. **PR:** OPS-2. **Validación:** persistencia local. *Guarda filtros, nunca `itemsPerPage`.*

### 6.7 Alert Intelligence
- **Qué:** severidad + deduplicación + agrupación + acción sugerida + entidad vinculada + estado de resolución.
- **Rol:** Admin (seguridad) / Clínica (operativo). **Problema:** el bell actual es puntual. **Valor:** priorización.
- **Tipo:** QW. **Base:** `getDashboardNotifications`, `DashboardNotificationsBell`, `getAdminFailedLoginAlerts`. **Dep.:** ninguna dura. **Riesgo:** P2. **Prioridad:** Alta. **PR:** OPS-5. **Validación:** niveles de severidad. **NO CONFIRMADO:** "tokens por vencer".

### 6.8 Timeline / Evidence Center
- **Qué:** correlación temporal de eventos/auditoría/accesos/descargas por entidad.
- **Rol:** todos. **Problema:** trazabilidad en datos pero no compuesta. **Valor:** evidencia legal/operativa.
- **Tipo:** QW. **Base:** `StudyTimeline`, tracking, `getAuditEntries`. **Dep.:** `useEntityTimeline`. **Riesgo:** P2. **Prioridad:** Media-Alta. **PR:** OPS-6. **Validación:** correlación entidad↔eventos. **NO CONFIRMADO:** granularidad de acceso/descarga en auditoría.

### 6.9 Audit Inspector Enterprise
- **Qué:** de tabla de auditoría a herramienta de investigación (actor/entidad/severidad/correlación/snapshot).
- **Rol:** Admin. **Problema:** hoy es tabla densa. **Valor:** confianza institucional (SIEM-lite).
- **Tipo:** QW. **Base:** `getAuditEntries`, `AdminAuditSnapshot`, `AdminAuditCard/DenseTable/DetailDialog/FilterBar`. **Dep.:** ninguna dura. **Riesgo:** P2. **Prioridad:** Media-Alta. **PR:** ADMIN-5. **Validación:** filtros + no-scroll + detalle. **NO CONFIRMADO:** snapshot antes/después.

### 6.10 Operational Health / Release Confidence
- **Qué:** salud sistema+schema+tests+visual-regression+último-deploy+riesgos.
- **Rol:** Admin. **Problema:** health disperso. **Valor:** observabilidad.
- **Tipo:** QW/H. **Base:** `getAdminSystemHealth`, `getAdminSchemaHealth`, `AdminSchemaHealthStatusCard`. **Dep.:** ninguna dura. **Riesgo:** P2. **Prioridad:** Media. **PR:** ADMIN-6. **Validación:** estados degradados. **NO CONFIRMADO:** estado de deploy, jobs, latencia.

### 6.11 Layout Intelligence / Dashboard Telemetry
- **Qué:** dev-tool que detecta scroll/clipping/gap, mide filas/viewport, exporta evidencia QA.
- **Rol:** dev/QA. **Problema:** no hay telemetría de layout (**NO CONFIRMADO**). **Valor:** diagnóstico objetivo del contrato.
- **Tipo:** QW. **Dep.:** ninguna. **Riesgo:** P3. **Prioridad:** Media (habilitador de métricas). **PR:** opcional/QA. **Validación:** detecta scroll/gap conocidos.

### 6.12 Guided Workflows
- **Qué:** flujos guiados (subir informe, generar token, revisar sesión sospechosa, investigar auditoría, resolver alerta).
- **Rol:** Admin/Clínica. **Problema:** flujos multi-paso sin guía unificada. **Valor:** menos errores, onboarding.
- **Tipo:** QW/H. **Base:** alta de token multi-step ya existe como patrón. **Dep.:** registry. **Riesgo:** P2. **Prioridad:** Media. **PR:** por flujo. **Validación:** e2e del flujo.

### 6.13 Smart Empty States
- **Qué:** distingue sin-datos / sin-permisos / error / filtro-vacío + acción sugerida + link a paso siguiente.
- **Rol:** todos. **Problema:** vacío decorativo → tickets de soporte. **Valor:** menos soporte, percepción premium.
- **Tipo:** QW. **Base:** `EmptyState`, `ErrorState`, `LoadingState`. **Dep.:** ninguna. **Riesgo:** P3. **Prioridad:** Media. **PR:** CLINIC-5. **Validación:** e2e de 3 tipos + geometría estable.

### 6.14 Role-Based Home
- **Qué:** inicio distinto por rol (Admin=riesgo/control, Clínica=operación diaria, Particular=claridad).
- **Rol:** todos. **Problema:** hub genérico. **Valor:** foco inmediato por rol.
- **Tipo:** QW. **Base:** sidebars por rol. **Dep.:** Command Center. **Riesgo:** P2. **Prioridad:** Media. **PR:** por rol. **Validación:** e2e no-scroll por rol.

### 6.15 Enterprise Visual System
- **Qué:** densidad + jerarquía + estado + calma + consistencia multi-rol + cero-scroll.
- **Rol:** todos. **Problema:** contratos visuales divergentes, riesgo de off-token. **Valor:** marca única premium.
- **Tipo:** QW. **Base:** capa `--dash-*`. **Dep.:** adaptive contract. **Riesgo:** P2. **Prioridad:** Alta. **PR:** CORE-6+. **Validación:** grep off-token + e2e visual.

**Las 3 palancas multiplicadoras:** 6.4 (Action Graph), 6.3 (Entity 360) y 6.15 (Visual System) sobre el adaptive contract. Sin ellas, 6.1/6.2/6.5/6.7/6.8/6.9 se construyen frágiles y duplicados.

---

## 7. Diseño por rol

### 7.1 Admin Enterprise — Control Plane

| Eje | Propuesta | Base | Tipo |
|---|---|---|---|
| Home | Command Center de riesgo (alertas críticas, sesiones sospechosas, informes atascados, health) | stats/notif/health | QW |
| Seguridad | Alert Intelligence + Session 360 (login-fallido↔sesión↔auditoría) | failed-logins+sessions+audit | QW |
| Auditoría / Investigación | Audit Inspector Enterprise | `getAuditEntries` | QW |
| Sesiones | Session 360 + adaptive | `getAdminSessions` | H |
| Clínicas | Clinic 360 (datos+usuarios+informes+tokens+actividad) | `getAdminClinics`+relacionados | QW/H |
| Roles | Users/Roles adaptive + acciones | `getAdminUsersRoles` | H |
| Informes | Work Queue por estado + Report 360 | reports | H |
| Tokens | Token 360 + acciones | `getAdminParticularTokens` | H |
| Health | Operational Health / Release Confidence | health endpoints | QW/H |
| Exportación futura | Export Center | — | BR |
| Acciones masivas futuras | Bulk Actions | — | BR |

**Mejora estructural crítica:** colapsar la dualidad `AdminXxxReadOnlyCard` (desktop, servidor) + `AdminMobileXxxModule` (mobile, `PAGE_SIZE` propio) en una vista única medida. Es la mayor deuda estructural del sistema.

### 7.2 Clínica Enterprise — Daily Operation Cockpit

| Eje | Propuesta | Base | Tipo |
|---|---|---|---|
| Home | Clinic Command Center (informes del día, tokens activos, casos en proceso, tareas) | stats/tracking/notif | QW |
| Informes | Work Queue por estado + Report 360 + quick actions (descargar/preview/copiar) | reports+`getReport*Url` | QW |
| Tokens | Piloto adaptativo (PR-PILOT-1) + `EntityActionMenu` (reenviar/copiar/detalle) + Token 360 | tokens+tracking | QW |
| Casos / tracking | Timeline de caso (stages + tinción especial) | `getClinicStudyTrackingCases`+`StudyTimeline` | QW |
| Logística | Workspace sin scroll rígido (`calc(100vh-13rem)`→`dvh`, cardinalidad) | logistics endpoints | QW |
| Tareas pendientes | Work Queue de pendientes | tracking/estados | QW |
| Quick actions | `EntityActionMenu` por fila | endpoints existentes | QW |
| Saved views | "Pendientes de hoy", "Tokens activos" | localStorage | QW |
| Guided empty states | Estados accionables | `EmptyState` | QW |

### 7.3 Particular Premium — Trust & Clarity

**Detail-only, no paginado.** Vive en la ruta pública `/particulares` (token-gated), no en `/dashboard`.

| Eje | Propuesta | Base | Tipo |
|---|---|---|---|
| Viewport-fit / no-scroll | `100dvh` + safe-area | shell contract | QW |
| Estado visible | Estado de sesión/informe | `getParticularSession` | QW |
| Informe claro | Report action panel (preview/descarga, touch targets) | `getParticularReport*Url` | QW |
| Timeline simple | Timeline del caso | `getParticularStudyTrackingCase` | QW |
| Experiencia móvil | Polish real iOS/Android (barra dinámica, orientación) | — | QW |
| Confianza institucional | Visual consistente con dashboard | visual system | QW |

---

## 8. Excelencia visual extrema

| Principio | Cómo se aplica | Módulos | Riesgo | Validación |
|---|---|---|---|---|
| 1. Visual hierarchy | Prioridad>estado>foco; crítico rompe la calma, info no | Command/Alert Center | P3 | heurística |
| 2. Spatial economy | Cardinalidad medida elimina gap; cada pixel con función | todos paginados | P1 | e2e no-gap |
| 3. Calm enterprise UI | Sobrio, institucional, microinteracciones discretas, reduced-motion respetado | global | P3 | reduced-motion e2e |
| 4. Data density | `--dash-row-h` + modo compacto/cómodo explícito | tablas/listas | P2 | token≈fila real |
| 5. Semantic status system | `OperationalStatusBadge` único (color+icono+severidad) | todos | P3 | mapeo estado→badge |
| 6. Action clarity | Primaria/secundaria/destructiva; disabled con razón; loading de acción | acciones | P2 | e2e feedback |
| 7. State design | loading estable, empty accionable, error recuperable, no-permissions, partial/stale | todos | P2 | 5 estados e2e |
| 8. Mobile real | `100dvh`, safe-area, touch ≥44px, orientación, sin scroll accidental | Particular+shell | P2 | device real |

**Regla transversal:** ningún cambio visual "grande" sin (a) baseline visual regenerado con autorización y (b) e2e no-scroll verde. La calidad visual se **mide**, no se opina.

---

## 9. Excelencia estructural extrema

| Elemento | Propósito | Deuda que elimina | Dónde | Dep. | Riesgo | PR | Prueba |
|---|---|---|---|---|---|---|---|
| `useAdaptiveItemsPerPage` | Cardinalidad medida | 15+ `PAGE_SIZE` | todos paginados | — | P2 | CORE-1 | unit + e2e rows |
| `AdaptivePaginatedRegion` | Composición body+región+pager | markup repetido | módulos | CORE-1 | P2 | CORE-2 | e2e no-scroll |
| `AdaptiveModuleSurface` | Módulo base medido | cadenas flex ad-hoc | módulos | CORE-2 | P2 | CORE-2 | e2e |
| `DashboardModuleRegistry` | Módulos declarativos | 3 sidebars hardcoded + dualidad | sidebars/palette | — | P2 | CORE-3 | source-contract |
| `DashboardActionRegistry` | Acciones como datos | botones dispersos | quick/bulk/palette/360 | — | P2 | CORE-4 | registro tests |
| `EntityActionRegistry` | Acciones por entidad | acoplamiento módulo↔acción | 360/tablas | ActionRegistry | P2 | CORE-4 | tests |
| `useActionPermissions` | Gate único por rol | checks dispersos, fuga de acción | todas las acciones | Registry | **P1** | CORE-4 | test por rol |
| `EntityActionMenu` | Menú contextual sin saturar | kebabs ad-hoc | tablas/listas/360 | Registry | P2 | CORE-5 | e2e menú |
| `SmartFilterBar` | Filtros medidos+persistibles | variantes de `FilterBar` | todos | — | P2 | CORE-6 | e2e filtros |
| `OperationalStatusBadge` | Estado semántico único | badges ad-hoc | todos | — | P3 | CORE-6 | mapeo |
| `SavedViewSelector` | Selección de vistas | re-filtrado manual | queues/tablas | `useSavedViews` | P2 | OPS-2 | persistencia |
| `WorkQueueView` | Bandeja por estado | tablas genéricas | admin/clínica | Adaptive+Registry | P2 | OPS-3/4 | e2e queue |
| `Entity360Panel` | Vista unificada por entidad | data dispersa | admin/clínica | Registry+Timeline | P2 | OPS-6+ | e2e 360 |
| `ActivityTimelinePanel` | Trazabilidad visual | — | admin/clínica/part. | `useEntityTimeline` | P2 | OPS-6 | e2e timeline |
| `AlertCenterPanel` | Alertas por severidad | bell puntual | admin/clínica | notif | P2 | OPS-5 | e2e severidad |
| `AuditInspectorPanel` | Investigación | tabla densa | admin | `getAuditEntries` | P2 | ADMIN-5 | e2e filtros |
| `OperationalHealthPanel` | Observabilidad | health disperso | admin | health | P2 | ADMIN-6 | estados degradados |
| `CommandPalette` | Navegación+acción pro | navegación lenta | shell | Registry+permisos | P2 | OPS-1 | axe + permisos |
| `KeyboardShortcutProvider` | Atajos operativos | listeners ad-hoc | shell | — | P2 | OPS-1 | axe |
| `LayoutTelemetryProvider` | Diagnóstico adaptativo (dev) | debug ad-hoc | dev | — | P3 | opcional | detecta scroll/gap |
| `EnterpriseEmptyState` | Estados accionables | vacío decorativo | todos | — | P3 | CLINIC-5 | 3 tipos |
| `ActionFeedbackToast` | Feedback de acción | alerts inline dispersos | acciones | — | P3 | CORE-5 | e2e feedback |

**Anti-sobreingeniería:** los registries se introducen **cuando el 2.º–3.er consumidor lo justifica**, no antes. El piloto (PR-PILOT-1) NO usa registries; llegan en Wave 2, cuando hay ≥2 módulos migrados que los amortizan.

---

## 10. Scoring y priorización

**Variables (1-5):** VE=valor empresarial · IV=impacto visual · IO=impacto operativo · BD=dependencia backend (5=frontend-only) · RT=riesgo técnico (5=bajo riesgo) · RU=reutilización · CO=cobertura e2e actual · RB=facilidad rollback · UR=urgencia · ZS=alineación zero-scroll. **Σ máx 50.**

| Propuesta | VE | IV | IO | BD | RT | RU | CO | RB | UR | ZS | Σ |
|---|--|--|--|--|--|--|--|--|--|--|--|
| Adaptive contract (hook+region) | 5 | 5 | 4 | 5 | 4 | 5 | 4 | 5 | 5 | 5 | **47** |
| Visual System (densidad/badges) | 4 | 5 | 3 | 5 | 4 | 5 | 3 | 4 | 3 | 5 | **41** |
| Alert Intelligence | 4 | 4 | 5 | 5 | 4 | 4 | 3 | 4 | 4 | 4 | **41** |
| Entity 360 | 5 | 4 | 5 | 4 | 3 | 5 | 2 | 4 | 4 | 4 | **40** |
| Command Center (por rol) | 5 | 5 | 4 | 5 | 3 | 3 | 3 | 4 | 4 | 4 | **40** |
| Action Registry + permisos | 5 | 3 | 5 | 5 | 3 | 5 | 2 | 4 | 4 | 3 | **39** |
| Activity/Evidence Timeline | 4 | 4 | 4 | 5 | 4 | 4 | 3 | 4 | 3 | 4 | **39** |
| Smart Empty States | 3 | 4 | 3 | 5 | 5 | 4 | 3 | 5 | 3 | 4 | **39** |
| Audit Inspector | 4 | 4 | 4 | 5 | 4 | 3 | 3 | 4 | 3 | 4 | **38** |
| Work Queues | 5 | 4 | 5 | 3 | 3 | 4 | 2 | 4 | 4 | 4 | **38** |
| Layout Telemetry (dev) | 3 | 2 | 3 | 5 | 5 | 4 | 2 | 5 | 2 | 5 | **36** |
| Command Palette | 3 | 3 | 5 | 4 | 3 | 4 | 2 | 5 | 3 | 3 | **35** |
| Operational Health Panel | 4 | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 3 | 4 | **35** |
| Saved Views 2.0 | 3 | 2 | 4 | 4 | 4 | 3 | 2 | 5 | 3 | 3 | **33** |
| Global Search (backend) | 4 | 2 | 4 | 2 | 3 | 3 | 1 | 4 | 2 | 2 | **27** |
| SLA con deadlines | 4 | 3 | 4 | 1 | 3 | 3 | 1 | 3 | 2 | 2 | **26** |
| Export Center | 3 | 2 | 3 | 2 | 3 | 3 | 1 | 3 | 2 | 2 | **24** |
| Bulk Actions | 3 | 2 | 4 | 1 | 2 | 3 | 1 | 2 | 2 | 2 | **22** |

- **Top 10 por ROI:** Adaptive contract (47) · Visual System (41) · Alert Intelligence (41) · Entity 360 (40) · Command Center (40) · Action Registry+permisos (39) · Timeline (39) · Empty States (39) · Audit Inspector (38) · Work Queues (38).
- **Top 10 excelencia visual:** Adaptive contract · Visual System · Command Center · Entity 360 · Alert Center · Audit Inspector · Timeline · Empty States · Work Queues · Particular polish.
- **Top 10 excelencia estructural:** Adaptive contract · Action Registry+permisos · Module Registry · Entity 360 · SmartFilterBar · EntityActionMenu · AdaptivePaginatedRegion · OperationalStatusBadge · useSavedViews · LayoutTelemetry.
- **Top 10 quick wins frontend-only:** Alert Center · Timeline · Audit Inspector · Command Center · Entity 360 (fase 1) · Empty States · Visual System/badges · Layout Telemetry · Palette (fase 1) · Health panel.
- **Top 10 backend-required:** Bulk · Export cross-entity · Global Search · SLA deadlines · Saved Views persist · Personalization persist · tokens-por-vencer · deploy status · jobs/latencia health · before/after audit snapshot.
- **Top 10 que NO conviene aún:** Bulk (22) · Export cross-entity (24) · SLA deadlines (26) · Global Search backend (27) · Saved Views backend · Personalization backend · admin-server antes de PR-SRV-0 · gate e2e prematuro · gate visual regression prematuro · compartir saved views.

---

## 11. Roadmap por oleadas

| Wave | Objetivo / Outcome | PRs | Dep. | Riesgo | Evidencia | Criterio de salida |
|---|---|---|---|---|---|---|
| **0 — Governance** | Alinear visión y contrato | PR-ENT-0 (este doc), PR-GLOBAL-0 (matriz) | — | P3 | docs | Aprobados por Nico |
| **1 — Adaptive foundation** | Cardinalidad medida reutilizable | PR-PILOT-1, PR-PILOT-2, PR-CORE-1, PR-CORE-2 | W0 | P1 | e2e rows-variable | Tokens adaptativo + hook/region reutilizables |
| **2 — Core architecture** | Módulos/acciones declarativos | CORE-3, CORE-4 (+permisos), CORE-5, CORE-6 | W1 | P1 (permisos) | test por rol | Registries con ≥2 consumidores |
| **3 — Actions & permissions** | Acciones seguras por entidad | quick actions clínica, feedback toast, empty states | W2 | P2 | auditoría acción | Acciones sensibles auditadas |
| **4 — Queues & command centers** | Trabajo por estado + home por rol | OPS-1 (palette fe), OPS-2 (saved views local), OPS-3/4 (queues), Role-Based Home | W2 | P2 | e2e queue | Home accionable por rol |
| **5 — Timeline, audit, evidence** | Trazabilidad integral | OPS-5 (Alert Center), OPS-6 (Timeline), ADMIN-5 (Audit Inspector), Entity 360 | W2 | P2 | e2e correlación | Entity 360 + evidencia |
| **6 — Admin control plane** | Colapsar dualidad + servidor adaptativo | PR-SRV-0, ADMIN-1..4, ADMIN-6 | W1+SRV-0 | **P1** | e2e admin | Cero `matchMedia` cardinalidad admin |
| **7 — Clinic cockpit** | Operación diaria fluida | CLINIC-1..5 | W1-5 | P2 | e2e clínica | Cockpit clínico completo |
| **8 — Particular premium** | Experiencia móvil impecable | PART-1..4 | W1 | P2 | device real | No-scroll + confianza |
| **9 — QA & governance** | Calidad medible | QA-1..3, DOCS-1 | W1-8 | P2 | suite verde | Gate candidato estable |
| **10 — Backend expansion** | Features que exigen backend | search global, bulk, export, SLA, saved-views persist | decisiones Nico | P1 | por feature | Sólo tras confirmar NO CONFIRMADO |

---

## 12. Mapa de dependencias

```
                    ┌─────────────────────────────┐
                    │ PR-PILOT-1 (hook + token)   │  ← raíz de todo lo adaptativo
                    └──────────────┬──────────────┘
                                   ▼
        ┌──────────── useAdaptiveItemsPerPage (CORE-1) ────────────┐
        ▼                          ▼                               ▼
 AdaptivePaginatedRegion    Work Queues (OPS-3/4)         Admin server (ADMIN-1..4)
   (CORE-2)                        ▲                               ▲
        │                          │                               │
        ▼                          │                        depende de PR-SRV-0 (spike)
 DashboardModuleRegistry (CORE-3)  │
        │                          │
        ▼                          │
 DashboardActionRegistry (CORE-4) ─┴────► EntityActionMenu (CORE-5) ─► Entity 360
        │                                                                ▲
        ▼                                                                │
 useActionPermissions (P1) ──► Command Palette / Bulk / Quick / Export ──┘
                                        │
                                        ▼
                    (Bulk/Export/Search global = BACKEND-REQUIRED, NO CONFIRMADO)

 Independientes (frontend-only sobre backend existente):
   • Alert Center (notif)      • Activity Timeline (StudyTimeline+tracking)
   • Audit Inspector (audit)   • Operational Health (health)
   • Layout Telemetry (dev)    • Enterprise Empty States    • Visual System/badges

 Gobernanza transversal: e2e no-scroll/no-gap + visual regression → gate SÓLO tras estabilidad.
```

| Depende de… | Qué |
|---|---|
| Adaptive contract | Region, Work Queues, todos los módulos paginados, admin server |
| Action Registry | EntityActionMenu, Entity 360, Palette, Quick/Bulk actions |
| Permisos (`useActionPermissions`) | Toda acción sensible, Palette, Bulk, Export |
| Backend nuevo (NO CONFIRMADO) | Bulk, Export cross-entity, Search global, SLA deadlines, persistencia saved-views |
| PR-SRV-0 | Toda migración de módulo Admin de servidor |
| Visual regression estable | Gate bloqueante (no antes) |
| **Independientes** | Alert Center, Timeline, Audit Inspector, Health, Empty States, Visual System, Telemetry |

---

## 13. Riesgos críticos y contramedidas

| Riesgo | Sev | Causa | Impacto | Mitigación | Señal temprana | Evidencia/test |
|---|---|---|---|---|---|---|
| Sobreingeniería (registries prematuros) | **P1** | Abstraer antes del 2.º consumidor | Deuda + PRs lentos | Registry recién en Wave 2 con ≥2 módulos | 1er registry sin 2do uso | `git diff` acotado |
| PRs demasiado grandes | **P1** | Ambición por wave | Review/rollback difícil | 1 módulo/1 primitiva por PR | `--stat` >~7 archivos | diff stat |
| Permisos mal aplicados | **P1** | Checks dispersos | Fuga de acción por rol | `useActionPermissions` único + tests por rol | acción visible sin permiso | test por rol |
| Acciones peligrosas / bulk / datos sensibles | **P1** | Batch sin control | Daño masivo | Confirmación+auditoría por ítem+diferir a backend | ausencia de auditoría | audit log |
| Servidor limit/offset | **P1** | Cardinalidad gobierna la query | Re-fetch/race offset | PR-SRV-0 antes | flicker en resize | POC |
| Exportación (datos sensibles) | P2 | Export sin permiso/auditoría | Fuga de datos | Permisos + auditoría de export | export sin rastro | audit |
| Duplicación de registries | P2 | Module vs Action mal separados | Confusión | Módulos=navegación, acciones=operación | overlap semántico | revisión |
| e2e flaky | P2 | race resize↔medición | Rojos intermitentes | `toPass`+tolerancias | flake rate | 3 corridas |
| Visual regression inestable | P2 | filas variables por viewport | Diff píxeles | Viewport determinista; manual antes de gate | diff no determinista | baseline |
| Mobile real iOS/Android | P2 | `vh`/barra dinámica/safe-area | Fit roto | `dvh`+safe-area+device QA | scroll en device | captura real |
| Rendimiento / layout thrashing | P2 | medición excesiva | Jank | rAF+setState condicional+histéresis | CPU en resize | perf trace |
| Backend latency (queues/360) | P2 | agregación multi-endpoint | Carga lenta | carga progresiva+skeleton estable | TTI alto | timing |
| DX del equipo | P2 | curva de primitivas | Adopción lenta | docs por PR + ejemplo canónico (piloto) | preguntas repetidas | doc |
| Saturación visual de acciones | P2 | demasiadas acciones inline | Ruido | máx 2 primarias + overflow | densidad de botones | heurística |
| Scope creep | P2 | "ya que estoy…" | PR grande | Checklist de no-alcance por PR | diff fuera de scope | diff stat |

---

## 14. Métricas de éxito

### UX / operación

| Métrica | Baseline (hoy) | Target |
|---|---|---|
| Clicks para generar token | multi-step + navegar | ≤ actual, Quick Action desde 360 |
| Clicks para encontrar un informe | navegación por módulo | ≤2 vía Palette |
| Módulos visitados por tarea | alto (data dispersa) | ≤1-2 vía Entity 360 |
| Filas visibles por viewport | fijo (4-10) | **derivado de medición**, +30-100% en pantallas altas |
| Scroll accidental detectado | **NO CONFIRMADO** (sin telemetría) | 0 en e2e |

### Calidad visual (automatizable)

Gaps · clipping · scroll interno · layout shifts · empty states accionables · consistencia de badges → **target: 0 defectos en la matriz zoom×viewport**.

### Producto (requiere instrumentación — **NO CONFIRMADO** que exista analytics)

Tareas/sesión · uso de palette · uso de saved views · alertas resueltas · informes procesados · tokens generados · descargas particulares exitosas.

### Técnica (medible por grep/CI)

| Métrica | Target |
|---|---|
| Módulos migrados a adaptive | 100% de los paginados |
| Constantes de cardinalidad como fuente de verdad | **0** (sólo fallback) |
| `matchMedia` de cardinalidad | **0** |
| `MOBILE_PAGE_SIZE` como verdad | **0** |
| Cobertura e2e no-scroll/no-gap | todos los módulos |
| Visual regression estable | 3 corridas verdes |
| PR size | ≤~7 archivos / 1 unidad lógica |
| Rollback time | 1 revert (fallback preserva función) |

---

## 15. Decisiones ejecutivas para Nico

| Decisión | Recomendación | Razón | Riesgo de postergar | Riesgo de avanzar |
|---|---|---|---|---|
| Aprobar visión enterprise | **Sí** | Alinea 40+ PRs a un norte | Trabajo disperso sin sistema | Ninguno (es dirección) |
| Aprobar PR-ENT-0 (este doc) | **Sí** | Contrato escrito = gobernanza | Decisiones se re-litigan | Nulo (docs-only) |
| Autorizar PR-PILOT-1 | **Sí** | Prerequisito de todo; riesgo acotado | Todo lo demás bloqueado | Bajo (rollback trivial) |
| Clínica primero vs Admin primero | **Clínica primero** | Cliente=menor riesgo; Admin necesita PR-SRV-0 | — | Admin server sin spike = P1 |
| Estrategia servidor (PR-SRV-0) | **Híbrido/over-fetch default** | Evita re-fetch en resize | Admin no migra | Elegir mal → red |
| Saved Views localStorage primero | **Sí** | Valor sin backend | Feature se retrasa | Migración local→backend futura |
| Command Palette frontend-only primero | **Sí** | Valor inmediato sobre datos cargados | Se retrasa por search backend | Cobertura parcial hasta backend |
| Alert Center antes que Audit Inspector | **Sí** | Mayor valor operativo diario; ambos QW | — | Ninguno (paralelizables) |
| Cuándo aceptar cambios visuales grandes | **Tras adaptive contract + baseline autorizado** | Evita regresión no medida | Percepción estancada | Romper baselines sin control |
| Cuándo gate de visual regression | **Tras 3 corridas verdes estables** | Evita flakiness bloqueante | Regresiones se cuelan | Gate prematuro frena PRs |

---

## 16. Primeros 15 PRs recomendados

| # | PR | Objetivo | Valor | Riesgo | Criterio de salida |
|---|---|---|---|---|---|
| 1 | PR-ENT-0 | Enterprise advisory + operational model (docs) | Gobernanza | P3 | Doc aprobado |
| 2 | PR-PILOT-1 | Adaptive rows Clínica Tokens | Raíz estructural | P1 | Tokens adaptativo, contract alineado |
| 3 | PR-PILOT-2 | QA e2e adaptive rows (mock 6→12) | Blindaje | P2 | Filas varían 1080 vs 720 |
| 4 | PR-CORE-1 | `useAdaptiveItemsPerPage` genérico | Habilitador universal | P2 | Hook + unit test |
| 5 | PR-CORE-2 | `AdaptivePaginatedRegion` / `AdaptiveModuleSurface` | Composición estándar | P2 | 1 módulo la usa |
| 6 | PR-OPS-5 | Alert Center (sobre notif existentes) | QW alto valor | P2 | Alertas por severidad |
| 7 | PR-OPS-6 | Activity Timeline (sobre `StudyTimeline`+tracking) | Trazabilidad barata | P2 | Timeline por entidad |
| 8 | PR-ADMIN-5 | Audit Inspector (sobre `getAuditEntries`) | Salto enterprise | P2 | Filtros+no-scroll |
| 9 | PR-CORE-4 | `DashboardActionRegistry` + `useActionPermissions` | Acciones seguras (P1) | P1 | Test por rol verde |
| 10 | PR-CORE-5 | `EntityActionMenu` + `ActionFeedbackToast` | Acciones sin saturar | P2 | e2e menú+feedback |
| 11 | PR-CORE-6 | `SmartFilterBar` + `OperationalStatusBadge` | Filtros/estado consistentes | P2 | e2e filtros |
| 12 | PR-CLINIC-4 | Clinic Command Center | Home accionable clínica | P2 | e2e no-scroll |
| 13 | PR-SRV-0 | Estrategia servidor (spike, sin producción) | Desbloquea admin | P2 | Política por módulo |
| 14 | PR-CORE-3 | `DashboardModuleRegistry` | Colapsa dualidad | P2 | source-contract |
| 15 | PR-ADMIN-1 | Admin Sessions adaptive (1er servidor) | Prueba migración servidor | P1 | Cero `matchMedia` cardinalidad |

**Lógica del orden:** (1-5) fundamentos irrenunciables; (6-8) quick wins frontend-only de alto valor sobre backend existente, paralelizables; (9-11) arquitectura de acciones segura; (12) primer command center; (13-15) apertura controlada de la superficie Admin de mayor riesgo.

---

## 17. No-alcance

Este PR (**PR-ENT-0**) es **docs-only**. **No implementa**:

- código (TS/TSX), hooks ni componentes;
- CSS;
- tests ni e2e;
- snapshots;
- CI ni workflows;
- backend, APIs, auth;
- DB ni migrations;
- dependencias ni lockfiles.

Toca **un único archivo**: `docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md`.

---

## 18. Recomendación final

- **PR-ENT-0 es el próximo paso correcto** porque fija el contrato conceptual (Entity model + Action Graph + Adaptive contract) y el modelo operacional por capas antes de escribir código — evita que cada PR posterior re-litigue la dirección.
- **PR-PILOT-1 es el primer PR de código posterior:** produce los dos artefactos reutilizables (`useAdaptiveItemsPerPage` + `--dash-row-h`) sobre el módulo de menor riesgo (Clínica · Tokens, cliente, detalle en overlay), con rollback trivial (fallback preserva función).
- **Admin servidor debe esperar PR-SRV-0:** migrar cardinalidad en módulos `limit/offset` sin decidir over-fetch vs re-fetch introduce el riesgo P1 de red/race; el spike lo resuelve sin tocar producción.
- **Particular no es dashboard paginado:** es una vista token-gated detail-only en la ruta pública `/particulares`; aplica el sub-contrato (viewport-fit / no-scroll / estados / móvil), no la paginación adaptativa.
- **No conviene mega PR:** el valor se entrega por oleadas de PRs chicos, cada uno con docs, e2e no-scroll/no-gap y rollback simple; la calidad se mide, no se declara.
- **Decisiones que quedan para Nico:** aprobar la visión (PR-ENT-0), autorizar PR-PILOT-1, elegir la política de servidor (PR-SRV-0), y confirmar/negar los puntos **NO CONFIRMADO** (endpoints batch, export cross-entity, deadlines SLA, expiración de tokens, granularidad de auditoría, search global, deploy/jobs/latencia, analytics de producto) antes de comprometer las fases que dependen de ellos.

---

### Anexo — Evidencia y NO CONFIRMADO

**Capacidades backend confirmadas (frontend/src/lib/api.ts):** `getAuditEntries` + `AdminAuditQuery/Entry/Snapshot`; `getDashboardNotifications` + `get{Admin,Clinic,Particular}StudyTrackingNotifications` (+ read/read-all); `get*StudyTrackingCases`; `getAdminSystemHealth` / `getAdminSchemaHealth`; `getAdminSessions`; `getAdminUsersRoles`; `getAdminClinics`; `getReports*` / `getReport*Url`; `get{Admin,Clinic}ParticularTokens`; `getAdminFailedLoginAlerts`; `getParticularSession` / `getParticularReport*Url` / `getParticularStudyTrackingCase`. Componente `StudyTimeline` existente.

**Contrato adaptativo — evidencia de deuda:** `usePagedRows(items, PAGE_SIZE)` con constantes fijas; forks `matchMedia("(max-width:767px)")` decidiendo `effectivePageSize`; dualidad `AdminXxxReadOnlyCard` + `AdminMobileXxxModule`; `MasterDetailWorkspace` con `xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto`.

**NO CONFIRMADO (verificar antes de comprometer las fases dependientes):** endpoints batch/bulk; export cross-entity server-side; deadlines/SLA (vencido/próximo-a-vencer/bloqueado); campo de expiración de tokens; granularidad de auditoría (descarga/acceso por entidad); search global cross-entity; estado de deploy/jobs/latencia en health; snapshot antes/después en auditoría; analytics de producto; modelo de "tarea operativa" como entidad.

---

*Documento generado como PR-ENT-0 (docs-only). No representa implementación de código. Las prioridades y scores son recomendaciones de asesoría sujetas a decisión ejecutiva.*
