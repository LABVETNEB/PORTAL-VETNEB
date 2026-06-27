# App version gate

> **Estado: ENFORCEMENT BACKEND IMPLEMENTADO.** Además del guard de frontend
> (que solo protege a clientes que ya ejecutan el bundle nuevo), el backend
> valida en cada request de auth relevante el header
> `X-VETNEB-Client-Version` y responde `426 CLIENT_VERSION_UNSUPPORTED`
> cuando falta o es una versión menor a la mínima aceptada
> (`CLIENT_MIN_VERSION`). Esto es lo que efectivamente bloquea a una
> PWA/app instalada vieja: aunque ese cliente nunca cargue el JS nuevo y
> nunca consulte `/api/app-version`, en el momento en que intenta
> `login`/`me` el backend lo rechaza.

## Por qué frontend-only no alcanza

Una PWA/app instalada vieja sigue ejecutando el bundle de frontend con el
que fue instalada. Ese bundle viejo no contiene el guard nuevo, así que
nunca va a consultar `/api/app-version` ni a bloquearse solo. El único
punto de contacto que un cliente viejo **siempre** atraviesa es la llamada
de red a backend (`login` o `me`). Por eso la validación real tiene que
vivir en backend, en esos endpoints.

## Contrato

Frontend (vía el cliente API centralizado `frontend/src/lib/api.ts`) envía
en **todas** las requests:

```
X-VETNEB-Client-Version: <NEXT_PUBLIC_APP_VERSION>
```

Backend valida ese header con un hook global (`onRequest`) instalado en
`server/fastify-app.ts`, antes del registro de rutas, igual que el guard de
origen confiable. El hook (`server/middlewares/version-gate.ts`)
solo actúa sobre estas rutas:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/admin/auth/login`
- `GET /api/admin/auth/me`
- `POST /api/particular/auth/login`
- `GET /api/particular/auth/me`

El resto de la superficie (incluyendo `/api/contact`, `/api/health`,
`/api/app-version`, logout, change-password, etc.) no se toca.

Si falta el header o la versión es menor a `CLIENT_MIN_VERSION`, responde:

```json
HTTP 426 Upgrade Required
{
  "success": false,
  "code": "CLIENT_VERSION_UNSUPPORTED",
  "message": "Tu aplicación está desactualizada. Actualizá o reinstalá VETNEB para continuar.",
  "minimumClientVersion": "...",
  "clientVersion": "..."
}
```

Si la versión es válida (igual o, cuando ambos lados son semver punteado
como `1.2.3`, superior a la mínima), el comportamiento existente del
endpoint se preserva sin cambios.

### Comparación de versiones

`APP_VERSION`/`CLIENT_MIN_VERSION` en Render pueden ser un commit SHA, no
necesariamente semver. Por eso la comparación:

1. Si `clientVersion === minimumClientVersion`, es válida (cubre el caso
   de versiones tipo SHA).
2. Si ambas son versiones punteadas numéricas (`"1.2.3"`), se comparan
   segmento a segmento y se acepta cualquier versión `>=` a la mínima.
3. En cualquier otro caso (formatos no comparables y distintos), se
   considera no soportada.

## Activación (importante para soporte y despliegue)

El enforcement queda **inactivo por defecto** (modo seguro) hasta que se
configure explícitamente `CLIENT_MIN_VERSION` en el entorno de backend.
Esto es intencional: hoy nada fija `NEXT_PUBLIC_APP_VERSION` en el build de
frontend, así que activar el bloqueo sin coordinar el build rompería el
login de todos los clientes actuales. Antes de armar el gate en
producción:

1. Configurar `NEXT_PUBLIC_APP_VERSION` en el build de frontend (Render) con
   el valor de versión/commit a exigir.
2. Configurar `APP_VERSION` y `CLIENT_MIN_VERSION` en el backend (Render)
   con el mismo valor.
3. Desplegar backend y frontend juntos.
4. Verificar `pnpm test` (incluye `test/client-version-gate-contract.test.ts`)
   antes y después del despliegue.

Mientras `CLIENT_MIN_VERSION` no esté seteado, todas las rutas funcionan
exactamente igual que antes de este cambio.

## Guard de frontend (UX, no sustituye al backend)

El frontend sigue exponiendo dos bloqueos visuales, montados globalmente
desde `RootLayout` vía `AppVersionGate`:

- **Polling propio** (`/api/app-version`, cada 60s en producción): mejora
  la UX para sesiones ya abiertas con el bundle nuevo.
- **Reactivo a `CLIENT_VERSION_UNSUPPORTED`**: cuando cualquier llamada del
  cliente API centralizado recibe el `426` de backend (por ejemplo, al
  intentar login o refrescar `me`), se publica una señal global
  (`frontend/src/lib/client-version-error.ts`) y `AppVersionGate` muestra
  un bloqueo con el título **"Actualización requerida"** y el mensaje
  **"Estás usando una versión anterior de VETNEB. Para proteger tu sesión
  y evitar errores, actualizá o reinstalá la app."**, con la acción
  **"Actualizar ahora"**. No se permite continuar login/dashboard mientras
  esta señal esté activa.

## Versión técnica vs. versión comercial (UI)

`appVersion` y `clientMinVersion` son **técnicos**: en Render suelen ser un
commit SHA (`RENDER_GIT_COMMIT`) y existen solo para que backend/frontend
comparen igualdad exacta o tests/diagnóstico los citen. **Nunca** deben
renderizarse tal cual en pantalla, y tampoco el sentinel interno
`CLIENT_APP_VERSION_FALLBACK` (`"missing-client-version"`) que usa el
frontend cuando `NEXT_PUBLIC_APP_VERSION` no está configurado en el build.

Para usuario final existe una versión **comercial** separada,
`displayVersion`/`toSafeDisplayVersion`:

- Backend (`server/routes/app-version.fastify.ts`) calcula
  `displayVersion` a partir de `process.env.npm_package_version` (el mismo
  mecanismo que ya usa `admin-system-health.fastify.ts` para el chequeo de
  salud), formateado como `Portal VETNEB v<version>` — hoy
  `Portal VETNEB v2.1.0` porque la raíz del repo está en `2.1.0`. Si el
  `major` de `package.json` pasa a `3.x`, este mismo código produce
  `Portal VETNEB v3.x.x` automáticamente, sin tocar el formateo.
- Frontend (`frontend/src/lib/app-version.ts`) expone
  `toSafeDisplayVersion(raw)`, que normaliza cualquier valor técnico a una
  etiqueta segura:
  - sentinel `missing-client-version`, vacío o no reconocible → `"anterior
    / no detectada"`;
  - SHA de commit (hex largo) → `"anterior / no detectada"` (nunca se
    imprime el hash);
  - semver puntuado (`"2.1.0"`) → `"Portal VETNEB v2.1.0"`;
  - valor ya formateado (`"Portal VETNEB v…"`) → se devuelve sin cambios.
- `AppVersionGate.tsx` usa `toSafeDisplayVersion` tanto para la "Versión
  instalada" (cliente, `CLIENT_APP_VERSION`) como para la "Versión
  vigente" (backend, `displayVersion ?? appVersion`). Ningún componente de
  UI debe interpolar `CLIENT_APP_VERSION` o `snapshot.appVersion` crudos.

## Recuperación al tocar "Actualizar ahora"

Antes, el botón solo llamaba `registration.update()` + `reload()`. Si el
service worker viejo seguía controlando la pestaña, el reload podía volver
a servir el mismo shell desactualizado y el cartel reaparecía sin
resolver nada. Ahora `handleUpdateNow` en `AppVersionGate.tsx` hace, en
orden:

1. `unregisterServiceWorkers()`: desregistra (no solo actualiza) todos los
   `ServiceWorkerRegistration` de este origen.
2. `clearPortalCaches()`: borra únicamente las Cache Storage con prefijo
   `portal-vetneb-` (las que usa `frontend/public/sw.js`).
3. `clearAppVersionLocalState()`: borra únicamente claves de
   `localStorage` con prefijo `vetneb:app-version:`, si existieran. Nunca
   toca otras claves (tema, último módulo de dashboard, etc.).
4. `navigateToFreshAppShell()`: navega con `window.location.replace(...)`
   a `"/"` con un parámetro `?vetnebUpdate=<timestamp>` como cache-buster,
   sin dejar la pantalla de bloqueo en el historial.

Si el aviso persiste después de esto, la UI muestra una nota secundaria
fija (no es un link, es texto plano: el frontend no usa `<a>`/`next/link`)
indicando cerrar la app, eliminar el acceso directo instalado y abrir
`https://vetneb.com.ar` desde el navegador.

## Exclusiones explícitas de este cambio

- Sin cambios de base de datos ni migraciones.
- Sin dependencias nuevas ni cambios de lockfile.
- Sin cambios de CI.
- Sin ampliar `CORS_ORIGIN` ni el contrato de origen confiable.
- Sin reescribir auth/sesión: el hook corre antes de los handlers de
  login/me y no toca cookies, tokens ni lógica de autenticación.

## Checklist de soporte (cliente reporta error de versión o sesión rota)

1. Cerrar completamente la app/PWA.
2. Abrir `https://vetneb.com.ar` desde el navegador.
3. Si el problema persiste, borrar caché del sitio/navegador.
4. Desinstalar y reinstalar la PWA.
5. Volver a validar el login.

## Checklist de soporte móvil (cartel "Actualización requerida")

1. Tocar **"Actualizar ahora"** (desregistra el service worker, limpia
   cachés/claves locales propias y navega con cache-buster).
2. Si el cartel vuelve a aparecer, cerrar la app por completo.
3. Borrar el acceso directo/PWA instalado en el dispositivo.
4. Abrir `https://vetneb.com.ar` desde el navegador (no desde el acceso
   directo viejo).
5. Reinstalar el acceso directo/PWA si corresponde.
