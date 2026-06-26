# PR #1121 - Actions checkout v7 contract

## Scope

- Alinear el contrato interno del backend CI con el bump de `actions/checkout` de `v6` a `v7`.
- Mantener fuera de scope cambios funcionales, runtime frontend/backend, dependencias, lockfile y workflows no relacionados.

## Archivos modificados

- `test/toolchain-contract.test.ts`
- `docs/implementation/pr-1121-actions-checkout-v7-contract.md`

## Causa del fallo

`backend-ci.yml` ya usa `actions/checkout@v7`, pero `test/toolchain-contract.test.ts` seguia esperando `actions/checkout@v6`.

## Cambio aplicado

- Se actualizo solo la expectativa contractual obsoleta de `uses: actions/checkout@v6` a `uses: actions/checkout@v7`.
- Se preservaron las validaciones existentes de PNPM, Node, cache y orden de instalacion.
- No se modificaron workflows.

## Validaciones ejecutadas

- `pnpm test -- test/toolchain-contract.test.ts`: fallo antes de validar el archivo especifico porque el `pnpm` del runtime era `11.7.0` y aborto la purga de `node_modules` sin TTY.
- `corepack pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/toolchain-contract.test.ts`: OK, 3/3 tests.
- `corepack pnpm typecheck`: OK.
- `corepack pnpm build`: OK.

## Riesgo residual

Bajo. El cambio se limita a sincronizar el contrato con el workflow ya actualizado por el PR #1121.
