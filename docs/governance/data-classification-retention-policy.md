# Data Classification, Retention and Deletion Policy

## Metadata

| Campo | Valor |
| --- | --- |
| Document owner | Data governance owner / Security owner |
| Domain | Data governance, classification, retention and deletion |
| Lifecycle status | `ACTIVE` |
| Authoritative source role | Fuente normativa primaria para clasificación, retención, legal hold y borrado de datos VETNEB |
| Effective date | 2026-07-31 |
| Last verified date | 2026-07-31 |
| Review cadence | Trimestral y ante cambios de modelo de datos, jurisdicción, contrato, proveedor o incidente |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-019`, `ERM-DATA-002`; Plan B slot 12/18 |
| Evidence or approval reference | `PR-DATA-DR-OBS-GOVERNANCE`; base `main@8e743d67c0c4ff004d68a791a6bed72a3480200d` |

## 1. Propósito

Definir una política verificable para clasificar, conservar, archivar, bloquear y
eliminar datos de VETNEB sin convertir una decisión documental en una afirmación
de implementación runtime.

Esta política establece objetivos internos de gobernanza. No constituye asesoría
legal ni afirma cumplimiento regulatorio. Cualquier período obligatorio por ley,
contrato, orden judicial o autoridad competente prevalece y debe ser ratificado por
el owner legal o de negocio aplicable antes de automatizar eliminación.

## 2. Alcance

Incluye:

- datos clínicos veterinarios y documentos asociados;
- identidad de clínicas, tutores, particulares y usuarios administrativos;
- datos comerciales y de facturación;
- datos operativos de logística, soporte y configuración;
- eventos de auditoría, seguridad y acceso;
- archivos en Storage, copias de seguridad y exportaciones autorizadas;
- datos sintéticos de desarrollo, testing y staging.

Excluye:

- cambios de schema, migraciones, SQL o jobs de borrado;
- ejecución de borrados o restores;
- configuración de proveedores, buckets, backups o lifecycle rules;
- decisiones legales específicas de una jurisdicción no documentada;
- datos almacenados por terceros fuera del control contractual de VETNEB.

## 3. Principios obligatorios

1. **Minimización:** recopilar y conservar sólo lo necesario para el propósito
   declarado.
2. **Finalidad:** no reutilizar datos para una finalidad incompatible sin revisión
   y autorización.
3. **Need-to-know:** acceso por rol y mínimo privilegio.
4. **Tenant isolation:** los datos tenant-scoped permanecen vinculados a la
   identidad autenticada y al ownership aplicativo.
5. **Deny-by-default:** ausencia de clasificación, owner o finalidad no habilita
   acceso ni conservación indefinida.
6. **Legal hold:** una retención o investigación activa suspende el borrado normal
   de los registros afectados.
7. **Borrado verificable:** toda eliminación futura debe producir evidencia
   sanitizada de alcance, responsable, fecha y resultado.
8. **No secretos en evidencia:** nunca registrar passwords, cookies, tokens,
   hashes de credenciales, connection strings, signed URLs completas ni datos
   clínicos crudos.
9. **Snapshots históricos:** auditorías y evidencias aprobadas no se reescriben
   para simular cumplimiento posterior.

## 4. Clases de datos

| Clase | Ejemplos | Sensibilidad | Acceso mínimo | Reglas especiales |
| --- | --- | --- | --- | --- |
| `CLINICAL_RESTRICTED` | reportes, estudios, resultados, observaciones, archivos PDF, metadata clínica, tutor/paciente vinculado | Máxima | Clínica propietaria; particular autorizado al recurso; admin explícitamente autorizado | Nunca usar datos reales en fixtures, capturas o evidencia; Storage privado; signed URLs de vida acotada |
| `IDENTITY_RESTRICTED` | usuarios, emails, teléfonos, direcciones, identificadores de clínica, relaciones usuario-clínica | Alta | Actor propietario y roles operativos autorizados | No usar identificadores enviados por cliente como autoridad tenant |
| `COMMERCIAL_CONFIDENTIAL` | facturación, planes, precios acordados, datos de contacto comercial, exportaciones administrativas | Alta | Negocio/administración autorizados | Exportaciones minimizadas y auditadas |
| `OPERATIONAL_INTERNAL` | configuración no secreta, logística, estados de workflow, métricas agregadas, soporte | Media | Equipos operativos según función | No incluir secretos ni payloads clínicos dentro de logs o métricas |
| `AUDIT_SECURITY_RESTRICTED` | eventos de auditoría, accesos, cambios de estado, incidentes, intentos de login, rate limits | Alta | Security, Tech lead y roles auditados | Inmutable lógicamente; correlación sin exponer identidad innecesaria |
| `PUBLIC_APPROVED` | contenido público aprobado, catálogos públicos, documentación sanitizada | Baja | Público | La clasificación pública debe ser explícita; no se hereda por estar en un endpoint público |
| `SECRET_EPHEMERAL` | passwords, cookies, session IDs, tokens, claves, connection strings | Crítica | Sólo runtime/proveedor autorizado | No se versiona, no se documenta con valor, no se usa como evidencia y no se conserva como dato de negocio |
| `SYNTHETIC_NON_PRODUCTION` | Clinic A/B, usuarios y recursos de prueba inventados | Baja a media | Desarrollo/QA autorizado | Debe ser inequívocamente sintético y no derivado de datos reales |

## 5. Inventario mínimo por activo

Todo dataset, tabla, bucket, export o stream nuevo debe declarar antes de su
implementación:

- owner por rol;
- clase de dato;
- finalidad;
- actor que crea, lee, modifica y elimina;
- tenant boundary;
- sistema de registro;
- período de retención;
- evento que inicia el cómputo;
- mecanismo de legal hold;
- método de borrado o anonimización;
- backup y restore aplicables;
- evidencia requerida;
- dependencias de terceros.

La ausencia de estos campos deja el activo en `BLOCKED` para automatización de
retención o borrado.

## 6. Objetivos internos de retención

Los siguientes períodos son objetivos internos de VETNEB, no afirmaciones de
mínimos legales. Un requisito legal o contractual más largo prevalece; uno más
corto requiere aprobación documentada antes de aplicarse.

| Clase / activo | Inicio del cómputo | Retención objetivo | Disposición prevista | Estado de automatización |
| --- | --- | ---: | --- | --- |
| Reporte clínico final y archivo asociado | Fecha de finalización del reporte | 10 años | Borrado verificable o archivo restringido según obligación aplicable | `NOT_IMPLEMENTED` |
| Datos de identidad vinculados a un reporte vigente | Cierre de la relación y fin de obligaciones relacionadas | 10 años como máximo conjunto con el reporte | Borrado o anonimización preservando integridad referencial | `NOT_IMPLEMENTED` |
| Registros comerciales/fiscales | Cierre del ejercicio o transacción | 10 años | Borrado seguro salvo obligación vigente | `NOT_IMPLEMENTED` |
| Datos operativos de workflow y logística | Cierre del caso/ruta | 2 años | Borrado o agregación estadística irreversible | `NOT_IMPLEMENTED` |
| Eventos de auditoría de seguridad | Fecha del evento | 5 años | Archivo restringido y posterior borrado verificable | `NOT_IMPLEMENTED` |
| Logs técnicos no incidentales | Fecha del evento | 30 días online; 90 días máximo de archivo | Rotación/borrado automático | `NOT_IMPLEMENTED` |
| Evidencia de incidente S1/S2 y postmortem | Cierre del incidente | 5 años | Archivo restringido; sin secretos ni datos clínicos crudos | `NOT_IMPLEMENTED` |
| Datos sintéticos de staging | Fin de la ventana de prueba | 30 días máximo | Borrado al cerrar la prueba o antes | `NOT_IMPLEMENTED` |
| Tokens/sesiones | Expiración, revocación o logout | Sólo vida técnica necesaria | Invalidación y eliminación según diseño de seguridad | Runtime existente; retención no auditada por este slot |
| Backups DB/Storage | Fecha de creación | Según política de recuperación y legal hold | Expiración controlada fuera del repositorio | `NOT_VERIFIED` |

## 7. Base y justificación del tratamiento

Cada finalidad debe asociarse a una justificación aprobada. Las categorías
permitidas para evaluación son:

- ejecución del servicio o relación contractual;
- obligación legal o regulatoria confirmada;
- interés legítimo documentado con evaluación de necesidad y balance;
- consentimiento explícito cuando sea requerido y revocable;
- protección de seguridad, fraude, continuidad o defensa de derechos;
- datos anonimizados de forma irreversible para métricas agregadas.

No se debe asumir una base legal por conveniencia técnica. La interfaz, el
backend o una migración no pueden inventar ni ampliar finalidades. Cuando la
justificación no esté confirmada, el estado es `BLOCKED` y debe intervenir el
owner legal/negocio correspondiente.

## 8. Solicitudes de acceso, corrección y eliminación

Una solicitud debe:

1. autenticar al solicitante y verificar autoridad sobre el recurso;
2. identificar sistemas y copias afectadas sin exponer datos de terceros;
3. comprobar legal hold, obligaciones y dependencias;
4. definir si corresponde acceso, corrección, anonimización, restricción o
   eliminación;
5. ejecutar mediante un flujo autorizado y auditable;
6. registrar evidencia sanitizada;
7. verificar que no se afectó otro tenant;
8. informar limitaciones sin revelar datos ajenos.

No se ejecuta borrado manual directo en DB como sustituto del flujo aprobado.

## 9. Legal hold y excepciones

Un legal hold debe declarar:

- motivo y autoridad solicitante;
- alcance mínimo;
- clases y activos afectados;
- fecha de inicio;
- owner;
- fecha de revisión;
- criterio de liberación.

Durante el hold se suspende únicamente la disposición de los datos afectados.
El acceso, la minimización, la seguridad y la evidencia sanitizada continúan
siendo obligatorios.

## 10. Datos no productivos

- Staging y testing usan datos sintéticos.
- Está prohibido copiar dumps productivos para conveniencia de pruebas.
- Clinic A/B deben ser inequívocamente ficticias.
- Los tokens de prueba se crean para la ventana autorizada y se revocan al
  terminar cuando el flujo lo permita.
- Las capturas y artefactos no contienen nombres, emails, teléfonos, archivos ni
  historias clínicas reales.

## 11. Borrado, anonimización y backups

Un dato no se considera eliminado sólo porque dejó de ser visible en la UI.
La implementación futura debe definir:

- borrado lógico versus físico;
- propagación a Storage, índices, caches y sistemas derivados;
- tratamiento de backups dentro de su ciclo de expiración;
- preservación mínima de auditoría sin conservar contenido sensible;
- verificación post-borrado;
- rollback permitido antes de la disposición irreversible.

Los backups no se editan para retirar un registro individual. El dato queda
inaccesible en producción y expira con el backup según su política, salvo legal
hold u obligación distinta documentada.

## 12. Evidencia y métricas de gobernanza

La revisión trimestral debe registrar, sin datos sensibles:

- activos inventariados versus pendientes;
- activos con owner y clase;
- políticas de retención implementadas versus documentadas;
- borrados ejecutados y fallidos por clase agregada;
- legal holds activos por cantidad, no por identidad;
- backups fuera de objetivo;
- excepciones vencidas;
- incidentes de acceso o retención.

## 13. Estado de implementación

| Capacidad | Estado |
| --- | --- |
| Política de clasificación | `DOCUMENTED_ONLY` |
| Objetivos numéricos de retención | `DOCUMENTED_ONLY` |
| Inventario completo de activos | `NOT_IMPLEMENTED` |
| Jobs automáticos de retención/borrado | `NOT_IMPLEMENTED` |
| Legal hold operativo | `NOT_IMPLEMENTED` |
| Evidencia de borrado runtime | `NOT_RUN` |
| Revisión legal/jurisdiccional | `BLOCKED` hasta asignación y aprobación específica |

La creación de esta política no autoriza borrar datos ni cambiar schema, runtime,
Storage, backups o proveedores.

## 14. Criterios de cierre del gap documental

`ERM-DATA-002` puede cerrarse documentalmente cuando:

- esta política esté mergeada y enlazada desde el índice vigente;
- exista owner por rol y cadence;
- clasificación, retención, disposición y legal hold estén definidos;
- los límites legales estén explícitos;
- los controles runtime pendientes permanezcan visibles.

La implementación técnica de retención y borrado requiere PRs separados y no se
infiere de este cierre documental.

## 15. Rollback documental

Revertir el commit de esta política restaura el estado documental previo. No
modifica datos, DB, Storage, backups, runtime, dependencias ni configuración
productiva.
