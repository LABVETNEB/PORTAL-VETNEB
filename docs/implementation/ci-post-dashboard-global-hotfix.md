# Hotfix CI post dashboard global

## Contexto

Luego del merge de `#1015`, `main` quedó con CI fallando por dos causas no relacionadas con la implementación visual del dashboard:

1. `Backend CI` falló en `pnpm audit --prod` por vulnerabilidades de `multer`.
2. `Frontend CI` falló en el E2E público de precios porque el test de skeleton dependía de timing de red.

## Cambios realizados

- Se actualizó `multer` a una versión parcheada compatible con `pnpm audit --prod`.
- Se estabilizó el test `frontend/e2e/public-pricing-actionable.spec.ts`.
- El test de skeleton ahora bloquea la respuesta mock de `/api/public/pricing` hasta verificar que `[data-pricing-skeleton='true']` sea visible.
- El texto de carga accesible se permite únicamente como `.sr-only`.
- No se modificó dashboard.
- No se redujo cobertura.
- No se usó `test.skip`.
- No se ignoró audit.

## Validaciones

- `pnpm audit --prod`: OK
- `pnpm --dir frontend e2e -- e2e/public-pricing-actionable.spec.ts --reporter=line`: OK esperado
- `pnpm --dir frontend build`: OK
- `pnpm build`: OK
- `pnpm security:public-surface`: OK

## Nota sobre `pnpm test`

Los tests nativos de scope fallan si se ejecutan con `package.json`, `pnpm-lock.yaml` o `frontend/next-env.d.ts` modificados en el working tree. Para este hotfix, `pnpm test` debe ejecutarse después del commit, con working tree limpio, porque el cambio de dependencias es intencional para corregir `pnpm audit --prod`.

## Resultado esperado

CI verde en `main` para Backend CI y Frontend CI.