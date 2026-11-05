// Etiquetas oficiales del catálogo de estudios (mismo set que el alta de informes).
// Los identificadores internos no cambian; sólo la presentación.
export const STUDY_TYPE_LABELS: ReadonlyMap<string, string> = new Map([
  ["histopatologia", "Histopatología"],
  ["citologia", "Citología"],
  ["hemoparasitos", "Hemoparásitos"],
]);

export function formatStudyTypeDisplay(studyType: string): string {
  return (STUDY_TYPE_LABELS.get(studyType) ?? studyType).toLocaleUpperCase("es");
}
