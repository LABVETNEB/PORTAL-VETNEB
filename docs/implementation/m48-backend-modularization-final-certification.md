# M48 — Backend modularization final certification

## 1. Identificación

- Milestone: M48, cierre de Fase K y del Backend Enterprise Modularization
  Program.
- Fecha de auditoría: 2026-07-28.
- Rama:
  `test/backend-modularization-m48-final-certification`.
- Baseline inmutable:
  `7a05cb8c5c9d0fd3f8f1d64f05bc5812d39a59eb`.
- Naturaleza: auditoría final, guard ejecutable, regresión acumulada y
  documentación. Cero refactor runtime.
- Veredicto final: **CERTIFIED_WITH_RESIDUAL_RISKS**.

Estado vigente posterior al merge (addendum 2026-07-28):

- PR: **#1586** — `MERGED`;
- squash commit: `cb6f013e90d1363373a86f6bcce26bff68ac453e`;
- fecha de merge: `2026-07-28T15:27:31Z`;
- M48: **MERGED**; Fase K: **CLOSED**; Programa:
  **CERTIFIED_WITH_RESIDUAL_RISKS**;
- rama `test/backend-modularization-m48-final-certification`: eliminada local y
  remotamente tras el squash;
- auditoría independiente posterior: PR **#1587**, squash
  `e1d1cfdb3eeae9517927f96f355e8fdadd3e5862`
  (`docs/audit/post-m48-backend-reordering-excellence-audit.md`,
  veredicto `EXCELLENT_WITH_RESIDUAL_RISKS`, 93/100, cero P0/P1/P2);
- M47 continúa **NO-GO** y C5 continúa **NOT_RUN**.

Todo dato de este documento anterior a este addendum que describa el estado
local pre-merge es snapshot histórico, no estado vigente.

Este veredicto certifica la arquitectura objetivo proporcional definida por el
programa, no una norma externa ni una cobertura absoluta. Los riesgos
residuales aceptados se separan de defectos abiertos en la sección 29.

## 2. Baseline y precondiciones

La entrada se verificó antes de modificar archivos. Esta tabla es el **baseline
inmutable** de M48 (snapshot previo al commit); no describe el estado vigente,
que es el registrado en la sección 1 y en la sección 18:

| Precondición | Resultado |
| --- | --- |
| Repositorio | `C:\PORTAL-VETNEB` |
| Rama | `test/backend-modularization-m48-final-certification` |
| `HEAD` | `7a05cb8c5c9d0fd3f8f1d64f05bc5812d39a59eb` |
| `main` | mismo SHA |
| `origin/main` | mismo SHA |
| Working tree inicial | limpio |
| Índice inicial | vacío |
| Worktrees | uno: `C:/PORTAL-VETNEB` |
| Upstream rama M48 | no configurado; rama local todavía no publicada |
| PRs abiertos | 0 |
| Último commit | `7a05cb8 refactor(backend): reclassify residual HTTP helpers (#1585)` |

No se inspeccionó ni modificó
`C:\PORTAL-VETNEB-sec-deps-orphaned-20260724`.

Desde la base pre-M01
`f3e22a726c9ddd6f192ed3fa748a370263c7c89e` hasta el baseline M48 hay 71
commits totales: 55 pertenecen al programa contando los 49 squash de
milestones M01–M46 y seis closeouts documentales separados; 16 son cambios
intercalados de seguridad, dependencias o gobernanza. M47 no produjo commit.

## 3. Alcance y exclusiones

Incluido:

- guard de certificación M48;
- este documento;
- actualización vigente del documento rector y del inventario `server/lib`;
- ajustes causales mínimos a los guards M45/M46 que todavía exigían el estado
  forward-looking `M48 NOT_RUN`;
- censos de arquitectura, legacy, seguridad, Git history y GitHub.

Excluido:

- `server/**`, `frontend/**`, `shared/**` y `scripts/**` como superficie de
  escritura;
- Auth, sesiones, cookies, CORS, trusted origin y rate limits;
- DB, Drizzle, schema, migraciones y datos;
- dependencias, manifests, lockfiles, workflows, CI y deployment;
- C3, C4 y C5;
- cualquier reconsideración runtime del NO-GO M47.

## 4. Metodología y fuentes

La evidencia se recalculó desde el baseline, sin copiar conteos históricos:

1. protocolo, ADR, documento rector e inventario M01;
2. 48 closeouts M02–M46, incluidos M02b, M32b y M35b;
3. 71 guards bajo `test/architecture/` y 10 contratos bajo `test/security/`;
4. `package.json` y los seis workflows, sólo en lectura;
5. AST TypeScript path-aware para imports estáticos, reexports,
   `ImportTypeNode`, `import()` y `require()`;
6. filesystem para inventario, capas, LOC y paths ausentes;
7. `git log/show` para commits y paths;
8. GitHub read-only para estado, base, head histórica, squash y fecha de los
   PRs citados.

Todos los PRs de la matriz fueron verificados `MERGED`, con base `main`. Sus
heads históricas estaban disponibles en GitHub, incluidas
`refactor/backend-modularization-m44-legacy-imports-sweep`,
`test/backend-modularization-m45-feature-dependency-guard` y
`refactor/backend-modularization-m46-http-lib-reclassification`.

## Matriz final de milestones

La fecha es la fecha de merge registrada por GitHub en UTC. “Guard heredado”
significa que el milestone quedó cubierto por el guard de cierre de su fase y
por su cohorte funcional, sin inventar un guard independiente.

| ID | Fase | Objetivo principal | Estado | PR | Squash SHA | Fecha | Guard principal | Closeout / evidencia | Riesgo residual |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| M01 | 0 | refresh de inventario y protocolo | MERGED | #1496 | `f001910877b3ef695fc44d8382b5a205d1a51f95` | 2026-07-18 | inventario documental | `shared-lib-boundary-inventory.md` | conteos históricos separados del censo M48 |
| M02 | 0 | retirar huérfanos Express | MERGED | #1497 | `7a382f172f229b35a0362396182bb9828aa09a1e` | 2026-07-18 | tracked source / Fastify-only | `m02-express-era-orphan-cleanup.md` | ninguno |
| M02b | A | mover SLA/time-window a domain | MERGED | #1498 | `94e7a2b7ae8825d180265cb2d8a536149339f0a9` | 2026-07-19 | Logistics domain | `m02b-logistics-sla-time-window-domain-move.md` | ninguno |
| M03 | A | mover route-planning a domain | MERGED | #1499 | `56a7bab35af98cd4aa20709a9fb8cbf1792ecef9` | 2026-07-19 | Logistics domain | `m03-logistics-route-planning-domain-move.md` | ninguno |
| M04 | A | mover metrics a domain | MERGED | #1500 | `ba9de2a311031e9e56ceb8fec2bb8b3d27862c79` | 2026-07-19 | Logistics domain | `m04-logistics-metrics-domain-move.md` | ninguno |
| M05 | A | cierre domain Logistics | MERGED | #1501 | `3c24154c764979b8314ebb5441066368c2fd510f` | 2026-07-19 | `logistics-domain-boundary-guard` | `m05-logistics-domain-phase-closeout.md` | ninguno |
| M06 | B | UC SLA overdue | MERGED | #1502 | `89af3cb3724625494513198f20f9be6f5cd09c34` | 2026-07-19 | guard heredado M11 | `m06-logistics-sla-overdue-use-case.md` | ninguno |
| M07 | B | UCs route-plans read/heuristic | MERGED | #1503 | `d21230fdb263eb0cbae1157dcb66866c25aba9d0` | 2026-07-19 | M11 + validation cutoff | `m07-logistics-route-plans-read-heuristic-use-cases.md` | ninguno |
| M08 | B | UCs route-plans write/cancel | MERGED | #1504 | `b0b853f8881e5ead85d6fc3aec09c22ab607d52d` | 2026-07-19 | guard heredado M11 | `m08-logistics-route-plans-write-cancel-use-cases.md` | ninguno |
| M09 | B | UC field-visit status | MERGED | #1505 | `d9a210e08195e78774a72cd223bcbbcf2228dbee` | 2026-07-19 | guard heredado M11 | `m09-logistics-field-visit-status-use-case.md` | ninguno |
| M10 | B | UCs route-events | MERGED | #1506 | `04e6681de8ee220f66f6c6049df36a6796314a55` | 2026-07-20 | guard heredado M11 | `m10-logistics-route-events-use-cases.md` | ninguno |
| M11 | B | cierre application Logistics | MERGED | #1507 | `bb320297df290cb64249ddf4eba4209967b18cfc` | 2026-07-20 | `logistics-application-boundary-guard` | `m11-logistics-application-phase-closeout.md`; refresh #1508 | ninguno |
| M12 | C | DB Logistics a infrastructure | MERGED | #1509 | `5c775b3cd6bd4cc33bbd7442dfe733f6f1169308` | 2026-07-21 | Logistics infrastructure | `m12-logistics-db-infrastructure-move.md` | shim retirado en M17 |
| M13 | C | cache Logistics a infrastructure | MERGED | #1511 | `4fedeffa68dfa6a680beff602bda12b5a31abfbc` | 2026-07-21 | Logistics infrastructure | `m13-logistics-cache-infrastructure-move.md` | shim retirado |
| M14 | C | thin route-plans | MERGED | #1512 | `c48791657a4c0eb9532d24df367cae8d18da3b7b` | 2026-07-21 | Logistics infrastructure | `m14-logistics-route-plans-thin-route.md` | ninguno |
| M15 | C | thin field-visits | MERGED | #1513 | `27be4cf4c65bd0f1bcd842151853a9537ec1954e` | 2026-07-21 | Logistics infrastructure | `m15-logistics-field-visits-thin-route.md`; closeout #1514 | ninguno |
| M16 | C | thin route-events/SLA | MERGED | #1515 | `a4245d74501ee7c055c8eb09212bca93a4b50d3d` | 2026-07-21 | Logistics infrastructure | `m16-logistics-route-events-sla-thin-routes.md`; closeout #1516 | ninguno |
| M17 | C | retirar shim DB y cerrar Logistics | MERGED | #1517 | `6157e9e71baf83aa9bf0ae3dfb748eaefac74be1` | 2026-07-21 | Logistics infrastructure | `m17-logistics-phase-closeout.md`; closeout #1518 | ninguno |
| M18 | D | Pricing DB/cache a infrastructure | MERGED | #1519 | `5f99b5f40e08ea8929be869374f1d154f740153f` | 2026-07-21 | Pricing infrastructure | `m18-pricing-infrastructure-move.md`; closeout #1520 | ninguno |
| M19 | D | thin rutas Pricing | MERGED | #1521 | `d1b25111d6bc0aa644647e67a784cb596b4e1afe` | 2026-07-21 | Pricing infrastructure | `m19-pricing-thin-routes.md`; closeout #1522 | ninguno |
| M20 | D | cierre proporcional Pricing | MERGED | #1523 | `ed83ab3dc5a2757ee3168cf38e99ab3ca6daedc4` | 2026-07-21 | Pricing infrastructure | `m20-pricing-phase-closeout.md` | servicios directos deliberados |
| M21 | E | domain Public Professionals | MERGED | #1524 | `56f081ec0b3f82b7b0dbd62d58641937d3d92b83` | 2026-07-22 | PP domain | `m21-public-professionals-domain.md` | ninguno |
| M22 | E | persistence PP a infrastructure | MERGED | #1526 | `b8bf694f2c2a43e05224ee9f05a584e7117e2b11` | 2026-07-22 | PP domain/infrastructure | `m22-public-professionals-infrastructure.md` | ninguno |
| M23 | E | thin ruta pública y rate limit | MERGED | #1527 | `8402ec79e9b7b713d3cc77c40817046fdcb7ede0` | 2026-07-22 | PP infrastructure/source | `m23-public-professionals-thin-route.md` | shims retirados en M24 |
| M24 | E | retirar shims y cerrar PP | MERGED | #1528 | `0df8e07811add7e66b0748a8928428d01941df63` | 2026-07-22 | PP domain/infrastructure/source | `m24-public-professionals-closeout.md` | ninguno |
| M25 | F | domain/validaciones Clinics | MERGED | #1529 | `9e46817bd9125e151a2cdf4547fdf7a0864ce763` | 2026-07-23 | Clinics domain | `m25-clinics-domain-validations.md` | ninguno |
| M26 | F | repository Clinics | MERGED | #1559 | `eb46092922de66989ed8e98c16b1379d5c32989c` | 2026-07-23 | Clinics infrastructure | `m26-clinics-infrastructure.md` | ninguno |
| M27 | F | thin admin Clinics | MERGED | #1560 | `6e1a91f539e8d70674da0a2b356e539f3b6ac2fd` | 2026-07-23 | Clinics infrastructure | `m27-clinics-thin-admin.md` | ninguno |
| M28 | F | thin public profile Clinics | MERGED | #1561 | `4c7c041d626f9842bed5430699d628b4300c6dcb` | 2026-07-23 | Clinics + security/storage | `m28-clinics-public-profile-thin-route.md` | compensación existente documentada |
| M29 | F | cierre y cross-tenant Clinics | MERGED | #1563 | `d0ddc11ed94cec827053986e713f1a5fd9ca034a` | 2026-07-23 | IDOR + ownership | `m29-clinics-phase-closeout.md` | aislamiento por aplicación, no RLS |
| M30 | G | domain Study Tracking | MERGED | #1564 | `56df6d54c9fa1bc4e4f0c0901f976fd376eabb02` | 2026-07-24 | Study Tracking domain | `m30-study-tracking-domain-moves.md` | ninguno |
| M31 | G | UCs, puertos y repository | MERGED | #1565 | `c17b263ca6571e067e524d6eff685dcedac28c99` | 2026-07-24 | ST application/domain/infrastructure | `m31-study-tracking-use-cases-repository.md` | ninguno |
| M32 | G | thin clinic/particular | MERGED | #1566 | `d48ae11dd1c4080fb81bfc8e1025ddd0ae914419` | 2026-07-24 | ST routes/layers + security | `m32-study-tracking-clinic-particular-thin-routes.md` | ninguno |
| M32b | G | thin admin | MERGED | #1567 | `9ef2621875429b788a0260aae65dd7eb3753db23` | 2026-07-24 | ST admin/layers + security | `m32b-study-tracking-admin-thin-route.md` | ninguno |
| M35 | G | retirar shims domain y cerrar ST | MERGED | #1568 | `be69a06fffb405ad6bd708090bf5282164f15159` | 2026-07-24 | ST closeout + IDOR | `m35-study-tracking-phase-closeout.md` | shim DB retirado en M44 |
| M33 | H | Particular Access modular | MERGED | #1570 | `c27e9d7cad98d4cf9a203e97c0ba083b7c3ab731` | 2026-07-24 | `particular-access-m33-closeout` | `m33-particular-access-domain-repository-thin-closeout.md` | SCC con Reports |
| M34 | H | Report Access modular | MERGED | #1572 | `7297be2b031e18b77164bf0ea610654cd9ba4ea6` | 2026-07-25 | `report-access-m34-closeout` + security | `m34-report-access-domain-repository-thin-closeout.md` | ninguno |
| M35b | H | regresión token enumeration/disclosure | MERGED | #1574 | `20ae28b72607c2a0b9aeeac8aa142a1dbf68753f` | 2026-07-25 | `token-access-m35b-closeout` | `m35b-token-access-enumeration-disclosure-closeout.md` | ninguno |
| M36 | I | domain Reports y censo catálogo | MERGED | #1575 | `ce6f5753e20dbdc520c6c4c982829244ef25191a` | 2026-07-27 | Reports domain | `m36-reports-domain-moves-catalog-census.md` | SCC con Particular Access |
| M37 | I | puertos workflow data/notification | MERGED | #1576 | `d27fa22d1d98fa83b24a51a8521d7c634a7adeb4` | 2026-07-27 | Reports workflow ports | `m37-reports-workflow-data-notification-ports.md` | ninguno |
| M38 | I | command use cases | MERGED | #1577 | `67739dd695db444a6fb6fae2be75738ff8a27f3e` | 2026-07-27 | Reports command UCs | `m38-reports-create-edit-transition-use-cases.md` | ninguno |
| M39 | I | thin admin/workflow | MERGED | #1578 | `9e1664ee6c73f02a2a484ec2a697831e40225013` | 2026-07-27 | Reports admin/layers | `m39-reports-admin-thin-routes-workflow.md` | ninguno |
| M40 | I | query UCs y thin clinic | MERGED | #1579 | `791b526b10e66b2d48265b10f83ca2c06815822e` | 2026-07-27 | Reports query/layers/security | `m40-reports-query-use-cases-thin-routes.md` | ninguno |
| M41 | I | retirar compatibilidad y cerrar | MERGED | #1580 | `a5d35a2c28bd35305e7607a58d9663bcac7b20b8` | 2026-07-27 | Reports shim retirement | `m41-reports-compatibility-shim-retirement.md` | SCC con Particular Access |
| M42 | J | domain y UCs Users/Roles | MERGED | #1581 | `da73eb1291bc89b4ec505d22e337b173dd01219e` | 2026-07-28 | Users/Roles domain/application/kernel | `m42-users-roles-domain-use-cases.md` | permissions KEEP |
| M43 | J | repository, composition y thin route | MERGED | #1582 | `7f9644fbc0d38bf604218dc6b2a87f037da10f44` | 2026-07-28 | Users/Roles layers/closeout | `m43-users-roles-repository-thin-route-closeout.md` | repository conserva cero tx explícitas |
| M44 | K | barrido legacy final | MERGED | #1583 | `2083ad330b2f7c30b62a35cb55112fe727e0df9d` | 2026-07-28 | M44 legacy sweep | `m44-legacy-imports-sweep-closeout.md` | ninguno |
| M45 | K | grafo global y dependency guard | MERGED | #1584 | `4adb55a458e36d5905f8d0d497f5a5ef14b8512f` | 2026-07-28 | M45 feature dependency | `m45-backend-feature-dependency-guard-closeout.md` | SCC permitido |
| M46 | K | frontera HTTP residual | MERGED | #1585 | `7a05cb8c5c9d0fd3f8f1d64f05bc5812d39a59eb` | 2026-07-28 | M46 HTTP reclassification | `m46-http-lib-reclassification-closeout.md` | CORS KEEP |
| M47 | K | evaluar `lib/infra` | NO-GO | — | — | 2026-07-28 | evidencia integrada M48 | sección M47 | 5 KEEP; sin diff/commit/PR |
| M48 | K | certificación final | MERGED | #1586 | `cb6f013e90d1363373a86f6bcce26bff68ac453e` | 2026-07-28 | M48 final certification | este documento; auditoría independiente #1587 | ninguno |
| C5 | Contingencia | rediseño de ciclos imprevistos | NOT_RUN | — | — | — | M45/M48 | SCC esperado único | no fue necesario |

M35 precedió en merge a M33/M34 por la secuencia real del programa: cerró
Study Tracking; M35b cerró después la fase separada de accesos por token.

## 6. Fases cerradas

| Fase | Resultado |
| --- | --- |
| 0 | precondiciones e inventario cerrados |
| A–C | Logistics domain, application, infrastructure/rutas cerradas |
| D | Pricing cerrada con topología proporcional |
| E | Public Professionals cerrada |
| F | Clinics cerrada con evidencia cross-tenant |
| G | Study Tracking cerrada |
| H | Accesos Particular/Report cerrados con regresión M35b |
| I | Reports cerrada y compatibilidad temporal retirada |
| J | Users/Roles cerrada; permissions continúa shared kernel |
| K | M44–M46 mergeados, M47 NO-GO reproducido y M48 mergeado (#1586); fase CLOSED |

## Censo final del backend

LOC significa líneas físicas, incluidos blancos y comentarios; se excluyen
`.d.ts`. Para cada archivo se normaliza CRLF a LF, un archivo vacío cuenta cero,
la última línea sin newline cuenta uno y el segmento vacío posterior a un
newline final no se cuenta.

| Área | Archivos TypeScript | LOC |
| --- | ---: | ---: |
| `server/features` | 149 | 16.980 |
| `server/routes` | 35 | 21.154 |
| `server/lib` | 30 | 5.097 |
| `server/middlewares` | 3 | 429 |
| raíz/entrypoints `server/*.ts` | 9 | 2.420 |
| otros | 0 | 0 |
| **Total `server`** | **226** | **46.080** |

El review P2 de M48 detectó que la primera metodología aplicaba una semántica
equivalente a `source.split("\n").length`, que sumaba un segmento vacío por
cada archivo terminado en newline. Esta incidencia quedó corregida mediante el
conteo físico anterior y assertions ejecutables sobre categorías, total y
features.

- Features: 9.
- Rutas productivas `*.fastify.ts`: 35.
- Módulos `server/lib` raíz: 25.
- Módulos `server/lib/http`: 3.

## 8. Inventario y topología por feature

No se exigen capas vacías. Pricing y Clinics conservan servicios directos
porque ésa es su topología proporcional documentada.

| Feature | Archivos | LOC | Capas/directorios reales | Barrel raíz | Entrantes | Salientes | Closeout |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| Clinics | 10 | 2.638 | domain, infrastructure, servicios directos | sí | Users/Roles (2 refs) | Public Professionals (3) | M29 |
| Logistics | 46 | 4.238 | domain, application, infrastructure | no requerido | ninguna | ninguna | M17 |
| Particular Access | 12 | 1.088 | domain, application, infrastructure | sí | Reports (1) | Reports/ST (7) | M33/M35b |
| Pricing | 4 | 489 | infrastructure, servicios directos | no requerido | ninguna | ninguna | M20 |
| Public Professionals | 8 | 1.150 | domain, infrastructure | sí | Clinics (3) | ninguna | M24 |
| Report Access | 12 | 723 | domain, application, infrastructure, composition | sí | ninguna | Reports (1) | M34/M35b |
| Reports | 27 | 3.076 | domain, application, infrastructure, composition | sí | Particular/Report Access (4) | Particular/ST (3) | M41 |
| Study Tracking | 21 | 2.904 | domain, application, infrastructure | sí | Particular/Reports (6) | ninguna | M35 |
| Users/Roles | 9 | 674 | domain, application, infrastructure, composition feature-level | no requerido | ninguna | Clinics (2) | M43 |

Barrels públicos reales:

- Clinics: command de credenciales admin y tipos asociados;
- Particular Access: token y loader público lazy;
- Public Professionals: ocho exports de profile infrastructure;
- Report Access: superficie de token;
- Reports: loader público lazy y `serializeSafeReport`;
- Study Tracking: operaciones token, domain helper y loader público.

Los tres features sin barrel raíz no son destino de imports cross-feature.

## Grafo full/runtime y SCC

El AST recalculó:

| Métrica | Resultado |
| --- | ---: |
| referencias cross-feature | 16 |
| runtime | 13 |
| type-only | 3 |
| dinámicas | 7 |
| aristas dirigidas full | 7 |
| aristas dirigidas runtime | 7 |
| imports cross-feature a internals | 0 |
| `server/lib → server/features` | 0 |
| `features → routes/middlewares` | 0 |
| imports relativos irresolubles | 0 |

Aristas full y runtime:

```text
clinics → public-professionals
particular-access → reports
particular-access → study-tracking
report-access → reports
reports → particular-access
reports → study-tracking
users-roles → clinics
```

El único SCC full y runtime es
`particular-access ↔ reports`, exactamente el residual documentado por M45.
No apareció otro SCC; por eso C5 — `NOT_RUN`.

## 10. Legacy, shims y paths canónicos

Retirados y protegidos como ausentes:

- huérfanos Express:
  `server/utils/async-handler.ts`,
  `server/middlewares/error-handler.ts`;
- Logistics/Pricing:
  `server/db-logistics.ts`, `server/db-pricing.ts`,
  `server/lib/public-pricing-cache.ts`;
- Public Professionals/Clinics:
  `server/db-public-professionals.ts`,
  `server/lib/public-professionals-rate-limit.ts`,
  `server/lib/professional-bank-eligibility.ts`,
  `server/db-admin-clinics.ts`;
- Study/Access:
  `server/lib/study-tracking.ts`,
  `server/lib/token-study-tracking.ts`,
  `server/db-particular.ts`,
  `server/db-study-tracking.ts`;
- Reports:
  `server/db-report-workflow.ts`,
  `server/lib/report-workflow-communication.ts`,
  `server/lib/report-status.ts`,
  `server/lib/report-study-types.ts`,
  `server/lib/reports.ts`;
- Users/Roles:
  `server/db-admin-users-roles.ts`;
- ownership M45:
  los módulos raíz `particular-token` y `report-access-token`;
- HTTP M46:
  los tres helpers raíz anteriores a `server/lib/http`.

No hay shim temporal vencido, import legacy productivo, duplicación ni path
retirado recreado. Las menciones de closeouts previos son evidencia histórica.

## 11. Clasificación final de `server/lib`

Los 27 archivos quedan clasificados así:

| Clasificación | Paths | Decisión |
| --- | --- | --- |
| audit cross-cutting | `admin-audit`, `audit-log`, `audit`, `clinic-audit`, `particular-audit` | KEEP |
| Auth/security congelado | `auth-security`, `fastify-admin-auth`, `login-rate-limit`, `session-last-access` | EXCLUDED / FROZEN |
| rate-limit compartido | `contact-rate-limit`, `public-report-access-rate-limit`, `report-access-token-rate-limit`, `rate-limit-store` | KEEP |
| HTTP M46 | `http/api-request-id`, `http/api-response-security`, `http/sensitive-response-cache` | MOVE completado |
| CORS | `cors-headers` | KEEP M46 |
| infra kernel/cross-cutting | `env`, `logger`, `http-runtime`, `runtime-timing`, `email`, `supabase` | KEEP |
| técnico compartido | `http-types`, `list-pagination` | KEEP |
| permisos | `permissions` | shared kernel KEEP |
| platform/ops | `schema-health` | KEEP |

La frontera `server/lib/http/` no tiene barrel, features, routes,
middlewares, DB, Auth, email ni Supabase como dependencias prohibidas.
`server/lib/infra/` no existe.

## 12. Resultado M46

M46 movió 1:1 tres helpers del hook global a `server/lib/http` y dejó CORS en
su path canónico. `cors-headers.ts` conserva 30 consumidores runtime y carga
eager de `ENV`; moverlo habría excedido 30 paths. Request ID, headers
defensivos, `no-store`, orden de hooks, CORS y trusted origin permanecen
protegidos por el guard M46 y las suites de seguridad.

## M47 — NO-GO reproducido

Recenso independiente:

| Path | LOC | Fan-in runtime/test | Fan-out interno | Side effect/carga | Decisión |
| --- | ---: | --- | --- | --- | --- |
| `server/lib/env.ts` | 244 | 46 / 58 | ninguno resuelto | carga `dotenv/config`, parsea/valida ENV y puede lanzar al importar | KEEP |
| `server/lib/logger.ts` | 22 | 1 / 1 | ninguno | funciones; sin efecto al cargar | KEEP |
| `server/lib/http-runtime.ts` | 85 | 2 / 1 | `db`, `env`, `supabase` | carga transitiva sensible; checks sólo al invocar | KEEP |
| `server/lib/runtime-timing.ts` | 26 | 21 / 1 | ninguno | funciones; sin efecto al cargar | KEEP |
| `server/lib/rate-limit-store.ts` | 207 | 9 / 9 | ninguno | importa crypto; stores/cleanup sólo al invocar | KEEP |

Resultado: 0 `MOVE`, 5 `KEEP`, 0 `DELETE`.

Motivo técnico:

- `env.ts` solo ya exige más de 30 paths para un move sin shim;
- toca `fastify-app`, entrypoints, DB, Supabase, CORS, Auth de los tres realms,
  middlewares y numerosas rutas/tests;
- `rate-limit-store.ts` cruza login clínica/admin/particular y superficies
  públicas;
- `runtime-timing.ts` cruza 21 rutas/middleware;
- `http-runtime.ts` une observabilidad con DB, ENV y storage;
- mover sólo `logger.ts` sería una reclasificación nominal sin frontera
  coherente;
- agrupar los cinco supera ampliamente el límite y amplía el blast radius
  sobre Auth congelado.

No se creó guard M47, closeout independiente, shim, runtime ni
`server/lib/infra/`. M47 tuvo diff, commit, push y PR ausentes.

## 14. Contratos HTTP, DB y side effects

- HTTP: endpoints, payloads, status, serializers, error envelopes, CORS,
  trusted origin, cookies, cache y headers no cambiaron en M48.
- DB: M48 no modifica queries, Drizzle, transacciones, schema o migraciones.
  Los límites históricos quedan fijados por los guards de cada feature.
- Cross-tenant: Clinics, Study Tracking, Particular/Report Access y Reports
  continúan cubiertos por IDOR, ownership y disclosure.
- Email/auditoría: los puertos y el orden persistencia → audit/email →
  respuesta permanecen cubiertos por suites existentes; M48 no agrega
  retries, fallbacks ni compensaciones.

## Revisión de seguridad acumulada

La cohorte real enumera:

- 16 guards `test/architecture/security/*.test.ts`;
- 10 contratos `test/security/*.test.ts`;
- `token-access-m35b-closeout.test.ts`;
- `api-error-no-secrets-contract.test.ts` y
  `api-error-no-stack-traces-contract.test.ts`;
- `public-professionals-response-headers-invariants.test.ts`;
- `workflow-security-policy-contract.test.ts` y
  `workflow-security-validator-contract.test.ts`;
- `global-e2e-production-readiness-contract.test.ts`;
- `public-professionals-histopathology-sql-drift.test.ts`;
- contratos de email safe metadata/success.

Estas suites cubren boundaries Auth, sesiones/cookies, CSRF, superficie
pública, secretos/stacks, CORS/trusted origin, cross-tenant/IDOR, token
enumeration, workflow security, cache/headers, rate limits, SQL drift,
atribución/orden de auditoría y consistencia de email.

Auth y sus tres realms son `EXCLUDED_BUT_GUARDED`: no fueron modularizados ni
modificados, pero sus suites acumuladas forman parte del gate M48. Lo mismo
aplica a workflow/CI: sólo se leyeron; su seguridad se valida con guards
existentes.

## 16. TDD del guard M48

El guard M48 importa y ejecuta los guards M44, M45 y M46 para reutilizar su
AST y no duplicar cientos de líneas. Agrega assertions complementarias de:

- features y barrels públicos;
- censo LOC físico por categoría y por cada una de las nueve features,
  reconciliado con este documento;
- paths legacy/shims ausentes;
- cinco KEEP M47 y ausencia de `server/lib/infra`;
- documento, matriz, M47/C5, validaciones, rollback y veredicto;
- actualización vigente del rector/inventario preservando los closeouts
  históricos;
- ausencia de Git, GitHub, red, procesos y fechas dinámicas.

RED real, antes de crear documentación:

| Ejecución | Resultado | Exit |
| --- | --- | ---: |
| primer RED medido | documento/estado M48 ausentes | 1 |
| RED con TAP visible | 32 tests, 29 pass, 3 fail; 2 fallos documentales causales y 1 colisión con literales legacy M46 | 1 |

La colisión M46 se corrigió construyendo esos tres paths path-aware; no se
relajó M46 ni se tocó runtime.

## Validaciones finales

**Medición pre-commit (snapshot histórico).** Esta tabla registra los resultados
observados en el working tree local, antes del review P2 de censo LOC y antes
del commit. Sus conteos (32 tests de guard M48 / 580 de arquitectura / 3.960
totales) quedaron superados por el artefacto realmente mergeado; el estado
vigente es la tabla siguiente.

| Comando | Estado | Conteos / resultado | Duración | Exit |
| --- | --- | --- | ---: | ---: |
| M44–M48 dirigida | PASSED | 57 tests, 57 pass, 0 fail | 2.802 ms | 0 |
| arquitectura completa | PASSED | 72 archivos; 580 tests, 579 pass, 1 skip Windows esperado, 0 fail | 5.098 ms | 0 |
| `pnpm typecheck` | PASSED | runtime TypeScript sin errores | 3.161 ms | 0 |
| primer `pnpm typecheck:test` | FAILED | dos errores TS2339 de narrowing en el guard M48 | 5.517 ms | 2 |
| reintento `pnpm typecheck:test` | PASSED | type predicate local; cero errores | 5.648 ms | 0 |
| guard M48 aislado tras corrección | PASSED | 32 tests, 32 pass, 0 fail | 2.461 ms | 0 |
| seguridad dirigida | PASSED | 40 archivos; 308 tests, 308 pass, 0 fail | 3.105 ms | 0 |
| `pnpm validate:local` | PASSED | typechecks + 3.960 tests, 3.959 pass, 1 skip, 0 fail + build 922,4 kb | 26.962 ms | 0 |
| `pnpm security:public-surface` | PASSED | 0 findings públicos; 2 markers server-only esperados | 884 ms | 0 |
| `pnpm validate:local:schema` | NOT_RUN | requiere DB real; variables de proceso ausentes y no se permite cargar `.env` | — | — |
| `git diff --check` | PASSED | cero errores de whitespace | <1 s | 0 |

Los incidentes de tooling se registran, no se ocultan:

- la primera medición PowerShell de RED ocultó TAP; el mismo RED se repitió sin
  modificar archivos para capturar detalle;
- el RED detectó la protección source-aware M46 sobre literales legacy y el
  guard M48 se hizo path-aware.
- el primer `typecheck:test` encontró que el narrowing de `moduleSpecifier` no
  sobrevivía a `filter().map()`; se agregó un type predicate local, el
  reintento pasó y el guard M48 volvió a 32/32.

**Validaciones vigentes del artefacto mergeado (#1586).** El fix causal del
review P2 de censo LOC agregó tres assertions ejecutables; los conteos
definitivos son:

| Comando | Estado | Conteos / resultado |
| --- | --- | --- |
| guard M48 aislado | PASSED | **35 tests, 35 pass, 0 fail** |
| arquitectura completa (`test/architecture/**`) | PASSED | **583 tests, 582 pass, 1 skip Windows esperado, 0 fail** |
| `pnpm validate:local` | PASSED | **3.963 tests, 3.962 pass, 1 skip, 0 fail** |
| build | PASSED | `dist/index.js` 922,4 kb |
| `pnpm validate:local:schema` | NOT_RUN | requiere DB real; prohibido cargar `.env` |

Estos conteos fueron reproducidos de forma independiente por la auditoría del
PR #1587 (`docs/audit/post-m48-backend-reordering-excellence-audit.md`, §8).

## 18. Estado Git/GitHub de M48

**Snapshot local previo al merge (histórico).**

- `HEAD`: baseline sin modificar.
- Working tree: cambios M48 locales sin stage.
- Índice: vacío.
- Runtime diff: cero.
- Stage, Commit, Push, PR y Merge: `NOT_RUN` en el momento de redactar la
  certificación.

**Estado vigente post-merge.**

- PR: **#1586**, `MERGED`.
- Squash commit: `cb6f013e90d1363373a86f6bcce26bff68ac453e`.
- Fecha de merge: `2026-07-28T15:27:31Z` (UTC).
- Base del merge: `main`; checks `validate-backend` ×2,
  `validate-pr-governance` y `qga-workflow-security` en verde.
- Rama `test/backend-modularization-m48-final-certification`: eliminada local y
  remotamente.
- Runtime diff del PR: cero (docs + guard).
- Auditoría independiente posterior: PR **#1587**, `MERGED`, squash
  `e1d1cfdb3eeae9517927f96f355e8fdadd3e5862`.

## 19. Riesgos residuales aceptados

- SCC `particular-access ↔ reports`, congelado por M45/M48;
- Auth fuera del programa, protegido por suites;
- cinco KEEP M47 y CORS KEEP M46;
- aislamiento multi-tenant a nivel aplicación, no RLS;
- cobertura instrumental C1 no ejecutada; la regresión se basa en suites
  deterministas existentes;
- M47 NO-GO, que es una decisión proporcional y no un defecto runtime.

## 20. Exclusiones futuras

C1 coverage, C2 complejidad, C3 `lib/shared`, C4 Auth y C5 rediseño de ciclos
siguen fuera. Cualquier cambio futuro de esos dominios requiere milestone,
scope y autorización propios; M48 no los habilita implícitamente.

## Rollback documental

Como M48 no cambia runtime, el rollback consiste en retirar conjuntamente:

1. guard M48;
2. este documento;
3. addenda vigentes M48 del rector e inventario;
4. ajustes forward-looking M45/M46.

No se revierten closeouts históricos M01–M46, no se restaura M47, no se toca
DB/schema/datos y no existe compensación productiva.

## 22. Declaración final

M44, M45 y M46 están mergeados; M47 es `NO-GO`; M48 está **mergeado** mediante
PR #1586 (`cb6f013e90d1363373a86f6bcce26bff68ac453e`, 2026-07-28T15:27:31Z);
C5 continúa `NOT_RUN`. La **Fase K queda CLOSED** y el **programa queda
CERTIFIED_WITH_RESIDUAL_RISKS**, con riesgos residuales explícitos y sin
cambios runtime. La auditoría independiente del PR #1587 ratificó la
certificación con `EXCELLENT_WITH_RESIDUAL_RISKS` (93/100).

Veredicto final: **CERTIFIED_WITH_RESIDUAL_RISKS**.
