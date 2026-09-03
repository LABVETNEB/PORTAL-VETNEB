# Remediación de advisories de fast-uri y trustProxy en PR #1683 (Fastify 5.12.1)

Este documento cubre dos fixes secuenciales sobre la misma rama de #1683:

- **Fix A (2026-09-02)**: advisories de `fast-uri` (§§ "Causa raíz" a
  "Hallazgo fuera de scope").
- **Fix B (2026-09-03)**: incompatibilidad `trustProxy` con Fastify 5.12.1,
  que resuelve el hallazgo fuera de scope dejado por el Fix A (§
  "Fix B — trustProxy").

## Estado base

- Fecha: 2026-09-02 (Fix A) / 2026-09-03 (Fix B).
- Repositorio: `LABVETNEB/PORTAL-VETNEB` (`C:\PORTAL-VETNEB`).
- Base `main` exacta: `5e182d92cdbf2705679e4301fd336becae4cf0b9`.
- PR: [#1683](https://github.com/LABVETNEB/PORTAL-VETNEB/pull/1683).
- Rama: `dependabot/npm_and_yarn/fastify-5.12.1`.
- HEAD inicial de #1683 verificado: `f685e46293f67f89377658a23e350f88716cb3b3`
  (0 commits detrás de `main`; `merge-base` == `origin/main`).
- El árbol y los stashes preexistentes (5) se preservaron intactos durante
  toda la implementación de ambos fixes.

## Scope incluido

- Actualización del override de `fast-uri` 3.x a la versión parcheada
  `3.1.6`.
- Actualización del override de `fast-uri` 4.x a la versión parcheada
  `4.1.3`.
- Regeneración controlada de `pnpm-lock.yaml` (`pnpm install --lockfile-only`).
- Realineación del contrato exacto de overrides de seguridad en
  `test/architecture/toolchain-contract.test.ts`.

## Scope excluido

- `package.json`: el bump de Fastify `^5.10.0` → `^5.12.1` ya viene del
  commit Dependabot original de #1683 y no se modificó de nuevo.
- Runtime frontend y backend.
- Cualquier dependencia no relacionada con los advisories de `fast-uri`.
- Workflows, schema, migraciones, autenticación y configuración productiva.
- Corrección del error de `typecheck` preexistente en
  `server/fastify-app.ts` (ver "Hallazgo fuera de scope" abajo).
- E2E (Playwright): deliberadamente fuera de este pedido por instrucción
  explícita de Nico.
- Deploy y merge.

## Causa raíz

Backend CI fallaba en `Dependency security audit` porque, pese al bump de
Fastify a `5.12.1`, las resoluciones efectivas de `fast-uri` en
`pnpm-workspace.yaml` y `pnpm-lock.yaml` seguían ancladas a versiones por
debajo del mínimo parcheado exigido por los advisories vigentes:

- `fast-uri` 3.x: parcheado en `>= 3.1.6` (el override apuntaba a `3.1.5`).
- `fast-uri` 4.x: parcheado en `>= 4.1.3` (el override apuntaba a `4.1.2`).

## Advisories observados

- `GHSA-5jgf-p345-68v8`
- `GHSA-f65p-4m7j-42xc`
- `GHSA-fph4-wmhf-6fwf`
- `GHSA-jqff-g426-hqxp`

## Cambios

- Fastify `5.12.1` — ya presente en el commit Dependabot original de #1683;
  no se tocó en este trabajo.

- `pnpm-workspace.yaml`:
  - `"fast-uri@<3.1.5": "3.1.5"` → `"fast-uri@<3.1.6": "3.1.6"`.
  - `"fast-uri@>=4.0.0 <4.1.2": "4.1.2"` → `"fast-uri@>=4.0.0 <4.1.3": "4.1.3"`.
  - Ningún otro override modificado.

- `pnpm-lock.yaml` (regenerado con `pnpm install --lockfile-only`):
  - `fast-uri@3.1.5` fue reemplazado por `fast-uri@3.1.6`.
  - `fast-uri@4.1.2` fue reemplazado por `fast-uri@4.1.3`.
  - Sin cambios en ninguna otra dependencia del grafo; el diff del lockfile
    quedó acotado a las dos entradas de `overrides`, las dos entradas de
    `packages` y las cuatro referencias de `snapshots` correspondientes a
    `fast-uri`.

- `test/architecture/toolchain-contract.test.ts`:
  - Se actualizaron únicamente las dos entradas literales de
    `SECURITY_OVERRIDE_LINES` correspondientes a `fast-uri`.
  - El guard conserva su estructura y sus assertions estrictas; no se
    debilitó ni se saltó ningún test.

## Archivos de implementación

Fix A (`fast-uri`):

- `pnpm-workspace.yaml`.
- `pnpm-lock.yaml`.
- `test/architecture/toolchain-contract.test.ts`.
- `docs/implementation/pr-1683-fastify-fast-uri-security-remediation.md`.

Fix B (`trustProxy`), añadidos sobre el mismo HEAD:

- `server/lib/env.ts`.
- `.env.example`.
- `test/architecture/security/security-critical-route-surface-registry.test.ts`.
- `test/architecture/security/security-production-invariants.test.ts`.
- `test/security/security-trusted-origin-cors-boundaries.test.ts`.
- `test/unit/infrastructure/production-env-contracts.test.ts`.
- `test/unit/infrastructure/public-staging-config-contract.test.ts`.
- `test/architecture/backend-modularization-m48-final-certification.test.ts`
  (realineación de censo LOC, consecuencia legítima del crecimiento de
  `server/lib/env.ts`).
- `docs/implementation/m48-backend-modularization-final-certification.md`
  (misma realineación de censo LOC).

Verificado con `git diff f685e46293f67f89377658a23e350f88716cb3b3 --name-only`:
exactamente estos 12 paths respecto del HEAD inicial de #1683 (4 del Fix A +
8 del Fix B). `package.json` no aparece como cambio nuevo de este trabajo
(pertenece al commit Dependabot previo). `server/fastify-app.ts` tampoco
aparece: no fue tocado por ninguno de los dos fixes.

## Regeneración del lockfile

- Comando: `pnpm install --lockfile-only`.
- Resultado: `✓ Lockfile passes supply-chain policies (611 entries in 16.8s)`.
- Verificación posterior: `pnpm install --frozen-lockfile` con `CI=true`
  (requerido porque la shell no tiene TTY para confirmar la purga de
  `node_modules`) — `PASSED`, exit code 0, tras eliminar un `node_modules`
  local corrupto (junctions de Windows rotas de una instalación interrumpida
  previa, artefacto no versionado y ajeno al scope de este cambio).

## Realineación del guard

`test/architecture/toolchain-contract.test.ts` — `SECURITY_OVERRIDE_LINES`
realineado a los dos literales nuevos de `fast-uri`; el resto del contrato
(estructura, demás overrides, assertions) permanece sin cambios.

## Validaciones (estados canónicos)

1. Test dirigido `test/architecture/toolchain-contract.test.ts` — `PASSED`;
   8/8.
2. `pnpm audit --prod` — `PASSED`; "No known vulnerabilities found", exit
   code 0.
3. `pnpm audit` — `PASSED`; "No known vulnerabilities found", exit code 0.
4. `pnpm why fast-uri` — confirmado: única resolución activa es
   `fast-uri@3.1.6` (vía `ajv@8.20.0`) y `fast-uri@4.1.3` (vía
   `@fastify/ajv-compiler@4.0.6` y `fast-json-stringify@7.0.1`, ambos
   dependientes de `fastify@5.12.1`). No quedan referencias activas a
   `3.1.5` ni `4.1.2`.
5. `pnpm lint:backend` — `PASSED`; exit code 0; 45 warnings preexistentes,
   ninguno en archivos de este scope.
6. `pnpm validate:local` — `FAILED` en la etapa `typecheck` (`tsc --noEmit`)
   al momento del Fix A. `typecheck:test`, `test` y `build` quedaron
   `NOT_RUN` por corte de la cadena `&&`. Ver "Hallazgo fuera de scope"
   abajo: la causa no estaba en ninguno de los 4 archivos del Fix A.
   **Resuelto por el Fix B** (ver más abajo): `pnpm validate:local` ahora
   `PASSED`.

## Hallazgo fuera de scope del Fix A (resuelto por el Fix B)

`pnpm validate:local` fallaba en `tsc --noEmit` con múltiples errores en
`server/fastify-app.ts` (líneas 392–703) por incompatibilidad de tipos entre
`FastifyInstance`/`FastifyRequest` genéricos sobre HTTP/1 y el tipo HTTP/2
seguro (`Http2SecureServer`, `Http2ServerRequest`) que exponen los tipos de
Fastify `5.12.1`.

- `git diff f685e46293f67f89377658a23e350f88716cb3b3 -- server/fastify-app.ts`
  devolvía vacío: este archivo no fue tocado por el Fix A.
- El error era preexistente en el HEAD de #1683 tal como llegó del commit
  Dependabot (bump `fastify` `^5.10.0` → `^5.12.1`), no una consecuencia del
  fix de `fast-uri`: `fast-uri` no participa en la tipificación HTTP/2 de
  Fastify.
- Corregirlo requería tocar código fuera del guard de scope del Fix A
  (limitado a los 4 archivos de fast-uri) y de su autorización explícita
  ("Trabajar UN ERROR A LA VEZ"). Se reportó a Nico como bloqueante remanente
  y se resolvió en un pedido separado: el Fix B documentado a continuación.

## Fix B — trustProxy incompatible con Fastify 5.12.1

### Causa raíz demostrada

Fastify `5.12.1` deshabilitó por seguridad el modelo `trustProxy: number`
(hop-count): un hop-count no puede validar el peer inmediato, así que un
cliente directo podía falsificar `X-Forwarded-*` agregando hops suficientes.
El tipo público pasó a ser `boolean | string | string[] | TrustProxyFunction`
(`node_modules/fastify/fastify.d.ts:152`) — ya sin `number`.

El código vigente en `server/lib/env.ts` seguía produciendo un `number`:

```
TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
...
trustProxy: rawEnv.TRUST_PROXY ?? 1,
```

y `server/fastify-app.ts:392` lo pasaba directo a `Fastify({ trustProxy:
ENV.trustProxy })`.

**Nota de runtime (no sólo de tipos)**: incluso antes de este fix, en
runtime Fastify 5.12.1 ya trataba `trustProxy: 1` como fail-closed —
`node_modules/fastify/lib/request.js`, función `getTrustProxyFn`, retorna
una función que siempre da `false` cuando `typeof tp === "number"`. Es decir,
la config previa ya no otorgaba ninguna confianza real a los forwarded
headers; sólo fallaba en tiempo de compilación. El fix formaliza ese
comportamiento fail-closed en el contrato, no lo introduce.

### Por qué aparecían los 16 errores HTTP2

`Fastify({ ..., trustProxy: ENV.trustProxy })` con `ENV.trustProxy: number`
no matcheaba ningún overload de la firma HTTP/1 de `Fastify()`. TypeScript
recurría al overload genérico compatible con HTTP/2 seguro
(`Http2SecureServer`/`Http2ServerRequest`), y `app` quedaba tipado como
`FastifyInstance<Http2SecureServer<...>>` en cascada para el resto del
archivo (hooks, handlers, `setErrorHandler`, retorno de la función). Hipótesis
confirmada empíricamente: tras corregir sólo el tipo de `ENV.trustProxy`,
`pnpm typecheck` pasó a `PASSED` sin tocar una sola línea de
`server/fastify-app.ts` — los 16 errores desaparecieron completos (TS2769 de
la línea 392, los `Http2SecureServer`/`Http2ServerRequest` intermedios y el
error final de retorno de `FastifyInstance`).

### Contrato TRUST_PROXY anterior

```
TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional()
trustProxy: rawEnv.TRUST_PROXY ?? 1
```

Hop-count numérico 0–10; default `1` (un hop, semántica Render de un único
reverse proxy). Ya no es un tipo válido para Fastify 5.12.1 y, como se
documentó arriba, ya no otorgaba confianza real en runtime tampoco.

### Contrato TRUST_PROXY nuevo

`server/lib/env.ts` — validador puro exportado + schema + valor computado:

```
export function isValidTrustProxyConfig(value: string): boolean { ... }

TRUST_PROXY: z.preprocess(
  emptyToUndefined,
  z.string().min(1).refine(isValidTrustProxyConfig, { message: ... }).optional(),
),
...
trustProxy: rawEnv.TRUST_PROXY ?? false,
```

`isValidTrustProxyConfig` acepta una lista de IP/CIDR (IPv4 o IPv6)
separada por coma, validada con `node:net#isIP` (mismo módulo que ya usa
`server/lib/contact-rate-limit.ts`); cada entrada se valida individualmente,
con o sin sufijo `/prefix`. Fastify soporta nativamente listas separadas por
coma en un `trustProxy` de tipo `string`
(`node_modules/fastify/lib/request.js`, `getTrustProxyFn`), por lo que el
string validado se pasa tal cual, sin construir un array intermedio.

No se usó `as any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, ni se
tipó `app`/`FastifyInstance` manualmente para HTTP2. `server/fastify-app.ts`
no se modificó.

### Comportamiento de configuración ausente

`rawEnv.TRUST_PROXY ?? false` — sin `TRUST_PROXY` configurada, el backend no
confía en ningún proxy: `ip`/`ips`/`host`/`protocol` se derivan del socket
directo, no de `X-Forwarded-*` (mismo default de fábrica de Fastify,
`trustProxy: false`). Es el único default seguro sin conocer los IP/CIDR
reales del proxy de Render; no se asumió ningún rango RFC1918 ni se usó
`trustProxy: true` como atajo.

**Precondición operativa para producción**: Render debe configurar
`TRUST_PROXY` con el/los IP o CIDR reales de su proxy tras este merge, o el
backend seguirá derivando `ip`/`host`/`protocol` del socket directo (que en
Render, detrás de un proxy, no es el cliente real). No se inventó ni se
consultó esa infraestructura real en este trabajo.

### Tratamiento de valores legacy numéricos

`"1"`, `"0"`, etc. no son un `net.isIP` válido → el `refine` los rechaza
explícitamente en el schema (fail-fast en el startup, mensaje explícito),
igual que `"true"`/`"false"`. No se reinterpreta `"1"` como confianza
equivalente a un hop; un valor numérico legacy simplemente no parsea.

### Archivos modificados por el Fix B

- `server/lib/env.ts` — import de `isIP` (`node:net`), helper
  `isValidTrustProxyEntry`, validador exportado `isValidTrustProxyConfig`,
  schema `TRUST_PROXY` (string + refine) y `trustProxy: rawEnv.TRUST_PROXY ??
  false`.
- `.env.example` — `TRUST_PROXY=1` → `TRUST_PROXY=<RENDER_PROXY_IP_OR_CIDR>`
  (placeholder, mismo patrón que `SMTP_PASS=<RESEND_API_KEY>` y
  `APP_VERSION=<version-token>`), comentario explicando el nuevo contrato y
  el default fail-closed; ejemplo de desarrollo local `# TRUST_PROXY=0` →
  `# TRUST_PROXY=127.0.0.1`.
- Guards/tests realineados a los literales nuevos (ver abajo).
- `test/architecture/backend-modularization-m48-final-certification.test.ts`
  y `docs/implementation/m48-backend-modularization-final-certification.md`
  — el censo LOC congelado de `server/lib` creció de 5.063 a 5.097 líneas
  (+34, exactamente el diff neto de `server/lib/env.ts`) y el total de
  `server` de 46.046 a 46.080; realineado en ambos lugares, sin debilitar el
  guard (mismo criterio que exige AGENTS.md §4 para censos rotos
  legítimamente por un cambio in-scope).

### Guards/tests realineados

- `test/architecture/security/security-critical-route-surface-registry.test.ts` —
  marcador `"trustProxy: rawEnv.TRUST_PROXY ?? 1"` → `"... ?? false"`.
- `test/architecture/security/security-production-invariants.test.ts` —
  mismo marcador de valor, y el marcador del schema anterior reemplazado por
  `"export function isValidTrustProxyConfig(value: string): boolean {"`.
- `test/security/security-trusted-origin-cors-boundaries.test.ts` — mismos
  dos marcadores (duplicado del guard anterior).
- `test/unit/infrastructure/production-env-contracts.test.ts` — línea activa
  esperada de `.env.example` actualizada al nuevo placeholder; el schema
  `z.coerce.number()` duplicado inline se reemplazó por una copia del nuevo
  validador IP/CIDR (mismo patrón "se prueba inline para evitar efectos
  secundarios del módulo"), con casos nuevos: `"1"` y `"true"` inválidos, IP
  válido, CIDR válido, lista separada por coma válida, valor inválido,
  ausente → `undefined` (fail-closed).
- `test/unit/infrastructure/public-staging-config-contract.test.ts` — mismo
  placeholder en el marcador de línea activa de `.env.example`.
- Ningún test se debilitó, se saltó ni perdió assertions; los guards siguen
  protegiendo tipo, parsing, default fail-closed, rechazo de valores
  inseguros y el contrato productivo esperado.

### Validaciones finales (estados canónicos)

1. Tests dirigidos afectados por `TRUST_PROXY`/`trustProxy` (65 tests en 8
   archivos: los 6 guards/tests listados arriba, más
   `security-boundary-suite-completeness.test.ts` y
   `production-readiness.test.ts` como verificación de no regresión, más
   `env.test.ts`) — `PASSED`; 65/65.
2. `pnpm audit --prod` — `PASSED`; sin vulnerabilidades.
3. `pnpm audit` — `PASSED`; sin vulnerabilidades.
4. `pnpm validate:local` (única corrida, cadena completa
   `typecheck && typecheck:test && test && build`) — **`PASSED`**, exit code
   0. `tests 4490`, `pass 4489`, `fail 0`, `skipped 1` (omitido preexistente,
   no relacionado con este trabajo), `build` completó
   (`dist/index.js`, 918.1kb).

## Rollback

Revertir los commits de este trabajo (Fix A + Fix B) restaura overrides,
guards, lockfile, `server/lib/env.ts`, `.env.example` y el censo M48 al
estado del HEAD `f685e46293f67f89377658a23e350f88716cb3b3`. No requiere
migración de schema, datos, credenciales, infraestructura ni configuración
productiva. Revertir sólo el Fix B (dejando el Fix A) es igualmente seguro:
ambos son independientes en el árbol de archivos.

## Riesgo residual

- Producción (Render) debe configurar `TRUST_PROXY` con el/los IP o CIDR
  reales de su proxy tras el merge; hasta entonces, el backend opera con
  `trustProxy: false` (fail-closed, no confía en ningún proxy) — más
  restrictivo que el comportamiento previo pretendido, pero no menos seguro
  que el comportamiento real previo (que, como se documentó arriba, ya
  fallaba cerrado en runtime con `trustProxy: 1`).
- E2E no se ejecutó (fuera de scope de este pedido); no aporta evidencia
  adicional sobre este cambio.
- Los checks remotos de CI sobre el head nuevo (una vez empujado) siguen
  siendo el gate definitivo previo a cualquier merge.

## Estado final

Fix A (`fast-uri`) y Fix B (`trustProxy`) implementados y validados
localmente: `pnpm audit --prod`, `pnpm audit`, todos los tests dirigidos y
**`pnpm validate:local` completo en `PASSED`** (typecheck, typecheck:test,
test, build; 4489/4490 tests, 1 skip preexistente, build 918.1kb). No se
realizó ninguna operación Git/GitHub remota (`add`, `commit`, `push`,
`rerun`, `update-branch`, `merge`); todas quedan `[MANUAL-NICO]`. E2E
`NOT_RUN` por instrucción explícita.
