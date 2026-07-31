# Data Recovery Objectives — RPO, RTO and Drill Governance

## Metadata

| Campo | Valor |
| --- | --- |
| Document owner | DBA / DevOps owner |
| Domain | Backup, restore, rollback and disaster recovery governance |
| Lifecycle status | `ACTIVE` |
| Authoritative source role | Fuente normativa de objetivos numéricos de recuperación; complemento operativo de [Backup, restore y rollback](./BACKUP_RESTORE_ROLLBACK.md) |
| Effective date | 2026-07-31 |
| Last verified date | 2026-07-31 |
| Review cadence | Trimestral, antes de cambios DB/Storage y después de cada drill o incidente |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-020`, `ERM-DATA-001`, `ERM-DR-001`; Plan B slots 12/18 y 13/18 |
| Evidence or approval reference | `PR-DATA-DR-OBS-GOVERNANCE`; base `main@8e743d67c0c4ff004d68a791a6bed72a3480200d` |

## 1. Propósito

Declarar objetivos numéricos de punto y tiempo de recuperación antes de ejecutar
cualquier restore o rollback drill.

- **RPO**: pérdida máxima de datos tolerada medida hacia atrás desde el incidente.
- **RTO**: tiempo máximo objetivo desde la declaración de recuperación hasta que
  la capacidad mínima validada vuelve a estar disponible.

Un objetivo documentado no demuestra capacidad real. La capacidad sólo puede
marcarse `PASSED` después de un drill observado con duración medida.

## 2. Alcance y límites

Incluye objetivos para:

- PostgreSQL/DB;
- Storage privado de reportes;
- audit log persistido;
- backend y frontend desplegados;
- configuración externa necesaria para restaurar el servicio.

Excluye:

- ejecución de backup, restore o rollback;
- descarga o versionado de dumps;
- mutación de staging o producción;
- credenciales, connection strings o valores de variables;
- cambios de proveedor o plan.

## 3. Objetivos numéricos

| Clase | RPO objetivo | RTO objetivo | Capacidad mínima recuperada | Estado observado |
| --- | ---: | ---: | --- | --- |
| PostgreSQL — datos clínicos, identidad y workflow | 24 horas | 8 horas | Schema válido, conectividad, auth básica, lecturas propias y mutaciones críticas controladas | `NOT_VERIFIED` |
| Storage privado `reports` | 24 horas | 12 horas | Objetos de prueba presentes, bucket privado, preview/download propio y ausencia cross-tenant | `NOT_VERIFIED` |
| Audit log persistido | 24 horas | 12 horas | Eventos de prueba disponibles, orden e identidad de actor preservados, sin disclosure | `NOT_VERIFIED` |
| Backend Render | 0 horas para código versionado; configuración según último snapshot autorizado | 2 horas | `/health` o `/api/health`, rutas públicas, privado bloqueado sin cookie y conexión DB controlada | `NOT_VERIFIED` |
| Frontend Render | 0 horas para código versionado; configuración según último snapshot autorizado | 2 horas | shell público, login y navegación mínima contra backend recuperado | `NOT_VERIFIED` |
| Configuración externa crítica | 24 horas desde la última revisión/snapshot de nombres y settings | 4 horas | nombres y settings requeridos restaurados sin exponer valores | `NOT_VERIFIED` |

Los objetivos son máximos, no promedios. El RTO se mide contra la capacidad
mínima definida, no contra la mera finalización del comando de restore.

## 4. Estado de capacidad versus objetivo

La evidencia histórica de dump DB y export Storage no permite inferir RPO 24h ni
RTO alguno porque:

- no existe backup automático verificado bajo el plan actual;
- la vigencia del backup no fue evaluada contra una ventana de incidente;
- restore drill no productivo permanece pendiente;
- rollback drill observado permanece pendiente;
- la duración de recuperación no fue medida.

Estado global:

```text
RPO targets:                    DOCUMENTED_ONLY
RTO targets:                    DOCUMENTED_ONLY
Backup freshness automation:    NOT_IMPLEMENTED
Non-production restore drill:   BLOCKED / NOT_RUN
Rollback drill:                 BLOCKED / NOT_RUN
Recovery capability:            NOT_VERIFIED
```

## 5. Prioridad de recuperación

1. Confirmar incidente, entorno y responsables.
2. Preservar evidencia sanitizada y congelar cambios relacionados.
3. Recuperar DB y conectividad mínima.
4. Recuperar audit log requerido para trazabilidad.
5. Recuperar Storage de reportes.
6. Validar backend y rutas privadas/públicas.
7. Validar frontend y flujo crítico.
8. Ejecutar smoke y registrar duración contra RTO.
9. Tomar decisión GO/NO-GO.

La secuencia puede cambiar por causa del incidente, pero cualquier desviación
debe quedar documentada.

## 6. Freshness y selección del backup

Antes de un drill se registra:

- timestamp UTC del backup;
- clase cubierta;
- tamaño aproximado;
- ubicación/vault por referencia, nunca path sensible completo;
- operador responsable;
- integridad verificada;
- antigüedad al inicio del drill;
- cumplimiento o incumplimiento del RPO.

Un backup corrupto, incompleto, no localizable o fuera del RPO no es apto para
cerrar el drill.

## 7. Medición del RTO

Inicio de medición:

- timestamp UTC en que el responsable autoriza iniciar recuperación.

Fin de medición:

- timestamp UTC en que todas las validaciones mínimas de la clase están
  `PASSED`.

No se detiene el reloj al terminar la importación si schema, auth, smoke,
Storage o integridad aún no están validados.

## 8. Entry criteria del drill

Todos deben estar observados antes de ejecutar el Slot 13:

| Criterio | Estado actual |
| --- | --- |
| Entorno no productivo identificado y autorizado | `BLOCKED` |
| Backup apto y dentro del RPO | `BLOCKED` |
| Datos sintéticos definidos | `BLOCKED` |
| Responsables DBA/DevOps, Tech lead y negocio asignados | `BLOCKED` |
| Ventana y criterio de parada autorizados | `BLOCKED` |
| Rollback del drill documentado | `BLOCKED` |
| Credenciales fuera de transcript y repo | Requisito obligatorio |
| Acta sanitizada preparada | `DOCUMENTED_ONLY` en el runbook existente |

## 9. Exit criteria del drill

Cada clase aplicable debe registrar:

- backup seleccionado y antigüedad;
- duración total;
- RPO `PASSED` o `FAILED`;
- RTO `PASSED` o `FAILED`;
- schema y conectividad;
- smoke público;
- smoke privado autorizado;
- integridad mínima de datos sintéticos;
- privacidad de Storage;
- auditabilidad;
- rollback post-drill;
- riesgos residuales.

Un criterio no ejecutado queda `BLOCKED` o `NOT_RUN`, nunca `PASSED`.

## 10. Escalación por incumplimiento

| Condición | Severidad inicial | Acción |
| --- | --- | --- |
| Backup no localizable o corrupto | S1 | NO-GO, incidente y plan de recuperación alternativo |
| Pérdida observada mayor al RPO | S1 | Detener, preservar evidencia y escalar a negocio/seguridad |
| Recuperación excede RTO | S2 | Mantener NO-GO y registrar causa raíz |
| Smoke privado o tenant isolation falla | S1 | Detener, no habilitar tráfico |
| Storage queda público o signed URL se filtra | S1 | Contención inmediata |
| Evidencia contiene secreto o dato real | S1 | Descartar evidencia y tratar como incidente de seguridad |

## 11. Relación con otros documentos

- [Backup, restore y rollback](./BACKUP_RESTORE_ROLLBACK.md) gobierna el
  procedimiento operativo y la evidencia histórica.
- [Incident Management Runbook](./INCIDENT_MANAGEMENT_RUNBOOK.md) gobierna
  severidad, roles, comunicación y postmortem.
- [Ops Metrics Baseline](./METRICS_BASELINE.md) define métricas y alertas de
  freshness, restore y disponibilidad.
- [Data Classification, Retention and Deletion Policy](../governance/data-classification-retention-policy.md)
  gobierna clases, retención y legal hold.

## 12. Rollback documental

Revertir este documento elimina los objetivos publicados sin ejecutar ninguna
operación. No afecta backups, DB, Storage, deploys ni datos.
