# EV-01 — Trusted Proxy IP Chain Runtime Tests

Estado base: `38c2f2fbb4cfca27a053e51afb7960f8413e5222` (`origin/main`, squash de PR-SEC-09 #2000).
Rama: `test/ev-01-trust-proxy-runtime`. Scope primario: **tests** (test-only). Riesgo: R1.

## Alcance

Incluido:

- `test/unit/infrastructure/trust-proxy-ip-chain-runtime.test.ts` (nuevo).
- Este documento.

Excluido deliberadamente: `server/lib/env.ts`, configuración de Fastify, rate limiting, `.env*`, workflows, dependencias, Render, Cloudflare, producción, migraciones. No hay cambios productivos.

## Hallazgo de seguridad de `TRUST_PROXY`

Hasta EV-01 el contrato `TRUST_PROXY` (`server/lib/env.ts`, lista IP/CIDR; default `false`) estaba cubierto sólo por tests de schema y por guards de texto fuente. El único test de comportamiento con `X-Forwarded-For` (XFF) usa `trustProxy: true`, el modo totalmente falsificable. No existía prueba con Fastify real que fijara cómo se resuelve `request.ip` con una lista explícita, ni cómo eso alimenta las claves de rate limit de contacto y de login.

Comportamiento fijado por las pruebas (Fastify instalado, `proxy-addr`):

- Con `false`, o con peer fuera de la lista, XFF se ignora y `request.ip` es el peer.
- Con peer confiable, `request.ip` es la primera dirección no confiable contando desde la derecha de la cadena. Un prefijo falsificado a la izquierda no suplanta al cliente.
- Una lista que no cubre todos los saltos termina en una dirección de proxy (colapso de buckets): la lista debe incluir **todos** los saltos entre el borde y Fastify.
- `true` confía en toda la cadena y permite rotar buckets (control negativo; nunca usar en producción).

## Las 14 pruebas

Direcciones sintéticas reservadas para documentación (RFC 5737 / RFC 3849). Fastify real con `app.inject` y `remoteAddress`; sin listener TCP ni red.

| ID | Verifica |
|---|---|
| A01 | `trustProxy=false` ignora XFF falsificado |
| A02 | Lista explícita con peer no confiable ignora XFF ajeno |
| A03 | Peer confiable: `request.ip` es el cliente |
| A04 | Prefijo XFF falsificado desde proxy confiable no se acepta |
| A05 | Cadena parcial termina en el salto no listado |
| A06 | Lista completa de dos proxies identifica al cliente |
| A07 | Prefijo falso con cadena completa no suplanta al cliente |
| A08 | CIDR acepta sólo peers del rango |
| A09 | IPv6 requiere confianza explícita |
| A10 | XFF falso no rota el bucket de contacto |
| A11 | XFF falso no rota los buckets de login (clave, hash de IP, credenciales ausentes) |
| A12 | Clientes distintos tras proxy confiable tienen buckets distintos |
| A13 | Contacto normaliza IPv4 mapeada en IPv6 |
| A14 | `trustProxy=true` permite spoofing (control negativo) |

## Validación (estados canónicos)

| Gate | Estado | Evidencia |
|---|---|---|
| Test dirigido EV-01 | PASSED | 14/14, exit code 0 |
| Arquitectura/seguridad ampliada (corrida previa) | PASSED | 110/110 |
| Dirigido inicial (corrida previa) | PASSED | 37/37 |
| `pnpm typecheck:test` (corrida previa) | PASSED | exit code 0 |
| `pnpm typecheck` | PASSED | primera fase de `validate:local` (exit 0) |
| `pnpm typecheck:test` | PASSED | segunda fase de `validate:local` (exit 0) |
| `pnpm test` (en `validate:local`, corrida final) | FAILED | 5824 tests, 5816 pass, 7 fail, 1 skipped; los 7 son PostgreSQL (ver abajo); 0 fallos funcionales |
| `pnpm build` | NOT_RUN | la cadena `validate:local` se detuvo en `pnpm test`; el cambio es test-only y no toca código compilado |
| `pnpm validate:local` | FAILED | exit 1, sólo por los 7 tests PostgreSQL |

## Incidente de procedimiento: archivo untracked y luego staged

La primera corrida de `pnpm validate:local` terminó con 26 fallos: 19 por el nuevo test todavía **no registrado en el índice** de Git (los censos de `test/architecture/` usan `git ls-files`, por lo que un archivo untracked es invisible o inconsistente) y 7 de tests PostgreSQL. Tras `git add` del archivo exacto, los censos pasaron.

Un procedimiento posterior se detuvo con `BLOCKED: hay modificaciones tracked pendientes` porque comparaba con `git diff --name-only HEAD --`, que incluye lo preparado en el índice. El único cambio era el test staged (`A`), legítimo. Verificado: `git diff --name-only` (unstaged) vacío; `git diff --cached --name-only` = el test; `git diff --cached --check` sin hallazgos. Corrección: distinguir staged, unstaged y untracked; no exigir `git diff HEAD` vacío.

## Reubicación por censo 01B

La segunda corrida de `pnpm validate:local` mostró 2 fallos funcionales (no PostgreSQL) del censo 01B: con el test en `test/security/` la carpeta pasó a 14 specs, fuera de la banda `10 ± 3` (`A0-06-FOLDERS`; la carpeta ya estaba en 13). Para no modificar ni debilitar el guard, el test se reubicó sin cambios de lógica a `test/unit/infrastructure/` (banda ~93 ± 25 %, 103 specs tras el cambio), ajustando sólo la profundidad de los imports. Censo 01B más el test: 24/24 PASSED.

## Limitaciones PostgreSQL

Los 7 fallos restantes de la primera corrida corresponden a tests que requieren base PostgreSQL. No se usaron secretos ni bases reales. Causa verificada en el log: cada uno falla con «requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci» (`e2e-global-03b-authoritative-auth-boundary`, `global-search-cursor-postgres`, `global-search-postgres-isolation`, `global-search-rate-limit-postgres`, `global-search-states-postgres`, `password-change-session-revocation-postgres`, `report-by-id-postgres-isolation`). Es una precondición de entorno ausente (BLOCKED para esos 7), no una regresión; ninguno toca el test nuevo. CI con su DB es el gate definitivo. No se modificó ningún test para forzar resultados.

## Riesgos residuales

- Las direcciones son sintéticas: **no prueban la topología real** (Cloudflare/Render/Next). Siguen faltando: peer inmediato observado, IP/CIDR de entrada de Render, IP de egreso del frontend si aparecen en XFF, valor real de `TRUST_PROXY` en producción y staging.
- El proxy de rewrites de Next no pasa `xfwd` según la lectura de código; no está observado en runtime.
- No hay prueba de arranque en producción sin `TRUST_PROXY` (la política aún no existe).

## Dependencia de infraestructura pendiente para SEC-10

PR-SEC-10 (exigir `TRUST_PROXY` en producción) permanece **BLOCKED por evidencia de infraestructura**: sin las IP/CIDR reales y el peer observado, exigirlo puede abrir spoofing (lista ancha) o colapsar buckets de rate limit (lista corta). EV-01 aporta el arnés de pruebas, no la evidencia de topología.

## Rollback

Revert del commit. Sin migraciones, datos ni configuración productiva.
