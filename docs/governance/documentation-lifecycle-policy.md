# Documentation Lifecycle Policy

| Campo | Valor |
| --- | --- |
| Document owner | Docs owner |
| Domain | Documentation lifecycle governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Fuente normativa vigente para lifecycle documental; complemento de [VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md) y [VETNEB Historical Documentation Classification](../HISTORICAL_DOCUMENTATION.md) |
| Effective date | 2026-07-11 |
| Last verified date | 2026-07-11 |
| Review cadence | Mensual |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-005`; `ERM-DOC-001` |
| Evidence or approval reference | PR-ERM-4 docs-only |

## 2. Propósito

Esta politica define como nace, se propone, se aprueba, se convierte en fuente vigente, se revisa, se reclasifica como secundaria, se reemplaza, se conserva como historica y eventualmente se cierra o retira una pieza documental del repositorio VETNEB.

Es la fuente normativa vigente para lifecycle documental. Complementa a [VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md), complementa a [VETNEB Historical Documentation Classification](../HISTORICAL_DOCUMENTATION.md), aplica a documentos nuevos y a documentos existentes cuando sean materialmente modificados o reclasificados, y establece la base documental para un futuro guard automatico.

Esta politica por si sola no prueba enforcement automatico, no cierra `ERM-DOC-001` y no permite declarar `ERM-CTRL-005 Documentation Governance` como `IMPLEMENTED`.

## 3. Alcance

Esta politica aplica a:

- documentos nuevos de gobernanza, auditoria, fuentes rectoras, closeouts, runbooks, politicas, ADR, RFC, registros y evidencias documentales;
- documentos existentes cuando un PR los modifica materialmente, los promueve, los reclasifica, los reemplaza o cambia su rol como fuente;
- indices documentales, sources of truth y registros de controles que enlazan documentos normativos;
- PRs docs-only que crean, promueven, reclasifican, reemplazan, cierran o retiran documentos.

La politica gobierna el lifecycle documental, no el lifecycle tecnico de codigo, datos, infraestructura, deploys o configuracion externa.

## 4. Fuera de alcance

Esta politica no implementa enforcement automatico, CI, scripts, guards, cambios de GitHub, branch protection, CODEOWNERS, workflows, dependencias, backend, frontend, API, auth, sesiones, DB, schemas, migraciones ni runtime.

Tampoco ejecuta supersession concreta, reclasificacion masiva, movimiento fisico, borrado, archivo fisico ni renombrado de documentos existentes. Cualquier guard automatico requiere un PR CI-only o tooling-only independiente.

## 5. Jerarquía documental

Orden normativo de lectura para lifecycle documental:

1. `AGENTS.md` para protocolo operativo obligatorio de agentes.
2. [VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md) para identificar la fuente vigente por dominio.
3. La fuente rectora del dominio afectado.
4. Esta politica para decidir lifecycle, metadata, transiciones, indices y trazabilidad documental.
5. [VETNEB Historical Documentation Classification](../HISTORICAL_DOCUMENTATION.md) para separar documentos historicos, secundarios y superseded.
6. [Enterprise Control Register](./enterprise-control-register.md) para estado operativo vivo de controles enterprise.

Esta politica no reemplaza fuentes rectoras por dominio, la clasificacion historica existente, auditorias vigentes, el enterprise control register ni `AGENTS.md`.

## 6. Principios normativos

- Una pieza documental no se vuelve normativa por existir: necesita rol, owner, dominio, estado y enlace desde el indice correspondiente.
- Una fuente vigente debe poder distinguirse de evidencia historica, nota secundaria o documento reemplazado.
- Un documento historico o superseded no debe usarse como instruccion vigente salvo trazabilidad puntual y declarada.
- Dos fuentes `ACTIVE` contradictorias no pueden gobernar el mismo dominio al mismo tiempo.
- Un cambio de estado documental debe dejar evidencia auditable.
- La ausencia de guard automatico debe permanecer visible como deuda, no ocultarse con narrativa.
- Los owners son roles, no personas inventadas.
- Los snapshots historicos no se reescriben para simular cierres posteriores.

## 7. Estados del lifecycle documental

Los estados canonicos del lifecycle documental son exactamente:

| Estado canonico | Mapeo humano permitido | Definicion normativa |
| --- | --- | --- |
| `PROPOSED` | Propuesto | Documento todavia no aprobado o no mergeado. No puede actuar como fuente normativa. Debe identificar proposito y owner propuesto. |
| `ACTIVE` | Vigente | Fuente vigente aprobada. Debe tener dominio, owner, review cadence y enlace desde el indice correspondiente. Debe figurar en `docs/SOURCES_OF_TRUTH.md` cuando sea fuente primaria o normativa transversal. |
| `SECONDARY` | Secundario | Complemento permitido. No gobierna cuando existe una fuente `ACTIVE` mas autoritativa. Debe identificar la fuente primaria correspondiente. |
| `SUPERSEDED` | Reemplazado / superseded | Documento reemplazado expresamente por otra fuente. No debe utilizarse como instruccion vigente. Debe identificar `Superseded by`. Debe mantenerse solo para trazabilidad salvo retiro excepcional aprobado. |
| `HISTORICAL` | Historico | Evidencia de una decision, implementacion, PR, auditoria o estado pasado. No debe usarse como blueprint ni fuente normativa. Debe conservarse para trazabilidad. |
| `CLOSED` | Cerrado | Documento que describe un bloque, iniciativa o control concluido. Conserva valor de evidencia. No debe reabrirse como plan vigente sin evidencia nueva y un PR explicito. Puede seguir siendo fuente de closeout, pero no roadmap activo. |

Estos estados son estados documentales. No reemplazan los estados del enterprise control register:

- `IMPLEMENTED`
- `PARTIAL`
- `DOCUMENTED_ONLY`
- `NOT_IMPLEMENTED`
- `NOT_APPLICABLE`

Transiciones permitidas:

- `PROPOSED` -> `ACTIVE`
- `PROPOSED` -> `SECONDARY`
- `PROPOSED` -> `HISTORICAL`
- `PROPOSED` -> `CLOSED`
- `ACTIVE` -> `SECONDARY`
- `ACTIVE` -> `SUPERSEDED`
- `ACTIVE` -> `CLOSED`
- `SECONDARY` -> `ACTIVE`
- `SECONDARY` -> `SUPERSEDED`
- `SECONDARY` -> `HISTORICAL`
- `SUPERSEDED` -> `HISTORICAL`
- `CLOSED` -> `HISTORICAL`

Cualquier transicion no listada requiere justificacion explicita en un PR docs-only y aprobacion del owner documental o de dominio.

Queda prohibido:

- `HISTORICAL` -> `ACTIVE` sin nuevo PR, evidencia actual y revalidacion completa;
- `SUPERSEDED` -> `ACTIVE` sin declarar por que la fuente reemplazante dejo de ser valida;
- eliminar silenciosamente un documento para simular cierre;
- cambiar estado sin actualizar indices y trazabilidad;
- mantener dos fuentes `ACTIVE` contradictorias para el mismo dominio.

## 8. Requisitos mínimos de metadata

Todo documento nuevo de gobernanza y todo documento existente materialmente modificado o reclasificado debe declarar metadata normativa minima mediante una tabla Markdown visible o una seccion explicita equivalente.

No se exige YAML frontmatter. Esta política no exige una migración masiva inmediata de los documentos existentes. La metadata normativa se aplica a documentos nuevos y a documentos existentes cuando sean materialmente modificados o reclasificados. Esta regla no exime de corregir contradicciones o referencias peligrosas detectadas, y no afirma ni sustituye enforcement automático.

Como excepción de bootstrap documental, el PR que adopta inicialmente esta política puede modificar documentos preexistentes de tipo índice, mapa de Sources of Truth, enterprise control register o registro de gobernanza relacionado únicamente para publicar, enlazar, registrar, declarar la autoridad o mantener la trazabilidad de esta política, sin exigir en ese mismo PR el retrofit completo de metadata normativa sobre esos documentos. Esta excepción no permite conservar contradicciones detectadas, enlaces peligrosos o rotos, referencias normativas incorrectas, presentar documentos `HISTORICAL` o `SUPERSEDED` como fuentes vigentes, inventar evidencia ni afirmar enforcement automático.

Después del merge del PR de adopción, la regla tiene aplicación prospectiva: un documento preexistente debe incorporar o actualizar la metadata cuando cambios materiales futuros afecten contenido normativo, `Lifecycle status`, `Authoritative source role`, `Document owner`, `Review cadence`, `Supersedes`, `Superseded by`, promoción, reclasificación, reemplazo, cierre o relación con una fuente vigente. Una actualización puramente referencial, de navegación o de índice no dispara por sí sola el retrofit completo, salvo que también cambie autoridad documental, lifecycle state, ownership, cadence, supersession, interpretación normativa o la fuente rectora del dominio.

Metadata minima:

| Campo | Regla |
| --- | --- |
| Document owner | Rol responsable de mantenimiento documental. |
| Domain | Dominio documental o tecnico al que aplica. |
| Lifecycle status | Uno de los estados canonicos definidos en esta politica. |
| Authoritative source role | Fuente primaria, fuente normativa transversal, complemento, evidencia o closeout. |
| Effective date | Fecha desde la que aplica la version vigente. |
| Last verified date | Fecha de ultima verificacion real; no se inventa evidencia. |
| Review cadence | Cadencia esperada de revision. |
| Supersedes | Documento reemplazado, si existe. |
| Superseded by | Documento reemplazante, si existe. |
| Related controls or gaps | Controles, gaps, auditorias o PRs relacionados. |
| Evidence or approval reference | PR, commit, evidencia o aprobacion que sustenta el estado. |

## 9. Creación y propuesta

Un documento en propuesta debe:

- declarar proposito y alcance;
- identificar owner propuesto por rol;
- indicar dominio afectado;
- declarar si busca ser fuente primaria, normativa transversal, complemento, evidencia, closeout o referencia historica;
- identificar fuentes vigentes que consulta o podria reemplazar;
- permanecer sin autoridad normativa hasta su aprobacion y merge.

Mientras un documento este propuesto, sus afirmaciones pueden orientar revision, pero no desplazan una fuente vigente ni autorizan cambios fuera de scope.

Un documento nuevo aprobado únicamente como complemento puede transicionar directamente de `PROPOSED` a `SECONDARY`; un documento nuevo aprobado exclusivamente como evidencia o referencia histórica puede transicionar directamente de `PROPOSED` a `HISTORICAL`. Estos documentos no necesitan pasar artificialmente por `ACTIVE`. El documento `SECONDARY` debe identificar la fuente `ACTIVE` primaria o más autoritativa relacionada cuando exista; el documento `HISTORICAL` debe identificar la fuente vigente relacionada cuando exista y declarar que no posee autoridad normativa.

Ambos casos deben mantener propósito, alcance, `Document owner`, `Domain`, `Lifecycle status`, `Authoritative source role`, metadata mínima, evidencia o referencia de aprobación, PR docs-only, enlaces relativos válidos y ausencia de contradicción con fuentes vigentes. La aprobación directa como `SECONDARY` o `HISTORICAL` no permite desplazar una fuente `ACTIVE`, evadir revisión, omitir owner o metadata ni usar documentos históricos como instrucciones vigentes.

## 10. Promoción a fuente vigente

Para promover un documento a `ACTIVE`, el PR debe demostrar:

- proposito y alcance claros;
- owner por rol;
- dominio definido;
- ausencia de contradiccion con una fuente vigente;
- enlaces relativos validos;
- inclusion en el indice apropiado;
- inclusion en `docs/SOURCES_OF_TRUTH.md` cuando corresponda;
- revision de documentos que reemplaza;
- PR de scope unico;
- validacion documental verde.

La promocion no debe mezclar cambios documentales con runtime, CI, dependencias, configuracion productiva ni cambios de seguridad fuera de scope.

## 11. Revisión periódica

Cada documento con rol normativo debe revisarse segun su cadence documentada.

Tambien requiere revision obligatoria ante:

- cambios estructurales del repositorio;
- cambios regulatorios o productivos relevantes;
- cambios de ownership;
- cambio de la fuente de verdad del dominio;
- evidencia de contradiccion con una fuente vigente.

Una revision vencida no cambia silenciosamente el lifecycle state. Debe generar seguimiento visible como deuda documental y no permite inventar evidencia de revision.

## 12. Reclasificación como secundaria

Un documento puede pasar a `SECONDARY` cuando conserva valor como complemento, pero ya no debe gobernar frente a una fuente mas autoritativa.

El PR debe:

- identificar la fuente primaria correspondiente;
- explicar que partes quedan como complemento;
- actualizar el indice de dominio si el documento estaba enlazado como fuente vigente;
- actualizar `docs/SOURCES_OF_TRUTH.md` cuando corresponda;
- dejar evidencia de estado anterior, estado nuevo, owner, fecha y motivo.

La reclasificacion como secundaria no autoriza borrar ni mover el documento.

## 13. Supersession

Cuando un documento reemplaza a otro, el mismo PR debe:

- identificar la nueva fuente `ACTIVE`;
- identificar el documento `SUPERSEDED`;
- actualizar `docs/SOURCES_OF_TRUTH.md` si aplica;
- actualizar el indice de dominio;
- actualizar `docs/HISTORICAL_DOCUMENTATION.md` cuando la clasificacion historica lo requiera;
- anadir enlaces `Supersedes` y `Superseded by`;
- no eliminar ni mover el documento reemplazado salvo PR move-only independiente.

Este PR no realiza ninguna supersession concreta.

## 14. Clasificación histórica

Un documento puede clasificarse como `HISTORICAL` cuando su valor principal es evidencia de una decision, implementacion, PR, auditoria o estado pasado.

La clasificacion historica debe:

- preservar trazabilidad;
- evitar su uso como blueprint o fuente normativa;
- enlazar la fuente vigente cuando exista;
- actualizar indices y classification docs cuando corresponda;
- conservar evidencia sin reescribir snapshots aprobados.

La clasificacion historica no equivale a eliminacion, cierre operativo ni rollback.

## 15. Cierre documental

Un documento puede pasar a `CLOSED` cuando describe un bloque, iniciativa o control concluido y conserva valor de closeout o evidencia.

El cierre documental debe:

- explicar que se concluyo;
- declarar evidencia de cierre;
- indicar si quedan follow-ups separados;
- evitar presentarse como roadmap activo;
- impedir reapertura implicita sin evidencia nueva y PR explicito.

Un documento `CLOSED` puede seguir siendo fuente de closeout, pero no fuente de plan activo.

## 16. Retiro o eliminación excepcional

El retiro o eliminacion fisica de un documento es excepcional y requiere PR independiente con scope explicito.

Antes de retirar o eliminar se debe justificar:

- motivo;
- owner;
- riesgo de perdida de trazabilidad;
- fuente reemplazante o evidencia de que no corresponde conservarlo;
- impacto en indices, links, SoT y classification docs;
- estrategia de rollback documental.

No se debe retirar, mover, renombrar ni eliminar un documento para simular cierre, supersession o limpieza de deuda.

## 17. Ownership y responsabilidades

| Rol | Responsabilidades minimas |
| --- | --- |
| Document owner | Mantener metadata, estado, links, cadence, evidencia y consistencia con indices. |
| Domain owner | Confirmar que el documento no contradice la fuente rectora del dominio y que el alcance tecnico o operativo es correcto. |
| Governance / Docs owner | Mantener esta politica, `docs/SOURCES_OF_TRUTH.md`, indices de gobernanza y reglas de reclasificacion documental. |
| PR author | Declarar scope, lifecycle transition, documentos afectados, evidencia, validaciones y rollback documental. |
| Reviewer | Verificar autoridad, links, estado, metadata, ausencia de mixed scope no autorizado y consistencia con fuentes vigentes. |
| Repository admin | Intervenir solo cuando el cambio afecte configuracion externa, branch protection, rulesets, CODEOWNERS, workflows o controles de GitHub. |

El ownership documental no equivale automaticamente a ownership tecnico efectivo de GitHub.

## 18. Reglas para índices y sources of truth

Todo documento `ACTIVE` que sea fuente primaria o normativa transversal debe figurar en `docs/SOURCES_OF_TRUTH.md`.

Los indices de dominio deben:

- enlazar fuentes vigentes con rutas relativas;
- indicar complementos permitidos cuando existan;
- retirar autoridad normativa de documentos reclasificados, reemplazados, historicos o cerrados;
- evitar duplicar dos fuentes `ACTIVE` contradictorias para el mismo dominio;
- mantener relacion visible con `docs/HISTORICAL_DOCUMENTATION.md` cuando haya documentos historicos o superseded.

Toda reclasificacion documental debe seguir esta politica y actualizar indices y trazabilidad en el mismo PR cuando corresponda.

## 19. Reglas para PRs documentales

Todo PR que cree, promueva, reclasifique o reemplace documentos debe declarar:

- Summary;
- Scope;
- Validation;
- Rollback;
- lifecycle transition declarada;
- documentos e indices afectados;
- owner;
- evidencia;
- ausencia de mixed scope no autorizado.

No se deben mezclar PRs docs-only con runtime, CI, dependencias, lockfiles, workflows, configuracion productiva, backend, frontend, API, auth, DB, schemas, migraciones ni cambios de seguridad fuera de scope.

## 20. Evidencia y audit trail

Todo cambio de estado documental debe registrar:

| Evidencia | Regla |
| --- | --- |
| Estado anterior | Lifecycle status previo o razon por la que no existia. |
| Estado nuevo | Lifecycle status resultante. |
| Fecha | Fecha ISO del cambio o verificacion. |
| Owner | Rol responsable. |
| Motivo | Por que se crea, promueve, reclasifica, reemplaza, cierra o retira. |
| Evidencia | Fuente, auditoria, PR, commit, review o decision que sustenta el cambio. |
| Documento reemplazante | Obligatorio cuando exista supersession. |
| PR o commit de aprobacion | Referencia durable una vez aprobado. |

Una politica documental no prueba enforcement automatico. Un control solo puede declararse implementado cuando exista implementacion observable y evidencia verificable segun el registro correspondiente.

## 21. Excepciones

Una excepcion a esta politica requiere:

- PR docs-only con justificacion explicita;
- owner documental o de dominio;
- alcance unico;
- riesgo de trazabilidad documentado;
- plan de regularizacion o motivo de no aplicabilidad;
- validacion de que no se usa la excepcion para ocultar deuda o contradiccion.

Las excepciones no permiten modificar snapshots historicos, omitir evidencia, mezclar scopes ni eliminar documentos silenciosamente.

## 22. Futuro enforcement automático

Un futuro guard automatico debe implementarse en un PR CI-only o tooling-only independiente. Esta politica solo define la base normativa.

El futuro guard deberia validar como minimo:

- links relativos;
- metadata requerida para documentos nuevos o reclasificados;
- lifecycle status permitido;
- ausencia de dos fuentes `ACTIVE` incompatibles;
- actualizacion de SoT e indices cuando corresponda;
- referencias a documentos `SUPERSEDED` o `HISTORICAL` usadas como normativa;
- transicion declarada;
- scope docs-only coherente.

Hasta que ese guard exista y este enlazado como evidencia durable, `ERM-CTRL-005` permanece `PARTIAL` y `ERM-DOC-001` permanece abierto.

## 23. Criterios de cumplimiento

Un cambio documental cumple esta politica cuando:

- usa uno de los seis estados canonicos;
- declara metadata minima cuando corresponde;
- respeta las transiciones permitidas o justifica una excepcion;
- actualiza indices y SoT cuando cambia autoridad documental;
- conserva trazabilidad de documentos reemplazados, historicos o cerrados;
- no elimina documentos para simular cierre;
- no mezcla docs-only con runtime, CI, dependencias o configuracion productiva;
- deja validacion documental ejecutada y resultado verificable.

El incumplimiento debe tratarse como deuda documental visible, no como cierre implicito.

## 24. Historial inicial

| Fecha | Cambio | Estado resultante | Evidencia |
| --- | --- | --- | --- |
| 2026-07-11 | Creacion inicial de la politica enterprise de lifecycle documental | `ACTIVE` al aprobarse el PR docs-only | PR-ERM-4; `ERM-CTRL-005` permanece `PARTIAL`; `ERM-DOC-001` no se cierra |
