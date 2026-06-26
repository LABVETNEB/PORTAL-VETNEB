# Dashboard runtime visual evidence post UX1

Fecha: 2026-06-26

## Estado base

- Rama auditada: `audit/dashboard-runtime-visual-evidence-post-ux1`.
- Base/HEAD auditado: `14eea88 fix(dashboard): move clinic password change into profile tabs (#1148)`.
- Estado inicial: `git status --short` limpio.
- Entorno: Windows, PowerShell, PNPM.
- Superficie auditada: Dashboard Clínica -> Perfil.

## Objetivo

Auditar visualmente en runtime el dashboard después de UX1, con foco en Clínica -> Perfil y evidencia en Android pequeño, iPhone, iPhone Pro Max y Desktop.

## Alcance incluido

- Evidencia documental en `docs/audit/`.
- Capturas PNG livianas en `docs/audit/evidence/dashboard-runtime-post-ux1/`.
- Spec Playwright de auditoria visual: `frontend/e2e/dashboard-runtime-post-ux1-visual-evidence.spec.ts`.
- Verificacion runtime de tabs internos de Perfil y contratos de no-scroll global.
- Diagnostico visual y priorizacion para el siguiente PR.

## Alcance excluido

- Sin cambios productivos de frontend.
- Sin cambios en backend, API, auth, DB, migraciones, endpoints, cookies, CORS, CSP, rate limits o seguridad.
- Sin cambios en dependencias, `package.json`, `pnpm-lock.yaml`, CI o workflows.
- Sin resolver hallazgos visuales en esta rama.
- Sin datos reales de clínicas, usuarios, pacientes o propietarios.

## Como se capturo la evidencia

- Herramienta: Playwright Chromium desde `C:\PORTAL-VETNEB\frontend`.
- Comando de captura: `corepack pnpm exec playwright test "e2e/dashboard-runtime-post-ux1-visual-evidence.spec.ts" --reporter=list`.
- Sesión: cookie e2e `app_session_id=e2e_test_clinic_session`.
- Datos: mock local de `GET /api/clinic/profile` con datos ficticios.
- Modo visual: `colorScheme: light`, `reducedMotion: reduce`, screenshots `fullPage: false`.
- Evidencia generada:
  - PNG: 20 capturas, 5 tabs x 4 viewports.
  - Métricas: `docs/audit/evidence/dashboard-runtime-post-ux1/dashboard-runtime-post-ux1-metrics.json`.

## Tabla por viewport

| Viewport | Evidencia | Tabs | No-scroll global | Selector legacy | Resultado visual |
| --- | --- | --- | --- | --- | --- |
| Android pequeño 360x740 | `clinic-profile-android-360x740-*.png` | 5/5 operables | OK: html/body/main delta `0` | Removido | P1 en `Cambiar contraseña`: CTA `Actualizar contraseña` fuera del viewport; tabs en 2 filas. |
| iPhone 390x844 | `clinic-profile-iphone-390x844-*.png` | 5/5 operables | OK: html/body/main delta `0` | Removido | OK funcional; tabs en 2 filas con presión vertical moderada. |
| iPhone Pro Max 430x932 | `clinic-profile-iphone-pro-max-430x932-*.png` | 5/5 operables | OK: html/body/main delta `0` | Removido | OK funcional; tabs en 2 filas, sin corte de CTA. |
| Desktop 1366x768 | `clinic-profile-desktop-1366x768-*.png` | 5/5 operables | OK: html/body/main delta `0` | Removido | OK; tabs en 1 fila, jerarquía clara y CTA visible. |

## Tabla por tab

| Tab | Android 360x740 | iPhone 390x844 | iPhone Pro Max 430x932 | Desktop 1366x768 | Resultado |
| --- | --- | --- | --- | --- | --- |
| Estado | OK, captura `clinic-profile-android-360x740-estado.png` | OK | OK | OK | Contenido abre directo dentro de Perfil; sin selector superior legacy. |
| Datos | OK, captura `clinic-profile-android-360x740-datos.png` | OK | OK | OK | Formulario visible, CTA principal `Guardar perfil público` visible. |
| Contacto | OK, captura `clinic-profile-android-360x740-contacto.png` | OK | OK | OK | Campos visibles; inputs largos truncados por control nativo, sin overflow global. |
| Contenido | OK, captura `clinic-profile-android-360x740-contenido.png` | OK | OK | OK | Checkbox y campos visibles; sin corte evidente. |
| Cambiar contraseña | P1: captura `clinic-profile-android-360x740-cambiar-contrasena.png`, CTA fuera de viewport, `panelDelta=81` | OK, CTA visible | OK, CTA visible | OK, CTA visible | El tab existe dentro de Perfil, pero requiere ajuste visual en Android pequeño. |

## Evidencia de remoción de `Acceso | Perfil público`

- El spec valida `workspace.getByText("Acceso | Perfil público")` con count `0`.
- El spec valida que no existan tabs internos exactos `Acceso` ni `Perfil público` dentro de `data-dashboard-module-workspace="perfil"`.
- El módulo abre directo `#clinic-public-profile` al navegar a `/dashboard?module=perfil`.
- La evidencia PNG muestra que la navegación interna visible inicia en `Estado`, `Datos`, `Contacto`, `Contenido`, `Cambiar contraseña`.

## Evidencia de `Cambiar contraseña` dentro de Perfil

- El spec valida el tab exacto `Cambiar contraseña` dentro de `data-clinic-profile-editor="true"`.
- Al activar el tab, el panel visible es `#clinic-password-change`.
- Campos verificados:
  - `input[name="currentPassword"]`.
  - `input[name="newPassword"]`.
  - `input[name="confirmPassword"]`.
- CTA verificado:
  - `Actualizar contraseña`.
- Capturas principales:
  - `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-android-360x740-cambiar-contrasena.png`.
  - `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-iphone-390x844-cambiar-contrasena.png`.
  - `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-desktop-1366x768-cambiar-contrasena.png`.

## Hallazgos

| Severidad | Hallazgo | Evidencia | Riesgo | Recomendación |
| --- | --- | --- | --- | --- |
| P1 | En Android 360x740, el tab `Cambiar contraseña` no muestra el CTA `Actualizar contraseña` dentro del viewport. | `clinic-profile-android-360x740-cambiar-contrasena.png`; métricas: `panelDelta=81`, control fuera de viewport: `Actualizar contraseña`. | El cambio de password queda visualmente incompleto en Android pequeño aunque el tab sea operable. | Próximo PR visual debe asegurar CTA visible en 360x740 sin restaurar scroll global. |
| P2 | El quinto tab fuerza wrapping a 2 filas en todos los viewports mobile. | Métricas: Android `tabRows=2`, iPhone `tabRows=2`, Pro Max `tabRows=2`; Desktop `tabRows=1`. | Consume altura crítica y aumenta presión visual sobre formularios. | Revisar patrón responsive de tabs de Perfil: densidad, distribución o tratamiento del tab de password. |
| P3 | La cabecera `PERFIL PÚBLICO` + `PERFIL PARA BANCO DE ESPECIALIDADES` consume aire vertical en mobile. | Capturas mobile de `Estado` y `Cambiar contraseña`. | No bloquea, pero reduce jerarquía y margen disponible para formularios densos. | Consolidar jerarquía/copy del módulo solo si el PR visual siguiente ya toca densidad mobile. |

## Recomendación para próximo PR visual

Abrir un PR visual acotado a Clínica -> Perfil mobile para resolver primero el P1: hacer visible el CTA `Actualizar contraseña` en 360x740 sin scroll global de `html/body/main` y sin tocar backend/auth. En el mismo PR, evaluar el P2 del wrapping de cinco tabs para recuperar altura útil y preservar jerarquía premium.

## Validaciones

| Comando | Resultado |
| --- | --- |
| `corepack pnpm exec playwright test "e2e/dashboard-runtime-post-ux1-visual-evidence.spec.ts" --reporter=list` desde `frontend` | Ejecutado, paso; 1/1. Genero 20 PNG + JSON de métricas. |
| `corepack pnpm lint` desde `frontend` | Ejecutado, paso. |
| `corepack pnpm typecheck` desde `frontend` | Ejecutado, paso. |
| `corepack pnpm build` desde `frontend` | Ejecutado, paso. |
| `corepack pnpm exec playwright test "e2e/dashboard-clinic-perfil-mobile-operability.spec.ts"` desde `frontend` | Ejecutado, paso; 3/3. |
| `corepack pnpm test` desde raiz | Ejecutado, paso; 2841/2841. |

## Archivos modificados

- `frontend/e2e/dashboard-runtime-post-ux1-visual-evidence.spec.ts`.
- `docs/audit/dashboard-runtime-visual-evidence-post-ux1.md`.
- `docs/audit/evidence/dashboard-runtime-post-ux1/*.png`.
- `docs/audit/evidence/dashboard-runtime-post-ux1/dashboard-runtime-post-ux1-metrics.json`.

## Resultado

- El cambio UX1 queda confirmado en runtime: se removio `Acceso | Perfil público`, Perfil abre directo el contenido público y `Cambiar contraseña` vive dentro del editor de Perfil.
- El contrato no-scroll global pasa en los 4 viewports auditados.
- Se detecta un P1 visual en Android 360x740 para el CTA del cambio de password.

## Riesgo residual

- Evidencia capturada en Chromium Playwright; no reemplaza validacion manual en dispositivos fisicos Android/iOS.
- El mock local evita datos reales, pero no cubre variabilidad de contenido productivo largo.
- El P1 queda documentado y priorizado, no corregido en esta rama por alcance.

## Estado final

Auditoria documental completada con evidencia runtime. Pendiente solo de stage/commit/push/PR manual por Nico.


