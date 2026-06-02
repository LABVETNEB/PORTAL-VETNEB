# PR: fix/particulares-special-stain-contact-links

## Resumen

Agrega dos enlaces de contacto (WhatsApp y email) en el portal de particulares, exclusivamente debajo de la alerta "Alerta: Solicitud de tinción especial." cuando `trackingCase.specialStainRequired === true`. Sin cambios de backend, base de datos, admin ni clínicas.

---

## Archivos tocados

| Archivo | Tipo de cambio |
|---|---|
| `frontend/src/components/public/ParticularesContent.tsx` | Modificado — implementación |
| `test/frontend-particulares-content.test.ts` | Modificado — 2 tests nuevos |

---

## Implementación realizada

### `ParticularesContent.tsx`

**Imports agregados:**
- `Mail`, `MessageCircle` desde `lucide-react`
- `PublicExternalControl` desde `@/components/public/PublicRouteControl` (importación nombrada junto a `PublicRouteControl` ya existente)

**Constantes agregadas (módulo-level, antes del componente):**
```ts
const SPECIAL_STAIN_WHATSAPP_HREF =
  "https://wa.me/5493534138946?text=Hola%20VETNEB%2C%20consulto%20por%20una%20solicitud%20de%20tinción%20especial%20de%20mi%20caso.";
const SPECIAL_STAIN_EMAIL_HREF =
  "mailto:lab.vetneb@gmail.com?subject=Consulta%20tinción%20especial&body=Hola%20VETNEB%2C%20consulto%20por%20una%20solicitud%20de%20tinción%20especial%20de%20mi%20caso.";
```

**JSX modificado — sección `trackingCase.specialStainRequired`:**

Antes:
```tsx
{trackingCase.specialStainRequired ? (
  <div className="clinical-alert-warning p-3 text-sm">
    Alerta: Solicitud de tinción especial.
  </div>
) : null}
```

Después:
```tsx
{trackingCase.specialStainRequired ? (
  <div className="space-y-3">
    <div className="clinical-alert-warning p-3 text-sm">
      Alerta: Solicitud de tinción especial.
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <PublicExternalControl
        href={SPECIAL_STAIN_WHATSAPP_HREF}
        target="_blank"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-vetneb-line/90 bg-card/95 px-4 py-2 text-sm font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised"
        aria-label="Consultar por WhatsApp sobre tinción especial"
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        Consultar por WhatsApp
      </PublicExternalControl>
      <PublicExternalControl
        href={SPECIAL_STAIN_EMAIL_HREF}
        target="_self"
        className="inline-flex items-center justify-center gap-2 rounded-md border border-vetneb-line/90 bg-card/95 px-4 py-2 text-sm font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised"
        aria-label="Enviar email a VETNEB sobre tinción especial"
      >
        <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
        Enviar email
      </PublicExternalControl>
    </div>
  </div>
) : null}
```

**Comportamiento:**
- WhatsApp: `target="_blank"` → `window.open(href, "_blank", "noopener,noreferrer")` — nueva pestaña segura.
- Email: `target="_self"` → `window.location.assign(href)` — abre cliente de correo vía `mailto:`.
- Mobile-first: `flex-col` en móvil, `sm:flex-row` en desktop ≥640px.
- Condicionado estrictamente a `trackingCase.specialStainRequired === true`.
- Solo en `ParticularesContent` — ni admin ni clínicas.

---

## Tests ejecutados

### `test/frontend-particulares-content.test.ts` — 7 tests (2 nuevos)

| # | Nombre | Estado |
|---|---|---|
| 1 | keeps refreshSession wired to particular auth me helper | ✅ PASS |
| 2 | surfaces refreshSession fetch failures instead of silent logout state | ✅ PASS |
| 3 | keeps neutral logout control and removes resumen label | ✅ PASS |
| 4 | muestra estado y alerta desde study-tracking en sesion activa | ✅ PASS |
| 5 | integra campana token-scoped en sesion activa | ✅ PASS |
| 6 | **muestra enlace WhatsApp y email solo bajo alerta de tincion especial** | ✅ PASS |
| 7 | **no expone PII en los hrefs de tincion especial** | ✅ PASS |

### Suite frontend completa — 751 tests

```
# tests 751
# pass  749
# fail    2  ← preexistentes, sin relación con este PR
```

Fallos preexistentes (no introducidos por este PR):
- `frontend-login-content.test.ts` → `ERR_INVALID_TYPESCRIPT_SYNTAX` en el propio archivo de test (sintaxis TS incompatible con `--experimental-strip-types` de Node 22).
- `frontend-profesionales-page-content.test.ts` → `Cannot find package 'react'` (importa React directamente; fallo de entorno, no de código).

### Security surface

```
PASS security/public-surface: no public devtools exposure findings.
```

Findings listados (`middleware.ts` — server-only) son preexistentes, no modificados por este PR.

---

## Comandos pendientes — ejecutar en Windows (Terminal 1)

```powershell
# Desde C:\PORTAL-VETNEB
pnpm typecheck
pnpm typecheck:test
pnpm test
pnpm build
pnpm security:public-surface
```

Nota: `typecheck` y `build` requieren los node_modules de Windows accesibles con pnpm. El sandbox Linux no puede ejecutarlos por limitación de mount.

---

## Invariantes de seguridad verificadas

- ✅ Sin PII en querystring de WhatsApp ni mailto.
- ✅ WhatsApp usa `noopener,noreferrer` vía `PublicExternalControl`.
- ✅ Sin `dangerouslySetInnerHTML`.
- ✅ Sin scripts inline.
- ✅ Sin cambios de backend, DB, auth, admin ni clínicas.
- ✅ Sin dependencias nuevas (`lucide-react` y `PublicExternalControl` ya eran del proyecto).
- ✅ `security:public-surface` → PASS.

---

## Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| URL de WhatsApp modificada en el futuro | Bajo | Constante nombrada `SPECIAL_STAIN_WHATSAPP_HREF` — un solo punto de cambio |
| Email de contacto cambia | Bajo | Constante nombrada `SPECIAL_STAIN_EMAIL_HREF` |
| `PublicExternalControl` cambia su contrato | Bajo | Componente interno del proyecto, no dependencia externa |
| PII accidental en URL | Nulo | Test #7 valida que no existan keywords de PII en los hrefs |

---

## Rollback

Revertir el commit de este PR restaura el comportamiento anterior exactamente. No hay cambios de DB ni migraciones.

```powershell
# Nico ejecuta manualmente si necesita revertir
git revert <commit-hash>
```

---

## Estado final

| Validación | Estado | Ejecutado en |
|---|---|---|
| `pnpm typecheck` (frontend) | ⏳ Pendiente Windows | — |
| `pnpm typecheck:test` | ⏳ Pendiente Windows | — |
| `pnpm test` (frontend-particulares-content) | ✅ 7/7 PASS | Linux sandbox |
| `pnpm test` (suite frontend) | ✅ 749/751 (2 fallos preexistentes) | Linux sandbox |
| `pnpm build` | ⏳ Pendiente Windows | — |
| `pnpm security:public-surface` | ✅ PASS | Linux sandbox |

**Archivos modificados: 2. Líneas añadidas: ~55. Sin cambios de backend.**
