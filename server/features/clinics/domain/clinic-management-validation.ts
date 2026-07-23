// Clinics · domain · validaciones de administración de clínicas (reglas puras)
//
// Reglas de dominio y normalización semántica de la administración de clínicas,
// extraídas 1:1 desde `server/routes/admin-clinics.fastify.ts` (M25). Sin
// framework, sin IO, sin DB, sin conocimiento de HTTP/Fastify: recibe `unknown`
// o estructuras puras y devuelve datos normalizados o un error puro. La ruta
// sigue siendo responsable de convertir el resultado a las respuestas HTTP
// existentes (status codes, payloads, CORS, auth, auditoría, error mapping).
//
// El tipo `ClinicUserRole` se define aquí como unión literal canónica del
// dominio (sin importar `drizzle/schema`), estructuralmente compatible con los
// consumidores actuales. La pureza está garantizada por
// `test/architecture/clinics-domain-boundary-guard.test.ts`.

export type ClinicUserRole = "clinic_owner" | "clinic_staff";

export type ClinicValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ClinicCreateInput = {
  clinicName: string;
  contactEmail: string;
  contactPhone: string | null;
  username: string;
  password: string;
  role: ClinicUserRole;
};

export type ClinicUpdateInput = {
  clinicName?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  updatedFields: string[];
};

type ClinicCreateBody = {
  clinicName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
};

type ClinicUpdateBody = {
  clinicName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
};

type ClinicDeleteBody = {
  confirmClinicName?: unknown;
};

// --- Helpers privados de normalización/validación (no exportados) -----------

function parseRequiredString(input: {
  value: unknown;
  field: string;
  label: string;
  maxLength: number;
}) {
  if (typeof input.value !== "string") {
    return {
      ok: false as const,
      error: `${input.label} es obligatorio.`,
    };
  }

  const trimmed = input.value.trim();

  if (!trimmed) {
    return {
      ok: false as const,
      error: `${input.label} es obligatorio.`,
    };
  }

  if (trimmed.length > input.maxLength) {
    return {
      ok: false as const,
      error: `${input.label} excede ${input.maxLength} caracteres.`,
    };
  }

  return {
    ok: true as const,
    value: trimmed,
  };
}

function parseOptionalString(input: {
  value: unknown;
  label: string;
  maxLength: number;
}) {
  if (input.value === undefined) {
    return {
      ok: true as const,
      value: undefined,
    };
  }

  if (input.value === null) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (typeof input.value !== "string") {
    return {
      ok: false as const,
      error: `${input.label} debe ser texto.`,
    };
  }

  const trimmed = input.value.trim();

  if (trimmed.length > input.maxLength) {
    return {
      ok: false as const,
      error: `${input.label} excede ${input.maxLength} caracteres.`,
    };
  }

  return {
    ok: true as const,
    value: trimmed || null,
  };
}

function parseOptionalRequiredString(input: {
  value: unknown;
  label: string;
  maxLength: number;
}) {
  if (input.value === undefined) {
    return {
      ok: true as const,
      value: undefined,
    };
  }

  return parseRequiredString({
    value: input.value,
    field: input.label,
    label: input.label,
    maxLength: input.maxLength,
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// --- API canónica pública ---------------------------------------------------

export function parseClinicUserRole(value: unknown): ClinicUserRole | null {
  if (value === undefined || value === null || value === "") {
    return "clinic_owner";
  }

  if (value === "clinic_owner" || value === "clinic_staff") {
    return value;
  }

  return null;
}

export function parseClinicCreateInput(
  body: unknown,
): ClinicValidationResult<ClinicCreateInput> {
  const input = (body ?? undefined) as ClinicCreateBody | undefined;

  const clinicName = parseRequiredString({
    value: input?.clinicName,
    field: "clinicName",
    label: "Nombre de clínica",
    maxLength: 255,
  });
  const contactEmail = parseRequiredString({
    value: input?.contactEmail,
    field: "contactEmail",
    label: "Email de contacto",
    maxLength: 255,
  });
  const contactPhone = parseOptionalString({
    value: input?.contactPhone,
    label: "Teléfono de contacto",
    maxLength: 50,
  });
  const username = parseRequiredString({
    value: input?.username,
    field: "username",
    label: "Usuario",
    maxLength: 100,
  });

  if (!clinicName.ok) return clinicName;
  if (!contactEmail.ok) return contactEmail;
  if (!contactPhone.ok) return contactPhone;
  if (!username.ok) return username;

  if (!isValidEmail(contactEmail.value)) {
    return {
      ok: false,
      error: "Email de contacto inválido.",
    };
  }

  if (username.value.length < 3) {
    return {
      ok: false,
      error: "Usuario debe tener al menos 3 caracteres.",
    };
  }

  if (
    typeof input?.password !== "string" ||
    input.password.length < 8 ||
    input.password.trim().length < 8
  ) {
    return {
      ok: false,
      error: "La contraseña debe tener al menos 8 caracteres.",
    };
  }

  const role = parseClinicUserRole(input.role);

  if (!role) {
    return {
      ok: false,
      error: "role inválido. Debe ser clinic_owner o clinic_staff.",
    };
  }

  return {
    ok: true,
    data: {
      clinicName: clinicName.value,
      contactEmail: contactEmail.value,
      contactPhone: contactPhone.value ?? null,
      username: username.value,
      password: input.password,
      role,
    },
  };
}

export function parseClinicUpdateInput(
  body: unknown,
): ClinicValidationResult<ClinicUpdateInput> {
  const input = (body ?? undefined) as ClinicUpdateBody | undefined;

  const clinicName = parseOptionalRequiredString({
    value: input?.clinicName,
    label: "Nombre de clínica",
    maxLength: 255,
  });
  const contactEmail = parseOptionalString({
    value: input?.contactEmail,
    label: "Email de contacto",
    maxLength: 255,
  });
  const contactPhone = parseOptionalString({
    value: input?.contactPhone,
    label: "Teléfono de contacto",
    maxLength: 50,
  });

  if (!clinicName.ok) return clinicName;
  if (!contactEmail.ok) return contactEmail;
  if (!contactPhone.ok) return contactPhone;

  if (
    typeof contactEmail.value === "string" &&
    !isValidEmail(contactEmail.value)
  ) {
    return {
      ok: false,
      error: "Email de contacto inválido.",
    };
  }

  const updatedFields: string[] = [];
  const data: ClinicUpdateInput = {
    updatedFields,
  };

  if (clinicName.value !== undefined) {
    data.clinicName = clinicName.value;
    updatedFields.push("clinicName");
  }

  if (contactEmail.value !== undefined) {
    data.contactEmail = contactEmail.value;
    updatedFields.push("contactEmail");
  }

  if (contactPhone.value !== undefined) {
    data.contactPhone = contactPhone.value;
    updatedFields.push("contactPhone");
  }

  if (updatedFields.length === 0) {
    return {
      ok: false,
      error: "Debe enviar al menos un dato de clínica para actualizar.",
    };
  }

  return {
    ok: true,
    data,
  };
}

export function parseClinicDeleteConfirmation(
  body: unknown,
): { ok: true; confirmClinicName: string } | { ok: false; error: string } {
  const input = (body ?? undefined) as ClinicDeleteBody | undefined;

  const confirmClinicName = parseRequiredString({
    value: input?.confirmClinicName,
    field: "confirmClinicName",
    label: "Confirmación de clínica",
    maxLength: 255,
  });

  if (!confirmClinicName.ok) {
    return confirmClinicName;
  }

  return {
    ok: true,
    confirmClinicName: confirmClinicName.value,
  };
}

export function confirmClinicNameMatches(
  confirmation: string,
  actualClinicName: string,
): boolean {
  return confirmation === actualClinicName;
}
