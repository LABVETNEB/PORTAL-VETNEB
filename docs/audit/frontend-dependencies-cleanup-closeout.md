# Cierre P2-B · frontend dependencies cleanup

> **Modo:** cierre documental / docs-only.
> **Fecha:** 2026-06-29.
> **Base esperada:** rama `docs/closeout-frontend-deps-cleanup`, HEAD
> `327253e chore(frontend): remove unused radix core deps (#1178)`.
> **Scope:** cerrar documentalmente el bloque P2-B posterior a PR-CLEAN7A,
> PR-CLEAN7B, PR-CLEAN7C y PR-CLEAN7D.

---

## 1. Estado base

| Item | Estado |
| --- | --- |
| Repo | `C:\PORTAL-VETNEB` |
| Rama esperada | `docs/closeout-frontend-deps-cleanup` |
| HEAD esperado | `327253e chore(frontend): remove unused radix core deps (#1178)` |
| Working tree inicial | limpio |
| Modo | docs-only |

Documentos rectores:

- `docs/audit/final-repo-cleanup-engineering-audit.md`
- `docs/audit/frontend-dependencies-usage-audit.md`
- `docs/audit/frontend-radix-tooling-dependencies-audit.md`
- `docs/implementation/frontend-unused-deps-clean7a.md`
- `docs/implementation/frontend-eslint-tooling-clean7c.md`
- `docs/implementation/frontend-radix-clean7d.md`

---

## 2. Scope incluido

- Cerrar documentalmente P2-B como bloque completado por PR-CLEAN7A/#1175,
  PR-CLEAN7B/#1176, PR-CLEAN7C/#1177 y PR-CLEAN7D/#1178.
- Actualizar los documentos rectores de auditoría para reflejar el estado
  posterior a #1178.
- Crear este documento de closeout dedicado.
- Registrar dependencias removidas, dependencias diferidas, cierre de tooling
  `UNKNOWN` y exclusiones de runtime/API/backend/DB/workflows.

---

## 3. Scope excluido

- No tocar `frontend/package.json`.
- No tocar `pnpm-lock.yaml`.
- No tocar `package.json` raíz.
- No tocar runtime frontend.
- No tocar runtime backend ni API.
- No tocar tests.
- No tocar DB, Drizzle ni migraciones.
- No tocar workflows, Render ni secrets.
- No hacer commit, push ni PR.

---

## 4. Auditoría previa

- PR-CLEAN7A/#1175 cerró el grupo core sin imports reales:
  `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
  `echarts-for-react` y `react-hook-form`.
- PR-CLEAN7B/#1176 auditó docs-only el remanente Radix/tooling y confirmó 0
  imports reales `from`/`require()`/`import()` para los paquetes auditados.
- PR-CLEAN7C/#1177 cerró el remanente tooling `UNKNOWN`:
  `@eslint/eslintrc` fue removido por ausencia de `FlatCompat`/uso directo, y
  la dependencia directa `@next/eslint-plugin-next` fue removida porque
  `eslint-config-next` mantiene el plugin como transitivo.
- PR-CLEAN7D/#1178 removió el grupo Radix `SUSPECT unused`:
  `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-label`, `@radix-ui/react-select` y
  `@radix-ui/react-tabs`.
- `@radix-ui/react-toast` y `@radix-ui/react-tooltip` permanecen declarados de
  forma intencional como `DEFER keep` por roadmap/estandarización UI.

---

## 5. Cambios documentales

- `docs/audit/final-repo-cleanup-engineering-audit.md`: P2-B pasa a estado
  cerrado post-#1178, con referencia a este closeout.
- `docs/audit/frontend-dependencies-usage-audit.md`: se agrega cierre final
  del bloque P2-B y se vincula este documento.
- `docs/audit/frontend-radix-tooling-dependencies-audit.md`: se actualiza el
  estado final para reflejar cierre post-PR-CLEAN7D/#1178.
- `docs/audit/frontend-dependencies-cleanup-closeout.md`: nuevo documento de
  cierre documental.

---

## 6. Resultado

P2-B queda cerrado documentalmente.

Dependencias removidas por el bloque:

- PR-CLEAN7A/#1175:
  `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
  `echarts-for-react`, `react-hook-form`.
- PR-CLEAN7C/#1177:
  `@eslint/eslintrc`, dependencia directa `@next/eslint-plugin-next`.
- PR-CLEAN7D/#1178:
  `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-label`, `@radix-ui/react-select`,
  `@radix-ui/react-tabs`.

Dependencias diferidas:

- `@radix-ui/react-toast`: diferida por roadmap/estandarización UI de
  notificaciones/toast.
- `@radix-ui/react-tooltip`: diferida por roadmap/estandarización UI de
  ayudas contextuales/tooltip.

El estado `UNKNOWN` tooling queda resuelto por PR-CLEAN7C. No queda paquete
P2-B clasificado como `UNKNOWN`.

---

## 7. Riesgo residual

- Riesgo residual bajo y documental: `toast`/`tooltip` no tienen uso runtime
  actual, pero se preservan intencionalmente por roadmap/UI. Su adopción o
  remoción debe ocurrir en PR separado y explícito.
- Este closeout no modifica manifests, lockfiles, runtime, API, backend, DB,
  migraciones, workflows, Render ni secrets.

---

## 8. Estado final

- Bloque P2-B cerrado documentalmente.
- Scope docs-only respetado.
- Sin commit.
- Sin push.
- Sin PR.
