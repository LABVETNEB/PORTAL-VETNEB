# PR-CLEAN7C · frontend ESLint tooling dependencies

## Estado base

- Repo: `C:\PORTAL-VETNEB`.
- Rama: `clean/frontend-eslint-tooling-deps`.
- HEAD: `7626865 docs(audit): audit remaining frontend dependencies (#1176)`.
- Working tree inicial: limpio.

## Scope incluido

- Analizar sólo `@eslint/eslintrc` y la dependencia directa
  `@next/eslint-plugin-next` en `frontend/package.json`.
- Remover dependencias directas de tooling ESLint sólo si la evidencia y `lint`
  lo permiten.
- Regenerar `pnpm-lock.yaml` con pnpm.
- Ajustar contratos de test que exigían explícitamente los paquetes removidos.
- Actualizar documentación rectora en `docs/audit`.

## Scope excluido

- Radix.
- Runtime frontend.
- Runtime backend.
- DB, migraciones, workflows, Render, secrets y auth.
- `package.json` raíz.
- Commit, push y PR.

## Auditoría previa

- Base limpia en la rama esperada y HEAD esperado.
- `frontend/eslint.config.mjs` importa `eslint-config-next/core-web-vitals`.
- No existe `FlatCompat` ni import de `@eslint/eslintrc`.
- `frontend/next.config.ts` no usa los paquetes auditados.
- `package.json` raíz no declara estos paquetes.
- `pnpm-lock.yaml` mostraba `@next/eslint-plugin-next@16.2.7` directo y
  `@next/eslint-plugin-next@16.2.9` transitivo por `eslint-config-next@16.2.9`.

## Evidencia

```text
corepack pnpm --dir frontend why @eslint/eslintrc
-> devDependencies:
-> @eslint/eslintrc 3.3.5

corepack pnpm --dir frontend why @next/eslint-plugin-next
-> devDependencies:
-> @next/eslint-plugin-next 16.2.7
-> eslint-config-next 16.2.9
-> └── @next/eslint-plugin-next 16.2.9

corepack pnpm --dir frontend why eslint-config-next
-> devDependencies:
-> eslint-config-next 16.2.9
```

`git grep` encontró referencias en docs, manifest, lockfile,
`frontend/eslint.config.mjs`, `test/package-scripts-contract.test.ts` y
`test/helpers/clean7a-dependency-cleanup-scope.ts`; no encontró uso runtime ni
`FlatCompat`.

## Cambios

- Se ejecutó:
  `corepack pnpm --dir frontend remove @eslint/eslintrc @next/eslint-plugin-next`.
- `frontend/package.json` dejó de declarar esas dos devDependencies directas.
- `pnpm-lock.yaml` fue regenerado por pnpm.
- `test/package-scripts-contract.test.ts` dejó de exigir `@eslint/eslintrc`.
- `test/helpers/clean7a-dependency-cleanup-scope.ts` dejó de preservar esas dos
  dependencias `UNKNOWN` y ahora fija su ausencia para CLEAN7C.
- Docs actualizados:
  `docs/audit/final-repo-cleanup-engineering-audit.md`,
  `docs/audit/frontend-dependencies-usage-audit.md`,
  `docs/audit/frontend-radix-tooling-dependencies-audit.md`.

## Decisiones

- `@eslint/eslintrc`: removido. No era necesario por `FlatCompat`; el grafo lo
  mostraba como dependencia directa solamente y `lint` pasó antes de remover.
- `@next/eslint-plugin-next`: removida sólo la dependencia directa. La copia
  necesaria queda transitiva vía `eslint-config-next@16.2.9`.

## Validaciones

- `corepack pnpm --dir frontend lint` baseline antes de remover: pasó.
- `node --experimental-strip-types --test test/package-scripts-contract.test.ts`:
  pasó 10/10 tras los ajustes de contrato.
- `corepack pnpm typecheck`: pasó.
- `corepack pnpm typecheck:test`: pasó.
- `node --experimental-strip-types --test test/package-scripts-contract.test.ts`:
  pasó 10/10.
- `corepack pnpm test`: pasó 2890/2890.
- `corepack pnpm build`: pasó.
- `corepack pnpm security:public-surface`: pasó; mantuvo notas informativas
  existentes sobre identificadores uppercase en `frontend/src/proxy.ts`.
- `corepack pnpm --dir frontend lint`: pasó.
- `corepack pnpm --dir frontend typecheck`: pasó.
- `corepack pnpm --dir frontend build`: pasó.

## Resultado

- Remoción acotada de tooling ESLint directo.
- Radix queda sin cambios.
- Runtime frontend/backend queda sin cambios.
- `package.json` raíz queda sin cambios.

## Riesgo residual

- Riesgo bajo-medio propio de cambio de manifest/lockfile.
- Persisten warnings peer existentes de `eslint-config-next` con ESLint 10; no
  bloquearon pnpm ni lint.

## Estado final

- Sin commit.
- Sin push.
- Sin PR.
