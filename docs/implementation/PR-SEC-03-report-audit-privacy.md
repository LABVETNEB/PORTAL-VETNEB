# PR-SEC-03 — Privacidad de auditoría y logs de informes (SEC-08)

## Estado base

Rama: `fix/sec-08-report-audit-privacy`.
Base: `main` `3c8186bdf3b77ccbd8cd70a261c286542ac7447c` (incluye SEC-05, #2023).
Hallazgo: SEC-08 del roadmap `docs/audit/AUDITORIA_SEGURIDAD_CAJA_BLANCA_ROADMAP_2026-11-11.md`.
No confundir con PR-SEC-08 del roadmap (rate limit fail-closed).

## Scope

Backend-only. Sin cambios de esquema, migraciones, dependencias, frontend ni workflows.

## Evidencia del problema

En `server/features/reports/application/report-route-service.ts`:

- La metadata de auditoría del evento `report.uploaded` incluía `patientName`
  (texto libre clínico), persistido en la tabla de auditoría y devuelto sin
  filtrar por el listado de auditoría.
- El fallo de la notificación `report_delivered` informaba
  `errorName: error.message`; el composition lo emitía con `console.warn`.
  Un mensaje de error puede contener texto de driver, SMTP o DB.

Ningún consumidor del repositorio leía `metadata.patientName`.

## Corrección aplicada

- Se eliminó `patientName` de la metadata de `report.uploaded`. `patientName`
  sigue usándose para crear el informe y para la búsqueda.
- El servicio resuelve `errorName` mediante la dependencia inyectada
  `resolveSafeErrorName`. El composition la cablea con
  `resolveReportSafeErrorName`, que reutiliza `serializeError` de
  `server/lib/logger.ts` (allowlist cerrada existente; no se creó otra):
  - `Error` con nombre permitido → ese nombre.
  - `Error` con nombre arbitrario o con datos clínicos → `"Error"`.
  - Valor lanzado que no es `Error` → `"unknown_error"`.
  - Nunca `message`, `stack` ni nombre arbitrario.
- La dependencia se inyecta porque `application/` es default-deny de imports
  (guard `reports-command-use-cases-boundary-guard`); no se debilitó ningún guard.

## Invariantes preservadas

- Orden `notificación → log → auditoría → resultado` y carácter best-effort
  de la notificación.
- Resto de claves de metadata de `report.uploaded` sin cambios.
- Único logger de composición e identificadores operativos (`reportId`,
  `clinicId`, `trackingCaseId`).
- `normalizeAuditMetadata` y el esquema PostgreSQL sin cambios.

## Tests

- `test/unit/application/reports/report-route-service.test.ts`: metadata sin
  `patientName` con persistencia intacta del campo; logger sin mensaje ni nombre
  manipulado; `unknown_error` para valores no `Error`; orden y best-effort;
  allowlist de `resolveReportSafeErrorName`.
- `test/architecture/audit-critical-flow-writes.test.ts`: el guard ahora inspecciona
  el bloque de `report.uploaded` (sin `patientName`, `storagePath` ni
  `error.message`) y prohíbe `error.message`/`error.stack` en el servicio.
  Verificado por mutación: reinsertar `patientName` hace fallar el guard.
- Resultados de validación: ver sección siguiente.

## Validación

Ejecución local del 2026-11-20 sobre base 3c8186bd más el diff (sin commit):

- `report-route-service.test.ts` (18/18), `audit-critical-flow-writes.test.ts` (9/9),
  `admin-reports.fastify.test.ts` (28/28), censo M48 y guards de reports,
  seguridad y M45: PASSED.
- `typecheck`, `typecheck:test`, `build`, `security:public-surface`: PASSED.
- `pnpm test` completo: 5937 tests, 18 fallos antes de realinear
  `admin-reports.fastify.test.ts` (que aseveraba el `patientName` filtrado en
  la metadata; realineado en este PR y ahora PASSED). Restan 17 fallos
  ambientales idénticos a los de `main` previo: 9 archivos Postgres sin
  `DATABASE_URL` de `portal_vetneb_ci` y 8 tests de PR governance por la
  passphrase de la clave SSH de firma (BLOCKED).
- `pnpm validate:local`: FAILED por esas causas ambientales (su paso `test`
  incluye los 17); typecheck, typecheck:test y build PASSED.
- GitHub CI: NOT_RUN (rama no publicada).

## Censo M48

`server/features/reports` 27/3.180 → 27/3.187; `server/features` 19.202 → 19.209;
total 246/50.381 → 246/50.388. Valores obtenidos ejecutando el test sobre el árbol real.

## Riesgos residuales

- Las filas históricas de auditoría `report.uploaded` con `patientName` **no se
  modificaron**. No se ejecutó migración ni borrado de datos; un saneamiento
  retroactivo es R3 y requiere tarea y autorización propias.
- La redacción de metadata de auditoría sigue sin ser central: otros writers
  deben evitar texto clínico libre por revisión.

## Rollback

Revertir el commit de la PR por el procedimiento gobernado. No hay datos que
revertir ni migraciones.
