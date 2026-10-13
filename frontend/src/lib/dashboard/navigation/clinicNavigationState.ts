/**
 * Canonical clinic url for a module.
 *
 * The operational default has NO query: `/dashboard` is the url the "Inicio"
 * control already links to, so reconciling to the default must land on exactly
 * that string instead of inventing a second spelling of the same surface.
 */
export function clinicModuleHref(
  basePath: string,
  defaultModule: string,
  target: string,
): string {
  return target === defaultModule ? basePath : `${basePath}?module=${target}`;
}
