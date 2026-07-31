# Ops Metrics Baseline

## Metadata

| Campo | Valor |
| --- | --- |
| Document owner | DevOps / Backend owner |
| Domain | Observability, metrics, SLOs and alert design |
| Lifecycle status | `ACTIVE` |
| Authoritative source role | Fuente normativa de métricas agregadas, SLIs/SLOs y diseño de alertas; no prueba collectors, dashboards ni paging runtime |
| Effective date | 2026-07-31 |
| Last verified date | 2026-07-31 |
| Review cadence | Mensual y ante cambios de rutas críticas, tráfico, proveedores o incidentes |
| Supersedes | Versión documental inicial de este archivo |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-021`, `ERM-OBS-001`; Plan B slots 12/18 y 14/18 |
| Evidence or approval reference | `PR-DATA-DR-OBS-GOVERNANCE`; base `main@8e743d67c0c4ff004d68a791a6bed72a3480200d` |

## 1. Estado

Este documento define el baseline y el diseño de observabilidad de VETNEB.

```text
Metrics vocabulary:          DOCUMENTED_ONLY
SLIs/SLOs:                   DOCUMENTED_ONLY
Runtime collectors:          NOT_IMPLEMENTED
Metrics endpoint/store:      NOT_IMPLEMENTED
Alerts/paging:               NOT_IMPLEMENTED
Dashboards:                  NOT_IMPLEMENTED
Alert test evidence:         NOT_RUN
```

No introduce código, endpoints, dependencias, integraciones externas, alertas,
dashboards ni cambios de schema. Ningún objetivo puede declararse cumplido sin
telemetría observada.

## 2. Principios

- Métricas agregadas, nunca datos personales o clínicos.
- Correlación mediante `requestId`/correlation ID sin session IDs ni tokens.
- Cardinalidad acotada y revisada.
- Alertas accionables con owner y runbook.
- No alertar sobre una señal que no tenga medición confiable.
- Un dashboard no sustituye una alerta ni una alerta sustituye evidencia.
- Los errores DB y stack traces se redactan antes de cualquier exportación.
- Superficies privadas preservan `no-store` y no exponen métricas sensibles.

## 3. Dimensiones permitidas y prohibidas

Permitidas:

- entorno;
- servicio;
- método HTTP;
- route template normalizado;
- status class (`2xx`, `4xx`, `5xx`);
- tipo de actor agregado (`admin`, `clinic`, `particular`, `public`);
- resultado agregado;
- versión/commit/deploy sanitizado.

Prohibidas:

- patient/tutor ID;
- email o teléfono;
- clinic ID como etiqueta de alta cardinalidad;
- report ID;
- token, session ID o cookie;
- signed URL o storage path privado;
- payload clínico;
- texto de error DB crudo;
- cualquier secreto o hash de credencial.

Cuando se requiera análisis por tenant, usar cohortes agregadas o consulta
restringida fuera de la telemetría general; no publicar identificadores tenant
como labels.

## 4. SLIs y SLOs iniciales

Los objetivos son propuestas operativas aprobadas documentalmente. La ventana y
cumplimiento real permanecen `NOT_VERIFIED` hasta implementar collectors.

| Servicio / flujo | SLI | Ventana | SLO inicial | Exclusiones controladas |
| --- | --- | --- | ---: | --- |
| Backend core | respuestas `2xx`/`3xx` / requests de disponibilidad elegibles; los `4xx` contractualmente esperados se excluyen de numerador y denominador antes de agregar | 30 días | 99,5% | health probes malformados y mantenimiento autorizado registrado |
| Login clínica/admin | logins válidos completados / intentos válidos controlados | 30 días | 99,5% | credenciales inválidas, rate limit legítimo, cuentas bloqueadas |
| Lectura de reportes propia | respuestas válidas exitosas / solicitudes autorizadas | 30 días | 99,5% | 4xx esperados por recurso ausente/ajeno |
| Preview/download propio | acceso propio exitoso / solicitudes autorizadas | 30 días | 99,0% | token expirado/revocado y recurso inexistente |
| Audit event persistence | eventos persistidos / eventos que debieron persistirse | 30 días | 99,99% | ninguno sin aprobación Security |
| Backend latency read | p95 de rutas read críticas | 5 minutos y 30 días | < 750 ms | requests canceladas por cliente identificadas |
| Backend latency write | p95 de mutaciones críticas | 5 minutos y 30 días | < 1.500 ms | uploads medidos por separado |
| Upload de reporte | p95 de flujo autorizado hasta confirmación | 30 días | < 10 s | tamaño fuera de contrato y conexión cliente abortada |
| Recovery DB | duración desde autorización hasta validación mínima | por drill | <= 8 h | ninguna |
| Recovery Storage | duración hasta privacidad e integridad mínima | por drill | <= 12 h | ninguna |

Clasificación obligatoria del ratio de disponibilidad:

- los `4xx` contractualmente esperados se excluyen del numerador y del denominador;
- los `4xx` inesperados nunca cuentan como éxito, permanecen en el denominador y se
  registran además como fallos de contrato;
- los `5xx` permanecen en el denominador y nunca en el numerador;
- sólo `2xx`/`3xx` elegibles cuentan como éxito.

Así, tráfico no autorizado, recursos ausentes esperados o tokens revocados no
diluyen el error rate ni mejoran artificialmente la disponibilidad.

## 5. Presupuesto de error

Para cada SLO de disponibilidad:

```text
error budget = 1 - SLO
burn rate = consumo observado del presupuesto / consumo uniforme esperado
```

Política inicial:

- burn rate >= 14,4 durante 5 minutos: alerta S1/S2 según impacto;
- burn rate >= 6 durante 30 minutos: alerta S2;
- burn rate >= 2 durante 6 horas: alerta S3;
- presupuesto mensual agotado: congelar cambios de riesgo equivalente hasta
  revisión del owner, salvo hotfix de seguridad o disponibilidad.

Los burn rates permanecen `NOT_IMPLEMENTED` hasta disponer de series confiables.

## 6. Core API metrics

- request count;
- response count por status class;
- error count y error rate;
- latency p50, p95 y p99;
- in-flight requests;
- timeout count;
- aborted request count;
- payload-size buckets sin contenido;
- cold start/startup duration cuando aplique;
- health status y dependencia agregada.

## 7. Seguridad y auditoría

- login attempts y failed login attempts;
- rate-limit hits;
- CSRF/trusted-origin rejections agregadas;
- audit event write failures;
- token creation, revocation y rejected access counts;
- access denied por ownership/tenant como conteo agregado;
- signed URL generation failures, sin registrar URL;
- redaction failures detectadas por tests/guards;
- sesiones revocadas por incidente, sólo cantidad.

Un spike de denegaciones no es automáticamente un incidente; se correlaciona con
origen agregado, ruta y ventana sin capturar identidad o credenciales.

## 8. Datos, backup y recovery

- timestamp/edad del último backup DB apto;
- timestamp/edad del último export Storage apto;
- backup success/failure count;
- integridad verification result;
- restore drill duration;
- rollback drill duration;
- RPO observed versus objective;
- RTO observed versus objective;
- último drill exitoso por clase;
- backups fuera de objetivo;
- restore/rollback validation failures.

Los valores de paths, vaults, connection strings y dumps no forman parte de la
telemetría.

## 9. Logística y SLA

- route plan creation count;
- field visit y stop count;
- planning duration;
- late/missed hard-window count;
- SLA-risk stop count;
- active/breached/resolved SLA instances;
- breach rate;
- mean time to resolution;
- overdue minutes total y p95.

No usar identificadores de paciente, tutor o clínica como labels.

## 10. Público y particulares

- public search request/error count;
- search latency p95;
- empty-result count;
- public detail access count;
- valid/invalid/revoked token outcomes agregados;
- enumeration-resistant rejection count;
- particular access success/denial count;
- response cache-control violations detectadas.

## 11. Catálogo inicial de alertas

| Alerta | Condición propuesta | Duración | Severidad inicial | Owner | Runbook |
| --- | --- | ---: | --- | --- | --- |
| Backend unavailable | health no exitoso desde 2 probes independientes | 5 min | S1 | DevOps | Incident Management |
| Elevated 5xx | error rate >= 5% y >= 20 requests | 5 min | S2; S1 si flujo total | Backend/DevOps | Incident Management |
| Sustained 5xx | error rate >= 1% y >= 100 requests | 30 min | S2 | Backend | Incident Management |
| Read latency | p95 >= 1.500 ms y >= 100 requests | 15 min | S3 | Backend | Incident Management |
| Write latency | p95 >= 3.000 ms y >= 20 requests | 15 min | S3 | Backend | Incident Management |
| Audit write failure | count >= 1 | inmediato | S1 | Security/Backend | Incident Management |
| Cross-tenant signal | test/smoke o runtime guard detecta acceso ajeno | inmediato | S1 | Security | Cross-tenant runbook |
| Secret/redaction failure | evidencia o log contiene campo prohibido | inmediato | S1 | Security | Incident Management |
| Backup DB stale | edad > 24 h para backup objetivo | 15 min tras evaluación | S2 | DBA/DevOps | Recovery objectives |
| Storage backup stale | edad > 24 h | 15 min tras evaluación | S2 | DBA/DevOps | Recovery objectives |
| Restore drill overdue | > 90 días desde último drill exitoso | diario | S3 | DBA/DevOps | Backup/restore runbook |
| Login failure anomaly | >= 3x baseline y volumen mínimo definido | 15 min | S3/S2 | Security | Incident Management |
| Rate-limit anomaly | >= 3x baseline y volumen mínimo definido | 15 min | S3 | Security/Backend | Incident Management |

Las alertas de anomalía requieren al menos 30 días de baseline o un umbral fijo
provisional documentado. Sin baseline, no se afirma detección estadística.

## 12. Dashboard mínimo

El dashboard futuro debe incluir, como mínimo:

1. estado backend/frontend y commit/deploy;
2. request rate, 5xx y latencia p50/p95/p99;
3. login y rutas críticas;
4. audit write failures;
5. seguridad agregada y rate limits;
6. backup freshness y último restore/rollback drill;
7. burn rate y presupuesto de error;
8. incidentes abiertos por severidad;
9. panel de datos ausentes o collector degradado.

Toda visualización debe indicar ventana, unidad, fuente y freshness. “No data” no
se interpreta como cero.

## 13. Diseño de implementación para Slot 14

La implementación backend futura debe:

- conservar la API `logInfo/logWarn/logError` o migrarla con compatibilidad;
- emitir logging estructurado con timestamp, nivel y request ID;
- aplicar redacción centralizada;
- introducir métricas agregadas con cardinalidad acotada;
- preservar contratos HTTP y `no-store` privado;
- incluir tests de redacción, health y cache-control;
- no mezclar proveedor/dashboard, dependencias no autorizadas o RLS;
- declarar cómo se exportan/consultan métricas sin hacer público un endpoint
  sensible.

## 14. Validación de alertas y dashboard

Antes de marcar alertas o dashboards `IMPLEMENTED`:

- collector observado;
- series con unidades y labels revisadas;
- alerta positiva controlada;
- caso negativo/no-trigger;
- routing/paging verificado;
- owner y runbook enlazados;
- captura sanitizada;
- timestamp, entorno y commit/deploy;
- ausencia de secretos y datos clínicos;
- rollback del cambio probado cuando corresponda.

El “test de alerta” del roadmap permanece `NOT_RUN` en este slot docs-only.

## 15. Riesgos y revisión

Reabrir esta política cuando:

- cambia el tráfico o la criticidad del producto;
- un SLO produce ruido o enmascara impacto;
- se agregan rutas críticas;
- cambia el proveedor de hosting, DB, Storage o observabilidad;
- un incidente demuestra que faltaba una señal;
- una métrica genera cardinalidad o exposición indebida.

## 16. Rollback documental

Revertir este archivo restaura el baseline documental anterior. No elimina
collectors, alertas ni dashboards porque no existen cambios runtime en este slot.
