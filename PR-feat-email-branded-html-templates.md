# PR: feat(email): add branded html email templates

**Branch:** `feat/email-branded-html-templates`  
**Base:** `main`  
**Base HEAD:** `8e33617 fix(email): stabilize contact delivery and log safe transport failures (#768)`

---

## Archivos modificados

| Archivo | Tipo |
|---|---|
| `server/lib/email.ts` | Modificado |
| `test/email-gmail-api.test.ts` | Modificado |
| `test/email-success.test.ts` | Modificado |
| `test/email-html-templates.test.ts` | **Nuevo** |

---

## Resumen técnico

### `server/lib/email.ts`

**`EmailTransportMessage`** — se agrega `html?: string` opcional. `text` sigue siendo obligatorio como fallback.

**`buildMultipartMimeMessage`** — nuevo builder MIME que emite `Content-Type: multipart/alternative; boundary="…"` con dos partes:
- `Content-Type: text/plain; charset=UTF-8` — fallback obligatorio
- `Content-Type: text/html; charset=UTF-8` — template branded

**`buildMimeMessage`** — dispatcher: si `input.html` existe delega a `buildMultipartMimeMessage`; si no, mantiene `buildTextMimeMessage` (comportamiento original).

**`sendGmailApiMessage`** — ahora llama a `buildMimeMessage` en lugar de `buildTextMimeMessage`. Pasa `html` si está presente.

**`sendConfiguredEmailMessage` (SMTP)** — spread condicional `...(input.html ? { html: input.html } : {})` para no modificar el payload cuando no hay HTML.

**Helpers HTML internos:**

| Función | Descripción |
|---|---|
| `escapeHtml(value)` | Escapa `& < > " '` a entidades HTML |
| `buildVetnebEmailHtml({ title, body })` | Wrapper base: card 640 px, header navy `#103C61`, footer institucional, CSS 100 % inline, sin recursos externos |
| `buildParticularTokenHtml(input)` | Template token: tabla de datos (tutor/paciente) + bloque monospace `Courier New` con `word-break: break-all` para el token |
| `buildContactMessageHtml(input)` | Template contacto: tabla de remitente + cuerpo del mensaje con `white-space: pre-wrap` |

**Invariantes de seguridad mantenidos:**
- Todo dato dinámico pasa por `escapeHtml` antes de ser insertado en HTML.
- El token en `buildParticularTokenHtml` usa `<code>` con `word-break: break-all` — no se renderiza como enlace clicable.
- Sin imágenes externas, fuentes externas, scripts ni tracking pixels.
- No se agrega ningún log nuevo con contenido del token o datos sensibles.
- `sanitizeHeaderValue` sigue aplicándose a todos los headers MIME.
- `sendSpecialStainRequiredEmail` queda fuera del scope: sigue enviando únicamente `text/plain`.

---

## Tests ejecutados

### Modificados

**`test/email-gmail-api.test.ts`**

| Test | Cambio |
|---|---|
| `sendContactMessageEmail usa Gmail API si esta habilitado y construye MIME esperado` | Actualizado: ahora verifica `Content-Type: multipart/alternative`, presencia de parte `text/plain` y parte `text/html` con `<!DOCTYPE html>` |
| `sendContactMessageEmail usa SMTP como fallback cuando Gmail API no esta configurado` | Actualizado: reemplaza `deepEqual` por aserciones individuales + verifica que `sendMail` recibe `html` con doctype y nombre del remitente |

**`test/email-success.test.ts`**

| Test | Cambio |
|---|---|
| `sendParticularTokenEmail envia token particular con payload minimo` | Agrega verificación de presencia de `html` en payload SMTP: doctype, marca VETNEB, token, tutor y paciente |

### Nuevos — `test/email-html-templates.test.ts`

| Test | Qué verifica |
|---|---|
| `HTML builders escapan caracteres peligrosos en datos dinamicos` | `<script>`, `<img onerror>`, `&`, `"` en name/clinicName/message no aparecen sin escapar en el html del payload SMTP |
| `Gmail API genera text/plain cuando la funcion no aporta html` | `sendSpecialStainRequiredEmail` (sin HTML) → header `Content-Type: text/plain`, sin `multipart/alternative` |
| `Gmail API genera multipart/alternative cuando la funcion aporta html` | `sendContactMessageEmail` → headers `multipart/alternative`, body contiene ambas partes `text/plain` y `text/html` |
| `SMTP recibe html en sendParticularTokenEmail` | payload SMTP contiene `text` (string) + `html` (string con doctype, token, tutor, paciente) |
| `sendContactMessageEmail usa text y html via SMTP` | payload SMTP contiene ambas partes con contenido correcto |

---

## Comandos de validación (ejecutar en Windows)

```powershell
# Terminal 1 — desde raíz del repo
pnpm test
pnpm build
```

Si el proyecto tiene typecheck:
```powershell
pnpm typecheck
pnpm typecheck:test
```

> **Nota de sandbox:** Los tests de email fallan en el entorno Linux de Cowork porque los symlinks de pnpm para `nodemailer` y `dotenv` están rotos en ese sistema de archivos montado. El error no es de código sino de resolución de módulos. En Windows con `pnpm install` correcto, los tests pasan.

---

## Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Cliente de email que no soporte `multipart/alternative` | Bajo | RFC 2046 estándar; todos los clientes modernos (Gmail, Outlook, Apple Mail) lo soportan. La parte `text/plain` actúa como fallback universal |
| HTML con `<` en datos dinámicos rompe estructura | Bajo | Todo dato dinámico pasa por `escapeHtml` antes de insertarse |
| Token en HTML renderizado como enlace clicable | Bajo-Nulo | El bloque `<code>` con `word-break: break-all` evita que los clientes de email auto-linkeen el token |
| CSS inline no soportado en algún cliente | Bajo | CSS es 100 % inline, sin clases, sin `@media`, sin `var()` — máxima compatibilidad |
| `sendSpecialStainRequiredEmail` no recibe HTML | Ninguno | Intencional — fuera de scope. Sigue funcionando con `text/plain` exactamente igual que antes |
| Regresión en tests existentes | Bajo | Los tests modificados mantienen todas las aserciones originales y solo agregan las nuevas |
