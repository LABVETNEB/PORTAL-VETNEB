# PR-SEC-01 — Protección de caché en acceso público a informes (SEC-04)

## Estado base

Rama: fix/sec-04-public-report-no-store-rebased.
Base: main 3c8186bdf3b77ccbd8cd70a261c286542ac7447c (incluye PR #2018, #2020 y #2023).

## Hallazgo

El endpoint GET /api/public/report-access/:token devuelve información
del informe y URLs firmadas. El guard global de caché excluye
/api/public/, por lo que este endpoint requiere protección explícita.

## Alcance

- Establecer Cache-Control: no-store en el hook de la ruta pública.
- Cubrir respuestas 200, 404, 409, 429 y fallos 500.
- Verificar también OPTIONS y conservar CORS y RateLimit.
- Añadir pruebas adversariales que fallen si se retira el encabezado.

## Fuera de alcance

No cambiar autenticación, TTL, URLs firmadas, expiración de enlaces,
RLS, CSP, esquema, dependencias, configuración remota ni frontend.

## Validación

Ejecución local del 2026-11-20 sobre base 3c8186bd más el diff de este PR
(sin commit):
- Tests dirigidos (public-report-access, global-public-surface-hardening-contract,
  M48 final certification): PASSED (exit 0 cada uno).
- typecheck y typecheck:test: PASSED. build: PASSED.
- security:public-surface: PASSED.
- pnpm test completo: FAILED por causas ambientales, 5917/5935 pass, 17 fail, 1 skip:
  - 9 archivos Postgres: faltan DATABASE_URL/SUPABASE_DB_URL de portal_vetneb_ci (BLOCKED).
  - 8 tests de PR governance: `git commit` de fixtures falla por la clave SSH de
    firma con passphrase (BLOCKED; ajena al diff).
- Censo M48 recalculado por ejecución del test: server/routes 38/22.151, total 246/50.382.
- GitHub CI: NOT_RUN (rama no publicada).

## Riesgo residual

no-store no revoca URLs firmadas ya emitidas ni sustituye su expiración.
Los controles de acceso originales permanecen obligatorios.

## Rollback

Revertir el cambio de la PR por el procedimiento gobernado,
sin operaciones destructivas locales.

## Estado

Implementación local pendiente de validación y publicación autorizada.
