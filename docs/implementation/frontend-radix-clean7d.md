# PR-CLEAN7D · frontend Radix unused dependencies

## Estado base

- Repo: `C:\PORTAL-VETNEB`.
- Rama: `clean/frontend-radix-unused-core`.
- HEAD inicial: `a4582e4 chore(frontend): remove redundant eslint tooling deps (#1177)`.
- Working tree inicial: limpio.
- PRs abiertos: no verificado por `gh`; el protocolo local no autoriza comandos `gh` sin autorizacion explicita.

## Scope incluido

- Remover solo `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-label`, `@radix-ui/react-select` y
  `@radix-ui/react-tabs` de `frontend/package.json`.
- Regenerar `pnpm-lock.yaml` con pnpm.
- Ajustar solo contratos de test que exigian o preservaban esos paquetes.
- Actualizar documentacion rectora en `docs/audit`.

## Scope excluido

- `@radix-ui/react-toast`.
- `@radix-ui/react-tooltip`.
- Runtime frontend.
- Runtime backend.
- DB, migraciones, workflows, Render, secrets, auth y seguridad productiva.
- `package.json` raiz.
- Otras dependencias.
- Commit, push y PR.

## Auditoria previa

- `git status --short --untracked-files=all`: limpio.
- Rama observada: `clean/frontend-radix-unused-core`.
- HEAD observado: `a4582e4 chore(frontend): remove redundant eslint tooling deps (#1177)`.
- `frontend/package.json` declaraba los cinco candidatos y mantenia
  `toast`/`tooltip`.
- `pnpm-lock.yaml` contenia entradas directas y transitivas de los cinco
  candidatos.
- `git grep` amplio encontro referencias solo en manifest, lockfile,
  tests/helpers y documentacion.
- `git grep` de imports reales `from`, `require()` e `import()` para los cinco
  candidatos devolvio 0 resultados.
- `corepack pnpm --dir frontend why` mostro los cinco candidatos como
  dependencias directas del frontend.

## Cambios

- Se ejecuto:
  `corepack pnpm --dir frontend remove @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select @radix-ui/react-tabs`.
- `frontend/package.json` dejo de declarar solo esas cinco dependencias.
- `pnpm-lock.yaml` fue regenerado por pnpm.
- `test/package-scripts-contract.test.ts` dejo de exigir los cinco Radix
  removidos y conserva los Radix activos o diferidos.
- `test/helpers/clean7a-dependency-cleanup-scope.ts` ahora fija la ausencia de
  los cinco candidatos de CLEAN7D y preserva `dialog`, `separator`, `slot`,
  `toast` y `tooltip`.
- Docs actualizados:
  `docs/audit/final-repo-cleanup-engineering-audit.md`,
  `docs/audit/frontend-dependencies-usage-audit.md` y
  `docs/audit/frontend-radix-tooling-dependencies-audit.md`.

## Validaciones

- `corepack pnpm typecheck`: paso.
- `corepack pnpm typecheck:test`: paso.
- `node --experimental-strip-types --test test/package-scripts-contract.test.ts`:
  paso 10/10.
- `corepack pnpm test`: paso 2890/2890.
- `corepack pnpm build`: paso.
- `corepack pnpm security:public-surface`: paso; mantuvo notas informativas
  existentes sobre identificadores uppercase en `frontend/src/proxy.ts`.
- `corepack pnpm --dir frontend lint`: paso.
- `corepack pnpm --dir frontend typecheck`: paso.
- `corepack pnpm --dir frontend build`: paso.

## Resultado

- Remocion acotada del grupo Radix `SUSPECT unused`.
- `@radix-ui/react-toast` y `@radix-ui/react-tooltip` permanecen en
  `frontend/package.json`.
- No se modifico runtime frontend/backend.
- `package.json` raiz queda fuera de alcance.

## Riesgo residual

- Riesgo bajo-medio propio de cambio de manifest/lockfile.
- `toast` y `tooltip` siguen como deuda diferida por roadmap; su adopcion o
  remocion debe tratarse en PR separado.

## Estado final

- Sin commit.
- Sin push.
- Sin PR.
