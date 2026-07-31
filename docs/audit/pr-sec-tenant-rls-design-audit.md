# PR-SEC-TENANT-RLS-DESIGN Audit

## Metadata

| Campo | Valor |
| --- | --- |
| Plan | Plan B slot 10/18 |
| PR consolidado | `PR-SEC-TENANT-RLS-DESIGN` |
| Absorbe | `PR-RLS-1` |
| Base exacta | `main@acacf297ba946a6dd8c36723654a2342f4920c3b` |
| Rama | `docs/pr-sec-tenant-rls-design` |
| Scope | docs-only |
| Riesgo | R2, autorizado exclusivamente para diseño documental RLS/tenant |
| Estado de implementación RLS | `NOT_IMPLEMENTED` |
| Estado del piloto | `BLOCKED` |
| Fecha de verificación documental | 2026-07-31 |

## 1. Objetivo

Consolidar el diseño documental de aislamiento tenant y PostgreSQL Row-Level
Security bajo el contrato operativo vigente de `AGENTS.md`, sin implementar
policies, roles, schema, migraciones, SQL ejecutable, contexto runtime ni cambios
de aplicación.

Este slot no reabre la decisión arquitectónica ya aceptada. La realinea con el
protocolo RLS/DB vigente y registra, con estados canónicos, qué precondiciones
impiden avanzar al piloto.

## 2. Fuentes autoritativas revisadas

- [`AGENTS.md`](../../AGENTS.md), especialmente §§3, 4, 9, 11, 13 y 14.
- [RLS tenant isolation ADR](../architecture/rls-tenant-isolation-adr.md).
- [RLS enforcement matrix](../security/rls-enforcement-matrix.md).
- [Enterprise Control Register](../governance/enterprise-control-register.md),
  control `ERM-CTRL-018`.
- [Enterprise Roadmap Consolidation Plan](./enterprise-roadmap-consolidation-plan.md),
  slot 10/18.
- [Backup, Restore and Rollback](../ops/BACKUP_RESTORE_ROLLBACK.md).
- [Cross-tenant Smoke Evidence Runbook](../ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md).
- [Metrics Baseline](../ops/METRICS_BASELINE.md).

## 3. Decisión consolidada

Se conserva la **Alternativa D** de la ADR:

1. El aislamiento tenant aplicativo permanece activo y obligatorio.
2. RLS es una segunda barrera de defensa en profundidad.
3. RLS nunca sustituye filtros, ownership checks, RBAC ni validaciones de la
   capa de aplicación.
4. La implementación futura debe ser incremental, reversible y verificada primero
   en un entorno no productivo controlado.
5. La decisión de gobernanza no demuestra que RLS nativo esté activo.

Estado normativo:

```text
RLS governance decision:          adopted
Application tenant scoping:       mandatory
Native PostgreSQL RLS runtime:     NOT_IMPLEMENTED
Runtime cross-tenant evidence:     BLOCKED
RLS pilot:                         BLOCKED
Production evaluation:             BLOCKED
```

## 4. Scope incluido

- Consolidación documental de la decisión tenant/RLS.
- Boundaries de identidad, conexión, roles y recursos.
- Entry criteria y exit criteria del piloto.
- Estrategia conceptual de rollback.
- Plan de verificación futura.
- Registro explícito de acciones R2/R3 bloqueadas.

## 5. Scope excluido

Quedan fuera y no están autorizados por este slot:

- `server/**`, endpoints, auth, cookies, sesiones o runtime;
- `drizzle/**`, schema, migraciones y DDL;
- policies, roles, grants, ownership o cambios de pooler;
- SQL ejecutable o comandos para una DB;
- `frontend/**`, tests, scripts, workflows y CI;
- dependencias, manifests y lockfile;
- staging, producción o cualquier DB real;
- evidencia runtime obtenida fuera del árbol local.

## 6. Invariantes de aislamiento

### 6.1 Aplicación

- El tenant se deriva exclusivamente de la identidad autenticada.
- Un identificador de clínica enviado por el cliente nunca es autoridad.
- Toda lectura y mutación tenant-scoped conserva filtros y ownership checks
  aplicativos aunque RLS exista en el futuro.
- Ausencia de identidad, identidad inválida o mismatch de ownership deniega
  acceso sin disclosure.

### 6.2 Conexión y contexto futuro

Antes de diseñar policies o contexto runtime se debe verificar externamente:

- rol PostgreSQL efectivo de la conexión runtime;
- `rolsuper` y `rolbypassrls`;
- ownership de cada tabla candidata;
- policies existentes fuera del repositorio;
- tipo y modo del pooler;
- soporte transaccional sobre la misma conexión;
- separación entre runtime tenant, admin, particular/público, jobs y migraciones.

El contexto tenant futuro debe aplicarse por transacción sobre la misma conexión y
no sobrevivir entre requests. Está prohibido usar contexto persistente sobre
conexiones reutilizadas.

### 6.3 Actores

| Actor | Boundary obligatorio | Rol conceptual futuro | Estado runtime RLS |
| --- | --- | --- | --- |
| Clínica | identidad autenticada → `clinicId` | runtime tenant no privilegiado | `NOT_IMPLEMENTED` |
| Admin | operación global explícita y auditada | runtime admin separado | `NOT_IMPLEMENTED` |
| Particular | sesión/token → recurso vinculado | runtime particular limitado | `NOT_IMPLEMENTED` |
| Público con token | token resuelto server-side → recurso vinculado | acceso público limitado | `NOT_IMPLEMENTED` |
| Jobs | job identificado, permisos mínimos | background separado | `NOT_IMPLEMENTED` |
| Migraciones | DDL y ownership fuera del tráfico runtime | migration owner | `NOT_IMPLEMENTED` |

## 7. Familias de recursos candidatas

La matriz vigente continúa siendo la fuente de detalle por recurso. Para un piloto
futuro, la ADR recomienda comenzar por:

1. `reports`;
2. `report_status_history`.

La expansión permanece separada y condicionada: access tokens, particular tokens,
tracking, audit log, logística, perfiles y storage relacionado no entran en el
primer piloto por conveniencia ni se habilitan mediante este documento.

## 8. Entry criteria del piloto

El piloto sólo puede cambiar de `BLOCKED` cuando **todos** los criterios tengan
evidencia observada y sanitizada.

| Criterio | Evidencia actual | Estado |
| --- | --- | --- |
| Rol efectivo de conexión identificado | No verificado contra DB autorizada | `BLOCKED` |
| `rolsuper` verificado | No verificado | `BLOCKED` |
| `rolbypassrls` verificado | No verificado | `BLOCKED` |
| Ownership de tablas candidato conocido | No verificado | `BLOCKED` |
| Policies externas inventariadas | No verificadas | `BLOCKED` |
| Tipo y modo de pooler confirmado | No verificado | `BLOCKED` |
| Transacciones compatibles sobre la misma conexión | No verificadas | `BLOCKED` |
| Rol tenant `NOSUPERUSER` / `NOBYPASSRLS` disponible | No creado ni verificado | `BLOCKED` |
| Backup apto para el drill | Existe evidencia histórica de dump/export; aptitud y vigencia para el piloto no verificadas | `BLOCKED` |
| Restore drill no productivo | Runbook registra pendiente de ejecución | `BLOCKED` |
| Rollback drill observado | No existe evidencia de ejecución | `BLOCKED` |
| Observabilidad mínima runtime | Sólo existe baseline documental; sin collectors, alertas ni dashboards | `BLOCKED` |
| Evidencia cross-tenant CT-01..CT-16 | Runbook en NO-GO; ejecución no registrada | `BLOCKED` |
| Matriz RLS aprobada para piloto | Matriz documentada; aprobación operacional no observada | `BLOCKED` |
| Entorno no productivo controlado | No identificado ni autorizado para este slot | `BLOCKED` |
| Datos sintéticos Clinic A / Clinic B | No preparados ni verificados | `BLOCKED` |
| Responsable de seguridad asignado | Rol documental definido; asignación operacional no observada | `BLOCKED` |
| Responsable DB asignado | Rol documental definido; asignación operacional no observada | `BLOCKED` |
| Autorización específica para piloto | La autorización actual es sólo R2 docs-only | `BLOCKED` |

**Resultado:** `RLS pilot = BLOCKED`.

## 9. Exit criteria del piloto

Todos permanecen `NOT_RUN` porque el piloto no fue autorizado ni ejecutado:

- Clinic A puede leer y mutar exclusivamente sus filas.
- Clinic A no puede leer ni mutar filas de Clinic B.
- Ausencia de contexto deniega acceso.
- Contexto inválido deniega acceso.
- Admin autorizado conserva sus operaciones requeridas.
- Particular y token público quedan limitados al recurso vinculado.
- Jobs usan un rol explícito y mínimo.
- No existe contaminación de contexto entre conexiones.
- Rollback fue probado.
- Restore fue verificado.
- Tests aplicativos y tests DB están verdes.
- Logs y evidencia están sanitizados.

## 10. Estrategia de rollback conceptual

Este slot no escribe ni autoriza SQL de rollback. La implementación futura debe:

- preservar siempre el scoping aplicativo;
- permitir retirar de forma controlada el enforcement RLS nuevo;
- revertir la selección del rol runtime y el helper transaccional;
- verificar rutas públicas y privadas después del rollback;
- coordinar con backup y restore;
- probar rollback antes de cualquier evaluación productiva.

Un documento o runbook no equivale a un rollback probado.

## 11. Plan de verificación futuro

Orden obligatorio para trabajos posteriores:

1. Verificación externa R0/R3 autorizada de rol, privilegios, ownership, pooler,
   transacciones y policies externas.
2. Cierre de restore, rollback, observabilidad y evidencia cross-tenant en sus
   scopes separados.
3. Diseño técnico específico del piloto con su propia autorización R2.
4. Harness no productivo con datos sintéticos Clinic A/B.
5. Piloto RLS autorizado como R3.
6. Evaluación de expansión sólo después de exit criteria completos.

No se puede inferir un paso como `PASSED` por la existencia del documento del paso
anterior.

## 12. Validación de este slot

| Validación | Resultado | Estado |
| --- | --- | --- |
| Lectura completa de `AGENTS.md` vigente | Contrato RLS/DB identificado | `PASSED` |
| Censo de `AGENTS.md` anidados | La evidencia de baseline confirmó sólo el raíz | `PASSED` |
| Base remota | `main@acacf297ba946a6dd8c36723654a2342f4920c3b` | `PASSED` |
| Fuentes rectoras RLS/DR/observabilidad | Revisadas mediante GitHub connector | `PASSED` |
| Scope | Un archivo nuevo bajo `docs/audit/**` | `PASSED` |
| Secretos y datos clínicos | No incluidos | `PASSED` |
| SQL ejecutable | No incluido | `PASSED` |
| Backend / frontend / tests / DB | Fuera de scope | `NOT_RUN` |
| Staging / producción | Sin autorización R3 | `BLOCKED` |
| `git diff --check` local | Checkout local no disponible en el runtime del agente | `NOT_AVAILABLE` |

Los checks remotos del PR son la validación ejecutable pendiente y no se declaran
`PASSED` hasta observar su resultado.

## 13. Riesgos residuales

- El aislamiento tenant depende actualmente de la capa de aplicación.
- El rol efectivo, privilegios, ownership, pooler y policies externas siguen sin
  verificación operacional.
- Restore, rollback, observabilidad runtime y smoke cross-tenant siguen abiertos.
- La existencia de una ADR aceptada no reduce por sí sola el riesgo runtime.

## 14. Rollback del cambio documental

Revertir el único commit de este slot elimina este closeout sin impacto en runtime,
DB, datos, dependencias ni configuración productiva.

## 15. Resultado

`PR-SEC-TENANT-RLS-DESIGN` queda implementado como consolidación documental
R2/docs-only. La decisión arquitectónica permanece adoptada; la implementación
nativa y el piloto permanecen `BLOCKED`. Este slot no autoriza ni adelanta los
slots operativos posteriores.