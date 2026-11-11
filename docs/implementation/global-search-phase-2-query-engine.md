# Global Search — Fase 2: lenguaje de consultas (motor backend)

| Campo | Valor |
| --- | --- |
| Alcance | backend-only: `server/features/global-search/{domain,infrastructure}` y tests |
| Riesgo | R2 (contrato de búsqueda), sin schema, migraciones, dependencias ni auth |
| Referencia externa | `docs/implementation/FUNCIONALIDAD SUPERBUSCADOR.md` (investigación, no fuente rectora) |
| Estado | Implementado en el árbol local; pendiente de commit manual |

## Causa raíz

El motor trataba `q` como **una sola frase** (`ILIKE '%q%'` por columna). `luna perez` sólo
encontraba un campo que contuviera la frase contigua; no había OR, frases explícitas ni
operadores (E17, E18, E28, E31, E32 de la referencia).

## Gramática (`domain/global-search-query.ts`, puro, sin I/O)

| Forma | Significado |
| --- | --- |
| `luna perez` | AND implícito; cada palabra puede coincidir en cualquier campo buscable |
| `"luna perez"` | frase exacta (contigua dentro de un campo) |
| `luna OR rex` | OR explícito, sólo en mayúsculas; AND liga más fuerte (`a b OR c` = `(a AND b) OR c`) |
| `type:informe` | restringe las **entidades** consultadas a toda la consulta, en cualquier posición; varios `type:` se unen |
| `title:luna`, `title:"luna perez"` | el término sólo coincide con el título/nombre de la entidad |

Alias de `type:` (sin tildes, insensible a mayúsculas): `informe(s)|report(s)`, `token(s)|token_particular`,
`seguimiento(s)|tracking`, `clinica(s)|clinic` (sólo Admin), `usuario(s)|user(s)` (sólo Admin).

Reglas deterministas:

- Comilla sin cerrar = frase hasta el final. `""`, `OR` colgante/duplicado y `type:` sin valor se ignoran.
- `or` en minúscula, `"OR"` entre comillas y `-término` son literales (no hay exclusión: ver «Fuera de alcance»).
- Operador desconocido (`foo:bar`) → **400** `Operador de búsqueda desconocido: foo:`. Entre comillas es literal; `10:30`
  o `TOK-A:1` no son operadores (el nombre exige ≥2 letras desde el inicio de la palabra).
- `type:` inválido → 400; `type:` fuera de la superficie (Clínica pide `clinica`/`usuario`) o contradictorio con `kinds` → 400.
  `type:` **nunca amplía** `kinds` ni la superficie: sólo intersecta.
- Una consulta sin términos ni operadores → 400 `La búsqueda requiere al menos un término`. Desde la Entrega A, una consulta de sólo operadores
  (`type:informe`) **es válida** y se amplió la gramática: ver `global-search-drive-a-canonical-query.md`.
- Límites: 8 términos y 4 alternativas por consulta (acota el tamaño del SQL).

## Compatibilidad

- Una palabra: el SQL es el mismo de antes. Varias palabras sin operadores: el conjunto de resultados es un **superconjunto**
  del anterior (toda coincidencia por frase contigua sigue apareciendo; además aparecen las palabras en cualquier orden o en campos distintos).
- Rank (`0` id, `1` título exacto, `2` prefijo, `3` contiene): para consulta simple usa el texto completo como antes; con operadores
  usa el primer término. `numericId` sólo si la consulta es un único número.
- `needle.text` sigue siendo el texto normalizado completo: el cursor HMAC queda atado a la consulta con operadores y `result.query` no cambia.
- Contrato HTTP, `no-store`, tenant, paginación por cursor/offset, orden y proyección: sin cambios. `q ≤ 80` y `≥ 2` caracteres siguen igual.
- El frontend no cambia: envía `q` tal cual; un 400 de sintaxis llega como error genérico (mejora de mensaje: pendiente de frontend).

## Seguridad

- Cada término llega a SQL sólo como patrón LIKE escapado (`\`, `%`, `_`) ligado como parámetro; los operadores no construyen texto SQL.
- El predicado del tenant sigue siendo el primero del `WHERE`, con cualquier combinación (test `SQL lenguaje: en toda entidad…`).
- `title:` reduce columnas, nunca agrega; `type:` reduce entidades, nunca agrega.

## G6 — tolerancia tipográfica: investigada, NO implementada

- `pg_trgm` y `unaccent` ya existen (migraciones 0004/0007), así que no exigiría dependencias ni schema.
- Pero los índices GIN trigram de 0004 están sobre la columna cruda, no sobre `immutable_unaccent(col)`; `similarity()`/`%` sobre la
  expresión plegada no los usaría (igual que hoy el `ILIKE`): costo por fila comparable, sin índice, sobre datos por tenant.
- Riesgo de precisión: nombres de pacientes/tutores cortos y parecidos (`Luna`/`Lupa`, `Rex`/`Rey`) producirían coincidencias
  falsas sobre datos clínicos, y un umbral correcto exige medir contra datos reales (no hay DB local disponible).
- Decisión: no se agrega fuzzy. Si se retoma: medir con `EXPLAIN ANALYZE` en staging, limitar a términos ≥5 letras y a un rank propio
  posterior a las coincidencias exactas, con autorización específica.

## Fuera de alcance / pendiente

- G5 (consulta en URL), chips a 320 px y mensajes de sintaxis en el frontend.
- Exclusión `-término` (E30): la referencia la marca no fiable; no se implementa hasta tener corpus de pruebas.
- Pruebas contra PostgreSQL real de los operadores (aislamiento Clinic A/B con `type:`/OR): BLOCKED sin `DATABASE_URL` local.

## Validación

Ver el informe de la tarea: tests dirigidos de dominio, forma del SQL y rutas; gates backend con estados canónicos.
