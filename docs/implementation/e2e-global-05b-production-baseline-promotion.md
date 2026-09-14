# E2E-GLOBAL-05B — Promoción de baselines visuales productivos y `e2e:full` bajo `next start`

Fase `E2E-GLOBAL-05B` del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md`). Continúa
`E2E-GLOBAL-05A` ([acta](e2e-global-05a-visual-production-candidate.md)) y aplica la decisión
del [E2E visual production candidate RFC](../architecture/e2e-visual-production-candidate-rfc.md):
05B decide únicamente desde evidencia `ubuntu-latest`.

## Estado base

| Ítem | Valor |
|---|---|
| Rama base | `main` |
| HEAD base | `4bf75a55bb4b8a815e06de74e2cd07dc708c49ef` (`test(e2e): retain first-failure traces safely (#1720)`) |
| Relación con `origin/main` | `0 0` al crear la rama |
| Rama de trabajo | `test/e2e-global-05b-production-baseline-promotion` |
| Clasificación | R1 (baselines, tests, docs) + R2 (`.github/workflows/e2e-completeness.yml`) |
| Scopes primarios detectados | `frontend` (PNG bajo `frontend/e2e/**`) + `workflows/CI` → excepción mixed-scope (ver abajo) |

## Scope incluido

- A. Reemplazo byte-exacto de los 40 PNG `*-chromium-linux.png` por los candidatos productivos aprobados.
- B. `e2e-completeness.yml`: el paso `e2e:full` ejecuta con `VETNEB_E2E_PRODUCTION_RUNNER=1` (`next start`).
- Realineación de guards directamente afectados: `e2e-completeness-workflow.test.ts` (contrato invertido y
  semántico) y digest canónico en `workflow-security-policy-contract.test.ts`.
- Esta acta (§11/§17).

## Scope excluido

- `frontend/src/**`, `server/**`, auth, cookies/sesión, DB, manifiestos, lockfile, dependencias.
- `frontend/playwright.config.ts` (read-only: la selección `CI=true` + flag ya existía), specs, fixtures,
  `frontend/e2e/suites/catalog.ts`, `e2e:ci`, `frontend-ci.yml`, `visual-regression-manual.yml`.
- Timeouts, workers y retries de `e2e:full` (sin cambios).
- `E2E-GLOBAL-06` en adelante.

## Evidencia canónica

| Campo | Valor |
|---|---|
| Workflow | `.github/workflows/visual-regression-manual.yml` |
| Run | [34797865479](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/34797865479), attempt `1` |
| Evento / inputs | `workflow_dispatch`, `suite=all`, `runner=production-candidate`, `update_snapshots=false`, `upload_artifacts=true` (run-name) |
| Head SHA | `4bf75a55bb4b8a815e06de74e2cd07dc708c49ef` (= base; posterior a #1719/#1720) |
| Runner | `ubuntu-latest` (GitHub-hosted Linux) |
| `created_at` / `completed_at` | `2026-09-14T02:02:30Z` / `2026-09-14T02:04:17Z` (1 min 47 s) |
| Job | `103834366685` `visual-regression-all`, conclusion `failure` |
| Paso candidato | `02:03:10Z → 02:04:12Z` (62 s): build 23 s (`02:03:11 → 02:03:34`), Playwright `40 passed (33.4s)`, 2 workers, `next start --hostname 127.0.0.1` |
| Sanitizer | `PASSED kept=155 omitted=0` |
| Artifact | `10329739284` `visual-regression-all-production-candidate-1`, 40 937 259 B, `sha256:40d61387…602fe0` |
| Manifest | `schemaVersion 1`, `github-actions` / `github-hosted-linux`, `pnpm start --hostname 127.0.0.1`, `suite all`, `playwrightExit 0`, `teardownExit 0`, `exitCode 1`, `result.status different`, `approved false` |

### Clasificación del fallo

`COMPARISON_DIFFERENCE`. Candidato completo: build OK, 40/40 Playwright, teardown OK, integridad canónica OK,
comparación completa con `requireCountSatisfied=true`. El `exit 1` es el resultado documentado de
"candidato producido + diferencias de píxeles", no una falla de infraestructura.

### Sobre-redacción del sanitizer (artifact)

El sanitizer B4 redacta cadenas hexadecimales largas y nombres dentro de JSON/CSV: en el artifact quedaron
`[REDACTED]` el `headCommit` del manifest, sus `residualRisks`, los `sha256` y los nombres de archivo de
`comparison/*.{json,csv}`. Los PNG se conservan byte-exactos (sólo verificación de magic bytes). La ligadura al
commit se demostró por otras vías independientes:

1. `head_sha` del run en la API de GitHub = `4bf75a55…`.
2. `baseline-dev/**` = blobs git de `4bf75a55` en 40/40 (SHA-256).
3. La comparación se recomputó con `compare-visual-artifacts.mjs` sobre los PNG descargados y reproduce el
   reporte subido fila a fila (clasificación, dimensiones, conteo y bbox; 0 discrepancias).

Riesgo residual R-05B-1: el manifest subido no es autosuficiente respecto del commit.

## Inventario 40/40

| Fuente | public | authenticated | stress | Total |
|---|---|---|---|---|
| `git ls-files frontend/e2e/**/*-chromium-linux.png` @ `4bf75a55` | 10 | 20 | 10 | 40 |
| `baseline-dev/**` | 10 | 20 | 10 | 40 |
| `candidate-prod/**` | 10 | 20 | 10 | 40 |
| `comparison` (`matchedPathCount`) | — | — | — | 40 (0 faltantes por lado) |

Listas de rutas relativas idénticas en las tres fuentes de archivos.

## Investigación causal

- **Indicador de desarrollo.** 40/40 difieren en un bloque 75×59 inferior izquierdo (3 710 px; 1 795 px en
  `public-home-320`, donde el hero lo cubre parcialmente). El baseline contiene el botón "N" de Next.js dev;
  el candidato muestra el fondo. Supera la tolerancia de los tres specs (`maxDiffPixelRatio: 0.001`: 230 px
  en 320×720 … 2 073 px en 1920×1080), así que los baselines dev no pueden pasar bajo `next start`.
- **`public-home-*` (137 275–525 933 px fuera del indicador, Δ canal ≤ 22).** Confinado al `<Image>` del hero
  (`/images/hero-microscope-vetneb.webp`, `fill`, `sizes="100vw"`). Texto, header y resto del layout son
  pixel-idénticos, por lo que se descarta fuente/entorno. Prueba de mecanismo local (mismo checkout):
  `next dev` y `next start` emiten el mismo markup, `srcset` y formato `image/avif`, pero `/_next/image`
  entrega bytes distintos (w=1080: 12 934 B dev vs 13 102 B prod; w=1200, w=2048 igual). Determinismo
  productivo en `ubuntu-latest`: los 5 PNG son byte-idénticos al candidato del run
  [34563842239](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/34563842239) (`05657c68`, no usado
  para promover). Bajo dev reproducen el baseline dentro de tolerancia (`E2E Completeness`
  [34783510988](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/34783510988): `1333 passed`). La
  hipótesis WSL de 05A (entorno/fuentes) queda **refutada**: es una diferencia sistemática dev↔prod del
  optimizador de imágenes. → `EXPECTED_PRODUCTION_RENDERING`.
- **Residuo antialiasing (11 PNG admin/stress/login-768).** 4–30 px con Δ ≤ 2 en bordes de esquinas
  redondeadas y en una línea de `public-login-768`. Muy por debajo de la tolerancia.
- **Jitter productivo.** Entre los dos candidatos prod, sólo 5 PNG variaron: `public-login-{320,768,1024}`
  (30–61 px, Δ ≤ 2) y `stress-dashboard-{768,1920}` (9–15 px, Δ ≤ 23). Todo dentro de la tolerancia.

Ningún PNG quedó clasificado `REAL_LAYOUT_REGRESSION`, `FONT_ENVIRONMENT_DIFFERENCE` ni `UNEXPLAINED`.
Ningún PNG es `IDENTICAL`.

## Matriz dev-vs-prod

`base` = baseline tracked @ `4bf75a55` (dev). `cand` = candidato prod del run 34797865479 = baseline
promovido. Rutas bajo `frontend/e2e/regression/visual/visual-regression-<suite>.spec.ts-snapshots/<name>-chromium-linux.png`.

| # | Suite/nombre | SHA-256 base | SHA-256 cand | Dimensiones | Comparador | Píxeles | % | Bbox | Clasificación | Causa | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `authenticated/admin-dashboard-1024` | `4221519f49b5c71265f948812c00702d5e691668fad0e7e4283a87b2ff7f51bc` | `3b3d624df42dcc57d6513a8848d3bf0ac00f9ce8cce941c081a8009807ce07a9` | 1024×768 | pixel-different | 3710 | 0.4718% | [1,709]-[74,767] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 2 | `authenticated/admin-dashboard-1536` | `d59dd21f1eec67449d2a4c542944214b1b0720b08ad1351b4bb4f9d99faa3894` | `d64da8befdf1de89395c8fdf286b5b3cc94533253ba5871ebcf96bcc425d72c1` | 1536×960 | pixel-different | 3714 | 0.2519% | [1,901]-[1527,959] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 4 px Δ≤1 [1511,935,1527,950] | PROMOVER |
| 3 | `authenticated/admin-dashboard-1920` | `16fd8d8954fe5c40a2de838342aebbf54a77f9092b542047c9816efcd726d0a2` | `06abca54f3a60cd53436a9f96fd522bc0f527321c5d3277032c26fd032f36778` | 1920×1080 | pixel-different | 3715 | 0.1792% | [1,1021]-[1911,1079] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 5 px Δ≤1 [1895,1055,1911,1070] | PROMOVER |
| 4 | `authenticated/admin-dashboard-320` | `2ded26306e4a24d3d66336c35465eb339231ba86d269a89537281b6bf56a9a74` | `3d4d9ad36ae053b1a02619819a6bc89df9526043a20b4636d123566b3a03c162` | 320×720 | pixel-different | 3710 | 1.6102% | [1,661]-[74,719] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 5 | `authenticated/admin-dashboard-768` | `e03e6dcca5e60e4f9bb273fe63860dae84a0f7c96deb67092e910484015c4a6a` | `02ff2ea6c69de19784b8eb0149b2f094fcca5d987f13abdb6b410c18298e2307` | 768×1024 | pixel-different | 3719 | 0.4729% | [1,23]-[763,1023] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 9 px Δ≤1 [758,23,763,38] | PROMOVER |
| 6 | `authenticated/admin-dashboard-dark-gray-1024` | `2b5014ca775903dd5146b2611d4cca193dedf26d44bee171686adc57c889db5d` | `0e25e145ae80fa805f4bd0412f2d6b5c6649d5fa2c4c974e70db9ab384cc84ef` | 1024×768 | pixel-different | 3719 | 0.4729% | [1,10]-[1015,767] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 9 px Δ≤1 [999,10,1015,759] | PROMOVER |
| 7 | `authenticated/admin-dashboard-dark-gray-1536` | `57f44a7e3aeaa71f0c60157b4de4b38d3b70c6402c478a52609529b2b207a43c` | `b762cf3797129eaf92d7d0cd8c2c5b31b7d202a90cf8754400043da83bc9d524` | 1536×960 | pixel-different | 3716 | 0.252% | [1,901]-[1527,959] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 6 px Δ≤1 [1511,935,1527,951] | PROMOVER |
| 8 | `authenticated/admin-dashboard-dark-gray-1920` | `8f18a6bc397471dfa3ac5cdcdad7daca71d54c20f8491bb6497ad9e20ba4efd9` | `de756ceb43d8cd5750893be030303f2bb1a4464d4e5d388ec2ca3d26bd05eec6` | 1920×1080 | pixel-different | 3716 | 0.1792% | [1,1021]-[1911,1079] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 6 px Δ≤1 [1895,1055,1911,1071] | PROMOVER |
| 9 | `authenticated/admin-dashboard-dark-gray-320` | `3efe283fe6660e74450fe6767a17e0f271f4ceea106dcd8410902bf57283c23e` | `39a39dac6da036ee6d72215d6fc97bda4997c85b3fb1d2050afa553c3e07e37c` | 320×720 | pixel-different | 3710 | 1.6102% | [1,661]-[74,719] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 10 | `authenticated/admin-dashboard-dark-gray-768` | `5d3b78b1f3b864a80e9b0077691fdf7d1f272c72ac63e8a85bfc049b517d41be` | `2abb7a3e8e1a7443cddf495a8a8da937cc0a61616ddd9ef5b8e524f3ff75163d` | 768×1024 | pixel-different | 3710 | 0.4718% | [1,965]-[74,1023] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 11 | `authenticated/dashboard-1024` | `047d47446f15570578ddc5777bd16858c225cf92bf84deaef45b02065a657f0b` | `9922c71526c54199e0d3bdff6010422957b8ceb3db62b14aa86c5580316357df` | 1024×768 | pixel-different | 3710 | 0.4718% | [1,709]-[74,767] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 12 | `authenticated/dashboard-1536` | `424ea37ce76b97ac6944dea0c14427d9d91b2d79dd988dd1be97c63d2fa685bb` | `50a63d4f359f8866a19435ed928000f69be59b70b01e48ee599a68e10ad4c370` | 1536×960 | pixel-different | 3710 | 0.2516% | [1,901]-[74,959] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 13 | `authenticated/dashboard-1920` | `90324360be82332f9faed6663d2880050d380cae0eb6ca24429bd173f83264ba` | `4ac0497e52d0adc2493bc4fc05c3616e83791185e8e445134fda7420e4ba487a` | 1920×1080 | pixel-different | 3710 | 0.1789% | [1,1021]-[74,1079] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 14 | `authenticated/dashboard-320` | `038e5e365e05be5402dfdb344011938d38c947fc202f2974319f799805d94fc8` | `aead2144b05bbb6704488067725acf49230ca13d4dc69fe310a42bd47a75bba6` | 320×720 | pixel-different | 3710 | 1.6102% | [1,661]-[74,719] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 15 | `authenticated/dashboard-768` | `c6e3a57de0640330ca9ad92abf5e6f3bb8a95c4bd28cc8c435fc084cedc3a0e8` | `0df648e26cc7529651dc7d1d693bcccf6aa31e5b45bab53789f9b982c3bc3c2f` | 768×1024 | pixel-different | 3710 | 0.4718% | [1,965]-[74,1023] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 16 | `authenticated/dashboard-dark-gray-1024` | `5135e6bf76514df273552d3dd8f8fa9751e03f36c918669523be4ff1348980b1` | `e70ded3b44c87cfb8d19ea62242517aeadadea70b62eb75cd0e2fa3395b43ce7` | 1024×768 | pixel-different | 3710 | 0.4718% | [1,709]-[74,767] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 17 | `authenticated/dashboard-dark-gray-1536` | `d9882dda9a0bf099b2a352faddc77ecf36f3dbb928a6a7fd636b57b33ab298ac` | `ae521e1db68bd77180b9de8ebe298cea5e6ef97bb5ab0855cfb722b66a1af61c` | 1536×960 | pixel-different | 3710 | 0.2516% | [1,901]-[74,959] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 18 | `authenticated/dashboard-dark-gray-1920` | `13120372ee7aa647e680c09819c98b89d6844fa8cd9ea3b345b5dd4da955f7fd` | `082a0f19622709e696f94827b67f129031e138edc1a139bda225128e4c5ed783` | 1920×1080 | pixel-different | 3710 | 0.1789% | [1,1021]-[74,1079] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 19 | `authenticated/dashboard-dark-gray-320` | `6424e08ccfc81a8d853267b6525874ac2fd05ae24f65c7add9e73624d2c3f432` | `d8abf9b4803130ff4d470e68d6ca4328e3f50459c94b855ed44fda2b2960eb96` | 320×720 | pixel-different | 3710 | 1.6102% | [1,661]-[74,719] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 20 | `authenticated/dashboard-dark-gray-768` | `6772309fbf681f9a0aea880fbdd859e0dab5b961a0165896a64a455986dcbbd6` | `c1b9682f25383c8f531988e98308d19aed45ac7df18b5f72e3c6e427a9140ae0` | 768×1024 | pixel-different | 3710 | 0.4718% | [1,965]-[74,1023] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 21 | `public/public-home-1024` | `1c89459e07afe5c0fe7328908e9bc5b1c7993f276a91ef67b2f04db34c5cc2f2` | `aaf236b0a9de7248bac244c40da3f97414262ca178ab141585d81a6d7171ae38` | 1024×768 | pixel-different | 302632 | 38.4816% | [0,65]-[1023,767] | EXPECTED_PRODUCTION_RENDERING | indicador dev (3710 px) + foto del hero `next/image` (298922 px, Δmáx 22, y≥65) | PROMOVER |
| 22 | `public/public-home-1536` | `e8c534499236a76cf110d8ad4d13ac8e83d6a1528f115d765efa4c241c1eb9cb` | `76705df9b8d6133cc6a5623ad505b4bbab6ef081194030d3b73ce00ab4af5a5d` | 1536×960 | pixel-different | 412913 | 28.0025% | [0,65]-[1535,959] | EXPECTED_PRODUCTION_RENDERING | indicador dev (3710 px) + foto del hero `next/image` (409203 px, Δmáx 14, y≥65) | PROMOVER |
| 23 | `public/public-home-1920` | `d89b489846fa89232fb70ee22851f742749b92fbc98a22788fba492e21d5f012` | `bbd6a2aeb3c881ba20e6483238f78c7438224bb275c9d3471360a485e2215fde` | 1920×1080 | pixel-different | 529643 | 25.5422% | [0,65]-[1919,1079] | EXPECTED_PRODUCTION_RENDERING | indicador dev (3710 px) + foto del hero `next/image` (525933 px, Δmáx 16, y≥65) | PROMOVER |
| 24 | `public/public-home-320` | `254e83752d23ecb8c59b75a43a3a115162e059d28287b8c97bb2fb8660302e31` | `04ac29347e9bf6b944905d729d415101ab0c898b65c04a8d826b7a8963c61c18` | 320×720 | pixel-different | 139070 | 60.3602% | [0,65]-[319,719] | EXPECTED_PRODUCTION_RENDERING | indicador dev (1795 px) + foto del hero `next/image` (137275 px, Δmáx 20, y≥65) | PROMOVER |
| 25 | `public/public-home-768` | `b94bc8557d7f6965277d8a473e5865d67aa88e77e26f498a856ae11dc3c61f3d` | `f9a0c7c998927efd195d3a0574afa90af30ea37da5bd152a07e2f7d608a0dc8b` | 768×1024 | pixel-different | 228702 | 29.081% | [0,65]-[767,1023] | EXPECTED_PRODUCTION_RENDERING | indicador dev (3710 px) + foto del hero `next/image` (224992 px, Δmáx 18, y≥65) | PROMOVER |
| 26 | `public/public-login-1024` | `6f03d0bc3d98f98da9fdac94add822341d50077e1c57692d0a144704bb1b9e0e` | `b2f6fc4e129de8a42bc8f1d4c1a555ea8accd674614efc4f9e5ba2e77ae98113` | 1024×768 | pixel-different | 3710 | 0.4718% | [1,709]-[74,767] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px); varía ≤61 px entre corridas prod | PROMOVER |
| 27 | `public/public-login-1536` | `5d796818daf6250e9cac8ea92792e6c934c736f9c215636d95eed68fe9115bf6` | `582dd257b6e87002261f724c6dd2d8e7849e8d59c6a5304eb0cdca3913d79f86` | 1536×960 | pixel-different | 3710 | 0.2516% | [1,901]-[74,959] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 28 | `public/public-login-1920` | `d7940cb3668fffc2a8dea65347227da7f27b8023d686706e16db0848c1e8310e` | `3ce43dcf93100935a335f65a5a9351fdadd7f678adb4b128f393c1c7c992da41` | 1920×1080 | pixel-different | 3710 | 0.1789% | [1,1021]-[74,1079] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 29 | `public/public-login-320` | `09c1eb12f3d495f1466ff304f55c25f5753319027a63b501f64a29dc83410c5c` | `9a7c150695a11491f6b121e7ccc89420020c408941c015ce2b4e9b246b49f611` | 320×720 | pixel-different | 3710 | 1.6102% | [1,661]-[74,719] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px); varía ≤61 px entre corridas prod | PROMOVER |
| 30 | `public/public-login-768` | `16814ac7d8872838f985a53b541fa109f4c41997c62129040f2e0ed908995778` | `da1e8740e347cab41bc11729171e49f5d5bc0c6a4365375975a6f7bac77484f4` | 768×1024 | pixel-different | 3740 | 0.4756% | [1,522]-[582,1023] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 30 px Δ≤2 [185,522,582,529]; varía ≤61 px entre corridas prod | PROMOVER |
| 31 | `stress/stress-admin-dashboard-1024` | `a7e66821a1faf13c8fd489db0e9ab59d0f1b5ad56a2ef365c60f2dfee7885330` | `3b3d624df42dcc57d6513a8848d3bf0ac00f9ce8cce941c081a8009807ce07a9` | 1024×768 | pixel-different | 3718 | 0.4728% | [1,7]-[1023,767] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 8 px Δ≤1 [999,7,1023,758] | PROMOVER |
| 32 | `stress/stress-admin-dashboard-1536` | `d59dd21f1eec67449d2a4c542944214b1b0720b08ad1351b4bb4f9d99faa3894` | `d64da8befdf1de89395c8fdf286b5b3cc94533253ba5871ebcf96bcc425d72c1` | 1536×960 | pixel-different | 3714 | 0.2519% | [1,901]-[1527,959] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 4 px Δ≤1 [1511,935,1527,950] | PROMOVER |
| 33 | `stress/stress-admin-dashboard-1920` | `3307276e55a0e248b8dd670acfb30ba0e2ec585cd1e9a3f4d8c3aa7161c6a0d3` | `06abca54f3a60cd53436a9f96fd522bc0f527321c5d3277032c26fd032f36778` | 1920×1080 | pixel-different | 3710 | 0.1789% | [1,1021]-[74,1079] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 34 | `stress/stress-admin-dashboard-320` | `2ded26306e4a24d3d66336c35465eb339231ba86d269a89537281b6bf56a9a74` | `3d4d9ad36ae053b1a02619819a6bc89df9526043a20b4636d123566b3a03c162` | 320×720 | pixel-different | 3710 | 1.6102% | [1,661]-[74,719] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 35 | `stress/stress-admin-dashboard-768` | `4b496473ab7419b6acf2cdf1808359b2c29d69d60a520ba3dcc19d0a609f7c2b` | `02ff2ea6c69de19784b8eb0149b2f094fcca5d987f13abdb6b410c18298e2307` | 768×1024 | pixel-different | 3724 | 0.4735% | [1,23]-[763,1023] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) + AA 14 px Δ≤1 [743,23,763,1014] | PROMOVER |
| 36 | `stress/stress-dashboard-1024` | `047d47446f15570578ddc5777bd16858c225cf92bf84deaef45b02065a657f0b` | `9922c71526c54199e0d3bdff6010422957b8ceb3db62b14aa86c5580316357df` | 1024×768 | pixel-different | 3710 | 0.4718% | [1,709]-[74,767] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 37 | `stress/stress-dashboard-1536` | `424ea37ce76b97ac6944dea0c14427d9d91b2d79dd988dd1be97c63d2fa685bb` | `50a63d4f359f8866a19435ed928000f69be59b70b01e48ee599a68e10ad4c370` | 1536×960 | pixel-different | 3710 | 0.2516% | [1,901]-[74,959] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 38 | `stress/stress-dashboard-1920` | `90324360be82332f9faed6663d2880050d380cae0eb6ca24429bd173f83264ba` | `4ac0497e52d0adc2493bc4fc05c3616e83791185e8e445134fda7420e4ba487a` | 1920×1080 | pixel-different | 3710 | 0.1789% | [1,1021]-[74,1079] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px); varía ≤61 px entre corridas prod | PROMOVER |
| 39 | `stress/stress-dashboard-320` | `038e5e365e05be5402dfdb344011938d38c947fc202f2974319f799805d94fc8` | `aead2144b05bbb6704488067725acf49230ca13d4dc69fe310a42bd47a75bba6` | 320×720 | pixel-different | 3710 | 1.6102% | [1,661]-[74,719] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px) | PROMOVER |
| 40 | `stress/stress-dashboard-768` | `c6e3a57de0640330ca9ad92abf5e6f3bb8a95c4bd28cc8c435fc084cedc3a0e8` | `0df648e26cc7529651dc7d1d693bcccf6aa31e5b45bab53789f9b982c3bc3c2f` | 768×1024 | pixel-different | 3710 | 0.4718% | [1,965]-[74,1023] | EXPECTED_DEV_CHROME_REMOVAL | indicador dev (3710 px); varía ≤61 px entre corridas prod | PROMOVER |

## Promoción

- Método: copia byte-exacta de `candidate-prod/<ruta>` a `frontend/e2e/<ruta>`. Sin `--update-snapshots`,
  sin reencoding.
- Verificación posterior: SHA-256 tracked = SHA-256 candidato en 40/40.
- Exclusiones: ninguna (0 `IDENTICAL`, 0 no aprobados).

## `e2e:full` bajo production runner

- Único cambio de workflow: `VETNEB_E2E_PRODUCTION_RUNNER: "1"` en el `env` del paso
  `Run complete cataloged E2E suite`. El job ya construía el bundle (`Build frontend`, mismo env de build que
  `Frontend CI` y el candidato) antes de ese paso. GitHub fija `CI=true` en sus runners y
  `playwright.config.ts` selecciona `pnpm start --hostname 127.0.0.1`.
- Contrato nuevo (`e2e-completeness-workflow.test.ts`): parsea el workflow, exige build previo, el flag sólo
  en el paso full (una única aparición), carga `playwright.config.ts` con el env real del paso y exige
  `next start` + excepciones herméticas. Pruebas negativas embebidas: sin flag, valor `"true"`, flag movido al
  build y build retirado → FAIL.
- Mutation proof sobre el archivo real: flag retirado → 3 tests FAIL; restaurado (byte-idéntico) → 9/9 PASS.
- Digest canónico `e2e-completeness.yml`: `9f86a595…682021` → `fcd32d73…922494`.
- Efecto colateral declarado: bajo production runner `trace` pasa de `on-first-retry` a `retain-on-failure`
  (config existente). Las subidas siguen detrás del sanitizer (`failure()`).

## Justificación mixed-scope

A (baselines productivos) y B (runner productivo en `e2e:full`) no pueden activarse por separado sin dejar
`E2E Completeness` deliberadamente rojo. A solo quita el indicador de los baselines y `e2e:full` bajo dev
fallaría los 40 tests visuales (3 710 px > tolerancia). B solo sirve `next start` contra baselines con
indicador y fallaría los mismos 40. Frontera de acoplamiento: la cohorte `visual-linux`, que sólo ejecuta
`e2e:full`; `e2e:ci` no la contiene. Rollback único: revertir el commit completo (40 PNG + flag + guards).

## Presupuesto

Baseline previo (dev, `E2E Completeness` 34783510988, head `59822cc2` de #1720): paso full
`01:06:11Z → 01:49:04Z` (42 min 53 s), `1333 passed`, `1 skipped`, 0 failed, 0 flaky, `--workers=2 --retries=2`.
El ahorro esperado (~30 → ~18,3 min para `ci` según roadmap) **no está demostrado**. Se mide con el
`E2E Completeness` del head de la PR; ver sección de checks de la PR.

## Validaciones

| Gate | Estado |
|---|---|
| Comparador 40/40 (recomputado localmente sobre el artifact) | PASSED: 40 matched, 0 discrepancias con el reporte subido |
| Verificación de hash post-promoción | PASSED: 40/40 |
| `e2e-completeness-workflow.test.ts` | PASSED: 9/9 |
| Mutation proof del flag | PASSED: FAIL con mutación, PASS restaurado |
| Guards dirigidos (completeness, candidate-contract, policy, validator-contract, frontend-ci, production-runner, sanitizer, catálogo) | PASSED: 123/123 |
| `node scripts/governance/workflow-security-validator.mjs` | PASSED |
| Otros gates | ver descripción de la PR |

## Riesgos residuales

- R-05B-1: el sanitizer sobre-redacta el manifest y el reporte de comparación del artifact (commit,
  hashes, nombres). La evidencia depende de la API del run y del recomputado. Fuera de scope.
- R-05B-2: el jitter productivo (≤ 61 px) queda dentro de la tolerancia, pero depende del
  `maxDiffPixelRatio: 0.001` vigente.
- R-05B-3: los baselines quedan acoplados al optimizador de imágenes de `next start`. Un bump de Next/sharp
  puede exigir una nueva promoción desde un candidato canónico.
- R-05B-4: el `retain-on-failure` bajo production runner graba trazas de todos los tests del full. El
  impacto en el presupuesto de 45 min se mide en CI.
- R-05B-5: el camino `runner=dev` de `visual-regression-manual.yml` compara ahora contra baselines
  productivos y fallará si se usa. Debe usarse `runner=production-candidate`. Gobierno pendiente de
  `E2E-GLOBAL-10`.
- R-05B-6: los comentarios de `frontend/playwright.config.ts` y de
  `frontend-playwright-production-runner.test.ts` siguen describiendo a Frontend CI como único consumidor
  del flag (drift documental, config read-only en esta fase).
- Rama local previa `test/e2e-global-05b-production-baselines` (`8b67f72f`, base `05657c68`, sin push):
  intento anterior, preservado y no usado.

## Rollback

Revertir el commit de esta PR restaura los 40 baselines dev, el `e2e:full` bajo `next dev`, el contrato de
ausencia del flag y el digest `9f86a595…682021`.

## Estado final

Baselines productivos promovidos desde evidencia canónica `ubuntu-latest` y `e2e:full` configurado con
production runner. El cierre depende de que `E2E Completeness` quede PASSED sobre el head exacto de la PR.
