# Global Dashboard Premium System — Implementación

- Rama: `visual/global-dashboard-premium-system`
- Base: `main` @ `1f01925`
- Fecha: 2026-07-03
- Alcance: frontend visual (dashboards clínica y admin) + tests/fixtures e2e relacionados. Sin backend, sin API, sin auth, sin DB, sin dependencias, sin CI.

---

## 1. Resumen del cambio

Se creó una **gramática visual premium compartida** para los dashboards (sección
`dashboard-premium-grammar` en `globals.css`) y se **rediseñó el home del
dashboard clínica** (cockpit) sobre esa gramática, con composición dedicada por
clase de dispositivo y contrato no-scroll intacto. El hub admin se alineó al
mismo lenguaje (acentos por módulo, tiles con descripción en desktop, hero sin
vacío central).

Piezas de la gramática nueva:

| Primitiva | Clase | Uso |
|---|---|---|
| Tokens de acento por módulo | `--dash-accent-{operaciones,informes,logistica,perfil,tokens,critical,neutral}` | Color funcional por módulo/tono en ambos dashboards |
| Punto de estado | `.dashboard-status-dot` (`data-tone="ok\|warn"`) | Estado operativo único del home |
| KPI chip | `.dashboard-kpi-chip` (+icon/label/value, `data-tone`) | Métricas compactas con icono y acento |
| Banda de estado | `.dashboard-hub-band` | Header institucional del hub con regla de gradiente navy→teal→cyan |
| Señal | `.clinic-hub-signal` (`data-tone`) | Cards de lectura compacta (atención/continuidad/actividad) |
| Panel + tiles de módulos | `.clinic-hub-modules`, `.clinic-hub-tile(-grid/-icon/-chevron)` | Launcher icon-left sin aire muerto, acento por módulo |
| Acciones rápidas | `.clinic-hub-actions`, `.clinic-hub-action` | Strip de acciones verbales bajo la grilla (md+) |
| Acentos admin | `[data-dashboard-module-card="admin-*"] .dashboard-cockpit-tile-icon` | Mismo lenguaje de acentos en el launcher admin |

## 2. Problema corregido

Estado previo (evidencia "before" capturada en los 8 viewports):

1. **Desktop (1366/1440/1920):** panel de estado con un vacío vertical gigante
   (card gigante vacía), tiles de módulo estirados con aire muerto, y una
   columna "Acciones principales" que duplicaba textualmente los 5 módulos.
2. **Mobile 360x740:** señales cortadas a mitad de texto, grilla de módulos
   clipeada (fila Logística/Perfil a medias, tile Tokens invisible en el hub) y
   título "Dashboard Clínica" duplicado (topbar + page header).
3. **KPIs degradados en e2e:** el fixture no servía `route-plans` a las llamadas
   sin paginación, por lo que el estado sano del home era inalcanzable en e2e.
4. **Hub admin:** iconos de tiles lavados (utilities translúcidas pisaban la capa
   de componentes), tiles densos con el centro vacío y hero con vacío entre
   descripción y métricas.

## 3. Módulos reubicados

**Ninguna función se eliminó ni se ocultó.** No hubo reubicación fuera del home:
los 5 módulos clínicos (Operaciones, Informes, Logística, Perfil, Tokens)
siguen en el home con jerarquía nueva (grilla de tiles con acento) y sus 5
accesos verbales ("Abrir …", "Generar o abrir tokens") pasaron de columna
lateral duplicada a strip compacto bajo la grilla (visible md+; en mobile la
grilla y la bottom-nav cubren el acceso). Todas las vías existentes se
preservan: `?module=` (URL canónica), nav horizontal desktop, bottom-nav
mobile, rutas full (`/dashboard/informes`, `/dashboard/logistica/*`).

## 4. Funciones preservadas

- Navegación por `?module=` + persistencia de último módulo + señales
  `clinic-hub-reset` (sin cambios de lógica en el controller).
- Los 6 hooks e2e del cockpit (`data-clinic-cockpit-*`) y las expresiones KPI
  fijadas (`{statsLoadError ? "—" : pendingReports}` / `activeVisits`).
- Las 5 acciones con sus nombres accesibles exactos.
- Workspaces de módulos, rutas full de logística/informes, perfil y tokens:
  sin cambios.
- Permisos, sesiones, contratos API, payloads: sin cambios (frontend visual +
  fixtures e2e solamente).

## 5. Rutas afectadas (visualmente)

- `/dashboard` (home/hub) — rediseño completo del cockpit.
- `/dashboard?module=*` — sin cambios estructurales (heredan canvas/shell).
- `/dashboard/admin` (hub) — acentos por módulo, descripciones en tiles
  (≥1440px), hero compactado.
- `/dashboard/informes`, `/dashboard/logistica(/visitas|/rutas|/metricas)` —
  sin cambios (comparten shell; verificadas).

## 6. Componentes y archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/globals.css` | Nueva sección `dashboard-premium-grammar:start/end` (tokens de acento, primitivas del hub, composición por dispositivo, overrides mobile clínica) |
| `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` | Rediseño del cockpit: banda de estado con dot + 4 KPI chips, panel de módulos con tiles icon-left + chevron, strip de acciones, rail de señales con iconos y tonos. Hooks `data-*` y strings contractuales preservados |
| `frontend/src/app/dashboard/page.tsx` | Page header del hub: "Resumen operativo" (elimina el título duplicado) + hook `clinic-hub-page-header` |
| `frontend/src/components/dashboard/DashboardModuleHub.tsx` | Icono del tile sin utilities translúcidas (los acentos por módulo aplican); descripción visible en launchers densos ≥1440px |
| `frontend/src/components/dashboard/DashboardHubHero.tsx` | Métricas bajo la descripción (sin vacío central); CTA anclada abajo (`sm:mt-auto`) |
| `frontend/e2e/fixtures/admin-populated-api-server.mjs` | `route-plans` servido a la sesión clínica populated sin exigir limit/offset → el estado sano del home es alcanzable en e2e |
| `frontend/e2e/dashboard-clinic-module-state-parity.spec.ts` | Test de sesión populated actualizado al contrato sano ("Operativo", sin alerta de métricas) |
| `test/frontend-dashboard-interaction-foundation.test.ts` | Guard de reduced-motion acotado a los delimitadores de su sección (era `lastIndexOf` global; precedente #958) |
| `docs/implementation/global-dashboard-premium-system.md` | Este documento |

## 7. Criterios no-scroll aplicados

- El cockpit es **content-hugging** (`flex: 0 1 auto; max-height: 100%`) dentro
  del stage `overflow: hidden`: nunca empuja `main` ni genera scroll.
- Todo texto de cards tiene truncamiento explícito (`truncate`,
  `line-clamp-1/2`); la lista de atención está acotada a 3 ítems + resumen
  "+N señal(es) adicionales", así el peor caso es finito en 360x740.
- Sin scroll interno en ninguna card del hub; sin doble scroll; sin scroll
  horizontal (`min-width: 0` en cada nivel de la jerarquía flex/grid).
- En pantallas anchas (≥1600px) el stage del hub se acota a `max-width: 100rem`
  centrado (`:has([data-clinic-cockpit])`) para que las cards no se inflen.
- Métricas medidas en la verificación: `scrollHeight − clientHeight = 0` y
  `scrollWidth − clientWidth = 0` en documento y `.dashboard-main` para
  las 23 combinaciones superficie×viewport verificadas.

## 8. Reglas por dispositivo

| Clase | Composición |
|---|---|
| Mobile ≤767px (360/390/412) | Columna: banda de estado compacta (2 KPI chips, descripción 1 línea) → panel de módulos (tiles 2 col, sin chevron, icono 1.7rem) → señales apiladas (texto 1 línea). Page header compacto (1rem). Acciones ocultas (bottom-nav + tiles cubren) |
| Tablet portrait 768x1024 | KPIs 4-across en la banda; señales en fila de 3; strip de acciones visible; tiles 2 col |
| Tablet landscape / desktop bajo 1024x768–1366x768 | Grid 2 zonas: módulos (1.6fr) + rail de señales (1fr, cards estiradas parejas); banda con texto + 4 KPI chips en línea |
| Desktop 1440x900 | Igual + tiles a 3 columnas |
| Desktop 1920x1080 | Igual + hub acotado a 100rem centrado sobre el canvas blueprint |
| Admin desktop | Mismos acentos por módulo; descripciones de tiles sólo ≥1440px (1366x768 conserva el contrato no-scroll con 10 tiles) |

## 9. Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `pnpm test` (contratos raíz) | **2955/2955 pass** |
| `pnpm typecheck` / `pnpm typecheck:test` | pass |
| `pnpm --dir frontend typecheck` | pass |
| `pnpm --dir frontend lint` | pass |
| `pnpm --dir frontend build` | pass |
| `pnpm build` (backend, no afectado) | pass |
| `pnpm security:public-surface` | PASS (sin exposición) |
| `pnpm --dir frontend e2e:visual-contract` | **273/273 pass** |
| `pnpm --dir frontend e2e:public-clinic` | **116/116 pass** |
| `pnpm --dir frontend e2e:admin-mobile` | **132/132 pass** |
| `pnpm --dir frontend e2e:smoke` | **40/40 pass** (con `--workers=2`; a paralelismo alto local hay flakes rotativos de hidratación en specs públicos no tocados, cada uno pasa aislado) |
| Parity/fixture specs (`dashboard-clinic-controller-workspace-parity`, `dashboard-clinic-mobile-nav-stage-parity`, `dashboard-clinic-module-state-parity`, `clinic-reports-fixture-pagination`, `dashboard-informes-server-adaptive-pagination`, `dashboard-logistica-*-full-route-adaptive`, `dashboard-logout-private-cache`, `accessibility-axe-key-routes`) | pass, salvo **2 fallas preexistentes en `dashboard-clinic-module-state-parity.spec.ts`** (tokens retry / perfil loading) que **también fallan en `main` sin este diff** (verificado con stash; spec fuera de CI) |
| Verificación visual multi-viewport | 23 combinaciones (hub en los 8 viewports obligatorios; operaciones/informes/logística/perfil/tokens en 360/768/1440; rutas full y hub admin en 360/1440) con overflow 0 en documento y `main` |

Nota: tras cada corrida e2e local hay que revertir `frontend/next-env.d.ts`
(el dev server lo regenera) antes de `pnpm test`.

## 10. Capturas requeridas para revisión humana

Regenerables con Playwright (cookie `app_session_id=e2e_populated_clinic_session`
contra los servers del fixture e2e: `node e2e/fixtures/admin-populated-api-server.mjs`
+ `pnpm dev` con `NEXT_PUBLIC_API_URL=http://127.0.0.1:3107`):

1. `/dashboard` en 360x740, 390x844, 412x915, 768x1024, 1024x768, 1366x768,
   1440x900 y 1920x1080 — jerarquía banda→módulos→señales, cero cortes.
2. `/dashboard?module=operaciones|informes|logistica|perfil|tokens` en
   360x740, 768x1024 y 1440x900.
3. `/dashboard/informes` y `/dashboard/logistica(/visitas|/rutas|/metricas)`
   en 360x740 y 1440x900.
4. `/dashboard/admin` en 1440x900 (acentos por módulo + hero compacto) y
   360x740 (launcher mobile intacto).
5. Modo oscuro (`dark-gray`) del hub clínica en 1440x900 (tokens theme-aware).

## 11. Riesgos

- **Snapshots de regresión visual (workflow manual):** los baselines
  `dashboard-*`/`admin-dashboard-*`/`stress-*` (chromium-linux) del workflow
  manual `visual-regression-manual.yml` quedarán desactualizados por diseño.
  Tras el merge hay que regenerarlos ejecutando ese workflow en modo update.
- **`:has()` en el centrado ≥1600px:** soportado por todos los navegadores
  evergreen; en un navegador sin `:has` el hub simplemente no se centra
  (degradación cosmética, sin rotura).
- **Spec fuera de CI con fallas preexistentes:** las 2 fallas de
  `dashboard-clinic-module-state-parity.spec.ts` (tokens retry / perfil
  loading) vienen de `main`; quedan señaladas para un fix separado.
- **Fixture route-plans:** ahora la sesión clínica populated recibe planes sin
  paginación; specs futuros que asuman el estado degradado del home bajo esa
  sesión deben usar la sesión default (`e2e_test_clinic_session`).

## 12. Rollback lógico

Cambio 100 % frontend/tests, sin migraciones ni datos:

1. Revertir el commit (o `git revert`) restaura el cockpit anterior, el CSS
   (la sección `dashboard-premium-grammar` es aditiva y autocontenida entre
   sus delimitadores) y los tests/fixtures.
2. No hay estado persistido nuevo (no se agregaron claves de storage ni
   cookies); `?module=` y last-module no cambiaron.
3. Los baselines del workflow visual manual vuelven a coincidir con el estado
   pre-cambio automáticamente al revertir.
