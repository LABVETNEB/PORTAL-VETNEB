# Flaky Test Policy

Política vigente para gestionar flaky tests en VETNEB.

## Definición

Un test se considera flaky cuando puede pasar o fallar sin cambios de código relacionados, datos relacionados o configuración relacionada.

Ejemplos:

- Falla por timing.
- Falla por dependencia de orden de ejecución.
- Falla por estado compartido.
- Falla por red, puerto, sesión, storage o fixture no aislado.
- Falla solo en CI pero no local, o solo local pero no CI.
- Falla intermitente en mobile, viewport, Playwright o hidratación.

## Clasificación

| Tipo | Severidad | Regla |
| --- | --- | --- |
| Flaky confirmado en main | P1 | No avanzar con PRs dependientes sin aislar causa |
| Flaky en PR actual | P1 | Resolver en el mismo PR si pertenece al scope |
| Flaky fuera de scope | P2 | Documentar evidencia y abrir PR dedicado |
| Falla determinística | No flaky | Tratar como regresión o bug real |
| Falla por ambiente local | P2/P3 | Documentar ambiente, comando y diferencia con CI |
| Falla por dato/fixture | P1/P2 | Aislar fixture antes de ampliar cobertura |

## Evidencia mínima

Antes de declarar un test como flaky, registrar:

- Comando exacto ejecutado.
- Rama y commit.
- Sistema operativo o ambiente.
- Resultado esperado.
- Resultado observado.
- Frecuencia aproximada.
- Si falla en CI, local o ambos.
- Logs relevantes.
- Relación con cambios del PR.

## Reglas de acción

### Permitido

- Reproducir el fallo con el comando más pequeño posible.
- Aislar fixture, helper o estado compartido en un PR test-only.
- Separar PR funcional de PR de estabilización.
- Documentar un follow-up si el flaky no pertenece al scope actual.
- Usar evidencia de CI y local para clasificar severidad.

### Prohibido sin autorización explícita

- Eliminar tests para pasar CI.
- Saltar tests con `.skip` sin issue/PR de seguimiento.
- Reducir cobertura sin explicación.
- Cambiar timeouts globales sin auditoría.
- Cambiar Playwright config dentro de PR funcional.
- Mezclar dependency updates con estabilización de tests.
- Llamar flaky a una regresión determinística.

## Flujo obligatorio

1. Confirmar `main` limpio y actualizado.
2. Ejecutar el comando mínimo que reproduce el fallo.
3. Repetir si la falla parece intermitente.
4. Clasificar como flaky, regresión, ambiente o fixture.
5. Definir owner del dominio.
6. Si es del scope actual, corregir antes de merge.
7. Si está fuera de scope, documentar evidencia y abrir PR dedicado.
8. No ocultar el fallo en el PR body.

## Salida esperada en PR body

Cuando haya flaky test o sospecha de flaky test, incluir:

- Test afectado.
- Comando usado.
- Cantidad de ejecuciones.
- Resultado.
- Clasificación.
- Decisión tomada.
- Follow-up si aplica.

## Criterio de cierre

Un flaky se considera cerrado cuando:

- Existe causa identificada o mitigación clara.
- La suite afectada pasa con el comando definido.
- No se redujo cobertura sin justificación.
- El PR queda limitado al scope declarado.
