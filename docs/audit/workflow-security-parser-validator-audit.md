# Workflow Security Parser Validator Audit

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-13 |
| Rama | `ci/workflow-security-parser-validator` |
| Base | `main@3da0184e92a4c2027c5daaa2f1ce90998e9c1017` |
| Dictamen | Implementacion conforme al scope con suite completa verde |

## Alcance auditado

Incluido:

- dependencia directa `js-yaml@4.2.0`;
- parser-backed semantic validation de GitHub Actions;
- reporte deterministico y CLI;
- quality impact para clasificar el nuevo validador como `workflows/CI`;
- test contractual positivo y negativo.
- aislamiento deterministico de guardrails CLEAN7A historicos.

Excluido:

- required PR Governance integration;
- QGA-4B y QGA-N2;
- workflows, branch protection, settings y rulesets;
- backend runtime, DB, migraciones, auth y seguridad de sesiones;
- segundo worktree protegido.

## Hallazgos

### Parser mantenido

El validador usa `js-yaml` para parsear documentos completos y opera sobre el objeto resultante. No valida acciones, permisos ni contenedores con regex sobre el YAML textual.

Resultado: PASS.

### YAML real

Los tests cubren claves quoted, flow-style, anchors no referenciados, aliases rechazados, comentarios, block scalars y claves con espacios mediante paths semanticos seguros.

Resultado: PASS.

### Acciones

Se recorren `jobs.<job>.steps[].uses` y `jobs.<job>.uses`. Las referencias externas requieren repositorio allowlisted y SHA lowercase de 40 caracteres. Las referencias locales se normalizan y solo se permiten bajo `.github/actions`.

Resultado: PASS.

### Permisos

Los workflows deben declarar exactamente:

```yaml
permissions:
  contents: read
```

Se rechazan scalars, `write-all`, `read-all`, claves top-level adicionales y permisos a nivel job salvo excepcion declarada.

Resultado: PASS.

### Contenedores y servicios

`jobs.<job>.container` y `jobs.<job>.services.<service>.image` se aceptan solo por digest `sha256` lowercase de 64 caracteres o excepcion exacta. La excepcion `postgres:16` exige match simultaneo de workflow, job, service e image.

Resultado: PASS.

### Aliases

`js-yaml 4.2.0` documenta `maxDepth` y `maxMergeSeqLength`, pero no `maxAliasCount`. La implementacion conserva esos limites y rechaza todo alias YAML observado por el listener del parser: escalares, mappings, sequences y merges.

Resultado: PASS.

### CLEAN7A

La politica pura CLEAN7A se preserva en `assertClean7aDependencyCleanupScopeInput()`:

- `package.json` sigue prohibido dentro del contrato especifico CLEAN7A;
- `frontend/pnpm-lock.yaml` sigue prohibido;
- cambios de dependencies/devDependencies frontend siguen exigiendo `frontend/package.json` y `pnpm-lock.yaml`;
- lockfile sin cambio real de dependencias sigue fallando;
- dependencias removidas siguen fallando si se reintroducen por fixtures puros.

Los cinco guardrails visuales historicos ahora llaman `assertClean7aDependencyCleanupInvariants()`, que lee el estado actual y no inspecciona `git diff`.

Resultado: PASS.

### Quality impact

`workflow-security-validator.mjs` y `.d.mts` clasifican como `workflows/CI`; `workflow-security-validator.mjs` queda protegido en `REQUIRED_SOURCE_PATHS`.

Resultado: PASS.

## Validaciones observadas

- `pnpm install --frozen-lockfile`: PASS.
- `node --check` policy y validator: PASS.
- CLI validator normal y `--json`: PASS.
- contratos workflow security, quality impact y single-scope: PASS.
- `pnpm typecheck`: PASS.
- `pnpm typecheck:test`: PASS.
- `pnpm build`: PASS.
- `pnpm security:public-surface`: PASS con hallazgos existentes `server-only`.
- frontend lint/typecheck/build: PASS.
- `pnpm test`: PASS, 3092 tests, `fail 0`.
- `git diff --check`: PASS.

## Riesgo residual

La dependencia directa exacta `js-yaml@4.2.0` queda limitada al nuevo validador. No se modifico `frontend/package.json`.

El bloqueo total de aliases es conservador por ausencia de `maxAliasCount` documentado. `maxDepth` y `maxMergeSeqLength` permanecen activos como controles adicionales.

## Dictamen

La implementacion cumple el objetivo de PR intermedia: parser-backed semantic validation sin integracion required, freeze SHA-256 conservado y QGA-4B/QGA-N2 bloqueados.
