// Etiquetas oficiales del catálogo de estudios (mismo set que el alta de informes).
// Los identificadores internos no cambian; sólo la presentación.
export const STUDY_TYPE_LABELS: ReadonlyMap<string, string> = new Map([
  ["histopatologia", "Histopatología"],
  ["citologia", "Citología"],
  ["hemoparasitos", "Hemoparásitos"],
]);

export const STUDY_TYPE_MISSING_LABEL = "Tipo sin registrar";

// Datos históricos guardaron la etiqueta ("Histopatología") en vez del id: se
// resuelven al mismo id ignorando tildes, mayúsculas y espacios de borde.
function catalogKey(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function formatStudyTypeDisplay(studyType: string | null | undefined): string {
  const value = studyType?.trim();
  if (!value) return STUDY_TYPE_MISSING_LABEL;
  return (STUDY_TYPE_LABELS.get(catalogKey(value)) ?? value).toLocaleUpperCase("es");
}
