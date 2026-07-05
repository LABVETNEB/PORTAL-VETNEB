# Auditoría targeted zero-scroll E2E rescue

## Contexto
- Worktree: `C:\PORTAL-VETNEB-zero-scroll`.
- Rama: `fix/dashboard-zero-scroll-adaptive-density`.
- Objetivo: corregir únicamente fallos targeted zero-scroll E2E restantes.

## Hallazgos
- Informes mobile renderizaba el mismo canvas de detalle para panel desktop oculto y dialog mobile visible; el selector genérico del dock coincidía dos veces.
- Visitas mobile tenía textos con `truncate` pero la cadena de layout no evitaba `scrollWidth > clientWidth` en nodos `<p>`.
- Métricas mobile repetía el patrón en metric cards y bloques de ruta; los labels podían superar el ancho de columna.
- Particulares autenticado mantenía demasiada altura apilada para 360x740, 390x844 y desktop corto 1366x768.
- `pnpm@10.8.1` no lee `pnpm.overrides` desde `package.json`; para validar sin lockfile nuevo fue necesario pasar overrides por variable temporal.

## Riesgos evaluados
- Riesgo de selector duplicado: resuelto exponiendo el selector generic solo en el contexto activo.
- Riesgo de overflow horizontal: resuelto con `min-width: 0`, `max-width: 100%`, clamp y `overflow-wrap: anywhere` en scope mobile.
- Riesgo de public devtools exposure: evitado reemplazando nuevos hooks `data-particular-session-*` por clases CSS.
- Riesgo de tests source-level: preservados literales de clase existentes en métricas y particulares.

## Validaciones ejecutadas
- Targeted Playwright E2E: PASS, `33 passed`.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend lint`: PASS.
- `pnpm test`: PASS, `2955/2955`.
- `pnpm build`: PASS.
- `pnpm --dir frontend build`: PASS.
- `pnpm security:public-surface`: PASS.

## Exclusiones confirmadas
- No backend, DB, migraciones, endpoints, auth, cookies, CORS, CSP, rate limits, dependencias declaradas, lockfiles, CI/workflows.
- No commit, push ni PR.

