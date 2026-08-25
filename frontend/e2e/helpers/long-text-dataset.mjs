// ─────────────────────────────────────────────────────────────────────────────
// PR-TRUNC · Shared long-text dataset (test-only, side-effect free).
//
// The truncation contract has two consumers that must agree byte-for-byte on
// the same strings:
//
//   1. `frontend/e2e/fixtures/admin-populated-api-server.mjs`, which serves
//      them to the SERVER-rendered clinic report surfaces (/dashboard and
//      /dashboard/informes) — Playwright's `page.route` cannot reach those,
//      because their fetch never leaves the Next process.
//   2. `frontend/e2e/platform/app-shell/dashboard-detail-text-integrity.spec.ts`,
//      which asserts the FULL string is present in the DOM.
//
// It lives here rather than in the fixture because importing the fixture would
// execute it, and the fixture calls `server.listen(3107)` at module scope.
//
// Every value is synthetic and deliberately hostile to a one-line box: long
// prose, an unbroken identifier and a long file name with no spaces. None of
// them is a real patient, tutor, clinic, email or document (AGENTS §9).
// ─────────────────────────────────────────────────────────────────────────────

/** Auxiliary opt-in cookie. Conjunctive with a populated clinic session. */
export const LONG_TEXT_COOKIE_NAME = "e2e_long_text_overflow";
export const LONG_TEXT_COOKIE_VALUE = "1";

export const LONG_TEXT_CLINIC_REPORT = Object.freeze({
  patientName:
    "Maximiliano Bartolome de la Concepcion Rodriguez Etchegaray Villalobos Jauregui",
  studyType:
    "Histopatologia dermatologica con evaluacion de margenes quirurgicos ampliados y estudio inmunohistoquimico complementario",
  fileName:
    "informe-anatomopatologico-completo-con-inmunohistoquimica-2026-06-18-revision-final-v3-definitivo.pdf",
  clinicName:
    "Centro Veterinario Integral de Diagnostico y Seguimiento Los Arrayanes Sede Norte",
});

/**
 * A realistic-length user agent. The admin failed-login row truncates it by
 * design (pitch-locked table); the assertion is that its detail dialog renders
 * it whole. Synthetic build numbers, no real device fingerprint.
 */
export const LONG_TEXT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/000.0.0000.000 Safari/537.36 Edg/000.0.0000.000";

/**
 * Admin users/roles. The row truncates both of these by design (pitch-locked
 * table); the assertion is that the detail dialog renders them whole.
 */
export const LONG_TEXT_USER_ROLE = Object.freeze({
  username: "operador.administracion.regional.zona.norte.suplente.e2e",
  clinicName:
    "Centro Veterinario Integral de Diagnostico y Seguimiento Los Arrayanes Sede Norte",
});

/** Client-fetched surfaces (admin tokens, admin reports, clinic tokens). */
export const LONG_TEXT_TOKEN = Object.freeze({
  petName:
    "Maximiliano Bartolome de la Concepcion Rodriguez Etchegaray Villalobos Jauregui",
  petBreed: "TKN-00000000000000000000000000000000000000000042",
  sampleLocation:
    "Region dorsolumbar paravertebral izquierda, cuadrante craneal profundo, plano subcutaneo",
  sampleEvolution:
    "Doce semanas de evolucion progresiva con incremento sostenido del tamano lesional",
  detailsLesion:
    "Lesion nodular ulcerada de bordes irregulares con areas de necrosis central, extension subcutanea y compromiso de planos profundos; se solicita evaluacion anatomopatologica con margenes quirurgicos y tinciones especiales complementarias.",
});
