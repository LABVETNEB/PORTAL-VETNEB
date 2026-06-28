# VETNEB Agent Instructions

Estas instrucciones aplican a todo agente que trabaje en este repositorio y son obligatorias para cualquier auditoría, implementación, test, documentación o revisión.

## Usuario

Nico.
Senior Web Developer.

## Entorno obligatorio

- Windows.
- PowerShell.
- PNPM.
- Todo por terminal.
- Indicar Terminal 1 / Terminal 2.
- Código completo siempre.
- Nada de fragmentos.
- Respuestas específicas, no genéricas.
- Comentarios mínimos.

## Principio global

El agente debe trabajar siempre bajo protocolo VETNEB.

Cada tarea debe limitarse al scope indicado por Nico.

No asumir autorización implícita para tocar archivos, módulos, backend, DB, migraciones, dependencias, auth, seguridad, CI, workflows, Dependabot o configuración productiva.

Si una tarea requiere salir del scope:
1. detenerse,
2. explicar la necesidad,
3. listar archivos afectados,
4. explicar riesgo,
5. esperar autorización explícita.

## Protocolo antes de tocar código

Antes de modificar archivos, siempre:

1. Asegurar base limpia.
2. Inspeccionar paridad local.
3. Buscar referencias legacy relacionadas con el scope.
4. Confirmar tests nativos.
5. Identificar archivos reales.
6. Reportar riesgos.
7. Proponer plan mínimo.
8. Confirmar validaciones necesarias.
9. Esperar confirmación si existe riesgo, ambigüedad o fuera de scope.

No implementar antes de completar la auditoría previa.

## Scope

Limitar trabajo al scope indicado del PR o tarea.

No mezclar:

- Dependabot.
- Refactors globales.
- Backend no solicitado.
- DB no solicitada.
- Migraciones no solicitadas.
- Dependencias no solicitadas.
- Cambios visuales fuera del módulo.
- Cambios de login/auth estructural no solicitados.
- Cambios de CI/workflows no solicitados.
- Limpiezas masivas no solicitadas.

## Git y GitHub CLI

### Permitido para agentes

Solo lectura o inspección:

- git status --short
- git branch --show-current
- git log -1 --oneline
- git diff --stat
- git diff --check
- git diff --name-only
- git branch
- git branch -r --no-merged origin/main

Preparación de rama solo si Nico solicita implementación:

- git fetch --prune
- git switch main
- git pull --ff-only
- git switch -c <branch-name>

### Prohibido para agentes salvo autorización explícita de Nico en el mismo mensaje

- git add
- git commit
- git push
- git reset
- git clean
- git checkout -- .
- git restore .
- git restore --staged
- git merge
- git rebase
- git tag
- gh pr create
- gh pr merge
- gh pr checks
- gh run
- cualquier comando gh no autorizado

Nico realiza manualmente stage, commit, push, PR, checks y merge.

El comando correcto de checks es:

gh pr checks --watch

No usar:

gh pr checks <NUMERO_PR> --watch

## Validaciones

Cuando haya implementación, ejecutar o solicitar:

- pnpm test
- pnpm build
- pnpm security:public-surface
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build

Si algún script no existe:
1. reportarlo,
2. no inventarlo,
3. usar solo equivalentes reales disponibles.

No simular éxito.
Distinguir claramente:

- ejecutado y pasó,
- ejecutado y falló,
- no ejecutado,
- script no disponible.

## Seguridad

No leer, imprimir, modificar ni exponer:

- .env
- .env.*
- secretos
- tokens reales
- cookies reales
- passwords
- hashes
- signed URLs
- claves privadas
- dumps
- backups
- logs sensibles
- datos clínicos o comerciales innecesarios

.env.example y .env.sample pueden usarse solo como referencia de nombres de variables, nunca como fuente de secretos.

Preservar:

- admin_session_id para Admin.
- app_session_id para Clínica.
- Auth.
- Roles.
- Permisos.
- CSRF.
- Rate limits.
- CSP.
- No-store en superficies privadas.
- No filtración de errores DB.
- No stack traces al cliente.
- No mocks silenciosos en producción.
- No fallbacks falsos que oculten errores reales.

## Backend, DB y dependencias

No tocar salvo scope explícito:

- backend,
- DB,
- Drizzle,
- migraciones,
- schema,
- endpoints,
- cookies,
- CORS,
- CSP,
- auth,
- rate limits,
- package.json,
- pnpm-lock.yaml,
- dependencias.

Si el cambio exige tocar alguno:
1. detenerse,
2. justificar,
3. listar archivos,
4. explicar riesgo,
5. esperar aprobación.

## Frontend y responsive

Toda implementación frontend debe aplicar en:

- desktop,
- laptop,
- tablet,
- móvil.

Preservar:

- sin overflow horizontal,
- foco visible,
- navegación por teclado cuando aplique,
- labels y aria cuando aplique,
- contraste razonable,
- estados loading/empty/error claros,
- acciones críticas visibles.

Cuando el scope involucre dashboard o software administrativo:

- priorizar layout operativo,
- evitar páginas largas,
- evitar scroll externo innecesario,
- evitar scroll interno salvo contrato explícito,
- no resolver con overflow-y auto como salida fácil,
- usar densidad, paginación, tabs, master-detail, paneles o truncado seguro.

## Entrega

Toda implementación debe crear markdown de entrega en:

- docs/implementation,
- docs/audit,

siguiendo el patrón existente del repositorio. (`IMPLEMENTATION_NOTES/` se consolidó dentro de
`docs/implementation/` por PR-CLEAN2, 2026-06-28; no recrear esa carpeta.)

Debe incluir:

- estado base,
- scope incluido,
- scope excluido,
- auditoría previa,
- cambios,
- archivos modificados,
- validaciones,
- resultado,
- riesgo residual,
- estado final.

## Calidad

Alinear con:

- ISO/IEC 25000,
- ISO/IEC 25010,
- ISO 9001,
- ISO/IEC 5055,
- ISO/IEC 15504,
- ISO 27001,
- ISO/IEC 14598.

Priorizar:

- correctitud funcional,
- seguridad,
- mantenibilidad,
- bajo riesgo,
- performance razonable,
- accesibilidad,
- trazabilidad,
- cambio mínimo suficiente,
- no sobreingeniería.

## Finalización

Antes de finalizar cualquier implementación, revisar:

- git status --short
- git diff --stat
- git diff --check
- git diff --name-only

La respuesta final debe indicar:

1. qué se hizo,
2. archivos modificados,
3. validaciones ejecutadas y resultado,
4. exclusiones respetadas,
5. estado final,
6. comandos manuales pendientes para Nico, sin ejecutarlos.
