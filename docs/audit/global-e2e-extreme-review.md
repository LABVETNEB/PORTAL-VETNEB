# Auditoria Global E2E Extrema - VETNEB

Fecha: 2026-06-04  
Rama auditada: `audit/global-e2e-extreme-review`  
Commit base observado: `2515c9e feat(professionals): add scalable public directory (#829)`  
Modo de trabajo: auditoria solamente. No se aplicaron fixes, refactors, migraciones, cambios de dependencias, cambios de configuracion, commits ni PRs.

## 1. Resumen ejecutivo

El portal muestra una base tecnica solida: Fastify centraliza headers, request id, trusted-origin, manejo seguro de errores y no-store para superficies sensibles; el frontend compila correctamente con Next 15; la suite local es amplia y cubre cookies, CORS, rate limits, storage privado, serializadores, permisos y contratos de seguridad. Las validaciones obligatorias pasaron.

El riesgo global observado es **medio-alto**, no por fallas criticas inmediatas, sino por acumulacion de riesgos operativos en pantallas administrativas, storage de informes, flujos publicos de contacto y escalabilidad del buscador publico de profesionales. No se identificaron secretos versionados ni exposicion publica directa de devtools/diagnosticos.

Principales oportunidades de valor:

1. Convertir listas administrativas pesadas en paginacion real y busqueda server-side.
2. Hacer atomico o compensado el flujo storage -> DB -> token para informes.
3. Definir politica explicita de reemplazo/versionado/retencion de informes.
4. Mover filtros de auditoria admin al backend con paginacion y totales.
5. Optimizar elegibilidad del banco publico profesional para alto volumen.
6. Agregar rate limit y anti-abuso al contacto publico.
7. Reemplazar navegacion publica basada en botones por links reales cuando corresponda.
8. Reducir PII en logs y URLs externas de comunicacion.
9. Agregar validacion por firma/magic bytes para uploads.
10. Ejecutar E2E autenticado real de dashboard, upload, Supabase y email en staging.

## 2. Alcance revisado

| Area | Archivos/superficies revisadas | Estado |
| --- | --- | --- |
| Frontend publico | `frontend/src/app`, `frontend/src/components/public`, SEO, sitemap, robots, controles de navegacion | Revisado |
| Dashboard/admin | `frontend/src/app/dashboard/admin`, modales y clientes API admin | Revisado |
| Backend/API | `server/fastify-app.ts`, `server/routes/*.fastify.ts`, `server/db*.ts`, middlewares | Revisado |
| Auth/sesiones | cookies clinic/admin/particular, middleware Next, rutas Fastify protegidas | Revisado |
| Storage/uploads | Supabase reports/avatars, signed URLs, upload admin report | Revisado |
| Comunicacion | contacto publico, email, WhatsApp/mailto particulares y profesionales | Revisado |
| Seguridad publica | `security:public-surface`, headers, CSP, secretos versionados, devtools | Revisado |
| Testing | `pnpm test`, pruebas backend, contratos, E2E Playwright existentes | Revisado |
| Build/tooling | scripts PNPM, root build, frontend build | Revisado |
| Produccion real | Staging/deploy, Supabase real, SMTP/Gmail real, browser E2E autenticado real | No ejecutado en esta auditoria local |

## 3. Validaciones ejecutadas

| Comando | Resultado | Observaciones |
| --- | --- | --- |
| `git status --short` | PASS | Arbol limpio antes de crear este informe. |
| `pnpm pkg get scripts` | PASS con warnings | Listo los scripts correctamente. NPM emitio warnings por claves PNPM en `.npmrc`/`.pnpmrc`. |
| `pnpm test` | PASS | 2256 tests: 2255 pass, 1 skipped, 0 failed. |
| `pnpm build` | PASS | Backend bundle generado en `dist/index.js` sin error. |
| `pnpm security:public-surface` | PASS | Sin hallazgos de exposicion publica de devtools. Reporto marcadores server-only en `frontend/src/middleware.ts` como warnings permitidos. |
| `pnpm -C frontend build` | PASS | Next 15.5.18 compilo y genero 26 rutas. `/dashboard/admin` quedo en 141 kB first load JS. |

No se ejecutaron comandos que requirieran instalacion de paquetes ni acceso de red.

## 4. Mapa tecnico del sistema

Frontend publico:
- Next App Router con paginas publicas de servicios, contacto, precios, profesionales, sitemap y robots.
- `PublicLayout`, controles publicos, search de profesionales y detalle profesional consumen APIs publicas.
- Middleware protege `/dashboard/:path*`: clinic redirige a login; admin sin cookie devuelve 404.

Dashboard/admin:
- Pagina admin central con tarjetas de auditoria, clinicas, pricing, tokens particulares, reportes, tracking, sesiones, schema health y usuarios/roles.
- Clientes en `frontend/src/lib/api.ts` hacen fetch a endpoints Fastify por dominio.
- Algunas pantallas ya consumen paginacion backend, pero todavia hay pantallas que fijan `offset: 0` o cargan todo en cliente.

Backend/API:
- `server/fastify-app.ts` registra rutas publicas, clinic, admin, particular y logistics.
- Middlewares globales aplican request id, security headers, trusted-origin, no-store sensible y error handler seguro.
- Drizzle/Postgres concentra acceso en `server/db*.ts`; Supabase gestiona objetos privados y signed URLs.

Comunicacion:
- Contacto publico valida payload y envia email.
- Tokens particulares y solicitudes de tincion especial usan email y enlaces externos WhatsApp/mailto.
- Profesional publico expone telefono/email/mapa cuando el perfil esta publicado y elegible.

Testing:
- La suite local es amplia y orientada a contratos de seguridad, auth boundaries, storage, serializacion, errores y rutas Fastify.
- Existen E2E Playwright en `frontend/e2e`, pero no forman parte del comando obligatorio `pnpm test` ejecutado en esta auditoria.

## 5. Hallazgos criticos

No se identificaron hallazgos **Critical** reproducibles con evidencia durante esta revision estatica y validaciones locales.

## 6. Hallazgos High

### H-01 - Admin clinicas queda limitado a las primeras 50

**Impacto:** alto. Si existen mas de 50 clinicas, las clinicas fuera de la primera pagina pueden quedar invisibles o imposibles de editar/eliminar desde la tarjeta admin.  
**Evidencia:** `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx:35` define `PAGE_SIZE = 50`; `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx:157` llama `getAdminClinics({ limit: PAGE_SIZE, offset: 0 })`.  
**Riesgo:** operacion diaria, soporte, alta/baja de clinicas, administracion parcial.  
**Recomendacion:** agregar estado de pagina/busqueda server-side, controles anterior/siguiente, total visible y tests de UI/contrato.

### H-02 - Log de auditoria admin filtra en cliente sobre un dataset parcial

**Impacto:** alto. Los filtros de auditoria pueden ocultar eventos antiguos o fuera de la pagina inicial, dando una falsa sensacion de ausencia de eventos.  
**Evidencia:** `frontend/src/app/dashboard/admin/page.tsx:334` carga `getAuditEntries(...)` sin parametros; `frontend/src/app/dashboard/admin/page.tsx:369` filtra `auditEntries` en memoria; `frontend/src/lib/api.ts:1305` no expone filtros/limit/offset para `getAuditEntries`.  
**Riesgo:** auditoria incompleta, investigacion de incidentes, cumplimiento.  
**Recomendacion:** usar filtros backend (`event`, `actorType`, `limit`, `offset`), mostrar total real, y mantener export CSV como fuente completa controlada.

### H-03 - Busqueda publica de profesionales puede degradar por elegibilidad correlacionada

**Impacto:** alto a medida que crezcan clinicas/reportes. La busqueda y el `count(*)` repiten una condicion de elegibilidad basada en subqueries sobre reportes e historial.  
**Evidencia:** `server/db-public-professionals.ts:20` arma `LAST_HISTOPATHOLOGY_REPORT_DELIVERED_AT_SQL`; `server/db-public-professionals.ts:41` lo usa para elegibilidad; `server/db-public-professionals.ts:565-568` lo agrega al `WHERE`; `server/db-public-professionals.ts:684-704` ejecuta select y count con el mismo `whereSql`.  
**Riesgo:** latencia publica, timeouts, costo de DB, busqueda inestable bajo carga.  
**Recomendacion:** materializar `last_histopathology_delivered_at`/eligibilidad en `clinic_public_search`, indexar parcial por publicacion/elegibilidad y refrescar por job/evento.

### H-04 - Upload de informes puede dejar objetos huerfanos si falla despues de Supabase

**Impacto:** alto. El flujo sube a storage antes de persistir/relinkear en DB; si falla el upsert, el vinculo de token o auditoria posterior, queda un objeto privado sin referencia funcional.  
**Evidencia:** `server/routes/admin-reports.fastify.ts:846` prepara upload con `file.mimetype`; `server/routes/admin-reports.fastify.ts:853` hace `deps.upsertReport(...)` despues del upload; `server/routes/admin-reports.fastify.ts:874` recien luego actualiza token particular; `server/lib/supabase.ts:106` genera path unico por upload.  
**Riesgo:** bloat de storage, retencion de datos clinicos sin trazabilidad operativa, costos y limpieza manual.  
**Recomendacion:** agregar compensacion `deleteStorageObject` en fallas posteriores, o persistir primero un registro pending y confirmar al final con cleanup transaccional.

### H-05 - "Reemplazar informe" no define versionado ni limpieza del informe anterior

**Impacto:** alto. La UI sugiere reemplazo, pero el backend crea un nuevo informe/path y relinkea el token; no se observa politica de version historica, soft delete, hard delete o retencion del informe reemplazado.  
**Evidencia:** `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:1439` muestra `Reemplazar informe`; `server/db.ts:527` implementa `upsertReport` por `storagePath`; `server/db-particular.ts:73` actualiza el `reportId` del token.  
**Riesgo:** duplicados, confusion operativa, exposicion prolongada de informes viejos, auditoria ambigua de cual informe esta vigente.  
**Recomendacion:** definir semantica: versionado explicito con historial, reemplazo con cleanup del anterior, o retencion legal documentada y visible.

### H-06 - Contacto publico no muestra rate limit/anti-abuso server-side

**Impacto:** alto-medio. `/api/contact` valida payload y trusted origin, pero no se observa limitador por IP/origin/email ni honeypot server-side. CORS no evita abuso desde clientes permitidos o scripts con origin valido.  
**Evidencia:** `server/routes/contact.fastify.ts:333` registra `app.post("/")`; `server/routes/contact.fastify.ts:354` envia email; no se observa `createMemoryRateLimit`/`rateLimit` en el archivo.  
**Riesgo:** spam al inbox, consumo de cuota SMTP/Gmail, ruido operativo y posible bloqueo del remitente.  
**Recomendacion:** aplicar fixed-window/sliding-window por IP y email, cooldown, honeypot no visible y metricas de bloqueo.

## 7. Hallazgos Medium

### M-01 - Directorio publico de profesionales no ofrece paginacion visible

**Impacto:** medio. El backend devuelve `total`, pero el frontend solicita siempre los primeros 20 resultados y no ofrece cargar mas.  
**Evidencia:** `frontend/src/lib/public-professionals.ts:4` fija `PUBLIC_PROFESSIONALS_PAGE_SIZE = 20`; `frontend/src/components/public/ProfesionalesSearchContent.tsx:66-70` usa `limit` y `offset: 0`; `frontend/src/components/public/ProfesionalesSearchContent.tsx:227` muestra el total.  
**Recomendacion:** agregar paginacion/load more, preservar query params y anunciar rango visible.

### M-02 - Controles publicos de navegacion usan botones para navegar

**Impacto:** medio. Links internos/externos renderizados como `<button>` pierden semantica nativa de enlaces: copiar link, abrir en nueva pestana, status bar, crawling, y expectativas de lectores de pantalla.  
**Evidencia:** `frontend/src/components/public/PublicRouteControl.tsx:61-65` navega con router; `frontend/src/components/public/PublicRouteControl.tsx:189-193` usa `window.location.assign`/`window.open`; el componente renderiza `button` para esos casos.  
**Recomendacion:** usar `next/link` o `<a>` para navegacion, reservando botones para acciones que no cambian de ubicacion.

### M-03 - Tokens particulares y upload modal hacen cargas N+1/all-client

**Impacto:** medio. El panel de tokens carga 10 tokens y luego un request por token para tracking; ademas carga clinicas/tokens completos por paginas de 100 para filtrar en cliente.  
**Evidencia:** `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:379` carga tokens; `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:389-394` hace `Promise.all` con `getAdminStudyTrackingCases`; `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx:456-457` itera clinicas; `frontend/src/components/dashboard/UploadReportModal.tsx:191-192` y `frontend/src/components/dashboard/UploadReportModal.tsx:280-281` hacen loops similares.  
**Recomendacion:** exponer endpoints agregados o incluir tracking resumen en listado; convertir selectors a busqueda remota con debounce y limit real.

### M-04 - Upload de informes valida MIME declarado, no firma de contenido

**Impacto:** medio. El flujo rechaza MIME no permitido, pero confiar solo en `file.mimetype` permite archivos renombrados o con contenido no esperado.  
**Evidencia:** `server/routes/admin-reports.fastify.ts:162-165` filtra por `file.mimetype`; `server/lib/supabase.ts:4` define MIME permitidos; `server/lib/supabase.ts:102` vuelve a validar MIME antes de subir.  
**Recomendacion:** validar magic bytes para PDF/imagenes, dimensiones cuando aplique, y considerar AV scanning asincronico.

### M-05 - WhatsApp de profesional prepende `549` incondicionalmente

**Impacto:** medio. Si el telefono ya incluye codigo de pais o pertenece a otro pais, el enlace puede quedar invalido.  
**Evidencia:** `frontend/src/components/public/ProfesionalDetailContent.tsx:43-44` arma `https://wa.me/549${phone.replace(/\D/g, "")}`.  
**Recomendacion:** normalizar telefonos al guardar, almacenar pais/codigo o detectar E.164 antes de construir el link.

### M-06 - WhatsApp/mailto de tincion especial embebe PII y datos clinicos en URL/body

**Impacto:** medio. El mensaje incluye token parcial, caso, reportId, clinica, tutor, paciente, especie, raza y fechas; al enviarse por `wa.me`/`mailto`, parte de esa informacion puede quedar en historial del navegador, cliente de correo o apps externas.  
**Evidencia:** `frontend/src/components/public/ParticularesContent.tsx:149` construye el mensaje; `frontend/src/components/public/ParticularesContent.tsx:169-185` agrega identificadores y datos del paciente/tutor; `frontend/src/components/public/ParticularesContent.tsx:220-229` lo encodea en WhatsApp/mailto.  
**Recomendacion:** reducir el mensaje a un identificador minimo, o generar un link interno seguro para que VETNEB resuelva el contexto.

### M-07 - Logs de email incluyen destinatarios en flujos particulares

**Impacto:** medio. Algunos logs operativos imprimen recipients completos, que son PII. El contacto publico ya usa `recipientCount`, pero tokens particulares/tincion especial no siguen el mismo criterio.  
**Evidencia:** `server/lib/email.ts:916-924` loguea `recipients` para particular token; `server/lib/email.ts:966-982` incluye recipients en payload de tincion especial.  
**Recomendacion:** loguear conteo, dominio o hash truncado; evitar emails completos en logs.

### M-08 - No se ejecuto E2E autenticado completo en esta validacion

**Impacto:** medio. `pnpm test` es amplio, pero no reemplaza un recorrido browser real con login, dashboard admin/clinic, upload, descarga signed URL y envio simulado.  
**Evidencia:** existen specs en `frontend/e2e` (`public-routes`, `visual-smoke`, `login-hydration`), pero la validacion obligatoria ejecutada fue `pnpm test` y builds.  
**Recomendacion:** agregar un script local/staging para Playwright autenticado con fixtures controladas y mocks de email/storage donde corresponda.

## 8. Hallazgos Low

### L-01 - Warnings de tooling por claves PNPM visibles via npm

**Impacto:** bajo. `pnpm pkg get scripts` funciona, pero emite warnings de `Unknown project config` por claves PNPM presentes en `.npmrc`/`.pnpmrc`.  
**Evidencia:** warnings durante `pnpm pkg get scripts`; archivos `.npmrc` y `.pnpmrc` contienen `shamefully-hoist`, `strict-peer-dependencies`, `auto-install-peers`, `prefer-workspace-packages`.  
**Recomendacion:** revisar si ambas configs son necesarias o mover claves al archivo esperado por la version de tooling.

### L-02 - Sitemap marca todos los URLs como modificados en cada generacion

**Impacto:** bajo. Todos los `lastModified` usan el mismo `new Date()`, lo que puede enviar senales ruidosas a crawlers.  
**Evidencia:** `frontend/src/app/sitemap.ts:5` define `const now = new Date()`.  
**Recomendacion:** usar fechas estables por pagina o remover `lastModified` si no hay fuente confiable.

### L-03 - CSP esta en modo Report-Only

**Impacto:** bajo-medio. Es una buena estrategia de despliegue gradual, pero no bloquea ejecuciones si aparece una regresion.  
**Evidencia:** `frontend/next.config.ts:70` configura `Content-Security-Policy-Report-Only`.  
**Recomendacion:** mantener report-only hasta tener telemetria limpia, luego migrar a CSP enforce por fases.

## 9. Frontend publico

UX:
- El layout publico y contenido principal estan bien segmentados por paginas.
- La busqueda de profesionales tiene buen modelo de estado, pero requiere paginacion visible cuando `total > professionals.length`.
- Los CTAs de rutas deberian ser links reales cuando navegan.

Rendimiento:
- Build frontend exitoso, 26 rutas generadas.
- El buscador publico depende de una consulta potencialmente cara; el cuello esta mas en DB que en bundle.

Accesibilidad:
- Hay uso correcto de estados y textos, pero los controles de navegacion como `button` degradan semantica.
- Conviene sumar checks automatizados con axe o Playwright accessibility smoke en rutas publicas clave.

SEO:
- Metadata/sitemap/robots existen.
- `lastModified` dinamico en sitemap puede generar ruido.
- Links renderizados como botones reducen senales nativas de navegacion.

Estado visual:
- `pnpm -C frontend build` no detecto errores de render build-time.
- No se hizo screenshot QA nuevo en esta auditoria.

Arquitectura de componentes:
- Hay una capa publica reutilizable clara (`PublicLayout`, controls, visual accents).
- La abstraccion `PublicRouteControl` mezcla accion y navegacion; conviene separar `PublicLink` de `ActionButton`.

Datos publicos:
- La publicacion profesional combina calidad de perfil, campos requeridos y elegibilidad por actividad.
- Falta paginacion consumible en UI y optimizacion de elegibilidad para crecimiento.

## 10. Dashboard/admin

Operabilidad:
- Riesgo principal: pantallas que muestran subconjuntos fijos o filtran localmente.
- Clinicas y auditoria necesitan paginacion/filtros backend para no dar informacion parcial.

Escala:
- Selectores de clinicas/tokens cargan paginas de 100 en loops; esto funciona al inicio, pero escala mal.
- N+1 de tracking en tokens particulares puede hacerse visible con latencia real.

Riesgo de acciones:
- "Reemplazar informe" debe explicitar si reemplaza, versiona o retiene.
- El dashboard deberia mostrar estado de upload y cleanup si hay fallas parciales.

## 11. Backend/API

Fortalezas:
- Registro central de rutas y middlewares globales.
- Separacion clara de cookies clinic/admin/particular.
- Trusted-origin aplicado a mutaciones sensibles.
- Error handler y tests reducen riesgo de stack traces/secret leaks.
- Public professionals/report access tienen rate limits; storage privado usa signed URLs.

Riesgos:
- Contacto publico necesita limitador propio.
- Upload de reportes requiere compensacion/atomicidad.
- Validacion de contenido de uploads debe ir mas alla de MIME declarado.
- Algunas consultas publicas pueden requerir materializacion o indices parciales adicionales.

## 12. Comunicacion

Contacto publico:
- Payload validado y envio encapsulado.
- Falta defensa anti-spam server-side.

Email:
- Buen patron de normalizacion y escapes HTML.
- Logs de algunos flujos deberian dejar de imprimir destinatarios completos.

WhatsApp/mailto:
- Links son utiles para operacion, pero no deben transportar mas PII/metadata clinica de la necesaria.
- Telefono profesional requiere normalizacion internacional antes de `wa.me`.

## 13. Seguridad

| Superficie | Estado observado | Riesgo residual |
| --- | --- | --- |
| Secretos versionados | `.env` no aparece versionado; `.env.example` si | Bajo |
| Public devtools/debug | `pnpm security:public-surface` PASS | Bajo |
| Cookies/sesiones | Separacion clinic/admin/particular cubierta por tests | Bajo-medio |
| CORS/trusted origin | Presente en rutas sensibles; contacto usa trusted origin | Medio por ausencia de rate limit |
| Storage privado | Signed URLs y bucket privado cubiertos por tests | Medio por cleanup/versionado |
| Uploads | Size/MIME cubiertos | Medio por falta de magic bytes/AV |
| Logs | Buen redaction general | Medio por recipients en email logs |
| CSP | Report-Only | Bajo-medio hasta enforce |

## 14. Performance y escalabilidad

Prioridad 1:
- Materializar elegibilidad profesional y evitar subqueries por fila en busqueda/count.
- Paginacion backend real para clinicas y auditoria admin.
- Reemplazar loops all-client por busqueda remota.

Prioridad 2:
- Endpoints agregados para tokens + tracking.
- Presupuestos de latencia y tests con fixtures grandes.
- Observabilidad de upload y cleanup fallido.

Prioridad 3:
- Revisar first-load JS de dashboard admin si crece con nuevas tarjetas.
- Cache-control especifico para public pages y datos publicos donde aplique.

## 15. Testing

Lo que ya esta fuerte:
- 2255 tests pasan localmente.
- Hay contratos de seguridad, storage, CORS, cookies, rate limits, serializacion y errores.
- Builds backend/frontend pasan.

Gaps recomendados:
- E2E Playwright autenticado para admin y clinic.
- Prueba browser de upload exitoso/fallido con storage mockeado.
- Prueba de auditoria admin con filtros server-side y eventos fuera de primera pagina.
- Tests de paginacion de admin clinics desde UI.
- Tests de anti-abuso en contacto publico.
- Tests de magic-byte upload.
- Pruebas de carga/EXPLAIN para public professionals con dataset grande.

## 16. Roadmap sugerido de PRs

1. **PR Admin pagination:** paginar `AdminClinicsManagementCard`, agregar busqueda server-side y tests.
2. **PR Audit log filters:** mover filtros/offset/limit de auditoria admin al backend y UI.
3. **PR Report upload consistency:** agregar cleanup compensatorio y estados de error auditables.
4. **PR Report replacement policy:** definir versionado/retencion/cleanup y reflejarlo en UI.
5. **PR Public professionals scale:** materializar elegibilidad, indices parciales y paginacion UI.
6. **PR Contact anti-abuse:** rate limit, honeypot y metricas.
7. **PR Navigation semantics:** convertir controles navegacionales publicos a links reales.
8. **PR PII minimization:** reducir recipients en logs y metadata clinica en WhatsApp/mailto.
9. **PR Upload content validation:** magic bytes y camino para AV scanning.
10. **PR E2E staging:** login, dashboard, upload, descarga signed URL, contacto y smoke mobile.

## 17. Acciones que NO deben hacerse todavia

- No agregar migraciones o indices sin `EXPLAIN`/dataset representativo para public professionals.
- No cambiar semantica de reemplazo de informes sin definir retencion legal/operativa.
- No pasar CSP a enforce sin revisar reportes y scripts/JSON-LD.
- No agregar dependencias de scanning/upload sin disenar fallback operativo.
- No redisenar dashboard completo: los riesgos son puntuales y pueden resolverse por PRs pequenos.

## 18. Conclusion senior

El sistema esta en buen estado para seguir endureciendo por capas. La suite y la arquitectura ya muestran intencion de seguridad seria; el siguiente salto no es "arreglar todo", sino cerrar los puntos donde la interfaz admin puede mentir por datos parciales, donde storage puede acumular objetos sin duenio claro, y donde los flujos publicos necesitan defensas de escala.

No se requieren cambios productivos inmediatos dentro de esta auditoria. La recomendacion es abrir PRs pequenos, medibles y con tests por cada hallazgo High antes de ampliar funcionalidad del dashboard o del directorio publico.
