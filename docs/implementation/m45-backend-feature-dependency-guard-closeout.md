# M45 — Global feature dependency guard closeout

## 1. Identificación y baseline

- Milestone: M45, guard global anti-ciclos y matriz de dependencias entre
  features de Fase K.
- Rama: `test/backend-modularization-m45-feature-dependency-guard`.
- HEAD y upstream al iniciar la corrección P2:
  `dbf3f6fa3b3830a53a81dcebab181a8322af7243`.
- Working tree e index al iniciar la corrección: limpios.
- PR auditado: `#1584`, abierto, no draft, head correcto y bloqueado por tres
  review threads P2 vigentes.
- Fecha del cierre corregido: 2026-07-28.

## 2. Alcance incluido

La corrección P2 amplía M45 para:

1. descubrir dependencias desde `server/lib/**/*.ts` hacia
   `server/features/**`;
2. prohibir imports cross-feature a internals y permitir únicamente el barrel
   público `server/features/<feature>/index.ts`;
3. clasificar `ImportTypeNode` (`type T = import("...").T`) como
   `import-type` y type-only;
4. preservar por separado los grafos full y runtime;
5. mover a sus features propietarias los dos módulos encontrados por el RED;
6. realinear consumidores y contratos arquitectónicos sin cambiar
   comportamiento.

## 3. Alcance excluido

No se modificaron endpoints, payloads, status codes, persistencia, schema,
migraciones, dependencias, lockfiles, auth, permisos, sesiones, cookies, CORS,
trusted origin, CSRF, rate limits, email, auditoría runtime, CI ni workflows.
No se ejecutó C5 ni se rompió el SCC residual.

## 4. Auditoría de ownership y moves

El nuevo scan produjo cuatro dependencias `lib → features`, sin allowlists:

- `server/lib/particular-token.ts` → Particular Access y Reports;
- `server/lib/report-access-token.ts` → Report Access y Reports.

El ownership funcional determinó estos moves 1:1:

- `server/lib/particular-token.ts` →
  `server/features/particular-access/particular-token.ts`;
- `server/lib/report-access-token.ts` →
  `server/features/report-access/report-access-token.ts`.

Los paths legacy quedaron eliminados y todos sus consumidores runtime, tests y
anclas arquitectónicas apuntan a los módulos canónicos de feature.

## 5. Barrels públicos y lazy loading

Cada destino cross-feature expone un barrel raíz mínimo en
`server/features/<feature>/index.ts`. El guard exige que el destino resuelto
sea exactamente ese archivo; cualquier import a `domain/`, `application/`,
`infrastructure/`, `composition/` u otro archivo interno queda rechazado.

Para no convertir imports dinámicos en carga eager se añadieron dos seams
públicos lazy:

- `particular-access/particular-access-public-composition.ts`;
- `reports/reports-public-composition.ts`.

Los loaders públicos delegan por `import()` a la infraestructura o composición
existente. No duplican reglas, queries ni persistencia.

## 6. Censo congelado corregido

- Features: 9.
- Archivos TypeScript bajo `server/features`: 149.
- Referencias cross-feature exactas: 16.
- Pares dirigidos full y runtime: 7.
- Referencias dinámicas: 7.
- Referencias estáticas runtime: 6.
- Referencias type-only: 3.
- Imports cross-feature a internals: 0.
- Imports `server/lib → server/features`: 0.
- Imports relativos irresolubles: 0.
- Imports desde features hacia `server/routes` o `server/middlewares`: 0.

Las nueve features son `clinics`, `logistics`, `particular-access`, `pricing`,
`public-professionals`, `report-access`, `reports`, `study-tracking` y
`users-roles`.

## 7. Matrices full y runtime

| Feature origen | Features destino |
| --- | --- |
| `clinics` | `public-professionals` |
| `logistics` | ninguna |
| `particular-access` | `reports`, `study-tracking` |
| `pricing` | ninguna |
| `public-professionals` | ninguna |
| `report-access` | `reports` |
| `reports` | `particular-access`, `study-tracking` |
| `study-tracking` | ninguna |
| `users-roles` | `clinics` |

La matriz full conserva también las referencias type-only. En el censo real
actual, full y runtime tienen las mismas siete aristas porque cada par que
contiene un import type-only también posee al menos una referencia runtime. La
fixture determinística de `ImportTypeNode` agrega una arista sólo al grafo
full y demuestra que el grafo runtime no cambia.

## 8. SCC preexistente

El único componente fuertemente conexo de los grafos full y runtime es
`particular-access ↔ reports`. M45 lo congela como deuda preexistente explícita
y rechaza cualquier SCC adicional.

- C5 — NOT_RUN.
- M46 — NOT_RUN.
- M48 — NOT_RUN.

## 9. Descripción técnica del guard

El guard usa el AST de TypeScript, auto-descubre recursivamente los `.ts` de
`server/features` y `server/lib`, normaliza separadores Windows y resuelve
destinos relativos como archivo `.ts` o barrel `index.ts`. No usa Git, ramas,
worktrees, `child_process`, aliases ni dependencias nuevas.

Clasifica imports estáticos, side-effect imports, imports type-only completos o
por specifier, reexports, `import =`, `ImportTypeNode`, `import()` y
`require()`. Cada referencia canónica congela origen, kind, semántica
type-only/runtime, specifier y destino resuelto, por lo que una adición, retiro
o reclasificación produce drift.

## 10. Evidencia RED y corrección causal

La primera cohorte M44 + M45 corregida ejecutó 18 tests: 15 pass y 3 fail.
Los fallos fueron exactamente:

1. cuatro dependencias `server/lib → server/features`;
2. catorce imports cross-feature a internals;
3. ausencia de detección de la fixture `ImportTypeNode`.

Una primera realineación mediante reexports estáticos hizo eager la carga de
infraestructura y falló la cohorte funcional dirigida: 69 tests, 61 pass y
8 fail por variables de Supabase ausentes. La causa se corrigió con loaders
públicos lazy; no se agregaron mocks ni fallbacks productivos.

Los dos primeros intentos de `validate:local` alcanzaron el test completo y
fallaron únicamente por guardrails históricos que fijaban imports internos o
inventarios cerrados. Cada grupo se corrigió causalmente y pasó primero su
cohorte dirigida antes del reintento integral.

## 11. Evidencia GREEN y validaciones

| Comando | Estado | Resultado |
| --- | --- | --- |
| Cohorte M44 + M45 | PASSED | 18 tests, 18 pass, 0 fail |
| Cohorte funcional de Particular/Report Access | PASSED | 106 tests, 106 pass, 0 fail |
| Cohorte de contratos arquitectónicos afectados | PASSED | 56 tests, 56 pass, 0 fail |
| Cohortes causales de guardrails históricos | PASSED | 33/33 y 28/28 |
| `pnpm typecheck` | PASSED | TypeScript runtime sin errores |
| `pnpm typecheck:test` | PASSED | TypeScript tests sin errores |
| `pnpm validate:local` | PASSED | typechecks + 3921 tests, 3920 pass, 1 skip, 0 fail + build |
| `pnpm security:public-surface` | PASSED | cero findings públicos; dos markers server-only esperados |
| `git diff --check` | PASSED | cero errores de whitespace |

## 12. Archivos y familias modificadas

- runtime de Clinics, Particular Access, Report Access, Reports, Study Tracking
  y Users/Roles;
- seis barrels públicos raíz y dos loaders públicos lazy;
- rutas consumidoras de los dos módulos movidos;
- guard M45 y realineación causal de M44;
- tests funcionales y contratos arquitectónicos que anclaban paths o
  inventarios;
- este closeout y el audit rector del programa.

## 13. Contratos preservados

Los módulos movidos conservan su implementación. Los cambios de consumidores
son de paths y seams de carga. Permanecen intactos endpoints, payloads, status
codes, orden de validación, queries, transacciones, auth, roles, permisos,
sesiones, cookies, CSRF, rate limits, CSP, CORS, trusted origin, auditoría,
email y manejo de errores.

## 14. Riesgo residual y rollback

Permanece el SCC runtime `particular-access ↔ reports`; romperlo requiere C5 o
un trabajo posterior explícito. El rollback debe revertir conjuntamente moves,
barrels/loaders, imports, guards, tests y documentación. No requiere
migraciones, compensaciones ni cambios de datos.

## 15. Git/GitHub

- HEAD: sin modificar respecto de
  `dbf3f6fa3b3830a53a81dcebab181a8322af7243`.
- STAGE: NOT_RUN.
- COMMIT: NOT_RUN.
- PUSH: NOT_RUN.
- UPDATE PR BODY: NOT_RUN.
- RESPONDER THREADS: NOT_RUN.
- RESOLVER THREADS: NOT_RUN.
- MERGE: NOT_RUN.

**M45 CLOSED localmente** con los gates de la sección 11 ejecutados sobre el
diff corregido.
