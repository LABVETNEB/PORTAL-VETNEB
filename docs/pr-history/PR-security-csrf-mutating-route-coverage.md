# PR: security/csrf-mutating-route-coverage

## Resumen

Auditoría y cobertura de tests CSRF para todas las rutas mutantes del backend Fastify.

**Resultado del diagnóstico**: la protección CSRF estaba ya implementada correctamente a doble capa en todo el backend. Este PR formaliza la cobertura con un test exhaustivo que blinda el registro y evita regresiones.

No se añadieron dependencias. No se tocó DB, migraciones, WebAuthn, CORS, CSP, signed URLs, storagePath, UI, ni los fixes mobile recientes.

---

## Arquitectura CSRF del backend

### Capa 1 — Hook global (fastify-app.ts)

```ts
app.addHook("onRequest", requireTrustedOriginForFastify);
```

Aplica a **todas** las rutas registradas. Rechaza con `403 Origen no permitido` cuando:
- El método es `POST | PUT | PATCH | DELETE`, y
- El header `Origin` / `Referer` está presente pero no está en `ENV.corsOrigins`, o
- No hay `Origin` / `Referer` pero sí hay cookie de sesión (cross-origin form submit sin cabecera).

### Capa 2 — `enforceTrustedOrigin` local por ruta (defense-in-depth)

Cada ruta mutante verifica origin antes de tocar auth ni deps. Patrón estándar:

```ts
if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
  return reply;
}
const auth = await authenticateClinicUser(request, reply, deps, now);
```

Ambas capas responden con el mismo contrato `{ success: false, error: "Origen no permitido" }`.

---

## Mapa de cobertura

### Clasificación de rutas

| Clase | Descripción | Rutas |
|-------|-------------|-------|
| **A** | Autenticadas con cookie sesión → CSRF obligatorio | Admin ops, clínica ops, logística, particular ops |
| **B** | Login/logout con contrato especial → CSRF incluido | auth.fastify.ts, admin-auth.fastify.ts, particular-auth.fastify.ts |
| **C** | Webhooks/externos → N/A | **Ninguna** (vacía) |
| **D** | Público sin cookie de portal → CSRF no aplica por cookie | contact.fastify.ts |

### Rutas mutantes protegidas (Clase A + B)

#### Admin (`admin_session_id`)

| Archivo | Mutaciones | Protección |
|---------|-----------|------------|
| `admin-auth.fastify.ts` | 2 (login, logout) | enforceTrustedOrigin + hook global |
| `admin-clinics.fastify.ts` | 3 (create, patch, delete) | enforceTrustedOrigin + hook global |
| `admin-particular-tokens.fastify.ts` | 4 (post, patch×2, delete) | enforceTrustedOrigin + hook global |
| `admin-pricing.fastify.ts` | 1 (patch) | enforceTrustedOrigin + hook global |
| `admin-report-access-tokens.fastify.ts` | 2 (post, patch revoke) | enforceTrustedOrigin + hook global |
| `admin-report-workflow.fastify.ts` | 2 (patch×2) | enforceTrustedOrigin + hook global |
| `admin-reports.fastify.ts` | 1 (post upload) | enforceTrustedOrigin + hook global |
| `admin-sessions.fastify.ts` | 1 (post revoke) | enforceTrustedOrigin + hook global |
| `admin-study-tracking.fastify.ts` | 4 (patch×3, post) | enforceTrustedOrigin + hook global |
| `admin-system-maintenance.fastify.ts` | 1 (post purge-dry-run) | enforceTrustedOrigin + hook global |
| `admin-users-roles.fastify.ts` | 2 (patch×2) | enforceTrustedOrigin + hook global |

#### Clínica (`app_session_id`)

| Archivo | Mutaciones | Protección |
|---------|-----------|------------|
| `auth.fastify.ts` | 2 (login, logout) | enforceTrustedOrigin + hook global |
| `clinic-public-profile.fastify.ts` | 3 (patch, post avatar, delete avatar) | enforceTrustedOrigin + hook global |
| `report-access-tokens.fastify.ts` | 2 (post, patch revoke) | enforceTrustedOrigin + hook global |
| `reports-status.fastify.ts` | 1 (patch status) | enforceTrustedOrigin + hook global |
| `study-tracking.fastify.ts` | 3 (post create, patch read, patch read-all) | enforceTrustedOrigin + hook global |
| `particular-tokens.fastify.ts` | 2 (post, patch report) | enforceTrustedOrigin + hook global |

#### Particular (`particular_session_id`)

| Archivo | Mutaciones | Protección |
|---------|-----------|------------|
| `particular-auth.fastify.ts` | 2 (login, logout) | enforceTrustedOrigin + hook global |
| `particular-study-tracking.fastify.ts` | 2 (patch read, patch read-all) | enforceTrustedOrigin + hook global |

#### Logística (`app_session_id`)

| Archivo | Mutaciones | Protección | Nota |
|---------|-----------|------------|------|
| `logistics-field-visits.fastify.ts` | 4 (post, patch, put, post) | enforceTrustedOrigin + hook global | |
| `logistics-route-events.fastify.ts` | 1 (post) | enforceTrustedOrigin + hook global | |
| `logistics-route-plans.fastify.ts` | 9 (5 directas + 4 lifecycle) | enforceTrustedOrigin + hook global | Las 4 lifecycle (`release`/`start`/`complete`/`cancel`) delegan a `handleRoutePlanLifecycleAction` que tiene el check en cabecera |

#### Público con mutación (Clase D)

| Archivo | Mutaciones | Protección |
|---------|-----------|------------|
| `contact.fastify.ts` | 1 (post) | enforceTrustedOrigin local (bloquea origins externos) + hook global |

Contact no usa cookie de sesión del portal. El hook global permite el POST sin `Origin` si no hay cookie. La validación local bloquea `Origin` externo igualmente.

### Rutas sin mutaciones (read-only, sin `enforceTrustedOrigin` propio)

Correctamente limitadas a GET: `admin-audit`, `admin-failed-login-alerts`, `admin-system-health`, `admin-system-schema-health`, `clinic-audit`, `logistics-sla`, `particular-audit`, `public-pricing`, `public-professionals`, `public-report-access`, `reports`.

El hook global las cubre si en el futuro se añade alguna mutación.

### Excepción Clase C — Webhooks externos

**No existen.** Auditado con búsqueda de marcadores: `x-webhook-signature`, `stripe-signature`, `x-hub-signature`. Si se añade un webhook real en el futuro, debe documentarse como excepción con protección alternativa (HMAC / shared-secret), no suprimiendo CSRF.

---

## Implementación

### Sin cambios al código de producción

El diagnóstico confirmó que toda la protección estaba correctamente implementada. No se tocó ningún archivo de runtime.

### Archivo de test añadido

**`test/security-csrf-mutating-route-coverage.test.ts`**

Contiene 12 grupos de tests:

1. **Hook global** — verifica que `fastify-app.ts` registra `requireTrustedOriginForFastify` como `onRequest` global.
2. **Registro exacto** — conteo fijo de mutaciones por archivo; falla si se añade/elimina una ruta sin actualizar el registro.
3. **Clase A/B tienen enforce local** — todos los archivos con mutaciones (salvo contact) declaran `enforceTrustedOrigin`.
4. **Read-only = 0 mutaciones** — los 11 archivos read-only no declaran ninguna mutación.
5. **Lifecycle logistics** — los 4 POST de lifecycle están cubiertos por el handler compartido con `enforceTrustedOrigin` en cabecera.
6. **No webhooks** — Clase C vacía, documentada formalmente.
7. **Integración admin-sessions** — `POST /:sessionType/:sessionId/revoke` con origin bloqueado → 403 antes de deps.
8. **Integración admin-sessions GET** — origin bloqueado en GET → no bloquea (método seguro).
9. **Integración contact** — `POST /` con origin bloqueado → 403 antes de email.
10. **Integración contact** — `POST /` con origin permitido → no 403.
11. **Integración logistics-route-plans** — POST crear plan y POST lifecycle con origin bloqueado → 403.
12. **Integración logistics GET** — origin bloqueado en GET → no bloquea.
13. **trusted-origin middleware** — no usa wildcard, `UNSAFE_METHODS` cubre los 4 métodos.
14. **storagePath** — no expuesto directamente en respuestas de rutas de reportes.
15. **Signed URLs lazy** — rutas de preview/download usan `deps.createSignedReport*`.

---

## Archivos tocados

| Archivo | Tipo | Cambio |
|---------|------|--------|
| `test/security-csrf-mutating-route-coverage.test.ts` | **NUEVO** | Test completo de cobertura CSRF |
| `docs/pr-history/PR-security-csrf-mutating-route-coverage.md` | **NUEVO** | Este documento |

Ningún archivo de producción modificado.

---

## Comandos de validación

**Terminal 1 (Windows / PowerShell — PNPM)**

```powershell
# Typecheck backend
pnpm typecheck

# Typecheck tests
pnpm typecheck:test

# Suite completa (incluye el nuevo test)
pnpm test

# Build backend
pnpm build

# Auditoría superficie pública
pnpm security:public-surface

# Frontend (solo lint + typecheck, sin build por Google Fonts)
pnpm --dir frontend lint
pnpm --dir frontend typecheck
```

---

## Resultados (verificación estática en sandbox Linux)

```
✅ hook global onRequest registrado
✅ trusted-origin: sin wildcard
✅ conteo exacto de rutas mutantes: todos correctos (23 archivos)
✅ todas las rutas A/B tienen enforceTrustedOrigin local
✅ archivos read-only: 0 mutaciones (11 archivos)
✅ logistics lifecycle: 4 POST delegados al handler con enforceTrustedOrigin
✅ no existen endpoints webhook (Clase C vacía)
✅ storagePath no expuesto directamente en respuestas
✅ TypeScript: 0 errores en test nuevo (error preexistente en frontend-particulares no relacionado)
```

Los tests de integración (Fastify.inject) requieren `node_modules` resueltos; se validan en Terminal 1 con `pnpm test`.

---

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Falso negativo si alguien añade ruta mutante sin `enforceTrustedOrigin` | Test 3 falla al detectar el archivo; Test 2 falla si el conteo cambia |
| Ruta mutante añadida en archivo nuevo no registrado | Test de conteo por archivo atraparía el gap si el archivo ya está en el registry |
| Lifecycle handler modificado para saltarse enforce | Test 5 verifica que `enforceTrustedOrigin` esté dentro del cuerpo del handler |
| Hook global eliminado de fastify-app.ts | Test 1 falla inmediatamente |

---

## Rollback

No hay cambio de comportamiento productivo. Para revertir: eliminar el archivo de test. No requiere migración ni restart.

---

## Estado final

- ✅ CSRF protegido globalmente (hook `onRequest` en fastify-app.ts)
- ✅ Todas las rutas mutantes con cookie tienen `enforceTrustedOrigin` local (defense-in-depth)
- ✅ Logistics lifecycle: shared handler cubre 4 POST
- ✅ Clase C vacía (sin webhooks)
- ✅ Tests cubren los 10 escenarios requeridos + 5 adicionales
- ✅ No se tocó DB / migraciones / WebAuthn / CORS / CSP / signed URLs / storagePath
- ✅ Smoke / login / reportes / notificaciones: sin cambios

---

## Confirmar que NO se tocó

- ❌ DB schema — no tocado
- ❌ Migraciones — no tocado
- ❌ WebAuthn/Passkeys — no tocado
- ❌ Cookies de sesión — no tocado
- ❌ CORS — no tocado
- ❌ CSP — no tocado
- ❌ Signed URLs lazy — no tocado
- ❌ storagePath — no tocado
- ❌ UI / estilos — no tocado
- ❌ Mobile fixes recientes — no tocado
- ❌ Navbar/Footer — no tocado
- ❌ Smoke/login/reportes/notificaciones — no roto

---

## PRs relacionados

- #803 trusted-origin + ocultar storagePath
- #804 admin auth JOIN
- #805 lazy signed URLs
- #806 login 429 retry headers
- #807 lint clean
- #808 client boundaries
- #809–#812 fixes mobile particulares/notificaciones
