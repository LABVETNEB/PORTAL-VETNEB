# Admin Mobile Final Polish / No-Scroll Closeout

## Estado base

- Fecha: 2026-06-20.
- Rama: `polish/admin-mobile-final-no-scroll`.
- HEAD inicial: `6a951f6 fix(admin): add mobile ops modules no scroll contract (#1069)`.
- Working tree inicial: limpio.
- Entorno: Windows, PowerShell y PNPM.

## Scope incluido

- Auditoría visual y geométrica final de Admin mobile.
- Viewports mobile: 360×740, 390×844 y 430×932.
- Smoke desktop: 1280×800.
- Superficies auditadas:
  - launcher, páginas 1 y 2;
  - Clínicas;
  - Informes;
  - Tokens;
  - Auditoría;
  - Sesiones;
  - Usuarios;
  - menú Más;
  - menú de administración;
  - notificaciones;
  - app bar, bottom nav y navegación horizontal desktop.
- Nuevo spec final con datos poblados, screenshots y contrato no-scroll.
- Dos correcciones visuales mínimas demostradas en 360×740.

No existe una pantalla de perfil Admin dedicada en el shell actual. Las acciones personales aplicables se auditaron en el menú de administración: apariencia, notificaciones, cambio de contraseña, sitio público y cierre de sesión.

## Scope excluido

- Backend, DB, Drizzle, schema y migraciones.
- Auth, cookies, roles, permisos, CSRF, CORS, CSP y rate limits.
- Endpoints y contratos de datos.
- Dependencias, `package.json`, `pnpm-lock.yaml`, CI, workflows y Dependabot.
- Cambios en Clínica.
- Cambios de page size.
- Refactors, rediseño del shell o reapertura de módulos cerrados.
- Commit, push y PR.

## Auditoría previa

- Rama, HEAD y working tree coincidieron con la base esperada.
- Se identificaron los diez specs contractuales solicitados.
- Se confirmaron los scripts nativos de typecheck, lint, build, test y seguridad.
- No se encontraron referencias relacionadas en `legacy/`.
- Se identificaron los componentes Admin mobile y el CSS scoped existentes.
- Se confirmó el patrón documental mediante `docs/audit/admin-mobile-density-closeout.md`.

## Spec y screenshots

Se creó:

- `frontend/e2e/admin-mobile-final-polish-no-scroll.spec.ts`.

El spec valida:

- `html`, `body`, app shell, `main` y superficie activa sin overflow geométrico;
- ausencia de `overflow:auto` y `overflow:scroll` en Admin mobile;
- ausencia de overflow horizontal;
- app bar y bottom nav dentro del viewport;
- superficie, ítems y pagers entre app bar y bottom nav;
- ítems no recortados por ancestros con overflow de clipping;
- launcher, menú Más, menú de administración y notificaciones;
- contenido poblado en los seis módulos operativos auditados;
- navegación horizontal desktop visible;
- bottom nav y raíces mobile ausentes en desktop;
- contenido desktop poblado antes de capturar.

Las capturas se generan en la carpeta estable e ignorada por Git:

- `frontend/test-results/admin-mobile-final-polish-no-scroll/`.

Resultado final: 40 capturas, una por viewport y pantalla auditada.

## Hallazgos visuales reales

### 1. Clínicas 360×740

El wrapper del buscador mobile tenía `flex-1`. Consumía una franja vertical vacía y empujaba la tercera card aproximadamente 42 px debajo del inicio de la bottom nav.

Corrección:

- se eliminó `flex-1` únicamente del wrapper del buscador mobile;
- se conservaron tres cards por página;
- no se eliminó información;
- no se introdujo scroll.

### 2. Tokens 360×740

Los tabs `Tokens administrados` y `Generar token` usaban tamaño mobile mayor que desktop. En 360 px, el segundo tab saltaba a una fila adicional y la tercera fila de tokens quedaba recortada por el contenedor no-scroll.

Corrección:

- ambos tabs usan `h-8 px-2 text-xs`, el mismo tamaño compacto ya aplicado en desktop;
- los tabs quedan en una sola fila;
- las tres filas y el pager quedan completos;
- no se cambió el page size ni el contrato de datos.

No se detectaron otros defectos visuales o geométricos que justificaran cambios de producto.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/e2e/admin-mobile-final-polish-no-scroll.spec.ts` | Spec final, datos poblados deterministas, screenshots, no-scroll, geometría, clipping y desktop smoke. |
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | Elimina crecimiento vertical incorrecto del buscador mobile. |
| `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` | Compacta los dos tabs de Tokens para evitar wrap y clipping a 360 px. |
| `docs/audit/admin-mobile-final-polish-no-scroll-closeout.md` | Evidencia de auditoría, cambios y validaciones. |

## Validaciones

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend typecheck` | PASS |
| `pnpm --dir frontend lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm --dir frontend exec playwright test e2e/admin-mobile-final-polish-no-scroll.spec.ts` | PASS, 4/4 |
| Matriz Admin mobile/no-scroll principal solicitada | PASS, 68/68 |
| App shell real + visibilidad solicitados | PASS, 41/41 |
| Paridad Clínica solicitada | PASS, 12/12 |
| `pnpm --dir frontend build` | PASS |
| `pnpm build` | PASS |
| `pnpm test` | PASS, 2815/2815 |
| `pnpm security:public-surface` | PASS |

Los E2E emitieron mensajes esperados de fixtures para endpoints no disponibles en escenarios no poblados. La matriz de app shell también mostró warnings Radix preexistentes de título/descripción en dialogs de Clínica. No hubo fallos asociados y no se modificó Clínica.

## Resultado

- Launcher, módulos core, módulos ops, menús y notificaciones cubiertos.
- Sin scroll global, interno ni horizontal en Admin mobile.
- Sin cards, filas, acciones o pagers recortados.
- App bar y bottom nav visibles y sin solapamientos.
- Desktop preserva navegación y layouts propios.
- Clínica preservada y su matriz solicitada permanece verde.
- Scope mínimo, sin arquitectura nueva y sin commit.

## Riesgo residual

- Bajo.
- Las correcciones son clases scoped en dos componentes Admin existentes.
- Las capturas no se versionan; se regeneran al ejecutar el spec final.
- Los warnings Radix observados pertenecen a Clínica y quedan fuera de este PR.

## Estado final

Closeout Admin mobile completo y validado. Pendiente únicamente la revisión manual de diff, stage, commit, push, PR y checks por Nico.
