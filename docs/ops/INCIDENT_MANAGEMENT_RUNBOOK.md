# Incident Management Runbook

## Metadata

| Campo | Valor |
| --- | --- |
| Document owner | DevOps / Tech lead |
| Domain | Incident management and operational response |
| Lifecycle status | `ACTIVE` |
| Authoritative source role | Fuente normativa primaria para declaración, coordinación, comunicación, recuperación y postmortem de incidentes VETNEB |
| Effective date | 2026-07-31 |
| Last verified date | 2026-07-31 |
| Review cadence | Semestral, después de cada S1/S2 y ante cambios de operación o proveedores |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-022`, `ERM-OBS-002`; Plan B slot 12/18 |
| Evidence or approval reference | `PR-DATA-DR-OBS-GOVERNANCE`; base `main@8e743d67c0c4ff004d68a791a6bed72a3480200d` |

## 1. Propósito

Establecer un proceso común para detectar, declarar, contener, recuperar y
aprender de incidentes sin exponer secretos, datos clínicos ni información de
otros tenants.

Este runbook no implementa monitoreo, paging, collectors, dashboards ni canales
externos. Su existencia no demuestra que el proceso haya sido ejercitado.

## 2. Principios

- Seguridad y protección de datos prevalecen sobre velocidad de cierre.
- Un incidente se declara por impacto observado o riesgo creíble, no por certeza
  completa de causa raíz.
- Se asigna un único Incident Commander.
- Las comunicaciones distinguen hechos, hipótesis, decisiones y próximos pasos.
- No se corrige de contrabando: el hotfix posterior conserva scope mínimo,
  evidencia y rollback.
- No se usan datos reales para reproducir cuando un fixture sintético es
  suficiente.
- Producción, DB, restore, rollback destructivo y settings externos requieren
  autorización específica vigente.

## 3. Severidades

| Severidad | Criterios | Acknowledge objetivo | Cadencia de actualización | Criterio de cierre |
| --- | --- | ---: | ---: | --- |
| `S1` Crítica | Acceso o mutación cross-tenant; pérdida/corrupción de datos; secreto expuesto; Storage público; indisponibilidad total; rollback/restore fallido con impacto activo | 15 minutos | 30 minutos | Contención verificada, servicio seguro o detenido, owner y plan de recuperación aprobados |
| `S2` Alta | Degradación severa de flujo crítico; errores 5xx sostenidos; auth/login ampliamente afectado; RPO/RTO en riesgo; incidente de proveedor con impacto material | 30 minutos | 60 minutos | Impacto estabilizado, workaround seguro o recuperación validada |
| `S3` Media | Función limitada afectada; degradación parcial; error con alcance acotado y sin exposición de datos | 4 horas | Diario hábil o ante cambio material | Fix/workaround validado y riesgo residual aceptado |
| `S4` Baja | Defecto menor, alerta informativa, deuda operacional sin impacto inmediato | 1 día hábil | Al cierre o semanal si continúa | Backlog asignado, criterio de cierre y owner definidos |

Ante duda entre dos niveles, usar temporalmente el más alto hasta reducir la
incertidumbre con evidencia.

## 4. Roles

| Rol | Responsabilidad |
| --- | --- |
| Incident Commander | Declara severidad, asigna roles, mantiene prioridad y autoriza transiciones |
| Technical Lead | Diagnóstico técnico, plan de contención, recuperación y validación |
| Security/Data Lead | Tenant isolation, secretos, datos, evidencia, RPO/RTO y legal hold |
| Communications Lead | Actualizaciones internas/externas aprobadas y consistentes |
| Scribe | Timeline UTC, decisiones, comandos de alto nivel y evidencia sanitizada |
| Business Owner | Impacto comercial, prioridad, decisiones de continuidad y comunicación a clientes |
| Subject Matter Owner | Conocimiento del dominio afectado; no reemplaza al Incident Commander |

Una persona puede cubrir más de un rol en un equipo pequeño, pero cada rol debe
quedar explícitamente asignado en el acta.

## 5. Declaración inicial

Registrar:

- incident ID;
- timestamp UTC;
- severidad inicial;
- superficie y entorno;
- commit/deploy exacto cuando esté disponible;
- síntoma observado;
- impacto conocido;
- tenants/actores expresados de forma sanitizada;
- Incident Commander y roles;
- acciones inmediatas permitidas;
- acciones R2/R3 bloqueadas o pendientes de autorización;
- próxima actualización.

No registrar cookies, tokens, passwords, hashes, headers completos, signed URLs,
connection strings, dumps ni datos clínicos.

## 6. Ciclo de respuesta

### 6.1 Detectar y declarar

1. Validar que la señal corresponde al entorno correcto.
2. Preservar evidencia mínima sanitizada.
3. Declarar severidad provisional.
4. Asignar Incident Commander y roles.
5. Abrir timeline.

### 6.2 Contener

Acciones posibles según autorización:

- deshabilitar una función mediante mecanismo aprobado;
- bloquear actor/token/recurso comprometido;
- congelar deploys;
- retirar tráfico de una versión insegura;
- limitar acceso a evidencia;
- separar tenants o actores de prueba;
- activar NO-GO de release.

No ejecutar restore, rollback destructivo, cambio de DB o mutación productiva sin
autorización R3 específica.

### 6.3 Diagnosticar

Separar explícitamente:

- hechos observados;
- hipótesis;
- evidencia a favor/en contra;
- alcance confirmado;
- causa raíz provisional;
- riesgos de cada acción.

### 6.4 Recuperar

La recuperación debe:

- usar un commit/deploy identificado;
- preservar autenticación, tenant isolation y `no-store` privado;
- ejecutar health y smokes aplicables;
- medir RPO/RTO cuando haya recuperación de datos;
- verificar logs redactados;
- mantener NO-GO si un control crítico queda `FAILED` o `BLOCKED`.

### 6.5 Cerrar

El Incident Commander puede cerrar cuando:

- el impacto activo terminó;
- las validaciones mínimas están registradas;
- no hay exposición activa conocida;
- el riesgo residual tiene owner;
- el follow-up está creado;
- la comunicación final fue aprobada;
- el postmortem está calendarizado para S1/S2.

## 7. Matriz mínima de validación

| Dominio | Validación mínima |
| --- | --- |
| Backend | health, rutas públicas, errores 5xx y contrato afectado |
| Auth/sesiones | privado bloqueado sin cookie, actor correcto con sesión válida, logout/revocación si aplica |
| Tenant isolation | acceso propio permitido y ajeno bloqueado con datos sintéticos |
| DB | conectividad, schema y operación mínima autorizada |
| Storage | bucket privado, propio permitido, ajeno bloqueado, signed URL no expuesta |
| Frontend | flujo crítico y estados de error sin disclosure |
| Observabilidad | request/correlation ID y logs sin campos sensibles |
| Recovery | duración medida y comparación contra RPO/RTO |

## 8. Comunicación

Toda actualización debe incluir:

- timestamp UTC;
- severidad;
- impacto confirmado;
- acción completada;
- decisión actual;
- riesgo pendiente;
- próxima actualización.

Formato:

```text
[UTC] INC-<id> S<1-4>
Impacto confirmado: <sanitizado>
Estado: INVESTIGATING | CONTAINED | RECOVERING | MONITORING | CLOSED
Acciones: <alto nivel, sin secretos>
Riesgo pendiente: <sanitizado>
Próxima actualización: <UTC>
```

No prometer recuperación antes de tener evidencia. No usar “resuelto” cuando el
estado real es sólo `MONITORING`.

## 9. Timeline

| Timestamp UTC | Actor/rol | Hecho o decisión | Evidencia sanitizada | Estado |
| --- | --- | --- | --- | --- |
| `<timestamp>` | `<rol>` | `<evento>` | `<referencia>` | `<estado>` |

Los comandos se resumen por propósito. No copiar salidas que contengan secretos
o datos reales.

## 10. Postmortem S1/S2

Debe completarse dentro de 5 días hábiles desde el cierre, salvo impedimento
registrado.

### Template

1. **Resumen ejecutivo**
2. **Impacto y duración**
3. **Detección**
4. **Timeline UTC**
5. **Causa raíz**
6. **Factores contribuyentes**
7. **Qué funcionó**
8. **Qué falló**
9. **Contención y recuperación**
10. **RPO/RTO observado**, si aplica
11. **Seguridad y tenant isolation**
12. **Acciones correctivas** con owner y fecha
13. **Riesgos residuales**
14. **Evidencia sanitizada**
15. **Criterio de verificación de cada acción**

El postmortem es blameless respecto de personas, pero exacto respecto de
controles, decisiones y fallos técnicos.

## 11. Acciones correctivas

Cada acción debe ser:

- específica;
- asignada a un owner por rol;
- priorizada;
- verificable;
- con fecha objetivo;
- con rollback cuando modifique runtime;
- entregada en PR separado por scope.

“Revisar”, “mejorar monitoreo” o “tener más cuidado” no son acciones de cierre
sin un control verificable.

## 12. Evidencia prohibida y permitida

Permitido:

- timestamps;
- commit/deploy;
- status HTTP;
- duración;
- conteos agregados;
- actor sintético;
- presencia/ausencia de cookie o signed URL sin valor;
- referencias internas sanitizadas.

Prohibido:

- datos clínicos;
- identidades reales innecesarias;
- cookies y session IDs;
- tokens o hashes;
- passwords;
- signed URLs completas;
- payloads y headers completos;
- dumps y connection strings;
- logs crudos sensibles.

## 13. Tabletop y estado del control

| Capacidad | Estado |
| --- | --- |
| Severidades y roles | `DOCUMENTED_ONLY` |
| Comunicación y timeline | `DOCUMENTED_ONLY` |
| Postmortem template | `DOCUMENTED_ONLY` |
| Integración con paging/canales | `NOT_IMPLEMENTED` |
| Tabletop o canaria de proceso | `NOT_RUN` |
| Incidente real ejercitado bajo este runbook | `NOT_RUN` |

`ERM-CTRL-022` debe permanecer `DOCUMENTED_ONLY` hasta que un tabletop o proceso
real produzca evidencia sanitizada. La existencia del runbook no se declara como
ejercicio exitoso.

## 14. Rollback documental

Revertir este documento elimina el proceso publicado sin afectar runtime,
proveedores, datos, deploys ni configuración.
