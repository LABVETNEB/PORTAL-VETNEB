# PR-SEC-10 — E4: frontera de confianza de proxies (análisis R0)

Estado: **E4 BLOQUEADO** (E3 y E6 observados: PASSED). Las secciones 1 a 5 son una **investigación documental y de código, solo lectura (R0)** del 2026-11-13: no se modificó código, tests, workflows, dependencias, variables ni infraestructura. La sección 6 registra la consulta a Render enviada el 2026-11-14 y su escalación a soporte humano (respuesta humana pendiente).

Procedencia de la evidencia: la evidencia sanitizada E3/E6 (ventana 2, «Bloque 2: resultados») está en el documento `PR-SEC-10-STAGING-ISOLATION-DESIGN.md` (§11.5), que **no forma parte de `main`**: vive en la rama `diag/sec-10-proxy-observability` (commit `48fae32e`). El hook de diagnóstico que produjo esa evidencia es el commit `e6ef1079` de la misma rama; **no se fusionó a `main`** y ya fue retirado de staging. Todas las referencias a «§11.5» de este documento remiten a esa rama.

Reglas que siguen vigentes: no inventar CIDR; no confiar en encabezados que un cliente puede fijar; no usar `TRUST_PROXY=true` ni valores numéricos (Fastify 5.12.7 los rechaza y `env.ts` los invalida).

## 1. Auditoría del código real

| Pieza | Hecho (fuente) |
|---|---|
| Configuración | `ENV.trustProxy = rawEnv.TRUST_PROXY ?? false`; solo acepta lista de IP/CIDR separada por coma (`server/lib/env.ts`); sin variable, Fastify ignora `X-Forwarded-*` |
| Fastify | `Fastify({ trustProxy: ENV.trustProxy })` (`server/fastify-app.ts`); Fastify 5.12.7 con `@fastify/proxy-addr` 5.1.0: devuelve la **dirección no confiable más cercana** contando desde el peer hacia la izquierda; acepta IP/CIDR, palabras clave (`loopback`, etc.) y una **función** `(address, hop)`; el conteo numérico de saltos está deshabilitado |
| Consumidores de `request.ip` | Claves de rate limit de login (identificador + IP), contacto (solo IP), acceso público a informes, profesionales y tokens de informes; campo `ipAddress` de auditoría y de intentos fallidos |
| Frontend | En el navegador las llamadas son **del mismo origen** (`/api/*`) y las sirve el rewrite de Next hacia `NEXT_PUBLIC_API_URL`; solo el SSR llama al backend directamente (`frontend/src/lib/api.ts`, `frontend/next.config.ts`). Es decir: el tráfico de los usuarios reales pasa por el rewrite |

## 2. Matriz E4

| # | Tema | Observado en staging | Confirmación documental | Hipótesis (sin confirmar) | Pendiente del proveedor |
|---|---|---|---|---|---|
| 1 | Peer inmediato | IPv4 loopback en 26/26 eventos, ambas rutas | Render: su balanceador termina TLS y reenvía; el servicio no es alcanzable directamente (docs de web services) | El peer es un proxy local de Render | ¿Siempre loopback? ¿Hay rutas con peer distinto (red privada, health checks)? |
| 2 | Salto privado | Último salto del XFF; varía (3 valores en 13 eventos) | Rangos privados de Render: **no especificados**; las direcciones internas cambian entre despliegues | Capa interna de Render | Rango y estabilidad del salto privado |
| 3 | Borde público | Penúltimo salto; varía (6 valores en 13 eventos); `Server: cloudflare`, `CF-Connecting-IP`/`True-Client-IP` presentes | Cloudflare **agrega** al XFF y publica sus rangos; recomienda leer `CF-Connecting-IP`/`True-Client-IP`; `True-Client-IP` es solo Enterprise en una zona propia | Es el borde de Cloudflare **de Render** | ¿Los rangos publicados de Cloudflare cubren todos los saltos posibles? ¿Hay otros CDN/ASN? |
| 4 | IP de salida de Render | Aparece como 4.ª entrada en el rewrite (constante) | Son **de salida**, por región, **compartidas por todos los servicios de la región** y un servicio puede usar cualquier dirección del rango; la página no dice que identifiquen los proxies entrantes | **No sirven como frontera de confianza**: cualquier cliente de Render en la región saldría desde el mismo rango y podría fijar el XFF a su izquierda | Cómo distinguir al frontend propio de otros clientes |
| 5 | Red privada | No medida | Servicios web y privados reciben; **los web services Free pueden enviar pero no recibir**; mismo workspace y región; rangos no especificados; entre entornos el tráfico parece permitido (bloqueo solo en Pro o superior) | El backend de producción (Starter) podría recibir llamadas privadas del frontend (Free) | Dirección de origen y XFF que ve el receptor en tráfico privado; si hay balanceador en medio |
| 6 | Subdominios `onrender.com` | `vetneb-api-stg.onrender.com` y `vetneb-web-stg.onrender.com` pasan por el mismo borde | Se puede deshabilitar el subdominio (404) si hay al menos un dominio propio; **no se declara requisito de plan**; el backend de producción tiene dominio propio | Es una vía alternativa al dominio propio hacia el mismo servicio | Plan, efectos sobre health checks y propagación |
| 7 | Restricción de IP entrante | — | Reglas de IP entrantes en web services solo en **Scale o Enterprise**; producción usa Starter | No disponible hoy | Alternativas para el plan actual |
| 8 | XFF falsificado | Entradas del cliente **preservadas a la izquierda** (12/12) | Cloudflare agrega, no sobrescribe | La lógica «entrada más a la izquierda» es suplantable | — |
| 9 | Ruta del rewrite | 6 entradas: **+3** (salida de Next y segunda pasada por borde y salto privado); el cliente pasa de la posición 2 a la 5 desde la derecha | — | Sin tratamiento específico, `request.ip` queda en la salida de Next (bucket compartido por todos los usuarios) o, si se confía en el rango de salida, es suplantable por otros clientes de Render | Arquitectura del tramo frontend→backend |
| 10 | Cloudflare de Render frente al propio | Zona propia con `www` y `api` en **solo DNS** (inferido en §5): el tráfico no pasa por una zona Cloudflare de VETNEB | Render usa Cloudflare como proveedor de protección DDoS | VETNEB **no controla** el Cloudflare del borde: no puede configurar Authenticated Origin Pulls, Managed Transforms ni reglas de WAF sobre esos saltos | Qué garantiza Render sobre la autenticidad de `CF-Connecting-IP` y del XFF |
| 11 | Autenticidad de `CF-Connecting-IP` | Presente 26/26; **no se registró su valor** ni su relación con la posición del cliente en el XFF | La documentación de Cloudflare no afirma explícitamente que sobrescriba un valor enviado por el cliente | — | Confirmación de Render; posible medición en una ventana futura (valor frente a posición XFF y valor falsificado) |
| 12 | Cómo informa Render la IP del cliente | — | **No declarado** en las páginas de web services, reglas de IP entrantes ni dominios | — | Contrato soportado |

## 3. Conclusiones

1. Con la regla de Fastify (primera dirección no confiable desde la derecha) y una lista **completa**, las entradas falsificadas a la izquierda se ignoran. Una lista **incompleta** no abre suplantación, pero deja `request.ip` en un salto compartido.
2. **No se puede cerrar E4 con las observaciones actuales**: faltan el rango del salto privado, la garantía sobre los rangos de Cloudflare y el tratamiento del rewrite.
3. **Las IP de salida de Render no deben formar parte de `TRUST_PROXY`**: son compartidas entre clientes y no identifican proxies entrantes.
4. **Ninguna decisión debe apoyarse en una posición fija del XFF sin validar direcciones**: el backend sigue siendo alcanzable de forma directa (dominio propio y `onrender.com`), y ahí la cadena es más corta.
5. El rewrite necesita una de estas opciones (a decidir con el proveedor): (a) llamar al backend por la **red privada** (el frontend Free puede enviar; el backend Starter puede recibir) y confiar en ese origen aparte; (b) un **encabezado firmado** que el servidor Next agrega con la IP del cliente ya resuelta y que el backend valida con un secreto compartido (no depende de la red de Render); (c) no usar la IP resuelta para el tramo rewrite y limitar por otra clave. La (b) es independiente del proveedor y se puede construir antes.

## 4. Consulta técnica para soporte de Render (borrador original; **enviada**, ver §6)

> Subject: Supported trust boundary and client-IP authenticity for web services behind Render's edge (Fastify `trustProxy`)
>
> We run a Fastify API (Starter, Ohio, custom domain plus the default onrender.com subdomain) and a Next.js frontend (Free) whose server rewrites `/api/*` to the API's public URL. To rate-limit and audit by client IP we need to configure Fastify's trusted proxies (explicit IP/CIDR only; "trust all" and hop counts are not acceptable). In a staging environment (same plan family, Ohio) we observed, with synthetic header values only:
> - The immediate peer seen by the service is always a loopback address.
> - `X-Forwarded-For` arrives as a single header line: [client, a public hop, a private hop]; entries sent by the client are preserved on the left and the platform appends on the right. The public hop varies and `Server: cloudflare`, `CF-Connecting-IP` and `True-Client-IP` are present. `X-Real-IP` sent by the client does not arrive; `Forwarded` arrives unchanged.
> - When the frontend rewrite calls the API through its public URL, the chain gains three extra entries (the frontend's outbound address and a second pass through the public and private hops).
>
> Questions:
> 1. Is the immediate peer always loopback? Is there any path (private network, health checks, other tenants, either hostname) where the service sees a non-loopback peer?
> 2. Which part of `X-Forwarded-For` is guaranteed to be added by Render's edge (how many rightmost entries) and is that count stable? What address range does the private/internal hop use and is it stable across deploys and instances?
> 3. Which header is the supported source of the original client IP? Are `CF-Connecting-IP` and `True-Client-IP` always set or overwritten by the edge, including when the client sends them? Is the first `X-Forwarded-For` entry ever authoritative?
> 4. Do Cloudflare's published IP ranges cover every public hop that can reach a service, or does Render use other CDNs or address ranges?
> 5. Please confirm that outbound IP ranges are shared by all customers in a region and do not identify Render's inbound proxies. How can an API distinguish requests coming from our own frontend service from requests coming from other customers' services in the same region?
> 6. Private network: our Free frontend can send and our Starter API can receive. What source address and forwarded headers does the receiving service see for private-network requests? Is there a proxy in that path? Can anything outside our workspace reach the private hostname?
> 7. Disabling the default onrender.com subdomain: any plan requirements, effect on health checks, and expected propagation time? Does the custom domain path behave identically to the default subdomain at the edge?
> 8. Inbound IP rules require Scale or Enterprise: what alternatives exist on Starter to restrict or authenticate traffic arriving through the edge?
> 9. Do Free vs Starter or region (Ohio vs Oregon) change any of the behaviors above?
> 10. What architecture do you recommend for server-side calls from a Next.js frontend to an API on Render so that the client IP remains trustworthy?

Resumen en español: pide la frontera de confianza soportada (peer, saltos añadidos por Render y su estabilidad), la autenticidad de las cabeceras de IP, los rangos de Cloudflare y de la red interna, la diferencia entre IP de salida e identidad del frontend, el comportamiento de la red privada y de los subdominios `onrender.com`, las alternativas para el plan Starter y la arquitectura recomendada para el tramo frontend→backend.

## 5. Propuesta mínima de implementación

**Puede programarse ahora (R2, sin infraestructura ni datos del proveedor; todo con direcciones sintéticas de documentación):**

1. **Función de confianza estructural** (`trustProxy` como función de Fastify, validando la **dirección en cada salto**, nunca solo el conteo): módulo nuevo y configurable por variables, sin valores por defecto inventados; ante una cadena que no coincide con la topología esperada, **falla cerrado** (`request.ip` = primera dirección no confiable).
2. **Pruebas con las cadenas observadas** (directa de 3 entradas, rewrite de 6, XFF falsificado a la izquierda, acceso directo con cadena corta, cadena vacía, IPv6): comprobar que el cliente se resuelve, que lo falsificado se ignora y que buckets de clientes distintos difieren (ampliación de EV-01 y del test del hook).
3. **Guard de arquitectura**: prohibir `trustProxy: true`, conteos numéricos y cualquier lectura directa del XFF.
4. **Encabezado firmado del rewrite** (opción 5b): firma HMAC de la IP resuelta en el servidor Next y verificación en el backend con comparación en tiempo constante, desactivada por defecto.
5. **Exigir `TRUST_PROXY` en producción (fail-closed)**: se puede escribir y probar ya, pero **no activarlo ni desplegarlo** hasta fijar el valor, porque sin la variable el servicio no arrancaría.

**Depende de la confirmación del proveedor:**

1. El valor real de `TRUST_PROXY` en producción (rango del salto privado y cobertura de los rangos de Cloudflare).
2. La elección del tratamiento del rewrite (red privada, encabezado firmado u otra clave de límite).
3. Deshabilitar el subdominio `onrender.com` (R3; requiere plan y efectos confirmados).
4. Una ventana corta con el hook para validar la lista candidata en staging (el cliente debe resolverse por ambas rutas y lo falsificado debe ignorarse), incluyendo, si se desea, la relación entre `CF-Connecting-IP` y la posición del cliente en el XFF.
5. El cierre de PR-SEC-10: **no se cierra sin E4**.

## 6. Consulta enviada a Render y escalación (registro sanitizado, 2026-11-14)

**Qué se hizo.** Con autorización expresa de Nico se envió la consulta de §4 **una sola vez** mediante el **widget oficial de soporte del dashboard de Render** (chat con sesión autenticada). Como el chat no tiene campo de asunto, el asunto original se incorporó como primera línea del mensaje; las cinco preguntas y el resto del cuerpo no se alteraron. El mensaje aparece en el historial de la conversación. No se adjuntaron archivos, capturas ni logs, y no se incluyó ninguna credencial, cookie, IP real de cliente ni cabecera completa.

**Identificador.** Render **no muestra ningún número de ticket ni ID de hilo**; la conversación queda en la sección «Messages» del widget. No se exigió uno.

**Quién respondió.** Un **agente de IA de Render**, algo que el propio widget anuncia para un workspace Hobby. **No hubo respuesta humana todavía.**

**Respuesta del agente de IA, diferenciada**

| Afirmación del agente | Condición |
|---|---|
| Render está detrás de Cloudflare; la forma recomendada de obtener la IP del visitante es `CF-Connecting-IP` (y `True-Client-IP` como alternativa), porque `X-Forwarded-For` puede ser inexacto por las capas de proxy | Presentada con **citas a documentación de Render**; **no es una garantía de autenticidad**: recomendar una cabecera no prueba que Render la sobrescriba siempre (pregunta 3) |
| Los servicios de la misma región se comunican por una red privada que no pasa por Internet; cada servicio tiene hostname privado | Con respaldo documental (coincide con la documentación consultada en §2) |
| Los web services **Free pueden enviar** por la red privada pero **no recibir** | Con respaldo documental |
| Las IP internas son **dinámicas** y cambian entre despliegues; se recomienda usar hostnames | Con respaldo documental |
| Las IP de salida son **estables por región** y se ven en la pestaña «Outbound» del servicio | Con respaldo documental; **no identifican proxies de entrada** (ver fila 4 de §2) |
| Algunas cuentas antiguas de la región Oregon no tienen IP de salida estáticas | Con respaldo documental |
| La documentación **no publica** garantías sobre: el peer inmediato, cuántas entradas agrega Render al `X-Forwarded-For`, rangos CIDR estables de los proxies internos, si las cabeceras de Cloudflare se sobrescriben siempre, rutas que eviten el borde de Cloudflare, ni diferencias entre Free y Starter | Reconocimiento del propio agente: es la **ausencia de respaldo documental** que bloquea E4 |
| Ofreció describir «un patrón común» para limitar por IP con las cabeceras de Cloudflare | **No aceptado ni solicitado** (fuera del alcance autorizado); no verificado |

Ninguna de estas afirmaciones es una garantía contractual de Render ni una confirmación humana del equipo técnico.

**Escalación.** Como la respuesta automática no resolvía las garantías de E4, se solicitó **una única escalación** a soporte humano, sin cambiar el alcance (se pidió confirmar la estructura del peer y del XFF y los rangos internos estables, la autenticidad de `CF-Connecting-IP` y las rutas que eviten Cloudflare, y las diferencias entre Free y Starter o entre regiones). El agente **confirmó la derivación** a un miembro humano del equipo técnico de Render y avisó que la respuesta **no será inmediata**; la notificación llegará en el mismo chat y por correo. Nico debe revisar ambos canales.

**Las cinco preguntas originales y su estado**

| # | Pregunta | Estado |
|---|---|---|
| 1 | Forma oficialmente soportada de obtener la IP auténtica en Fastify, incluso con XFF falsificado | **Parcial**: el agente remite a las cabeceras de Cloudflare; falta la garantía de que sean auténticas |
| 2 | Garantías sobre peer inmediato, cadena XFF y proxies internos; rangos CIDR confiables o estables | **Sin responder** (la documentación no los publica) |
| 3 | Autenticidad de `CF-Connecting-IP` y rutas que eviten el borde de Cloudflare | **Sin responder** |
| 4 | Red privada Free → Starter: peer y cabeceras que ve el backend, y cómo autenticar o restringir el origen | **Parcial**: Free envía y no recibe, las IP internas son dinámicas; no se informó el peer ni las cabeceras observadas ni cómo restringir el origen |
| 5 | Diferencias de topología, cabeceras y proxies entre Free y Starter y entre Ohio y Oregón | **Sin responder** (solo la nota sobre cuentas antiguas de Oregon y las IP de salida) |

La petición de un mecanismo alternativo soportado para limitar por IP sin permitir suplantación, planteada para el caso de que no existan rangos confiables, **tampoco tiene respuesta** todavía.

**Estado de E4: BLOQUEADO.** La única evidencia verificable sigue siendo la medición propia en staging (peer loopback y estructura del XFF) más la documentación oficial; ninguna garantía de Render está confirmada por una persona. No se declaró ningún CIDR, no se confió en cabeceras que puede fijar el cliente y no se usó `TRUST_PROXY=true`.

**Alcance del contacto.** La interacción se limitó a ese envío, a la lectura de la respuesta automática y a la solicitud de escalación. **No se modificó ningún servicio, variable, configuración ni infraestructura, no se hicieron despliegues ni sondas, y no se abrieron otras conversaciones ni se cambió de canal.** No se aceptó ni aplicó ninguna recomendación operativa.

**Pendiente:** la **respuesta humana** de Render (sin plazo conocido). Al recibirla: actualizar la matriz de §2, resolver las preguntas 2 a 5 y recién entonces decidir el valor de `TRUST_PROXY` y el tratamiento del rewrite (§5).
