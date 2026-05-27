# Legal and commercial readiness — Portal VETNEB

Documento obligatorio antes de declarar GO producción.
NO-GO si faltan aprobaciones legal/comercial o responsables.
Este archivo no reemplaza asesoramiento legal profesional.
No contiene secretos ni datos personales reales.

> [!IMPORTANT]
> La evidencia formal del release se centraliza en
> `docs/production-readiness-evidence.md`.
> Este documento cubre exclusivamente la dimensión legal/comercial
> y de gobernanza de aprobación.

---

## 1. Estado y decisión

| Campo | Valor |
|---|---|
| Decisión actual | **NO-GO** — pendiente de evidencia y aprobaciones LC-001 a LC-015 |
| Documento requerido | Obligatorio antes de GO producción |
| Reemplaza asesoramiento legal | No |
| Contiene datos personales o secretos reales | No |

Reglas absolutas:

- GO solo si LC-001 a LC-015 tienen evidencia documentada o exclusión aprobada.
- NO-GO automático si falta privacidad, términos, tratamiento de datos, contacto
  activo sin prueba E2E o aprobadores técnico/negocio.
- GO condicionado solo si no quedan ítems P0 y los pendientes no afectan claims,
  datos personales, contacto ni aprobadores.

---

## 2. Alcance

Este documento cubre las siguientes superficies de Portal VETNEB:

- Landing pública y páginas de servicios.
- Formulario de contacto (`/contacto`).
- Claims comerciales en cualquier página pública.
- Claims médicos o de laboratorio (diagnóstico, exactitud, tiempos, SLA).
- Textos legales: términos de uso, política de privacidad, condiciones de
  informes veterinarios.
- Tratamiento de datos personales (propietarios, pacientes/mascotas, clínicas).
- Informes veterinarios y acceso de particulares.
- Pricing público o promesas comerciales si aparecen en el lanzamiento.
- Soporte, canal de contacto y responsable de atención.
- Uso de logos, marca y material gráfico.
- Aceptación formal por responsable técnico y responsable de negocio.

Superficies no cubiertas por este documento:

- Validación técnica de runtime, DB, storage, CI/CD.
- Smoke staging/producción.
- Rollback y backup.
- CORS, cookies, seguridad de sesiones.

---

## 3. Datos que no deben incluirse en evidencia

Los siguientes datos no deben aparecer en PRs, issues, comentarios, chats,
capturas ni en este documento:

- Passwords o credenciales de cualquier tipo.
- Tokens de sesión, API keys o access tokens.
- Cookies de sesión reales.
- Datos reales de clientes (nombres, emails, teléfonos).
- Nombres reales de pacientes o mascotas.
- Informes veterinarios reales o extractos de ellos.
- Emails reales de destinatarios si no están autorizados explícitamente.
- Signed URLs completas.
- Capturas de pantalla con información sensible sin redactar.
- Credenciales o configuraciones de proveedores (Supabase, Render, Gmail).

---

## 4. Evidencia permitida

| Evidencia | Formato permitido | Formato prohibido | Responsable |
|---|---|---|---|
| Aprobación de términos de uso | Comentario formal con fecha y responsable; URL pública si aplica | Texto completo de términos con datos reales; aprobación verbal sin registro | Negocio / Legal |
| Aprobación de política de privacidad | Comentario formal con fecha y responsable; URL pública si aplica | Documento con datos de clientes reales | Negocio / Legal |
| Aprobación de contacto / email | Confirmación de recepción sanitizada (sin mostrar destinatario real); status 200 del endpoint | Email real, password SMTP/Gmail, token OAuth, signed URL | Negocio / Técnico |
| Revisión de claims landing pública | Captura redactada o resumen de texto revisado con fecha | Screenshots con datos personales sin redactar | Negocio |
| Revisión de claims médicos / laboratorio | Acta o comentario con fecha indicando aprobación o retiro del claim | Claims sin responsable o basados en promesas no documentadas | Negocio / Legal |
| Aprobación de pricing / promesas comerciales | Acta o comentario con fecha; "no aplica" si no hay pricing público | Precios provisionales sin aprobación; promesas ambiguas | Negocio |
| Tratamiento de datos personales | Documento interno con finalidad, responsable y canal de contacto; sin datos reales | Datos personales reales en evidencia | Legal / DPO |
| Aprobación de marca / logos | Comentario formal o acta con fecha | Material gráfico con datos personales | Negocio |
| Decisión de excluir una feature del release | Registro de exclusión con motivo y responsable | Exclusión verbal sin trazabilidad | Técnico / Negocio |
| Aprobación responsable técnico | Comentario o acta con nombre, fecha y commit evaluado | Aprobación implícita o verbal | Responsable técnico |
| Aprobación responsable negocio | Comentario o acta con nombre, fecha y alcance | Aprobación implícita o verbal | Responsable negocio |

---

## 5. Checklist legal/comercial P0

Todos los ítems deben quedar en estado **Abierto** o **Pendiente de evidencia**
hasta que exista evidencia formal. No cerrar ninguno sin evidencia sanitizada.

| ID | Criterio | Estado | Evidencia requerida | Responsable | Criterio de cierre |
|---|---|---|---|---|---|
| LC-001 | Términos de uso y política de privacidad disponibles públicamente o exclusión aprobada para lanzamiento inicial | Abierto | URL pública o acta de exclusión con motivo y responsable | Negocio / Legal | Texto publicado y accesible o exclusión formal registrada |
| LC-002 | Tratamiento de datos personales documentado: qué datos, finalidad, responsable y canal de contacto | Abierto | Documento interno sanitizado con los cuatro campos | Legal / DPO | Documento aprobado por responsable legal o equivalente |
| LC-003 | Formulario de contacto probado E2E en staging o excluido formalmente del release | Abierto | Log sanitizado de smoke E2E (status 200 + confirmación de recepción sin datos sensibles) o acta de exclusión | Técnico / Negocio | Smoke E2E verde o exclusión registrada con motivo |
| LC-004 | Destinatario de contacto (`CONTACT_TO`) aprobado por negocio | Abierto | Confirmación de que el destinatario es correcto; sin revelar el email real en evidencia | Negocio | Aprobación registrada con fecha |
| LC-005 | Claims comerciales en landing y páginas públicas revisados y aprobados | Abierto | Revisión documentada por negocio con fecha; claims no aprobados retirados | Negocio | Sin claims no aprobados en producción |
| LC-006 | Claims médicos o de laboratorio (diagnóstico, exactitud, SLA, tiempos) revisados y aprobados o retirados | Abierto | Revisión documentada por negocio/legal; claims no aprobados retirados antes del lanzamiento | Negocio / Legal | Sin claims médicos/laboratorio sin revisión en producción |
| LC-007 | Precios públicos y promesas comerciales revisados y aprobados, o documentados como "no aplica" si no hay pricing público | Abierto | Acta de revisión con fecha o declaración explícita de "sin pricing público en lanzamiento" | Negocio | Pricing aprobado o ausencia documentada |
| LC-008 | Uso de marca, logos y material gráfico aprobado | Abierto | Comentario formal o acta con fecha | Negocio | Aprobación registrada |
| LC-009 | Emails transaccionales y dirección no-reply revisados si aplican al lanzamiento | Abierto | Confirmación de que la dirección remitente es correcta y aprobada | Negocio / Técnico | Aprobación registrada o exclusión documentada |
| LC-010 | Soporte y responsable de atención al cliente definidos antes del lanzamiento | Abierto | Definición de canal de soporte (email, formulario, otro) con responsable identificado | Negocio | Canal y responsable documentados |
| LC-011 | Términos sobre informes veterinarios revisados: acceso particular, limitación de responsabilidad y uso permitido | Abierto | Revisión documentada por negocio/legal | Negocio / Legal | Términos aprobados o feature excluida del lanzamiento |
| LC-012 | Consentimiento y base legal para tratamiento de datos documentados si aplica | Abierto | Documento interno aprobado por responsable legal o equivalente | Legal / DPO | Consentimiento o base legal documentada |
| LC-013 | Capturas y evidencia aportadas al release sanitizadas (sin secretos, datos personales ni signed URLs) | Abierto | Verificación manual de toda evidencia antes de adjuntar | Técnico | Toda evidencia revisada y aprobada como sanitizada |
| LC-014 | Responsable técnico aprueba formalmente la salida a producción | Abierto | Comentario o acta con nombre, fecha y commit evaluado | Responsable técnico | Registro con fecha y commit |
| LC-015 | Responsable de negocio aprueba formalmente la salida a producción | Abierto | Comentario o acta con nombre, fecha y alcance del lanzamiento | Responsable negocio | Registro con fecha y alcance |

---

## 6. Formulario de contacto

El formulario de contacto (`/contacto`) requiere validación específica antes del
lanzamiento:

- Si el formulario de contacto está activo en el release, debe tener smoke
  E2E completado contra el entorno staging antes de declarar GO.
- Debe existir un destinatario aprobado configurado en `CONTACT_TO`. La
  dirección real no debe figurar en evidencia, PRs ni capturas.
- Si el email no está operativo (Gmail API ni SMTP configurados), el formulario
  de contacto queda fuera del release o el release queda en NO-GO para esa
  superficie.
- Evidencia permitida: status 200 del endpoint + confirmación de recepción sin
  mostrar datos personales del remitente ni la dirección real del destinatario.
- Consultar `docs/production-readiness-evidence.md` P0-012 para estado actual
  y `docs/release-readiness.md` sección 2 (bloqueos obligatorios para staging
  público de contacto) para criterios técnicos.

---

## 7. Claims comerciales y médicos

Reglas aplicables a cualquier texto público del portal:

- No prometer tiempos de entrega, diagnósticos, exactitud de resultados,
  integración con sistemas externos, SLA ni precios sin aprobación formal de
  negocio y/o legal.
- Los claims de laboratorio y veterinaria (p. ej. "diagnóstico preciso",
  "resultados en X horas", "100% fiable") requieren revisión explícita de
  negocio/legal antes del lanzamiento.
- Si un claim no está aprobado, debe retirarse del contenido público antes de
  declarar GO, o el release queda en NO-GO para la superficie afectada.
- La revisión de claims debe quedar registrada con fecha, responsable y
  referencia al texto revisado (sin adjuntar datos personales).

---

## 8. Tratamiento de datos personales

Requisitos antes del lanzamiento:

- Documentar qué categorías de datos personales procesa el portal (datos de
  clínicas, datos de propietarios, datos de pacientes/mascotas, datos de
  particulares).
- Documentar la finalidad de cada tratamiento.
- Documentar el responsable de tratamiento y el encargado si aplica.
- Documentar el canal de contacto para ejercer derechos (acceso, rectificación,
  supresión, oposición).
- No pegar datos reales de clientes, propietarios, pacientes ni mascotas en PRs,
  issues, chats, capturas ni en este documento.
- Los informes veterinarios y los datos de pacientes y mascotas deben tratarse
  operativamente como datos sensibles, con acceso restringido por rol y sin
  exposición en logs, capturas ni evidencia de release.

---

## 9. Pricing y promesas comerciales

- Si no hay pricing público en el lanzamiento inicial, documentar explícitamente
  "sin pricing público en este lanzamiento" como evidencia de LC-007.
- Si hay pricing, precios o promesas comerciales visibles en cualquier página
  pública, deben estar aprobados formalmente por negocio antes de GO.
- No usar claims comerciales ambiguos (p. ej. "el mejor", "garantizado",
  "sin coste") sin responsable identificado y aprobación registrada.
- Los datos de pricing gestionados desde el panel admin deben revisarse antes
  del lanzamiento si son visibles en el portal público.

---

## 10. Go/no-go legal/comercial

### GO

Se puede declarar GO legal/comercial si:

- LC-001 a LC-015 tienen evidencia documentada o exclusión aprobada.
- No hay claims médicos, comerciales ni de tiempo sin aprobación en ninguna
  página pública.
- El formulario de contacto tiene smoke E2E verde o está excluido formalmente.
- El tratamiento de datos personales está documentado y aprobado.
- Responsable técnico (LC-014) y responsable de negocio (LC-015) han aprobado.

### NO-GO

No declarar GO legal/comercial si ocurre cualquiera de estos casos:

- Falta política de privacidad o términos sin exclusión aprobada.
- Tratamiento de datos personales no documentado.
- Formulario de contacto activo en release sin smoke E2E completado.
- Destinatario de contacto no aprobado.
- Claims médicos o comerciales no revisados presentes en producción.
- Responsable técnico o responsable de negocio no han aprobado.

### GO condicionado

Solo aplica si no quedan P0 en `docs/production-readiness-evidence.md` y los
ítems pendientes de este documento no afectan claims, datos personales, contacto
ni aprobadores (LC-003, LC-005, LC-006, LC-014, LC-015 deben estar cerrados).

---

## 11. Registro de aprobación

Completar antes de declarar GO producción. No incluir secretos ni datos
personales reales. El commit evaluado debe coincidir con el commit candidato
registrado en `docs/production-readiness-evidence.md`.

| Fecha UTC | Entorno | Criterio | Decisión | Responsable técnico | Responsable negocio | Evidencia sanitizada | Observaciones |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
| | | | | | | | |
| | | | | | | | |
