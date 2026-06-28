# Runbook — App Version Force Update Workflow

> Operativo del workflow `.github/workflows/app-version-force-update.yml`.
> Base conceptual: `docs/audit/app-version-deploy-automation-audit.md`.

## Qué hace el workflow

Rota el **token de contrato de cliente** del version gate y fuerza un
rebuild/redeploy en Render para **bloquear PWAs/apps viejas**. Mueve **las tres
variables al mismo token, juntas**:

| Servicio | Variable | Tipo | Rol |
| --- | --- | --- | --- |
| Frontend | `NEXT_PUBLIC_APP_VERSION` | **build-time** (requiere rebuild) | Valor horneado que el cliente envía en `X-VETNEB-Client-Version`. |
| Backend | `APP_VERSION` | runtime | Gobierna `/api/app-version` y el gate de polling del frontend. |
| Backend | `CLIENT_MIN_VERSION` | runtime | Arma el gate `426` (mínimo aceptado). |

Orden: **frontend → backend**. Es solo `workflow_dispatch` (manual). No corre en
push, PR ni schedule, y no toca los workflows de CI existentes.

### Pasos que ejecuta

1. Valida `confirm_force_update == FORCE_UPDATE_VETNEB` y el `contract_token`
   (no vacío, sin espacios, largo 7–100, charset `A-Za-z0-9._-`).
2. `PUT` `NEXT_PUBLIC_APP_VERSION` en el servicio frontend (Render API, variable
   individual).
3. Dispara deploy de frontend con el **deploy hook**.
4. `PUT` `APP_VERSION` y `CLIENT_MIN_VERSION` en el servicio backend.
5. Dispara deploy de backend con el **deploy hook**.
6. Espera el arranque del rollout.
7. Si `run_smoke=true`: hace polling de `/api/app-version` hasta que el token
   quede vivo y valida el gate (ver más abajo).

## Cuándo usarlo

Usar **solo** cuando se quiere bloquear apps/PWA viejas (force update):

- Cambios de auth / sesión / contratos de API.
- Cambios de permisos / RBAC.
- Cambios de dashboard que requieren assets nuevos incompatibles con el shell viejo.
- Bug de PWA/cache que obliga a invalidar bundles instalados.
- Cambios de seguridad (cookies, CORS, headers, leakage, public surface).

> **⚠️ NO usar para deploy normal.** Con tokens tipo SHA la comparación del
> backend es **igualdad exacta**: rotar el token **bloquea a toda la base
> instalada** hasta que cada cliente recargue el bundle nuevo. Un deploy normal
> (docs, UI menor, textos, tests, cambios no contractuales) **no debe rotar el
> token** — simplemente se despliega el código sin tocar estas variables.
>
> Regla de oro: ante la duda, **NO** force update.

## Secrets necesarios (GitHub → Settings → Secrets and variables → Actions)

| Secreto | Uso |
| --- | --- |
| `RENDER_API_KEY` | Bearer token para actualizar env vars vía Render API. |
| `RENDER_FRONTEND_SERVICE_ID` | Servicio frontend (`srv-…`) donde se setea `NEXT_PUBLIC_APP_VERSION`. |
| `RENDER_BACKEND_SERVICE_ID` | Servicio backend (`srv-…`) donde se setean `APP_VERSION` y `CLIENT_MIN_VERSION`. |
| `RENDER_FRONTEND_DEPLOY_HOOK_URL` | Deploy hook del frontend (URL con key embebida). |
| `RENDER_BACKEND_DEPLOY_HOOK_URL` | Deploy hook del backend (URL con key embebida). |

El workflow **nunca imprime** estos secretos. Solo registra **qué** variable se
actualiza y en **qué** servicio, más los códigos HTTP de respuesta.

> **Endpoints confirmados.** Las env vars se actualizan con el endpoint de
> **variable individual** de Render —
> `PUT https://api.render.com/v1/services/{serviceId}/env-vars/{envVarKey}` con
> `Authorization: Bearer $RENDER_API_KEY`— que modifica una sola variable sin
> tocar el resto de la lista. Los deploys se disparan con **deploy hooks**: una
> **URL única por servicio**, disponible en *Render → Settings → Deploy Hook* y
> apta para guardar como GitHub Secret.

### Cómo conseguir los valores en Render

- **Service ID:** abrir el servicio en el dashboard de Render; el ID `srv-…`
  aparece en la URL (`https://dashboard.render.com/web/srv-XXXXXXXX`) y en
  *Settings*.
- **Deploy Hook URL:** servicio → *Settings* → *Deploy Hook* → copiar la URL
  (formato `https://api.render.com/deploy/srv-XXXX?key=YYYY`). La URL completa es
  secreta: tratarla como contraseña.
- **API Key:** *Account Settings* → *API Keys* → crear una key con el menor
  alcance posible.

> El deploy hook dispara un deploy del **último commit de la rama conectada** del
> servicio. Asegurarse de que esa rama esté en el estado que se quiere desplegar
> antes de correr el workflow.

## Qué token usar

- El **SHA largo (40 hex)** del commit que introduce el cambio incompatible es la
  opción recomendada (mismo formato que el token vigente en producción).
- También se acepta semver comercial (`2.1.0`, `v2.1.0`) u otro token limpio sin
  espacios (charset `A-Za-z0-9._-`).
- **Mantener un único formato** entre las tres variables. Mezclar SHA corto y
  largo rompe la igualdad y bloquea a todos.

## Orden frontend → backend (por qué)

El frontend se actualiza y despliega **primero** para que el bundle nuevo (que
hornea el token) empiece a estar disponible antes de que el backend suba el
mínimo. Con igualdad SHA existe una **ventana de corte inevitable** (un único
mínimo no puede aceptar el token viejo y el nuevo a la vez); frontend-primero la
minimiza. Para eliminarla por completo habría que migrar el enforcement a un
formato monótono (semver/build-number) — ver §6.3 del audit.

## Smoke esperado (cuando `run_smoke=true`)

Contra producción, sin login real, sin imprimir cookies:

| Check | Esperado |
| --- | --- |
| `GET https://api.vetneb.com.ar/api/app-version` | `appVersion` y `clientMinVersion` == `contract_token` |
| `GET https://vetneb.com.ar/api/app-version` | `appVersion` == `contract_token` (valida el proxy same-origin) |
| `GET https://api.vetneb.com.ar/api/auth/me` **sin** `X-VETNEB-Client-Version` | `426` |
| `GET …/api/auth/me` con `X-VETNEB-Client-Version: 0000000` | `426` |
| `GET …/api/auth/me` con `X-VETNEB-Client-Version: <contract_token>` | `401` (pasa el gate, llega a auth) |

El workflow **falla** si: sin versión no da `426`; versión vieja no da `426`;
versión válida no da `401`; o `/api/app-version` no expone el token en frontend o
backend.

> El valor horneado de `NEXT_PUBLIC_APP_VERSION` no se puede leer directamente por
> HTTP; el smoke valida el token a través de `/api/app-version` (backend + proxy)
> y del comportamiento del gate. Para confirmar el bundle nuevo en un cliente
> real, recargar la app y verificar que ya no aparece "Actualización requerida".

## Rollback / emergencia

**Si usuarios legítimos quedan bloqueados por error** (force update indebido o
token mal puesto), desarmar el gate es inmediato y runtime:

1. En el **backend** (Render), **vaciar o borrar** `CLIENT_MIN_VERSION`.
2. **Redeploy/restart** del backend.
3. Resultado: `clientVersionGateEnforced` pasa a `false` y el gate `426` se apaga
   → **todos pasan** sin necesidad de rebuild del frontend.

Notas:

- Si además molesta el aviso de polling del frontend, alinear `APP_VERSION` al
  token que corre la mayoría de los clientes.
- Para un rollback completo planificado, restaurar **las tres** variables al
  token anterior (registrar siempre el token previo antes de rotar) y volver a
  desplegar **frontend → backend**.
- Disparadores de rollback y registro go/no-go: `docs/release/release-go-no-go-policy.md`.

## Limitaciones / riesgos conocidos

El endpoint de variable individual y los deploy hooks están **confirmados**
(ver nota en *Secrets*). Riesgos que **se mantienen**:

- **No probado contra Render real.** El workflow todavía no se ejecutó contra los
  servicios productivos; la primera corrida debe vigilarse de cerca.
- **Secrets no creados.** No es ejecutable hasta cargar los 5 secrets en GitHub.
- **Posible deploy extra.** Al actualizar una env var, Render puede disparar un
  redeploy por su cuenta que se sume al del deploy hook. Render serializa los
  deploys por servicio (es seguro), pero puede generar un build adicional.
- **Smoke con timing heurístico.** Tras los deploys espera 45s y luego hace
  polling (20 intentos × 15s ≈ 5 min). Un cold start muy lento puede exceder esa
  ventana y marcar el smoke en rojo aunque el deploy termine después: re-correr
  el workflow (ampliar el polling queda para más adelante).
- **El deploy hook despliega el estado de la rama conectada**, no necesariamente
  un SHA arbitrario: asegurar el estado de la rama antes de correr el workflow.

## Cómo ejecutarlo

GitHub → **Actions** → *App Version Force Update* → **Run workflow**:

1. `contract_token`: el token exacto (p. ej. el SHA largo del release).
2. `confirm_force_update`: escribir exactamente `FORCE_UPDATE_VETNEB`.
3. `run_smoke`: dejar en `true` salvo que se valide a mano.

Revisar el **Job summary** al finalizar (tabla con token, checks y resultados).
