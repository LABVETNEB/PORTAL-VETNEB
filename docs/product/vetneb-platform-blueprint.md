# VETNEB Platform Blueprint

> Versión: 1.0 — Junio 2026  
> Rama: `docs/product-platform-blueprint-v2`  
> Autor: Producto / Dirección técnica VETNEB  
> Estado: Documento estratégico activo — sin código implementado

---

## 1. Posicionamiento del producto

**VETNEB es el laboratorio de anatomía patológica veterinaria de referencia en Argentina: emite diagnósticos histopatológicos y citológicos para clínicas y profesionales veterinarios, y entrega los informes de forma segura y directa a través de un portal propio.**

Lo que VETNEB no es:
- No es una plataforma de telemedicina.
- No es un marketplace de veterinarios.
- No es un directorio de anuncios.
- No es una app de reservas.

El Banco de Profesionales es una red verificada de clínicas y profesionales que trabajan con VETNEB, no un directorio público de búsqueda de veterinarios.

---

## 2. Principios de diseño

### Confianza clínica
Cada decisión visual y de copy debe reforzar que VETNEB emite diagnósticos profesionales. El lenguaje es clínico-patológico, no comercial. Los íconos son instrumentales (microscopio, portaobjetos, bisturí), no decorativos. Los colores son los de un laboratorio médico: azules profundos, blancos y grises, sin degradados saturados ni paletas vibrantes.

### Claridad operativa
El flujo crítico (enviar muestra → recibir informe) debe poder explicarse en 3 pasos visibles en la home. Cualquier veterinario debe entender en 30 segundos cómo funciona el servicio sin necesidad de leer texto extenso.

### Seguridad visible
El acceso a informes usa token por caso. Ese token es el contrato de privacidad con el tutor del paciente. La UX debe transmitir esto: acceso privado, datos del animal, descarga controlada. No se muestran datos personales en la URL. No hay "ver todos mis informes" sin sesión de clínica.

### Simplicidad pública
El sitio público no requiere registro para entender qué es VETNEB. Los precios son públicos. Los servicios están explicados sin jerga innecesaria. El Banco de Profesionales es navegable sin login.

### Escalabilidad administrativa
El dashboard admin debe poder gestionar decenas de clínicas, cientos de informes y miles de tokens sin degradación de UX. La paginación, los filtros, los estados masivos y la auditoría son parte del producto, no features secundarias.

### Directorio profesional sobrio
El Banco de Profesionales es verificado. Cada clínica fue aceptada y trabaja con VETNEB. Las cards no tienen reviews, estrellas, ranking ni publicidad. Son fichas institucionales: datos de contacto, ubicación, especialidades, logo o avatar genérico verificado.

---

## 3. Referencias y uso correcto

| Referencia | Qué tomar | Qué evitar | Aplicación concreta en VETNEB |
|---|---|---|---|
| **IDEXX Laboratories** | Jerarquía de información (laboratorio primero, portal segundo). Tono de autoridad clínica sin ser frío. Estructura de servicios diagnósticos por tipo de estudio. Credibilidad institucional en hero. | Su escala global, su marketing de masas, sus micrositios por producto. No replicar la complejidad de navegación de una multinacional. | La home de VETNEB arranca con el laboratorio como protagonista, no con el portal. El hero habla de diagnóstico, no de tecnología. Las secciones de servicios usan el mismo patrón de IDEXX: tipo de estudio → qué informa → para qué sirve. |
| **Antech Diagnostics** | Estructura de flujo operativo (cómo enviar muestra, qué esperar, cuándo llega el informe). Sección "Para veterinarios" bien delimitada. Formularios de contacto directos sin fricción. | Su tono excesivamente corporativo. Sus PDF de formularios impresos. Su falta de mobile-first. | VETNEB tiene una sección "Cómo funciona" con 3 pasos concretos (envío → análisis → informe). La logística de retiro/envío se menciona en la home y en contacto, no solo oculta en servicios. |
| **RCVS (Royal College of Veterinary Surgeons)** | Estilo de directorio profesional verificado: no hay publicidad, no hay ranking, hay datos institucionales. Badge de verificación prominente pero sobrio. Estructura de ficha con datos clínicos. Seriedad sin frialdad. | Su burocracia visual. Su navegación anticuada. Su falta de responsive. No copiar su diseño literal. | El Banco de Profesionales usa una card limpia con datos institucionales, badge "Trabaja con VETNEB" o "Verificado", sin estrellas ni scores. El perfil detalle sigue la lógica de ficha clínica: quién es, dónde está, cómo contactar. |
| **Vetster** | UX comercial moderna: cards limpias, CTAs claros, jerarquía visual en mobile. Uso de color para guiar la atención. Microinteracciones suaves. Carga rápida y skeleton states. | Su modelo de negocio (telemedicina, reservas, reviews). Su paleta de color y su tono amigable en exceso para un laboratorio. No parecer una app de consulta online. | Las cards del Banco de Profesionales tienen el nivel de cuidado visual de Vetster: imagen o avatar, nombre, especialidad, badge, CTA. Nada más. Sin decoración superflua. El scroll reveal está implementado con la misma suavidad. |
| **Vetstoria** | CTA secundario efectivo ("¿Sos veterinario? Trabajá con nosotros"). Separación clara entre secciones para distintos públicos (clínica vs. particular). Estado vacío con mensaje orientativo. | Su modelo de bookings online. Su tono retail. Su foco en el dueño del animal como usuario principal. En VETNEB el usuario principal es el veterinario o la clínica. | VETNEB usa el patrón de Vetstoria para separar públicos en la navegación: "Para clínicas y profesionales" vs. "Para particulares / Acceso a informe". Los CTAs secundarios apuntan a contacto o a acceso con token. |

---

## 4. Arquitectura pública ideal

### Estructura de navegación

```
VETNEB
├── Inicio (/)
├── Servicios (/servicios)
│   ├── Histopatología (/histopatologia-veterinaria)
│   ├── Citología (/citologia-veterinaria)
│   ├── Informes veterinarios (/informes-veterinarios)
│   └── Laboratorio patológico (/laboratorio-patologico-veterinario)
├── Precios (/precios)
├── Banco de Profesionales (/profesionales)
│   └── Perfil clínica (/profesionales/[clinicId])
├── Particulares — Acceso a informe (/particulares)
├── Contacto (/contacto)
└── Login (/login)         ← solo staff y clínicas
```

### Jerarquía de peso en navegación

1. **Laboratorio** (servicios, histopatología, citología): peso máximo, siempre visible.
2. **Precios**: visible en navbar porque reduce la barrera de entrada de nuevas clínicas.
3. **Particulares**: acceso directo con token, visible pero subordinado al laboratorio.
4. **Banco de Profesionales**: visible, pero contextualizado como red del laboratorio, no como directorio principal.
5. **Contacto**: visible, sin fricción.
6. **Login**: último en navbar, discreto, para operadores internos y clínicas.

### Convención de rutas existente (respetar)

Las rutas actuales están en producción con SEO indexado. No renombrar sin PR específico de redirección.

```
/histopatologia-veterinaria   ✓ mantener
/citologia-veterinaria        ✓ mantener
/informes-veterinarios        ✓ mantener
/laboratorio-patologico-veterinario  ✓ mantener
/profesionales/[clinicId]     ✓ mantener
/particulares                 ✓ mantener
/precios                      ✓ mantener
```

---

## 5. Home ideal

### Sección 1 — Hero

**Objetivo:** Comunicar en 5 segundos qué es VETNEB y para quién es.

**Mensaje principal:**
> "Anatomía patológica veterinaria. Diagnóstico histopatológico y citológico para clínicas y profesionales."

**Subtítulo:**
> "Enviá la muestra. VETNEB la analiza. El informe llega directo al profesional y al portal seguro."

**Componentes necesarios:**
- Fondo oscuro (azul profundo `#0F2D3E` o equivalente) con imagen de laboratorio real o microscopio de alta calidad.
- Headline H1 en blanco, peso 700, tamaño grande.
- Subtítulo en gris claro, peso 400.
- CTA primario: "Conocé los servicios" → `/servicios`
- CTA secundario: "Accedé a tu informe" → `/particulares`
- Sin carrusel. Sin animaciones de fondo. Sin video autoplay.

**Inspiración principal:** IDEXX hero (autoridad, foco en el laboratorio, sin distracciones).

---

### Sección 2 — Confianza clínica

**Objetivo:** Anclar la percepción de VETNEB como laboratorio de anatomía patológica especializado, no como portal genérico.

**Mensaje principal:**
> "Diagnóstico microscópico riguroso para la medicina veterinaria"

**Componentes necesarios:**
- 3 o 4 datos institucionales en formato stat: años de experiencia, número de clínicas activas, tipos de estudios, cobertura geográfica.
- Iconografía instrumental: microscopio, portaobjetos, red de clínicas.
- Sin testimonios de clientes en esta sección (riesgo de parecer comercial).
- Fondo blanco o gris muy claro.

**Inspiración principal:** Antech (datos operativos como credencial de confianza).

---

### Sección 3 — Servicios diagnósticos

**Objetivo:** Explicar los tipos de estudio disponibles de forma clara y accionable.

**Mensaje principal:**
> "Qué analiza VETNEB"

**Componentes necesarios:**
- Cards por tipo de estudio: Histopatología, Citología, Tinciones especiales, Diagnóstico integral.
- Cada card: ícono instrumental, título, 2 líneas de descripción clínica, link a página de servicio.
- Grid de 2×2 en desktop, stack vertical en mobile.
- Sin precios en esta sección (los precios tienen su propia página).

**Inspiración principal:** IDEXX (cards de servicio por especialidad diagnóstica).

---

### Sección 4 — Acceso seguro a informes

**Objetivo:** Explicar el portal de informes sin revelar cómo funciona técnicamente. Transmitir privacidad y control.

**Mensaje principal:**
> "El informe del estudio de tu paciente, accesible de forma segura."

**Subtexto:**
> "Las clínicas reciben el informe directamente. Los tutores acceden con el código que envía el laboratorio."

**Componentes necesarios:**
- Panel visual diferenciado (fondo azul oscuro o slate): muestra el flujo en 2 columnas: clínica / particular.
- CTA para particulares: "Ingresá con tu código" → `/particulares`
- No mostrar campos de formulario ni capturas de UI interna.
- Badge de seguridad: "Acceso por token único por caso".

**Inspiración principal:** IDEXX portal de resultados (serio, discreto, funcional).

---

### Sección 5 — Cómo funciona

**Objetivo:** Eliminar la fricción de entrada para nuevas clínicas o profesionales.

**Mensaje principal:**
> "Trabajar con VETNEB es simple"

**Componentes necesarios:**
- 3 pasos en horizontal (desktop) o vertical (mobile):
  1. **Enviás la muestra** — con los datos del caso (especie, datos de la clínica, tipo de estudio).
  2. **VETNEB analiza** — anatomopatólogo examina el tejido o la muestra citológica.
  3. **Recibís el informe** — la clínica lo descarga desde el portal; el tutor lo accede con su token.
- Cada paso: número grande, ícono, texto corto, sin flechas ornamentales excesivas.
- CTA al final: "Contactanos para empezar" → `/contacto`

**Inspiración principal:** Antech (flujo operativo de 3 pasos, sin jerga técnica).

---

### Sección 6 — Banco de Profesionales verificados

**Objetivo:** Presentar el Banco de Profesionales como red de clínicas que ya trabajan con VETNEB, no como directorio de búsqueda.

**Mensaje principal:**
> "Clínicas y profesionales verificados que trabajan con VETNEB"

**Subtexto:**
> "Una red de referidos del laboratorio. Cada perfil fue revisado y confirmado."

**Componentes necesarios:**
- Preview de 3–4 cards de clínicas (las más completas o activas).
- Badge "Verificado" visible en cada card.
- CTA: "Ver todos los profesionales" → `/profesionales`
- CTA secundario (debajo): "¿Trabajás con VETNEB? Solicitá tu ficha" → `/contacto`
- Sin ranking, sin estrellas, sin reviews.

**Inspiración principal:** RCVS (fichas institucionales verificadas) + Vetster (cards modernas).

---

### Sección 7 — Precios y contacto

**Objetivo:** Reducir la fricción de cierre para clínicas que quieren empezar.

**Mensaje principal:**
> "Precios públicos, sin sorpresas"

**Componentes necesarios:**
- Link a `/precios` con mención del tipo de estudios y moneda.
- Sección de contacto breve: email, WhatsApp, formulario si aplica.
- Sin mostrar lista de precios en la home (tiene su propia página).

**Inspiración principal:** Vetstoria (CTA de contacto directo, sin pasos intermedios).

---

### Sección 8 — CTA final

**Objetivo:** Capturar a los visitantes que llegaron al fondo de la home sin convertir.

**Mensaje principal:**
> "Empezá a trabajar con VETNEB"

**Componentes necesarios:**
- Fondo de contraste (azul profundo).
- Headline corto.
- 2 CTAs: "Contactanos" y "Ver servicios".
- Sin formulario inline en esta sección.

**Inspiración principal:** IDEXX (cierre institucional, no comercial).

---

## 6. Servicios de laboratorio

### Cómo deben mostrarse los servicios

Cada página de servicio (`/histopatologia-veterinaria`, `/citologia-veterinaria`, etc.) sigue esta estructura:

**Header de página:**
- Ícono instrumental grande.
- H1: nombre clínico completo del estudio.
- Subtítulo: para qué sirve en términos clínicos (no marketineros).

**Sección descriptiva:**
- Qué analiza (tejido, células, tipo de muestra).
- Cuándo está indicado (diagnóstico diferencial, sospecha neoplásica, etc.).
- Qué incluye el informe (descripción microscópica, diagnóstico morfológico, observaciones).

**Sección operativa:**
- Cómo enviar la muestra (fijación, recipiente, datos del caso).
- Tiempos orientativos (aclarar que varían según complejidad).
- Link a precios: "Ver precios de este estudio" → `/precios`

**CTA de página:**
- "Consultanos sobre este estudio" → `/contacto`

**Lo que NO debe aparecer en páginas de servicio:**
- Precios inline (solo link a la página de precios).
- Comparativas con otros laboratorios.
- Testimonios de clientes.
- Banners promocionales.

### Logística y contacto
La logística (retiro de muestras, envíos, zonas) se menciona en la página de contacto y en el pie de las páginas de servicio, pero no tiene página propia hasta que la operación logística esté estabilizada.

---

## 7. Banco de Profesionales

### Tono
Institucional, verificado, sobrio. El Banco de Profesionales no es un escaparate comercial. Es la red de clínicas que confía en VETNEB para sus diagnósticos. El copy no debe decir "encontrá al mejor veterinario" sino "clínicas que trabajan con VETNEB".

### Diseño de cards (listado `/profesionales`)

Cada card muestra:
- **Avatar o logo**: logo de la clínica si tiene, avatar genérico institucional con iniciales si no. Sin fotos de personas físicas en la card del listado.
- **Nombre de la clínica**: tipografía media, peso 600.
- **Especialidad o tipo de práctica**: 1 línea, peso 400 (ej.: "Clínica veterinaria pequeños animales").
- **Ubicación**: ciudad o zona (no dirección completa).
- **Badge de verificación**: ícono `ShieldCheck` + texto "Trabaja con VETNEB". Color: azul o slate, no verde intenso.
- **CTA**: "Ver perfil" → `/profesionales/[clinicId]`

Lo que NO aparece en la card:
- Teléfono ni email (solo en detalle).
- Reviews ni puntuaciones.
- Precio de consulta.
- Disponibilidad horaria.
- Fotos de personas físicas.

### Perfil detalle (`/profesionales/[clinicId]`)

Secciones:
1. **Encabezado**: logo/avatar grande + nombre + badge verificado + ciudad.
2. **Sobre la clínica**: descripción breve (si la clínica la completó), especialidades.
3. **Contacto**: teléfono (con link a WhatsApp si aplica), email, dirección si fue autorizada.
4. **Relación con VETNEB**: "Esta clínica trabaja con VETNEB para estudios de anatomía patológica veterinaria." (texto fijo, no editable por la clínica).
5. **CTA**: "Contactar clínica" (WhatsApp o email directo).

Lo que NO aparece en detalle:
- Servicios con precios propios de la clínica.
- Reviews ni comentarios.
- Fotos de consultorios salvo logo oficial.
- Links a redes sociales (riesgo de tráfico de salida sin valor).

### Filtros en listado
- Búsqueda por nombre de clínica (implementado con `?q=`).
- Filtro por ciudad/zona (futuro PR, no implementar ahora).
- Sin filtro por especialidad hasta tener datos suficientes.

### Verificación

El badge "Trabaja con VETNEB" comunica que la clínica forma parte de la red activa del laboratorio. La visibilidad pública no debe depender de una promoción paga, ranking comercial ni preferencia manual.

La elegibilidad pública debe mantenerse alineada con la regla vigente del Banco de Profesionales: perfiles derivados de actividad real con VETNEB y reglas backend verificables. Si en el futuro existe un control administrativo de moderación o publicación, debe funcionar solo como capa de habilitación editorial, no como sustituto de la elegibilidad derivada.

Una clínica no debe aparecer por pago, preferencia manual o posicionamiento comercial. Debe aparecer porque cumple las reglas operativas definidas por VETNEB y porque su ficha pública es segura para mostrarse.

### Qué evitar
- No llamar a esta sección "Directorio de veterinarios" en ningún copy.
- No usar el término "reseñas", "opiniones" ni "calificaciones" en ningún lugar de esta sección.
- No mostrar precios de consulta veterinaria.
- No mostrar disponibilidad ni turnos.
- No hacer que parezca que VETNEB es el operador de la clínica.

---

## 8. Portal de particulares

### Acceso con token

El flujo actual es correcto conceptualmente. El tutor del animal recibe un código por WhatsApp o email, lo ingresa en `/particulares`, y accede al informe de su mascota.

**Estados UX que deben estar cubiertos:**

| Estado | Mensaje recomendado | Acción disponible |
|---|---|---|
| Sin token ingresado | "Ingresá el código que te enviamos para acceder al informe de tu mascota." | Campo de texto + botón |
| Token inválido | "El código ingresado no es válido. Verificá que lo copiaste correctamente." | Reintentar |
| Token expirado | "Este código ya no está vigente. Consultá con la clínica para recibir uno nuevo." | Sin reintentar, link a contacto |
| Rate limit excedido | "Demasiados intentos. Esperá unos minutos antes de intentar nuevamente." | Sin CTA agresivo |
| Cargando | Skeleton state, sin mensaje alarmante | — |
| Éxito — informe disponible | Datos del animal (especie, nombre si está), tipo de estudio, fecha | Descargar / previsualizar |
| Sin informes aún | "El informe de este caso todavía no está disponible. Volvé a intentarlo en unas horas." | Sin CTA de contacto directo (para no saturar al laboratorio) |
| Error de red | "No pudimos conectarnos. Intentá de nuevo en unos segundos." | Reintentar |

### Mensajes seguros

- No mostrar el nombre del profesional que firmó el informe en la vista del particular (dato interno).
- No mostrar el precio del estudio.
- No mostrar el ID interno del caso.
- Mostrar solo: nombre del animal (si aplica), especie, tipo de estudio, fecha, estado.

### Privacidad percibida

- La URL de `/particulares` no debe contener el token como query param en reposo.
- El campo de token es `type="password"` o `type="text"` con autocomplete desactivado.
- El botón de logout es visible y funcional durante toda la sesión particular.
- El mensaje de bienvenida menciona explícitamente que la sesión es privada: "Estás viendo los datos de tu mascota de forma segura."

### Claridad para tutores

El lenguaje en `/particulares` es el único lugar de VETNEB donde el tono puede ser levemente más cercano al tutor (dueño del animal). Sin excederse: sigue siendo un laboratorio, no una app de mascota.

Usar "tu mascota" o "el animal del caso", nunca "tu cliente" ni "el paciente" (lenguaje veterinario que confunde al tutor).

---

## 9. Dashboard / Admin

### Prioridades UX

El dashboard es una herramienta interna, no una vitrina. La prioridad es: eficiencia operativa, sin errores, con auditoría clara.

### Gestión de clínicas
- Listado paginado con filtros por nombre, estado, verificación.
- Acciones masivas: activar/desactivar, revocar verificación.
- Vista de detalle de clínica: datos, tokens activos, informes asociados.
- Sin rediseño visual mientras no haya estabilidad operativa.

### Informes
- Listado paginado: clínica, animal, tipo de estudio, estado, fecha.
- Filtros: por clínica, por estado (pendiente / emitido / entregado), por rango de fechas.
- Acciones: subir informe, asignar token, revocar acceso.
- Vista de detalle: historial de accesos al informe (quién descargó, cuándo).

### Tokens
- Listado de tokens activos: clínica, caso, estado, fecha de expiración.
- Crear token para caso nuevo.
- Revocar token individual.
- Ver intentos fallidos asociados a un token.

### Precios
- Listado editable de estudios con precio y estado (vigente / no vigente).
- Edición inline o modal, sin formulario de página separada.
- Log de cambios de precio (auditoría).

### Auditoría
- Log de acciones: quién, qué, cuándo, IP.
- Filtros por usuario, tipo de acción, rango de fechas.
- Sin edición en esta vista (solo lectura).

### Paginación
- Todas las tablas del admin usan paginación server-side.
- Default: 20 registros por página.
- Controles: anterior / siguiente + selector de página.
- Siempre mostrar total de registros.

### Estados masivos
- Confirmación explícita antes de acciones masivas irreversibles.
- Feedback visual claro (toast o banner) después de cada acción.
- Sin operaciones destructivas sin confirmación de 2 pasos.

---

## 10. Sistema visual

### Estilo general
- Paleta base: azul profundo (`#0F2D3E`), blanco puro, grises neutros (`slate-100` a `slate-700`).
- Acento: azul eléctrico controlado (`blue-600`) para CTAs primarios.
- Sin gradientes saturados, sin colores brillantes no relacionados con la paleta.
- Tipografía: sans-serif moderna (la actual del proyecto), sin serifa en body.
- Espaciado generoso: márgenes amplios, padding interno consistente.

### Cards
- Border sutil (`border border-slate-200`), sin sombra excesiva.
- Hover: sombra leve + transición suave (ya implementado con `PublicScrollReveal`).
- Padding interno: `p-5` o `p-6`. Sin padding asimétrico.
- Altura automática (no fixed height en grid de cards de servicio).

### Badges
- Verificación: azul (`bg-blue-50 text-blue-700 border-blue-200`) con ícono `ShieldCheck`.
- Estado informe disponible: verde suave (`bg-emerald-50 text-emerald-700`).
- Estado pendiente: amarillo suave (`bg-amber-50 text-amber-700`).
- Sin badges de color rojo salvo errores reales.

### Botones
- Primario: `bg-blue-600 text-white hover:bg-blue-700`. Sin bordes redondeados excesivos.
- Secundario: `border border-slate-300 text-slate-700 hover:bg-slate-50`.
- Destructivo: solo en dashboard admin, `bg-red-600`, siempre con confirmación.
- Sin botones de gradiente.
- Sin botones con íconos decorativos internos (ícono solo si aporta información).

### Formularios
- Labels siempre visibles, nunca solo placeholder.
- Validación inline al salir del campo, no solo al submit.
- Mensajes de error debajo del campo, en rojo suave, texto claro.
- Sin formularios de más de 5 campos sin agrupar.

### Tablas (dashboard)
- Header fijo con fondo claro.
- Filas alternadas o con separador sutil.
- Acciones al final de cada fila, no al principio.
- Columnas ordenables con ícono de dirección.

### Estados vacíos
- Ícono grande (slate, no de color), mensaje explicativo de 1 línea, CTA opcional.
- Ejemplo: "No hay informes para este caso todavía." + ícono de portapapeles.
- Sin ilustraciones complejas en estados vacíos del admin.

### Errores
- Error de red: banner horizontal en la parte superior del área afectada.
- Error de validación: mensaje debajo del campo.
- Error 404: página propia con CTA a la home.
- Error 500: página propia con mensaje institucional (sin stack trace).
- Nunca mostrar IDs internos ni rutas de servidor en mensajes de error públicos.

### Mobile
- Navegación: hamburger menu para rutas principales.
- Cards: stack vertical de 1 columna en mobile.
- Tablas admin: scroll horizontal con columnas prioritarias fijas.
- CTAs: ancho completo en mobile (`w-full`).
- Touch targets: mínimo 44px de alto.

### Tono de iconografía
- Lucide React (ya en uso): mantener como única librería de íconos.
- Íconos instrumentales: `Microscope`, `FlaskConical`, `ClipboardCheck`, `ShieldCheck`, `Network`, `FileText`, `KeyRound`.
- Evitar íconos decorativos genéricos: `Star`, `Heart`, `Sparkles`, `Zap`.
- Tamaño base: 20px en texto, 24px en cards, 32px en heroes de sección.

---

## 11. Copywriting

### Headline principal (home)
> "Anatomía patológica veterinaria de referencia"

### Subtítulo (home)
> "Diagnóstico histopatológico y citológico para clínicas y profesionales veterinarios. Informes con acceso seguro directo desde el portal."

### CTA primario
> "Conocé los servicios"

### CTA secundario
> "Accedé a tu informe"

### Texto de Banco de Profesionales (sección home)
> "Una red verificada de clínicas y profesionales que confían en VETNEB para sus diagnósticos anatomopatológicos."

### Texto intro en `/profesionales`
> "Clínicas y profesionales verificados que trabajan con VETNEB. Cada ficha fue revisada y confirmada por el laboratorio."

### Texto de perfil verificado (badge)
> "Trabaja con VETNEB"

*(alternativa más larga para el detalle)*
> "Esta clínica forma parte de la red verificada del laboratorio VETNEB. Su ficha fue revisada y habilitada para aparecer en este directorio."

### Mensaje para particulares (acceso a informe)
> "Ingresá el código que te envió la clínica o el laboratorio para acceder al informe de tu mascota de forma privada y segura."

### Mensaje de bienvenida en particulares (tras login exitoso)
> "Estás viendo los datos del caso de forma segura. Solo vos tenés acceso a este informe con tu código personal."

### Mensaje de precios
> "Lista de precios orientativos para estudios histopatológicos y citológicos. Los valores pueden variar según la complejidad del caso. Consultanos para casos especiales."

### Texto "Cómo funciona" — 3 pasos

**Paso 1 — Enviás la muestra**
> "Preparás la muestra según el protocolo de VETNEB y la enviás con los datos del caso y de la clínica."

**Paso 2 — VETNEB analiza**
> "El anatomopatólogo examina el tejido o la muestra citológica y elabora el informe diagnóstico."

**Paso 3 — Recibís el informe**
> "La clínica lo descarga directamente desde el portal. Si corresponde, el tutor del animal recibe acceso con un código privado."

---

## 12. Roadmap de PRs

Ordenados por valor inmediato, bajo riesgo y tamaño manejable. Cada PR debe ir a `main` actualizado, con tests básicos y sin modificar más de lo indicado.

---

### PR-A: Home — Sección "Cómo funciona" (3 pasos)

| Campo | Valor |
|---|---|
| **Título sugerido** | `feat(home): add how-it-works section with 3 steps` |
| **Herramienta recomendada** | Codex |
| **Objetivo** | Agregar sección de 3 pasos en la home entre "Servicios" y el Banco de Profesionales |
| **Archivos probables** | `frontend/src/app/page.tsx` |
| **Tests necesarios** | Snapshot o test de render que confirme que los 3 pasos se renderizan. Sin tests de integración. |
| **Valor generado** | Reduce fricción de entrada para nuevas clínicas. Elimina la pregunta "¿cómo funciona?" |
| **Riesgo** | Bajo. Solo agrega una sección nueva, no modifica las existentes. |

---

### PR-B: Home — Sección "Confianza clínica" con datos institucionales

| Campo | Valor |
|---|---|
| **Título sugerido** | `feat(home): add clinical trust stats section` |
| **Herramienta recomendada** | Codex |
| **Objetivo** | Agregar sección con 3–4 datos institucionales estáticos (años, clínicas, tipos de estudio) |
| **Archivos probables** | `frontend/src/app/page.tsx` |
| **Tests necesarios** | Test de render básico. |
| **Valor generado** | Refuerza autoridad clínica en la home. |
| **Riesgo** | Bajo. Datos estáticos, sin fetch. |

---

### PR-C: Home — CTA final (sección de cierre)

| Campo | Valor |
|---|---|
| **Título sugerido** | `feat(home): add final CTA section with dark background` |
| **Herramienta recomendada** | Codex |
| **Objetivo** | Agregar sección de cierre con fondo oscuro y 2 CTAs al fondo de la home |
| **Archivos probables** | `frontend/src/app/page.tsx` |
| **Tests necesarios** | Test de render + accesibilidad de botones (aria-label). |
| **Valor generado** | Captura visitantes que llegan al fondo sin haber convertido. |
| **Riesgo** | Bajo. |

---

### PR-D: Particulares — Mejora de estados UX (token inválido / expirado / rate limit)

| Campo | Valor |
|---|---|
| **Título sugerido** | `fix(particulares): improve UX states for invalid, expired and rate-limited tokens` |
| **Herramienta recomendada** | Claude (requiere revisión de lógica de estados y mensajes) |
| **Objetivo** | Asegurar que los 8 estados UX definidos en §8 tienen mensajes correctos y distintos |
| **Archivos probables** | `frontend/src/components/public/ParticularesContent.tsx` |
| **Tests necesarios** | Tests unitarios de cada estado de UI por prop simulada. |
| **Valor generado** | Reduce confusión del tutor del animal. Evita contacto innecesario al laboratorio por tokens expirados. |
| **Riesgo** | Medio. Tocar lógica de estados puede introducir regresiones. Revisar diff completo antes de merge. |

---

### PR-E: Banco de Profesionales — Texto introductorio correcto en `/profesionales`

| Campo | Valor |
|---|---|
| **Título sugerido** | `copy(profesionales): update intro text to reflect verified network framing` |
| **Herramienta recomendada** | Codex |
| **Objetivo** | Reemplazar cualquier copy genérico de "directorio de veterinarios" por el tono de "red verificada de VETNEB" |
| **Archivos probables** | `frontend/src/components/public/ProfesionalesSearchContent.tsx` |
| **Tests necesarios** | Test de render que confirme el texto correcto. |
| **Valor generado** | Alinea el Banco de Profesionales con el posicionamiento de laboratorio. |
| **Riesgo** | Bajo. Solo copy. |

---

### PR-F: Banco de Profesionales — Perfil detalle con sección "Relación con VETNEB"

| Campo | Valor |
|---|---|
| **Título sugerido** | `feat(profesionales): add vetneb-relationship section in professional detail` |
| **Herramienta recomendada** | Codex |
| **Objetivo** | Agregar en el perfil de cada clínica una sección fija con texto institucional sobre su relación con el laboratorio |
| **Archivos probables** | `frontend/src/components/public/ProfesionalDetailContent.tsx` |
| **Tests necesarios** | Test de render del texto institucional. |
| **Valor generado** | Contextualiza el perfil dentro del laboratorio, evita que parezca ficha de directorio externo. |
| **Riesgo** | Bajo. |

---

### PR-G: Precios — Mensaje de contexto sobre variabilidad

| Campo | Valor |
|---|---|
| **Título sugerido** | `copy(precios): add pricing context message about case complexity` |
| **Herramienta recomendada** | Codex |
| **Objetivo** | Agregar aviso visible en `/precios` aclarando que los valores son orientativos y pueden variar |
| **Archivos probables** | `frontend/src/components/public/PreciosContent.tsx` |
| **Tests necesarios** | Test de render del aviso. |
| **Valor generado** | Reduce expectativas incorrectas. Protege al laboratorio de compromisos implícitos de precio. |
| **Riesgo** | Bajo. |

---

### PR-H: SEO — Metadata y Open Graph para páginas de servicio

| Campo | Valor |
|---|---|
| **Título sugerido** | `feat(seo): improve metadata and og:image for service pages` |
| **Herramienta recomendada** | Claude (requiere razonamiento sobre keywords y estructura semántica) |
| **Objetivo** | Revisar y mejorar `createPageMetadata` en las 4 páginas de servicio y en `/profesionales` |
| **Archivos probables** | `frontend/src/app/histopatologia-veterinaria/page.tsx`, `citologia-veterinaria/page.tsx`, `informes-veterinarios/page.tsx`, `laboratorio-patologico-veterinario/page.tsx`, `profesionales/page.tsx` |
| **Tests necesarios** | Test de metadata (title, description) por página. |
| **Valor generado** | Mejora indexación SEO. Refuerza posicionamiento de keyword por tipo de estudio. |
| **Riesgo** | Bajo. Solo metadata. |

---

### PR-I: Dashboard — Empty states en tablas admin

| Campo | Valor |
|---|---|
| **Título sugerido** | `feat(dashboard): add empty states to admin tables` |
| **Herramienta recomendada** | Codex |
| **Objetivo** | Agregar estados vacíos consistentes en todas las tablas del admin (clínicas, informes, tokens, auditoría) |
| **Archivos probables** | Componentes en `frontend/src/components/dashboard/` |
| **Tests necesarios** | Test de render del estado vacío por tabla. |
| **Valor generado** | Elimina confusión de "tabla vacía sin mensaje" en operación real. |
| **Riesgo** | Bajo si se hace componente compartido `EmptyTableState`. |

---

### PR-J: Particulares — Accesibilidad del campo de token

| Campo | Valor |
|---|---|
| **Título sugerido** | `a11y(particulares): improve token input accessibility and autocomplete` |
| **Herramienta recomendada** | Claude (requiere revisión de ARIA y comportamiento de formulario) |
| **Objetivo** | Asegurar que el campo de token tiene `autocomplete="off"`, `aria-label` correcto, y comportamiento adecuado en mobile |
| **Archivos probables** | `frontend/src/components/public/ParticularesContent.tsx` |
| **Tests necesarios** | Test de atributos del input. |
| **Valor generado** | Mejora accesibilidad para tutores en mobile. |
| **Riesgo** | Bajo. |

---

## 13. Criterios de aceptación visual

La implementación de cada PR de UI es correcta cuando:

**Home**
- [ ] El hero comunica "laboratorio + diagnóstico" en menos de 5 segundos sin leer el subtítulo.
- [ ] Hay una sección de "Cómo funciona" con exactamente 3 pasos visibles sin scroll en desktop.
- [ ] El Banco de Profesionales en la home tiene el texto de "red verificada", no "directorio".
- [ ] Hay un CTA final al fondo de la home con fondo de contraste.
- [ ] No hay testimonios de clientes, estrellas ni reviews en ninguna sección de la home.

**Servicios**
- [ ] Cada página de servicio tiene H1 con el nombre clínico completo del estudio.
- [ ] Ninguna página de servicio muestra precios inline (solo link a `/precios`).
- [ ] El flujo de envío de muestra está explicado en cada página de servicio.

**Banco de Profesionales**
- [ ] Ninguna card del listado muestra teléfono, email, precio ni disponibilidad.
- [ ] El badge "Trabaja con VETNEB" o "Verificado" es visible en todas las cards.
- [ ] El perfil detalle tiene la sección "Relación con VETNEB" con texto fijo institucional.
- [ ] El listado no usa la palabra "directorio" en ningún copy visible.

**Portal de particulares**
- [ ] Los 8 estados UX del token tienen mensajes distintos y claros.
- [ ] El campo de token no tiene `autocomplete="on"`.
- [ ] El botón de logout es visible durante toda la sesión.
- [ ] No se muestra el ID interno del caso ni el nombre del anatomopatólogo al tutor.

**Dashboard**
- [ ] Todas las tablas tienen estado vacío con mensaje descriptivo.
- [ ] Todas las acciones masivas tienen confirmación de 2 pasos.
- [ ] Todas las tablas tienen paginación visible con total de registros.

**Sistema visual**
- [ ] Ningún componente público usa colores fuera de la paleta definida (azul, slate, blanco).
- [ ] Ningún badge usa `Star`, `Heart` ni `Sparkles` de Lucide.
- [ ] Los touch targets en mobile son de mínimo 44px.
- [ ] Los estados de error no muestran stack traces, rutas de servidor ni IDs internos.

**Mobile**
- [ ] La home es usable en viewport de 375px sin scroll horizontal.
- [ ] Las cards del Banco de Profesionales son de 1 columna en mobile.
- [ ] Los CTAs principales son de ancho completo en mobile.

---

## 14. Acciones que NO deben hacerse todavía

Las siguientes ideas son válidas en el largo plazo pero no deben implementarse hasta que la operación central del laboratorio esté completamente estabilizada y probada en producción.

**Marketplace completo**
No implementar sistema de listado comercial donde las clínicas paguen por visibilidad, destacados o posicionamiento en el Banco de Profesionales. Rompe el tono de red verificada y convierte el directorio en publicidad.

**Reservas online**
No agregar sistema de turnos, agendamiento ni disponibilidad horaria en los perfiles del Banco de Profesionales. VETNEB no opera las clínicas; añadir reservas crea obligaciones operativas y legales que el laboratorio no puede asumir.

**Reviews públicas**
No agregar sistema de puntuaciones, reseñas ni comentarios sobre clínicas o profesionales. La moderación de reviews es un producto en sí mismo. El riesgo reputacional para las clínicas del Banco y para VETNEB es alto.

**Ranking profesional**
No ordenar el Banco de Profesionales por "mejor valorado", "más activo" ni ningún criterio que implique jerarquía entre clínicas verificadas. Todas son iguales en el directorio.

**Telemedicina**
No agregar videoconsulta, chat en tiempo real con veterinarios ni ninguna funcionalidad de atención remota. Es un modelo de negocio distinto que requiere regulación, infraestructura y soporte propios.

**Pagos online**
No integrar pasarela de pago (Mercado Pago, Stripe u otra) hasta que el flujo operativo de muestras, informes y facturación esté completamente definido y auditado. Un pago online sin operación robusta detrás genera disputas y deuda de soporte.

**App nativa**
No publicar app en App Store ni Google Play. La PWA existente es suficiente para el estadio actual. Una app nativa requiere revisión de tiendas, mantenimiento de versiones y política de privacidad adicional.

**Integración con sistemas veterinarios externos**
No integrar con HIS (historia clínica veterinaria), sistemas de imagen o PMS de clínica hasta que la API interna de VETNEB esté documentada y versionada correctamente.

---

## 15. Conclusión

VETNEB se diferencia de cualquier otra plataforma del ecosistema veterinario argentino por una razón simple: **es un laboratorio primero, y todo lo demás después**.

La mayoría de las plataformas de veterinaria en el mercado son directorios, aplicaciones de reserva o herramientas de telemedicina que intentan añadir un módulo de diagnóstico. VETNEB hace el camino inverso: parte de la anatomía patológica veterinaria como servicio central, construye un portal operativo serio para gestionar informes con privacidad real, y añade el Banco de Profesionales como una red verificada del laboratorio, no como un producto autónomo.

Esta jerarquía debe mantenerse en cada PR, en cada decisión de copy, en cada sección que se agregue al sitio:

1. **El laboratorio** — diagnóstico histopatológico y citológico de confianza.
2. **El portal** — informes seguros, entregados con control y privacidad.
3. **La red** — clínicas y profesionales verificados que confían en VETNEB.

Cada vez que una decisión de producto, diseño o copy amenace esa jerarquía, hay que volver a este blueprint y preguntar: ¿esto hace que VETNEB parezca menos un laboratorio y más un marketplace, un directorio o una app de veterinaria? Si la respuesta es sí, no se implementa todavía.

El producto que VETNEB puede ganar a largo plazo no es el que tiene más features, sino el que tiene la confianza de los profesionales veterinarios que necesitan diagnósticos precisos, entregados a tiempo, sin fricciones operativas.

---

*Documento generado: 2026-06-04 — Rama: `docs/product-platform-blueprint-v2` — No modificar código en base a este documento sin PR específico aprobado.*

