# PR: fix/particulares-mobile-session-card-render

## Resumen

Corrige el render mobile del resumen de datos visibles en `/particulares` cuando hay sesión particular activa. El fix queda aislado al panel particular autenticado mediante atributos `data-*` específicos y CSS mobile-only, sin modificar `.surface-soft` global ni tocar endpoints, auth, cookies, backend, datos, notificaciones ni flujo de informe.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `frontend/src/components/public/ParticularesContent.tsx` | Agrega selectores estables al panel, resumen y seis campos visibles. |
| `frontend/src/components/public/VisualAccents.tsx` | Permite pasar atributos HTML/data a `PremiumPanel`. |
| `frontend/src/app/globals.css` | Agrega bloque mobile-only aislado para estabilizar render del panel activo. |
| `scripts/security/audit-public-devtools-surface.mjs` | Allowlist exacto para los tres `data-*` visuales requeridos. |
| `test/frontend-particulares-mobile-session-card-render.test.ts` | Nuevo contrato de selectores, CSS mobile-only, campos/anchors y allowlist. |
| `docs/pr-history/PR-fix-particulares-mobile-session-card-render.md` | Documento de entrega. |

## Implementación realizada

- `PremiumPanel` ahora extiende `HTMLAttributes<HTMLDivElement>` y propaga `...props`; esto permite `data-particular-session-panel` sin crear wrappers extra.
- El panel de sesión particular activa expone `data-particular-session-panel={session ? "true" : undefined}`.
- El resumen de caso expone `data-particular-session-summary="true"`.
- Cada campo visible del resumen expone `data-particular-session-field="true"`: Tutor, Mascota, Especie, Raza, Extracción y Envío.
- `globals.css` agrega `/* particular-session-mobile-render-fix:start */` bajo `@media (max-width: 639px)`.
- En mobile, el panel particular activo desactiva composición problemática (`transform`, `will-change`, `backface-visibility`), usa fondos opacos y reduce sombras anidadas.
- El CSS no redefine `.surface-soft` globalmente; solo apunta a los selectores del panel particular.
- El auditor de superficie pública conserva el bloqueo general de `data-*` sensibles y solo permite estos tres atributos de presentación exactos.

## Tests agregados/modificados

- Nuevo archivo: `test/frontend-particulares-mobile-session-card-render.test.ts`.
- Cubre:
  - selector estable del panel activo: `data-particular-session-panel="true"`.
  - selector estable del resumen: `data-particular-session-summary="true"`.
  - seis fields con `data-particular-session-field="true"`.
  - persistencia de Tutor, Mascota, Especie, Raza, Extracción, Envío.
  - persistencia de anchors `particular-study-tracking` y `particular-report`.
  - CSS mobile-only para los selectores.
  - ausencia de override global destructivo sobre `.surface-soft`.
  - allowlist exacto del auditor para los tres atributos visuales.

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| `pnpm test test/frontend-particulares-mobile-session-card-render.test.ts` | Falló inicialmente porque el script ejecuta la suite completa y el auditor marcó los nuevos `data-*` con `session`; se corrigió con allowlist exacto. |
| `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-particulares-mobile-session-card-render.test.ts` | PASS, 5/5. |
| `pnpm --dir frontend build` | PASS. Warning preexistente: unused eslint-disable en `frontend/src/app/api/security/csp-report/route.ts`. |
| `pnpm typecheck` | PASS. |
| `pnpm typecheck:test` | PASS. |
| `pnpm test` | PASS, 2139/2139. |
| `pnpm build` | PASS, genera `dist/index.js`. |
| `pnpm security:public-surface` | PASS, sin public findings. Lista solo findings server-only preexistentes en `frontend/src/middleware.ts`. |

## Validación visual local

- Se levantó `pnpm --dir frontend dev` y se abrió `http://localhost:3000/particulares` en el navegador local.
- La ruta cargó correctamente con título `Acceso para particulares | Portal VETNEB`.
- El formulario público de token se mostró correctamente.
- No se verificó manualmente una sesión particular activa real porque el entorno no tenía token/cookie particular autenticada disponible. El estado activo queda cubierto por contratos de render y CSS, y requiere una sesión real para inspección visual final.
- El dev server local fue detenido al terminar la revisión.

## Riesgos

| Riesgo | Nivel | Mitigación |
|---|---|---|
| El estado activo no fue inspeccionado visualmente con sesión real | Medio | Contratos aseguran selectores/CSS/campos; validar manualmente con token real en mobile antes de merge. |
| El auditor podría volver a marcar atributos visuales con nombres sensibles | Bajo | Allowlist exacto, sin patrones amplios. |
| Algún cambio futuro elimina atributos requeridos | Bajo | Test dedicado falla si se remueven panel, resumen o fields. |
| Desktop cambia visualmente | Bajo | CSS está dentro de `@media (max-width: 639px)`. |

## Rollback

Revertir este cambio elimina:

- atributos `data-particular-session-*` en `ParticularesContent`.
- propagación de props en `PremiumPanel`.
- bloque `particular-session-mobile-render-fix` en `globals.css`.
- allowlist exacto del auditor.
- test nuevo de contrato.

No hay migraciones, backend, datos ni configuración de sesión para revertir.

## Estado final

- Implementación completa.
- Validación obligatoria completa y en verde.
- No se hizo `git add`.
- No se hizo commit.
- No se hizo push.
- No se creó PR.
- No se hizo merge.
