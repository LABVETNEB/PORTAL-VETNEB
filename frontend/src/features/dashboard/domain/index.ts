/**
 * Dashboard · domain layer (boundary placeholder).
 *
 * Intended home for role module types (ClinicModule / AdminModule), module
 * parse/validation over the config catalog, and pure view-models
 * (systemHealth, audit labels, status→variant). No side effects, no data
 * fetching (audit H3/H7).
 *
 * Boundary rule: no React imports — pure functions and types only.
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary; real
 * exports land in a later PRES PR (see
 * docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
