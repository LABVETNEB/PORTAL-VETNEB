# Release Evidence Archive Policy

Política vigente para almacenar, sanitizar, retener y localizar evidencia de
releases de VETNEB.

## Metadata

| Campo | Valor |
| --- | --- |
| Document owner | Release / Ops owner |
| Domain | Release and production readiness |
| Lifecycle status | ACTIVE |
| Authoritative source role | Política de archivo y retención de evidencia de release |
| Effective date | 2026-08-01 |
| Last verified date | 2026-08-01 |
| Review cadence | Anual y ante cambios del proceso de release |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-023`; `ERM-REL-001`; Plan B Slot 17 |
| Evidence or approval reference | Autorización R3 de Slot 17 y evidencia sanitizada de GitHub environments |

## Propósito

Definir dónde vive la evidencia de cada release, qué datos puede contener,
durante cuánto tiempo se conserva y qué elementos no pueden almacenarse.

Esta política no ejecuta deploys, rollbacks, restore drills, smoke tests ni
operaciones sobre staging o producción.

## Ubicaciones canónicas

| Evidencia | Ubicación |
| --- | --- |
| Política go/no-go | `docs/release/release-go-no-go-policy.md` |
| Registro sanitizado de un release | `docs/release/evidence/<release-id>.md` |
| Evidencia de configuración de environments | `docs/release/production-readiness-environments-evidence.md` |
| Checks y PRs | GitHub, enlazados desde el registro sanitizado |
| Runs y artifacts CI | GitHub Actions, enlazados por run ID |
| Backup, restore y rollback | Fuera del repositorio; solo acta sanitizada y checksums de integridad de archivos no secretos permitidos |
| Evidencia histórica reemplazada | `docs/HISTORICAL_DOCUMENTATION.md` o archivo marcado como histórico |

No se versionan ZIP, dumps, bases de datos, exportaciones de Storage, cookies,
tokens, signed URLs activas, credenciales ni logs sin sanitizar.

## Identificador de release

Cada registro debe usar un identificador estable:

```text
YYYY-MM-DD-<tipo>-<commit-corto>
```

Tipos permitidos:

- `docs`
- `patch`
- `security`
- `data`
- `ci`
- `major`

## Contenido mínimo

Cada registro de release debe incluir:

- timestamp UTC;
- commit o deploy exacto;
- PRs incluidos;
- entorno;
- tipo y scope;
- actor u owner por rol;
- validaciones con estado canónico;
- decisión `GO`, `NO-GO` o `BLOCKED`;
- rollback trigger;
- rollback steps;
- data impact;
- riesgos residuales;
- enlaces a checks, runs o artifacts sanitizados;
- confirmación de ausencia de secretos y datos clínicos reales.

## Retención

| Clase de evidencia | Retención mínima |
| --- | ---: |
| Release estándar | 24 meses desde la fecha de release |
| Security, auth, tenant isolation o datos | 60 meses |
| Incidente, rollback o restore drill | 60 meses |
| PR, commit y checks gobernados por GitHub | Según retención de la plataforma; el registro conserva identificadores durables |
| Evidencia sustituida por una corrección | Conservar junto con la corrección durante el plazo de la clase aplicable |

La eliminación al finalizar el plazo requiere revisión del Release / Ops owner y
confirmación de que no existe legal hold, incidente abierto, auditoría pendiente
ni obligación de conservación superior.

## Sanitización

Está permitido registrar:

- IDs de PR, commit, run y job;
- estados de checks;
- nombres de environments;
- configuración no secreta de deployment protection;
- timestamps;
- duración;
- commit SHAs públicos;
- checksums de integridad de archivos no secretos;
- tamaños;
- resultados de smoke sanitizados.

Está prohibido registrar:

- secrets;
- tokens;
- cookies;
- passwords;
- connection strings;
- signed URLs activas;
- headers de autorización;
- dumps;
- paths privados de Storage;
- datos clínicos reales;
- emails reales no sanitizados;
- payloads o logs sensibles;
- password hashes;
- session-token hashes;
- credential-derived hashes;
- secret-derived hashes o digests derivados de material de autenticación.

## Relación con go/no-go

La decisión go/no-go debe enlazar su registro de evidencia y declarar la clase
de retención aplicable.

La existencia de un archivo no convierte una validación en `PASSED`. Toda
validación no ejecutada debe permanecer `NOT_RUN` o `BLOCKED`.

## Excepción operativa de Slot 17

Slot 17 fue autorizado antes del cierre de Slot 13.

Por ello:

- los GitHub environments pueden quedar configurados y evidenciados;
- el restore drill y el rollback end-to-end permanecen `BLOCKED`;
- un deploy productivo no se infiere ni se autoriza por esta política;
- production readiness permanece `PARTIAL/BLOCKED`;
- `ERM-CTRL-023` no debe declararse completamente cerrado por narrativa.

## Rollback documental

Revertir el futuro commit de esta unidad elimina únicamente esta política y sus
enlaces documentales.

La eliminación de GitHub environments es una operación R3 separada y no forma
parte del rollback documental.
