# M44 — Legacy imports sweep closeout

## 1. Identificación y baseline

- Milestone: M44, apertura de Fase K.
- Rama: `refactor/backend-modularization-m44-legacy-imports-sweep`.
- Baseline y HEAD inicial:
  `7f9644fbc0d38bf604218dc6b2a87f037da10f44`.
- `origin/main` remoto verificado en el mismo commit.
- Working tree e índice iniciales: limpios.
- Worktrees: únicamente `C:/PORTAL-VETNEB`.
- Riesgo: R2 estructural backend autorizado exclusivamente para M44.

## 2. Alcance M44

Incluido: retiro de dos shims residuales, realineación de ocho imports
dinámicos, guards y hashes afectados, documentación vigente, guard global y
closeout. Excluido: anti-ciclos, matriz cross-feature, reclasificación de
`server/lib`, Auth, comportamiento funcional, movimientos adicionales, capas,
dependencias, schema, migraciones, frontend, scripts y CI.

## 3. Censo inicial bruto

`rg` sobre `server/**` y `test/**` confirmó ocho referencias productivas a
`server/db-particular.ts`, cero consumidores productivos de
`server/db-study-tracking.ts` y referencias source-only en los guards
M33/M35/M35b. El árbol inicial contenía exactamente los dos shims declarados
por el censo congelado.

## 4. Censo AST focalizado

El censo TypeScript AST contempló imports estáticos ejecutables, reexports,
`require()` e `import()`. La allowlist productiva quedó congelada en:

1. `server/preflight.ts`;
2. `server/routes/admin-study-tracking.fastify.ts`;
3. `server/routes/auth.fastify.ts`;
4. `server/routes/particular-audit.fastify.ts`;
5. `server/routes/particular-auth.fastify.ts`;
6. `server/routes/particular-study-tracking.fastify.ts`;
7. `server/routes/study-tracking.fastify.ts`.

## 5. Falsos positivos descartados

`server/lib/report-access-token.ts` se preservó intacto. El módulo contiene
schemas Zod, parsing, serialización y comportamiento real; no es un shim puro.

## 6. Dos shims retirados

- `server/db-particular.ts`;
- `server/db-study-tracking.ts`.

No se crearon reexports alternativos, aliases, wrappers, barrels raíz,
service locators ni adapters forwarding.

## 7. Ocho consumidores realineados

Cada consumidor de §4 cambió una sola línea: el specifier del `import()`.
Los archivos bajo `middlewares/` y `routes/` usan
`../features/particular-access/infrastructure/index.ts`; `preflight.ts` usa
`./features/particular-access/infrastructure/index.ts`.

El `git diff --numstat` productivo mostró `1/1` para cada archivo: total
esperado de ocho líneas eliminadas y ocho agregadas.

## 8. Equivalencia del objeto módulo

El shim retirado hacía exclusivamente `export *` del barrel
`server/features/particular-access/infrastructure/index.ts`. El `import()`
directo carga ese mismo barrel y expone el mismo namespace utilizado por las
variables receptoras existentes. No cambiaron destructuring, nombres,
`Promise.all`, orden, lazy loading ni manejo de errores.

## 9. Auth preservado sin reorganización

Los archivos Auth afectados conservaron variables, dependencias, handlers,
cookies, sesiones, autenticadores, rate limits, auditoría, CORS, trusted
origin, payloads, status, mensajes y control flow. M44 sólo cambió el
specifier dinámico autorizado.

## 10. Study Tracking con cero consumidores residuales

El censo inicial confirmó cero consumidores de
`server/db-study-tracking.ts`. Sus rutas propias continúan atravesando
`study-tracking-route-composition.ts`; Reports continúa usando su composición
canónica.

## 11. Guards realineados

Se realinearon los guards M33, M35b, infrastructure Study Tracking, closeout
M35, thin routes clínica/particular y completeness. El censo de hashes detectó
además un anchor real en
`test/architecture/study-tracking-admin-thin-route.test.ts`; se agregó a la
allowlist efectiva únicamente para actualizar sus dos digests.

## 12. Hashes actualizados y método de comprobación

Antes de actualizar los hashes se ejecutó `git diff --numstat`,
`git diff --unified=0` y `git diff --check` sobre los ocho archivos
productivos. Cada diff mostró una única sustitución de specifier.

| Archivo | SHA-256 anterior | SHA-256 nuevo |
| --- | --- | --- |
| `server/routes/particular-auth.fastify.ts` | `5ed5bf6f6ec6edb72983cdcfca84b283b89a3db4ff3b408349b557aa9a0d1561` | `e94e5a2847f635f30a8edd81fa5270fd1501f727fc1b91e434677c3d101a0c86` |
| `server/routes/study-tracking.fastify.ts` | `f2b8e5afbe0ded7fcb75ece389cfd476d8667c49f792a104f9ee3bb7379f7319` | `aeacf4866ffa9a70d1ee867cd652f49e35b5bb86709fa4b3003d95c178078ae7` |
| `server/routes/particular-study-tracking.fastify.ts` | `ed7d3f4a949af488a9dab5a9a89ccc9e89d19399ddde7230a25a3189a32591fb` | `88d6cd63bb808fbb6d613aea60fcf9fae25c2681f8679c3acc3c3d3ad16501aa` |
| `server/routes/admin-study-tracking.fastify.ts` | `15aab9bd2b23caf27644185b5421cabe206644ed5b837c54e3dac66fa109c892` | `4454a06d394f6d377eedfb1420bc2e3a6e8e651096d3a230c2cd809db0dcb6de` |

## 13. Guard global M44

`test/architecture/backend-modularization-m44-legacy-imports-sweep.test.ts`
usa `node:test`, `node:assert/strict` y TypeScript AST. Protege paths ausentes,
cero imports legacy, cero shims puros raíz, clasificación real de
`report-access-token`, consumidores y barrels exactos, ausencia de aliases,
closeout M44 y estado M45.

## 14. Contratos funcionales preservados

Bootstrap/preflight, cleanup de sesiones expiradas, autenticación de clínica,
particular y admin, login/logout, sesiones/cookies, last-access, rate limits,
auditoría particular, Study Tracking por los tres realms, email, errores,
status, payloads, orden y lazy module loading quedaron sin cambios funcionales.

## 15. Validaciones con exit code real

| Gate | Estado | Exit |
| --- | --- | ---: |
| Cohorte dirigida M44 | PASSED — 262/262 final | 0 |
| `pnpm typecheck` | PASSED | 0 |
| `pnpm typecheck:test` | PASSED | 0 |
| `pnpm test` | PASSED — 3910 total, 3909 pass, 1 skip | 0 |
| `pnpm build` | PASSED | 0 |
| `pnpm security:public-surface` | PASSED — cero findings públicos; dos markers server-only esperados | 0 |
| `pnpm audit --prod` | PASSED — cero vulnerabilidades conocidas | 0 |
| `pnpm audit` | PASSED — cero vulnerabilidades conocidas | 0 |
| `pnpm validate:local` | PASSED — typechecks + 3910/3909/1/0 + build | 0 |
| `git diff --check` | PASSED | 0 |
| `git diff --cached --check` | PASSED — índice vacío | 0 |

## 16. Fail-fast y reintentos reales

Las precondiciones, lecturas, censos y comprobación del diff productivo
terminaron con exit code 0. La cohorte dirigida tuvo tres corridas FAILED
source-only:

1. 259/262: marker M45 partido por Markdown, aserción autorreferencial del
   guard y marker histórico M33 exigido en el README vigente;
2. 260/262: dos markers seguían sin tolerar el wording/salto real;
3. 261/262: el prefijo `>` del bloque Markdown aún separaba M45 de NOT_RUN.

Cada causa se corrigió únicamente en guards/documentación M44 y se repitió la
cohorte completa. La cuarta corrida quedó 262/262 PASSED, exit code 0. No hubo
fallos runtime. Todos los gates amplios posteriores terminaron PASSED en la
primera corrida.

## 17. Riesgos

El riesgo principal es que un consumidor legacy o anchor hash quede omitido.
Se mitiga con censo AST global, allowlist exacta, hashes derivados sólo después
del diff 1:1, guards enfocados y validación completa. Riesgo residual de datos:
ninguno; no cambian queries, schema, migraciones ni transacciones.

## 18. Rollback

Revertir M44 restaura ambos shims, devuelve los ocho specifiers a sus paths
anteriores y revierte guards/docs/hashes. No requiere migración, cambio de
schema, compensación, modificación de datos ni reorganización de Auth.

## 19. Exclusiones

No se modificaron frontend, schema, migraciones, Supabase, manifests,
lockfiles, dependencias, scripts, workflows, Docker,
`server/fastify-app.ts`, `server/db.ts`, repositories/barrels canónicos,
`server/lib/report-access-token.ts`, permissions, helpers CORS/session, email,
audit infrastructure, Auth architecture, ramas ni worktrees ajenos.

## 20. Git/GitHub NOT_RUN y estado Fase K

- STAGE: NOT_RUN
- COMMIT: NOT_RUN
- AMEND: NOT_RUN
- PUSH: NOT_RUN
- PR: NOT_RUN
- MERGE: NOT_RUN

**M44 CLOSED localmente** tras completar los gates documentados. **M45
NOT_RUN** y permanece como el siguiente milestone de Fase K.
