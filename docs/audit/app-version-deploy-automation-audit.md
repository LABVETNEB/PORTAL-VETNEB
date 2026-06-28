# Auditoría — Automatización del despliegue de versión de app (version gate)

> **Modo: AUDITORÍA Y PROPUESTA. No implementa código, no toca workflows, no toca Render real, no toca variables reales, no hace commit/push/PR.**
>
> - Rama: `audit/app-version-deploy-automation`
> - HEAD auditado: `5e81397` — `test(api): cover client version gate runtime wiring (#1156)`
> - `main` limpio · PRs abiertos esperados: 0
> - Skill aplicada: `vetneb-production-web-optimization-engineer`
> - Fecha: 2026-06-28

---

## 1. Resumen ejecutivo

El version gate ya funciona en producción. El problema **no es el código**: es el
**modelo operativo manual** de tres variables en Render
(`NEXT_PUBLIC_APP_VERSION`, `APP_VERSION`, `CLIENT_MIN_VERSION`) que hoy se
editan a mano en cada release obligatoria.

Durante la auditoría apareció un hallazgo que **cambia la premisa del brief** y
debe resolverse antes de automatizar nada:

> **Hallazgo P0 (corrección de premisa).** Con valores tipo **SHA de commit**,
> la comparación del backend (`isClientVersionSupported`) es **igualdad exacta**;
> no existe "mayor o igual". Además `/api/app-version` devuelve
> `forceUpdate: true` **siempre** (hardcodeado), y el gate de polling del
> frontend bloquea cuando `NEXT_PUBLIC_APP_VERSION ≠ APP_VERSION` (desigualdad
> estricta).
>
> Por lo tanto, el "deploy normal" descrito en el objetivo
> (`CLIENT_MIN_VERSION = <versión mínima anterior>` distinta del SHA nuevo)
> **no produce** "no bloquea usuarios anteriores compatibles": produce lo
> **inverso** — bloquea a los clientes **nuevos** (su SHA ≠ mínimo) y solo deja
> pasar a los que tengan exactamente el SHA viejo. Ver §4 (Riesgos) R1.

Conclusión operativa: con el esquema SHA actual, el gate es **binario**
(o exige el token exacto = "force update permanente", o se apaga). El esquema de
versionado y la automatización deben diseñarse **juntos**, no por separado.

Recomendación (detalle en §6 y §7):

1. **Decisión conceptual primero**: tratar las tres variables como un único
   **"token de contrato de cliente"** (no como el SHA de cada deploy). Cambian
   **solo en force update**; en deploy normal **no se tocan**. Esto vuelve
   correcto el modelo normal/force **sin cambiar código** y es lo que habilita
   automatizar con seguridad.
2. **Semi-automatizar** con un workflow `workflow_dispatch` (input
   `force_update: true|false`) que escribe las variables en Render vía API,
   despliega **frontend primero, backend después**, y corre el smoke. Sin
   auto-merge: el operador decide cuándo y si es force.
3. **(Opcional, PR posterior)** migrar el valor de enforcement a un formato
   **monótono** (semver o build-number) para que "deploy normal" pueda subir
   versión sin bloquear y para que las transiciones de force update queden
   **sin ventana de corte**. Esta migración es, ella misma, **un force update
   único** y debe planificarse como tal.

---

## 2. Estado actual validado

### 2.1 Producción (reportado y consistente con el código)

| Superficie | Variable | Valor reportado |
| --- | --- | --- |
| Frontend (build) | `NEXT_PUBLIC_APP_VERSION` | `5e81397da98266e98f88563e0c6d1eb0064e7eb8` |
| Backend (runtime) | `APP_VERSION` | `5e81397da98266e98f88563e0c6d1eb0064e7eb8` |
| Backend (runtime) | `CLIENT_MIN_VERSION` | `5e81397da98266e98f88563e0c6d1eb0064e7eb8` |

Las tres iguales al **SHA largo** de HEAD. Esto significa que **hoy producción
está en modo "force update permanente"**: solo pasa el cliente que corre
exactamente ese bundle.

### 2.2 Smoke productivo validado (reportado)

- `GET /api/app-version` → `200` con la versión vigente.
- `GET /api/auth/me` sin `X-VETNEB-Client-Version` → `426`.
- `GET /api/auth/me` con versión vieja → `426`.
- `GET /api/auth/me` con versión válida → `401 No autenticado` (pasa el gate y
  llega a auth normal). **Correcto.**

### 2.3 Inventario de infraestructura (auditado en repo)

| Elemento | Estado en repo |
| --- | --- |
| `.github/workflows/` | Solo `backend-ci.yml` y `frontend-ci.yml` — **validación, no deploy**. |
| `workflow_dispatch` | **No existe** en ningún workflow. |
| `render.yaml` | **No existe** (config de Render vive solo en el dashboard). |
| Uso de Render API / `RENDER_API_KEY` | **No existe** en el repo. |
| Despliegue | No declarado en repo. **NO CONFIRMADO**: probablemente auto-deploy-on-push o manual desde el dashboard de Render. Verificar manualmente. |
| Smoke | `pnpm smoke:staging` → `scripts/dev/smoke-staging.ps1` (PowerShell, sanitizado, con retries). `smoke:prod:public`, `smoke:test`, `smoke:upload`. |

---

## 3. Flujo actual de versión (responde Q1)

### 3.1 Dónde nace cada valor

| Pregunta | Respuesta (evidencia) |
| --- | --- |
| **Versión del frontend** | `CLIENT_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim() \|\| "missing-client-version"` — [`frontend/src/lib/app-version.ts:7`](frontend/src/lib/app-version.ts:7). **Es build-time**: queda *horneada* en el bundle durante `next build`. |
| **Versión del backend** | `appVersion = APP_VERSION ?? RENDER_GIT_COMMIT ?? "development"` — [`server/lib/env.ts:151`](server/lib/env.ts:151). **Es runtime**. |
| **Valor del client header** | El cliente API centralizado pone `X-VETNEB-Client-Version: CLIENT_APP_VERSION` en **toda** request — [`frontend/src/lib/api.ts:243`](frontend/src/lib/api.ts:243) y [`app-version.ts:24`](frontend/src/lib/app-version.ts:24). |
| **Valor de `/api/app-version`** | Devuelve `{ appVersion, clientMinVersion, forceUpdate: true, displayVersion }` — [`server/routes/app-version.fastify.ts:41`](server/routes/app-version.fastify.ts:41). `clientMinVersion = CLIENT_MIN_VERSION ?? appVersion` — [`env.ts:163`](server/lib/env.ts:163). |
| **Valor que arma el bloqueo 426** | El hook `requireMinimumClientVersionForFastify` compara header vs `ENV.clientMinVersion` y responde `426 CLIENT_VERSION_UNSUPPORTED` — [`server/middlewares/version-gate.ts:89-111`](server/middlewares/version-gate.ts:89). Solo se arma si `CLIENT_MIN_VERSION` está seteado (`clientVersionGateEnforced = Boolean(rawEnv.CLIENT_MIN_VERSION)` — [`env.ts:164`](server/lib/env.ts:164)). |

### 3.2 Las DOS rutas de enforcement (clave para entender el riesgo)

Existen **dos** mecanismos de bloqueo, gobernados por **variables distintas**:

| Gate | Compara | Variable que lo gobierna | Semántica |
| --- | --- | --- | --- |
| **Backend 426** (real, bloquea PWA vieja) | `header` vs `clientMinVersion` | `CLIENT_MIN_VERSION` | Igualdad si es SHA; `>=` solo si **ambos** son semver punteado — [`version-gate.ts:61-87`](server/middlewares/version-gate.ts:61). |
| **Frontend polling** (UX, cada 60s) | `CLIENT_APP_VERSION` (horneado) vs `snapshot.appVersion` | `APP_VERSION` (+ `NEXT_PUBLIC_APP_VERSION`) | Desigualdad **estricta** `!==`, con `forceUpdate` siempre `true` — [`app-version.ts:35-41`](frontend/src/lib/app-version.ts:35). |

**Implicación:** para "no molestar a nadie" en un deploy normal hay que dejar
**las tres** variables sin cambios. Cambiar `APP_VERSION` solo (aunque no toques
`CLIENT_MIN_VERSION`) activa el **gate de polling** para clientes cuyo bundle
horneado ≠ nuevo `APP_VERSION`.

### 3.3 Versión técnica vs. comercial (ya resuelto, no se toca)

`appVersion`/`clientMinVersion` son **técnicos** (SHA) y nunca se renderizan
crudos. La versión comercial sale de `npm_package_version` →
`displayVersion = "Portal VETNEB v<semver>"` ([`app-version.fastify.ts:18-26`](server/routes/app-version.fastify.ts:18))
y `toSafeDisplayVersion()` ([`app-version.ts:55-73`](frontend/src/lib/app-version.ts:55)).
El SHA de diagnóstico también está disponible aparte vía
`/api/build-info` ([`build-info/route.ts`](frontend/src/app/api/build-info/route.ts)).
**Conclusión:** el valor de enforcement **no necesita ser el SHA** para tener
diagnóstico; el SHA ya está cubierto por otras vías.

---

## 4. Riesgos del flujo manual actual (responde Q2)

| ID | Riesgo | Severidad | Detalle / evidencia |
| --- | --- | --- | --- |
| **R1** | **Premisa de "deploy normal" rota con SHA** | **P0 (diseño)** | Con SHA la comparación es igualdad. `CLIENT_MIN_VERSION = SHA_viejo` y clientes nuevos enviando `SHA_nuevo` → `SHA_nuevo ≠ SHA_viejo`, el parseo numérico falla → **426 a los nuevos**. El "no bloquea usuarios anteriores compatibles" del brief **no ocurre**. El único "normal" seguro con el código actual es **no cambiar ninguna de las tres variables**. |
| **R2** | **`NEXT_PUBLIC_APP_VERSION` es build-time** | **P1** | No basta cambiar la env var + reiniciar: el frontend debe **rebuild** desde el commit correcto para *hornear* el valor. Un cambio de env sin rebuild deja el bundle con el valor viejo → mismatch silencioso. |
| **R3** | **Mismatch frontend/backend** | **P1** | Si `NEXT_PUBLIC_APP_VERSION` (horneado) ≠ `APP_VERSION` (backend) → gate de polling bloquea; si header ≠ `CLIENT_MIN_VERSION` → 426. Editar 3 campos a mano en 2 servicios es propenso a desalineación. |
| **R4** | **Backend bloquea antes de que el frontend nuevo esté desplegado** | **P1** | Con igualdad SHA, subir `CLIENT_MIN_VERSION` al nuevo valor mientras el frontend aún sirve el bundle viejo → **outage total** hasta que termine el deploy de frontend. Cualquier orden tiene ventana de corte bajo igualdad (ver §7.2). |
| **R5** | **Olvidar `CLIENT_MIN_VERSION`** | **P2** | Si se setea `APP_VERSION` nuevo pero no `CLIENT_MIN_VERSION`: el gate 426 queda **desarmado** (`clientVersionGateEnforced=false`) pero el **polling** sí molesta. Estado incoherente. |
| **R6** | **SHA corto vs SHA largo** | **P1** | La comparación 426 es igualdad **textual**. `5e81397` (7) ≠ `5e81397da98…` (40). Mezclar largos en una var y cortos en otra bloquea a todos. Hoy todo está en SHA largo: hay que mantener **un solo formato**. |
| **R7** | **PWA/bundle viejo cacheado** | **P1** | Aunque Render despliegue bien, el service worker viejo puede seguir sirviendo el shell anterior. El cliente sigue enviando el header viejo → 426 legítimo, pero el usuario percibe "me bloquearon sin razón". Mitigado por `SW_VERSION` + flujo "Actualizar ahora", pero sigue siendo causa de tickets. |
| **R8** | **Rollback** | **P1** | Revertir código sin revertir las tres variables (y rebuild de frontend) deja un estado donde el bundle servido y el `CLIENT_MIN_VERSION` no coinciden. El rollback debe revertir **código + las tres variables + rebuild**, en orden. |
| **R9** | **Espacios/whitespace y copy-paste** | **P2** | El header se compara `trim()`-eado de un lado; un valor con espacio o salto de línea pegado en el dashboard de Render puede romper la igualdad. Riesgo típico de edición manual. |
| **R10** | **Sin fuente de verdad versionada** | **P2** | Las tres variables viven solo en el dashboard de Render. No hay `.env.example` ni doc que las liste (confirmado: `NOT documented in any .env.example`). No hay registro de "qué valor estaba antes" para rollback. |

---

## 5. Alternativas comparadas (responde Q3)

| Opción | Descripción | Pros | Contras | Veredicto |
| --- | --- | --- | --- | --- |
| **A. Manual actual** | Editar 3 vars a mano en Render por release. | Cero infra nueva. | Todos los riesgos R1–R10. No reproducible. No auditable. | **Estado a superar.** |
| **B. Automático en cada merge** | Cada merge a `main` reescribe las 3 vars al nuevo SHA y despliega. | Cero toil. Siempre alineado. | **Cada release sería un force update** (igualdad SHA) → bloquea a todos los usuarios en cada merge, incluido docs/typos. Inaceptable. | **Rechazada.** |
| **C. Semi-automático `workflow_dispatch`** | Workflow manual con input `force_update: true\|false`; el operador decide. | Control humano del bloqueo; reproducible; auditable; sin reescribir vars en deploys normales. | Requiere crear 1 workflow + 3 secrets. | **Recomendada (mecanismo).** |
| **D. Render API para env vars** | Programar las escrituras de env vars vía Render API + trigger de deploy. | Es el *cómo* concreto que habilita C. Rebuild de frontend con `clearCache`. | Requiere `RENDER_API_KEY`; ordenar deploys; manejar build-time vs runtime. **NO CONFIRMADO**: endpoints exactos a validar contra docs Render vigentes. | **Recomendada como transporte de C.** |
| **E. Solo `APP_VERSION` autogenerado + `CLIENT_MIN_VERSION` manual** | Backend toma `APP_VERSION` de `RENDER_GIT_COMMIT`; el operador sube `CLIENT_MIN_VERSION` solo en force. | Menos campos a tocar. | No resuelve `NEXT_PUBLIC_APP_VERSION` (build-time, frontend). El polling sigue dependiendo de `APP_VERSION` autogenerado cambiando en cada deploy → molesta. | **Parcial; insuficiente sola.** |
| **F. Semver comercial (2.1.x) en vez de SHA** | Usar `MAJOR.MINOR.PATCH` como valor de enforcement. | Activa la rama `>=` de la comparación → "deploy normal" sube versión **sin bloquear**; force update = subir el mínimo. Unifica con `displayVersion`. | Requiere bump humano/automatizado de `package.json`; la migración desde SHA es un force update único. | **Recomendada como objetivo (PR posterior).** |
| **G. SHA técnico + `displayVersion` comercial** | Lo que **ya existe**: SHA para enforcement, semver de `package.json` para UI. | Ya implementado y probado. | El enforcement sigue siendo igualdad SHA → arrastra R1/R4. | **Estado actual; coexiste con la recomendación.** |

---

## 6. Recomendación para VETNEB (responde Q4)

### 6.1 Decisión conceptual (sin cambio de código): token de contrato de cliente

Tratar `NEXT_PUBLIC_APP_VERSION` + `APP_VERSION` + `CLIENT_MIN_VERSION` como **un
único token acoplado** ("client contract version"), **no** como el SHA de cada
deploy. Regla:

- **Deploy normal:** **no se toca ninguna de las tres.** Se despliega el código
  nuevo; el bundle re-hornea el mismo token; todos los clientes (viejos y
  nuevos) siguen enviando el mismo valor → nadie se bloquea, nadie recibe nag de
  polling. ✅ (Correcto con el código actual, por R1/§3.2.)
- **Force update:** se cambian **las tres juntas** al nuevo token (puede ser el
  SHA del commit que introdujo el cambio incompatible). Frontend rebuild primero,
  backend después. Los clientes con bundle viejo quedan bloqueados (objetivo). ✅

Esto **corrige el modelo normal/force sin tocar código** y es la base segura para
automatizar.

> El SHA del commit del force update sirve perfectamente como *valor* del token.
> Lo que cambia es la **regla de uso**: el token **no se rebobina en cada
> deploy**, solo en force updates.

### 6.2 Mecanismo: semi-automático (Opción C + D)

Un workflow `workflow_dispatch` con `force_update: true|false` que:

- **`force_update=false`** → **no escribe** las tres vars; solo (re)dispara el
  deploy de los servicios (o no hace nada si Render ya auto-despliega en push).
- **`force_update=true`** → escribe las tres vars al token objetivo, **rebuild de
  frontend primero**, luego backend, luego smoke.

### 6.3 Objetivo posterior (Opción F): enforcement monótono

En un PR separado (clase *security/runtime patch*, con su propio go/no-go),
migrar el valor de enforcement a **semver** (o build-number monótono, p. ej.
`git rev-list --count HEAD`). Beneficios:

- "Deploy normal" puede subir la versión del cliente **sin bloquear** (la rama
  `>=` ya existe en `version-gate.ts`, no requiere código nuevo de comparación).
- Force update queda **sin ventana de corte** (ver §7.2): con `min` monótono, el
  backend acepta el viejo **y** el nuevo durante la transición.
- La migración inicial SHA→monótono es **un force update único** planificado.

**Por qué no ahora:** el brief pide auditar y proponer, una cosa por vez, y no
tocar runtime. La opción 6.1 ya resuelve el toil y el riesgo R1 **sin código**.

---

## 7. Diseño propuesto de automatización (responde Q5)

> **Propuesta documental. No se crea el workflow en esta entrega.**

### 7.1 Workflow `workflow_dispatch`

```yaml
# .github/workflows/app-version-deploy.yml  (PROPUESTO — no creado)
name: App Version Deploy (manual)

on:
  workflow_dispatch:
    inputs:
      force_update:
        description: "Bloquear clientes viejos (force update)"
        type: boolean
        default: false
      target_sha:
        description: "Commit a desplegar (default: HEAD de main)"
        type: string
        required: false

permissions:
  contents: read

concurrency:
  group: app-version-deploy
  cancel-in-progress: false   # nunca cancelar un deploy a medias
```

**Inputs**

- `force_update: true|false` — gobierna si se reescribe el token.
- `target_sha` (opcional) — default `github.sha` / HEAD de `main`. Se usa como
  **valor del token** cuando `force_update=true` y para desplegar el commit
  exacto en ambos servicios.

**Pasos (alto nivel)**

1. Resolver `TARGET = inputs.target_sha || HEAD(main)` y validar formato (hex
   7–40). Marcar si es corto/largo y **normalizar a largo**.
2. **Si `force_update=true`:**
   1. Escribir en **frontend**: `NEXT_PUBLIC_APP_VERSION = TARGET`.
   2. Disparar **deploy de frontend con `clearCache`** (rebuild, NO restart) y
      **esperar** a estado `live`.
   3. Escribir en **backend**: `APP_VERSION = TARGET` y `CLIENT_MIN_VERSION = TARGET`.
   4. Disparar **deploy de backend** y **esperar** `live`.
3. **Si `force_update=false`:** no escribir vars; (opcional) re-disparar deploy
   de ambos servicios al `TARGET`, o no hacer nada si Render auto-despliega.
4. **Smoke posterior** (paso obligatorio, §9) contra producción. Si falla un
   check requerido → el job falla y se dispara el runbook de rollback (§8.3).

### 7.2 Orden de deploy y por qué importa

**Orden propuesto: frontend → backend.**

- **Force update bajo monótono (objetivo, §6.3):** frontend primero (clientes
  empiezan a enviar versión nueva, que el backend con `min` viejo **acepta** por
  `>=`), luego backend sube `min` (recién ahí caen los viejos). **Sin ventana de
  corte.** ✅
- **Force update bajo igualdad SHA (estado actual):** **cualquier** orden tiene
  una ventana donde un grupo queda bloqueado, porque un único `min` no puede
  aceptar viejo **y** nuevo a la vez. Frontend-primero minimiza el daño (las
  sesiones viejas ya abiertas siguen hasta que el backend sube `min`; las cargas
  nuevas se bloquean brevemente hasta que backend alinea). **Aceptar la ventana
  como costo conocido del force update**, o migrar a monótono (§6.3) para
  eliminarla.
- **Deploy normal (token sin cambios):** el orden es indistinto (nadie se
  bloquea). Mantener frontend→backend por consistencia.

### 7.3 Build-time vs runtime (regla dura)

- **Frontend (`NEXT_PUBLIC_APP_VERSION`):** build-time → **siempre rebuild**
  (`clearCache: "clear"` en el deploy de Render). Un restart **no** re-hornea el
  valor.
- **Backend (`APP_VERSION`, `CLIENT_MIN_VERSION`):** runtime → deploy/restart
  normal alcanza.

---

## 8. Variables y secretos necesarios

### 8.1 Variables de aplicación (Render — no se tocan en esta entrega)

| Servicio | Variable | Tipo | Rol |
| --- | --- | --- | --- |
| Frontend | `NEXT_PUBLIC_APP_VERSION` | build-time | Valor horneado que el cliente envía en el header. |
| Backend | `APP_VERSION` | runtime | Gobierna el gate de polling y `/api/app-version`. |
| Backend | `CLIENT_MIN_VERSION` | runtime | Arma el gate 426 y define el mínimo aceptado. |

### 8.2 Secretos de CI (GitHub Actions — **propuestos, no se crean**)

| Secreto | Uso | Notas |
| --- | --- | --- |
| `RENDER_API_KEY` | Autenticar contra Render API. | Scope mínimo. Nunca se imprime en logs. |
| `RENDER_FRONTEND_SERVICE_ID` | Target de `NEXT_PUBLIC_APP_VERSION` + deploy con clearCache. | `srv-...`. |
| `RENDER_BACKEND_SERVICE_ID` | Target de `APP_VERSION` + `CLIENT_MIN_VERSION` + deploy. | `srv-...`. |
| (opcional) `SMOKE_ADMIN_USERNAME` / `SMOKE_ADMIN_PASSWORD` / `SMOKE_CLINIC_*` / `SMOKE_PARTICULAR_TOKEN` | Smoke autenticado (reusa `smoke-staging.ps1`). | Solo si se quiere smoke con login en el job. |

> **Render API — NO CONFIRMADO (validar contra docs vigentes antes de implementar):**
> - Actualizar env var (por clave): `PUT https://api.render.com/v1/services/{serviceId}/env-vars/{key}`.
> - Disparar deploy: `POST https://api.render.com/v1/services/{serviceId}/deploys` con `{"clearCache":"clear"}` para frontend (rebuild).
> - Consultar estado de deploy: `GET https://api.render.com/v1/services/{serviceId}/deploys/{deployId}` (esperar `live`).
> Confirmar nombres/forma exactos y si el cambio de env var **auto-dispara** deploy o requiere POST explícito.

---

## 9. Política de bloqueo (responde Q6)

### 9.1 Usar `force_update=true` cuando

- Cambios de **auth / sesión / contratos de API**.
- Cambios de **permisos / RBAC**.
- Cambios de **dashboard que requieran assets nuevos** incompatibles con el shell viejo.
- **Bug de PWA/cache** que obliga a invalidar bundles instalados.
- Cambios de **seguridad** (cookies, CORS, headers, leakage, public surface).

### 9.2 NO usar force update cuando

- Cambios **documentales**.
- **UI menor**, textos, copy.
- **Tests** o tooling interno.
- Cualquier cambio **no contractual** (no toca auth, sesión, API, permisos, assets críticos, seguridad).

### 9.3 Regla de oro

> Ante la duda, **NO** force update. Un force update innecesario bloquea a toda la
> base instalada y genera tickets; un force update omitido cuando hacía falta se
> corrige con un segundo deploy. El costo del falso positivo es mayor.

---

## 10. Runbook operativo (responde Q7)

> Todos los comandos en **PowerShell**. No se ejecutan en esta entrega.

### 10.1 Deploy normal (no bloquea a nadie)

1. Mergear a `main` (CI verde).
2. Desplegar código (auto-deploy de Render o `workflow_dispatch` con
   `force_update=false`).
3. **No cambiar** `NEXT_PUBLIC_APP_VERSION` / `APP_VERSION` / `CLIENT_MIN_VERSION`.
4. Smoke (§10.5). Esperado: `/api/auth/me` con versión válida → `401`/`200`
   (pasa el gate), nadie nuevo recibe `426`.

### 10.2 Force update (bloquea apps viejas/sin versión)

1. Definir `TARGET` = SHA largo del commit a exigir.
2. **Frontend primero:** setear `NEXT_PUBLIC_APP_VERSION = TARGET` → **rebuild**
   (clearCache) → esperar `live`.
3. **Backend después:** setear `APP_VERSION = TARGET` y `CLIENT_MIN_VERSION = TARGET`
   → deploy → esperar `live`.
4. Smoke (§10.5). Esperado: sin header → `426`; versión vieja → `426`; versión
   `TARGET` → `401`/`200`.
5. Comunicar a soporte (los clientes viejos verán "Actualización requerida").

### 10.3 Rollback

- **Disparador (de `release-go-no-go-policy.md`):** el deploy rompe login/sesión/
  autorización, lectura/escritura crítica, acceso público, informes, o bloquea
  usuarios por error.
- **Pasos:**
  1. Identificar `TARGET_PREV` = token anterior (registrarlo **antes** de cada
     force update — ver §11 tripwire).
  2. Revertir **código** al deploy estable previo en ambos servicios.
  3. Restaurar las **tres** variables a `TARGET_PREV`.
  4. **Rebuild de frontend** (build-time) + deploy de backend, **frontend primero**.
  5. Smoke (§10.5).
- **Atajo de emergencia (desarmar el gate):** **borrar** `CLIENT_MIN_VERSION` en
  backend y reiniciar → `clientVersionGateEnforced=false` → el gate 426 se apaga
  y **todos pasan** de inmediato (runtime, sin rebuild). Útil si el bloqueo fue
  un error. (El polling puede seguir; si molesta, alinear `APP_VERSION` al token
  que corre la mayoría.)

### 10.4 Qué hacer si usuarios quedan bloqueados por error

1. Confirmar con `GET /api/app-version` qué `clientMinVersion`/`appVersion`
   publica el backend.
2. Si el bloqueo fue no intencional → **atajo de emergencia** (§10.3): borrar
   `CLIENT_MIN_VERSION`.
3. Si fue intencional pero el cliente legítimo no actualiza → guiar el flujo
   "Actualizar ahora" / reinstalar PWA (checklist en
   `docs/implementation/APP_VERSION_GATE.md`).

### 10.5 Qué hacer si una versión válida devuelve `426`

Causas probables y diagnóstico:

1. **Frontend no re-horneado** (R2): el bundle servido tiene un
   `NEXT_PUBLIC_APP_VERSION` distinto del esperado → **rebuild** de frontend
   desde el commit correcto.
2. **Mismatch corto/largo** (R6) o **whitespace** (R9): comparar **textualmente**
   el header que envía el cliente con `CLIENT_MIN_VERSION` del backend.
3. **PWA/SW viejo** (R7): el cliente sigue sirviendo bundle anterior → "Actualizar
   ahora" / reinstalar.
4. **Header stripeado** por proxy/CDN: verificar que `X-VETNEB-Client-Version`
   llega al backend (smoke explícito abajo).

---

## 11. Smoke commands (PowerShell)

> Reutilizar el smoke existente cuando aplique; agregar los checks explícitos del
> version gate. **No se ejecutan en esta entrega.**

### 11.1 Smoke base existente

```powershell
# Smoke staging completo (ya en el repo)
pnpm smoke:staging
# o apuntando a producción explícita:
powershell -ExecutionPolicy Bypass -File scripts/dev/smoke-staging.ps1 `
  -BackendUrl "https://api.vetneb.com.ar" `
  -FrontendUrl "https://vetneb.com.ar"
```

### 11.2 Checks explícitos del version gate (los 4 del objetivo)

```powershell
$backend = "https://api.vetneb.com.ar"
$valid   = "5e81397da98266e98f88563e0c6d1eb0064e7eb8"  # token vigente
$old     = "0000000000000000000000000000000000000000"  # versión vieja simulada

# 1) /api/app-version -> 200 con versión vigente
Invoke-WebRequest -UseBasicParsing -Uri "$backend/api/app-version" |
  Select-Object StatusCode, Content

# 2) /api/auth/me SIN header -> 426
try {
  Invoke-WebRequest -UseBasicParsing -Uri "$backend/api/auth/me" -Headers @{ Origin = "https://vetneb.com.ar" }
} catch {
  "ME sin version -> HTTP " + [int]$_.Exception.Response.StatusCode  # esperado 426
}

# 3) /api/auth/me con versión VIEJA -> 426
try {
  Invoke-WebRequest -UseBasicParsing -Uri "$backend/api/auth/me" `
    -Headers @{ Origin = "https://vetneb.com.ar"; "X-VETNEB-Client-Version" = $old }
} catch {
  "ME version vieja -> HTTP " + [int]$_.Exception.Response.StatusCode  # esperado 426
}

# 4) /api/auth/me con versión VÁLIDA -> 401 (pasa el gate, llega a auth)
try {
  Invoke-WebRequest -UseBasicParsing -Uri "$backend/api/auth/me" `
    -Headers @{ Origin = "https://vetneb.com.ar"; "X-VETNEB-Client-Version" = $valid }
} catch {
  "ME version valida -> HTTP " + [int]$_.Exception.Response.StatusCode  # esperado 401
}
```

> Sanitización: nunca pegar cookies, tokens ni datos clínicos en evidencia. El
> SHA de versión **no** es secreto (es público en el header/`/api/app-version`),
> pero igual mantener la evidencia limpia según `release-go-no-go-policy.md`.

---

## 12. Tests y guardrails futuros (responde Q8 — no implementar)

| Guardrail | Qué valida | Forma propuesta |
| --- | --- | --- |
| **Tripwire de variables** | Que las tres vars de version gate estén documentadas y con regla "token único / no rebobinar en deploy normal". | Test de contrato docs-only que exija mención en un `.env.example` o doc de ops + nota de la regla (hoy `NOT documented`). |
| **Smoke de versión versionado** | Los 4 checks de §11.2 como script reutilizable (`smoke:version-gate`). | `.mjs`/`.ps1` parametrizable, en `scripts/smoke/`, sin credenciales. |
| **Guard "no exponer hashes al usuario"** | Que ningún componente UI interpole `CLIENT_APP_VERSION`/`snapshot.appVersion` crudos. | Ya cubierto parcialmente por `test/app-version-gate-contract.test.ts`; extender a cualquier render nuevo. |
| **Registro de token previo** | Que cada force update registre `TARGET` y `TARGET_PREV` (para rollback). | Campo en el registro go/no-go (`release-go-no-go-policy.md`) + salida del workflow. |
| **Validación de formato del token** | Hex 7–40 normalizado a largo; o semver válido si se migra a F. | Step de validación en el workflow propuesto (§7.1, paso 1). |

---

## 13. Próximo PR sugerido (si se decide implementar)

**Una cosa por vez**, en este orden:

1. **PR-AV1 (docs-only, recomendado como siguiente):**
   - Documentar la **regla del token de contrato** (§6.1) en
     `docs/implementation/APP_VERSION_GATE.md` y/o `docs/ops/`.
   - Listar las tres variables en un `.env.example` / doc de ops (cierra R10).
   - Sin runtime, sin CI, sin Render. Clase *docs-only* → validación
     `git diff --check` + review.

2. **PR-AV2 (CI/deploy — semi-automatización):**
   - Crear `.github/workflows/app-version-deploy.yml` (`workflow_dispatch`,
     input `force_update`, §7).
   - Agregar `smoke:version-gate` reutilizable.
   - Requiere los 3 secrets de Render. Clase *CI/deploy* → dry-run + rollback de
     config (`release-go-no-go-policy.md`).

3. **PR-AV3 (runtime, opcional — versionado monótono):**
   - Migrar enforcement a semver/build-number (Opción F, §6.3).
   - Es un **force update único** planificado, con go/no-go propio. Clase
     *security/runtime patch*.

---

## 14. No-alcance / exclusiones de esta entrega

- No se modifica código productivo (frontend/backend).
- No se crean ni modifican GitHub Actions ni CI.
- No se tocan variables reales, secretos, Render, Supabase, DB ni migraciones.
- No se tocan dependencias ni lockfiles.
- No hay commit, push ni PR.
- El workflow, los secrets y los endpoints de Render API son **propuestas**;
  los endpoints están marcados **NO CONFIRMADO** y deben validarse contra la
  documentación vigente de Render antes de implementar.

---

## 15. Validación de esta entrega

Por ser **docs-only**, no requiere `pnpm test`. Validación esperada:

```powershell
git status --short --untracked-files=all
git diff --stat
git diff -- docs/audit/app-version-deploy-automation-audit.md
```
