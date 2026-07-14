# ADR: PostgreSQL Row-Level Security for Tenant Isolation

> **Tipo:** ADR **docs-only**. No implementa RLS, no crea policies, roles,
> migraciones ni SQL ejecutable; no toca `server/**`, `drizzle/**`, `scripts/**`,
> `test/**`, `frontend/**`, `.github/**`, `package.json` ni lockfiles. Registra una
> decisión de gobernanza.
> **Base:** `main` limpio · **HEAD:** `fa8dac8` ci(governance): add app-published qga-workflow-security check workflow (#1460).
> **Documentos rectores:** [`docs/security/security-sessions-tenant-rls-audit.md`](../security/security-sessions-tenant-rls-audit.md) (PR-S1), [`docs/security/rls-enforcement-matrix.md`](../security/rls-enforcement-matrix.md) (PR-S2), [`docs/audit/total-software-engineering-audit.md`](../audit/total-software-engineering-audit.md) (ENG-P1-001).
> **Control asociado:** `ERM-CTRL-018` RLS Governance ([Enterprise Control Register](../governance/enterprise-control-register.md)).
> **Modelo / esfuerzo:** Claude Opus 4.8 · xhigh.

## 1. Title

PostgreSQL Row-Level Security como arquitectura objetivo de defensa en profundidad
para el aislamiento tenant de Portal VETNEB.

## 2. Status

**Accepted.**

Este estado cierra la **decisión de gobernanza**: VETNEB adopta RLS nativo como
arquitectura objetivo, mediante una implementación incremental, reversible y
validada primero en un entorno no productivo, sin abandonar el aislamiento
aplicativo existente.

La aprobación del ADR **no** afirma que RLS nativo esté activo. La distinción es
normativa y se mantiene explícita en todo el documento:

```
ADR status:                 Accepted
RLS governance decision:    adopted
Application-level enforcement: active and mandatory
Native PostgreSQL RLS runtime: not implemented
Runtime evidence:           pending
```

## 3. Date

2026-07-14

## 4. Owners

| Rol | Responsabilidad sobre esta decisión |
| --- | --- |
| Security / Backend owner | Accountable del ADR, del control `ERM-CTRL-018` y de las precondiciones/criterios de piloto. |
| DBA / DevOps | Consultado para verificación externa (Fase 1), diseño de roles y harness no productivo (Fase 2), backup/restore y rollback. |
| Release / Ops owner | Consultado para el go/no-go de cualquier evaluación productiva (Fase 5). |

Los owners son roles, no personas, coherentes con
[`docs/governance/ownership-model.md`](../governance/ownership-model.md) y con la
fila `ERM-CTRL-018` del control register.

## 5. Context

Portal VETNEB es un sistema **multi-tenant de datos clínicos**. El estado técnico
auditado (PR-S1, PR-S2 y ENG-P1-001 de la auditoría de ingeniería) es:

- **No existen políticas PostgreSQL RLS versionadas en el repositorio.** No hay
  `CREATE POLICY`, `ENABLE ROW LEVEL SECURITY` ni `FORCE ROW LEVEL SECURITY` en
  `server/**`, `drizzle/**` ni `scripts/**`; esas cadenas sólo aparecen en
  documentos de auditoría/gap register.
- **No existe propagación de contexto tenant a la DB.** No hay uso de
  `current_setting(...)` ni de `auth.uid()` para RLS.
- Las migraciones contienen `clinic_id`, índices y claves foráneas, pero **no
  policies**.
- El backend usa **conexión PostgreSQL directa** mediante `postgres(...)` y
  Drizzle. El repositorio no permite determinar si el rol efectivo de esa conexión
  estaría sujeto a RLS: el driver no determina el bypass. La aplicabilidad de las
  policies depende de los privilegios del rol, incluidos `rolsuper`,
  `rolbypassrls`, el ownership de las tablas y el uso de `FORCE ROW LEVEL
  SECURITY`; esas condiciones no están confirmadas por la evidencia del repositorio
  y deben verificarse externamente en la Fase 1.
- El enforcement tenant verificable desde el repositorio depende de la capa de
  aplicación: `auth.clinicId`, ownership checks, RBAC, helpers scoped, validaciones
  de correspondencia entre clínica, reporte y token, y separación de superficies
  clínica, admin, particular y pública. El repositorio no demuestra si existen
  policies RLS externas.

Este ADR materializa el `Next action` de `ERM-CTRL-018` ("Create ADR deciding
native RLS or accepted application-level enforcement with compensating controls")
y el hallazgo ENG-P1-001 ("Registrar ADR de la decisión de aislamiento"). Nace
como cierre de la decisión de gobernanza, no como implementación.

**Restricciones (de `AGENTS.md` y del protocolo VETNEB):** docs-only; sin código,
DB, migraciones, dependencias ni CI; no consultar secretos ni bases reales; no
afirmar evidencia no verificada; mantener el aislamiento aplicativo intacto.

**Nivel de riesgo de este PR:** nulo (documental).

## 6. Problem statement

El enforcement tenant demostrable desde el repositorio depende de la corrección
del código de aplicación. **No existe una barrera RLS independiente versionada y
verificada por la evidencia disponible en el repositorio.** Un único endpoint o
query que olvide el filtro de tenant (`clinicId`, `reportId`, `particularTokenId`,
`tokenHash`) puede exponer o mutar datos clínicos cruzados si no hay una policy que
lo impida. Si el rol efectivo resultara superuser, tuviera `BYPASSRLS` o fuera
owner de las tablas sin `FORCE ROW LEVEL SECURITY`, las policies podrían no
aplicarse a esa conexión. Ese estado no está verificado y debe resolverse mediante
la verificación externa de la Fase 1.

El problema a decidir es **cómo incorporar una segunda barrera de aislamiento a
nivel de base de datos** sin romper admin, tokens, jobs ni migraciones, y sin
depender de suposiciones sobre el rol de conexión, el pooler o la existencia de
policies externas —hechos que hoy **no** están verificados operacionalmente.

## 7. Architectural forces

- **Defensa en profundidad vs. capa única.** El sistema necesita una segunda
  barrera; hoy toda la autorización recae en una sola capa.
- **Seguridad vs. riesgo operativo.** Activar RLS sin rol no privilegiado
  verificado, sin harness no productivo y sin rollback probado puede romper
  operaciones legítimas (admin, tokens, jobs, migraciones).
- **Autenticación propia vs. modelos RLS de terceros.** VETNEB usa autenticación
  propia con sesiones separadas por superficie; el contexto RLS debe derivarse de
  ese modelo, no de `auth.uid()` de Supabase Auth.
- **Pooler y contexto por conexión.** El contexto tenant transaccional interactúa
  con el modo del pooler; una configuración incorrecta introduce riesgo de
  contaminación de contexto entre requests.
- **Reversibilidad.** Cualquier cambio debe ser reversible y estar coordinado con
  backup/restore.
- **Incrementalidad.** El cambio debe llegar por PRs chicos, trazables y
  verificados, nunca big-bang.

## 8. Decision

Se adopta la **Alternativa D**: RLS incremental manteniendo el scoping aplicativo.

- VETNEB **mantiene obligatoriamente** el tenant scoping aplicativo existente.
- VETNEB **adopta PostgreSQL RLS como arquitectura objetivo** de defensa en
  profundidad.
- La implementación será **incremental, reversible y validada primero en un
  entorno no productivo**.
- Este ADR **no implementa RLS**, no crea policies, roles, migraciones ni SQL
  ejecutable, y no modifica runtime, DB, Drizzle ni conexiones.
- El aislamiento aplicativo **sigue siendo obligatorio incluso después** de una
  futura implementación de RLS. RLS es una segunda barrera, **no un reemplazo**.

Este ADR **aplica a**: la dirección arquitectónica de aislamiento tenant a nivel
de datos y la gobernanza de su implementación futura.

Este ADR **no aplica a**: la implementación runtime de RLS, el schema/DB, el modelo
de auth, las rutas públicas ni cualquier cambio de código.

## 9. Current enforcement model

El enforcement vigente es **application-level, activo y obligatorio**:

- resolución de identidad y `auth.clinicId` por sesión de clínica;
- cookies separadas por superficie (`app_session_id`, `admin_session_id`,
  `particular_session_id`);
- RBAC y ownership checks explícitos;
- helpers de query scoped por `clinicId` / `reportId` / `particularTokenId` /
  `tokenHash`;
- validaciones de correspondencia entre clínica, reporte y token;
- separación de superficies clínica, admin, particular y pública;
- sanitización de respuestas y trusted-origin/CSRF en mutaciones cookie-auth;
- tests de IDOR, ownership, permission surface y disclosure;
- auditoría (`audit_log`).

Este modelo **no se degrada** por esta decisión.

## 10. Target defense-in-depth model

El modelo objetivo suma, **sin retirar** lo anterior, una barrera en la base de
datos:

- policies RLS por tabla/familia de recurso tenant-scoped;
- un rol de runtime **no privilegiado** (`NOSUPERUSER`, `NOBYPASSRLS`) que ejecuta
  las queries tenant-scoped;
- contexto tenant propagado **por transacción** sobre la misma conexión de la
  operación;
- separación de roles para admin, background/mantenimiento y migraciones/DDL.

RLS queda documentado como **segunda barrera de seguridad**. Si el código
aplicativo olvidara un filtro, la policy debe impedir el acceso cross-tenant.

## 11. Tenant context propagation

Dirección técnica futura (ilustrativa, **no se implementa en este PR**):

```sql
SET LOCAL app.current_clinic_id = '<validated-clinic-id>';
```

Condiciones obligatorias para esa futura implementación:

- el valor debe derivarse **exclusivamente** de la identidad autenticada;
- **nunca** debe confiarse en un `clinicId` enviado por el cliente;
- debe ejecutarse **dentro de una transacción**;
- debe aplicarse sobre la **misma conexión** utilizada por las queries de la
  operación;
- está **prohibido** usar `SET` persistente sobre conexiones reutilizadas;
- el contexto **no debe sobrevivir entre requests**;
- el pool de conexiones introduce **riesgo de contaminación de contexto**;
- debe existir **limpieza garantizada por el límite transaccional**;
- este PR **no implementa** este SQL.

## 12. Database role separation

Roles definidos **conceptualmente** (no se asume que existan hoy):

| Rol | Propósito | Atributos / límites |
| --- | --- | --- |
| Runtime tenant | Operaciones tenant-scoped | No privilegiado; `NOSUPERUSER`; `NOBYPASSRLS`; requiere contexto tenant transaccional. |
| Runtime público / particular | Acceso público y de token particular | Acceso limitado; policies o funciones específicas; no hereda acceso tenant global; no confía en IDs del cliente; los tokens se resuelven server-side. |
| Runtime admin | Operaciones globales explícitas | Separado del tráfico tenant; auditado; no usado como conexión general de requests de clínica. |
| Migration owner | DDL, policies, ownership, migraciones | Fuera del tráfico runtime. |
| Background / mantenimiento | Jobs y limpieza | Rol separado; permisos mínimos; jobs identificados; operaciones auditables; sin reutilización accidental del rol tenant. |

**No se asume** que estos roles existan actualmente ni que la cuenta vigente sea o
no superuser; ver Fase 1 (verificación externa).

## 13. Admin handling

Las operaciones admin son globales y explícitas. Deben ejecutarse con un rol admin
separado del tráfico tenant, auditadas, y **no** deben usar la conexión general de
requests de clínica. RLS no debe romper las operaciones admin autorizadas: el
piloto y la expansión deben preservar admin autorizado y bloquear el resto.

## 14. Public handling

La superficie pública y de token particular no debe heredar acceso tenant global.
El acceso debe limitarse a las policies/funciones específicas del recurso vinculado
y **los tokens deben resolverse server-side**, nunca confiando en IDs del cliente.

## 15. Particular handling

El acceso particular queda limitado al token/reporte vinculado. El contexto RLS
para particular debe derivarse del modelo de autenticación propio del backend
(sesión `particular_session_id` → `particularTokenId` + `clinicId` asociado), no de
`auth.uid()`.

## 16. Background jobs and maintenance handling

Los jobs de background y mantenimiento (p.ej. limpieza de sesiones y rate-limits
expirados) deben usar un rol separado con permisos mínimos, con jobs identificados
y operaciones auditables, sin reutilizar accidentalmente el rol de runtime tenant y
sin depender de contexto tenant de request.

## 17. Alternatives considered

| Alternativa | Pros | Cons | Decisión |
| --- | --- | --- | --- |
| **A** — Mantener solo enforcement aplicativo | Cero cambio; funciona y está testeado hoy | Una query sin scope puede exponer datos; no hay barrera independiente en la DB; depende por completo de la corrección del código | **Rechazada como arquitectura final.** Puede mantenerse temporalmente hasta completar las precondiciones. |
| **B** — Activar RLS inmediatamente en todas las tablas | Barrera DB inmediata | No existe rol no privilegiado verificado; no hay harness DB no productivo; no hay rollback RLS probado; no hay confirmación del pooler; puede romper admin, tokens, jobs y migraciones; alto riesgo operativo | **Rechazada.** |
| **C** — Reemplazar scoping aplicativo por RLS | Menos duplicación aparente | Elimina la defensa en profundidad; hace depender toda la autorización de una única capa | **Rechazada.** |
| **D** — RLS incremental manteniendo scoping aplicativo | Segunda barrera real; reversible; verificable por fases; sin big-bang | Requiere verificación externa, harness y disciplina de fases | **Seleccionada.** |

## 18. Consequences

### Positive

- Dirección arquitectónica de aislamiento tenant explícitamente decidida y
  gobernada.
- Se habilita una segunda barrera de seguridad de datos sin degradar la primera.
- El camino es incremental, reversible y trazable.

### Negative / tradeoffs

- La implementación real exige verificación externa y un harness no productivo
  antes de tocar policies.
- Convivencia temporal de una sola barrera (aplicativa) hasta que el piloto
  demuestre la segunda.
- Costo de mantener roles, contexto transaccional y evidencia por fase.

### Operational impact

- Nulo en este PR (docs-only). El impacto operativo real llega en fases futuras,
  cada una con su go/no-go.

### Security / data impact

- Nulo en este PR. La decisión **no** afirma que RLS esté activo ni cierra la
  evidencia runtime cross-tenant; el bloque runtime permanece **pendiente**.

## 19. Threats and failure modes

- **Olvido de filtro de tenant en app** → hoy sin red DB; el modelo objetivo lo
  mitiga con policies.
- **Contaminación de contexto por pool** → contexto que sobrevive entre requests;
  se mitiga con contexto transaccional y limpieza por límite de transacción.
- **Rol privilegiado / `BYPASSRLS`** → policies inertes; se mitiga con rol
  `NOBYPASSRLS` verificado.
- **Confianza en `clinicId` del cliente** → escalada cross-tenant; prohibido:
  contexto derivado sólo de identidad autenticada.
- **Ruptura de admin/tokens/jobs/migraciones** al activar RLS → se mitiga con
  separación de roles y validación previa en no producción.
- **Rollback no probado** → incidente irreversible; se mitiga probando rollback y
  restore antes de producción.

## 20. Incremental implementation phases

- **Fase 0 — ADR y gobernanza (este PR).** Registra la decisión, dirección
  técnica, responsabilidades y condiciones. No modifica DB ni runtime.
- **Fase 1 — Verificación externa.** Antes de diseñar policies: identificar el rol
  efectivo de `DATABASE_URL` / `SUPABASE_DB_URL`; verificar `rolsuper`,
  `rolbypassrls` y ownership; inventariar policies creadas fuera del repositorio;
  confirmar tipo y modo del pooler; confirmar soporte de transacciones; confirmar
  capacidad de crear roles separados; confirmar comportamiento de migraciones.
- **Fase 2 — Diseño y harness no productivo.** Rol runtime no privilegiado;
  contexto tenant transaccional; helper seguro; tests DB Clinic A/B; separación
  admin/background; rollback documentado; observabilidad suficiente.
- **Fase 3 — Piloto.** Familia inicial recomendada: `reports` y
  `report_status_history`, sólo en entorno no productivo (ver §21, §22).
- **Fase 4 — Expansión.** Orden recomendado: `report_access_tokens` →
  `particular_tokens` → `study_tracking_cases` → `study_tracking_notifications` →
  `audit_log` → logística tenant-scoped → perfiles y storage relacionado.
- **Fase 5 — Evaluación productiva.** Sólo después de: piloto verde;
  observabilidad; restore/DR; rollback probado; autorización DB; revisión de
  seguridad; evidencia runtime; y un go/no-go explícito.

## 21. Pilot entry criteria

El piloto permanece **bloqueado** hasta cumplir todos estos criterios:

- rol PostgreSQL efectivo verificado;
- rol tenant `NOBYPASSRLS`;
- ownership de tablas conocido;
- pooler identificado;
- transacciones compatibles;
- entorno no productivo controlado;
- datos Clinic A/B;
- observabilidad;
- rollback;
- restore/DR;
- tests DB;
- responsable de seguridad;
- responsable DB;
- autorización explícita.

## 22. Pilot exit criteria

El piloto sólo se considera exitoso cuando:

- Clinic A no puede **leer** filas de Clinic B;
- Clinic A no puede **mutar** filas de Clinic B;
- la **ausencia de contexto** no concede acceso;
- el **contexto inválido** no concede acceso;
- el admin autorizado conserva las operaciones requeridas;
- particular y public token funcionan sólo sobre recursos vinculados;
- los background jobs usan rol explícito;
- no existe contaminación de contexto entre conexiones;
- el rollback fue probado;
- el restore fue verificado;
- los tests aplicativos siguen verdes;
- los tests DB están verdes;
- la evidencia está sanitizada.

El piloto debe cubrir, como mínimo: lectura propia; bloqueo de lectura ajena;
mutación propia; bloqueo de mutación ajena; listados filtrados; operación admin;
particular token; public token; ausencia de contexto; contexto inválido;
transacción; rollback; pool reuse; y logs sanitizados.

## 23. Rollback strategy

Estrategia conceptual (sin migraciones ni SQL de rollback en este PR):

- deshabilitación controlada de policies;
- reversión del rol de runtime;
- restauración del modelo de conexión anterior;
- reversión del helper tenant-aware;
- verificación post-rollback;
- **no** eliminar el scoping aplicativo;
- **no** depender únicamente del rollback lógico;
- coordinar con backup/restore ([`docs/ops/BACKUP_RESTORE_ROLLBACK.md`](../ops/BACKUP_RESTORE_ROLLBACK.md));
- probar el rollback **antes** de producción.

## 24. Verification plan

- **Docs review** de este ADR y de las actualizaciones asociadas (matriz RLS,
  control register, Sources of Truth).
- Test nativo aplicable:
  `test/architecture/security/security-docs-matrix-drift-guard.test.ts` (guardrail
  documental; conserva anchors y estado NO-GO/pendiente de la matriz).
- Verificación externa de Fase 1 registrada como **pendiente** (rol efectivo,
  `rolsuper`, `rolbypassrls`, ownership, pooler, transacciones, roles, policies
  externas).
- Evidencia runtime cross-tenant y de piloto: **pendiente**, se produce en fases
  posteriores con evidencia sanitizada.

## 25. Follow-up PR boundaries

- Este ADR no habilita cambios de código, DB, migraciones, dependencias ni CI.
- Cada fase futura es un PR separado, de scope acotado, con su propia validación,
  autorización y evidencia.
- La verificación externa (Fase 1) y el harness (Fase 2) preceden a cualquier PR
  que cree policies o roles.
- No se implementa `SET LOCAL`, helper transaccional, policies ni roles hasta que
  las precondiciones estén verificadas y autorizadas.

## 26. Review triggers

Revisar / reabrir esta decisión ante:

- resultados de la verificación externa (Fase 1) que contradigan supuestos;
- cambio del rol de conexión, del pooler o del modelo de despliegue;
- aparición de policies externas no versionadas;
- incidente de seguridad tenant;
- cambio del modelo de autenticación propio;
- cualquier autorización o evidencia que habilite avanzar/retroceder de fase.

Cadencia mínima alineada con `ERM-CTRL-018`: trimestral y por release.

## 27. Residual risks

- Mientras rija sólo la barrera aplicativa, un olvido de scope sigue siendo un
  riesgo real (mitigado por tests y revisión, no por la DB).
- Los supuestos sobre rol, pooler y policies externas **no** están verificados;
  hasta Fase 1 son incertidumbre.
- La contaminación de contexto por pool es un riesgo intrínseco de la
  implementación futura, a validar en el harness.
- La evidencia runtime cross-tenant permanece pendiente y **no** se cierra con esta
  decisión.

## 28. Explicit distinction between governance decision and runtime implementation

```
RLS governance decision:        adopted (ADR Accepted)
Application-level enforcement:   active and mandatory
Native PostgreSQL RLS runtime:   not implemented
Runtime evidence:               pending
```

La aprobación de este ADR cierra la **decisión de gobernanza** de `ERM-CTRL-018`.
**No** afirma que RLS nativo esté activo, **no** cierra la evidencia runtime
cross-tenant y **no** modifica el estado NO-GO técnico/runtime de la matriz RLS. El
enforcement aplicativo continúa siendo obligatorio.

## Related PRs / documents

- [`docs/security/security-sessions-tenant-rls-audit.md`](../security/security-sessions-tenant-rls-audit.md) — PR-S1, auditoría rectora.
- [`docs/security/rls-enforcement-matrix.md`](../security/rls-enforcement-matrix.md) — PR-S2, matriz por tabla/recurso.
- [`docs/audit/total-software-engineering-audit.md`](../audit/total-software-engineering-audit.md) — ENG-P1-001.
- [`docs/governance/enterprise-control-register.md`](../governance/enterprise-control-register.md) — `ERM-CTRL-018`.
- [`docs/governance/adr-template.md`](../governance/adr-template.md) — plantilla de ADR de la casa.
- [`docs/ops/BACKUP_RESTORE_ROLLBACK.md`](../ops/BACKUP_RESTORE_ROLLBACK.md) — rollback/backup/restore operativo.
