# Visual determinism comparator

Fecha: 2026-07-17

Herramienta nativa Node.js para comparar de forma **exacta** dos directorios ya
extraídos de artifacts PNG. Distingue con cero tolerancias la identidad binaria
del archivo de la identidad visual exacta (buffer RGBA decodificado), y clasifica
cada archivo de manera inequívoca.

Este documento es autocontenido. No reescribe
`e2e-org-6-regression-domain-organization.md` (ver §"Hallazgo A/B" para la
relación entre ambos).

## Estado base

- Rama: `tooling/visual-determinism-comparator`.
- HEAD base: `f9437338aec980c79db11078390a7d456762b497` (`origin/main`).
- Gestor: `pnpm@11.13.0`. Node 24.
- Sin cambios de runtime, workflows, Playwright config ni specs visuales.

## Problema que resuelve

Los snapshots visuales del repo son PNG generados por Chromium en Linux. Al
regenerarlos (por ejemplo entre dos ejecuciones del workflow manual de regresión
visual), dos preguntas distintas se confunden con frecuencia:

1. ¿Los **archivos** son idénticos? (bytes / SHA-256)
2. ¿La **imagen renderizada** es idéntica? (dimensiones + píxeles RGBA)

Un mismo render puede producir dos PNG con bytes distintos (distinto nivel de
compresión, distinto tipo de color, distinta metadata) y sin embargo idéntica
imagen. A la inversa, dos PNG pueden compartir metadata y diferir en píxeles
reales. Ninguna de estas situaciones se resuelve mirando sólo el SHA-256.

Esta herramienta responde ambas preguntas por separado y de forma auditable, sin
comparación perceptual, sin thresholds y sin suavizado.

## Identidad binaria vs. identidad visual exacta

- **Identidad binaria**: los bytes del archivo `.png` son iguales
  (`Buffer.equals`, y por tanto SHA-256 igual). Es condición **suficiente** para
  igualdad visual, pero **no necesaria**.
- **Identidad visual exacta**: tras decodificar el PNG a su buffer RGBA de 8 bits
  (4 canales por píxel, alpha incluido), las dimensiones son iguales y el buffer
  RGBA es igual **byte por byte**. Es el contrato real de "misma imagen".

### Por qué SHA-256 no es suficiente

Un cambio de nivel de compresión deflate, de tipo de color (p. ej. truecolor con
alpha `colorType 6` vs. truecolor `colorType 2`), de orden de filtros por scanline
o de chunks auxiliares (gAMA, pHYs, tEXt, tiempos) cambia los bytes del archivo y,
con ello, el SHA-256 — **sin cambiar un solo píxel**. Rechazar por SHA-256
distinto marca como "regresión" renders idénticos y produce ruido y churn en los
baselines. SHA-256 responde "¿es el mismo archivo?", no "¿es la misma imagen?".

### Por qué la igualdad exacta de píxeles sí es suficiente

Para este contrato, "misma imagen" significa: mismas dimensiones y mismo buffer
RGBA decodificado. Si los cuatro canales (R, G, B, A) de cada píxel coinciden, el
render es idéntico a nivel de píxel, sin ambigüedad y sin tolerancia. No se
necesita comparación perceptual (SSIM, hashes perceptuales, `pixelmatch`): esas
técnicas introducen umbrales que **ocultan** diferencias reales. Aquí una sola
diferencia de un canal de un píxel es una diferencia, y se reporta con conteo
exacto y bounding box exacta.

## Arquitectura

Un único módulo ESM, `frontend/e2e/scripts/compare-visual-artifacts.mjs`, que:

- exporta funciones puras y testeables (comparación) y
- opera como CLI (capa de orquestación),

con separación estricta entre ambas capas. Sólo usa Node built-ins
(`node:crypto`, `node:fs`, `node:path`, `node:url`, `node:zlib` no se usa: la
decodificación la hace `pngjs`) más `pngjs` como único agregado.

Flujo:

1. **Parseo de argumentos** (`parseArgs`): sin dependencias externas. Soporta
   `--flag value` y `--flag=value`.
2. **Descubrimiento** (`discoverPngFiles`): recorrido recursivo determinista de
   cada raíz; sólo `.png`; paths relativos normalizados con `/`; preserva
   mayúsculas/minúsculas; orden lexicográfico; **rechaza symlinks** (no los
   sigue); sin dependencia del orden de `readdir` (se ordenan las entradas antes
   de descender y la lista final).
3. **Comparación por archivo** (`comparePngPair`): lee bytes, calcula SHA-256
   hex en minúsculas, compara bytes exactos, decodifica ambos con `pngjs`,
   compara dimensiones y compara el buffer RGBA completo byte a byte
   (`diffRgba`). Procesamiento **secuencial** para orden determinista y memoria
   acotada.
4. **Comparación de directorios** (`compareDirectories`): calcula el conjunto de
   paths de cada lado, detecta faltantes/adicionales, compara los emparejados y
   resume.
5. **Reportes** (`buildJsonReport`, `buildCsvReport`, `writeReports`) y **salida
   humana** (`formatHumanReport`).

La lógica de comparación no depende de `getBBox`, atajos por alpha ni heurísticas.
Un píxel cuenta como diferente cuando difiere **al menos uno** de R, G, B o A.

### Dependencia

`pngjs@^7` como **devDependency directa** del workspace `frontend`, agregada
exclusivamente con `pnpm --dir frontend add -D pngjs` (lockfile actualizado por
pnpm, sin edición manual). Import verificado en Node 24 tanto por nombre
(`import { PNG } from "pngjs"`) como por default. Es la única dependencia
agregada.

## CLI

Script en `frontend/package.json`:

```json
"e2e:compare-visual-artifacts": "node e2e/scripts/compare-visual-artifacts.mjs"
```

Interfaz:

```text
pnpm --dir frontend e2e:compare-visual-artifacts -- \
  --left <directorio> \
  --right <directorio> \
  [--require-count <entero>] \
  [--report-dir <directorio>] \
  [--debug]

pnpm --dir frontend e2e:compare-visual-artifacts -- --help
```

Semántica:

- `--left` y `--right` son obligatorios.
- Las rutas relativas se resuelven desde `process.cwd()` y se convierten a
  absolutas para validación interna. **Como el script corre con cwd `frontend`,
  usar rutas absolutas** para evitar ambigüedad.
- Ambos paths deben existir y ser directorios (si no, error de infraestructura).
- `--require-count` debe ser un entero no negativo; valida ambos lados de forma
  **independiente** (cada lado debe exponer exactamente esa cantidad de PNG).
- `--report-dir`, cuando se informa, se crea de forma segura y recibe los dos
  reportes. Sin `--report-dir` no se escribe ningún archivo.
- `--debug` imprime el stack crudo ante errores de infraestructura (por defecto,
  sólo mensaje útil).
- Nunca modifica `left` ni `right`. Sin acceso a red.

### Salida humana

Muestra left/right root, conteos por lado, matched paths, missing-left,
missing-right, dimension-identical, dimension-different, byte-identical,
byte-different, byte-different-pixel-identical, pixel-identical, pixel-different,
estado de `--require-count`, y un `RESULT: PASS|FAIL` con su exit code semántico.
El caso `byte-different-pixel-identical` se muestra **explícitamente** en una
sección propia de aceptación (encoding/metadata, no diff visual), nunca como
warning de fallo. Cada archivo no aprobado (faltante, dimension-different o
pixel-different) se lista con su clasificación y detalle (dimensiones o conteo +
bounding box).

## Clasificaciones

Cada archivo emparejado recibe exactamente una clasificación:

- `byte-identical` — bytes idénticos (implica pixel-identical).
- `byte-different-pixel-identical` — bytes distintos, dimensiones y RGBA
  idénticos.
- `dimension-different` — dimensiones decodificadas distintas.
- `pixel-different` — dimensiones idénticas, uno o más píxeles RGBA distintos.

Los no emparejados: `missing-left` (ausente en left) o `missing-right` (ausente
en right).

Un PNG corrupto **no** es una diferencia visual: produce error de
infraestructura y exit code 2.

## Exit codes

- `0` — comparación completada y contrato visual exacto **aprobado**: conjuntos
  de paths idénticos, `--require-count` satisfecho, dimensiones idénticas y todos
  los buffers RGBA idénticos. **Se permiten diferencias binarias PNG.**
- `1` — comparación completada, contrato **no** cumplido: faltantes/adicionales,
  count incorrecto, dimensiones diferentes, o uno o más píxeles diferentes.
- `2` — uso inválido o error de infraestructura: argumentos inválidos, directorio
  inexistente, archivo ilegible, symlink, PNG corrupto, fallo al crear/escribir
  reportes, o excepción interna inesperada.

El CLI usa `process.exitCode` (no `process.exit()`), de modo que stdout/stderr se
vacían antes de terminar.

## Schema JSON

Archivo `visual-artifact-comparison.json` (nombres estables, orden determinista,
newline final, sin ANSI, sin timestamps):

```json
{
  "schemaVersion": 1,
  "leftRoot": "…",
  "rightRoot": "…",
  "requiredCount": 30,
  "summary": {
    "leftCount": 30,
    "rightCount": 30,
    "matchedPathCount": 30,
    "missingLeftCount": 0,
    "missingRightCount": 0,
    "dimensionIdenticalCount": 30,
    "dimensionDifferentCount": 0,
    "byteIdenticalCount": 29,
    "byteDifferentCount": 1,
    "byteDifferentPixelIdenticalCount": 0,
    "pixelIdenticalCount": 29,
    "pixelDifferentCount": 1,
    "requireCountSatisfied": true,
    "passed": false
  },
  "missingLeft": [],
  "missingRight": [],
  "results": [
    {
      "path": "…/foo.png",
      "classification": "pixel-different",
      "byteIdentical": false,
      "leftSha256": "…",
      "rightSha256": "…",
      "leftWidth": 1536,
      "leftHeight": 960,
      "rightWidth": 1536,
      "rightHeight": 960,
      "dimensionsIdentical": true,
      "pixelIdentical": false,
      "diffPixelCount": 36,
      "diffBoundingBox": { "minX": 791, "minY": 405, "maxX": 1194, "maxY": 427 }
    }
  ]
}
```

`diffBoundingBox` es `null` cuando no hay diferencias de píxeles, o
`{ minX, minY, maxX, maxY }` inclusiva. Para `dimension-different`,
`diffPixelCount` y `diffBoundingBox` son `null` (no se comparan píxeles de
geometrías distintas).

## Columnas CSV

Archivo `visual-artifact-comparison.csv` (encabezado estable, orden por `path`,
escaping RFC-4180, `LF`, newline final, sin ANSI, sin locale). Incluye una fila
por path (emparejados + faltantes):

```text
path,classification,byteIdentical,leftSha256,rightSha256,leftWidth,leftHeight,
rightWidth,rightHeight,dimensionsIdentical,pixelIdentical,diffPixelCount,
diffMinX,diffMinY,diffMaxX,diffMaxY
```

Booleanos como `true`/`false`; celdas nulas vacías; paths con caracteres
especiales (p. ej. coma) se citan y las comillas internas se duplican.

## Seguridad e inmutabilidad

- **Inmutabilidad**: la herramienta sólo lee de `left`/`right`; nunca escribe,
  renombra ni regenera imágenes de entrada. Verificado por hashes antes/después.
- **Sin red**: no descarga artifacts ni hace peticiones. La descarga de artifacts
  es responsabilidad del operador (fuera de la herramienta), vía `gh run
  download`.
- **Symlinks**: se rechazan durante el descubrimiento y se revalidan por
  `lstat` antes de leer, para evitar comparaciones ambiguas o salidas del árbol.
- **Sin datos sensibles**: la salida sólo contiene paths relativos normalizados,
  dimensiones, SHA-256 de integridad de archivos (no de secretos) y conteos.
  Ningún path absoluto de Windows se filtra al campo `path` de los reportes.
- **Fail-closed**: cualquier condición ambigua o de entorno termina en exit 2.

## Limitaciones

- Compara sólo `.png` de 8 bits por canal (RGB/RGBA). PNG de 16 bits, indexados
  con transparencia no expandida o interlazados no forman parte de este contrato;
  si `pngjs` no devuelve exactamente `width*height*4` bytes RGBA, la herramienta
  falla con exit 2 en lugar de adivinar.
- No genera imagen diff (por diseño): reporta conteo y bounding box exactos.
- No es comparación perceptual: no absorbe diferencias de anti-aliasing ni de
  sub-píxel. Esto es intencional (ver §"Hallazgo A/B").
- La decodificación depende de `pngjs`; se cross-validó contra un decodificador
  PNG independiente (ver evidencia A/B).

## Comandos Windows PowerShell

```powershell
$root   = Join-Path $env:TEMP "visual-determinism-comparator"
$runA   = Join-Path $root "run-a"
$runB   = Join-Path $root "run-b"
$report = Join-Path $root "report"

# Limpiar sólo ese directorio temporal específico antes de recrearlo
if (Test-Path $root) { Remove-Item -Recurse -Force $root }
New-Item -ItemType Directory -Force -Path $runA, $runB | Out-Null

# Descargar artifacts SÓLO a %TEMP% (fuera del repo), con gh (no dentro del comparador)
gh run download 29603285727 -R LABVETNEB/PORTAL-VETNEB -n visual-regression-all-snapshots-1 -D $runA
gh run download 29605773076 -R LABVETNEB/PORTAL-VETNEB -n visual-regression-all-snapshots-1 -D $runB

# Ejecutar con rutas absolutas (cwd del script = frontend)
pnpm --dir C:\PORTAL-VETNEB\frontend e2e:compare-visual-artifacts -- `
  --left $runA --right $runB --require-count 30 --report-dir $report
```

## Evidencia sintética

`test/architecture/visual-artifact-comparator-contract.test.ts` fabrica todos los
PNG en directorios temporales (ningún binario versionado) y ejercita tanto las
funciones exportadas como el CLI real vía `spawnSync` (sin mockear el decodificador
principal). Cubre: byte-idénticos; mismos píxeles con distinta compresión
(comprobando primero que los SHA-256 difieren); un píxel distinto (conteo 1 +
bounding box de un píxel); varios píxeles separados (conteo y bounding box
exactos); dimensiones distintas; faltante en left; faltante en right;
`--require-count` no satisfecho (y validación por lado); directorio inexistente;
argumentos inválidos; PNG corrupto (mensaje útil, sin stack salvo `--debug`);
symlink (skip técnico condicionado en Windows sin privilegios); directorios
anidados (orden determinista, `/`); JSON (schemaVersion, resumen, clasificación,
newline, parseable, determinismo); CSV (encabezado estable, escaping, orden,
newline); ausencia de reportes sin `--report-dir`; inmutabilidad de inputs; y
`--help`. Resultado: **19 passed, 1 skipped** (symlink), 0 failed.

## Evidencia A/B real

Runs Chromium Linux de regeneración de baselines (E2E-ORG-6):

- RUN A: workflow run `29603285727`, artifact `visual-regression-all-snapshots-1`,
  artifact ID `8415870767` (confirmado por API).
- RUN B: workflow run `29605773076`, artifact `visual-regression-all-snapshots-1`,
  artifact ID `8416807417` (confirmado por API).

Descargados sólo a `%TEMP%` con `gh run download`. Comparación A vs B con
`--require-count 30 --report-dir`:

| Métrica | Resultado |
| --- | ---: |
| leftCount / rightCount | 30 / 30 |
| matchedPathCount | 30 |
| missingLeft / missingRight | 0 / 0 |
| dimensionIdenticalCount | 30 |
| byteIdenticalCount | 29 |
| byteDifferentCount | 1 |
| byteDifferentPixelIdenticalCount | **0** |
| pixelIdenticalCount | **29** |
| pixelDifferentCount | **1** |
| passed | **false** |
| exit code | **1** |

Único archivo con bytes diferentes:
`regression/visual/visual-regression-stress.spec.ts-snapshots/stress-dashboard-1536-chromium-linux.png`.

- SHA-256 A: `49f5f1ac771a2a8cf6386b43891f209bfde5d473ec053dd0f7db9df2e9226aba`
- SHA-256 B: `29c53403186bff3ddc1a3123880946c4399a744e9dfe22f3c5f43e3f80e10900`
- Ambos: `colorType 2`, 8 bits, no interlazado, 1536×960.
- Clasificación: **pixel-different**.
- `diffPixelCount`: **36**.
- `diffBoundingBox` (inclusiva): `minX: 791`, `minY: 405`, `maxX: 1194`,
  `maxY: 427`.
- Deltas por canal pequeños (±1 a ±7 en RGB), **alpha idéntico** en los 36
  píxeles, localizados en una banda fina de texto.

### Cross-validación con decodificador independiente

Para descartar un defecto de `pngjs`, se decodificó el archivo por dos vías:

1. `pngjs` (`PNG.sync.read`).
2. Un decodificador PNG independiente escrito desde cero (inflate `zlib` + unfilter
   de scanlines según el spec, sin `pngjs`).

Resultado: **ambos coinciden exactamente** — 36 píxeles distintos por las dos
vías, y el buffer RGBA de `pngjs` vs. el independiente difiere en **0 bytes** para
el archivo A. La diferencia de 36 píxeles es **real** (anti-aliasing / sub-píxel
no determinista entre dos corridas de CI), no un artefacto del decodificador ni
del comparador.

### Hallazgo A/B

El "determinism gate" previo (documentado en
`e2e-org-6-regression-domain-organization.md`) reportó A vs B como
`pixel-identical: 30/30`, tratando este archivo como "byte-different pero
pixel-identical". Una comparación RGBA **exacta**, cross-validada con un
decodificador independiente, demuestra que ese archivo **no** es pixel-identical:
tiene 36 píxeles genuinamente distintos entre RUN A y RUN B. El gate previo no fue
byte-exacto (absorbió sub-píxeles, comportamiento típico de una comparación con
tolerancia perceptual).

Por diseño y por contrato explícito ("cero tolerancias", "diferencias reales de
píxeles", "no modificar snapshots ni la herramienta para forzar un pase"), esta
herramienta **reporta la realidad** con exit 1 en lugar de ocultarla. Reproducir
el número `passed: true` esperado exigiría introducir una tolerancia, que es un
criterio de rechazo. Los snapshots versionados **no** se modificaron; RUN A y RUN
B **no** se modificaron.

Decisión de auditoría (Nico, 2026-07-17): se acepta el resultado exacto A/B (exit
1; 29 pixel-identical; 1 pixel-different; 36 píxeles; bbox
`[791,405]-[1194,427]`). La nueva comparación exacta, cross-validada con dos
decodificadores independientes, **prevalece como fuente de verdad** sobre la
evidencia previa. El resultado "obligatorio" 30/30 del brief se basaba en esa
evidencia previa incorrecta.

### Causa del falso negativo previo

El script de comparación temporal que produjo el "determinism gate" original **no
se versionó**, por lo que no es directamente re-ejecutable, y este entorno de
auditoría no tiene Python/Pillow disponible para reproducirlo. Por tanto la causa
se documenta **con cautela**, sin presentarla como hecho demostrado:

> El gate temporal, basado en Pillow/ImageChops, produjo un falso negativo. La
> causa técnica más probable es la interacción de `getbbox()` con el canal alpha
> nulo del diff RGBA: el comparador actual evita por completo esa clase de
> shortcut comparando los cuatro canales byte por byte.

Contexto técnico que respalda la hipótesis (esto sí es comportamiento
**documentado** de Pillow, no conjetura): desde Pillow 10.0.0, `Image.getbbox()`
recibe `alpha_only=True` por defecto; para una imagen con canal alpha, recorta la
caja según **sólo** el canal alpha (píxeles transparentes). Si dos PNG RGB se
normalizan a RGBA y se restan con `ImageChops.difference(...)`, el diff resultante
tiene el canal alpha en cero en todos los píxeles (los alpha de origen son
idénticos), de modo que `getbbox()` con el valor por defecto devolvería `None`
—"sin diferencias"— aunque el diff RGB no sea cero. Ese es exactamente el patrón
observado aquí: 36 píxeles con RGB distinto y alpha idéntico. No se pudo confirmar
que el script original usara ese camino específico; se registra como la causa
**más probable**, no probada.

> Nota: esto no invalida los baselines versionados. La regeneración importó los 18
> archivos aprobados desde RUN B, y RUN B coincide byte a byte con lo versionado
> (ver §"Evidencia RUN B vs tracked"). El hallazgo sólo demuestra que RUN A y RUN
> B no son idénticos a nivel de píxel para ese archivo, y que la herramienta lo
> detecta con exactitud.

## Evidencia RUN B vs tracked

Comparación de los baselines versionados (`frontend/e2e/regression/visual`, 30 PNG)
contra RUN B (`<run-b>/regression/visual`, 30 PNG), rutas absolutas,
`--require-count 30`:

| Métrica | Resultado |
| --- | ---: |
| leftCount / rightCount | 30 / 30 |
| matchedPathCount | 30 |
| dimensionIdenticalCount | 30 |
| byteIdenticalCount | 30 |
| pixelIdenticalCount | 30 |
| pixelDifferentCount | 0 |
| passed | true |
| exit code | **0** |

Confirma que los 30 baselines versionados son **byte-idénticos** a RUN B (el
origen aprobado) y valida el camino feliz de la herramienta sobre datos reales.
Es decir: los baselines versionados **siguen siendo reproducibles** respecto de su
artifact fuente aprobado (RUN B, artifact `8416807417`). El hallazgo A/B no altera
esta reproducibilidad; sólo invalida la afirmación histórica de que RUN A y RUN B
eran pixel-identical.

## Exclusiones (no-alcance)

No se tocó: runtime de frontend/backend, workflows de GitHub Actions, Playwright
config, specs visuales, snapshots versionados (no se regeneraron), `docs/audit`,
gobernanza. No se agregó ninguna dependencia salvo `pngjs`. No hay Python, Pillow,
ImageMagick, `pixelmatch`, SSIM, hashes perceptuales, thresholds, tolerancias,
suavizado, normalización de tamaño ni reescalado. No se ignora el canal alpha.

## Integración futura (no en este PR)

La herramienta **no** está integrada en CI y este PR no la integra. Una posible
integración futura, en un PR separado y con autorización R2 explícita, sería un
job manual/opt-in que:

1. descargue dos artifacts de snapshots con `gh run download` a un directorio
   temporal fuera del repo;
2. ejecute `pnpm --dir frontend e2e:compare-visual-artifacts -- --left … --right …
   --require-count 30 --report-dir …` con rutas absolutas;
3. suba el `report-dir` como artifact de auditoría y falle el job con el exit code
   del comparador (0/1/2).

Ese cambio tocaría workflows (R2) y queda **fuera** del alcance actual.

## Rollback

Local, sin `reset --hard`:

```powershell
git switch main
git branch -D tooling/visual-determinism-comparator   # descarta la rama local
```

Si hubiera cambios sin commitear que se quieran revertir selectivamente:

```powershell
git restore --staged --worktree `
  frontend/e2e/scripts/compare-visual-artifacts.mjs `
  test/architecture/visual-artifact-comparator-contract.test.ts `
  frontend/package.json pnpm-lock.yaml `
  docs/implementation/visual-determinism-comparator.md
pnpm --dir frontend remove pngjs
```

## Archivos

- `frontend/e2e/scripts/compare-visual-artifacts.mjs` (nuevo, comparador + CLI).
- `test/architecture/visual-artifact-comparator-contract.test.ts` (nuevo, contrato).
- `frontend/package.json` (devDependency `pngjs` + script `e2e:compare-visual-artifacts`).
- `pnpm-lock.yaml` (actualizado por pnpm).
- `docs/implementation/visual-determinism-comparator.md` (este documento).
