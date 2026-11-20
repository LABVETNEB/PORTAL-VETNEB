// Preload exclusivo del runner de tests (pnpm test / test:coverage).
// Valor sintético: el código productivo no tiene default para esta variable.
process.env.PARTICULAR_TOKEN_TTL_DAYS ??= "90";
