# Snapshot de estado actual · limpieza final del repositorio

> **Modo:** docs-only.
> **Fecha:** 2026-06-29.
> **Rama:** `docs/final-cleanup-status-normalization`.
> **HEAD base:** `b143cbe docs(audit): close frontend dependencies cleanup (#1179)`.
> **Documento rector:** `docs/audit/final-repo-cleanup-engineering-audit.md`.

---

## Estado base

- Working tree inicial: limpio.
- Rama esperada: `docs/final-cleanup-status-normalization`.
- HEAD esperado: `b143cbe docs(audit): close frontend dependencies cleanup (#1179)`.
- Modo: documentación solamente.

## Scope incluido

- Separar deuda activa de bloques ya cerrados en el documento rector.
- Marcar P1-B como cerrado por #1162.
- Marcar P2-A `shared/` como cerrado por #1173.
- Marcar P2-B dependencias frontend como cerrado por #1175-#1179.
- Mantener trazabilidad histórica sin que las tablas recomienden PRs ya ejecutados.

## Scope excluido

- No se tocó `frontend/package.json`.
- No se tocó `pnpm-lock.yaml`.
- No se tocó `package.json` raíz.
- No se tocó runtime frontend/backend.
- No se tocaron tests, DB, migraciones, workflows, Render ni secrets.
- No commit, no push, no PR.

## Bloques cerrados

| Bloque | Estado actual | Evidencia |
| --- | --- | --- |
| P1-A CORS | Cerrado | #1164, #1165, #1166, #1167, #1168, #1169, #1170 |
| P1-B email public URL | Cerrado | #1162, `PUBLIC_SITE_URL` explícita con fallback conservador |
| P2-A `shared/` | Cerrado | #1173, eliminado `shared/` y `test/shared-const-and-errors.test.ts` |
| P2-B frontend dependencies | Cerrado | #1175, #1176, #1177, #1178, #1179 |
| Tooling `UNKNOWN` frontend | Cerrado | #1177 |
| Radix PR-CLEAN7D | Cerrado | #1178 |

## Pendientes reales

| Id | Pendiente | Estado |
| --- | --- | --- |
| P2-C | `docs/notes/todo.md` contradictorio | Pendiente |
| P2-D | Taxonomía documental fragmentada | Pendiente |
| P2-E | Logger/console observability | Pendiente |
| P2-F | Env vars no documentadas (`APP_VERSION`, `CLIENT_MIN_VERSION`, `NEXT_PUBLIC_APP_VERSION`) | Pendiente |
| P3 | Artefactos históricos/orfanados (`legacy/drizzle-old/`, `scripts/generate-pwa-icons.py`, `scripts/maintenance/FUSION_POR_COMANDO.sh`) | Pendiente |
| P3-G | `backend-ci.yml` `paths-ignore` opcional | Pendiente opcional |

## Dependencias diferidas

- `@radix-ui/react-toast`: `DEFER keep` por roadmap/UI.
- `@radix-ui/react-tooltip`: `DEFER keep` por roadmap/UI.

Estas dependencias no se clasifican como deuda activa accidental en este corte.

## Riesgo residual

- Bajo y documental: el riesgo principal era que el rector siguiera induciendo a
  ejecutar PRs ya cerrados.
- Cualquier cambio futuro sobre pendientes reales debe abrir PR dedicado y
  mantener el protocolo de validación del repo.

## Estado final

- Snapshot creado para lectura rápida del estado vigente.
- Scope docs-only respetado.
- Sin commit, push ni PR.
