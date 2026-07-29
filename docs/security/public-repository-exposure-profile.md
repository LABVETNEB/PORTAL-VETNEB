# Public Repository Exposure Profile

Perfil documental de exposición pública para la seguridad del repositorio
`LABVETNEB/PORTAL-VETNEB`.

| Campo | Valor |
| --- | --- |
| Document owner | Security / Repository governance |
| Domain | Public repository security exposure |
| Lifecycle status | ACTIVE |
| Authoritative source role | Perfil normativo vigente para clasificar y sanitizar documentación de seguridad publicada |
| Effective date | 2026-07-29 |
| Last verified date | 2026-07-29 |
| Review cadence | Mensual y ante cambios de visibilidad, titularidad, producto GitHub, superficie documental o incidente de secretos |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-016`; `GAP-P0-1`; `PR-SEC-REPO-SETTINGS` |
| Evidence or approval reference | PR #1591, merge commit `9479f6d36dd6dfa1ed25a81beacb22e1bed98f34`; closeout R2 sanitizado del 2026-07-29 con dos lecturas administrativas independientes coincidentes |
| Document classification | PUBLIC |

## 1. Propósito y autoridad

Este perfil define qué información de seguridad puede permanecer en el
repositorio público, qué debe sanitizarse, qué debe mantenerse restringido y
qué no debe incorporarse nunca al repositorio.

Su lifecycle `ACTIVE`, aprobado mediante PR #1591, lo establece como perfil
normativo vigente de exposición pública y lo registra en
[VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md).

Este documento clasifica evidencia documental. No demuestra enforcement
técnico, no habilita features de GitHub y no cierra controles de seguridad
runtime.

## 2. Ownership por rol

| Rol | Responsabilidad |
| --- | --- |
| Security / Repository governance | Mantener este perfil, resolver clasificaciones y coordinar revisiones periódicas. |
| Domain owner | Confirmar que el contenido publicado es exacto, necesario y no expone datos o procedimientos restringidos. |
| Repository admin | Verificar elegibilidad y configuración externa; ejecutar cambios solo con autorización específica. |
| PR author | Aplicar sanitización al diff y declarar evidencia, exclusiones y rollback documental. |
| Reviewer | Revisar links, clasificación, minimización, ausencia de secretos y consistencia con fuentes vigentes. |

## 3. Clasificaciones

| Clasificación | Regla | Ejemplos permitidos |
| --- | --- | --- |
| `PUBLIC` | Contenido diseñado para difusión pública, sin datos internos ni detalle operativo sensible. | Políticas generales, ownership por rol, criterios de revisión y fuentes oficiales. |
| `PUBLIC_SANITIZED` | Contenido de seguridad publicable solo después de minimizar identificadores, valores runtime y detalles operativos innecesarios. | Arquitectura defensiva, actores, rutas contractuales, boundaries, pruebas, guardrails, estados, gaps y criterios NO-GO. |
| `RESTRICTED` | Contenido legítimo que requiere un canal con acceso controlado y no debe entrar al repositorio público. | Evidencia runtime identificable, inventario de alertas, contactos de escalación privados, topología operativa no pública y registros de incidentes. |
| `PROHIBITED` | Contenido que no debe almacenarse en documentación ni evidencia del repositorio. | Secretos, credenciales, cookies o sesiones reales, hashes derivados de credenciales, claves privadas, signed URLs completas y dumps o logs sin sanitizar. |

`PUBLIC_SANITIZED` no significa que toda información técnica pueda publicarse.
Cada fragmento debe ser necesario para gobernanza, verificable sin revelar
valores reales y seguro frente a correlación con otras fuentes.

## 4. Baseline histórica de secret protection

Lectura administrativa de solo lectura y salida limitada a campos no sensibles,
verificada el 2026-07-29:

| Atributo | Estado observado |
| --- | --- |
| Visibilidad | `public` |
| Tipo de owner | `User` |
| `secret_scanning` | `disabled` |
| `secret_scanning_push_protection` | `disabled` |
| `secret_scanning_validity_checks` | `disabled` |
| `secret_scanning_non_provider_patterns` | `disabled` |

La lectura no incluyó alertas, secretos, tokens ni respuestas API completas.
Los mensajes impresos por el intento mutante previo no forman parte de esta
evidencia.

La tabla conserva el estado inmediatamente anterior a la habilitación R2. No
representa la configuración efectiva actual.

## 5. Estado efectivo y elegibilidad real

La habilitación R2 del 2026-07-29 se ejecutó mediante un archivo `.ps1`
independiente, fail-fast y con rollback automático preparado. No se ejecutó
rollback. Dos lecturas administrativas independientes posteriores coincidieron
en los siguientes estados sanitizados:

| Feature | Elegibilidad actual | Estado operativo | Decisión |
| --- | --- | --- | --- |
| Secret scanning básico (`secret_scanning`) | Disponible para repositorios públicos. | `enabled` | `ENABLED`; revisión periódica. |
| Repository push protection (`secret_scanning_push_protection`) | Disponible para este repositorio público cuando Secret Protection está habilitado. | `enabled` | `ENABLED`; revisión periódica. |
| Validity checks (`secret_scanning_validity_checks`) | Requiere repositorio perteneciente a una organización con GitHub Team y GitHub Secret Protection. | `disabled` | `NOT_AVAILABLE` bajo titularidad y producto actuales. |
| Non-provider patterns (`secret_scanning_non_provider_patterns`) | Requiere repositorio perteneciente a una organización con GitHub Team y GitHub Secret Protection. | `disabled` | `NOT_AVAILABLE` bajo titularidad y producto actuales. |

No hubo drift entre las dos lecturas de las features avanzadas. Las lecturas no
incluyeron alertas, secretos, tokens, datos de autenticación ni respuestas API
completas.

Fuentes oficiales verificadas el 2026-07-29:

- [Enabling secret scanning for your repository](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning)
- [Enabling push protection for your repository](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks/enable-push-protection)
- [Enabling validity checks for your repository](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/customize-leak-detection/enable-validity-checks)
- [Enabling secret scanning for non-provider patterns](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enabling-secret-scanning-for-non-provider-patterns)

No se recomienda transferir el repositorio para satisfacer una métrica. Una
transferencia de titularidad, cambio de plan o cambio de producto es una
decisión estructural independiente y queda fuera de este perfil.

## 6. Inventario `docs/security/**`

La revisión de contenido se realizó sobre los seis archivos rastreados en
`main@f2d8e05ef75aa91d27c1832489a4b94b723bd84a`.

| Documento | Decisión | Fundamento |
| --- | --- | --- |
| [csp-reporting-rollout.md](./csp-reporting-rollout.md) | `PUBLIC_SANITIZED` | Expone rollout defensivo, límites, guardrails y criterios previos sin valores runtime reales. |
| [ENDPOINT_PERMISSION_MATRIX.md](./ENDPOINT_PERMISSION_MATRIX.md) | `PUBLIC_SANITIZED` | Publica contratos de actores, auth y ownership; mantiene la evidencia runtime pendiente y no incorpora sesiones reales. |
| [ENDPOINT_TEST_MATRIX.md](./ENDPOINT_TEST_MATRIX.md) | `PUBLIC_SANITIZED` | Mapea superficie, pruebas y gaps sin respuestas reales, datos de tenants ni alertas. |
| [RBAC_MATRIX.md](./RBAC_MATRIX.md) | `PUBLIC_SANITIZED` | Documenta actores, scopes, permisos y NO-GO sin identidades ni credenciales reales. |
| [rls-enforcement-matrix.md](./rls-enforcement-matrix.md) | `PUBLIC_SANITIZED` | Describe boundaries y ausencia de RLS runtime; no publica roles DB efectivos, policies reales ni evidencia externa. |
| [security-sessions-tenant-rls-audit.md](./security-sessions-tenant-rls-audit.md) | `PUBLIC_SANITIZED` | Consolida invariantes y gaps; mantiene la evidencia cross-tenant como pendiente. |

No se detectó un hallazgo concreto que justificara modificar esos seis
documentos en este bloque.

## 7. Contenido permitido

Puede publicarse como `PUBLIC` o `PUBLIC_SANITIZED`, según corresponda:

- arquitectura defensiva y separación de superficies;
- actores, roles y permisos contractuales;
- nombres de endpoints ya expuestos por la aplicación;
- boundaries de tenant, ownership y recursos;
- respuestas esperadas expresadas como contratos genéricos;
- nombres de tests y guardrails;
- estados `pending`, gaps, riesgos y criterios NO-GO;
- criterios de cierre, revisión, rollback y reapertura;
- enlaces a documentación oficial y fuentes internas públicas.

## 8. Contenido restringido

Debe mantenerse fuera del repositorio público y gestionarse en un canal con
acceso controlado:

- evidencia runtime con identificadores de usuarios, tenants, reportes o
  recursos;
- cuerpos de request/response reales aunque el valor principal esté oculto;
- inventarios de alertas de secret scanning o incidentes;
- rutas operativas internas no necesarias para el contrato público;
- información de proveedores, cuentas, topología o escalación no pública;
- timestamps correlacionables con actividad clínica o comercial;
- capturas y logs que no hayan superado una revisión de sanitización.

## 9. Contenido prohibido

Nunca debe incorporarse al repositorio:

- valores de secretos, tokens, credenciales o passwords;
- cookies o sesiones reales;
- hashes de passwords, tokens de sesión, credenciales o derivados de secretos;
- claves privadas o material criptográfico privado;
- signed URLs completas;
- datos clínicos, comerciales o de tenants;
- dumps, backups o logs sin sanitizar;
- respuestas API administrativas completas;
- instrucciones accionables para explotar una vulnerabilidad abierta.

## 10. Reglas de sanitización

1. Minimizar la evidencia al hecho que se necesita probar.
2. Reemplazar valores runtime por estado, presencia o categoría; por ejemplo,
   `signedUrl=present`, nunca la URL.
3. Usar roles y categorías, no identidades reales.
4. Omitir payloads completos y conservar únicamente campos no sensibles
   previamente aprobados.
5. Evitar timestamps o identificadores que permitan correlación innecesaria.
6. Describir fallos y mitigaciones sin publicar una secuencia de explotación.
7. Revisar solo el diff añadido con patrones seguros; no abrir `.env`, logs,
   backups ni fuentes de secretos para demostrar ausencia.
8. Si la sanitización reduce la evidencia por debajo de lo verificable,
   mantenerla `RESTRICTED` y enlazar solo una referencia durable no sensible.

## 11. Tratamiento de un secreto incorporado por error

Si se detecta un secreto real o probable:

1. detener la publicación y no copiar el valor a comentarios, issues, chats,
   auditorías ni evidencia;
2. tratarlo como expuesto y notificar por el canal restringido definido por el
   owner de seguridad;
3. revocar o rotar la credencial mediante el owner correspondiente;
4. conservar en el repositorio únicamente una descripción sanitizada del
   incidente y su estado;
5. coordinar cualquier remediación de historial como tarea independiente,
   específicamente autorizada y con targets exactos;
6. revalidar el diff y la configuración de secret protection antes de reanudar
   la entrega.

Este perfil no autoriza reescritura de historial, borrado ni mutaciones de
GitHub.

## 12. Checklist pre-merge

- [ ] El documento tiene owner por rol, dominio, lifecycle y clasificación.
- [ ] Cada afirmación operativa tiene evidencia durable o se declara pendiente.
- [ ] El diff no contiene secretos, credenciales, cookies, hashes de
  credenciales, signed URLs completas ni datos de tenants.
- [ ] La evidencia runtime fue minimizada o permanece fuera del repositorio.
- [ ] Los links relativos existen y los externos usan HTTPS directo.
- [ ] Los gaps y NO-GO no se presentan como controles cerrados.
- [ ] Los features no elegibles figuran como `NOT_AVAILABLE`.
- [ ] El cambio no recomienda ni ejecuta transferencia, upgrade o mutación de
  settings fuera de autorización.
- [ ] `git diff --check` y la validación documental seleccionada están en
  `PASSED`.

## 13. Triggers de reclasificación

Revisar este perfil y los documentos inventariados ante:

- cambio de visibilidad del repositorio;
- transferencia de titularidad o cambio del tipo de owner;
- cambio de plan, producto o elegibilidad de GitHub;
- habilitación o deshabilitación de secret protection;
- incorporación de evidencia runtime, alertas, logs o datos identificables;
- nuevo endpoint, actor, boundary, proveedor o clase de secreto;
- incidente de exposición;
- cambio material de la documentación oficial citada;
- hallazgo de correlación que vuelva sensible contenido antes sanitizado.

La reclasificación debe seguir
[Documentation Lifecycle Policy](../governance/documentation-lifecycle-policy.md)
y actualizar [VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md) e índices
relacionados cuando cambie autoridad documental.

## 14. Relación con Sources of Truth

[VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md) sigue siendo el mapa primario
para determinar autoridad documental y registra este perfil `ACTIVE` como
fuente vigente de exposición pública de documentación de seguridad.

Las matrices y auditorías `docs/security/**` conservan su autoridad técnica
acotada sobre invariantes, boundaries y evidencia pendiente. Este perfil solo
gobierna su clasificación y tratamiento para exposición pública; no reescribe
sus hallazgos ni sustituye las fuentes rectoras de seguridad y enterprise.

## 15. Exclusiones

Quedan fuera de este perfil:

- mutaciones de GitHub settings;
- triaje de alertas y respuesta a incidentes reales;
- transferencia, cambio de owner, visibilidad, plan o producto;
- secret patterns del validador;
- branch protection y Actions permissions;
- backend, frontend, API, auth, cookies, sesiones, DB, schema, migraciones,
  tests, scripts, workflows, dependencias y runtime;
- cierre de `ERM-SEC-001`, evidencia cross-tenant, RLS runtime o staging.
