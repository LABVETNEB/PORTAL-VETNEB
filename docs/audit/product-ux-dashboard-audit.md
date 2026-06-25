# VETNEB Global Dashboard Operating System

> **Tipo:** Norma empresarial funcional + arquitectura de operación + roadmap de gobierno.
> Estándar global aplicable a **todas** las superficies de dashboard VETNEB.
> **Fecha:** 2026-06-24 · **Modo:** solo arquitectura/estándar y plan — **cero cambios de código**.
> **Rama:** `audit/product-ux-dashboard` · **Base:** `main` @ `8d0f7ae` (working tree limpio).
> **Único artefacto:** este Markdown.
> **Producto:** Portal VETNEB — laboratorio patológico veterinario en operación productiva.
> **Superficies cubiertas:** Administrador (desktop/mobile), Clínica (desktop/mobile),
> Particulares (desktop/mobile).
> **Alcance prohibido:** backend, API, auth, DB, migraciones, dependencias, lockfiles, CI.
> **No se inventan** permisos, modelos de datos, endpoints ni roles backend.
> **Enfoque:** estructura, funcionalidad, productividad, control operativo, escalabilidad,
> navegación, acciones visibles, trazabilidad y consistencia global. **La estética está
> subordinada a la operación**: solo se admite como consecuencia de claridad funcional, jerarquía
> operativa, reducción de ruido, densidad controlada y confianza profesional. **No** se persigue
> "premium visual".

### Leyenda de estado (transversal)

| Marca | Significado |
|---|---|
| **EXISTENTE** | Montado y en uso en runtime hoy. |
| **DUPLICADO** | Función ya cubierta por otra superficie. |
| **HUÉRFANO** | En el repo, no montado en runtime (deuda). |
| **CONSOLIDABLE** | Vivo pero en conflicto con el modelo objetivo; requiere absorción. |
| **FUTURO** | Capacidad objetivo; no implementada (a veces condicionada a backend → fuera de scope). |
| **FUERA DE SCOPE** | Requiere backend/API/auth/DB; explícitamente excluido de esta fase. |

### Hallazgo central (invariante — se conserva)

La nav horizontal **ya existe** (EXISTENTE); el shell **ya no monta sidebar**; los sidebars
quedaron **HUÉRFANOS**. El problema no es reescribir el shell —esa pieza de riesgo ya ocurrió—
sino la **coexistencia de paradigmas**: nav horizontal (EXISTENTE) + hub/hero cockpit heredado
(CONSOLIDABLE) + wrappers redundantes de clínica (DUPLICADO). El trabajo es de **consolidación
funcional**, no de rediseño.

---

## 1. Executive Approval Verdict

**Veredicto.** El documento previo era un **buen baseline enterprise funcional** para los
dashboards de administración y clínica. **No es suficiente para aprobación multinacional global**
por dos motivos verificables:

1. **No cubría la superficie de particulares.** En el código, particulares **no es un dashboard
   privado**: es una **página pública token-gated** ([particulares/page.tsx](frontend/src/app/particulares/page.tsx)
   → [ParticularesContent.tsx](frontend/src/components/public/ParticularesContent.tsx)) renderizada
   con `PublicLayout`, **fuera** del App Shell, sin nav canónica, sin no-scroll SLA y sin la
   gobernanza del resto de dashboards.
2. **No formalizaba un contrato común** para las seis superficies (admin/clínica/particulares ×
   desktop/mobile).

**Nuevo objetivo:** aprobar un **sistema global de dashboard** (este documento) que fije un
contrato funcional común para todas las superficies, con diferencias **justificadas por rol**, y
trasladarlo de forma incremental. La estética queda subordinada a operación, estructura y
funcionalidad.

**Estado de aprobación:** este documento queda como **baseline global aprobable** una vez fijado
(PR-GD0). La superficie de particulares requiere **auditoría específica adicional** (PR-GD7)
antes de aplicarle el estándar (PR-GD8), porque hoy vive fuera del OS de dashboard.

---

## 2. VETNEB Global Dashboard Operating System (estándar global)

El "Operating System" es el **contrato funcional común** que toda superficie de dashboard VETNEB
debe cumplir. No es una librería de código: es la norma que gobierna estructura, navegación,
acción, estado y densidad.

| Regla del OS | Definición |
|---|---|
| OS-1 | **Todos los dashboards comparten un contrato funcional común** (§5), con diferencias por rol, no arquitecturas improvisadas por pantalla. |
| OS-2 | **Cada rol opera con el mínimo cambio de contexto.** |
| OS-3 | **Desktop y mobile son superficies operativas**, no versiones decorativas ni "desktop encogido". |
| OS-4 | **Todo dashboard define explícitamente:** navegación, estado, acciones, detalle, trazabilidad y densidad. |
| OS-5 | **Módulos críticos accesibles en 1 paso**; navegación canónica única; sin hubs obligatorios cuando hay navegación directa. |
| OS-6 | **Particulares es una superficie operativa para usuario externo**: claridad, seguridad, estado y acción; **no** replica complejidad interna. |
| OS-7 | **Escala por configuración** (más clínicas/roles/módulos/volumen) **sin duplicar paradigmas**. |
| OS-8 | **La estética solo se justifica por función** (legibilidad, jerarquía, confianza). |

---

## 3. Global Dashboard Surface Matrix

Seis superficies. Estado verificado a 2026-06-24. "Nivel no-scroll" usa la escala SLA de §8.

### 3.1 Desktop — Administrador · **EXISTENTE**
- **Objetivo operativo:** supervisión y control central del laboratorio y de las clínicas.
- **Usuario principal:** operador/administrador VETNEB.
- **Tareas críticas:** clínicas, auditoría, sesiones, precios, mantenimiento, salud del sistema,
  usuarios/roles, alertas de acceso.
- **Acciones primarias:** crear/editar clínica, revocar sesión, editar precios, dry-run, filtrar
  auditoría.
- **Información mínima visible:** estado del sistema, intentos fallidos, actividad reciente,
  conteos.
- **Riesgos de fricción:** 3 módulos fuera de la nav (`Estado`/`Precios`/`Mantenimiento`); doble
  hop por hub; etiquetas divergentes nav↔hub.
- **Nivel no-scroll requerido:** **SLA-3.** Estado actual: **SLA-2** (shell sólido; gaps de nav).
- **Criterios de aceptación:** 10 módulos a 1 paso; sin doble hop; acción primaria visible por
  módulo.
- **Evidencia:** [AdminDashboardWorkspaceController.tsx:294-379](frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx),
  [DashboardHorizontalNav.tsx:20-28](frontend/src/components/dashboard/DashboardHorizontalNav.tsx).

### 3.2 Mobile — Administrador · **EXISTENTE**
- **Objetivo operativo:** control admin táctico desde el teléfono.
- **Usuario principal:** administrador en movilidad.
- **Tareas críticas:** mismas que desktop, priorizadas (clínicas, auditoría, sesiones).
- **Acciones primarias:** navegación persistente (bottom-nav), módulos por familia.
- **Información mínima visible:** estado/contexto del módulo en app-bar.
- **Riesgos de fricción:** encaje por recorte del hub (grid 2×3 + `line-clamp`).
- **Nivel no-scroll requerido:** **SLA-3.** Estado actual: **SLA-2/3** (App Shell absoluto + bottom-nav).
- **Criterios de aceptación:** acción/navegación primaria a ≤1 gesto; sin scroll global.
- **Evidencia:** [AdminMobileBottomNav.tsx](frontend/src/components/dashboard/AdminMobileBottomNav.tsx),
  [AdminMobileHubLauncher.tsx](frontend/src/components/dashboard/AdminMobileHubLauncher.tsx).

### 3.3 Desktop — Clínica · **EXISTENTE**
- **Objetivo operativo:** operación de estudios, informes y logística de la clínica.
- **Usuario principal:** personal de clínica.
- **Tareas críticas:** seguir informes/estados, logística/visitas, tokens, perfil, credenciales.
- **Acciones primarias:** abrir/filtrar/descargar informe, ver trazabilidad, crear token.
- **Información mínima visible:** informes pendientes, visitas activas (KPIs del command center).
- **Riesgos de fricción:** wrappers redirectores; detalle inline gigante; doble hop.
- **Nivel no-scroll requerido:** **SLA-3.** Estado actual: **SLA-1/2** (inline detail incumple).
- **Criterios de aceptación:** un destino por módulo; detalle estable; acción primaria visible.
- **Evidencia:** [ClinicDashboardWorkspaceController.tsx:165-224](frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx),
  [informes/page.tsx:508-621](frontend/src/app/dashboard/informes/page.tsx).

### 3.4 Mobile — Clínica · **EXISTENTE (asimetría)**
- **Objetivo operativo:** operación de clínica en campo/movilidad.
- **Usuario principal:** personal de clínica en terreno.
- **Tareas críticas:** consulta de informes/estados, logística, tokens.
- **Acciones primarias:** dependientes de la nav horizontal con **scroll lateral** (sin bottom-nav).
- **Información mínima visible:** KPIs operativos del resumen.
- **Riesgos de fricción:** **sin navegación persistente** equivalente a admin; navegación crítica
  por scroll lateral.
- **Nivel no-scroll requerido:** **SLA-3.** Estado actual: **SLA-1** (navegación crítica depende
  de scroll lateral).
- **Criterios de aceptación:** navegación/acción primaria persistente sin scroll global.
- **Evidencia:** [DashboardShellRouter.tsx:35-37](frontend/src/components/dashboard/DashboardShellRouter.tsx)
  (bottom-nav solo admin).

### 3.5 Desktop — Particulares · **EXISTENTE, fuera del OS**
- **Objetivo operativo:** que un usuario externo consulte estado e informe de **su** caso por token.
- **Usuario principal:** tutor/particular (externo, no profesional).
- **Tareas críticas:** ingresar token, ver estado del estudio, ver/descargar informe, contactar
  (tinción especial).
- **Acciones primarias:** "Ingresar", "Ver informe", "Descargar", "Cerrar sesión", contacto
  WhatsApp/email.
- **Información mínima visible:** tutor, mascota, especie, raza, fechas, etapa del estudio,
  estimación.
- **Riesgos de fricción:** página pública con **scroll vertical** (`py-16`), fuera del App Shell;
  sin nav canónica ni SLA del OS; no aplica gobernanza de dashboard.
- **Nivel no-scroll requerido:** **SLA-2 (variante particular: "simple, no largo")**. Estado
  actual: **SLA-1** (página informativa + sesión apilada).
- **Criterios de aceptación:** estado + acción visibles sin exploración; cero exposición de
  complejidad interna (ya cumplido por diseño: no expone clínicas/rutas/profesionales/otros
  estudios).
- **Evidencia:** [ParticularesContent.tsx:519-1115](frontend/src/components/public/ParticularesContent.tsx),
  [particulares/page.tsx](frontend/src/app/particulares/page.tsx).

### 3.6 Mobile — Particulares · **EXISTENTE, fuera del OS**
- **Objetivo operativo:** consulta táctil del caso por el tutor.
- **Usuario principal:** tutor/particular en el teléfono.
- **Tareas críticas:** token, estado, informe, contacto.
- **Acciones primarias:** "Ver informe"/"Descargar" en layout **flat** mobile; "Pegar token".
- **Información mínima visible:** resumen seguro del caso (tutor/mascota/fechas) + etapa.
- **Riesgos de fricción:** pantalla larga apilada (no hay contrato no-scroll para esta superficie).
- **Nivel no-scroll requerido:** **SLA-2 (variante particular)**. Estado actual: **SLA-1**.
- **Criterios de aceptación:** acción primaria a ≤1 gesto; simple, no más largo que desktop.
- **Evidencia:** layouts `data-particular-mobile-flat-*` / `sm:hidden`
  ([ParticularesContent.tsx:612-925](frontend/src/components/public/ParticularesContent.tsx)).

---

## 4. Global Role-Based Operating Model

### 4.1 Administrador (supervisión y control central)
- **Procesos:** supervisión, control, auditoría, configuración, precios, mantenimiento, clínicas,
  usuarios, sesiones, alertas.
- **Acciones primarias:** crear/editar clínica
  ([AdminClinicsManagementCard.tsx](frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx)),
  revocar sesión, editar precios, dry-run, filtrar auditoría.
- **Información mínima visible:** estado del sistema, intentos fallidos, actividad reciente.
- **Módulos a 1 paso:** **los 10** (hoy 7 en nav) → corrige PR-GD1.

### 4.2 Clínica (operación de estudios y logística)
- **Procesos:** carga, seguimiento, informes, logística, estados pendientes, acciones frecuentes,
  trazabilidad.
- **Acciones primarias:** abrir/filtrar/descargar informe, ver `StudyTimeline`, abrir logística,
  crear token.
- **Información mínima visible:** informes pendientes, visitas activas.
- **Módulos a 1 paso:** Resumen, Informes (completo), Tokens, Logística (completo), Perfil →
  corrige PR-GD3/GD4.

### 4.3 Particulares (usuario externo — superficie operativa simple)
- **Procesos:** consulta de estado, acceso seguro a resultados **cuando aplique**, seguimiento
  simple, comprensión de próximos pasos, contacto/acción disponible.
- **Acciones primarias:** ingresar token, ver estado, ver/descargar informe (si está vinculado),
  contactar.
- **Información mínima visible:** etapa del estudio, fechas, informe vinculado, próximos pasos.
- **Restricción clave (ya cumplida por diseño):** **no replicar la complejidad admin/clínica.**
  El acceso está limitado al caso del token y **no expone** clínicas, rutas internas,
  profesionales ni otros estudios
  ([ParticularesContent.tsx:527-531](frontend/src/components/public/ParticularesContent.tsx)).
  El estándar para particulares es **claridad, seguridad, estado y acción**, no módulos internos.

---

## 5. Global Functional Contract (contrato común obligatorio)

Todo dashboard VETNEB —sea admin, clínica o particulares— debe declarar y cumplir, con la
profundidad que su rol requiera:

| Elemento del contrato | Admin / Clínica | Particulares |
|---|---|---|
| **Navegación canónica** | Nav horizontal única (todos los módulos) | Navegación **mínima** orientada a estado/acción (no módulos) |
| **Workspace modular** | Módulo activo en App Shell | Vista única de caso (no modular) |
| **Capa de comando** | Acción primaria por módulo + secundarias contextuales | Acciones simples y seguras (ver/descargar/contactar) |
| **Zona de estado** | Status/exception strip | Etapa del estudio + alertas (p.ej. tinción especial) |
| **Zona de detalle** | Master-detail estable | Detalle del propio caso |
| **Acción primaria visible** | Sí, siempre | Sí, siempre (ver informe / contacto) |
| **Filtros/búsqueda** | Cuando el dataset lo requiere (server-side) | No aplica |
| **Metadata/trazabilidad** | Auditoría, fechas, responsable | Seguimiento del estudio (etapas, fechas) |
| **Empty/Loading/Error** | Primitivas compartidas | Estados ya presentes (verificando/expirada/error) |
| **Responsive operativo** | Desktop + mobile táctico | Desktop + mobile flat |
| **No-scroll SLA** | SLA-3 objetivo | SLA-2 "simple, no largo" |
| **Accesibilidad básica** | Foco/aria/roles | Foco/aria/roles |

---

## 6. Global Navigation Standard

1. **Navegación global canónica** (nav horizontal en topbar para admin/clínica).
2. **Sin módulos críticos escondidos** (admin: incorporar Estado/Precios/Mantenimiento → PR-GD1).
3. **Sin hubs obligatorios** cuando existe navegación directa.
4. **Sin doble hop** para tareas frecuentes (eliminar la obligatoriedad de "Volver a módulos").
5. **Sin wrappers vacíos** (clínica → PR-GD3).
6. **Navegación por rol**, no por decoración; los ítems reflejan procesos.
7. **Consistencia desktop/mobile**: mismo set de destinos críticos en ambas superficies por rol
   (clínica mobile debe ganar navegación persistente → PR-GD6).
8. **Particulares = navegación mínima** orientada a estado/acción (token → estado → informe →
   contacto). **No** debe tener navegación de módulos internos.

---

## 7. Global Command Layer Standard

Capa de comando por superficie. Se construye sobre primitivas existentes; **sin backend**.

| Superficie | Acción primaria | Acción secundaria | Visibilidad | Contexto | Riesgo si se esconde |
|---|---|---|---|---|---|
| **Admin** | Control/supervisión (crear clínica, revocar sesión, editar precios, dry-run, filtrar auditoría) | Edición en drawer/dialog (`ClinicEditDrawer`, `ModuleDialog`) | Toolbar de módulo siempre visible | Módulo activo | Pérdida de control operativo; configuración inaccesible |
| **Clínica** | Operativa (subir/abrir/descargar informe, seguir estado, crear token, logística) | Trazabilidad (`StudyTimeline`), detalle estable | Toolbar + master-detail | Módulo activo | Operación lenta; seguimiento perdido |
| **Particulares** | Ver/Descargar informe; Ver estado | Contacto WhatsApp/email; cerrar sesión | Card de sesión siempre visible | Caso del token | Usuario externo bloqueado/confundido; pérdida de confianza |

Primitivas reutilizables (EXISTENTE/CONSOLIDABLE): `ModuleSurface` toolbar,
`StickyActionBar` (subutilizado), `ModuleDialog`, `ClinicEditDrawer`, `MasterDetailWorkspace`
(subutilizado), `StudyTimeline`, `AdminAuditCard`. **Prohibido** Command Bar inventado o wrappers
redirectores.

---

## 8. Global No-Scroll Operational SLA

### 8.1 Desktop
- Acciones frecuentes visibles **sin scroll externo obligatorio**.
- Navegación crítica **siempre visible**.
- Detalle denso por **master-detail/drawer/panel**, no por página infinita.

### 8.2 Mobile
- Acción primaria disponible **o a máximo 1 gesto**.
- Navegación crítica **no puede depender solo de scroll lateral**.
- Evitar pantallas largas repetitivas.
- **Particulares debe ser más simple, no más largo.**

### 8.3 Niveles SLA (escala de cumplimiento)

| Nivel | Definición | Ejemplo en el repo |
|---|---|---|
| **SLA-0** | Incumple: acciones/navegación escondidas tras scroll; página infinita. | Detalle inline gigante de informes ([informes/page.tsx:508-621](frontend/src/app/dashboard/informes/page.tsx)). |
| **SLA-1** | Aceptable básico: funciona pero con fricción (scroll lateral como nav, página larga). | Clínica mobile (nav por scroll lateral); particulares (página apilada). |
| **SLA-2** | Enterprise: no-scroll operativo con focos menores. | Admin desktop (shell sólido, gaps de nav). |
| **SLA-3** | Multinacional/supremo: acciones + navegación + estado visibles; detalle estable; mobile táctico. | **Objetivo de todas las superficies.** |

### 8.4 Evidencia requerida por PR
`scrollHeight ≤ clientHeight + 1` en shell y módulos in-shell (matriz e2e
`dashboard-viewport-zoom-adaptability.spec.ts`); acción primaria visible (desktop) / ≤1 gesto
(mobile); screenshots antes/después.

---

## 9. Global Information Architecture

Regiones del OS y su aplicación por rol:

```
┌ Global nav ───────────────────────────────────────────────┐ admin/clínica: nav horizontal · particulares: mínima
├ Context header ───────────────────────────────────────────┤ módulo/caso activo
├ Status strip ─────────────────────────────────────────────┤ estado/excepciones (salud, pendientes, etapa)
├ Command/action zone ──────────────────────────────────────┤ acción primaria + filtros/búsqueda (si aplica)
├ Main workspace ───────────────────────────────────────────┤ tabla/lista/caso
├ Detail/context panel ─────────────────────────────────────┤ master-detail estable (admin/clínica)
├ Audit/status metadata ────────────────────────────────────┤ trazabilidad/fechas/responsable
├ Help/next-step zone ──────────────────────────────────────┤ PARTICULARES: próximos pasos + contacto
└ Mobile tactical action zone ──────────────────────────────┘ acción/navegación primaria persistente
```

| Región | Admin | Clínica | Particulares |
|---|---|---|---|
| Global nav | Nav horizontal (7→10) | Nav horizontal (5) | Mínima (token/estado/acción) |
| Status strip | Salud, fallos, actividad | Pendientes, visitas | Etapa del estudio + alertas |
| Command/action | Control/supervisión | Operativa | Ver/descargar/contactar |
| Main workspace | Tablas densas server-side | Listas/informes | Card del caso |
| Detail panel | Master-detail | Master-detail (PR-GD4) | Detalle del propio caso |
| Audit/metadata | `AdminAuditCard` | `StudyTimeline` | Seguimiento del estudio |
| Help/next-step | — | — | **Próximos pasos + contacto** |
| Mobile tactical | Bottom-nav | **Falta (PR-GD6)** | Acciones flat |

Esto **reemplaza páginas largas por espacios operativos**: el detalle deja de apilarse inline; el
hub deja de ser página de entrada y se reduce a status/overview; los wrappers desaparecen;
particulares conserva su simplicidad pero con estado/acción priorizados.

---

## 10. Global Functional Density Standard

- **Densidad = capacidad operativa por pantalla**, no compresión visual.
- **Menos saltos** (sin doble hop), **menos repetición** (sin wrappers), **acciones visibles**.
- **Información mínima suficiente**; *progressive disclosure* solo para lo secundario.
- **Mobile táctico** (tarea-primero), **desktop multipanel** cuando corresponda (master-detail,
  tabs, panels, tablas compactas).
- Mantener tokens `--dash-*` ([globals.css:2052-2207](frontend/src/app/globals.css)); **prohibido**
  reintroducir medidas fijas de densidad. La densidad fluida cockpit/mobile (encaje por recorte)
  está cubierta por el PR-E de la auditoría algorítmica; aquí no se reabre.
- **Particulares:** densidad mínima — mostrar estado, próximos pasos y acción; nunca densificar
  con datos internos.

---

## 11. Particular Dashboard Standard (superficie de usuario externo)

El dashboard de particulares **no debe copiar admin/clínica**. Estándar específico:

| Requisito | Estado actual (evidencia) |
|---|---|
| Estado claro del proceso | EXISTENTE: etapas reception→processing→evaluation→report_development→delivered ([ParticularesContent.tsx:83-95](frontend/src/components/public/ParticularesContent.tsx)). |
| Próximos pasos | PARCIAL: mensajes de disponibilidad del informe; **CONSOLIDABLE** como "Help/next-step zone" explícita. |
| Acceso a información permitida | EXISTENTE: ver/descargar informe vinculado ([:487-517](frontend/src/components/public/ParticularesContent.tsx)). |
| Acciones simples | EXISTENTE: token, ver, descargar, contacto, logout. |
| Lenguaje claro | EXISTENTE: copy orientado a tutor; errores técnicos sanitizados ([:263-300](frontend/src/components/public/ParticularesContent.tsx)). |
| Cero exposición de complejidad interna | EXISTENTE por diseño: sin clínicas/rutas/profesionales/otros estudios. |
| Estructura mobile-first | EXISTENTE: layouts flat mobile (`data-particular-mobile-flat-*`). |
| Confianza y seguridad | EXISTENTE: sesión separada del portal clínico, token enmascarado `tokenLast4`. |
| Navegación mínima | EXISTENTE: sin módulos; flujo token→estado→informe→contacto. |
| No-scroll funcional | **GAP:** página pública con scroll vertical, fuera del App Shell → objetivo SLA-2 "simple, no largo" (PR-GD8). |

**Aclaración de scope:** cualquier cambio real de **datos, permisos, endpoints o auth** de
particulares está **FUERA DE SCOPE**. PR-GD7/GD8 solo pueden tocar **estructura/layout frontend**
de la superficie particular, sin alterar el flujo de sesión por token ni el contrato de API
existente.

---

## 12. Global Gap Analysis (6 superficies)

> Severidad: P1 = fricción/redundancia de alto impacto · P2 = estructura/densidad/consistencia ·
> P3 = deuda diferible.

| Gap | Superficie(s) | Proceso | Productividad | Control | Claridad externa | Escalabilidad | Riesgo téc. | Sev. | PR | Criterio de aceptación |
|---|---|---|---|---|---|---|---|---|---|---|
| 3 módulos críticos fuera de la nav | Admin desktop/mobile | Config/precios/manten./salud | **Alto** | Medio | — | Alto | **Bajo** | **P1** | PR-GD1 | 10 módulos a 1 paso. |
| Doble hop por hub | Admin+Clínica desktop | Cambio entre tareas | Medio | Bajo | — | Medio | Medio | **P1** | PR-GD2 | Salto directo sin hub. |
| Wrappers redirectores | Clínica desktop | Acceso informes/logística | Medio | Bajo | — | Medio | Medio | **P1** | PR-GD3 | Un destino por módulo. |
| Detalle inline gigante | Clínica desktop/mobile | Lectura de informe | **Alto** | Medio | — | Medio | Medio | **P2** | PR-GD4 | Detalle estable, no infinito. |
| Acción primaria no estandarizada | Admin+Clínica | Crear/subir/revocar | Medio | Medio | — | Medio | Bajo-medio | **P2** | PR-GD5 | Acción primaria visible por módulo. |
| Sin navegación persistente | Clínica mobile | Operación en campo | Medio | Bajo | — | Medio | Medio | **P2** | PR-GD6 | Navegación persistente sin scroll global. |
| Superficie fuera del OS | Particulares desktop/mobile | Consulta de caso externo | Bajo | — | **Alto** | Bajo | Medio | **P2** | PR-GD7/GD8 | Estado/acción priorizados; SLA-2; sin backend. |
| Próximos pasos no explícitos | Particulares | Comprensión del proceso | — | — | **Medio** | Bajo | Bajo | **P3** | PR-GD8 | "Next-step zone" visible. |
| Sidebars huérfanos + tests legacy | Global | Mantenibilidad | Nulo | Nulo | — | Bajo | Bajo-medio | **P3** | PR-GD9 | Cero referencias runtime. |
| `PAGE_SIZE` chicos (informes 6/clínicas 9) | Admin+Clínica | Volumen de listas | Medio | Bajo | — | Alto (toca contrato) | Alto | **P2** | Dependencia (PR de contrato aparte) | Documentado; fuera de PRs chicos. |

---

## 13. Global Roadmap PR-GD

> Regla transversal: cada PR alinea sus tests de contrato **en el mismo PR**; ninguno toca
> backend/API/auth/DB/deps/lockfiles/CI. Cada PR declara dashboard, superficie, rol, SLA y
> evidencia.

### PR-GD0 — Fijar el estándar global (docs-only)
- **Objetivo funcional:** establecer este documento como baseline global aprobado.
- **Dashboard/superficie:** todas. **Problema que resuelve:** ausencia de contrato común.
- **Alcance permitido:** este Markdown. **Fuera de alcance:** todo código.
- **Validaciones:** revisión documental. **Evidencia:** diff del Markdown.
- **Criterios de aceptación:** documento cubre las 6 superficies + contrato + roadmap.
- **Motivo de orden:** baseline antes de implementar.

### PR-GD1 — Navegación canónica admin/clínica (módulos críticos a 1 paso) · *(≡ PR-ME1/PR-UX1)*
- **Objetivo funcional:** todos los módulos críticos en la nav; etiquetas únicas.
- **Dashboard/superficie:** Admin desktop+mobile (y clínica por consistencia). **Rol:** admin.
- **Problema empresarial:** acciones escondidas → pérdida de productividad y control.
- **Alcance permitido:** datos de navegación + su test + etiquetas.
- **Fuera de alcance:** ruteo `?module=`, CSS, hub, backend.
- **Archivos probables:** [DashboardHorizontalNav.tsx](frontend/src/components/dashboard/DashboardHorizontalNav.tsx)
  (extender `ADMIN_NAV_ITEMS`); [frontend-dashboard-horizontal-nav.test.ts](test/frontend-dashboard-horizontal-nav.test.ts).
- **Validaciones:** lint, typecheck, build, `pnpm test`; e2e navegación/zoom; manual 1366/1280 + mobile.
- **Evidencia:** screenshot nav admin con 10 ítems (desktop+mobile); tests verdes.
- **Criterios de aceptación:** 10 módulos a 1 paso; `aria-current` correcto; cero scroll vertical
  en la barra; SLA admin sube hacia SLA-3.
- **Motivo de orden:** máximo valor/riesgo, diff mínimo (datos+test; el contrato usa `includes`,
  agregar no rompe — [test:41-64](test/frontend-dashboard-horizontal-nav.test.ts)); consolida la
  nav como canónica.

### PR-GD2 — Eliminar doble hop / hub no obligatorio
- **Objetivo funcional:** salto directo entre módulos; hub = overview, no paso.
- **Dashboard/superficie:** Admin+Clínica desktop. **Rol:** ambos.
- **Problema empresarial:** rodeos por tarea frecuente.
- **Alcance permitido:** semántica de "Volver a módulos" y rol del hub; preservar señales
  `admin-hub-reset`/`activateModule` y restauración de último módulo.
- **Fuera de alcance:** la nav (ya en GD1), backend.
- **Archivos probables:** [DashboardModuleWorkspace.tsx:29-38](frontend/src/components/dashboard/DashboardModuleWorkspace.tsx),
  [AdminDashboardWorkspaceController.tsx](frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx),
  [ClinicDashboardWorkspaceController.tsx](frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx).
- **Validaciones:** lint, typecheck, build, `pnpm test`; e2e navegación (incl. reset/activate).
- **Evidencia:** e2e de cambio de módulo directo + hub como overview.
- **Criterios de aceptación:** cambio de módulo en 1 click sin hub; señales intactas.
- **Motivo de orden:** completa la consolidación de navegación antes de tocar contenido.

### PR-GD3 — Consolidar wrappers redundantes de clínica
- **Objetivo funcional:** un destino por módulo; eliminar pasos intermedios sin datos.
- **Dashboard/superficie:** Clínica desktop+mobile. **Rol:** clínica.
- **Problema empresarial:** interfaz repetitiva.
- **Alcance permitido:** destinos de cards, slots de módulo, retiro de wrappers.
- **Fuera de alcance:** el resumen "recientes" del command center (se conserva), backend.
- **Archivos probables:** [ClinicDashboardWorkspaceController.tsx](frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx),
  [dashboard/page.tsx](frontend/src/app/dashboard/page.tsx),
  `ClinicInformesWorkspaceSummary.tsx`/`ClinicLogisticaWorkspaceSummary.tsx`.
- **Validaciones:** lint, typecheck, build, `pnpm test`; e2e navegación clínica.
- **Evidencia:** hub→informes completo y nav→informes completo idénticos.
- **Criterios de aceptación:** un destino por módulo; recientes en Resumen; cero pérdida de datos.
- **Motivo de orden:** P1 de redundancia; se apoya en navegación consolidada.

### PR-GD4 — Informes: master-detail estable (fin de la página infinita)
- **Objetivo funcional:** detalle denso estable que no alarga la lista ni muere al paginar.
- **Dashboard/superficie:** Clínica desktop+mobile. **Rol:** clínica.
- **Problema empresarial:** seguimiento con scroll largo y contexto roto.
- **Alcance permitido:** layout lista/detalle, reuso de `MasterDetailWorkspace`/`StudyTimeline`/
  `ReportFileActions`.
- **Fuera de alcance:** fetch/paginación server-side, `PAGE_SIZE`, backend.
- **Archivos probables:** [informes/page.tsx:437-673](frontend/src/app/dashboard/informes/page.tsx),
  [MasterDetailWorkspace.tsx](frontend/src/components/dashboard/MasterDetailWorkspace.tsx).
- **Validaciones:** lint, typecheck, build; e2e informes (selección/paginación/filtros URL);
  no-scroll/zoom.
- **Evidencia:** e2e/screenshot de detalle estable + paginación preservando selección.
- **Criterios de aceptación:** detalle estable sin alargar lista; sobrevive a paginación;
  filtros/URL preservados; SLA clínica sube a SLA-3.
- **Motivo de orden:** alto valor operativo; tras consolidar navegación/flujo.

### PR-GD5 — Command layer por módulo (admin/clínica)
- **Objetivo funcional:** estandarizar acción primaria + status strip por módulo.
- **Dashboard/superficie:** Admin+Clínica desktop+mobile. **Rol:** ambos.
- **Problema empresarial:** acción primaria inconsistente → curva operativa.
- **Alcance permitido:** composición/ubicación de acción primaria y estado; reuso de
  `ModuleSurface` toolbar y `StickyActionBar`.
- **Fuera de alcance:** Command Bar global inventado, lógica de datos nueva, backend.
- **Archivos probables:** módulos admin/clínica sin acción primaria estandarizada;
  [StickyActionBar.tsx](frontend/src/components/dashboard/StickyActionBar.tsx).
- **Validaciones:** lint, typecheck, build, `pnpm test`; e2e por módulo; manual.
- **Evidencia:** screenshots de acción primaria visible por módulo.
- **Criterios de aceptación:** cada módulo expone su acción primaria sin scroll; estados críticos
  visibles.
- **Motivo de orden:** consolida la "consola" tras saneo de navegación/contenido.

### PR-GD6 — Mobile functional density admin/clínica (paridad)
- **Objetivo funcional:** navegación táctica persistente en clínica equiparable a admin.
- **Dashboard/superficie:** Clínica mobile. **Rol:** clínica.
- **Problema empresarial:** operación en campo con navegación por scroll lateral.
- **Alcance permitido:** componente de navegación mobile + montaje condicional por surface.
- **Fuera de alcance:** nuevas deps, backend, cambios al bottom-nav admin.
- **Archivos probables:** nuevo `ClinicMobileBottomNav` análogo a
  [AdminMobileBottomNav.tsx](frontend/src/components/dashboard/AdminMobileBottomNav.tsx);
  [DashboardShellRouter.tsx:35-37](frontend/src/components/dashboard/DashboardShellRouter.tsx).
- **Validaciones:** lint, typecheck, build; e2e mobile no-scroll clínica; manual 390×844.
- **Evidencia:** e2e/screenshot mobile clínica con navegación persistente.
- **Criterios de aceptación:** navegación persistente sin scroll global; SLA clínica mobile sube
  de SLA-1 a SLA-3.
- **Motivo de orden:** mejora real de operación táctica; mayor superficie → tras lo anterior.

### PR-GD7 — Auditoría específica de particulares (desktop/mobile) · *(docs-only)*
- **Objetivo funcional:** auditar la superficie particular contra el OS y producir su plan.
- **Dashboard/superficie:** Particulares desktop+mobile. **Rol:** particular.
- **Problema empresarial:** superficie fuera del OS, sin contrato funcional formal.
- **Alcance permitido:** análisis + plan (en este documento o sección anexa). **Fuera de alcance:**
  código, backend.
- **Archivos probables:** lectura de [ParticularesContent.tsx](frontend/src/components/public/ParticularesContent.tsx).
- **Validaciones:** revisión documental.
- **Evidencia:** mapeo file:line de estado/acciones/no-scroll de particulares.
- **Criterios de aceptación:** plan de aplicación del estándar sin tocar backend.
- **Motivo de orden:** particulares requiere auditoría dedicada **antes** de implementar.

### PR-GD8 — Aplicar estándar global a particulares (sin backend)
- **Objetivo funcional:** estado/acción priorizados + "next-step zone" + SLA-2 "simple, no largo".
- **Dashboard/superficie:** Particulares desktop+mobile. **Rol:** particular.
- **Problema empresarial:** claridad externa y confianza; reducir longitud/scroll.
- **Alcance permitido:** **solo estructura/layout frontend** de la superficie particular.
- **Fuera de alcance:** datos, permisos, endpoints, auth, flujo de token (**FUERA DE SCOPE**).
- **Archivos probables:** [ParticularesContent.tsx](frontend/src/components/public/ParticularesContent.tsx);
  posibles utilidades de layout públicas.
- **Validaciones:** lint, typecheck, build; e2e/screenshot desktop+mobile; manual.
- **Evidencia:** antes/después mostrando estado/acción priorizados y reducción de longitud.
- **Criterios de aceptación:** acción primaria a ≤1 gesto; próximos pasos visibles; cero
  exposición interna; sin cambios de API/datos.
- **Motivo de orden:** tras auditoría dedicada (GD7) y con admin/clínica ya saneados.

### PR-GD9 — Limpieza de sidebars huérfanos / paradigmas antiguos
- **Objetivo funcional:** retirar paradigma muerto y contratos legacy.
- **Dashboard/superficie:** global. **Rol:** —.
- **Alcance permitido:** archivos huérfanos + sus tests. **Fuera de alcance:** runtime visible.
- **Archivos probables:** `DashboardSidebarFrame/AdminDashboardSidebar/ClinicDashboardSidebar/
  DashboardSidebar`; `frontend-admin-sidebar-module-navigation`, `frontend-visual-consistency`.
- **Validaciones:** `pnpm test` completo; build; grep referencias = 0.
- **Evidencia:** grep sin referencias runtime; suite verde.
- **Criterios de aceptación:** cero referencias huérfanas; sin cambio visual.
- **Motivo de orden:** deuda sin impacto de usuario; al final.

### PR-GD10 *(opcional)* — Governance tests / e2e / screenshots
- **Objetivo funcional:** blindar invariantes del OS (nav canónica única, sin módulos escondidos,
  sin wrappers, no-scroll SLA, particular sin complejidad interna).
- **Dashboard/superficie:** global. **Alcance permitido:** tests/governance **si el repo lo
  permite**. **Fuera de alcance:** producto, backend.
- **Validaciones:** `pnpm test`; e2e operativo.
- **Evidencia:** tests que fallen ante un módulo escondido/wrapper/segundo paradigma.
- **Criterios de aceptación:** invariantes cubiertas; suite verde.
- **Motivo de orden:** sostiene el baseline global a futuro.

---

## 14. Global Enterprise Scorecard

Puntuación 0–3 por categoría y superficie (estado **actual**). **0** incumple · **1** básico ·
**2** enterprise · **3** multinacional/supremo. "Riesgo téc." = controlabilidad del cambio
(3 = bajo riesgo). **Regla de aprobación: ninguna superficie alcanza nivel supremo si una
categoría crítica (navegación, acciones primarias, no-scroll SLA, trazabilidad/estado) queda en
0 o 1.**

| Categoría | Admin D | Admin M | Clín D | Clín M | Part D | Part M |
|---|---|---|---|---|---|---|
| Navegación | 1 | 2 | 1 | 1 | 2 | 2 |
| Acciones primarias | 2 | 2 | 1 | 1 | 2 | 2 |
| No-scroll SLA | 2 | 2 | 1 | 1 | 1 | 1 |
| Densidad funcional | 2 | 2 | 2 | 1 | 2 | 2 |
| Rol/proceso | 2 | 2 | 2 | 2 | 2 | 2 |
| Mobile / responsive | 2 | 2 | 2 | 1 | 2 | 2 |
| Trazabilidad/estado | 2 | 2 | 2 | 2 | 2 | 2 |
| Consistencia (OS) | 2 | 2 | 1 | 1 | 1 | 1 |
| Accesibilidad básica | 2 | 2 | 2 | 2 | 2 | 2 |
| Riesgo técnico | 3 | 2 | 2 | 2 | 2 | 2 |

**Lectura:** ninguna superficie alcanza **supremo** hoy. Bloqueos críticos principales:
- **Admin (D/M):** navegación = 1 (módulos escondidos) → desbloquea **PR-GD1**.
- **Clínica (D/M):** navegación/acciones/no-scroll = 1 → **PR-GD2/GD3/GD4/GD6**.
- **Particulares (D/M):** no-scroll/consistencia = 1 → **PR-GD7/GD8** (sin backend).

Objetivo del roadmap: llevar todas las categorías críticas a **≥2** y las superficies prioritarias
a **3**.

---

## 15. Global Acceptance Criteria (checklist)

- [ ] **Todos los dashboards críticos cubiertos** (admin/clínica/particulares).
- [ ] **Desktop y mobile definidos** por superficie.
- [ ] **Admin/clínica/particulares diferenciados** (sin copiar complejidad entre roles).
- [ ] **Módulos críticos a 1 paso.**
- [ ] **Acciones primarias visibles.**
- [ ] **Sin doble hop injustificado.**
- [ ] **Sin wrappers sin valor.**
- [ ] **Sin scroll operativo injustificado** (cumple SLA §8).
- [ ] **Mobile con acción primaria a máximo 1 gesto.**
- [ ] **Particulares sin complejidad interna.**
- [ ] **Sin cambios backend/API/auth/DB/deps/lockfiles/CI.**
- [ ] **Validaciones por PR definidas** (tests/lint/typecheck/build/e2e/screenshots según tipo).

---

## 16. Global Governance Rules (vinculantes)

1. **Ningún dashboard nuevo puede violar el Global Functional Contract** (§5).
2. **Ningún rediseño se justifica solo por estética.**
3. **Ningún módulo crítico queda fuera de la navegación principal.**
4. **Ningún hub es paso obligatorio** si hay navegación directa.
5. **Ningún wrapper existe si solo redirige.**
6. **Ningún mobile depende de navegación crítica escondida** (scroll lateral como única vía).
7. **Ningún particulares copia complejidad interna** (módulos/datos internos).
8. **Ningún PR grande de rediseño total.**
9. **Cada PR cierra una fricción observable** y trae su evidencia.
10. **Cada PR declara dashboard, superficie, rol, SLA objetivo y evidencia.**
11. **No introducir un paradigma de navegación sin retirar/absorber el anterior** (causa raíz de
    la deuda actual).

---

## 17. Final Approval Decision

1. **Aprobación condicionada a cobertura global:** el documento queda aprobado solo en tanto cubre
   admin/clínica/particulares en desktop/mobile (cumplido en esta versión).
2. **PR-GD0 commitea este estándar global** como baseline (docs-only).
3. **Primer PR de implementación: PR-GD1** (navegación canónica admin/clínica; módulos críticos a
   1 paso) — **≡ PR-ME1/PR-UX1**, máximo valor/riesgo.
4. **Particulares requiere auditoría específica (PR-GD7)** antes de implementación (PR-GD8); su
   alcance es solo frontend, **sin tocar backend/API/auth/DB**.
5. **Objetivo final:** trasladar el estándar globalmente a todas las superficies, llevando las
   categorías críticas del scorecard a ≥2 y las superficies prioritarias a nivel supremo (3).
6. **No avanzar a implementación hasta fijar este baseline global (PR-GD0).** Mantener el roadmap
   incremental; un problema observable por PR, con evidencia, sin tocar backend.

---

## 18. Supreme Quality Gates and Evidence Protocol

> Capa de aprobación **bloqueante y verificable** sobre el VETNEB Global Dashboard Operating
> System. Convierte el estándar en *quality gates* ejecutables para cualquier PR de dashboard.
> No persigue estética: persigue **capacidad operativa verificable**.

### 18.1 Purpose

Este protocolo existe para **evitar aprobar cambios que solo modifican layout o estética sin
cerrar una fricción operativa observable**. Declara, con carácter vinculante:

- **Ningún PR de dashboard se aprueba por "verse mejor".**
- **Todo PR debe probar mejora funcional** (menos pasos, menos cambio de contexto, más visibilidad
  de acción/estado/detalle/navegación).
- **Todo PR debe declarar** dashboard, rol, superficie, flujo afectado, SLA objetivo (§8) y
  evidencia (§18.7).
- **La evidencia debe ser suficiente para revisar sin interpretación subjetiva**: un revisor debe
  poder verificar el cierre de fricción con la evidencia adjunta, no con criterio estético.

### 18.2 Definition of Supreme Done

Un PR de dashboard solo es **"supreme done"** si cumple **todas** estas condiciones (cualquier
incumplimiento bloquea el merge):

- [ ] **Cierra una fricción observable** declarada en el PR.
- [ ] **Reduce pasos o reduce cambio de contexto** (medible: pasos antes → después).
- [ ] **Mejora la visibilidad** de acción primaria, estado, detalle o navegación.
- [ ] **Mantiene o mejora mobile** (no degrada densidad/persistencia táctil).
- [ ] **Mantiene o mejora desktop** (no introduce scroll operativo).
- [ ] **No introduce un nuevo paradigma** sin retirar/absorber el anterior.
- [ ] **No agrega wrappers sin valor.**
- [ ] **No esconde acciones críticas.**
- [ ] **No introduce scroll operativo injustificado** (cumple SLA §8).
- [ ] **No toca** backend/API/auth/DB/deps/lockfiles/CI salvo autorización explícita.
- [ ] **Incluye evidencia antes/después** cuando aplique (§18.5/§18.6).

### 18.3 Golden Flows by Role

Flujos dorados que deben auditarse y **protegerse de regresión**. "Paso actual" = estado
verificado hoy; "Paso objetivo" = estándar del OS. **Particulares: donde la aplicación del
contrato del OS no fue auditada en código, se marca `pendiente PR-GD7` — no se inventa.**

#### Administrador

| Flujo | Superficie | Paso actual | Paso objetivo | Fricción a detectar | Evidencia requerida | PR |
|---|---|---|---|---|---|---|
| Estado/supervisión general | D/M | Hub o `?module=admin` | 1 click en nav | Resumen no es paso obligatorio | Screenshot nav + resumen | GD1/GD2 |
| Acceder a Clínicas | D/M | Nav "Clínicas" (1 click) ✅ | Mantener | — (proteger) | e2e navegación | GD1 |
| Acceder a Usuarios | D/M | Nav "Usuarios" (1 click) ✅ | Mantener; etiqueta única | Etiqueta nav≠hub ("Roles clínica") | Screenshot nav | GD1 |
| Acceder a Sesiones | D/M | Nav "Sesiones" (1 click) ✅ | Mantener | — | e2e | GD1 |
| Acceder a Auditoría | D/M | Nav "Auditoría" (1 click) ✅ | Mantener | — | e2e | GD1 |
| Acceder a Precios | D | **Volver al hub → tile** | 1 click en nav | **Módulo escondido** | Screenshot nav con "Precios" | GD1 |
| Acceder a Mantenimiento | D | **Volver al hub → tile** | 1 click en nav | **Módulo escondido** | Screenshot nav con "Mantenimiento" | GD1 |
| Revisar Estado del sistema | D | **Volver al hub → tile** | 1 click en nav | **Módulo escondido** | Screenshot nav con "Estado" | GD1 |
| Revisar alertas (intentos fallidos) | D/M | Tab Alertas en resumen ✅ | Mantener visible | Alertas no priorizadas | Screenshot status strip | GD5 |
| Cambiar entre módulos críticos | D | **Doble hop por hub** | Salto directo por nav | "Volver a módulos" obligatorio | e2e cambio directo | GD2 |

Evidencia base: [DashboardHorizontalNav.tsx:20-28](frontend/src/components/dashboard/DashboardHorizontalNav.tsx),
[AdminDashboardWorkspaceController.tsx:294-379](frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx),
[DashboardModuleWorkspace.tsx:29-38](frontend/src/components/dashboard/DashboardModuleWorkspace.tsx).

#### Clínica

| Flujo | Superficie | Paso actual | Paso objetivo | Fricción a detectar | Evidencia requerida | PR |
|---|---|---|---|---|---|---|
| Cargar estudio | D/M | Modal de carga (`UploadReportModal`) | Acción primaria visible | Acción primaria no estandarizada | Screenshot acción primaria | GD5 |
| Seguir estudio | D/M | `StudyTimeline` en detalle | Detalle estable (no inline gigante) | Página infinita inline | e2e detalle estable | GD4 |
| Ver pendientes | D/M | KPIs del `ClinicCommandCenter` ✅ | Mantener visibles | Pendientes ocultos tras scroll | Screenshot status strip | GD5 |
| Consultar informe | D | **Detalle inline gigante** | Master-detail estable | **Página infinita / scroll largo** | e2e selección+paginación | GD4 |
| Resolver logística | D/M | Ruta `/dashboard/logistica` ✅ | Acceso directo desde nav | Wrapper intermedio | e2e nav→logística | GD3 |
| Acción frecuente del módulo | D/M | Variable por módulo | Acción primaria visible | No estandarizada | Screenshot | GD5 |
| Cambiar entre informes/logística/seguimiento | D/M | **Wrapper redirector** (`?module=informes`/`logistica`) | Un destino por módulo | **Wrapper sin valor** | e2e un destino | GD3 |

Evidencia base: [informes/page.tsx:508-621](frontend/src/app/dashboard/informes/page.tsx),
[ClinicInformesWorkspaceSummary.tsx:30-52](frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx),
[ClinicLogisticaWorkspaceSummary.tsx:30-52](frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx).

#### Particulares

| Flujo | Superficie | Paso actual | Paso objetivo | Fricción a detectar | Evidencia requerida | PR |
|---|---|---|---|---|---|---|
| Consultar estado | D/M | Etapas reception→delivered ✅ | Estado priorizado, simple | Estado apilado en página larga | Screenshot estado | GD8 |
| Entender próximo paso | D/M | PARCIAL (mensajes de disponibilidad) | "Next-step zone" explícita | Próximo paso no explícito | `pendiente PR-GD7` (auditoría dedicada) | GD7→GD8 |
| Ver/descargar resultado (si aplica) | D/M | `openReport(preview/download)` ✅ | Acción primaria a ≤1 gesto | Acción tras scroll largo | Screenshot acción mobile | GD8 |
| Contactar / seguir instrucción | D/M | WhatsApp/email (tinción especial) ✅ | Mantener accesible | Contacto enterrado | Screenshot contacto | GD8 |
| Operar desde mobile sin complejidad interna | M | Layouts flat ✅; sin exposición interna ✅ | SLA-2 "simple, no largo" | **Página larga** (fuera del App Shell) | `pendiente PR-GD7` (SLA particular) | GD7→GD8 |

Evidencia base: [ParticularesContent.tsx:83-95,487-517,527-531,612-925](frontend/src/components/public/ParticularesContent.tsx).
**Nota:** la superficie particular es una página pública token-gated, no un dashboard del App
Shell; la aplicación completa del SLA del OS requiere la auditoría dedicada **PR-GD7** antes de
PR-GD8. No se asume comportamiento no verificado.

### 18.4 Blocking Scorecard

Rúbrica de puntuación por categoría (aplica por superficie afectada del PR). **0** incumple ·
**1** básico/no enterprise · **2** enterprise aceptable · **3** multinacional/supremo.

| Categoría | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Navegación canónica | Módulo crítico fuera de nav | Nav existe pero incompleta/duplicada | Nav única completa | Única + consistente desktop/mobile por rol |
| Acción primaria visible | Escondida | Presente con fricción | Visible en toolbar | Visible + contextual por módulo |
| No-scroll operativo | Página infinita / acción tras scroll | Scroll lateral como nav (SLA-1) | SLA-2 | SLA-3 |
| Densidad funcional | Repetición/wrappers | Compresión sin criterio | Capacidad operativa adecuada | Multipanel/táctico óptimo |
| Mobile táctico | Desktop encogido | Funciona con fricción | Navegación/acción accesible | Persistente a ≤1 gesto |
| Desktop multipanel (cuando aplica) | Apilado vertical | Single-panel forzado | Master-detail/tabs | Multipanel estable |
| Estado/trazabilidad visible | Ausente | Presente pero enterrado | Visible | Priorizado en status strip |
| Reducción de cambio de contexto | Aumenta hops | Sin cambio | Reduce hops | Cero hop innecesario |
| Consistencia admin/clínica/particulares | Diverge | Parcial | Coherente | Coherente + por rol |
| Accesibilidad básica | Sin foco/aria | Parcial | Foco/aria/roles OK | + orden lógico verificado |
| Regresión técnica | Rompe tests/build | Riesgo alto | Controlado | Bajo riesgo + guardrails |
| Evidencia presentada | Ninguna | Insuficiente | Antes/después | Antes/después + métrica de pasos |

**Reglas de bloqueo:**
- **Ningún PR se mergea si una categoría crítica queda en 0.**
- **Ningún dashboard se declara "supremo" si navegación, acción primaria, no-scroll o mobile
  quedan en 0 o 1.**
- **Si el PR no presenta evidencia, la categoría "evidencia" = 0** (bloquea).
- **Si el PR solo mejora estética sin mejora funcional, score máximo permitido = 1** (no
  aprobable).

### 18.5 Evidence Matrix (evidencia mínima por tipo de PR)

| Tipo de PR | Lint | Typecheck | Build | Test unit. | e2e/screenshot test | Screenshot D antes/después | Screenshot M antes/después | Revisión manual | Evidencia no-scroll | Evidencia no regresión |
|---|---|---|---|---|---|---|---|---|---|---|
| **docs-only** | — | — | — | — | — | — | — | Revisión documental | — | — |
| **navegación** | ✅ | ✅ | ✅ | ✅ (contrato nav) | ✅ | ✅ | ✅ | ✅ | ✅ | `pnpm test` verde |
| **layout/estructura** | ✅ | ✅ | ✅ | ✅ si pinea | ✅ | ✅ | ✅ | ✅ | ✅ | tests de contrato |
| **mobile density** | ✅ | ✅ | ✅ | ✅ si aplica | ✅ (390×844) | opcional | ✅ | ✅ | ✅ | e2e mobile |
| **master-detail/detail region** | ✅ | ✅ | ✅ | ✅ | ✅ (selección+paginación) | ✅ | ✅ | ✅ | ✅ | filtros/URL preservados |
| **command layer/actions** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | tests por módulo |
| **particulares** | ✅ | ✅ | ✅ | ✅ si aplica | ✅ | ✅ | ✅ | ✅ | ✅ (SLA-2) | sin cambios de API/datos |
| **deuda/limpieza** | ✅ | ✅ | ✅ | ✅ (suite) | — | — | — | grep refs=0 | — | suite verde |

Higiene obligatoria (memoria `project-test-guardrails`): commitear antes de validar; borrar
`frontend/.next` antes de e2e tras CSS; restaurar `next-env.d.ts` tras e2e.

### 18.6 Screenshot and Review Protocol

- **Capturar desktop y mobile** ante cualquier cambio visual/operativo.
- **Antes y después** de la fricción intervenida.
- **Estado inicial y estado con interacción crítica** (p.ej. detalle abierto, navegación abierta).
- **Navegación abierta** si el PR la toca (nav con módulo activo / bottom-nav).
- **Acción primaria visible** capturada en el viewport inicial.
- **Caso de lista/detalle** si aplica (selección + paginación preservando selección).
- **Mobile real o viewport representativo** (390×844 mínimo).
- **Prohibido aprobar solo con un screenshot "bonito"**: cada captura se acompaña del criterio
  funcional que demuestra (paso eliminado, acción ahora visible, scroll eliminado).

### 18.7 PR Declaration Template

Cada PR de dashboard debe completar, en la descripción:

```
Dashboard afectado:      [admin | clínica | particulares | todos]
Rol:                     [admin | clínica | particular]
Superficie:              [desktop | mobile | ambas]
Flujo afectado:          [golden flow de §18.3]
Fricción observable:     [qué fricción cierra, medible]
SLA objetivo:            [SLA-2 | SLA-3]
Score antes:             [categorías críticas 0–3]
Score después:           [categorías críticas 0–3]
Archivos tocados:        [lista]
Fuera de alcance:        [backend/API/auth/DB/deps/CI declarados intactos]
Evidencia:               [screenshots/e2e/tests adjuntos]
Validaciones:            [lint/typecheck/build/test/e2e ejecutados]
Riesgo:                  [bajo | medio | alto + mitigación]
Rollback:                [cómo revertir; revert del PR / flag]
Criterio de aceptación:  [verificable, no subjetivo]
```

### 18.8 Approval / Rejection Rules

**Aprobar solo si:**
- Cierra una fricción observable.
- Respeta el Global Functional Contract (§5).
- Mantiene el scope declarado.
- Presenta evidencia suficiente (§18.5).
- No introduce regresión desktop/mobile.
- No rompe tests, typecheck ni build.
- No toca áreas prohibidas (backend/API/auth/DB/deps/lockfiles/CI).

**Rechazar si:**
- Es cambio cosmético sin valor funcional.
- Agrega un nuevo paradigma paralelo (sin retirar el anterior).
- Esconde acciones críticas.
- Agrega wrappers vacíos.
- Genera más scroll operativo.
- Reduce mobile (densidad/persistencia).
- Reduce accesibilidad.
- Mezcla backend/API/auth/DB/deps sin autorización.
- Es un PR grande sin necesidad (rediseño total).

### 18.9 Dashboard Regression Guardrails

Invariantes que ningún PR puede violar (candidatas a tests de governance — PR-GD10):

1. **Los módulos críticos no pueden desaparecer de la navegación canónica.**
2. **El hub no puede volver a ser paso obligatorio** si existe navegación directa.
3. **Wrappers sin valor deben eliminarse o justificarse** explícitamente.
4. **Los detalles densos no expanden páginas infinitas** (master-detail estable).
5. **Mobile no depende de scroll lateral** como única navegación crítica.
6. **Particulares no copia complejidad interna** (módulos/datos internos).
7. **Todo cambio declara** si afecta admin, clínica, particulares o todos (§18.7).

### 18.10 Supreme Quality Rollout

| Orden | PR | Alcance |
|---|---|---|
| 1 | **PR-GD0** | Baseline global + supreme gates (docs-only) — **este documento**. |
| 2 | **PR-GD1** | Navegación canónica admin/clínica (módulos críticos a 1 paso). ≡ PR-ME1/PR-UX1. |
| 3 | **PR-GD2** | Eliminación de doble hop / hub no obligatorio. |
| 4 | **PR-GD3** | Wrappers clínica. |
| 5 | **PR-GD4** | Master-detail informes. |
| 6 | **PR-GD5** | Command layer por módulo. |
| 7 | **PR-GD6** | Mobile density admin/clínica. |
| 8 | **PR-GD7** | Auditoría de particulares (docs-only). |
| 9 | **PR-GD8** | Aplicación del estándar a particulares (frontend-only, sin backend). |
| 10 | **PR-GD9** | Limpieza sidebars/paradigmas. |
| 11 | **PR-GD10** | Tests/evidencia automatizable (governance). |

### 18.11 Final Gate Statement

**VETNEB no aprueba dashboards por apariencia. Los aprueba por capacidad operativa verificable,
reducción de fricción, consistencia global, cumplimiento del SLA no-scroll y evidencia.** Un
cambio que solo "se ve mejor" sin cerrar una fricción observable, sin reducir pasos y sin
evidencia, **no es mergeable** bajo este protocolo, cualquiera sea su calidad visual. La calidad
suprema se mide en productividad y control, no en estética.

---

## 19. Frontier Technology Evaluation and Adoption Policy

> Política de adopción de tecnología de punta **subordinada a la operación**. Define qué se puede
> adoptar, bajo qué condiciones, con qué riesgos, qué validaciones y en qué orden. **No** es una
> lista de modas: cada tecnología debe cerrar fricción operativa observable o mejorar evidencia/
> calidad verificable. Esta sección **no autoriza implementación**; ninguna adopción ocurre sin su
> propio PR y autorización explícita (deps/lockfiles/CI no se tocan sin autorización).

### 19.1 Purpose

VETNEB solo adopta tecnología de punta cuando **simultáneamente**:
- cierra una fricción operativa observable (golden flow §18.3),
- mejora evidencia o calidad verificable (§18.5),
- reduce riesgo de regresión,
- mejora rendimiento o densidad funcional,
- mejora accesibilidad,
- mejora trazabilidad u observabilidad,
- **no** compromete privacidad,
- **no** agranda innecesariamente la superficie de riesgo.

Prohibiciones explícitas:
- **Prohibido adoptar tecnología por moda.**
- **Prohibido adoptar tecnología solo por estética.**
- **Prohibido introducir dependencias sin un PR específico** (y autorización; el protocolo del
  proyecto veda tocar deps/lockfiles/CI sin permiso explícito).
- **Prohibido mezclar adopción tecnológica con cambios funcionales grandes** sin justificación.

### 19.2 Technology Adoption Gate

Toda tecnología nueva pasa por esta gate **antes** de cualquier código. La propuesta declara:

```
Tecnología:                [nombre]
Problema operativo:        [fricción observable que resuelve]
Dashboard/superficie:      [admin | clínica | particulares | todos · D/M]
Rol afectado:              [admin | clínica | particular]
Valor esperado:            [productividad/evidencia/perf/a11y/observabilidad]
Riesgo técnico:            [bajo | medio | alto]
Riesgo de privacidad:      [ninguno | bajo | alto + detalle]
Impacto en seguridad:      [superficie de riesgo añadida]
Impacto en performance:    [bundle/render/red]
Impacto en accesibilidad:  [mejora | neutro | riesgo]
Dependencias nuevas:       [sí/no + cuáles]
Rollback:                  [cómo revertir]
Validaciones:              [lint/typecheck/build/test/e2e]
Evidencia requerida:       [§18.5]
PR scope:                  [aislado, sin mezclar funcional grande]
Decisión:                  [approved | conditional | deferred | rejected]
```

### 19.3 Approved First-Wave Technologies

Candidatas de primera ola. **Aprobadas como evaluación/adopción acotada — no implementadas aún.**

1. **Playwright visual/operational evidence**
   - *Uso:* screenshots desktop/mobile antes/después; verificación de acción primaria visible;
     evidencia de navegación; evidencia de no-scroll operativo; comparación de flujos críticos.
   - *Valor:* evita aprobar cambios sin impacto visible/operativo (cierra el hueco de §18.6).
   - *Riesgo:* **bajo.** Playwright **ya está en el stack** (e2e
     `dashboard-viewport-zoom-adaptability.spec.ts`, `admin-mobile-*-no-scroll.spec.ts`); el costo
     marginal es de uso, no de dependencia nueva.
   - *Condición:* PR separado; no mezclar con rediseño funcional grande.

2. **Accessibility automation (axe-core / Playwright a11y checks)**
   - *Uso:* detectar problemas WCAG básicos; complementar revisión manual; validar navegación,
     dialogs, tabs, menus, drawers y forms.
   - *Valor:* calidad enterprise verificable; complementa los tests de foco/aria ya existentes
     (`frontend-dashboard-accessibility-focus-aria`).
   - *Riesgo:* **bajo/medio** (introduce dependencia dev → requiere PR de deps autorizado).
   - *Condición:* **no sustituye** la revisión manual de accesibilidad.

3. **TanStack Table / TanStack Virtual (evaluación para listas densas)**
   - *Uso:* informes, auditoría, clínicas, usuarios, sesiones, seguimiento/logística si aplica.
   - *Valor:* sorting/filtering/selection/pagination, virtualización, master-detail, reducción de
     página infinita.
   - *Riesgo:* **medio** (bundle + migración).
   - *Condición:* **primero evaluar las primitivas existentes y el costo de migración.** La
     auditoría algorítmica previa (`docs/audit/2026-06-22-...`) ya recomendó **diferir** TanStack
     Table porque `usePagedRows`/`ModuleTabs`/tablas densas cubren densidad/paginación/no-scroll;
     esta evaluación debe demostrar ROI sobre esas primitivas y **no** implica reescritura masiva.
     Atado a la dependencia del contrato no-scroll (`PAGE_SIZE` reales = PR de contrato aparte).

4. **TanStack Query / auditoría de server-state**
   - *Uso:* cache, invalidación, consistencia loading/error, estados optimistic/pending si aplica.
   - *Valor:* mayor fluidez y consistencia de estados.
   - *Riesgo:* **medio.**
   - *Condición:* el repo ya usa **React Server Components + fetch `cache: "no-store"` + paginación
     server-side** (p.ej. [AdminClinicsManagementCard.tsx](frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx),
     `searchReportsPaginated`). **No introducir** si la estrategia actual es suficiente sin ROI
     justificado; primero auditar (FT-4).

5. **Storybook / documentación-testing de componentes**
   - *Uso:* global nav, command layer, status strip, master-detail, mobile action zone,
     empty/loading/error states.
   - *Valor:* gobernanza de componentes (§9).
   - *Riesgo:* **medio** (costo de mantenimiento).
   - *Condición:* **diferir hasta estabilizar PR-GD1…PR-GD6**; sin él los componentes aún cambian.

### 19.4 Conditional Technologies

Adopción **condicionada** a revisión específica y autorización.

1. **Observability — OpenTelemetry / Sentry / PostHog / Microsoft Clarity**
   - *Uso potencial:* errores reales, performance, session replay, funnels, adopción de flujos,
     fricción real.
   - *Riesgos:* **privacidad**, datos sensibles (informes/pacientes/tutores), session replay,
     exposición accidental, costo/mantenimiento.
   - *Condición:* **privacy review obligatorio**; **masking obligatorio**; **no capturar datos
     sensibles**; opt-in/consentimiento si corresponde; configuración por entorno; **PR separado**;
     **autorización explícita** antes de implementar. Especialmente sensible en la superficie
     particular (datos de tutor/mascota/informe) — cualquier captura ahí exige masking estricto.

2. **Next.js / React major upgrade**
   - *Uso potencial:* performance, caching, navegación, rendering, mejores estados de UI.
   - *Riesgo:* **alto** (compatibilidad; toca `package.json`/lockfile → fuera del alcance actual).
   - *Condición:* auditoría de stack; branch aislada; matriz de regresión; pruebas completas;
     **no mezclar con UX de dashboard**.

3. **React Compiler / optimizaciones de build avanzadas**
   - *Uso potencial:* reducir renders innecesarios.
   - *Riesgo:* **medio/alto** según versión/compatibilidad.
   - *Condición:* **solo tras** auditoría de la versión React/Next actual (FT-7).

4. **View Transitions / APIs de animación avanzadas**
   - *Uso potencial:* continuidad cognitiva entre lista/detalle o cambio de módulo.
   - *Riesgo:* **bajo/medio** si se usa mal.
   - *Condición:* **solo si reduce desorientación**; **prohibido como ornamentación**. No debe
     reintroducir decoración vetada por §11/§16.

### 19.5 Deferred / Not Approved Technologies

1. **IA dentro de los dashboards de producto** — **Diferido.**
   - *Motivo:* alto riesgo de alcance, privacidad y expectativas.
   - *Condición futura:* solo tras consolidar flujos, datos, permisos, seguridad y observabilidad;
     requiere caso de uso concreto, revisión de privacidad y autorización explícita.

2. **Nuevas librerías visuales/de diseño solo por apariencia** — **Rechazado.**
   - *Motivo:* no resuelve operación; aumenta deuda y dependencia.
   - *Condición:* reconsiderar **solo** si resuelve accesibilidad, interacción o consistencia
     funcional.

3. **Migración de framework grande** — **Diferido.**
   - *Motivo:* alto riesgo.
   - *Condición:* solo con auditoría técnica, plan de rollback y pruebas completas.

4. **Session replay sin controles de privacidad** — **Rechazado.**
   - *Motivo:* riesgo de datos sensibles.
   - *Condición:* solo con masking, consentimiento/configuración y revisión explícita.

### 19.6 Frontier Technology Roadmap (separado del roadmap funcional PR-GD)

| FT | Objetivo | Valor | Riesgo | Dependencias | Autorización | Evidencia | Cuándo ejecutar |
|---|---|---|---|---|---|---|---|
| **FT-0** | Documentar esta política | Gobernanza | Nulo | No | — | Este documento | Ahora (con PR-GD0) |
| **FT-1** | Evaluar Playwright visual/operational evidence | Evita cambios sin impacto | Bajo | No (ya en stack) | Estándar | Specs de evidencia | Junto a PR-GD1 |
| **FT-2** | Evaluar axe/a11y checks | Calidad verificable | Bajo/medio | **Sí (dev)** | **Explícita (deps)** | Reporte a11y | Tras PR-GD1 |
| **FT-3** | Auditar listas densas → TanStack Table/Virtual vs primitivas | Densidad/virtualización | Medio | Sí | **Explícita** | Comparativa ROI | Tras PR-GD4 |
| **FT-4** | Auditar server-state/loading/error | Consistencia de estados | Medio | Posible | **Explícita** | Auditoría de estado | Tras PR-GD5 |
| **FT-5** | Definir observability/privacy plan | Fricción real medible | Medio/alto (privacidad) | Sí | **Explícita + privacy review** | Plan + masking | Tras PR-GD6 |
| **FT-6** | Evaluar Storybook/component governance | Gobernanza de componentes | Medio | Sí | **Explícita** | Inventario de componentes | Tras estabilizar GD1–GD6 |
| **FT-7** | Auditar upgrade Next/React | Perf/rendering | Alto | Sí (core) | **Explícita** | Matriz de regresión | Branch aislada, fuera de UX |
| **FT-8** | Diferir IA hasta madurez | — | Alto | Sí | **Explícita + caso de uso** | — | Solo tras GD + observability + privacidad |

### 19.7 Adoption Decision Matrix

| Tecnología | Estado | Valor operativo | Riesgo | Privacidad | Dependencias | Orden | Motivo |
|---|---|---|---|---|---|---|---|
| Playwright screenshot/evidence | **approved** | Alto (evidencia §18) | Bajo | Ninguno | No (ya en stack) | FT-1 | Cierra el hueco de evidencia sin dep nueva |
| axe-core / a11y checks | **approved** (cond. dep) | Medio-alto | Bajo/medio | Ninguno | **Sí (dev)** | FT-2 | Calidad a11y verificable; no reemplaza manual |
| TanStack Table / Virtual | **conditional** | Medio-alto | Medio | Ninguno | Sí | FT-3 | Default a primitivas propias salvo ROI probado |
| TanStack Query / server-state audit | **conditional** | Medio | Medio | Ninguno | Posible | FT-4 | RSC + server-side ya cubren; auditar primero |
| Storybook / component governance | **deferred** | Medio | Medio (mant.) | Ninguno | Sí | FT-6 | Esperar estabilización GD1–GD6 |
| OTel / Sentry / PostHog / Clarity | **conditional** | Alto (fricción real) | Medio/alto | **Alto** | Sí | FT-5 | Privacy review + masking obligatorios |
| Next/React major upgrade | **conditional** | Medio | Alto | Ninguno | Sí (core) | FT-7 | Branch aislada; no mezclar con UX |
| React Compiler | **conditional** | Medio | Medio/alto | Ninguno | Sí | post-FT-7 | Solo tras auditar versión actual |
| View Transitions | **conditional** | Bajo/medio | Bajo/medio | Ninguno | No (API nativa) | post-GD4 | Solo si reduce desorientación; no ornamento |
| IA dentro de dashboards | **deferred** | Incierto | Alto | **Alto** | Sí | FT-8 | Requiere madurez + caso de uso + privacidad |
| Nuevas librerías visuales (apariencia) | **rejected** | Nulo operativo | Medio | Ninguno | Sí | — | No resuelve operación; suma deuda |
| Session replay sin masking | **rejected** | Bajo | Alto | **Crítico** | Sí | — | Riesgo de datos sensibles |

### 19.8 PR Requirements for Technology Adoption

Todo PR tecnológico debe declarar explícitamente:
- si toca **dependencias** (package.json / lockfile),
- si toca **configuración**,
- si toca **CI**,
- si toca **runtime**,
- si afecta **privacidad**,
- si afecta **seguridad**,
- si afecta **bundle/performance**,
- si requiere **feature flag**,
- **rollback**,
- **pruebas obligatorias** (lint/typecheck/build/test/e2e según §18.5).

**Recordatorio de protocolo (vinculante):** `package.json`, `pnpm-lock.yaml`, workflows de CI y
configuración **no pueden tocarse sin autorización explícita**. Un PR tecnológico que requiera
dependencias es, por definición, un PR de deps autorizado por separado — nunca colateral a un PR
funcional.

### 19.9 Final Technology Policy Statement

**VETNEB adoptará tecnología de punta solo si aumenta capacidad operativa verificable.** La
tecnología debe **servir a la consola global** —productividad, evidencia, observabilidad,
accesibilidad, performance, densidad funcional, seguridad y escalabilidad— y **no** sustituir el
diseño funcional, la evidencia ni la gobernanza. Ninguna herramienta moderna, IA incluida, se
adopta por moda o estética; cada una pasa la Adoption Gate (§19.2), trae su evidencia y respeta el
veto de deps/CI sin autorización.

---

## Anexo A — Índice de evidencia (file:line)

| Hallazgo | Estado | Ubicación |
|---|---|---|
| Shell sin sidebar + bottom-nav solo admin | EXISTENTE | [DashboardShellRouter.tsx:20-39](frontend/src/components/dashboard/DashboardShellRouter.tsx) |
| Nav horizontal embebida en topbar | EXISTENTE | [DashboardTopbar.tsx:160](frontend/src/components/dashboard/DashboardTopbar.tsx) |
| Nav admin 7 / clínica 5 ítems | EXISTENTE | [DashboardHorizontalNav.tsx:20-36](frontend/src/components/dashboard/DashboardHorizontalNav.tsx) |
| Hub admin 10 tiles (divergencia con nav) | CONSOLIDABLE | [AdminDashboardWorkspaceController.tsx:294-379](frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx) |
| Hub clínica 5 tiles | CONSOLIDABLE | [ClinicDashboardWorkspaceController.tsx:165-224](frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx) |
| Hero ornamental | CONSOLIDABLE | [DashboardHubHero.tsx:50-59](frontend/src/components/dashboard/DashboardHubHero.tsx) |
| Doble hop "Volver a módulos" | CONSOLIDABLE | [DashboardModuleWorkspace.tsx:29-38](frontend/src/components/dashboard/DashboardModuleWorkspace.tsx) |
| Wrapper redirector Informes | DUPLICADO | [ClinicInformesWorkspaceSummary.tsx:30-52](frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx) |
| Wrapper redirector Logística | DUPLICADO | [ClinicLogisticaWorkspaceSummary.tsx:30-52](frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx) |
| Detalle inline gigante + `PAGE_SIZE=6` | CONSOLIDABLE | [informes/page.tsx:44,508-621](frontend/src/app/dashboard/informes/page.tsx) |
| Tabla densa clínicas server-side `PAGE_SIZE=9` | EXISTENTE | [AdminClinicsManagementCard.tsx:55](frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx) |
| Bottom-nav admin (sin equivalente clínica) | EXISTENTE / asimetría | [AdminMobileBottomNav.tsx](frontend/src/components/dashboard/AdminMobileBottomNav.tsx) |
| Densidad fluida `--dash-*` | EXISTENTE | [globals.css:2052-2207](frontend/src/app/globals.css) |
| Master-detail / Sticky action bar (subutilizados) | CONSOLIDABLE | [MasterDetailWorkspace.tsx](frontend/src/components/dashboard/MasterDetailWorkspace.tsx), [StickyActionBar.tsx](frontend/src/components/dashboard/StickyActionBar.tsx) |
| Particulares = página pública token-gated (no dashboard) | EXISTENTE, fuera del OS | [particulares/page.tsx](frontend/src/app/particulares/page.tsx) |
| Particulares: seguimiento + ver/descargar + contacto + mobile flat | EXISTENTE | [ParticularesContent.tsx:83-95,487-517,612-925](frontend/src/components/public/ParticularesContent.tsx) |
| Particulares: no expone complejidad interna | EXISTENTE (por diseño) | [ParticularesContent.tsx:527-531](frontend/src/components/public/ParticularesContent.tsx) |
| Sidebars huérfanos blindados por test | HUÉRFANO | [frontend-dashboard-horizontal-nav.test.ts:115-123](test/frontend-dashboard-horizontal-nav.test.ts) |
| Contrato nav admin (includes, no exclusión) | — | [frontend-dashboard-horizontal-nav.test.ts:41-64](test/frontend-dashboard-horizontal-nav.test.ts) |

---

## Anexo B — Confirmación de alcance

- ✅ **No se modificó código** (solo lectura durante la auditoría/arquitectura).
- ✅ **No se crearon archivos nuevos ni commits ni PRs.**
- ✅ **No se tocó backend/API/auth/DB/migraciones/deps/lockfiles/CI.** Sin invención de
  permisos/datos/endpoints.
- ✅ Único artefacto modificado: `docs/audit/product-ux-dashboard-audit.md`.
- ✅ Específico al código real (`file:line` verificados a 2026-06-24), incluida la superficie
  particular.
- ✅ Hallazgo central preservado: consolidar paradigmas, no reescribir el shell.
- ✅ Primer paso de implementación preservado: **PR-GD1 ≡ PR-ME1/PR-UX1** (paridad de módulos en
  la nav).
- ✅ Cobertura global: 6 superficies (admin/clínica/particulares × desktop/mobile), con
  particulares explícitamente marcado como **EXISTENTE fuera del OS** y su aplicación como
  **frontend-only / sin backend**.

## PR-GD4 — Sidebar / orphan navigation contract

Decision:
- DashboardSidebarFrame, ClinicDashboardSidebar and AdminDashboardSidebar remain legacy/shared navigation components covered by tests, but they must not be reintroduced as the primary dashboard shell navigation.
- Desktop dashboard navigation must remain the canonical horizontal navigation contract.
- Admin mobile navigation must remain the dedicated bottom navigation contract.
- Clinic dashboard navigation must remain inside the current in-shell module navigation contract.
- Future sidebar work must prove that it does not create parallel navigation, duplicate hierarchy, or a double-hop path.

Scope:
- Documentation-only contract.
- No production code changes.
- No backend/API/auth/DB/migrations/deps/lockfiles/CI/config changes.
- No dashboard visual redesign.

Acceptance:
- The current dashboard shell remains no-sidebar as primary navigation.
- Existing sidebar components stay governed by tests but are not promoted back into the primary shell.
- Any future change must preserve no-scroll SLA and role-specific navigation separation.

## PR-GD5 — Canonical module ids / legacy aliases contract

Decision:
- Dashboard `?module=` navigation must use canonical module ids for all new links, tests, and documentation.
- Legacy aliases may remain only as compatibility inputs when already covered by tests.
- New UI surfaces must not introduce new aliases or duplicate ids.
- Any future alias must be documented here before implementation.

Clinic canonical module ids:
- `operaciones`
- `informes`
- `logistica`
- `perfil`
- `tokens`

Admin canonical module ids:
- `admin`
- `admin-report-upload`
- `admin-health`
- `admin-clinics`
- `admin-particular-tokens`
- `admin-pricing`
- `admin-sessions`
- `admin-users-roles`
- `audit-log`
- `admin-maintenance`

Allowed legacy aliases:
- `maintenance` -> `admin-maintenance`
- `admin-upload-report` -> `admin-report-upload`

Scope:
- Documentation-only contract.
- No production code changes.
- No backend/API/auth/DB/migrations/deps/lockfiles/CI/config changes.
- No navigation rewrite.

Acceptance:
- Canonical ids remain the only ids used by new UI links.
- Existing aliases remain compatibility-only and must not appear in new navigation surfaces.
- Future dashboard navigation changes must preserve role-specific module separation and no-scroll SLA.

## PR-GD6 — Dashboard server-state / loading / empty / error contract

Decision:
- Dashboard modules must keep loading, empty, error, and retry states explicit and distinguishable.
- Empty states must mean successful load with no records.
- Error states must mean failed load or failed action, never silent fallback to empty data.
- Retry actions must use the existing ErrorState `onRetry` contract where applicable.
- Loading states must use bounded dashboard skeletons/status regions, not fullscreen overlays.
- Error UI must not expose stack traces, internal exception details, raw backend payloads, tokens, cookies, signed URLs, or sensitive diagnostics.

Required state semantics:
- `loading`: request/action in progress.
- `empty`: successful response with no rows/items.
- `error`: failed request/action with safe user copy.
- `retry`: explicit recovery action when the surface can reload safely.

Scope:
- Documentation-only contract.
- No production code changes.
- No backend/API/auth/DB/migrations/deps/lockfiles/CI/config changes.
- No dashboard visual redesign.

Acceptance:
- Future dashboard modules must preserve the distinction between empty and error states.
- Existing shared LoadingState, EmptyState, and ErrorState contracts remain canonical.
- New dashboard server-state work must preserve no-scroll SLA and role-specific module separation.

## PR-GD7 — Observability / privacy plan contract

Decision:
- Dashboard observability must remain privacy-first and security-boundary aware.
- No analytics, telemetry, session replay, Clarity, heatmaps, tracking pixels, or third-party scripts may be introduced without explicit privacy review.
- Any future observability must preserve existing request logging, audit, redaction, and sensitive-output guardrails.
- Observability must never capture or expose raw tokens, token hashes, cookies, signed URLs, passwords, report URLs, private identifiers, backend exception details, or clinical/private payloads.
- Request diagnostics must use safe identifiers such as `requestId` or existing audit ids, not raw secrets.
- Session replay, if ever approved, must default to masking and must be limited to non-sensitive public/product UX evidence.

Required privacy gates before implementation:
- Explicit approval for tool/vendor.
- Explicit masking policy.
- Explicit allowlist of tracked events.
- Explicit denylist of sensitive fields and surfaces.
- Explicit evidence that no backend/API/auth/DB/migrations/deps/lockfiles/CI/config changes are required unless separately authorized.

Scope:
- Documentation-only contract.
- No production code changes.
- No third-party observability integration.
- No backend/API/auth/DB/migrations/deps/lockfiles/CI/config changes.
- No dashboard visual redesign.

Acceptance:
- Current redaction and request logging contracts remain the baseline.
- Future dashboard observability must preserve no-scroll SLA, role-specific module separation, and sensitive-data minimization.
- Any future analytics/session replay work must be opened as a separate explicitly approved PR.

## PR-GD8 — Particulares product surface audit contract

Decision:
- The particulares surface is a public/product tutor-facing surface, not an admin/clinic dashboard module.
- The canonical frontend surface is `/particulares`, backed by `frontend/src/app/particulares/page.tsx` and `frontend/src/components/public/ParticularesContent.tsx`.
- Future particulares UX work must be frontend-only unless backend/API/auth/DB changes are explicitly authorized in a separate PR.
- The surface must not introduce dashboard shell navigation, admin/clinic module ids, private dashboard hierarchy, or internal operational controls.
- The surface must prioritize clear next-step guidance for tutors: access token, report consultation, linked report availability, and safe recovery states.
- Mobile particulares must remain simple and shallow: no buried primary action, no long operational workflow, no internal module scroll, and no sensitive data exposure.
- Desktop particulares may use richer product storytelling, but must not hide the primary tutor action below non-essential content.

Required UX semantics:
- `public`: marketing/product explanation only.
- `token access`: tutor entry point for report consultation.
- `linked report available`: clear path to preview/download when authorized.
- `unlinked report`: safe explanation without leaking internal report or clinic metadata.
- `invalid/expired/inactive`: safe recovery copy with no token, cookie, signed URL, or backend detail exposure.

Scope:
- Documentation-only contract.
- No production code changes.
- No backend/API/auth/DB/migrations/deps/lockfiles/CI/config changes.
- No auth/session/token behavior changes.
- No dashboard visual redesign.

Acceptance:
- Particulares remains separated from admin and clinic dashboard OS navigation.
- Future particulares implementation must preserve existing security boundaries, redaction, ownership, and response-disclosure contracts.
- Any future visual/product implementation must be opened as a separate frontend-only PR with desktop and mobile evidence.
