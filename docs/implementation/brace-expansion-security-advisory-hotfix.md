# Brace Expansion Security Advisory Hotfix

## Estado base

- Repositorio: `LABVETNEB/PORTAL-VETNEB`.
- Base del cambio: `c27e9d7cad98d4cf9a203e97c0ba083b7c3ab731`.
- Rama: `fix/security-brace-expansion-5-0-8`.
- Pull request: `#1571`.
- Gestor: PNPM `11.13.0`.
- Estado productivo inicial: `pnpm audit --prod` sin vulnerabilidades conocidas.
- Estado completo inicial: `pnpm audit` fallaba por una vulnerabilidad alta en una dependencia transitiva del tooling frontend.

## Alcance incluido

- Consolidación de los overrides de `brace-expansion` para cubrir todas las versiones vulnerables.
- Regeneración mecánica de `pnpm-lock.yaml`.
- Actualización del contrato ejecutable de seguridad del toolchain.
- Documentación de la auditoría, validaciones, riesgo residual y rollback.

## Alcance excluido

- Código de aplicación backend.
- Código de aplicación frontend.
- Schema, migraciones y acceso a datos.
- Auth, cookies, CORS, CSP, rate limits y configuración productiva.
- Actualizaciones generales de dependencias.
- Playwright y cambios visuales.

## Auditoría previa

La auditoría productiva finalizaba correctamente:

```text
pnpm audit --prod = PASSED, exit 0
```

La auditoría completa reproducía el advisory:

```text
pnpm audit = FAILED, exit 1
Advisory = GHSA-mh99-v99m-4gvg
Package = brace-expansion
Vulnerable versions = <=5.0.7
Patched versions = >=5.0.8
Severity = high
```

El primer intento de corrección actualizó la resolución `5.0.7`, pero conservó `brace-expansion@1.1.16` en ramas transitivas del tooling ESLint del frontend. Por ese motivo el audit completo continuaba fallando.

## Causa raíz

Los overrides históricos cubrían rangos fragmentados y permitían que una rama transitiva permaneciera en `brace-expansion@1.1.16`, versión incluida en el rango vulnerable del advisory. La resolución parcheada para el rango moderno no cubría esa rama antigua.

## Cambios implementados

- Los overrides fragmentados se reemplazaron por un único contrato:

```yaml
"brace-expansion@<=5.0.7": "5.0.8"
```

- `pnpm-lock.yaml` fue regenerado con PNPM `11.13.0`.
- Se eliminaron las resoluciones vulnerables de `brace-expansion` y transitivas ya innecesarias.
- `test/architecture/toolchain-contract.test.ts` fue actualizado para fijar el override nuevo como contrato ejecutable.
- No se modificó código de aplicación.

## Archivos

- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `test/architecture/toolchain-contract.test.ts`
- `docs/implementation/brace-expansion-security-advisory-hotfix.md`

## Validaciones

| Validación | Estado | Evidencia |
|---|---|---|
| Toolchain contract | PASSED | 8/8 |
| `pnpm audit --prod` | PASSED | exit 0; sin vulnerabilidades conocidas |
| `pnpm audit` | PASSED | exit 0; sin vulnerabilidades conocidas |
| `pnpm validate:local` | PASSED | 3704 tests; 3703 pass; 1 skip; 0 fail; build incluido |
| Frontend lint | PASSED | exit 0 |
| Frontend typecheck | PASSED | exit 0 |
| Frontend build | PASSED | exit 0 |
| `pnpm security:public-surface` | PASSED | sin exposición pública detectada |
| `git diff --check` | PASSED | sin findings |
| Playwright | NOT_RUN | excluido del alcance de este hotfix no visual |
| Migraciones adicionales | NOT_RUN | no hubo cambios de schema ni migraciones |

## Resultado

La resolución transitiva queda consolidada en `brace-expansion@5.0.8`. Ambos audits finalizan con exit code 0 y el contrato del toolchain protege el override requerido.

## Riesgo residual

- El cambio afecta únicamente una resolución transitiva del tooling.
- No cambia el runtime productivo ni fuentes backend/frontend.
- La compatibilidad del tooling queda cubierta por lint, typecheck, build y la suite local completa.
- Permanece el riesgo general de advisories futuros en dependencias transitivas; se controla mediante los audits obligatorios de CI.

## Rollback

Revertir conjuntamente el override, el lockfile, el contrato ejecutable y este documento. No debe revertirse sólo una parte porque se rompería la correspondencia entre configuración, resolución y guard de arquitectura.

## Estado final

- Corrección de seguridad: `PASSED`.
- `pnpm audit --prod`: `PASSED`.
- `pnpm audit`: `PASSED`.
- Código de aplicación modificado: no.
- Riesgo residual: limitado al mantenimiento futuro del grafo transitivo.
