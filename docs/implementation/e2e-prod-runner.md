# E2E-PROD-RUNNER — Playwright contra build productivo en CI

## Estado

- Base: `2499578fd2e971f63ddc3abfd7b27096ee6f115a`.
- Rama: `test/e2e-prod-runner`.
- Tipo: infraestructura E2E / Frontend CI + 3 causas raíz en frontend runtime.
- Autorización: R2 explícita para workflow y configuración productiva de CI,
  ampliada por Nico a 5 archivos adicionales (`frontend/src/lib/api.ts`,
  `frontend/e2e/fixtures/admin-populated-api-server.mjs`,
  `frontend/src/components/layout/Footer.tsx`,
  `test/unit/ui/frontend/frontend-api-client-request.test.ts`,
  `test/unit/ui/frontend/frontend-native-link-preview-contract.test.ts`)
  tras diagnóstico demostrado con requests/responses reales.

## Problema

Frontend CI generaba un bundle mediante `next build`, pero Playwright levantaba
`next dev` para ejecutar la cohorte `e2e:ci`. El gate de navegador no validaba
el mismo artefacto que había sido compilado y auditado previamente.

Además, `NEXT_PUBLIC_API_URL` es una variable pública de build-time. Inyectarla
únicamente al proceso `next dev` no garantiza que el bundle productivo apunte al
fixture HTTP administrado por Playwright.

## Historial de la corrida

1. **RED inicial de infraestructura** (implementación focal previa a este
   documento): la suite de contratos de `next start`/CI/workflow no existía
   o no reflejaba el diseño; una vez escrita, `64/64` quedó en `PASSED` antes
   de correr la cohorte real contra un servidor productivo.
2. **Corrida productiva inicial** (`CI=true NEXT_PUBLIC_API_URL=... pnpm --dir
   frontend e2e:ci`, solo con los 7 archivos originales): `530 passed`,
   `38 failed` — **`FAILED`**. Las 38 fallas se agrupaban en 4 familias
   (admin sin datos poblados, clínica sin listas pobladas, 404 en consola,
   páginas públicas sin `networkidle`).
3. **Diagnóstico** (sin tocar código): reproducido con build productivo real,
   fixture real y las 4 familias, más un control A/B `next dev` vs `next
   start` con specs y mocks idénticos. Causas raíz demostradas — ver abajo.
4. **Ampliación autorizada** a 12 archivos y corrección.
5. **Corrida productiva final** (mismos 4 comandos, con los 12 archivos):
   `568 passed`, `0 failed` — **`PASSED`**, exit code `0`.

## Causas raíz demostradas

### Causa A — guard de seguridad de producción bloqueaba el fixture local

`frontend/src/lib/api.ts` → `resolveApiBaseUrlForRuntime()` lanza
`PUBLIC_API_CONFIGURATION_ERROR_MESSAGE` cuando el runtime NO es desarrollo y
la URL configurada apunta a un host local/LAN. Verificado de forma aislada:
con `NODE_ENV=production` + `NEXT_PUBLIC_API_URL=http://127.0.0.1:3107` la
función lanza esa excepción. `next build`/`next start` fuerzan
`NODE_ENV=production` (a diferencia de `next dev`), así que **todo** fetch
SSR (`getAuditEntries`, `getAdminSystemHealth`, `getReports`,
`getLogisticsFieldVisits`, `getRoutePlans`, etc.) fallaba de inmediato,
degradando a datos vacíos. Confirmado en stdout real del `webServer`:
`[API] getAuditEntries: endpoint no disponible` repetido cientos de veces.
Explica las familias 1 (Admin: "47", "Login admin", "Admin #41" ausentes) y 2
(Clínica: listas de Logística/Informes vacías).

### Causa B — `/api/app-version` no existía en el fixture

`AppVersionGate.tsx` solo ejecuta su chequeo de versión cuando
`process.env.NODE_ENV === "production"` — inerte bajo `next dev` (compila en
vivo con `development`), siempre activo en el bundle de `next build`/`next
start` (donde `NODE_ENV=production` queda horneado). El endpoint
`/api/app-version` no existía ni como ruta Next.js ni en el fixture E2E.
Confirmado con instrumentación real: `GET /api/app-version?t=...` → `404`,
generando `Failed to load resource: 404` en consola. Explica parte de las
familias 1 y 3 (404 en App Shell de tokens/reportes/usuarios).

### Causa C — iframe de Google Maps en vivo en el Footer

`Footer.tsx` embebe un `<iframe src="https://www.google.com/maps?...">`
incondicional. Confirmado con control A/B idéntico (mismos specs, mismos
mocks, mismo fixture, solo cambia `next dev` ↔ `next start`): `next dev`
9/9 passed (6.5s); `next start` 9/9 failed por timeout de
`waitForLoadState("networkidle")`, con una cascada real de requests a
`maps.googleapis.com`/`maps.gstatic.com` que nunca deja la red en idle.
Explica la familia 4 (páginas públicas sin `networkidle`).

### Por qué solo aparece con `next start`

`next build`/`next start` fuerzan `NODE_ENV=production`, horneado en ambos
bundles (cliente y servidor); `next dev` siempre usa `development` y
recompila en vivo. Las tres causas dependen exactamente de esa variable. No
es un problema de proxy/rewrite (`/api/:path*` → fixture funciona
correctamente en ambos modos, verificado con curl directo).

## Diseño implementado

### Environment / orquestación (estrategia preferida, sin alcanzar)

Ninguna de las 3 causas era corregible solo con env/config: `next start`
fuerza `NODE_ENV=production` sin importar qué le pase el proceso padre, así
que no existe un lever de configuración que evite el guard sin tocar la
función. Se agotó esa vía antes de pedir ampliación de scope.

### Excepción fail-closed en `frontend/src/lib/api.ts`

`resolveApiBaseUrlForRuntime()` gana una excepción evaluada **antes** del
guard original (que permanece byte-a-byte intacto como fallback):
las 4 condiciones deben cumplirse simultáneamente —
`process.env.NODE_ENV === "production"`, `process.env.CI === "true"`,
`process.env.VETNEB_E2E_ALLOW_LOCAL_API === "1"` y
`origin === "http://127.0.0.1:3107"` (constante `E2E_FIXTURE_API_ORIGIN`,
sin bracket-access ni indirección). Localhost, otro puerto, o cualquier IP
LAN siguen rechazados. Verificado con matriz de 8 combinaciones ejecutada
contra la función real (no solo asserts de texto).

### Ruta pública `/api/app-version` en el fixture

`frontend/e2e/fixtures/admin-populated-api-server.mjs` agrega `GET
/api/app-version`, pública (antes del guard `hasPopulatedAdminSession`),
respondiendo `{ success: true, appVersion, clientMinVersion,
forceUpdate: false, displayVersion }` con los mismos headers de
no-cache que el endpoint productivo real
(`server/routes/app-version.fastify.ts`, no tocado). `forceUpdate: false`
es exclusivo del fixture E2E — el default productivo real sigue en `true`.

### Hermeticidad del iframe de Maps en `Footer.tsx`

Doble llave server-only (`process.env.CI === "true" &&
process.env.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS === "1"`) controla el valor
de `mapsEmbedUrl`, sombreado localmente dentro de `Footer()` a partir de una
constante de módulo renombrada (`PUBLIC_MAPS_EMBED_SRC`). El `<iframe>` sigue
siendo un único elemento incondicional en el árbol — solo cambia el `src`
(omitido cuando está deshabilitado, red-free) y un atributo marcador
`data-e2e-external-embed-disabled`. Se descartó explícitamente alternar entre
`<div>`/`<iframe>` (o dos bloques JSX con distinto elemento): un
Client Component ajeno (`ContactoContent.tsx`, fuera de scope) importa
`PublicLayout`→`Footer` sin frontera "use client", así que el módulo de
Footer se re-ejecuta también en el bundle cliente, donde
`process.env.CI`/`VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS` no están inlineados
(no son `NEXT_PUBLIC_*`) y valen `undefined`. Alternar el TIPO de elemento
entre servidor y esa re-ejecución cliente es un hydration mismatch duro
(React error #418, confirmado reproduciendo `/contacto`); alternar solo un
atributo (`src`) del mismo `<iframe>` no lo es.

### Propagación (`playwright.config.ts` / workflow)

`VETNEB_E2E_ALLOW_LOCAL_API=1` y `VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS=1` se
agregan al `env` del `webServer` de aplicación solo cuando `isCi` (nunca en
local dev), y al step `Build frontend` de
`.github/workflows/frontend-ci.yml` (ambas variables son leídas también en
build-time por páginas estáticas). Comandos, orden de gates y
`reuseExistingServer=false` en CI quedan sin cambios.

## Seguridad del workflow

Diferencia contra `main` revisada de forma exacta: 3 líneas de `env` nuevas
en el step `Build frontend`, nada más. El validador parser-backed de
workflow-security permaneció en `QGA-4.2` y aceptó el workflow modificado.

Digest SHA-256 canónico revisado de `.github/workflows/frontend-ci.yml`
(recalculado con normalización CRLF→LF, verificado independientemente del
test):

`a7c59daab8a9b07627e7b0e22e610fbcc570fa0f68332d3f1378e800046558c7`

## Scope

Incluido (12 archivos):

- `.github/workflows/frontend-ci.yml`
- `docs/implementation/e2e-prod-runner.md`
- `frontend/playwright.config.ts`
- `test/unit/infrastructure/frontend-ci-workflow.test.ts`
- `test/unit/infrastructure/frontend-playwright-production-runner.test.ts`
- `test/unit/infrastructure/production-readiness.test.ts`
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`
- `frontend/src/lib/api.ts`
- `frontend/e2e/fixtures/admin-populated-api-server.mjs`
- `frontend/src/components/layout/Footer.tsx`
- `test/unit/ui/frontend/frontend-api-client-request.test.ts`
- `test/unit/ui/frontend/frontend-native-link-preview-contract.test.ts`

Excluido (no tocado): `AppVersionGate.tsx`, `app-version.ts`,
`next.config.ts`, `proxy.ts`, `package.json`, `pnpm-lock.yaml`,
`catalog.ts`, `run-cohort.mjs`, cualquier `*.spec.ts`, backend, API
productiva, auth, sesiones, DB, schema, migraciones, dependencias,
`AGENTS.md`, P1 de Informes, stash documental ajeno.

## Validación focal

- `pnpm typecheck:test`: `PASSED`.
- Suite focal (14 archivos, contratos de API guard/fixture/footer/config/
  workflow/readiness/workflow-security): `191/191 PASSED`.
- `pnpm test` (repo completo): `3139 passed, 1 skipped (preexistente),
  0 failed` — `PASSED`, exit 0.
- `pnpm --dir frontend lint`: `PASSED`, exit 0.
- `pnpm --dir frontend typecheck`: `PASSED`, exit 0.
- `pnpm validate:local`: `PASSED`, exit 0.
- Build productivo con `NEXT_PUBLIC_API_URL` + `VETNEB_E2E_ALLOW_LOCAL_API=1`
  + `VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS=1`: `PASSED`, exit 0.
- `pnpm security:public-surface`: `PASSED`, exit 0 (sin hallazgos nuevos).
- Workflow-security parser-backed + digest canónico: `PASSED`.

## Validación E2E representativa

4 specs de las familias originales + 2 specs preexistentes descubiertos
como afectados por la hermeticidad del footer
(`contacto-hydration.spec.ts`, `public-navigation-footer.spec.ts`):
`62/62 PASSED`, 0 requests a dominios de Google Maps, 0 console errors
`Failed to load resource ... 404`, 0 `pageerror`.

## Validación E2E completa

`CI=true NEXT_PUBLIC_API_URL=http://127.0.0.1:3107 pnpm --dir frontend
e2e:ci`: **`568 passed, 0 failed`**, exit code `0`.
`pnpm --dir frontend e2e:verify-teardown`: puertos 3000 y 3107 libres —
`PASSED`.

Nota de corrida intermedia: en una corrida completa previa a la corrección
final del footer (single-iframe con `src`/atributo condicionales en vez de
alternar tipo de elemento), apareció 1 falla rotativa preexistente y no
relacionada
(`admin-mobile-status-modules-no-scroll.spec.ts` — timeout esperando el hub
launcher bajo carga completa de 10 workers), documentada en memoria de
sesiones previas como flake conocido de ese spec bajo paralelismo completo
(no reproduce aislado, 3/3 passed). No se tocó ese spec ni se agregaron
retries; una recorrida completa sin cambios adicionales dio `568/568` limpio.

## Rollback

Revertir el lote como una unidad restaura:

- build de Frontend CI sin environment E2E (las 2 variables nuevas);
- `next dev` como servidor Playwright en todos los entornos (sin cambios,
  ya era así);
- el guard original de `resolveApiBaseUrlForRuntime` sin excepción (el
  guard nunca se modificó, solo se antepuso un early-return);
- el fixture sin `/api/app-version`;
- el Footer con el iframe de Maps siempre en vivo;
- digest canónico anterior y contratos asociados.

No hay impacto sobre datos persistidos, schema, sesiones, autenticación ni
dependencias. El default productivo real (`forceUpdate: true` en
`server/routes/app-version.fastify.ts`, el guard de host local/LAN, el
iframe de Maps) permanece exactamente igual salvo bajo la doble llave
`CI=true` + flag server-only correspondiente.

## CI remoto

`NOT_RUN` — pendiente de crear el PR y observar la corrida real en GitHub
Actions.
