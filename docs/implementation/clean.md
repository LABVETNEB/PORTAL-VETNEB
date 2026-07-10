# CLEAN

## Objetivo

Corregir el guardrail de dependencias que interpretaba cualquier modificación de
`frontend/package.json` como un cambio de dependencias y exigía modificar
`pnpm-lock.yaml`, incluso cuando el cambio afectaba únicamente `scripts`.

## Causa raíz

El helper `test/helpers/clean7a-dependency-cleanup-scope.ts` evaluaba solamente
los nombres de los manifiestos modificados. No comparaba las secciones
`dependencies` y `devDependencies` entre `HEAD` y el working tree.

Como consecuencia, un cambio legítimo de scripts en `frontend/package.json`
producía un falso positivo.

## Solución

El guardrail ahora separa:

- descubrimiento de manifiestos modificados;
- lectura del `frontend/package.json` base desde Git;
- lectura del archivo actual desde el filesystem;
- comparación estructural de `dependencies` y `devDependencies`;
- validación pura del scope;
- invariantes históricas de CLEAN7A, CLEAN7C y CLEAN7D.

## Contrato

- Un cambio exclusivamente en `scripts` no requiere modificar `pnpm-lock.yaml`.
- Un cambio real en `dependencies` o `devDependencies` requiere
  `frontend/package.json` y `pnpm-lock.yaml`.
- Un lockfile modificado sin cambio real de dependencias es rechazado.
- `package.json` raíz y `frontend/pnpm-lock.yaml` permanecen fuera del allowlist.
- Las dependencias eliminadas siguen ausentes.
- Las dependencias Radix activas siguen presentes.
- La nota histórica de CLEAN7A continúa validándose.

## Pruebas

Se añadió `test/unit/infrastructure/clean.test.ts` con 14 escenarios:

- scripts-only;
- cambios válidos de dependencies y devDependencies;
- ausencia obligatoria o presencia indebida del lockfile;
- manifiestos fuera de scope;
- orden de propiedades;
- cambios de versión;
- invariantes CLEAN históricas.

## Validaciones ejecutadas

- Matriz CLEAN aislada: 14/14 PASS.
- Consumidores directos del helper: PASS.
- `pnpm typecheck:test`: PASS.
- `pnpm test`: 3000/3000 PASS.
- `pnpm build`: PASS.
- `pnpm security:public-surface`: PASS.

## Scope

Este cambio no modifica frontend runtime, backend, API, auth, DB, schema,
migraciones, dependencias, lockfiles ni CI.
