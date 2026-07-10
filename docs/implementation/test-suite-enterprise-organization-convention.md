# VETNEB Test Suite Enterprise Organization Convention

> Convención oficial y vinculante para organizar, nombrar, descubrir y validar los tests de Portal VETNEB.
> Este documento refleja la estructura consolidada después del bloque TEST-ARCH root migration.

---

## 1. Estado normativo

| Campo | Valor |
|---|---|
| Estado | **Adoptado** |
| Fecha de consolidación | 2026-07-10 |
| Tipo de documento | Norma de organización de tests |
| Runner backend | `node:test` + `node:assert/strict` |
| Comando canónico | `pnpm test` |
| Descubrimiento | `test/**/*.test.ts` |
| Runner e2e | Playwright bajo `frontend/e2e` |
| Índice operativo | [`test/README.md`](../../test/README.md) |
| Auditoría fuente | [`docs/audit/test-suite-enterprise-architecture-audit.md`](../audit/test-suite-enterprise-architecture-audit.md) |

Esta convención reemplaza la descripción preliminar de una migración futura. La migración física ya fue completada y la estructura documentada aquí es el contrato vigente.

### Alcance

- Define las ubicaciones canónicas para tests nuevos y existentes.
- Define las reglas de clasificación, nomenclatura, descubrimiento y validación.
- Define los guardrails de seguridad y arquitectura que ningún PR puede debilitar.
- Define el contrato de cambio para movimientos o reorganizaciones futuras.

### Fuera de alcance

Este documento no autoriza por sí mismo cambios en runtime, API, auth, DB, schema, migraciones, dependencias, lockfiles ni CI.

---

## 2. Invariantes globales

1. `test/*.test.ts` debe permanecer en **0 archivos**.
2. Todo test backend ejecutable debe vivir bajo una carpeta canónica de `test/**` y terminar en `*.test.ts`.
3. Los helpers compartidos no ejecutables no deben usar el sufijo `*.test.ts`.
4. `pnpm test` debe descubrir de forma recursiva todos los tests backend mediante `test/**/*.test.ts`.
5. El e2e físico permanece en `frontend/e2e`; no se duplica bajo `test/e2e`.
6. Un movimiento de archivo debe actualizar en el mismo PR imports, registries, censos, paths canónicos y documentación afectada.
7. Ningún movimiento puede silenciar assertions, reducir cobertura o introducir exclusiones de runner.
8. Ningún test de la suite local puede requerir producción, staging, credenciales reales ni red externa.

---

## 3. Estructura física canónica

```text
test/
├── architecture/
│   ├── database/
│   └── security/
├── integration/
│   ├── adapters/
│   │   ├── controllers/
│   │   └── repositories/
│   └── external-services/
├── security/
├── unit/
│   ├── contracts/
│   ├── domain/
│   ├── infrastructure/
│   ├── migrations/
│   └── ui/
└── helpers/
```

Las carpetas pueden subdividirse por dominio, por ejemplo `admin`, `clinic`, `dashboard`, `frontend`, `logistics`, `particular`, `pricing`, `public`, `public-professionals`, `reports` o `study-tracking`.

### E2E

```text
frontend/e2e/
├── helpers/
├── flows/       # cuando la clasificación por flujo aporte valor
├── features/    # cuando la clasificación por feature aporte valor
└── *.spec.ts    # specs legacy/canónicos aún no subdivididos
```

`flows/` y `features/` son categorías internas de Playwright. No existe obligación de mover un spec estable solo para materializar esas subcarpetas.

---

## 4. Clasificación oficial

La ubicación se decide por el comportamiento real del test, no solo por su nombre.

| Categoría | Qué contiene | Qué no contiene |
|---|---|---|
| `architecture/**` | Guards que leen filesystem, source, configuración, registries, censos o límites entre capas | Reglas de negocio o flujos HTTP |
| `architecture/database/**` | Contratos estructurales de persistencia, reconciliación y superficie de DB | Conexiones productivas |
| `architecture/security/**` | Registries y fronteras estáticas/transversales de seguridad | Secretos reales o red externa |
| `unit/domain/**` | Reglas puras, serializers, tokens, timing, permisos, paginación y agregaciones sin I/O | Fastify, DB, red, filesystem de runtime |
| `unit/contracts/**` | Contratos aislados de políticas, middleware, sesiones, timing, rutas o superficies por dominio, sin servidor real | `app.inject()` y proveedores reales |
| `unit/infrastructure/**` | Tooling, configuración, middleware, logging, email aislado, scripts y contratos de infraestructura con fakes | I/O externo real |
| `unit/migrations/**` | Contratos estáticos de migraciones, schemas y relaciones esperadas | Aplicar migraciones contra DB real |
| `unit/ui/**` | Contratos estáticos de frontend, componentes, CSS, configuración, layout y source invariants | Navegador real y flujos multi-pantalla |
| `integration/adapters/controllers/**` | Rutas Fastify ejercitadas mediante `app.inject()` | Playwright o red externa |
| `integration/adapters/repositories/**` | Adaptadores de datos con clientes fake o memoria | Postgres/Supabase productivos |
| `integration/external-services/**` | Integraciones con Supabase, email, Gmail u otros proveedores mediante fakes o servidores locales | Endpoints y credenciales reales |
| `security/**` | Invariantes conductuales de seguridad que cruzan componentes | Tests puramente estructurales sin conducta |
| `helpers/**` | Fixtures, builders, stubs, fakes, spies, setup y utilidades reutilizables | Archivos ejecutables `*.test.ts` salvo que sean tests del helper |

### 4.1. Regla de desempate

Cuando un archivo toca varias capas, se clasifica por el colaborador de mayor peso de I/O:

**E2E > servicio externo > repository > controller > infraestructura/contrato > dominio.**

Los ejes `security`, `architecture` y `regression` describen la intención adicional del test; no sustituyen el tipo físico salvo cuando el archivo existe específicamente para imponer esa frontera.

### 4.2. Diferencia entre `unit/contracts` y `architecture`

- `unit/contracts` valida un contrato observable o una política aislada de un módulo, middleware o superficie.
- `architecture` inspecciona la forma del repositorio, sus paths, registries, imports o configuración.

Un test que lee source para asegurar que una ruta exporta una política concreta puede ser `unit/contracts`. Un test que recorre el repositorio para impedir archivos fuera de una carpeta pertenece a `architecture`.

### 4.3. Diferencia entre `unit/infrastructure` e integración

- `unit/infrastructure` usa fakes y prueba una unidad aislada sin levantar servidores ni acceder a proveedores.
- `integration/**` conecta más de un componente o cruza una frontera mediante Fastify, repository fake o adaptador externo simulado.

### 4.4. UI estática y E2E

Los tests bajo `unit/ui/**` validan source, componentes, estilos, configuración o contratos estáticos. El comportamiento real de navegador, responsive, scroll, navegación, foco, accesibilidad y composición visual debe validarse con Playwright en `frontend/e2e` cuando la assertion requiera render real.

Los source-contracts existentes son válidos como regression/architecture guards, pero no deben presentarse como sustituto universal de una verificación visual real.

---

## 5. Convención de nombres

### Archivos

- Backend: `kebab-case.test.ts`.
- Controllers Fastify: conservar `*.fastify.test.ts`.
- E2E: `kebab-case.spec.ts`.
- Helpers: `*.fixture.ts`, `*.factory.ts`, `*.mother.ts`, `*.stub.ts`, `*.fake.ts`, `*.spy.ts` o un nombre funcional equivalente.
- Prefijos de dominio cuando aportan ownership: `admin-`, `clinic-`, `logistics-`, `particular-`, `public-`, `report-`, `security-`.
- Sufijos contractuales admitidos: `-contract`, `-invariants`, `-boundaries`, `-guard`, `-guardrail`, `-suite-completeness`, `-runtime-timing-contract`, `-session-last-access-contract`.

### Suites y casos

- `describe()` nombra la unidad, ruta, superficie o frontera bajo test.
- `test()`/`it()` describe comportamiento observable.
- AAA es el patrón base.
- Given/When/Then se usa cuando mejora la lectura de integración, seguridad o e2e.
- No incluir números de línea ni detalles internos accidentales en el nombre del caso.

---

## 6. Descubrimiento y paths

### Runner backend

El script canónico es:

```text
node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts
```

Consecuencias normativas:

- No se requieren scripts por carpeta para que un test backend sea descubierto.
- Crear una subcarpeta bajo `test/` no exige cambiar el runner.
- Un archivo ejecutable fuera del glob es un error de arquitectura salvo excepción documentada.
- No se permite duplicar un test en dos paths para mantener compatibilidad.

### Registries y censos

- Los censos deben ser recursivos.
- Los registries deben almacenar rutas canónicas completas, no basenames ambiguos.
- Un resolver por basename solo es admisible cuando exige una coincidencia única y falla ante cero o múltiples resultados.
- Toda ruta canónica movida se actualiza en el mismo PR.
- No se elimina una entrada de registry para hacer pasar una migración.

### Imports

- Los imports relativos se ajustan mecánicamente después de un move.
- No se crean shims permanentes solo para sostener paths legacy de tests.
- `process.cwd()` puede usarse para resolver recursos de repositorio cuando el contrato depende del root, pero debe evitarse el acoplamiento innecesario al estado de Git.

---

## 7. Datos, fakes y aislamiento

- Fixtures exclusivamente sintéticas y seguras.
- Prohibido usar PII, secretos, cookies, tokens, hashes, signed URLs o credenciales reales.
- Los defaults de entorno de test deben ser idempotentes y seguros.
- Unit tests no abren sockets ni dependen de red externa.
- Repositories y proveedores se prueban con fakes, stubs o servidores locales controlados.
- Ningún test depende del orden global de ejecución.
- Reloj y aleatoriedad deben fijarse o inyectarse cuando afecten el resultado.

---

## 8. Guardrails VETNEB

La suite debe preservar, como mínimo:

1. Separación estricta entre `admin_session_id` y `app_session_id`.
2. No exposición de secrets, tokens, hashes, cookies, signed URLs ni stack traces productivos.
3. `no-store` para dashboards privados y APIs privadas.
4. Prevención de IDOR y cruces de tenant/actor.
5. Redacción de metadata sensible en logs y errores.
6. CORS y trusted-origin coherentes con la superficie pública/privada.
7. Rate limits aislados por realm y actor cuando corresponda.
8. Fixtures sin datos productivos reales.
9. Visual regression platform-locked solo en jobs explícitamente aprobados; no en el gate general por defecto.

---

## 9. Contrato para PRs futuros

### Tests nuevos

Un PR que agrega un test debe:

- colocarlo directamente en la carpeta canónica;
- justificar la categoría cuando no sea evidente;
- actualizar registries o suite-completeness si la familia los utiliza;
- demostrar que el archivo es descubierto por el runner aplicable;
- evitar cambios no relacionados.

### Movimientos

Un PR de movimiento debe ser mecánico:

1. verificar base, branch y working tree;
2. inventariar referencias al path anterior;
3. mover un grupo coherente;
4. ajustar imports y rutas canónicas;
5. actualizar registries, censos y docs en el mismo PR;
6. ejecutar validación focal y completa;
7. dejar rollback lógico claro;
8. no reescribir assertions ni runtime.

### Prohibiciones

- No agregar tests a `test/` raíz.
- No hacer movimientos masivos sin partición por dominio/riesgo.
- No mezclar reordenamiento con cambios funcionales.
- No cambiar runner, dependencias, lockfiles o CI salvo autorización explícita.
- No tocar DB/schema/migraciones por un cambio puramente organizativo.
- No desactivar tests, registries o assertions para obtener verde.
- No introducir snapshots visuales frágiles en el gate por defecto.

---

## 10. Validación mínima

| Tipo de cambio | Validación obligatoria |
|---|---|
| Docs-only sobre esta convención | `git diff --check`, revisión de links/paths, `pnpm test`, `pnpm build`, `pnpm security:public-surface` |
| Test unitario/contract/architecture/security | `pnpm typecheck:test`, validación focal, `pnpm test`, `pnpm build`, `pnpm security:public-surface` |
| Controller/repository/external-service | `pnpm typecheck:test`, validación focal, `pnpm test`, `pnpm build`, seguridad aplicable |
| UI estática | `pnpm typecheck:test`, validación focal, `pnpm test`, frontend lint/typecheck/build cuando corresponda |
| E2E | frontend lint/typecheck/build, suite Playwright focal, preservación de `next-env.d.ts` y artifacts esperados |
| Movimiento de paths | todo lo anterior según categoría + búsqueda de referencias legacy + verificación de registries |

Comandos base:

```powershell
git diff --check
git diff --stat
git diff --name-only
pnpm typecheck:test
pnpm test
pnpm build
pnpm security:public-surface
```

---

## 11. Estado consolidado

- La migración de tests backend fuera de la raíz está cerrada.
- `test/*.test.ts` debe permanecer en cero.
- `unit/contracts`, `unit/infrastructure`, `unit/migrations` y `unit/ui` son categorías oficiales, no excepciones transitorias.
- `architecture/database` y `architecture/security` son subdivisiones oficiales.
- `helpers` es la ubicación canónica de soporte compartido existente.
- `frontend/e2e` sigue siendo la ubicación física exclusiva de Playwright.
- Los censos relevantes deben ser recursivos y operar sobre rutas canónicas.

---

## 12. Deuda separada de la organización física

La estructura consolidada no implica que todo test tenga el diseño ideal. Se mantienen como líneas de trabajo independientes:

- evaluar source-contracts de UI que deberían convertirse en render/e2e;
- reducir dependencia de guards basados en `git diff` cuando sea viable;
- reemplazar registries manuales por descubrimiento seguro cuando no se pierda precisión;
- centralizar setup/fixtures duplicados cuando exista un consumidor real;
- mantener una política explícita para visual regression y snapshots.

Estas mejoras no justifican volver a una raíz plana ni cambiar la taxonomía canónica.

---

## 13. Jerarquía documental

1. Esta convención define la norma vigente.
2. `test/README.md` es el índice operativo resumido.
3. La auditoría histórica explica diagnóstico, riesgos y decisiones anteriores.
4. Los documentos de implementación TEST-ARCH registran cada cambio, pero no reemplazan esta norma.

Ante una discrepancia entre un documento histórico y esta convención consolidada, prevalece esta convención salvo una decisión posterior explícitamente aprobada y documentada.
