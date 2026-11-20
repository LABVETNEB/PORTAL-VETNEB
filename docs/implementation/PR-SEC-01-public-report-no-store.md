# PR-SEC-01 — Protección de caché en acceso público a informes (SEC-04)

## Estado base

Rama: fix/sec-04-public-report-no-store.
Base: main actualizado con PR #2018 y PR #2020.

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

Al crear este documento:
- Test dirigido: PASSED (8/8, exit 0; ejecución observada el 2026-11-20).
- validate:local: FAILED (exit 1; ejecución local sobre 83b2c2ac7ef2233e36bc2cc0ca2edc8b3581cd3b).
- security:public-surface: NOT_RUN (pendiente de diagnóstico del gate general).
- GitHub CI: NOT_RUN (rama todavía no publicada).

Actualizar estos estados exclusivamente con evidencia de ejecución,
comando y HEAD concreto.

## Riesgo residual

no-store no revoca URLs firmadas ya emitidas ni sustituye su expiración.
Los controles de acceso originales permanecen obligatorios.

## Rollback

Revertir el cambio de la PR por el procedimiento gobernado,
sin operaciones destructivas locales.

## Estado

Implementación local pendiente de validación y publicación autorizada.
