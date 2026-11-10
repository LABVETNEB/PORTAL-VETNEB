# Auditoría experimental de seguridad Google Drive (REA) y contraste con PORTAL-VETNEB

**Fecha de cierre declarada:** 2026-11-10\
**Estado del documento:** registro documental consolidado para versionado, basado en los informes de cierre proporcionados en la conversación.\
**Procedencia:** resultados relatados por Claude Code/REA y el usuario; **no es una exportación íntegra ni una copia certificada del artefacto original «SEGURIDAD DRIVE»**.\
**Naturaleza:** auditoría documental, sin implementación ni aprobación de PR.\
**Clasificación:** evidencia sanitizada; no contiene URLs privadas de documentos, IDs de Google, capturas sin filtrar, cookies, tokens ni credenciales.

> **Límite de evidencia:** Este informe preserva el cierre que fue comunicado. La evidencia primaria y el plan de PR completo permanecen en el artefacto original «SEGURIDAD DRIVE» de Claude. Los resultados runtime proceden del relato del agente ejecutor, no de una repetición independiente realizada para este documento. La auditoría de VETNEB fue estática salvo donde se indique lo contrario.

## 1. Propósito y alcance

- Investigar mediante REA el comportamiento de seguridad de Google Drive/Docs sobre **recursos exclusivamente sintéticos** de una cuenta personal de ensayo (identidad **A**).
- Evaluar acceso anónimo, enlaces compartidos, revocación, herencia, cabeceras HTTP, actividad, restricciones de descarga y ciclo de papelera.
- Comparar los mecanismos observables con controles de seguridad de `LABVETNEB/PORTAL-VETNEB`, sin asumir equivalencia funcional de arquitecturas.
- Preservar límites entre **lo observado**, **lo documentado**, **lo inferido** y **lo no verificado**.

**No alcance:** no se auditaron las infraestructuras internas de Google, cifrado/retención del backend, el acceso entre dos identidades autenticadas ni el despliegue productivo de VETNEB. No hubo cambios a PORTAL-VETNEB ni escrituras Git/GitHub durante la investigación relatada.

## 2. Entorno y recursos de prueba

| Componente | Estado final informado |
|---|---|
| Laboratorio | `C:\REA-LAB`, aislado de los perfiles ordinarios |
| REA | Versión 6.5.0 durante la ejecución |
| Chrome autenticado | Perfil experimental, CDP loopback puerto `19222` |
| Visitante anónimo | Chrome aislado temporal, sin cuenta ni cookies iniciales; cerrado al finalizar |
| Identidad autenticada | Únicamente A; no se incorporaron otras identidades |
| Carpeta principal | `SYN-LAB`, conservada |
| Subcarpeta | `P`, conservada dentro de `SYN-LAB` |
| Documentos principales | `SYN-F1` (`SYN-0001`), `SYN-F2` (`SYN-0002`), `SYN-F3` (`SYN-0003`), `SYN-F4` (`SYN-0004`) |
| Jerarquía | F1/F3/F4 dentro de SYN-LAB; F2 dentro de P |
| Documento desechable E10 | `SYN-DEL-E10`, eliminado definitivamente tras ensayos de restauración |

El usuario confirmó visualmente los textos exactos de los cuatro documentos. REA confirmó además la persistencia de ocho caracteres después de recargar. Los **44 elementos preexistentes** de la cuenta no se abrieron, alteraron ni utilizaron.

### 2.1. Hallazgo instrumental de creación y edición

El menú de Drive ofrecía **«Nueva carpeta»** dentro de `ul[aria-label="Menú de carpeta"]`, no «Carpeta nueva». La entrada de texto en Google Docs requirió enfocar primero el editor y escribir mediante el `[contenteditable]` interno del `iframe.docs-texteventtarget-iframe`; las pulsaciones enviadas al editor visible podían completarse sin error pero no escribir contenido. Esto impide considerar una interacción Playwright exitosa como prueba de persistencia.

## 3. Matriz final E1–E10

**Conteo comunicado:** 5 `PASSED`, 3 `PARTIAL`, 2 `BLOCKED`, 0 `FAILED`. Los `PASSED` están delimitados a la cuenta A y/o un visitante anónimo; no equivalen a certificación de los servicios internos de Google.

| ID | Estado | Evidencia experimental comunicada | Limitación principal |
|---|---|---|---|
| **E1** — Segundo usuario autorizado | **BLOCKED** | No se dispuso de una segunda identidad; no se enviaron invitaciones. | No verifica permisos entre dos usuarios autenticados. |
| **E2** — Tercero sin permiso | **PASSED** | Las cuatro URL directas, desde perfil anónimo, respondieron `302` hacia inicio de sesión; el visitante no recibió contenido. | No se comparó con URL inexistente ni se cubrieron terceros autenticados; la condición inicial «Restringido» era inferida en la primera pasada. |
| **E3** — Revocación de enlace | **PASSED** | Tras revertir permisos, una nueva solicitud exigió login y un `POST /leave` asociado a la sesión anterior respondió `401`. | Una pestaña ya abierta no se cerró automáticamente; no prueba invalidación de todas las representaciones ya cargadas. |
| **E4** — Restringido ↔ por enlace | **PASSED** | `SYN-F3` pasó temporalmente a «Cualquier persona con el enlace», rol Lector; anónimo lo visualizó en solo lectura y, tras revertir, volvió a recibir login. | El texto exacto visto por el anónimo no se extrajo; se corroboró longitud de ocho caracteres. |
| **E5** — Caducidad | **BLOCKED** | La interfaz de enlace no expuso vencimiento; la caducidad para permisos individuales requería otra identidad. | No se verificó expiración temporal de permisos individuales. |
| **E6** — Cabeceras HTTP | **PARTIAL** | Captura autenticada de SYN-F1: 603 eventos, 197 respuestas; nombres de cabeceras distinguidos por recurso. | REA no permitía filtrar valores por nombre antes de capturarlos; no se recopilaron valores por privacidad. La captura de eventos fue declarada incompleta. |
| **E7** — Actividad y trazabilidad | **PARTIAL** | La vista «Actividad» mostró la creación de seis recursos; edición visible solo en SYN-F1. | No mostró ediciones de F2–F4; no es una auditoría administrativa ni un log interno del servidor. |
| **E8** — Herencia de permisos | **PASSED** | La compartición temporal por enlace de la carpeta `P` habilitó acceso anónimo al documento `SYN-F2` sin cambiar sus permisos individuales; al revertir P, volvió el login. | Alcance limitado a anónimo y a una jerarquía sintética. |
| **E9** — Descarga, copia, impresión | **PARTIAL** | El servidor emitió la exportación de `SYN-F3`, pero REA canceló la descarga y no se guardó archivo. | No se inspeccionó la configuración de restricciones ni se probó persistencia de archivo exportado. |
| **E10** — Papelera y eliminación | **PASSED** | `SYN-DEL-E10`: creado, enviado a papelera, restaurado, enviado otra vez y eliminado definitivamente. Su URL indicó que el archivo se había eliminado. | No demuestra la retención física ni la purga de copias internas del proveedor. |

## 4. Evidencia HTTP y seguridad de navegación (E6)

Se observaron **nombres** de cabeceras, no valores. No extrapolar sus directivas efectivas:

| Superficie | Presencia observada | Pendiente |
|---|---|---|
| Documento principal de Docs | CSP efectiva, HSTS, Referrer-Policy, Cache-Control, Pragma, Expires y X-Content-Type-Options | Directivas CSP, `frame-ancestors`, `max-age`, directivas exactas de caché |
| Marco de compartición | CSP efectiva y Report-Only, COOP, HSTS y X-Frame-Options | Valores y aplicación efectiva por contexto |
| Recursos estáticos | CSP Report-Only y/o COOP/COOP Report-Only y CORP | Valores, alcance y diferencias entre respuestas |
| APIs autenticadas | X-Content-Type-Options, X-Frame-Options y Cache-Control; algunas también HSTS | Valores y política por endpoint |

El documento principal no mostró X-Frame-Options por nombre; eso **no demuestra** que pueda incrustarse, porque `frame-ancestors` podría estar definido en su CSP efectiva. Los encabezados de navegación no prueban autorización, cifrado ni retención del contenido almacenado.

En la ampliación documental se consultaron W3C CSP Level 3, RFC 9111 (caché), RFC 6797 (HSTS), W3C Referrer Policy, RFC 7034 (X-Frame-Options), WHATWG HTML (COOP) y documentación general de Google. Se diferenciaron explícitamente las descripciones normativas de los valores realmente enviados por Docs, que **continúan sin verificarse**.

## 5. Actividad visible y trazabilidad (E7)

El contenido de «Actividad» se presentó desde un iframe de Drive. El panel de SYN-LAB registró cinco entradas agregadas relacionadas con **seis creaciones y una edición**. El panel de P mostró dos creaciones. SYN-F1 indicó «Has editado un elemento» y «Has creado un elemento»; SYN-F2, F3 y F4 mostraron creación, sin edición. La atribución visible «Has...» identifica al usuario actual, no prueba trazabilidad multiusuario.

No se comprobó el historial completo de versiones, la retención de eventos ni la auditoría administrativa de Google Workspace (no disponible para la cuenta personal usada). No se releyó la actividad después de las pruebas de compartición.

## 6. Hallazgos y limitaciones transversales de Drive

1. **Decisiones observables por solicitud:** las peticiones anónimas posteriores a una revocación fueron redirigidas a login; la evidencia permite describir el comportamiento externo del servidor, no su implementación interna.
2. **Metadatos del propietario:** el visor anónimo de un documento compartido mostraba un nombre visible del propietario; no se registró su valor. No se calificó automáticamente como vulnerabilidad.
3. **Revocación de vistas existentes:** una pestaña con contenido ya representado no se cerró automáticamente tras revocar el enlace; ello no demuestra que nuevas peticiones sigan autorizadas.
4. **Documentos recién creados:** un documento inicialmente en blanco no apareció en la lista de la carpeta hasta renombrarlo; se observó como comportamiento instrumental, no como defecto confirmado de seguridad.
5. **REA/Chrome:** una pestaña de documento en blanco interrumpió la conexión de REA y fue cerrada; no se interrumpió el resto de la cuenta.
6. **Descargas:** no quedó ningún archivo descargado; E9 sigue parcial.
7. **Restricciones estructurales:** E1 y E5 requieren una segunda identidad autenticada. E6 requiere captura de valores HTTP con redacción previa segura; REA no ofrecía ese filtro.

## 7. Recuperación de estado y cierre de la investigación experimental

Según el cierre del agente ejecutor:

- `SYN-LAB`, `P` y `SYN-F1…SYN-F4` permanecían presentes, sin duplicados y con contenido original.
- `SYN-F3` y `P` regresaron a **Restringido**. La cuenta A verificó el estado de SYN-F3; el visitante anónimo recibió login al acceder a SYN-F1…F4 y P.
- No quedaron comparticiones temporales activas **dentro de los recursos probados** según esas comprobaciones.
- El Chrome anónimo temporal y su perfil fueron cerrados/eliminados; no se usó el CDP ordinario `9222`.
- `SYN-DEL-E10` fue eliminado definitivamente; los cuatro documentos principales no fueron enviados a papelera.
- Ninguno de los 44 elementos preexistentes fue abierto o modificado.
- No hubo mutaciones en PORTAL-VETNEB, Git ni GitHub durante los experimentos descritos.

**Nota:** la documentación del cierre no constituye una verificación remota independiente actual del estado de Drive.

## 8. Auditoría estática comparativa de PORTAL-VETNEB

Se incorporan **solo** los hallazgos relatados en la conversación. El análisis completo con referencias por función y el plan PR-1…PR-11 está en el artefacto original de Claude y no fue recuperable como fuente íntegra para este archivo.

### 8.1. Controles identificados como positivos en código

- Separación de cookies por frontera, `HttpOnly`, tokens aleatorios de 256 bits almacenados como hash y rotación de token en login.
- Argon2id para contraseñas nuevas y migración del hash heredado al autenticarse.
- Filtro de origen para métodos inseguros con cookies de sesión.
- `clinicId` derivado de la sesión y acceso a informes de otra clínica con respuesta 404, evitando confirmar su existencia.
- Permisos y roles aplicados en el backend; validación de `?next=` en el frontend.
- CI con SHA fijados y permisos limitados según la auditoría relatada.

**Precisión:** la validación de ruta, firma del contenido y origen de URL firmada era **opcional**, bajo `?viewer=1`, y estaba limitada al visor del administrador; no se debe atribuir a las emisiones por defecto ni a clínica, particular o público.

### 8.2. Hallazgos reportados y recomendaciones condicionadas

| ID / tema | Evidencia comunicada | Riesgo o tarea posterior |
|---|---|---|
| **V-01 — Revocación de sesiones al cambiar contraseña** | En clínica y administrador, el cambio no revoca otras sesiones; un test conserva ese comportamiento. | Riesgo de persistencia de una sesión sustraída; prioridad reforzada para administrador. |
| **V-02 — Cobertura de auditoría** | No todos los accesos autenticados, URLs firmadas y cierres de sesión están auditados. **La revocación administrativa sí emite `auth.session.revoked`.** | Instrumentar eventos faltantes sin registrar datos sensibles. |
| **V-03 — `TRUST_PROXY`** | Valor por defecto `false`, sin exigencia de configuración de producción en el código revisado; valor productivo desconocido. | Confirmar topología y evitar rate limiting basado en IP incorrecta. |
| **CSP** | `Content-Security-Policy-Report-Only` con `'unsafe-inline'` y `'unsafe-eval'`; no se observó nonce efectivo en el código revisado. | PR independiente para madurar CSP efectiva, tras analizar reportes y compatibilidad. |
| **Caché de acceso público a informes** | Ruta pública que emite URL firmadas sin `Cache-Control` explícito en el handler; exclusión de `/api/public/*` del no-store general. | Verificar cabeceras reales ante proxy; proponer `no-store` en respuestas sensibles. |
| **Revocación de URL firmadas** | Revocar token de aplicación bloquea emisiones nuevas, pero URLs ya expedidas conservan su vigencia hasta vencimiento (15 min por defecto, configuración real pendiente). | Separar revocación del permiso de aplicación y caducidad de URL ya emitida. |
| **V-12 — Tokens de particulares** | Sin expiración temporal ni `revokedAt` en el esquema inspeccionado; control `isActive`. | Riesgo de acceso prolongado a informes y datos asociados si se filtra un token. |
| **V-13 — Auditoría de particulares** | Login y emisión de URLs firmadas no auditados; modelo sin actor «particular». | Ampliar taxonomía de actores y eventos. |
| **V-14 — Orden de subida** | Carga en almacenamiento antes de insertar en DB. | Investigar limpieza/consistencia ante error parcial. |
| **V-15 / V-16 — RLS y bucket** | Ausencia reconocida de RLS nativa; bucket preexistente no verificado como privado por el inicializador analizado. | No ejecutar RLS; requiere criterios de entrada de `AGENTS.md` y evidencia de infraestructura. |
| **V-18 — JSON-LD** | Marcado sin escape en ocho páginas con datos estáticos. | Evaluar contexto de inyección y controles; no inferir explotación. |
| **Otros P2/informativos** | Cookies de producción `SameSite=None`; posibles variaciones temporales en login; mecanismos de limitación y auditoría fail-open; confianza en MIME declarado; endpoint `/` revela entorno y `/health` es público. | Confirmar mitigaciones, condiciones de exposición y tests funcionales. |

La clasificación final de severidad requiere impacto, probabilidad y controles compensatorios; la **confianza en la evidencia** es un eje separado. Ninguno de estos hallazgos está confirmado en ejecución productiva en el material disponible.

### 8.3. Cobertura y deuda de verificación declaradas

- Recuento informado: **616 tests backend**, de los que **441 (72 %)** inspeccionan texto fuente y **126** ejercitan rutas. La clasificación procede de la auditoría de Claude; no fue recalculada aquí.
- **134 especificaciones E2E**, mayoritariamente visuales, sin prueba E2E de aislamiento interclínica en el censo comunicado.
- Áreas incompletas: parte de rutas de logística y administración, seguimiento de estudios de clínica, handlers de `frontend/src/app/api`, emisión/entrega del token de particular y evidencia productiva de headers, proxy, bucket, CSP y expiración de URLs firmadas.
- Validaciones ejecutadas durante la auditoría estática según lo comunicado: **ninguna**. `pnpm audit`: **NOT_RUN**. No atribuir `PASSED` por equivalencia con CI.

### 8.4. Hoja de ruta reportada (sin autorización de implementación)

La auditoría original propuso **11 PR independientes** con dependencias. Se preserva únicamente el orden de los primeros cinco que fue comunicado, sin inventar el alcance literal de los demás:

1. Fijar `Cache-Control: no-store` para la ruta pública sensible de informes.
2. Revocar las demás sesiones al cambiar contraseña, con especial atención al administrador.
3. Auditar accesos autenticados, emisión de URLs firmadas y actores particulares.
4. Verificar/exigir configuración de `TRUST_PROXY` para el despliegue productivo cuando corresponda.
5. Incorporar caducidad y revocación temporal a los tokens de particulares.

Otros trabajos identificados: CSP efectiva (PR autónomo), endurecimiento de subida/almacenamiento, controles y pruebas runtime, mejoras de auditoría y análisis de RLS **bloqueado hasta cumplir los criterios de entrada establecidos en `AGENTS.md`**. La enumeración exacta PR-6 a PR-11 **no se hallaba en el material compartido** y debe copiarse desde el artefacto original antes de usarla como plan ejecutivo.

## 9. Baseline y procedencia de VETNEB

**Baseline de la inspección local comunicado por Claude:** rama `style/drive-workspace-frames`, HEAD abreviado `b550da76`, índice vacío, 35 archivos modificados, 6 sin seguimiento y 5 stashes. El árbol se preservó; estos datos no equivalen a baseline del entorno actual.

**Referencia remota consultada para preparar el documento:** `main@e4fe86ce253dda60d7b420955ae6a2b7201047fe` (GitHub, 2026-11-10). El repositorio tiene `main` protegido. No se realizó ninguna escritura remota al crear este Markdown.

## 10. Riesgos residuales, próximos pasos y estado de entrega

- Experimentos que requieren identidad adicional: **E1 y E5**.
- Cobertura pendiente: valores de E6 con filtrado seguro, historial completo de E7, configuración y recepción de E9, y pruebas runtime de las brechas VETNEB.
- No elevar conclusiones del cliente a garantías internas de Google ni reportar cumplimiento normativo no auditado.
- Mantener este documento como **registro histórico de evidencia**, no como fuente normativa rectora que reemplace los documentos de seguridad del repositorio.
- Las mejoras de VETNEB requieren aprobación, PR por scope y validaciones según `AGENTS.md`.

### Estado de validaciones para esta entrega documental

| Control | Estado | Explicación |
|---|---|---|
| Revisión de Markdown y ausencia de secretos | PASSED | Documento construido únicamente con evidencias sanitizadas de la conversación. |
| Enlace directo al artefacto completo de Claude | NOT_AVAILABLE | El artefacto no fue accesible como fuente íntegra en esta sesión; no se incorporó un enlace con identificador privado. |
| Tests/backend/frontend de VETNEB | NOT_RUN | No corresponde a documentación histórica; no se ejecutaron. |
| Git local del usuario | NOT_AVAILABLE | Este entorno no tiene acceso al árbol `C:\PORTAL-VETNEB` de Windows. |
| Commit/PR/merge en GitHub | NOT_RUN | No se ejecutaron escrituras remotas. |

**Conclusión:** auditoría experimental REA + Drive declarada cerrada con **5 PASSED / 3 PARTIAL / 2 BLOCKED / 0 FAILED**, dentro del alcance indicado. La auditoría comparativa de VETNEB identifica riesgos y una hoja de ruta, **sin implementación ni validación productiva**.
