# Auditoría de uso de dependencias frontend

> **Modo:** AUDITORÍA DOCUMENTAL / docs-only.
> **Fecha:** 2026-06-29.
> **Scope:** inventariar `frontend/package.json` y clasificar uso real de
> `dependencies` y `devDependencies`.
> **No se modificó:** `frontend/package.json`, `pnpm-lock.yaml`, runtime
> frontend, runtime backend, DB, migraciones, workflows, Render ni secrets.

---

## 1. Estado base

| Ítem | Observado |
| --- | --- |
| Repo | `C:\PORTAL-VETNEB` |
| Rama | `audit/frontend-dependencies-usage` |
| HEAD | `d958c63 refactor(cleanup): remove dead shared module (#1173)` |
| Working tree antes de editar docs | limpio |
| Documento rector | `docs/audit/final-repo-cleanup-engineering-audit.md` |

`frontend/package.json` declara 25 `dependencies` y 12 `devDependencies`.
La app frontend real es Next.js App Router en `frontend/src`; no existen
`frontend/app`, `frontend/components`, `frontend/lib` ni
`frontend/test/tests` en la raíz. Sí existe `frontend/e2e`, incluido como
superficie de test/tooling Playwright.

---

## 2. Método reproducible

Comandos usados por paquete, ajustando `<package-name>`:

```powershell
git grep -n "<package-name>" -- frontend test scripts docs package.json frontend/package.json
git grep -n "from ['\"]<package-name>"
git grep -n "from ['\"]@scope/package"
git grep -n "require(['\"]<package-name>"
git grep -n "import(.*<package-name>"
rg -n "<package-name>|from ['\"]<package-name>|require\\(['\"]<package-name>" frontend test scripts docs
```

Lectura aplicada:

- `frontend/package.json` prueba declaración, no uso.
- `test/package-scripts-contract.test.ts` prueba contrato de manifest, no uso
  runtime. Si se elimina una dependencia, ese test deberá actualizarse en el PR
  de eliminación.
- `docs/**` se considera referencia histórica o recomendación, no uso runtime.
- Imports de `frontend/src` clasifican como `LIVE runtime`.
- Imports/configs de `frontend/*.config.*`, `frontend/tsconfig.json`,
  `frontend/e2e` y scripts npm clasifican como `LIVE build/config/tooling` o
  `LIVE tests`.
- Paquetes cargados por convención de Next/React/Tailwind/PostCSS/TypeScript se
  clasifican como tooling aunque no tengan un import directo por nombre.

---

## 3. Inventario y clasificación

### dependencies

| Paquete | Clasificación | Evidencia principal | Nota |
| --- | --- | --- | --- |
| `@radix-ui/react-avatar` | SUSPECT unused | Solo `frontend/package.json` y `test/package-scripts-contract.test.ts` | Sin import directo ni componente local `Avatar`; confirmado post-PR-CLEAN7A. |
| `@radix-ui/react-dialog` | LIVE runtime | `frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx:4`; `frontend/src/components/dashboard/ModuleDialog.tsx:4` | Usado para drawer/dialog. |
| `@radix-ui/react-dropdown-menu` | SUSPECT unused | Solo manifest/test de manifest; docs históricas | Sin import directo. |
| `@radix-ui/react-label` | SUSPECT unused | Solo manifest/test de manifest | Sin import directo. |
| `@radix-ui/react-select` | SUSPECT unused | Solo manifest/test de manifest | Sin import directo. |
| `@radix-ui/react-separator` | LIVE runtime | `frontend/src/components/ui/separator.tsx:4` | Primitiva UI usada. |
| `@radix-ui/react-slot` | LIVE runtime | `frontend/src/components/ui/button.tsx:2` | Primitiva `Button asChild`. |
| `@radix-ui/react-tabs` | SUSPECT unused | Solo manifest/test de manifest | El dashboard usa `ModuleTabs` propio, no Radix Tabs. |
| `@radix-ui/react-toast` | DEFER keep por roadmap/estandarización UI | Solo manifest/test de manifest; docs proponen adoptarlo | No hay provider/componente toast runtime, pero hay roadmap explícito en `docs/audit-premium-dashboard-interaction-value.md`. |
| `@radix-ui/react-tooltip` | DEFER keep por roadmap/estandarización UI | Solo manifest/test de manifest; docs proponen adoptarlo | No hay provider/componente tooltip runtime, pero hay roadmap explícito en `docs/audit-premium-dashboard-interaction-value.md`. |
| `@tanstack/react-query` | SUSPECT unused | Solo manifest/test de manifest y docs históricas | Sin `QueryClient`, `useQuery`, `useMutation` ni imports. |
| `@tanstack/react-table` | SUSPECT unused | Tests verifican que no se importe; manifest/test de manifest | Sin `useReactTable`; guardrails lo prohíben en layout/públicas. |
| `class-variance-authority` | LIVE runtime | `frontend/src/components/ui/badge.tsx:2`; `frontend/src/components/ui/button.tsx:3` | Usado por variantes UI. |
| `clsx` | LIVE runtime | `frontend/src/lib/utils.ts:1` | Usado por `cn()`. |
| `echarts` | SUSPECT unused | Tests verifican que no se importe; manifest/test de manifest; docs históricas | Paquete pesado; sin import runtime. |
| `echarts-for-react` | SUSPECT unused | Solo manifest/test de manifest y docs históricas | Sin wrapper React en runtime. |
| `gsap` | LIVE runtime | `frontend/src/components/public/PublicScrollReveal.tsx:113-114` | Carga dinámica `import("gsap")` y `import("gsap/ScrollTrigger")`. |
| `lucide-react` | LIVE runtime | 80+ imports en `frontend/src`, ej. `ClinicCommandCenter.tsx:9` | Librería de iconos activa. |
| `next` | LIVE runtime/build | `frontend/next.config.ts:1`; múltiples `Metadata`/`next/*` en `frontend/src` | Framework principal. |
| `react` | LIVE runtime | múltiples imports de hooks en `frontend/src`; JSX runtime configurado | Framework principal. |
| `react-dom` | LIVE runtime | `DashboardNotificationsBell.tsx:3`; `UploadReportModal.tsx:4` | `createPortal`. |
| `react-hook-form` | SUSPECT unused | Solo manifest/test de manifest y guard de home sin formulario | Formularios actuales usan estado/control propio. |
| `tailwind-merge` | LIVE runtime | `frontend/src/lib/utils.ts:2` | Usado por `cn()`. |
| `tailwindcss-animate` | LIVE build/config/tooling | `frontend/tailwind.config.ts:85` | Plugin Tailwind activo. |
| `zod` | LIVE tests / workspace context | `test/api-contract-smoke.test.ts:4`; `test/production-env-contracts.test.ts:5` | En `frontend/package.json`, pero el uso detectado está en tests raíz. Requiere cuidado antes de mover/eliminar. |

### devDependencies

| Paquete | Clasificación | Evidencia principal | Nota |
| --- | --- | --- | --- |
| `@eslint/eslintrc` | UNKNOWN keep | `corepack pnpm --dir frontend why` muestra dependencia directa solamente | No hay import directo en `eslint.config.mjs`; validar con PR tooling dedicado si se quiere remover. |
| `@next/eslint-plugin-next` | UNKNOWN keep | Directa `16.2.7` y transitiva `16.2.9` vía `eslint-config-next` | Posible duplicado/version skew; no tocar sin lint verde. |
| `@playwright/test` | LIVE tests | 70+ imports en `frontend/e2e/*.spec.ts`; `frontend/playwright.config.ts:1` | Tooling E2E activo. |
| `@tailwindcss/postcss` | LIVE build/config/tooling | `frontend/postcss.config.mjs:4` | Plugin PostCSS de Tailwind 4. |
| `@types/node` | LIVE build/config/tooling | TS/config usa APIs Node en configs (`createRequire`, `process`) | Tipos necesarios para configs y e2e. |
| `@types/react` | LIVE build/config/tooling | React 19 + TSX | Tipos React. |
| `@types/react-dom` | LIVE build/config/tooling | `react-dom` + TS | Tipos `react-dom`. |
| `eslint` | LIVE build/config/tooling | Script `lint`; `frontend/eslint.config.mjs` | Tooling lint. |
| `eslint-config-next` | LIVE build/config/tooling | `frontend/eslint.config.mjs:2` | Config Next usada directamente. |
| `postcss` | LIVE build/config/tooling | `frontend/postcss.config.mjs` | Loader/config PostCSS. |
| `tailwindcss` | LIVE build/config/tooling | `frontend/src/app/globals.css:1`; `frontend/tailwind.config.ts:2` | Tailwind 4 activo. |
| `typescript` | LIVE build/config/tooling | Script `typecheck`; `frontend/tsconfig.json` | Tooling TS. |

---

## 4. Evidencia grep por grupo

### LIVE runtime

```text
git grep -n -F '@radix-ui/react-dialog' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx:4
-> frontend/src/components/dashboard/ModuleDialog.tsx:4

git grep -n -F '@radix-ui/react-separator' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/components/ui/separator.tsx:4

git grep -n -F '@radix-ui/react-slot' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/components/ui/button.tsx:2

git grep -n -F 'class-variance-authority' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/components/ui/badge.tsx:2
-> frontend/src/components/ui/button.tsx:3

git grep -n -F 'clsx' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/lib/utils.ts:1

git grep -n -F 'import("gsap"' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/components/public/PublicScrollReveal.tsx:113

git grep -n -F 'import("gsap/ScrollTrigger"' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/components/public/PublicScrollReveal.tsx:114

git grep -n -F 'lucide-react' -- frontend test scripts docs package.json frontend/package.json
-> 80+ imports en frontend/src

git grep -n -F 'react-dom' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/components/dashboard/DashboardNotificationsBell.tsx:3
-> frontend/src/components/dashboard/UploadReportModal.tsx:4

git grep -n -F 'tailwind-merge' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/lib/utils.ts:2
```

### LIVE build/config/tooling/tests

```text
git grep -n -F 'next' -- frontend test scripts docs package.json frontend/package.json
-> frontend/next.config.ts:1
-> múltiples imports type/runtime `next` y `next/*` en frontend/src

git grep -n -F '@playwright/test' -- frontend test scripts docs package.json frontend/package.json
-> frontend/playwright.config.ts:1
-> 70+ imports en frontend/e2e

git grep -n -F '@tailwindcss/postcss' -- frontend test scripts docs package.json frontend/package.json
-> frontend/postcss.config.mjs:4

git grep -n -F 'tailwindcss-animate' -- frontend test scripts docs package.json frontend/package.json
-> frontend/tailwind.config.ts:85

git grep -n -F 'eslint-config-next' -- frontend test scripts docs package.json frontend/package.json
-> frontend/eslint.config.mjs:2

git grep -n -F 'tailwindcss' -- frontend test scripts docs package.json frontend/package.json
-> frontend/src/app/globals.css:1
-> frontend/tailwind.config.ts:2
```

### SUSPECT unused

```text
git grep -n -F '@tanstack/react-query' -- frontend test scripts docs package.json frontend/package.json
-> frontend/package.json:32
-> test/package-scripts-contract.test.ts:117
-> docs históricas/auditoría; 0 imports runtime/config

git grep -n -F '@tanstack/react-table' -- frontend test scripts docs package.json frontend/package.json
-> frontend/package.json:33
-> test/frontend-extreme-speed-guardrails.test.ts:141,155-158 (guard de no-import)
-> test/package-scripts-contract.test.ts:118
-> docs históricas/auditoría; 0 imports runtime/config

git grep -n -F 'echarts' -- frontend test scripts docs package.json frontend/package.json
-> frontend/package.json:36-37
-> test/frontend-extreme-speed-guardrails.test.ts:118,134,141,150
-> test/package-scripts-contract.test.ts:141-142
-> docs históricas/auditoría; 0 imports runtime/config

git grep -n -F 'react-hook-form' -- frontend test scripts docs package.json frontend/package.json
-> frontend/package.json:43
-> test/frontend-home-page-content.test.ts:467 (guard de ausencia en CTA)
-> test/package-scripts-contract.test.ts:119
-> docs históricas/auditoría; 0 imports runtime/config

git grep -n -F '@radix-ui/react-tooltip' -- frontend test scripts docs package.json frontend/package.json
-> frontend/package.json:31
-> test/package-scripts-contract.test.ts:140
-> docs proponen adoptarlo; 0 imports runtime/config
```

Radix adicionales con la misma señal:

```text
@radix-ui/react-avatar        -> solo frontend/package.json + test/package-scripts-contract.test.ts
@radix-ui/react-dropdown-menu -> solo frontend/package.json + test/package-scripts-contract.test.ts + doc histórico
@radix-ui/react-label         -> solo frontend/package.json + test/package-scripts-contract.test.ts
@radix-ui/react-select        -> solo frontend/package.json + test/package-scripts-contract.test.ts
@radix-ui/react-tabs          -> solo frontend/package.json + test/package-scripts-contract.test.ts
@radix-ui/react-toast         -> solo frontend/package.json + test/package-scripts-contract.test.ts + doc de adopción futura
```

### UNKNOWN

```text
pnpm --dir frontend why @eslint/eslintrc
-> dependencia directa solamente; sin import directo en frontend/eslint.config.mjs

pnpm --dir frontend why @next/eslint-plugin-next
-> directa 16.2.7 y transitiva 16.2.9 por eslint-config-next
```

Interpretación: ambos son candidatos de auditoría de tooling, no de eliminación
junto con runtime deps. `@next/eslint-plugin-next` muestra posible duplicado,
pero remover la directa puede depender de cómo resuelva ESLint/Next el plugin.

---

## 5. Candidatos a eliminación

No se recomienda eliminación masiva. La lista siguiente es documental y requiere
PRs chicos, con `package.json` + lockfile + tests ajustados sólo en el PR de
eliminación.

| Grupo | Paquetes | Riesgo | Validación mínima |
| --- | --- | --- | --- |
| Charts/table/query/forms | `@tanstack/react-query`, `@tanstack/react-table`, `echarts`, `echarts-for-react`, `react-hook-form` | Medio: cambio en manifest/lock y test de contrato; `echarts` pesado pero no importado | `pnpm install`; `pnpm --dir frontend lint`; `pnpm --dir frontend typecheck`; `pnpm --dir frontend build`; E2E frontend relevante |
| Radix no usados | `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-tooltip` | Medio-bajo: posible roadmap UX pendiente; test de contrato debe actualizarse | Mismas validaciones + revisar docs/roadmap antes de borrar |
| Tooling ESLint | `@eslint/eslintrc`, directa `@next/eslint-plugin-next` | Medio: puede romper `pnpm --dir frontend lint` por resolución de plugin/config | PR separado, sólo tooling; lint antes/después |

`zod` queda fuera de candidatos por ahora: está en el manifest frontend, pero el
uso detectado está en tests raíz (`api-contract-smoke`, `production-env-contracts`).
Antes de moverlo/removerlo hay que revisar si debe vivir en root, frontend o ambos.

---

## 6. Recomendación concreta para el siguiente PR

> **Actualización 2026-06-29:** PR-CLEAN7A ya fue ejecutado y mergeado como
> `1ac86d0 chore(frontend): remove unused core dependencies (#1175)`. El
> remanente P2-B queda auditado en
> [`frontend-radix-tooling-dependencies-audit.md`](frontend-radix-tooling-dependencies-audit.md).

Siguiente PR recomendado originalmente: **PR-CLEAN7A · frontend deps pesadas sin
uso**.

Alcance propuesto:

- Remover sólo `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
  `echarts-for-react` y `react-hook-form`.
- Actualizar `test/package-scripts-contract.test.ts` para que deje de exigir
  esos paquetes.
- Regenerar `pnpm-lock.yaml`.
- No tocar Radix, ESLint tooling, runtime frontend, backend, DB, migraciones ni
  workflows en ese PR.

Motivo: es el grupo más claro, con evidencia reiterada en auditorías previas,
guardrails explícitos de no-import para `echarts`/`react-table` y bajo riesgo de
UX inmediato. Radix conviene tratarlo después porque hay documentos que proponen
adoptar `toast`/`tooltip`.

Recomendación post-PR-CLEAN7A:

- **PR-CLEAN7B:** docs-only audit del remanente Radix/tooling; no tocar
  manifests ni runtime.
- **PR-CLEAN7C:** tooling ESLint únicamente (`@eslint/eslintrc` y directa
  `@next/eslint-plugin-next`), si Nico autoriza cambio de dependencias y con
  `pnpm --dir frontend lint` antes/después.
- **PR-CLEAN7D:** Radix por grupos. Candidatos `SUSPECT unused`:
  `avatar`, `dropdown-menu`, `label`, `select`, `tabs`. Mantener
  `toast`/`tooltip` como `DEFER keep` mientras siga vigente el roadmap de
  dashboard premium.

---

## 7. Estado final de esta auditoría

- Auditoría docs-only completada.
- Candidatos documentados; no se removió ninguna dependencia.
- `frontend/package.json` y `pnpm-lock.yaml` permanecen sin cambios.
- No commit, no push, no PR.

## 8. Nota final PR-CLEAN7A

**Estado:** ejecutado el 2026-06-29 en la rama
`clean/remove-unused-frontend-deps-core`, base HEAD `2140f28`.

Se eliminó únicamente el grupo charts/table/query/forms clasificado como
`SUSPECT unused`: `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
`echarts-for-react` y `react-hook-form`. La remoción se aplicó con
`corepack pnpm --dir frontend remove @tanstack/react-query @tanstack/react-table echarts echarts-for-react react-hook-form`,
después de que `pnpm --dir frontend remove ...` fallara localmente por
`ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF`.

Cambios de alcance PR-CLEAN7A:

- `frontend/package.json`: removidas sólo las 5 dependencias indicadas.
- `pnpm-lock.yaml`: lockfile regenerado por pnpm.
- `test/package-scripts-contract.test.ts`: removidas sólo las aserciones que
  exigían esas 5 dependencias.
- No se tocaron Radix, dependencias `UNKNOWN`, runtime frontend/backend, DB,
  migraciones, workflows, Render ni secrets.

## 9. Nota final PR-CLEAN7B

**Estado:** auditoría docs-only completada el 2026-06-29 en la rama
`audit/frontend-dependencies-radix-tooling`, base HEAD `1ac86d0`.

Documento dedicado:
[`docs/audit/frontend-radix-tooling-dependencies-audit.md`](frontend-radix-tooling-dependencies-audit.md).

Clasificación remanente:

- `SUSPECT unused`: `@radix-ui/react-avatar`,
  `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`,
  `@radix-ui/react-select`, `@radix-ui/react-tabs`.
- `DEFER keep por roadmap/estandarización UI`: `@radix-ui/react-toast`,
  `@radix-ui/react-tooltip`.
- `UNKNOWN keep`: `@eslint/eslintrc`, `@next/eslint-plugin-next`.

No se modificaron `frontend/package.json`, `pnpm-lock.yaml`, runtime
frontend/backend, DB, migraciones, workflows, Render ni secrets.
