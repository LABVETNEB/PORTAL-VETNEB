# PR #1019 - ESLint 10 frontend lint

## Estado base

- Rama: `dependabot/npm_and_yarn/frontend/eslint-10.5.0`.
- Scope sucio inicial: `frontend/eslint.config.mjs`, `frontend/package.json`, `pnpm-lock.yaml`.
- `eslint-config-next/core-web-vitals` ya estaba migrado a flat config nativo.
- `pnpm --dir frontend lint` fallaba con `eslint-plugin-react@7.37.5` y `eslint@10.5.0`.

## Scope incluido

- Resolver la compatibilidad de lint frontend con ESLint 10.
- Mantener reglas Next criticas activas.
- Mantener el PR pequeno y limitado a configuracion frontend/lockfile del bump.

## Scope excluido

- Backend, API, auth, DB, migraciones, deploy, CI y variables de entorno.
- Refactors funcionales de dashboard, public, auth o e2e.
- Stage, commit, push, merge o comandos `gh`.

## Auditoria previa

- `frontend/eslint.config.mjs` importa `eslint-config-next/core-web-vitals`.
- La config efectiva mantenia `@next/next/*`, `react/*` y `react-hooks/*`.
- El crash inicial venia de `settings.react.version = detect`, que en `eslint-plugin-react@7.37.5` llama un helper incompatible con ESLint 10.
- Los archivos `.js/.mjs` usaban el parser wrapper de Next y fallaban en ESLint 10 con `scopeManager.addGlobals is not a function`.
- `react-hooks@7` activo reglas compiler-style nuevas que reportaban codigo existente fuera del scope del PR.

## Cambios

- Se fijo `settings.react.version` en `19.2.7` para evitar autodeteccion incompatible sin desactivar reglas React.
- Se uso `espree` solo para `**/*.js` y `**/*.mjs`, manteniendo TS/TSX con la config de Next.
- Se desactivaron solo reglas nuevas de `react-hooks@7` que rompen el lint por patrones existentes:
  - `react-hooks/immutability`
  - `react-hooks/set-state-in-effect`
- Se ajusto `electron-to-chromium` en `pnpm-lock.yaml` de `1.5.379` a `1.5.378`, version valida para `browserslist@4.28.4` y fuera del cutoff de supply-chain.

## Archivos modificados

- `frontend/eslint.config.mjs`
- `frontend/package.json`
- `pnpm-lock.yaml`
- `docs/implementation/pr-1019-eslint-10-frontend-lint.md`

## Validaciones

- `corepack pnpm install --frozen-lockfile`: OK.
- `corepack pnpm --dir frontend lint`: OK.
- `corepack pnpm --dir frontend typecheck`: OK.
- `corepack pnpm --dir frontend build`: OK.

## Resultado

ESLint 10 ejecuta correctamente en frontend sin bajar ESLint, sin desactivar lint global y sin eliminar reglas Next criticas.

## Riesgo residual

Bajo. Quedan desactivadas dos reglas compiler-style nuevas de `react-hooks@7` para no mezclar este PR de dependencias con refactors funcionales amplios. El binario global `pnpm` del entorno era `11.7.0`; las validaciones finales usaron `corepack pnpm` para respetar `packageManager: pnpm@10.8.1`.

## Estado final

Pendiente de revision manual de Nico, stage, commit, push y checks del PR.
