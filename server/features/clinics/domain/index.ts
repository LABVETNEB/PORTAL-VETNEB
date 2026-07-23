// Clinics · domain (barrel público)
//
// Superficie pública del contexto `clinics/domain`: re-exporta las reglas puras
// de validación y normalización de la administración de clínicas sin agregar
// lógica ni cambiar comportamiento. Es el único punto de entrada que la ruta
// admin y los tests deben consumir; nadie fuera de `domain/` importa el archivo
// interno (garantizado por `clinics-domain-boundary-guard`).
//
// - M25 · `clinic-management-validation.ts` (validaciones create/update/delete,
//          rol de usuario de clínica, comparación de confirmación de borrado;
//          helpers internos privados, cero imports).
// - M28 · `clinic-public-profile-validation.ts` (normalización del PATCH,
//          URLs de mapa y validación real de avatares; cero imports).

export type {
  ClinicUserRole,
  ClinicValidationResult,
  ClinicCreateInput,
  ClinicUpdateInput,
} from "./clinic-management-validation.ts";

export {
  parseClinicUserRole,
  parseClinicCreateInput,
  parseClinicUpdateInput,
  parseClinicDeleteConfirmation,
  confirmClinicNameMatches,
} from "./clinic-management-validation.ts";

export type {
  ClinicPublicProfilePatchInput,
  ClinicPublicProfileValidationResult,
  ClinicPublicAvatarFile,
} from "./clinic-public-profile-validation.ts";

export {
  MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES,
  CLINIC_PUBLIC_AVATAR_UNSUPPORTED_MIME_ERROR,
  parseClinicPublicProfilePatch,
  isClinicPublicAvatarMimeType,
  validateClinicPublicAvatar,
} from "./clinic-public-profile-validation.ts";
