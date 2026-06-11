# PR-10 — feat(public): add evidence-first institutional home hero

Rama: `feat/claude-public-evidence-first-home-hero`

---

## Objetivo

Reemplazar el hero de pantalla completa basado en texto por un hero evidence-first más
compacto que muestra en simultáneo: copia diagnóstica, firma profesional, CTAs
como action tiles, un mock de informe 100 % ficticio y un mini timeline de etapas.

---

## Archivos modificados

| Archivo | Tipo de cambio |
|---|---|
| `frontend/src/app/page.tsx` | Hero reescrito (evidence-first) + banda utilitaria relocalizada |
| `frontend/e2e/home-hero-evidence-first.spec.ts` | Test E2E nuevo (8 casos) |
| `test/frontend-home-page-content.test.ts` | Contrato de contenido actualizado al nuevo hero |
| `test/frontend-native-link-preview-contract.test.ts` | Contrato de CTAs actualizado al nuevo hero |
| `test/frontend-public-button-contrast-contract.test.ts` | Contrato de CTA contrast actualizado |
| `test/frontend-visual-consistency.test.ts` | Contrato de jerarquía visual actualizado |

---

## Cambios en `page.tsx`

### Hero

- Removido `min-h-[calc(100vh-4.5rem)]` — hero compacto con `py-12 … lg:py-20`.
- Grid 2 columnas `lg:grid-cols-[1fr_460px]`: izquierda copia, derecha mock + timeline.
- H1: `"Diagnóstico anatomopatológico veterinario con trazabilidad de muestra a informe"`.
- Subtítulo: histopatología, citología y tinciones especiales con criterio clínico-patológico.
- Firma profesional: `Dr. Nicolás E. Barbé — Médico veterinario patólogo · Responsable de diagnóstico`.
- CTAs migrados de buttons a **action tiles** (`.public-hero-action-tile`):
  - Portal de informes → `ROUTES.login`
  - Seguir con código → `ROUTES.particulares`
- Columna derecha `hidden lg:flex`:
  - Mock de informe estático 100 % ficticio (`aria-hidden="true"`), rotulado
    `MUESTRA · DEMOSTRATIVO — No es un informe real` con fondo ámbar.
  - Contenido ficticio: N° VT-0000-000, Mastocitoma grado II, márgenes libres.
  - Mini timeline 4 etapas: Recepción → Procesamiento → Evaluación → Informe emitido.
- Tamaños de texto en el mock usando `text-[Npx]` (no `text-[rem]`) para mantener
  el contrato de no-regresión `text-[0.62rem]`.

### Banda utilitaria

- Movida **fuera del hero** a un `<div>` independiente con borde y fondo suave.
- Texto: `Resultados disponibles las 24 hs · Atención de lunes a viernes de 8 a 17 h`.
- WhatsApp: `3534138946` mediante `PublicExternalControl` (no `<a>`).

### Resto de la página

Sin cambios. Secciones de confianza clínica, servicios, cómo funciona, beneficios
y CTA final quedan idénticas.

---

## Test E2E nuevo (`home-hero-evidence-first.spec.ts`)

Casos cubiertos:

1. H1 contiene `anatomopatológico`
2. Firma `Dr. Nicolás E. Barbé` visible
3. CTA `Acceder al portal` presente
4. CTA `Seguir con código` presente
5. Banda utilitaria con horario y WhatsApp
6. Mock `DEMOSTRATIVO` / `No es un informe real` en desktop (1440 px)
7. `Informe Anatomopatológico` en desktop
8. Mini timeline con las 4 etapas en desktop

---

## Validación ejecutada

```
pnpm --dir frontend lint       → OK (sin warnings)
pnpm --dir frontend typecheck  → OK
pnpm --dir frontend build      → OK — 25 páginas estáticas + 7 dinámicas
pnpm test                      → 4 tests de contenido pasaron (✔)
                                  6 scope-tests fallan únicamente por
                                  estado no-commiteado (git diff --name-only
                                  ve page.tsx modificado sin commit);
                                  desaparecen al hacer git commit
```

---

## Tests de contrato actualizados

Los 4 tests de contrato de la home existentes verificaban el texto exacto del hero
anterior. Se actualizaron para reflejar PR-10 sin perder cobertura:

- `frontend-home-page-content.test.ts` → nuevos assertions sobre firma, CTAs y band.
- `frontend-native-link-preview-contract.test.ts` → CTA tiles reemplazan buttons.
- `frontend-public-button-contrast-contract.test.ts` → permite action tiles en home.
- `frontend-visual-consistency.test.ts` → gradiente y clases de layout actualizados.

---

## Scope PR-10 (respetado)

**Tocado:**
- `frontend/src/app/page.tsx`
- `frontend/e2e/home-hero-evidence-first.spec.ts` (nuevo)
- 4 archivos de test de contrato de la home

**No tocado:**
- Producción, DB, auth, secretos, middleware, API routes
- Dashboard, pricing, servicios, particulares-content, login-content
- `package.json`, `pnpm-lock.yaml` (sin dependencias nuevas)
- `globals.css` (clases `.public-hero-action-*` ya existían)

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Mock visible en navegadores < lg (<1024 px) | No — `.hidden lg:flex` oculta la columna en mobile/tablet |
| Mock confundido con informe real | Banner ámbar destacado + `aria-hidden="true"` + texto explícito |
| Cambio de gradiente del hero | Actualizado también en test de visual consistency |
| Scope tests fallando en CI pre-commit | Esperado; `git diff --name-only` ve cambios no-commiteados. Pasan al commitear |

---

## Checklist de entrega (para Nico)

- [ ] `git status` — confirmar archivos modificados
- [ ] `git add frontend/src/app/page.tsx frontend/e2e/home-hero-evidence-first.spec.ts test/frontend-home-page-content.test.ts test/frontend-native-link-preview-contract.test.ts test/frontend-public-button-contrast-contract.test.ts test/frontend-visual-consistency.test.ts IMPLEMENTACION-PR-10-public-evidence-first-home-hero.md`
- [ ] `git commit -m "feat(public): add evidence-first institutional home hero (#PR-10)"`
- [ ] `git push -u origin feat/claude-public-evidence-first-home-hero`
- [ ] `gh pr create`
- [ ] `gh pr checks --watch`
- [ ] `gh pr merge --squash --delete-branch`
