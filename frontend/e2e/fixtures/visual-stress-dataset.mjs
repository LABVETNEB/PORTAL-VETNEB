// R-02 / LIMPIEZA E2E §23 — fail-closed visual baseline selector.
// Before ownership convergence, only browser requests could observe the local
// stress mock. Server Components always consumed the fixture's normal payload.
// The shared fixture preserves that effective boundary and remains the sole
// response owner; the visual spec only selects it through this test-only cookie.

export const VISUAL_STRESS_COOKIE_NAME = "e2e_visual_stress_dataset";
export const VISUAL_STRESS_COOKIE_VALUE = "1";
