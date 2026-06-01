# PR: fix/copy-particular-token-actions

## 1. Rama

```
fix/copy-particular-token-actions
```
Base: `main` @ `a4461ca` — chore(docs): archive pr handoff documents (#780)

---

## 2. Objetivo

Mejorar el flujo del email de token particular y del portal particular para que el usuario tenga acciones claras:

1. Copiar el token (manualmente desde el email).
2. Abrir el portal VETNEB.
3. Pegar el token en el portal.

---

## 3. Decisión sobre botón "Copiar token" en email

**Decisión: NO se agrega botón "Copiar token" en el email.**

Los clientes de email (Gmail, Outlook, iOS Mail, Android Mail) bloquean JavaScript y el acceso a `navigator.clipboard`. No existe forma segura y universal de ejecutar copia real desde un email HTML sin JS. Agregar un botón que aparente copiar sin ejecutar copia real sería una falsa promesa funcional.

**Solución adoptada:** Se mejora la instrucción de texto en el email con un flujo de 3 pasos numerado explícito: _1. Copiá el token. 2. Presioná Abrir Portal VETNEB. 3. Pegá el token en el portal._ El token continúa en un bloque `<code>` seleccionable con `user-select:text`.

La copia automática desde email queda descartada por limitación técnica. Documentado en este PR.

---

## 4. Textos cambiados

### Email (`server/lib/email.ts` — `buildParticularTokenHtml`)

| Antes | Después |
|---|---|
| `Copiá este token y pegalo en el portal.` | `1. Copiá el token de abajo.  2. Presioná **Abrir Portal VETNEB**.  3. Pegá el token en el portal.` |

El botón permanece: **Abrir Portal VETNEB** (sin cambio).  
El aviso de seguridad permanece: _"Por seguridad, el token no se copia automáticamente desde el email. Copialo manualmente y pegalo en el portal."_

### Portal particular (`frontend/src/components/public/ParticularesContent.tsx`)

| Elemento | Antes | Después |
|---|---|---|
| Texto visible del botón | `Pegar desde portapapeles` | `Pegar token` |
| `aria-label` | `Pegar token del portapapeles` | `Pegar token` |

---

## 5. Limitación técnica de clipboard en emails

Los clientes de email bloquean JavaScript inline, `onclick`, `navigator.clipboard`, y acceso al DOM del navegador. Por este motivo:

- No se agrega `<script>` al email.
- No se agrega `onclick` ni `javascript:` en ningún elemento del email.
- No se usa `navigator.clipboard` en el email.
- El token NO viaja en ningún `href`, query param, path, `mailto`, ni custom URL scheme.
- El token es visible y seleccionable en un bloque `<code>` con `user-select:text`.

---

## 6. Confirmaciones de seguridad

| Invariante | Estado |
|---|---|
| Sin `<script>` en email HTML | ✓ |
| Sin `onclick` en email HTML | ✓ |
| Sin `javascript:` en hrefs | ✓ |
| Sin `navigator.clipboard` en email HTML | ✓ |
| Token NO en href | ✓ |
| Token NO en query params (`?token=`) | ✓ |
| Token NO en path de URL | ✓ |
| Botón portal abre `/particulares` | ✓ |
| Portal conserva `navigator.clipboard?.readText?.()` real | ✓ |
| Clipboard se lee solo bajo gesto del usuario (`onClick`) | ✓ |
| Sin lectura de clipboard en `useEffect` | ✓ |
| Sin `console.log` con token | ✓ |
| Sin `searchParams` con token | ✓ |
| Sin `window.location` con token | ✓ |
| Sin `loginClinic`, `app_session_id`, `admin_session_id` en componente | ✓ |
| No se tocan cookies, sesiones, auth ni rutas sensibles | ✓ |

---

## 7. Confirmación: paridad móvil/web escritorio

El botón `Pegar token` es condicional a `clipboardSupported` (detectado vía `navigator.clipboard?.readText`). En entornos donde clipboard no está disponible (algunos navegadores móviles, contextos no seguros), el botón no se renderiza. El usuario puede igualmente pegar manualmente el token en el input. Sin cambio en lógica de paridad.

---

## 8. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/components/public/ParticularesContent.tsx` | `aria-label` y texto visible del botón Pegar |
| `server/lib/email.ts` | Instrucción HTML del email con flujo 3 pasos |
| `test/frontend-particulares-mobile-token-session.test.ts` | Actualización de assertion + 3 guardrails nuevos |
| `test/email-html-templates.test.ts` | 1 guardrail nuevo: sin `navigator.clipboard` en HTML |

---

## 9. Tests actualizados y reforzados

### `test/frontend-particulares-mobile-token-session.test.ts`

**Actualizado:**
- `source.includes("Pegar token")` — reemplaza la assertion que esperaba `"Pegar desde portapapeles"`

**Guardrails nuevos:**
- `guardrail: portal particular muestra Pegar token y no Pegar desde portapapeles` — verifica texto nuevo, ausencia del texto viejo y `aria-label="Pegar token"`
- `guardrail: portal conserva navigator.clipboard?.readText?.() con doble optional chaining` — verifica la forma segura con `?.readText?.()`
- `guardrail: clipboard no se lee en useEffect solo bajo gesto del usuario` — verifica que `readText` no aparece en ningún `useEffect`

### `test/email-html-templates.test.ts`

**Guardrail nuevo:**
- `guardrail: email html particular no contiene navigator.clipboard ni scripts de lado cliente` — verifica ausencia de `navigator.clipboard`, `<script`, `onclick`, `javascript:`, `?token=` en el HTML generado

---

## 10. Validaciones ejecutadas

Las siguientes validaciones deben ejecutarse en la máquina de Nico (requieren pnpm y dependencias instaladas):

```powershell
# Terminal 1 — desde C:\PORTAL-VETNEB
pnpm test
pnpm validate:local
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
```

Validaciones de contenido ejecutadas en sandbox (node): **todas ✓** (28/28 checks sobre los 4 archivos modificados).

---

## 11. Riesgos residuales

- **Copia manual en email:** El usuario debe copiar el token manualmente. El flujo numerado de 3 pasos reduce la fricción, pero no elimina el paso manual. Es la única solución técnicamente correcta dado el entorno email.
- **Clipboard API en Safari iOS:** `navigator.clipboard?.readText?.()` puede no estar disponible en algunos contextos de Safari. El botón `Pegar token` ya es condicional a `clipboardSupported` — sin cambio de comportamiento.
- **Invariantes #774–#780:** Ningún cambio toca auth, sesiones, cookies, rutas privadas, DB ni comportamiento de backend. Invariantes preservados.

---

## 12. Comandos manuales para Nico

```powershell
# Verificar estado
git status
git branch --show-current

# Asegurarse de estar en la rama correcta
git switch -c fix/copy-particular-token-actions
# (o si ya existe: git switch fix/copy-particular-token-actions)

# Revisar diff
git diff --stat

# Stagear y commitear
git add frontend/src/components/public/ParticularesContent.tsx
git add server/lib/email.ts
git add test/frontend-particulares-mobile-token-session.test.ts
git add test/email-html-templates.test.ts
git status
git commit -m "fix(copy): clarify particular token actions"

# Ejecutar validaciones
pnpm test
pnpm validate:local
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build

# Push y PR
git push -u origin fix/copy-particular-token-actions
gh pr create
gh pr checks --watch
gh pr merge --squash --delete-branch

# Limpieza local
git checkout main
git pull --ff-only
git fetch --prune
git status --short
git log -1 --oneline
gh pr list --state open
git branch -r --no-merged origin/main
git branch
```
