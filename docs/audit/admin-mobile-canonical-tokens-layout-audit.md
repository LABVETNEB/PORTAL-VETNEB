# Auditoría — Layout canónico mobile del Dashboard Administrador basado en Tokens

> Contrato visual y plan de PRs chicos para replicar el patrón mobile de **Tokens
> particulares** en el resto de los módulos del Dashboard Administrador.

- **HEAD base:** `af1639e fix(admin): align mobile tokens pagination and modal copy (#1079)`
- **Rama de auditoría:** `audit/admin-mobile-canonical-tokens-layout`
- **Alcance:** únicamente Dashboard Administrador mobile (`md:hidden`). No se toca
  backend, API, DB, auth, dependencias, lockfiles, CI, rutas públicas ni Clínica.
- **Referencia canónica funcional:** módulo **Tokens** mobile
  (`frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`, rama
  `md:hidden`, líneas ~1221–1306) — corresponde a la captura aportada por Nico.

---

## 1. Patrón canónico Tokens (definición funcional)

Estructura mobile observada en Tokens (referencia a replicar):

1. **Appbar fija** superior (`[data-admin-mobile-app-bar="true"]`).
2. **Título del módulo** (provisto por `DashboardModuleWorkspace`).
3. **Card/stage** ocupando el alto disponible:
   `Card` → `flex min-h-0 flex-1 flex-col overflow-hidden`.
4. **Toolbar superior** dentro del card: acción primaria fuerte
   (`Tokens administrados`) + acción secundaria (`Generar token`), más
   filtros/acciones (`ID clínica`, `Filtrar`, `Actualizar`).
5. **Lista operativa** en zona central flexible:
   `data-admin-mobile-core-module="tokens"` → contenedor
   `flex h-full min-h-0 flex-1 flex-col`; lista
   `data-admin-particulars-mobile-list` = `min-h-0 flex-1 overflow-hidden`.
6. **Ítems** `data-admin-mobile-core-item` con `min-h-9` (≥36px).
7. **Espacio sobrante** absorbido por la lista (`flex-1`), no por el footer.
8. **Footer/paginador** anclado abajo: `data-admin-mobile-core-pager`,
   `shrink-0`, **`justify-center`**, texto **`Anterior` / `Pág. X` /
   `Siguiente`**, botones **`h-9` (36px)**.
9. **Bottom nav fija** (`[data-admin-mobile-bottom-nav="true"]`).
10. **Sin scroll global, sin scroll interno, sin `overflow:auto|scroll`**
    (solo `overflow-hidden`). Touch targets ≥36px.

### Invariantes de contrato ya bloqueadas por tests

- `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` valida
  `clinics`, `reports`, `tokens` (no-scroll, ítems dentro del viewport, pager
  dentro del viewport, paginación funcional, appbar/bottom-nav).
- `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` valida
  `audit`, `sessions`, `users`.
- `frontend/e2e/admin-mobile-status-modules-no-scroll.spec.ts` /
  `admin-mobile-config-modules-no-scroll.spec.ts` validan las familias
  status/config (chips+panel).
- `test/admin-tokens-enterprise-density.test.ts` bloquea strings/clases de
  Tokens como regresión (referencia canónica).

---

## 2. Inventario de módulos y familias de layout mobile

El Dashboard Administrador mobile usa **tres familias** de layout, no una sola:

| Familia | Componente base | Hooks de datos | Forma |
|---|---|---|---|
| **Core (lista + pager)** | inline en cada Card | `data-admin-mobile-core-module/-item/-pager` | Lista operativa + paginador. **Patrón Tokens.** |
| **Ops (lista + pager)** | `AdminMobileOpsPager` | `data-admin-mobile-ops-module/-item` + `data-admin-mobile-ops-pager` | Lista `grid-rows-3` + paginador compartido. |
| **Status/Config (chips + panel)** | `AdminMobileStatusModule` / `AdminMobileConfigModule` | `data-admin-mobile-status/config-*` | Tabs por chips, panel `flex-1`. No es una lista. |

Mapa módulo → implementación mobile:

| Módulo | Ruta `module=` | Componente mobile | Familia |
|---|---|---|---|
| Inicio / Hub | (sin módulo) | `DashboardModuleHub` + launcher | Hub |
| Administración | `admin` | `AdminMobileCommandModule` → `AdminMobileStatusModule` | Status |
| Informes | `admin-report-upload` | `AdminReportsCard` (`reports`) | **Core** |
| Estado del sistema | `admin-health` | `AdminMobileHealthModule` → `AdminMobileStatusModule` | Status |
| Clínicas | `admin-clinics` | `AdminClinicsManagementCard` (`clinics`) | **Core** |
| **Tokens** | `admin-particular-tokens` | `AdminParticularTokensCard` (`tokens`) | **Core (canónico)** |
| Precios | `admin-pricing` | `AdminMobilePricingModule` → `AdminMobileConfigModule` | Config |
| Sesiones | `admin-sessions` | `AdminMobileSessionsModule` → `AdminMobileOpsPager` | **Ops** |
| Usuarios y roles | `admin-users-roles` | `AdminMobileUsersModule` → `AdminMobileOpsPager` | **Ops** |
| Auditoría | `audit-log` | `AdminMobileAuditModule` → `AdminMobileOpsPager` | **Ops** |
| Mantenimiento | `admin-maintenance` | `AdminMobileMaintenanceModule` → `AdminMobileConfigModule` | Config |

---

## 3. Tabla de cumplimiento por módulo vs. patrón Tokens

Leyenda: ✅ cumple · 🟡 casi cumple · ❌ no cumple · — no aplica.

| Módulo | Stage full-height | Toolbar/filtros arriba | Zona central flexible | Footer/pager abajo | Pager centrado `Anterior/Pág./Siguiente` | Touch ≥36px (pager) | Sin overflow auto/scroll | Veredicto |
|---|---|---|---|---|---|---|---|---|
| **Tokens** (ref) | ✅ | ✅ | ✅ | ✅ | ✅ texto | ✅ `h-9` | ✅ | **Canónico** |
| Clínicas | ✅ | ✅ | ✅ | ✅ | 🟡 chevron-icon + rango, `justify-between` | ✅ `h-9 w-9` | ✅ | 🟡 casi |
| Informes | ✅ | ✅ | ✅ | ✅ | 🟡 chevron-icon + rango, `justify-between` | ✅ `h-9 w-9` | ✅ | 🟡 casi |
| **Sesiones** | ✅ | ✅ | ✅ (`grid-rows-3`) | ✅ | ❌ chevron-icon + rango, `justify-between` | ❌ **`h-7 w-7` = 28px** | ✅ | ❌ no cumple (pager) |
| **Usuarios y roles** | ✅ | ✅ | ✅ (`grid-rows-3`) | ✅ | ❌ chevron-icon + rango, `justify-between` | ❌ **`h-7 w-7` = 28px** | ✅ | ❌ no cumple (pager) |
| **Auditoría** | ✅ | ✅ (filtros + contadores) | ✅ (`grid-rows-3`) | ✅ | ❌ chevron-icon + rango, `justify-between` | ❌ **`h-7 w-7` = 28px** | ✅ | ❌ no cumple (pager) |
| Administración | ✅ | — chips | ✅ panel `flex-1` | — | — (sin lista) | — | ✅ | ✅ (familia status) |
| Estado del sistema | ✅ | — chips | ✅ panel `flex-1` | — | — (sin lista) | — | ✅ | ✅ (familia status) |
| Precios | ✅ | — chips | ✅ panel `flex-1` | — | — (sin lista) | — | ✅ | ✅ (familia config) |
| Mantenimiento | ✅ | — chips | ✅ panel `flex-1` | — | — (sin lista) | — | ✅ | ✅ (familia config) |

### Lectura de la tabla

- **No hay módulos con scroll global, scroll interno ni `overflow:auto|scroll`.**
  Todas las familias usan `overflow-hidden` + `min-h-0 flex-1`. La arquitectura
  no-scroll del HUB ya está consolidada (#1074/#1076).
- Las familias **status/config** no son listas; replicar el pager de Tokens en
  ellas **no aplica** y sería un rediseño fuera de alcance.
- Las familias **core (Clínicas/Informes)** ya cumplen touch target (`h-9`) pero
  divergen visualmente del canónico Tokens (chevron-icon + rango +
  `justify-between` en vez de texto centrado `Anterior/Pág./Siguiente`).
- La familia **ops (Sesiones/Usuarios/Auditoría)** es la **única que viola el
  touch target ≥36px** (`h-7 w-7` = 28px) **y** además diverge en layout. Es la
  más alejada del canónico y la de mayor prioridad.

---

## 4. Riesgos por módulo

| Módulo | Riesgo principal | Severidad |
|---|---|---|
| Sesiones / Usuarios / Auditoría | Pager `AdminMobileOpsPager` con botones de 28px (< 36px) — touch target insuficiente; layout no centrado. | Media (accesibilidad/consistencia) |
| Clínicas / Informes | Pager con chevron-icon + rango en vez de texto centrado canónico. Touch target OK. | Baja (cosmético) |
| Status/Config | Ninguno respecto del patrón Tokens (no son listas). Riesgo solo si se intentara forzar el pager. | — |
| Todos | Cambiar altura del pager podría alterar el presupuesto no-scroll si no se mantiene `min-h-10`. | Controlable |

Sin riesgo de ghosting/layering adicional: el stage persistente
(`dashboard-module-stage`, #1074) ya está resuelto y no se toca.

---

## 5. Propuesta de PRs chicos (orden recomendado)

> Cada PR toca **una sola familia/archivo**, es reversible y no mezcla módulos.

1. **PR-A (este lote) — Pager ops canónico.**
   Alinear `AdminMobileOpsPager.tsx` al pager canónico Tokens: **centrado**,
   texto **`Anterior` / `Pág. X / Y` / `Siguiente`**, botones **`h-9` (36px)**,
   manteniendo `min-h-10` (altura neta sin cambios → no-scroll intacto) y el
   `<nav aria-label>` + `data-admin-mobile-ops-pager`. Beneficia a Sesiones,
   Usuarios y Auditoría con un único archivo. Corrige la **única violación real
   de touch target**. _Es el primer PR de implementación._

2. **PR-B — Pager core a texto canónico.**
   Unificar los pagers inline de `AdminClinicsManagementCard` y
   `AdminReportsCard` al texto centrado `Anterior/Pág./Siguiente` (hoy
   chevron-icon). Cambio cosmético, touch target ya cumple. Opcional.

3. **PR-C — (opcional) extraer pager core compartido.**
   Evaluar un componente único de pager mobile reutilizable por core+ops para
   eliminar la duplicación. Solo si PR-A/PR-B confirman el contrato.

No se proponen cambios en status/config: ya cumplen y no son listas.

---

## 6. Criterios de aceptación

### Visuales
- Pager de la familia ops **centrado**, con texto `Anterior`, `Pág. X / Y`,
  `Siguiente`.
- Botones del pager con altura `h-9` (≥36px).
- Appbar y bottom nav preservadas y visibles.
- Sin bloques introductorios redundantes.

### No-scroll (bloqueantes)
- `html`/`body`/módulo: `scrollHeight ≤ clientHeight + 2px` (sin overflow
  vertical ni horizontal) en 360×740, 390×844, 430×932.
- Cero elementos con `overflow:auto|scroll` dentro del módulo.
- La zona central (`grid-rows-3` / lista) absorbe el espacio sobrante; el pager
  queda anclado abajo.
- Tokens (`clinics`/`reports`/`tokens`) sigue pasando como regresión.

### No tocar
Backend, API, DB, auth, dependencias, lockfiles, CI, rutas públicas,
producción ni Clínica. Sin migrations. Sin secretos.

---

## 7. Primer PR de implementación

**PR-A — Pager ops canónico (`AdminMobileOpsPager.tsx`).**

- Único archivo de producto modificado + un test de contrato nuevo.
- TDD: `test/admin-mobile-ops-pager-canonical-layout.test.ts` (falla con el
  estado actual `h-7 w-7`/chevron/`justify-between`; pasa tras alinear a
  `h-9`/texto/`justify-center`).
- Riesgo no-scroll neutralizado: `min-h-10` + `py-0.5` + `h-9` = 40px (sin
  delta de altura respecto del actual).
- Beneficia a Sesiones, Usuarios y Auditoría sin mezclar módulos (un componente
  compartido de la familia ops).
