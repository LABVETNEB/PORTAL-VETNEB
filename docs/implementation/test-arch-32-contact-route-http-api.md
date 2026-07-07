# TEST-ARCH-32 - Contact route HTTP/API

## Resumen ejecutivo

TEST-ARCH-32 mueve manualmente el test HTTP/API de la ruta publica de contacto identificado por TEST-ARCH-24.

Archivo movido:

- `test/contact-route.test.ts`

Destino:

- `test/integration/adapters/controllers/contact-route.test.ts`

El test cubre:

- validacion de payload publico de contacto
- envio exitoso de mensaje
- preflight CORS permitido
- SMTP disabled aceptado
- error SMTP controlado con diagnosticos seguros
- rechazo de origins no confiables
- rate-limit del endpoint de contacto
- resolucion de cliente con trusted proxy
- aislamiento del rate-limit al plugin de contacto

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama base | `main` |
| HEAD base esperado | `786b445 test(architecture): move performance load smoke (#1339)` |
| Rama de trabajo | `test/contact-route-http-api-move` |
| Working tree inicial | Limpio |
| PRs abiertos esperados | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Fuente de verdad

- `docs/implementation/test-arch-24-non-fastify-http-api-test-inventory.md`
- `docs/implementation/test-arch-31-performance-load-smoke.md`

## Archivo movido

| Origen | Destino |
|---|---|
| `test/contact-route.test.ts` | `test/integration/adapters/controllers/contact-route.test.ts` |

## Imports ajustados

Se ajustaron imports relativos mecanicos por nueva profundidad:

- `../server/lib/rate-limit-store.ts` -> `../../../../server/lib/rate-limit-store.ts`
- `../server/routes/contact.fastify.ts` -> `../../../../server/routes/contact.fastify.ts`

## Anchors activos

No se esperan anchors activos en `test/**` o `scripts/**` para el path antiguo del archivo.
Las referencias documentales historicas se mantienen.

## Scope confirmado

No se modifico:

- runtime/producto
- backend productivo
- DB/schema/migrations
- CI
- dependencias
- `package.json`
- `pnpm-lock.yaml`

No se uso Codex ni Claude.

## Validaciones

Completadas antes de commit:

| Comando | Resultado |
|---|---|
| `git diff --check` | OK, sin salida. |
| `git diff --stat` | OK. |
| `git diff --name-only` | OK, limitado a contact-route HTTP/API y reporte. |
| `git status --short --untracked-files=all` | OK, solo cambios esperados antes de stage. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' typecheck:test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Recomendacion para siguiente lote

Mantener diferidos:

- `test/fastify-app.test.ts`
- security-sensitive groups con anchors activos hasta lote propio