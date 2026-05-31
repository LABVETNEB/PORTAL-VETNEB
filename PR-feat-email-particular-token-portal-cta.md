# PR: feat(email): add portal CTA to particular token email

**Rama:** `feat/email-particular-token-portal-cta`
**Base:** `main`
**HEAD:** `aa532a7 fix(auth): persist sessions across tab closes (#770)`

---

## Skills Claude utilizadas

1. **vetneb-protocolos-comunicacion** — validar contrato HTML email, restricciones de clientes de email, headers y URLs seguras.
2. **vetneb-security-production-invariants** — evitar token en URLs, sin JavaScript en email, token fuera de logs nuevos, no tocar Gmail API ni credenciales.
3. **vetneb-staff-senior-full-stack-engineer** — implementación mínima full-stack, diagnóstico previo, cambio trazable.
4. **vetneb-bugs-errores-optimizacion-rutas** — verificar ruta `/particulares` real, navegación desde email sin romper redirects.

---

## Diagnóstico técnico: por qué no se puede copiar automáticamente desde email

Los clientes de email (Gmail, Outlook, Apple Mail, etc.) ejecutan HTML en un sandbox que bloquea completamente JavaScript:

- `onclick`, `addEventListener`, `<script>` → ignorados o bloqueados.
- `navigator.clipboard.writeText()` → no disponible.
- `document.execCommand('copy')` → eliminado en contexto de webmail.
- `data:` URLs → bloqueados por política CSP de los clientes.

**Consecuencia directa:** cualquier botón "Copiar token" en un email es un UI falso. El usuario hace clic y no ocurre nada, generando confusión.

**Decisión:** botón CTA real que navega al portal (`<a href="...">`), bloque de token mejorado para selección manual, y texto honesto que explica por qué no se copia automáticamente.

---

## Archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `server/lib/email.ts` | Implementación |
| `test/email-html-templates.test.ts` | Tests |

---

## Cambios realizados

### `server/lib/email.ts`

**`resolveParticularPortalUrl(corsOrigins: string[]): string | null`** *(nuevo helper)*
- Busca el primer origen `https://` en `ENV.corsOrigins`.
- Devuelve `${origin}/particulares` si existe, o `null` si no hay origen https.
- No modifica variables de entorno ni ENV reales.
- Pure function, testeable en aislamiento.

**`buildParticularTokenText`** *(actualizado)*
- Acepta `portalUrl?: string | null`.
- Si hay URL: incluye línea `Abrí el portal VETNEB: <url>` antes de las instrucciones.
- Instrucción explícita: "Copiá este token y pegalo en el portal para acceder."
- Aviso: "Por seguridad, el token no se copia automáticamente. Copialo manualmente."

**`buildParticularTokenHtml`** *(actualizado)*
- Acepta `portalUrl?: string | null`.
- Instrucción "Copiá este token y pegalo en el portal." sobre el bloque monospace.
- Token con `word-break:break-all` + `-webkit-user-select:text;user-select:text` para facilitar selección manual.
- Botón CTA condicional (solo si `portalUrl` es https):
  ```html
  <a href="https://portal.vetneb.com/particulares" target="_blank" rel="noopener noreferrer"
     style="...">Abrir Portal VETNEB</a>
  ```
  Implementado con tabla de presentación compatible con todos los clientes de email.
- Aviso bajo el botón: "Por seguridad, el token no se copia automáticamente desde el email. Copialo manualmente y pegalo en el portal."
- Sin `<script>`, sin `onclick`, sin `javascript:`, sin `data:`.

**`sendParticularTokenEmail`** *(actualizado)*
- Resuelve `portalUrl = resolveParticularPortalUrl(ENV.corsOrigins)` antes de armar el mensaje.
- Pasa `portalUrl` a `buildParticularTokenText` y `buildParticularTokenHtml`.
- En producción con `CORS_ORIGIN=https://portal.vetneb.com`: botón y URL presentes.
- En desarrollo o sin `CORS_ORIGIN` https: token visible, sin botón, sin URL rota.

### Ruta del portal

`/particulares` confirmada en `frontend/src/app/particulares/page.tsx`.

No se modificó ningún archivo del frontend.

---

## Tests ejecutados

### Archivo: `test/email-html-templates.test.ts`

**Tests existentes (todos siguen verdes):**

| # | Nombre | Estado |
|---|---|---|
| 1 | HTML builders escapan caracteres peligrosos en datos dinamicos | ✅ |
| 2 | Gmail API genera text/plain cuando la funcion no aporta html | ✅ |
| 3 | Gmail API genera multipart/alternative cuando la funcion aporta html | ✅ |
| 4 | SMTP recibe html en sendParticularTokenEmail | ✅ |
| 5 | sendContactMessageEmail usa text y html via SMTP | ✅ |

**Tests nuevos (4 agregados):**

| # | Nombre | Estado |
|---|---|---|
| 6 | sendParticularTokenEmail HTML contiene boton CTA y no expone token en href | ✅ |
| 7 | sendParticularTokenEmail HTML sin corsOrigins https no incluye boton CTA | ✅ |
| 8 | sendParticularTokenEmail text/plain con portalUrl incluye URL del portal y token | ✅ |
| 9 | seguridad: token no aparece en ningun href del HTML particular | ✅ |

**Resultado:** 9/9 pass, 0 fail.

**Tests de dominio particular (sin cambios, todos verdes):**
- `test/particular-token.test.ts` — 12/12 pass
- `test/particular-token-edge.test.ts` — 9/9 pass
- `test/particular-auth.fastify.test.ts` — pass
- `test/frontend-particulares-access-contract.test.ts` — pass
- `test/frontend-particulares-content.test.ts` — pass

**TypeScript typecheck:**
```
npx tsc --project tsconfig.json --noEmit → sin errores
```

**Build frontend:** requiere `pnpm install` en entorno local con `node_modules`. La compilación TypeScript (`tsc --noEmit`) pasó sin errores. Nico ejecuta `pnpm build` en local antes de crear el PR.

---

## Cobertura de los criterios de aceptación

| Criterio | Estado |
|---|---|
| Botón "Abrir Portal VETNEB" con `<a href>` | ✅ |
| href apunta a `/particulares` (ruta real confirmada) | ✅ |
| Token NO en query string ni en path del href | ✅ |
| Token visible en bloque monospace con `word-break` | ✅ |
| Instrucción "Copiá este token y pegalo en el portal." | ✅ |
| Aviso copia manual (texto honesto) | ✅ |
| Fallback text/plain incluye URL del portal | ✅ |
| Fallback text/plain mantiene token visible | ✅ |
| Sin `<script>` en HTML | ✅ |
| Sin `onclick` en HTML | ✅ |
| Sin `javascript:` en HTML | ✅ |
| Sin token en ningún `href` | ✅ |
| Tests existentes siguen verdes | ✅ |
| Sin dependencias nuevas | ✅ |
| Sin modificación de env vars de producción | ✅ |

---

## Riesgos

**Bajo — helper `resolveParticularPortalUrl`:**
- En producción, si `CORS_ORIGIN` tiene múltiples orígenes, usa el primero con `https://`. Si el orden en `CORS_ORIGIN` cambia, el botón apuntaría a otro dominio https del mismo proyecto. Mitigación: en producción VETNEB solo hay un origen público; si hubiera más, el helper se puede extender con una variable dedicada `PORTAL_PUBLIC_URL`.

**Ninguno en seguridad:** el token no aparece en ninguna URL. Se verificó con regex sobre todos los `href` del HTML generado (test #9).

---

## Evidencia de invariantes no tocados

- **Gmail API / refresh token:** no modificados. `server/lib/email.ts` usa `ENV.gmailApi` sin cambios.
- **Dominio / producción:** `ENV` no fue modificado. `resolveParticularPortalUrl` solo lee `ENV.corsOrigins`.
- **Auth particular / sesiones:** ningún archivo de auth tocado.
- **Frontend `/particulares`:** solo leído para confirmar la ruta. Sin modificaciones.
- **Variables `.env` reales:** no leídas, no impresas, no versionadas.
- **Migraciones DB:** ninguna.
- **Dependencias nuevas:** ninguna.

---

## Comandos para Nico (ejecución manual)

**Terminal 1 — validar antes del PR:**
```powershell
cd C:\PORTAL-VETNEB
pnpm test
pnpm build
git status
```

**Terminal 1 — crear PR:**
```powershell
git add server/lib/email.ts test/email-html-templates.test.ts
git status
git commit -m "feat(email): add portal CTA to particular token email"
git push -u origin feat/email-particular-token-portal-cta
gh pr create --title "feat(email): add portal CTA to particular token email" --body "Agrega botón CTA 'Abrir Portal VETNEB' al email de token particular. Resuelve URL desde CORS_ORIGIN https. Sin token en href. Aviso honesto de copia manual. 4 tests nuevos."
gh pr checks --watch
```
