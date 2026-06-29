# Closeout · auditoría final de limpieza del repositorio

> **Modo:** docs-only.
> **Fecha:** 2026-06-29.
> **Rama:** `docs/final-repo-cleanup-closeout`.
> **HEAD base:** `40f4524 docs(audit): close documentation taxonomy cleanup (#1186)`.
> **Documento rector:** [`final-repo-cleanup-engineering-audit.md`](final-repo-cleanup-engineering-audit.md).
> **Snapshot vigente:** [`final-cleanup-current-status-snapshot.md`](final-cleanup-current-status-snapshot.md).

---

## 1. Propósito

Cerrar documentalmente la auditoría final extrema del repositorio iniciada en
`#1160` (`docs(audit): add final repo cleanup engineering audit`). Este
documento no abre nuevos bloques, no cambia runtime y confirma que todos los
hallazgos P1/P2/P3 del documento rector quedaron cerrados, o documentados
explícitamente como deuda no bloqueante.

## 2. Base verificada

| Ítem | Valor | OK |
| --- | --- | --- |
| Rama | `docs/final-repo-cleanup-closeout` | ✅ |
| HEAD | `40f4524 docs(audit): close documentation taxonomy cleanup (#1186)` | ✅ |
| `git status --short --untracked-files=all` | limpio | ✅ |
| PRs abiertos (`gh pr list --state open`) | 0 | ✅ |

## 3. PRs de cierre relevantes (#1160–#1186), resumidos por bloque

| Bloque | PRs | Resumen |
| --- | --- | --- |
| Auditoría inicial | #1160 | Documento rector original (`final-repo-cleanup-engineering-audit.md`), modo auditoría/propuesta, sin cambios. |
| Dominio/env (P2-F parcial) | #1161 | Aclaró referencias de dominio productivo en docs. |
| P1-B email URL | #1162 | `fix(email): use explicit public site url for portal links` — introduce `PUBLIC_SITE_URL` con fallback a `CORS_ORIGIN`. **Cerrado.** |
| P2-D taxonomía | #1163 | `docs: consolidate historical documentation structure` — unifica `audit/`+`audits/`, consolida notas de implementación, recolecta `pr-*.md` sueltos. **Cerrado.** |
| P1-A CORS (fases) | #1164, #1165, #1166, #1167, #1168 | PR-CORS1 (admin), PR-CORS2 (públicas/particulares seguras), PR-CORS3A (auth), PR-CORS3B (logística real), PR-CORS3C (block-null study-tracking). Migran rutas al helper compartido `server/lib/cors-headers.ts` sin alterar contrato. **Cerrado por fases.** |
| P1-A cierre documental | #1169 | Cierre documental post-#1168; inventaría `logistics-sla` como residual GET-only. |
| P1-A residual | #1170 | `refactor(cors): share helper in logistics sla route` — resuelve el residual `logistics-sla.fastify.ts`. **P1-A cerrado por completo.** |
| P1-A snapshot | #1171 | Actualiza snapshot post-cierre CORS. |
| P2-A `shared/` | #1172, #1173 | Auditoría de uso + `refactor(cleanup): remove dead shared module` — elimina `shared/` y su test. **Cerrado.** |
| P2-B deps frontend | #1174, #1175, #1176, #1177, #1178, #1179 | Auditoría de dependencias + PR-CLEAN7A (core sin uso) + auditoría Radix/tooling + PR-CLEAN7C (tooling ESLint) + PR-CLEAN7D (Radix `SUSPECT unused`) + cierre documental. `toast`/`tooltip` quedan `DEFER keep` por roadmap. **Cerrado.** |
| Normalización de estado | #1180 | `docs(audit): normalize final cleanup status` — separa deuda activa de bloques ya cerrados en el documento rector. |
| P2-F env vars | #1181 | `docs(env): document version gate env examples` — documenta `APP_VERSION`/`CLIENT_MIN_VERSION`/`NEXT_PUBLIC_APP_VERSION`. **Cerrado.** |
| P2-C `todo.md` | #1182 | `docs(notes): archive legacy todo architecture` — archiva histórico tRPC/Google Sheets en `docs/archive/legacy-trpc-sheets-todo.md`. **Cerrado.** |
| P3 artefactos | #1183 | `chore(cleanup): remove orphaned historical artifacts` — elimina `legacy/drizzle-old/`, `scripts/generate-pwa-icons.py`, `scripts/maintenance/FUSION_POR_COMANDO.sh`. **Cerrado.** |
| P3-G CI paths-ignore | #1184 | `ci(backend): skip docs-only pull requests` — agrega `paths-ignore` al trigger `pull_request` de `backend-ci.yml`. **Cerrado.** |
| P2-E observability | #1185 | `docs(audit): document backend observability debt` — auditoría completa de `console.*`/logger; deuda moderada documentada, no bloqueante. **Cerrado documentalmente.** |
| P2-D re-verificación | #1186 | `docs(audit): close documentation taxonomy cleanup` — re-confirma que la taxonomía consolidada por #1163 sigue vigente en disco. **Cerrado.** |

## 4. Estado final de hallazgos

- **P0:** ninguno detectado en ningún corte de esta auditoría.
- **P1 (P1-A CORS, P1-B email URL):** sin P1 activo. Ambos cerrados (`#1162`,
  `#1164`–`#1170`).
- **P2 (P2-A, P2-B, P2-C, P2-D, P2-E, P2-F):** sin P2 activo pendiente de
  cleanup final. Todos cerrados (`#1162` no aplica aquí; ver `#1163`, `#1173`,
  `#1175`-`#1179`, `#1181`, `#1182`, `#1185`, `#1186`). P2-E queda como
  **deuda moderada documentada, no bloqueante** (ver §5).
- **P3 (artefactos históricos, P3-G):** sin P3 activo pendiente de cleanup
  final. Cerrados por `#1183` y `#1184`.

No queda ningún hallazgo del documento rector marcado como pendiente de
ejecución dentro del alcance de esta auditoría.

## 5. Riesgos residuales explícitos

- **P2-E observability:** `server/lib/logger.ts` sigue siendo un wrapper
  mínimo de `console` y persisten 56 `console.*` en `server/` mezclados con
  `logInfo/logWarn/logError`. Auditado en
  [`backend-observability-logger-console-audit.md`](backend-observability-logger-console-audit.md):
  sin fuga de secretos/tokens, con un subgrupo de 4 puntos de riesgo moderado
  que loguean el objeto `error` completo. **Deuda moderada futura, no
  blocker.** Cualquier unificación a logger con niveles es trabajo opcional
  posterior, fuera de este cierre.
- **`public-professionals` CORS:** mantiene contrato, mensaje
  (`"Origin no permitido"`) y headers propios, fuera del helper compartido
  `server/lib/cors-headers.ts` por decisión explícita de diseño. **Excepción
  contractual documentada, no deuda activa general** del bloque P1-A. No debe
  incorporarse al helper general sin un PR dedicado de contrato.
- **PR-CLEAN4 (www/CORS topology):** investigación reservada y no ejecutada
  sobre si `CORS_ORIGIN` debe incluir `www.vetneb.com.ar`. Fuera del alcance
  P1-P3 de este cierre; no es deuda activa de cleanup, queda como decisión de
  topología a futuro si los hosts reales lo requieren.
- **`@radix-ui/react-toast` / `@radix-ui/react-tooltip`:** diferidas
  intencionalmente por roadmap/UI (`DEFER keep`), no deuda activa accidental.

## 6. Confirmación de scope

- Este cierre es **docs-only**: no se tocó runtime frontend, runtime backend,
  tests, `package.json`, `pnpm-lock.yaml`, workflows, DB/migraciones, ni
  configuración de Render/secrets.
- No se movieron ni borraron archivos.
- No commit, no push, no PR generados por esta tarea de cierre.

## 7. Checklist final de repositorio

- [ ] `main` limpio esperado post-merge de este PR de cierre.
- [ ] PRs abiertos: 0 esperado post-merge.
- [ ] Ramas locales: solo `main` esperado post-merge (limpieza de ramas de
  trabajo `docs/*`, `clean/*`, `audit/*`, `ci/*` ya mergeadas).
- [x] Working tree limpio verificado en este corte (`docs/final-repo-cleanup-closeout`, HEAD `40f4524`).
- [x] 0 PRs abiertos verificado en este corte.
- [x] Documento rector actualizado sin hallazgos P0/P1/P2/P3 activos dentro
  del alcance auditado.

## 8. Documentos relacionados

- [`final-repo-cleanup-engineering-audit.md`](final-repo-cleanup-engineering-audit.md) — documento rector, actualizado en este cierre.
- [`final-cleanup-current-status-snapshot.md`](final-cleanup-current-status-snapshot.md) — snapshot de estado, actualizado en este cierre.
- [`documentation-taxonomy-fragmentation-audit.md`](documentation-taxonomy-fragmentation-audit.md) — P2-D.
- [`backend-observability-logger-console-audit.md`](backend-observability-logger-console-audit.md) — P2-E.
- [`frontend-dependencies-cleanup-closeout.md`](frontend-dependencies-cleanup-closeout.md) — P2-B.
- [`../implementation/final-repo-cleanup-closeout.md`](../implementation/final-repo-cleanup-closeout.md) — nota de implementación de este cierre.
