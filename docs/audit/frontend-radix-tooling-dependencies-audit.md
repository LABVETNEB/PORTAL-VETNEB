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
| `@eslint/eslintrc` | Manifest/lock/test; 0 imports en `frontend/eslint.config.mjs`; `corepack pnpm --dir frontend why` lo muestra como dependencia directa solamente | Sin roadmap funcional; tooling | `UNKNOWN keep` |
| `@next/eslint-plugin-next` | Manifest/lock/helper; 0 import directo en config; `eslint-config-next@16.2.9` lo trae transitivamente como `16.2.9`; directa está fijada en `16.2.7` | Posible duplicado/version skew; tooling | `UNKNOWN keep` |

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
| `UNKNOWN keep` | `@eslint/eslintrc`, `@next/eslint-plugin-next` | Mantener hasta PR tooling dedicado que pruebe lint antes/después sin tocar runtime. |
| `DEFER keep por roadmap/estandarización UI` | `@radix-ui/react-toast`, `@radix-ui/react-tooltip` | Mantener por ahora por roadmap explícito de dashboard premium; decidir en PR de UI o cerrar como eliminación si se descarta el roadmap. |

---

## 5. Recomendación de PRs chicos

### PR-CLEAN7B · docs-only audit

**Recomendado como este cierre documental.**

- Documentar evidencia remanente P2-B.
- No modificar manifest, lockfile ni runtime.
- Dejar estrategia de eliminación/adopción explícita.

### PR-CLEAN7C · tooling ESLint

**Recomendado sólo si Nico autoriza cambio de dependencias.**

- Alcance único: `@eslint/eslintrc` y dependencia directa
  `@next/eslint-plugin-next`.
- Hipótesis: `@eslint/eslintrc` podría no ser necesario en flat config actual;
  `@next/eslint-plugin-next` directa parece duplicada por `eslint-config-next`,
  con version skew `16.2.7` vs `16.2.9`.
- Validación obligatoria: `pnpm --dir frontend lint` antes/después,
  `pnpm --dir frontend typecheck`, `pnpm --dir frontend build`, `pnpm test`.
- Si falla lint o resolución de config, revertir y cerrar como `UNKNOWN keep`.

### PR-CLEAN7D · Radix por grupos

**No mezclar con tooling.**

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

- Riesgo principal: `test/package-scripts-contract.test.ts` y guardrails de
  scope fijan que Radix y `UNKNOWN` existan; cualquier eliminación futura debe
  actualizar esos tests en el mismo PR.
- `@next/eslint-plugin-next` tiene duplicidad directa/transitiva; eliminar la
  directa puede ser correcto, pero debe probarse con lint real.
- `toast`/`tooltip` no están vivos hoy, pero sí tienen roadmap funcional
  explícito. Borrarlos sin decisión de producto puede crear churn.

---

## 7. Estado final

- Auditoría P2-B remanente completada.
- No se eliminó ninguna dependencia.
- No se modificó `frontend/package.json`.
- No se modificó `pnpm-lock.yaml`.
- No se tocó runtime frontend/backend, DB, migraciones, workflows, Render ni
  secrets.
- No commit, no push, no PR.
