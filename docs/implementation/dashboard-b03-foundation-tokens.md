# B03 — Dashboard foundation tokens

**Base:** `5711145ab894f1756494e6c1a4b9dff41e923322` (`refactor(dashboard): retire B02 dead components (#1659)`)
**Rama:** `feat/dashboard-b03-foundation-tokens`
**Programa B, nivel 3.** Dependencia formal: B01 (cerrado). B02 cerrado.
**Roadmap:** `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` §49, §54, §58 (G5), §59–§60 (R9), §61.

## 1. Objetivo

Completar el foundation de tokens del dashboard en
`frontend/src/styles/dashboard/tokens.css` con ocho escalas explícitas — color,
shape, elevation, state-layer, spacing, density, typography, motion — en tema
claro y oscuro, y añadir un contrato ejecutable fail-closed que demuestre
completitud y coherencia.

**B03 define el foundation. B04 migra las superficies.** Esa separación es el
criterio de cierre, no una preferencia de estilo: en cuanto una superficie
consume un token, la definición y la migración quedan en un único diff
indistinguible en revisión. Por eso el contrato exige **cero consumidores**.

Después de B03 el dashboard vivo se ve exactamente igual.

## 2. Punto de partida medido

- `tokens.css` **no** era ya el placeholder de 514 B del audit original: contenía
  el contrato `dashboard-row-pitch-contract` (A05–A07), 136 líneas, que la
  capacity engine lee en runtime como literales px parseables.
- El árbol `frontend/src/styles/dashboard/**` contenía **0** reglas `data-theme`.
  El dashboard heredaba el tema exclusivamente de los flips de `globals.css`.
  Esto es exactamente R9 («tema oscuro sin cubrir») verificado, no supuesto.
- Namespace `--dash-*` ya poblado: 43 declaraciones en `responsive.css`,
  28 en `tokens.css` (pitch), 19 en `surfaces.css` (accents), 13 en
  `zero-scroll.css`. Todas estructurales o de runtime; ninguna de foundation.

## 3. Mecanismo de tema real (no se introduce uno nuevo)

| Pieza | Hecho verificado |
|---|---|
| `frontend/src/lib/theme.ts` | `DARK_GRAY_THEME_MODE = "dark-gray"`; `document.documentElement.dataset.theme = theme` |
| `frontend/public/theme-init.js` | Mismo atributo, pre-paint, desde `vetneb-theme-mode` |
| `frontend/src/app/globals.css` | Owner de la paleta oscura bajo `:root[data-theme="dark-gray"]` |

B03 usa **ese** selector, derivado en el contrato desde `theme.ts` en vez de
hardcodeado. No se introduce `.dark`, `[data-color-scheme]`,
`data-dashboard-theme` ni `prefers-color-scheme` como owner.

```css
.dashboard-app-shell { /* light + invariantes */ }
:root[data-theme="dark-gray"] .dashboard-app-shell { /* solo THEME_VARIANT */ }
```

## 4. Clasificación por tema

El requisito era que el contrato falle si un token temático existe en claro pero
no en oscuro. La lectura literal —restar cada token bajo el selector oscuro—
produce una escala que *parece* cubierta y en realidad añade un segundo sitio
donde divergir: la mayoría de los roles resuelven a través de tokens globales
que `globals.css` **ya** re-escribe en oscuro, así que su duplicado sería
textualmente idéntico y, por tanto, CSS muerto.

Se adoptan tres clases explícitas, y el contrato prueba cada una:

| Clase | Declaraciones | Cómo se prueba el valor oscuro | N |
|---|---|---|---|
| `THEME_INVARIANT` | 1 | Debe **no** aparecer en el scope oscuro **y** no referenciar ningún token que el tema oscuro reescriba (si lo hiciera, estaría mal clasificado) | 47 |
| `THEME_ADAPTIVE` | 1 | Se **resuelve la referencia**: cada token global citado debe estar realmente redefinido bajo `:root[data-theme="dark-gray"]` en `globals.css` | 18 |
| `THEME_VARIANT` | 2 (claro + oscuro) | Ambas deben existir **y sus valores deben diferir** | 8 |

`THEME_ADAPTIVE` es una desviación deliberada respecto de la instrucción literal
(«un token temático en light sin dark → FAIL») y se reporta como tal. Es más
fuerte, no más débil: detecta el fallo real de R9 —un rol del dashboard sin
valor oscuro definido— en lugar de contar líneas. Si `globals.css` dejara de
reescribir `--card`, la duplicación textual seguiría en verde mientras el
dashboard pierde su superficie oscura; esta comprobación falla.

**Dark completeness: PASS.** 8 VARIANT con valores distintos + 18 ADAPTIVE con
referencia resuelta + 47 INVARIANT justificados = 73 tokens, ninguno con tema
indefinido.

## 5. Las ocho escalas

Namespace `--dash-<categoría>-<rol>`. Los diez prefijos usados
(`--dash-color-`, `-shape-`, `-elevation-`, `-state-`, `-space-`, `-density-`,
`-text-`, `-motion-`) se verificaron libres de colisión en `frontend/src`,
`test/` y `docs/` antes de crearse.

### 5.1 Color — 18 (15 ADAPTIVE, 3 VARIANT)

| Token | Claro | Oscuro | Provenance |
|---|---|---|---|
| `--dash-color-canvas` | `hsl(var(--vetneb-surface))` | ADAPTIVE | 198 34% 96% → 210 8% 12% |
| `--dash-color-surface` | `hsl(var(--card))` | ADAPTIVE | 190 33% 98% → 210 9% 16% |
| `--dash-color-surface-raised` | `hsl(var(--vetneb-surface-raised))` | ADAPTIVE | flip global |
| `--dash-color-surface-muted` | `hsl(var(--vetneb-surface-muted))` | ADAPTIVE | flip global |
| `--dash-color-on-surface` | `hsl(var(--foreground))` | ADAPTIVE | flip global |
| `--dash-color-on-surface-muted` | `hsl(var(--muted-foreground))` | ADAPTIVE | flip global |
| `--dash-color-outline` | `hsl(var(--vetneb-line))` | ADAPTIVE | flip global |
| `--dash-color-outline-subtle` | `hsl(var(--vetneb-line) / 0.42)` | ADAPTIVE | alpha 0.42 medida 3× en este árbol |
| `--dash-color-primary` | `hsl(var(--primary))` | ADAPTIVE | flip global |
| `--dash-color-on-primary` | `hsl(var(--primary-foreground))` | ADAPTIVE | flip global |
| `--dash-color-accent` | `hsl(var(--vetneb-teal))` | ADAPTIVE | flip global |
| `--dash-color-success` | `hsl(var(--vetneb-teal))` | ADAPTIVE | teal = positivo clínico |
| `--dash-color-error` | `hsl(var(--destructive))` | ADAPTIVE | flip global |
| `--dash-color-info` | `hsl(var(--vetneb-cyan))` | ADAPTIVE | flip global |
| `--dash-color-focus-ring` | `var(--clinical-focus-ring)` | ADAPTIVE | PR-VIS-3, redefinido en oscuro |
| `--dash-color-field` | `hsl(var(--vetneb-surface-muted) / 0.72)` | `… / 0.92` | ambas alphas son literales medidos aquí; objetivo B05 |
| `--dash-color-warning` | `hsl(var(--vetneb-amber))` | `hsl(38 88% 64%)` | el valor oscuro es **verbatim** el override que `globals.css` ya aplica al ámbar en oscuro |
| `--dash-color-overlay-scrim` | `hsl(var(--vetneb-ink) / 0.32)` | `hsl(210 15% 4% / 0.62)` | `--vetneb-ink` pasa de 15% a 90% de luminosidad: heredarlo pintaría un scrim **blanco** |

`--dash-color-warning` y `--dash-color-overlay-scrim` son los dos casos donde
heredar la paleta volteada da la respuesta *incorrecta* o *insuficiente*. Son la
justificación material de la clase VARIANT.

### 5.2 Shape — 8, INVARIANT

`none: 0` · `xs: 0.45rem` · `sm: 0.5rem` · `md: 0.6rem` · `lg: 0.75rem` ·
`xl: 0.85rem` · `2xl: 1.1rem` · `full: 9999px`

Monotónica y derivada del censo real de `border-radius` del árbol dashboard
(0.5rem es el literal más repetido y coincide con `--radius`; 0.6/0.75/0.85 son
los siguientes clusters; 0.45 y 1.1 los extremos observados). `--radius` global
no se toca.

### 5.3 Elevation — 4 (1 INVARIANT, 3 ADAPTIVE)

`none: none` · `raised: var(--clinical-shadow-sm)` ·
`menu: var(--clinical-shadow-md)` · `dialog: var(--clinical-shadow-lg)`

`--dash-elevation-none` existe para que B04 pueda afirmar la planitud del chrome
persistente de forma positiva: «sin propiedad `box-shadow`» y «elevation: none»
son afirmaciones distintas en revisión. Los tres niveles elevados son ADAPTIVE
porque `globals.css` ya re-escribe esas sombras en oscuro (alpha 0.055→0.20,
0.08→0.28, 0.10→0.34). **No se convierte ninguna sombra existente: eso es B04.**

### 5.4 State-layer — 6 (5 VARIANT, 1 INVARIANT)

| Token | Claro | Oscuro |
|---|---|---|
| `--dash-state-hover-opacity` | 0.06 | 0.10 |
| `--dash-state-pressed-opacity` | 0.10 | 0.16 |
| `--dash-state-selected-opacity` | 0.13 | 0.20 |
| `--dash-state-focus-opacity` | 0.16 | 0.24 |
| `--dash-state-layer-color` | `hsl(var(--vetneb-navy))` | `hsl(var(--vetneb-ink))` |
| `--dash-state-disabled-opacity` | 0.45 | INVARIANT |

Anclas claras medidas en el repo (wash navy 0.06; selección teal 0.13/0.16);
los valores oscuros son una derivación documentada ×1.6, conservadora frente al
×3.0–×3.6 que la paleta oscura ya aplica a sus propias sombras. `layer-color`
expresa la inversión de dirección —oscurecer con tinte de marca en claro,
aclarar en neutro en oscuro— que ningún token heredado puede expresar solo.
`disabled` es INVARIANT porque atenúa el elemento, no pinta una capa: 0.45
verbatim de `.dashboard-disabled-state`.

### 5.5 Spacing — 7, INVARIANT

`0` · `0.25rem` · `0.5rem` · `0.75rem` · `1rem` · `1.5rem` · `2rem`

Ritmo 8 px con micro-paso de 4 px y el secundario de 12 px que midió la
auditoría, acotado por los techos de clamp ya presentes en `responsive.css`.

### 5.6 Density — 6, INVARIANT — y la frontera con el capacity contract

`control-compact: 1.9rem` · `control-regular: 2.25rem` ·
`control-comfortable: 2.5rem` · `inset-compact|regular|comfortable` →
`--dash-space-1|2|3`

**La altura de fila NO está aquí.** `--dash-row-pitch*` en el contrato de
row-pitch es el único owner de cuán alta es una fila, y la capacity engine lee
esos tokens en runtime. Un token de altura de fila en density sería un owner
competidor aunque nada lo consumiera todavía. Density describe **chrome**:
controles y sus insets. Límites medidos en `responsive.css` (`--dash-tab-h`
recorre 1.9–2.25rem; `--dash-control-h` techo 2.5rem). El contrato asegura la
separación por nombre.

### 5.7 Typography — 19, INVARIANT

Roles `label`, `body`, `body-strong`, `section`, `title`, `metric` sobre
`--dash-text-family: var(--font-ui)` (Inter existente, **referenciado, nunca
redeclarado**; sin `@font-face` nuevo, sin fuente nueva). Tamaños, pesos,
leadings y tracking son literales ya medidos en el árbol (el peso 650 aparece
diez veces; 0.8125rem, 1.08rem, 0.06em, 1.15 son medidos). `body-weight: 400` es
el peso que el cuerpo hereda hoy, porque el CSS del dashboard no declara ninguno.

### 5.8 Motion — 5, INVARIANT

`fast → var(--motion-fast)` · `standard → var(--motion-base)` ·
`slow → var(--motion-slow)` · `ease-standard → var(--ease-out-soft)` ·
`ease-emphasized → var(--ease-in-out-soft)`

Alias semánticos, no duraciones nuevas: el dashboard ya anima sobre esos tokens
y duplicarlos daría dos fuentes de verdad a la misma transición.

**R11:** ningún token existe para animar la altura de una región. Animar
`block-size` alimenta el `ResizeObserver` que deriva capacidad y hace oscilar
`limit`. El contrato lo prohíbe por nombre y por valor. `prefers-reduced-motion`
existente no se toca.

## 6. Preservación de A05–A07

El bloque `dashboard-row-pitch-contract` no se reescribió, no se movió fuera de
`tokens.css`, no se renombró y ningún literal px pasó a `rem`/`calc()`/`clamp()`.
El foundation se insertó **antes** del bloque, de modo que el capacity owner
conserva la última palabra en la cascada.

```
ROW_PITCH_HASH_BEFORE = f76d889cc2a19a10ac45abb7cb709ffaada744aca553c81e7010b3fd65044093
ROW_PITCH_HASH_AFTER  = f76d889cc2a19a10ac45abb7cb709ffaada744aca553c81e7010b3fd65044093
ROW_PITCH_CONTRACT_BYTE_IDENTICAL = YES
```

SHA-256 sobre el bloque delimitado por los marcadores `:start`/`:end`,
normalizado a LF (136 líneas, 6015 B). El archivo completo conserva CRLF puro
(356/356 líneas).

## 7. Cero migración de consumidores

| Invariante | Estado |
|---|---|
| DOM / JSX / rutas / API / auth diff | 0 |
| Consumidores de los 73 tokens nuevos | 0 |
| Sombras convertidas | 0 |
| `globals.css`, `index.css`, `theme.ts`, `theme-init.js`, `surfaces.css` | sin cambios |
| Reglas `data-theme` nuevas fuera de `tokens.css` | 0 |

`index.css` no cambia: `@import "./tokens.css"` ya era el primer módulo.

## 8. Contrato ejecutable

`test/architecture/dashboard-foundation-tokens.test.ts` — 16 tests, descubre los
tokens desde el CSS real y compara contra un esquema normativo **en ambas
direcciones** (un rol que falta falla; un extra no declarado también).

| # | Test |
|---|---|
| T1/T2 | Las ocho categorías existen y superan su cardinalidad mínima |
| T5 | El conjunto físico es exactamente el normativo; sin duplicados por scope |
| — | Los prefijos de categoría particionan el namespace |
| T10 | El scope oscuro coincide con el mecanismo real, derivado de `theme.ts`; sin segundo mecanismo de tema |
| T3 | Cada VARIANT existe en ambos temas **con valores distintos** |
| — | El scope oscuro contiene exactamente los VARIANT y nada más |
| — | Cada ADAPTIVE resuelve a un token que `globals.css` reescribe en oscuro |
| T4 | Ningún INVARIANT está en el scope oscuro ni resuelve a un token que el oscuro reescriba |
| T6 | Toda regla del foundation está scoped a `.dashboard-app-shell`; ningún token se declara fuera de `tokens.css` |
| T8 | Cero consumidores en `frontend/src`; el foundation no referencia tokens de runtime |
| T7 | El contrato de row-pitch sigue con literales px parseables y por detrás del foundation |
| T9 | Los 4 tokens de capacidad conservan un único owner |
| — | Density no declara altura de fila |
| R11 | Ningún token de motion nombra o transporta una altura |

## 9. Controles de mutación

Sobre copia aislada en scratchpad; **el source trackeado nunca se muta**.

| # | Mutación | Resultado | Detectada por |
|---|---|---|---|
| M1 | Eliminar token temático claro (`--dash-color-field`) | FAIL | conjunto físico ≠ normativo |
| M2 | Eliminar su contraparte oscura | FAIL | VARIANT en ambos temas |
| M3 | Duplicar un token en el mismo scope | FAIL | duplicado en scope |
| M4 | Eliminar la categoría motion completa | FAIL | ocho escalas |
| M5 | `--dash-row-pitch-regular: 44px` → `2.5rem` | FAIL | pitch parseable |
| M6 | Segundo `--dash-row-pitch` fuera del bloque owner | FAIL | conjunto físico **y** owner único de capacidad |
| M7 | Consumir `--dash-shape-md` desde `surfaces.css` | FAIL | cero consumidores |
| — | Baseline restaurada | PASS | — |

## 10. Fuera de alcance

- **B04**: migrar superficies a estos tokens, eliminar la sombra del chrome
  persistente, tocar `shell/layout/surfaces/interactions/tables/navigation/`
  `responsive/zero-scroll/mobile-*` o `globals.css`.
- **B05**: invertir la relación de superficie (tinte al campo, contenedor
  transparente). `--dash-color-field` queda **declarado**, no aplicado.
- Cambios de DOM, JSX, rutas, API, auth, sesiones, dependencias, CI.
- Rebaseline visual A02/A03/A08: B03 no produce diferencia visual observable.

## 11. Rollback

Revert del commit. Restaura los valores CSS previos; como ningún consumidor
adoptó los tokens, el riesgo residual es **nulo** (§61 del roadmap).

## 12. Riesgos residuales

1. **Deriva de provenance.** Los ADAPTIVE resuelven a tokens de `globals.css`.
   Si esa paleta se retunea, el dashboard sigue el cambio — que es lo deseado —
   pero un rol retirado de `globals.css` rompería el contrato antes que el
   runtime. Mitigado: el contrato falla cerrado ante esa retirada.
2. **Alphas oscuras derivadas.** Los cuatro valores de state-layer oscuros son
   una derivación ×1.6 documentada, no una medición. Se validarán
   perceptualmente cuando B04 los aplique, bajo regresión visual dual.
3. **Desviación THEME_ADAPTIVE.** Documentada en §4; requiere confirmación de
   Nico. Si se exige duplicación textual estricta, el cambio es mecánico: mover
   los 18 ADAPTIVE al scope oscuro y relajar la aserción de «valores distintos».
4. **Tamaño del foundation.** 73 tokens. Cada uno tiene provenance y rol para
   B04–B06, pero cualquiera que B04 no consuma debe retirarse, no heredarse.
