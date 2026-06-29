# Auditoría P2-B remanente · Radix y tooling frontend

> **Modo:** auditoría documental y técnica / docs-only.
> **Fecha:** 2026-06-29.
> **Scope:** remanente P2-B posterior a PR-CLEAN7A:
> `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`,
> `@radix-ui/react-label`, `@radix-ui/react-select`,
> `@radix-ui/react-tabs`, `@radix-ui/react-toast`,
> `@radix-ui/react-tooltip`, `@eslint/eslintrc`,
> `@next/eslint-plugin-next`.
> **No se modificó:** `frontend/package.json`, `pnpm-lock.yaml`, runtime
> frontend, runtime backend, DB, migraciones, workflows, Render ni secrets.

---

## 1. Estado base

| Ítem | Observado |
| --- | --- |
| Repo | `C:\PORTAL-VETNEB` |
| Rama | `audit/frontend-dependencies-radix-tooling` |
| HEAD | `1ac86d0 chore(frontend): remove unused core dependencies (#1175)` |
| Working tree inicial | limpio |
| PRs abiertos | no verificado por `gh`; el protocolo local no autoriza comandos `gh` en esta auditoría |

Documentos rectores leídos:

- `docs/audit/final-repo-cleanup-engineering-audit.md`
- `docs/audit/frontend-dependencies-usage-audit.md`
- `docs/implementation/frontend-unused-deps-clean7a.md`

`frontend/package.json` post-PR-CLEAN7A declara 20 `dependencies` y 12
`devDependencies`. Las cinco dependencias core removidas por PR-CLEAN7A ya no
están presentes. Radix remanente y tooling `UNKNOWN` siguen declarados.

---

## 2. Método reproducible

Comandos principales:

```powershell
git status --short --untracked-files=all
git branch --show-current
git log -1 --oneline
Get-Content -Raw frontend/package.json

git grep -n "@radix-ui/react-avatar\|@radix-ui/react-dropdown-menu\|@radix-ui/react-label\|@radix-ui/react-select\|@radix-ui/react-tabs\|@radix-ui/react-toast\|@radix-ui/react-tooltip\|@eslint/eslintrc\|@next/eslint-plugin-next" -- frontend test scripts docs package.json frontend/package.json

rg -n '@radix-ui/react-(avatar|dropdown-menu|label|select|tabs|toast|tooltip)|@eslint/eslintrc|@next/eslint-plugin-next' frontend/src frontend/e2e frontend/eslint.config.mjs frontend/next.config.ts frontend/package.json test/helpers/clean7a-dependency-cleanup-scope.ts test/package-scripts-contract.test.ts

rg -n 'from [''"](@radix-ui/react-avatar|@radix-ui/react-dropdown-menu|@radix-ui/react-label|@radix-ui/react-select|@radix-ui/react-tabs|@radix-ui/react-toast|@radix-ui/react-tooltip|@eslint/eslintrc|@next/eslint-plugin-next)[''"]' frontend test scripts docs package.json frontend/package.json
rg -n 'require\([''"](@radix-ui/react-avatar|@radix-ui/react-dropdown-menu|@radix-ui/react-label|@radix-ui/react-select|@radix-ui/react-tabs|@radix-ui/react-toast|@radix-ui/react-tooltip|@eslint/eslintrc|@next/eslint-plugin-next)[''"]\)' frontend test scripts docs package.json frontend/package.json
rg -n 'import\([''"](@radix-ui/react-avatar|@radix-ui/react-dropdown-menu|@radix-ui/react-label|@radix-ui/react-select|@radix-ui/react-tabs|@radix-ui/react-toast|@radix-ui/react-tooltip|@eslint/eslintrc|@next/eslint-plugin-next)[''"]\)' frontend test scripts docs package.json frontend/package.json

corepack pnpm --dir frontend why @eslint/eslintrc
corepack pnpm --dir frontend why @next/eslint-plugin-next
```

Lectura aplicada:

- `frontend/package.json` y `pnpm-lock.yaml` prueban declaración, no uso.
- `test/package-scripts-contract.test.ts` prueba contrato del manifest, no uso
  runtime.
- `test/helpers/clean7a-dependency-cleanup-scope.ts` prueba que PR-CLEAN7A
  preservó Radix y `UNKNOWN`, no que estén vivos.
- `docs/**` se considera referencia histórica, auditoría o roadmap; no uso
  runtime.
- Imports `from`, `require()` o `import()` en `frontend/src`, `frontend/e2e`,
  configs o scripts sí contarían como uso real.

---

## 3. Evidencia por paquete

| Paquete | Evidencia técnica | Roadmap/docs | Clasificación |
| --- | --- | --- | --- |
| `@radix-ui/react-avatar` | `frontend/package.json`, `pnpm-lock.yaml`, `test/package-scripts-contract.test.ts`, `test/helpers/clean7a-dependency-cleanup-scope.ts`; 0 imports `from`/`require`/`import()` | Sin adopción funcional detectada; menciones de auditoría | `SUSPECT unused` |
| `@radix-ui/react-dropdown-menu` | Manifest/lock/test/helper; 0 imports reales | Doc histórico de bump #1027; no roadmap funcional vigente | `SUSPECT unused` |
| `@radix-ui/react-label` | Manifest/lock/test/helper; 0 imports reales | Sin adopción funcional detectada | `SUSPECT unused` |
| `@radix-ui/react-select` | Manifest/lock/test/helper; 0 imports reales | Sin adopción funcional detectada | `SUSPECT unused` |
| `@radix-ui/react-tabs` | Manifest/lock/test/helper; 0 imports reales; UI actual usa `ModuleTabs` propio | Sin adopción funcional detectada | `SUSPECT unused` |
| `@radix-ui/react-toast` | Manifest/lock/test/helper; 0 imports reales | `docs/audit-premium-dashboard-interaction-value.md` propone adoptar `ui/toast.tsx` + provider dashboard | `DEFER keep por roadmap/estandarización UI` |
| `@radix-ui/react-tooltip` | Manifest/lock/test/helper; 0 imports reales | `docs/audit-premium-dashboard-interaction-value.md` propone adoptar `ui/tooltip.tsx` y reemplazar `title=` en sidebar | `DEFER keep por roadmap/estandarización UI` |
| `@eslint/eslintrc` | Antes de PR-CLEAN7C: manifest/lock/test; 0 imports en `frontend/eslint.config.mjs`; `corepack pnpm --dir frontend why` lo mostró como dependencia directa solamente | Sin `FlatCompat`; tooling directo prescindible | `REMOVED en PR-CLEAN7C` |
| `@next/eslint-plugin-next` | Antes de PR-CLEAN7C: manifest/lock/helper; 0 import directo en config; `eslint-config-next@16.2.9` lo traía transitivamente como `16.2.9`; directa fijada en `16.2.7` | Duplicado/version skew directo | `REMOVED directo en PR-CLEAN7C` |

Resultado de patrones de carga:

```text
rg "from ... paquete"    -> 0 resultados
rg "require(...)"        -> 0 resultados
rg "import(...)"         -> 0 resultados
```

Resultado de configs:

```text
frontend/eslint.config.mjs -> importa `eslint-config-next/core-web-vitals`, no `@eslint/eslintrc` ni `@next/eslint-plugin-next`
frontend/next.config.ts    -> importa `next`, no los paquetes auditados
```

Resultado de `pnpm why`:

```text
@eslint/eslintrc
-> devDependency directa solamente

@next/eslint-plugin-next
-> devDependency directa 16.2.7
-> transitiva 16.2.9 vía eslint-config-next 16.2.9
```

---

## 4. Clasificación final

| Clasificación | Paquetes | Decisión |
| --- | --- | --- |
| `LIVE` | ninguno dentro del scope remanente | No hay imports reales ni config directa. |
| `SUSPECT unused` | `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-tabs` | Candidatos a eliminación futura en PR chico, si Nico decide no preservarlos como estándar UI. |
| `REMOVED en PR-CLEAN7C` | `@eslint/eslintrc`, dependencia directa `@next/eslint-plugin-next` | `@eslint/eslintrc` no era necesario por `FlatCompat` ni por grafo transitivo; `@next/eslint-plugin-next` directo era redundante porque `eslint-config-next@16.2.9` lo trae transitivamente. |
| `DEFER keep por roadmap/estandarización UI` | `@radix-ui/react-toast`, `@radix-ui/react-tooltip` | Mantener por ahora por roadmap explícito de dashboard premium; decidir en PR de UI o cerrar como eliminación si se descarta el roadmap. |

---

## 5. Recomendación de PRs chicos

### PR-CLEAN7B · docs-only audit

**Recomendado como este cierre documental.**

- Documentar evidencia remanente P2-B.
- No modificar manifest, lockfile ni runtime.
- Dejar estrategia de eliminación/adopción explícita.

### PR-CLEAN7C · tooling ESLint

**Ejecutado el 2026-06-29 en la rama `clean/frontend-eslint-tooling-deps`.**

- Alcance único: `@eslint/eslintrc` y dependencia directa
  `@next/eslint-plugin-next`.
- Decisión `@eslint/eslintrc`: eliminado. `frontend/eslint.config.mjs` no usa
  `FlatCompat`, `corepack pnpm --dir frontend why @eslint/eslintrc` lo mostró
  como dependencia directa solamente y `lint` pasó antes de la remoción.
- Decisión `@next/eslint-plugin-next`: eliminada sólo la dependencia directa.
  `corepack pnpm --dir frontend why @next/eslint-plugin-next` mostró directa
  `16.2.7` y transitiva `16.2.9` vía `eslint-config-next@16.2.9`.
- Remoción aplicada con
  `corepack pnpm --dir frontend remove @eslint/eslintrc @next/eslint-plugin-next`.
- Se actualizó el contrato de tests que exigía `@eslint/eslintrc` y el helper
  histórico de CLEAN7A que preservaba ambas dependencias `UNKNOWN`.
- No se tocó Radix, runtime frontend/backend, DB, migraciones, workflows,
  Render, secrets ni `package.json` raíz.

### PR-CLEAN7D · Radix por grupos

**Estado:** ejecutado el 2026-06-29 en la rama
`clean/frontend-radix-unused-core`, base HEAD `a4582e4`.

Se elimino solo el grupo Radix clasificado como `SUSPECT unused`:
`@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`,
`@radix-ui/react-label`, `@radix-ui/react-select` y
`@radix-ui/react-tabs`.

La remocion se aplico con
`corepack pnpm --dir frontend remove @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select @radix-ui/react-tabs`,
regenerando `pnpm-lock.yaml`. `@radix-ui/react-toast` y
`@radix-ui/react-tooltip` permanecen declarados como `DEFER keep`.

No se mezclo con tooling ni se tocaron runtime frontend/backend, DB,
migraciones, workflows, Render, secrets, otras dependencias ni
`package.json` raiz.

**Referencia historica previa:** no mezclar con tooling.

Orden sugerido:

1. Eliminar sólo `avatar`, `dropdown-menu`, `label`, `select`, `tabs` si se
   confirma que no forman parte del estándar UI próximo.
2. Mantener `toast` y `tooltip` como `DEFER keep` hasta ejecutar o descartar el
   roadmap `docs/audit-premium-dashboard-interaction-value.md`.
3. Si se descarta ese roadmap, eliminar `toast` y `tooltip` en PR separado.
4. Si se adopta, crear `ui/toast.tsx` / `ui/tooltip.tsx` en un PR de UI con
   tests a11y, sin mezclar limpieza de manifest.

---

## 6. Riesgo residual

- Riesgo principal restante: `toast`/`tooltip` no estan vivos hoy, pero siguen
  diferidos por roadmap funcional explicito; su adopcion o remocion debe ser PR
  separado.
- El riesgo de tooling ESLint se cerró en PR-CLEAN7C con lint antes/después y
  validaciones completas.
- El grupo Radix `SUSPECT unused` ya fue removido en PR-CLEAN7D; los tests de
  contrato se ajustaron para exigir solo Radix activos o diferidos.

---

## 7. Estado final

- Auditoría P2-B remanente actualizada post-PR-CLEAN7D/#1178.
- Se eliminaron en PR-CLEAN7C sólo `@eslint/eslintrc` y la dependencia directa
  `@next/eslint-plugin-next`.
- PR-CLEAN7D elimino despues solo `avatar`, `dropdown-menu`, `label`, `select`
  y `tabs`; `toast`/`tooltip` siguen preservados.
- El tooling `UNKNOWN` queda resuelto; no queda paquete remanente P2-B en esa
  clasificación.
- Cierre documental dedicado:
  [`frontend-dependencies-cleanup-closeout.md`](frontend-dependencies-cleanup-closeout.md).
- No se tocó runtime frontend/backend, DB, migraciones, workflows, Render ni
  secrets.
- No commit, no push, no PR.
