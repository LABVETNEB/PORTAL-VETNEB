# Eliminación de artefactos históricos/orfanados (P3)

> **Modo:** cleanup acotado, sin runtime/dependencias/DB/migraciones/workflows.
> **Fecha:** 2026-06-29.
> **Rama:** `clean/remove-orphaned-historical-artifacts`.
> **HEAD base:** `90ef678 docs(notes): archive legacy todo architecture (#1182)`.
> **Documentos rectores:**
> [`docs/audit/final-repo-cleanup-engineering-audit.md`](../audit/final-repo-cleanup-engineering-audit.md)
> (P3-A/B/C) y
> [`docs/audit/final-cleanup-current-status-snapshot.md`](../audit/final-cleanup-current-status-snapshot.md).

## Alcance ejecutado

Se eliminaron los 3 artefactos P3 inventariados como históricos/orfanados:

- `legacy/drizzle-old/` (`README.md`, `big_zuras.sql`, `loving_boom_boom.sql`) —
  el propio README los declaraba "archaeology only" y fuera de la cadena de
  migración activa.
- `scripts/generate-pwa-icons.py` — 0 referencias en el repo; Python no forma
  parte del flujo operativo VETNEB.
- `scripts/maintenance/FUSION_POR_COMANDO.sh` — 0 referencias; operaba sobre
  `portal-vetneb-main.zip`/`portal-vetneb-dev-eficiencia.zip`, artefacto de una
  fusión histórica de repos que ya no aplica.

## Revalidación de referencias antes de eliminar

`git grep -n "legacy/drizzle-old\|drizzle-old\|generate-pwa-icons\|FUSION_POR_COMANDO\|portal-vetneb-main.zip\|dev-eficiencia" -- .`
solo encontró menciones dentro de documentación histórica/de auditoría
(`docs/audit/*.md`) que narran hallazgos y cierres ya pasados — ninguna en
`server/`, `frontend/`, `drizzle/migrations/`, `drizzle/meta/`,
`.github/workflows/` ni `package.json`. Esas menciones documentales no se
reescriben (no se altera historia), salvo en los dos documentos rectores
indicados arriba, actualizados para reflejar el cierre de P3.

`.cursorignore:105` tiene la entrada `legacy/` (ignora la carpeta para
tooling); se deja intacta porque no referencia un path inexistente de forma
problemática y no es parte del alcance de esta limpieza.

## Qué no se tocó

- `drizzle/migrations/` y `drizzle/meta/` (cadena de migración activa).
- Runtime frontend/backend.
- `package.json` (raíz y frontend) y `pnpm-lock.yaml`.
- DB activa.
- `.github/workflows/`.
- Render y secretos.
- Ningún otro documento de auditoría salvo los dos rectores citados.

## Archivos modificados/eliminados

- Eliminados: `legacy/drizzle-old/README.md`, `legacy/drizzle-old/big_zuras.sql`,
  `legacy/drizzle-old/loving_boom_boom.sql`,
  `scripts/generate-pwa-icons.py`,
  `scripts/maintenance/FUSION_POR_COMANDO.sh`.
- Modificados: `docs/audit/final-repo-cleanup-engineering-audit.md`,
  `docs/audit/final-cleanup-current-status-snapshot.md`.
- Creado: este documento.

## Validación

`pnpm typecheck`, `pnpm typecheck:test`, `pnpm test`, `pnpm build`,
`pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`,
`pnpm --dir frontend build` y `git diff --check` ejecutados tras la
eliminación; ningún test referenciaba los paths eliminados (no son artefactos
de contrato).

## Rollback

`git revert` del commit de esta limpieza restaura los 3 artefactos sin efecto
en runtime, dependencias, DB ni migraciones.

## Estado de entrega

Sin commit, sin push, sin PR. Cambios en working tree para revisión.
