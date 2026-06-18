# Auditoría — Admin Dashboard Enterprise Density Completion

- **Rama:** `audit/admin-enterprise-density-completion`
- **Base:** `main` @ `f4ed930 feat(admin): enterprise density for sessions module (#1047)`
- **Fecha:** 2026-06-18
- **Alcance:** Overview / Clinics, Tokens, Reports, Audit, Users/Roles y Sessions.
- **Modalidad:** auditoría de solo lectura sobre código productivo y tests; único artefacto creado: este Markdown.
- **Entorno:** Windows, PowerShell y PNPM.

> No se modificó código productivo ni tests. No se instalaron dependencias, no se leyó `.env`, no se accedió a secretos y no se ejecutó `git add`, `commit`, `push` ni `gh`.

---

## Resumen ejecutivo

### Dictamen

El Admin Dashboard tiene una base de densidad enterprise consistente y el contrato estructural no-scroll está bien implementado, pero **no corresponde declararlo completado ni apto para producción sin reservas**.

El resultado de la auditoría es **APROBACIÓN CONDICIONADA / NO-GO para el cierre de completion** por dos hallazgos P1:

1. **Auditoría produce un hydration mismatch reproducible** en Chromium a 1366×768 y 1440×900. React regenera el árbol en cliente. El E2E termina verde porque solo mide overflow y no falla ante `pageerror`/errores de consola.
2. **La evidencia E2E no-scroll poblada está incompleta.** Clínicas y Sesiones sí usan fixtures densos. Tokens y Users/Roles no están en la matriz del spec real; Reports y Audit se prueban con datos vacíos/fallback 404; Overview no recibe fixture de actividad densa.

No se detectaron P0. No se confirmó overflow vertical ni horizontal en los casos realmente medidos. La búsqueda estática no encontró `overflow-y-auto`, `overflow-y-scroll` ni `data-dashboard-scroll-region` en los componentes principales auditados.

### Fortalezas confirmadas

- Cadena de altura consistente: shell fijo, `dashboard-main` con `overflow-hidden`, workspaces `min-h-0` y cards `flex-1`.
- Paginación server-side viewport-safe: 9 filas en Clínicas, Tokens, Reports, Audit y Users/Roles; 8 en Sessions.
- Tablas desktop densas y listas mobile priorizadas en Tokens, Reports, Audit, Users/Roles y Sessions.
- Badges de 20 px, acciones de 28–32 px y paginadores compactos, sin heroes ni espaciado tipo landing.
- Tokens enmascarados fuera del diálogo de creación de una sola visualización.
- Audit proyecta datos seguros y omite metadata estructurada y campos de red/sesión.
- Reports solicita preview/descarga bajo scope admin y no renderiza signed URLs persistentes.
- Users/Roles y Sessions conservan confirmación, bloqueo de mutación y guardrails del último Owner/sesión admin actual.
- Suite completa: 2806/2806 tests aprobados; lint y typecheck aprobados.

---

## Estado por módulo

### Overview / Clinics — parcial, con Clínicas validado en carga densa

**No-scroll y layout**

- Overview conserva composición compacta con strip de KPI y cuatro paneles operativos.
- Clínicas usa `PAGE_SIZE = 9`, consulta server-side y una card `flex min-h-0 flex-1 flex-col`.
- El E2E real validó Clínicas con nueve filas pobladas en 1366×768 y 1440×900 sin overflow externo, regional ni horizontal medido.
- Overview pasó como `admin hub`, pero sin fixture denso para actividad/auditoría; no es equivalente a una prueba de carga representativa.

**Visual y responsive**

- Header, buscador, acciones y tabla son compactos.
- La tabla de Clínicas conserva wrapper horizontal defensivo, pero no produjo scroll medido en los dos viewports desktop.
- No existe lista mobile dedicada para Clínicas; la tabla depende del wrapper responsive. El riesgo mobile no está cubierto por la suite ejecutada.

**Seguridad**

- Listado y serializers no exponen hashes ni credenciales persistidas.
- Alta y edición usan inputs de contraseña `type="text"`; la contraseña ingresada queda visible. El comportamiento está fijado explícitamente por tests. Es un riesgo P2 de exposición visual, aunque no sea una filtración desde backend.
- Eliminación de clínica exige confirmación destructiva y nombre exacto.

**Estado:** **parcial**. Clínicas cumple desktop poblado; Overview y mobile requieren evidencia adicional. La visibilidad de contraseña requiere un PR específico.

### Tokens — parcial

**No-scroll y layout**

- `PAGE_SIZE = 9`, tabla desktop `table-fixed`, lista mobile priorizada, detalle y alta en `ModuleDialog`.
- No hay scroll vertical regional ni detalle inline expansivo.
- El spec real no-scroll no incluye la ruta `admin-particular-tokens`; por lo tanto, el fit de nueve filas no fue validado dinámicamente en esta auditoría.

**Seguridad**

- Lista, mobile y detalle muestran `tokenLast4` enmascarado.
- El token completo existe solo en el diálogo posterior a la creación, con confirmación obligatoria antes de cerrarlo.
- Eliminación permanente usa confirmación explícita con identificador enmascarado.
- Tracking se carga bajo demanda; no hay `Promise.all` por fila.

**Riesgo funcional documentado**

- El endpoint no entrega `total` ni `hasNextPage`; un total múltiplo exacto de nueve puede habilitar una página siguiente vacía.

**Estado:** **parcial** por falta de E2E no-scroll poblado y mobile del módulo Admin.

### Reports — parcial

**No-scroll y layout**

- `PAGE_SIZE = 9`, tabla desktop, lista mobile, métricas de página, paginación con `hasMore` y detalle/subida en diálogos.
- El E2E `admin upload report alias` pasó en ambos viewports, pero el web server no mockea `/api/admin/report-workflow`; la prueba observa la superficie vacía.

**Seguridad**

- No se renderizan URLs privadas en el listado.
- Preview y descarga usan acciones con `scope="admin"` y URL firmada bajo demanda.
- La carga mantiene PDF y contratos admin existentes.
- Las mutaciones de etapa/tinción tienen bloqueo mientras están activas y feedback; no se detectó una operación destructiva sin confirmación.

**Estado:** **parcial** por ausencia de fixture E2E con nueve informes y estados/badges representativos.

### Audit — no apto hasta corregir P1

**No-scroll y layout**

- `ADMIN_AUDIT_PAGE_SIZE = 9`, tabla/lista densa, filtros server-side y detalle seguro en diálogo.
- El assert de overflow pasó en 1366×768 y 1440×900, pero con endpoint de audit en 404 y estado vacío.

**Defecto confirmado**

- Dos ejecuciones independientes reprodujeron `Hydration failed because the server rendered HTML didn't match the client`.
- El stack apunta al trigger de `ModuleDialog` en `AdminAuditFilterBar.tsx`, línea lógica del filtro mobile, pasando por Radix Dialog y `Button`.
- React informa que el árbol será regenerado en cliente. Esto puede producir parpadeo, pérdida de estado/foco y comportamiento no determinista en la primera interacción.
- El spec no registra ni falla ante `pageerror`, por lo que reporta 2/2 y 28/28 aunque el navegador emita el error.

**Seguridad**

- La proyección excluye IP, user-agent, request ID, sesión, metadata cruda, passwords, tokens, cookies y hashes.
- Objetos/arrays se reemplazan por `Dato estructurado omitido`.

**Estado:** **no apto para cierre productivo** hasta eliminar el hydration mismatch y agregar una regresión que falle ante errores de hidratación.

### Users / Roles — parcial

**No-scroll y layout**

- `PAGE_SIZE = 9`, tabla desktop, lista mobile, filtros compactos, métricas y paginación server-side.
- Existen E2E globales de adaptabilidad que incluyen `admin-users-roles`, pero no hay fixture poblado ni caso dedicado dentro del spec real no-scroll ejecutado.

**Seguridad y guardrails**

- Solo usuarios de clínica pueden cambiar entre los roles existentes.
- Cambio de rol con confirmación, bloqueo durante mutación y protección del último Owner.
- No se exponen passwords, hashes, tokens, cookies ni session IDs.

**Estado:** **parcial** por evidencia dinámica poblada incompleta; implementación estática consistente.

### Sessions — aprobado con riesgos residuales documentados

**No-scroll y layout**

- `PAGE_SIZE = 8`, decisión específica por el presupuesto adicional del acceso a cambio de contraseña.
- Fixture denso con ocho sesiones validado en 1366×768 y 1440×900 sin scroll externo ni interno.
- Tabla desktop y lista mobile separadas; filtros, métricas y paginador compactos.

**Seguridad y guardrails**

- Revocación con confirmación y mensaje de auditoría.
- La sesión admin actual está deshabilitada para revocación.
- No se muestran token de sesión, hashes, cookies ni passwords.

**Estado:** **aprobado para el contrato desktop auditado**. Queda pendiente una prueba mobile poblada y persiste la deuda backend documentada sobre el total combinado en cargas muy grandes.

---

## Matriz de cumplimiento

| Módulo | 1366×768 | 1440×900 | Datos densos E2E | Responsive/mobile | Seguridad | Documentación | Dictamen |
|---|---|---|---|---|---|---|---|
| Overview | Pasa shell/hub | Pasa shell/hub | No | Estructura compacta; sin caso poblado dedicado | Sin exposición detectada | Completa | Parcial |
| Clinics | Pasa | Pasa | Sí, 9 filas | Tabla responsive; sin mobile E2E dedicado | P2 por password visible | Completa | Parcial |
| Tokens | No cubierto por spec real | No cubierto por spec real | No | Lista mobile estática; sin no-scroll E2E | Enmascarado y guardrails correctos | Completa y declara gap | Parcial |
| Reports | Pasa vacío | Pasa vacío | No | Lista mobile estática; sin caso poblado | Signed URL bajo demanda | Completa y declara gap | Parcial |
| Audit | Pasa overflow vacío | Pasa overflow vacío | No | Lista mobile estática; sin caso poblado | Sanitización correcta | Completa y declara gap | No apto por P1 |
| Users/Roles | No incluido en spec real | No incluido en spec real | No | Otros specs lo referencian; sin fixture denso | Confirmación y último Owner | Completa salvo metadata de rama/base | Parcial |
| Sessions | Pasa | Pasa | Sí, 8 filas | Lista mobile estática; sin fixture mobile ejecutado | Confirmación y sesión actual protegida | Completa | Aprobado desktop |

### Contratos transversales

| Contrato | Estado | Evidencia |
|---|---|---|
| `dashboard-main` sin scroll | Cumple | `overflow-hidden`; E2E mide html/body/main/workspace/viewport/surface |
| Sin `overflow-y-auto` en cards auditadas | Cumple | Búsqueda exacta sin coincidencias |
| Sin región vertical usada como escape | Cumple | Sin `overflow-y-scroll` ni `data-dashboard-scroll-region` |
| Cadena `flex/min-h-0` | Cumple | Workspaces y cards principales conservan la cadena |
| Paginación acotada | Cumple | 9/9/9/9/9/8 según módulo |
| Tabla mobile ilegible evitada | Cumple salvo Clínicas | Tokens, Reports, Audit, Users/Roles y Sessions usan lista `md:hidden` |
| Sin overflow horizontal comprobado | Parcial | Pasa en rutas E2E medidas; faltan Tokens/Users y datasets poblados |
| Loading/empty/error | Cumple estático | Estados compactos y `role="alert"` donde corresponde |
| 401/403 explícitos | Parcial | `ApiResponseError` conserva status, pero las vistas suelen mostrar `error.message` sin mapear semánticamente 401/403 |
| Navegación/anclas | Cumple | Contratos `?module=`, IDs y suites de navegación pasan |
| Errores de navegador en E2E | No cumple | El spec no falla ante `pageerror`; hydration mismatch queda verde |

---

## Hallazgos P0/P1/P2/P3

### P0

No se detectaron hallazgos P0.

### P1

#### P1-01 — Hydration mismatch reproducible en Audit

- **Evidencia:** ejecución completa 28/28 y repetición focal 2/2; ambas emitieron el error en 1366×768 y 1440×900.
- **Traza:** `AdminAuditFilterBar` → trigger `ModuleDialog` → Radix Dialog → `Button`.
- **Impacto:** regeneración cliente del árbol SSR, posible pérdida de foco/estado y primera interacción no determinista.
- **Gap de test:** `dashboard-real-app-shell-no-scroll-contract.spec.ts` solo afirma overflow; no falla por `pageerror` ni error de hidratación.
- **Acción:** corregir el árbol/IDs SSR y agregar guard E2E de errores de navegador.

#### P1-02 — Completion no-scroll no demostrado con datos densos en cuatro módulos y Overview

- **Cubiertos con fixture denso:** Clinics y Sessions.
- **No incluidos en `ROUTES`:** Tokens y Users/Roles.
- **Incluidos sin endpoint mock/datos:** Reports y Audit.
- **Overview:** admin hub sin fixture denso de actividad/auditoría.
- **Impacto:** no puede asegurarse que nueve filas, mensajes reales, badges, filtros y paginación entren juntos en el viewport mínimo.
- **Acción:** completar una matriz E2E poblada y exigir contenido fixture visible antes de medir overflow.

### P2

#### P2-01 — Contraseñas de alta y recuperación de Clínica visibles por defecto

- `AdminClinicsManagementCard.tsx` y `ClinicEditDrawer.tsx` usan `type="text"` para contraseñas nuevas.
- `frontend-admin-clinics-management-card.test.ts` exige explícitamente que no sean `type="password"`.
- **Impacto:** exposición visual/shoulder surfing y captura accidental en screenshots o asistencia remota.
- **Acción:** input enmascarado por defecto con reveal temporal explícito; conservar `autocomplete="new-password"` y confirmación de cambio.

#### P2-02 — 401/403 no están diferenciados de forma consistente en la UI

- `apiFetch` conserva `status` en `ApiResponseError`, pero los cards capturan principalmente `error.message`.
- Si backend no entrega mensaje, el operador recibe `HTTP 401` o `HTTP 403`; no hay comportamiento uniforme de sesión expirada vs permiso insuficiente.
- **Acción:** mapeo compartido seguro: 401 → sesión inválida/relogin; 403 → permiso insuficiente/origen rechazado, sin filtrar detalle interno.

#### P2-03 — Cobertura responsive productiva incompleta

- Existen listas mobile y algunos specs globales a 390×844, pero no una matriz poblada para los seis módulos Admin.
- Clinics conserva tabla responsive en mobile en vez de una lista priorizada.
- Diálogos y estados transitorios tampoco forman parte del contrato no-scroll ejecutado.
- **Acción:** fixtures mobile poblados para lista, empty, loading/error y diálogos principales.

### P3

#### P3-01 — Metadata documental inconsistente en Users/Roles

- Cinco documentos incluyen encabezado de rama y base.
- `admin-users-roles-enterprise-density.md` no registra esos dos datos, aunque sí documenta scope, page size, validaciones, deuda y riesgos.

#### P3-02 — Paginación Tokens puede abrir una página vacía

- Al no existir `total` ni `hasNextPage`, `tokens.length === PAGE_SIZE` habilita Siguiente.
- Un total múltiplo exacto de nueve produce un salto adicional vacío.
- Está documentado y no implica datos falsos, pero reduce calidad operativa.

---

## Riesgos residuales

1. El fit de 9 filas depende de mantener densidad, copy y alturas actuales; mensajes de error/éxito pueden sumar altura no cubierta por E2E poblado.
2. Tokens no tiene total/hasNext real; Reports tiene `hasMore` pero no total global.
3. Audit realiza varias lecturas acotadas y carece de agregación server-side específica.
4. Sessions usa 8 filas y depende del presupuesto del acceso a cambio de contraseña.
5. Page sizes 25/50/100 no son compatibles con el contrato actual sin una decisión explícita; no deben incorporarse como scroll regional silencioso.
6. Mobile/tablet no cuenta con una matriz productiva poblada para todos los módulos y estados.
7. Los 404/fallback del web server E2E generan ruido y pueden ocultar errores reales de consola, como ocurrió con hydration.
8. La suite E2E permite terminar en verde aun con errores no capturados del navegador.

---

## Recomendaciones de PRs siguientes

### Próximo PR concreto — `fix/admin-audit-hydration-guard`

**Objetivo:** eliminar el hydration mismatch de Audit y convertir cualquier regresión equivalente en fallo E2E.

**Scope mínimo propuesto:**

- `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx`.
- `frontend/src/components/dashboard/ModuleDialog.tsx` solo si la causa confirmada está en el contrato compartido de Radix/IDs.
- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts` para capturar `pageerror` y errores de hidratación.
- Test contractual focal de Audit si es necesario.
- Documento de implementación del PR.

**Riesgo:** medio si requiere tocar `ModuleDialog`, porque es compartido; bajo si la corrección queda aislada en Audit.

**Aceptación:** 2/2 Audit sin overflow, sin `pageerror`, sin hydration warning y con el filtro mobile abriendo/cerrando por teclado.

### PR siguiente — `test/admin-enterprise-density-populated-no-scroll-completion`

- Agregar fixtures densos para Overview, Tokens, Reports, Audit y Users/Roles.
- Incluir todas las rutas en el spec real.
- Verificar 1366×768, 1440×900, 768×1024 y 390×844.
- Exigir marcador de contenido poblado antes de medir.
- Medir html/body/main/workspace/viewport/surface y peor scroll regional horizontal/vertical.
- Cubrir loading, empty, error y paginación; sin modificar producto.

### PR posterior — `fix/admin-clinics-password-visibility`

- Enmascarar contraseñas nuevas por defecto.
- Reveal temporal accesible y deliberado.
- Mantener confirmación de reemplazo, autocomplete y contratos backend.

### PR posterior — `fix/admin-api-error-semantics`

- Mapear 401/403 de forma compartida y segura.
- Añadir tests por módulo crítico sin tocar auth, cookies ni backend salvo autorización separada.

---

## Validaciones ejecutadas

### Terminal 1 — Base y auditoría estática

```powershell
git status --short
git branch --show-current
git log -1 --oneline
git diff --name-only main...HEAD
```

Resultado inicial:

- Rama correcta: `audit/admin-enterprise-density-completion`.
- Base correcta: `f4ed930`.
- Working tree limpio.
- Sin diferencias entre `main...HEAD`.

Se inspeccionaron los seis documentos de implementación, las seis suites enterprise density, componentes productivos, CSS del App Shell, cliente API y specs E2E relacionados. No se leyeron archivos `.env`.

### Terminal 1 — Tests

```powershell
pnpm test test/admin-overview-clinics-enterprise-density.test.ts test/admin-tokens-enterprise-density.test.ts test/admin-reports-enterprise-density.test.ts test/admin-audit-enterprise-density.test.ts test/admin-users-roles-enterprise-density.test.ts test/admin-sessions-enterprise-density.test.ts
```

**Ejecutado y pasó:** 2806 tests, 2806 aprobados, 0 fallos. El script raíz expande `test/**/*.test.ts`, por lo que la invocación ejecutó la suite completa además de los seis paths explícitos.

### Terminal 1 — Calidad frontend

```powershell
pnpm --dir frontend lint
pnpm --dir frontend typecheck
```

- **Lint:** ejecutado y pasó.
- **Typecheck:** ejecutado y pasó.

### Terminal 2 — E2E real App Shell no-scroll

```powershell
pnpm --dir frontend exec playwright test frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts
```

**Ejecutado y pasó en asserts:** 28/28 tests Chromium, incluyendo 1366×768 y 1440×900.

Observaciones que impiden considerar el resultado totalmente verde:

- Audit emitió hydration mismatch no capturado por el test.
- Audit, Overview y Reports recibieron 404/fallback para endpoints no mockeados.
- Solo Clinics y Sessions se verificaron con fixtures densos dentro de este spec.

Reproducción focal:

```powershell
pnpm --dir frontend exec playwright test frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts --grep "admin audit log"
```

**Asserts:** 2/2 aprobados. **Navegador:** hydration mismatch reproducido en ambos viewports.

### Validaciones no ejecutadas

- `pnpm build`: no ejecutado; auditoría sin implementación y no incluido en las validaciones sugeridas de esta tarea.
- `pnpm --dir frontend build`: no ejecutado por el mismo motivo.
- `pnpm security:public-surface`: no ejecutado como comando independiente. La suite completa sí ejecutó los guardrails de seguridad registrados y pasó 2806/2806.

### Efecto lateral de Playwright

Playwright cambió temporalmente `frontend/next-env.d.ts` de `.next/types/routes.d.ts` a `.next/dev/types/routes.d.ts`. Se restituyó exactamente al contenido base antes de crear este documento. No queda diff productivo.

---

## Confirmación de no modificación de código productivo

- No se modificó código productivo.
- No se modificaron tests.
- No se modificaron dependencias, `package.json` ni `pnpm-lock.yaml`.
- No se modificaron backend, DB, migraciones, auth, cookies, CSP, CORS, CI ni workflows.
- No se leyó ni modificó `.env` o secretos.
- El único archivo nuevo es `docs/audit/admin-enterprise-density-completion-audit.md`.

## Estado final

**Auditoría completada.** El dashboard presenta una implementación enterprise density mayormente coherente, pero el cierre productivo queda condicionado a resolver primero el hydration mismatch de Audit y luego completar la matriz E2E poblada. El próximo PR recomendado es `fix/admin-audit-hydration-guard`.
