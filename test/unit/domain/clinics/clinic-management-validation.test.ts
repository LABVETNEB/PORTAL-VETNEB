import test from "node:test";
import assert from "node:assert/strict";

import {
  parseClinicUserRole,
  parseClinicCreateInput,
  parseClinicUpdateInput,
  parseClinicDeleteConfirmation,
  confirmClinicNameMatches,
} from "../../../../server/features/clinics/domain/index.ts";

// Fixture base válido para create. Cada test lo clona y muta un solo campo.
function validCreateBody() {
  return {
    clinicName: "Clínica Demo",
    contactEmail: "demo@clinic.test",
    contactPhone: "1144556677",
    username: "clinic-owner",
    password: "claveSegura1",
    role: "clinic_owner",
  } as Record<string, unknown>;
}

/* ==========================================================================
 * parseClinicUserRole
 * ======================================================================== */

test("parseClinicUserRole: undefined/null/'' → clinic_owner (default)", () => {
  assert.equal(parseClinicUserRole(undefined), "clinic_owner");
  assert.equal(parseClinicUserRole(null), "clinic_owner");
  assert.equal(parseClinicUserRole(""), "clinic_owner");
});

test("parseClinicUserRole: valores válidos se preservan", () => {
  assert.equal(parseClinicUserRole("clinic_owner"), "clinic_owner");
  assert.equal(parseClinicUserRole("clinic_staff"), "clinic_staff");
});

test("parseClinicUserRole: valor inválido → null", () => {
  assert.equal(parseClinicUserRole("admin"), null);
  assert.equal(parseClinicUserRole("CLINIC_OWNER"), null);
  assert.equal(parseClinicUserRole(123), null);
  assert.equal(parseClinicUserRole({}), null);
});

/* ==========================================================================
 * parseClinicCreateInput — camino feliz + normalización
 * ======================================================================== */

test("CREATE válido completo devuelve data normalizada", () => {
  const result = parseClinicCreateInput(validCreateBody());
  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.deepEqual(result.data, {
    clinicName: "Clínica Demo",
    contactEmail: "demo@clinic.test",
    contactPhone: "1144556677",
    username: "clinic-owner",
    password: "claveSegura1",
    role: "clinic_owner",
  });
});

test("CREATE aplica trim a clinicName, contactEmail, contactPhone y username", () => {
  const result = parseClinicCreateInput({
    clinicName: "  Clínica Demo  ",
    contactEmail: "  demo@clinic.test  ",
    contactPhone: "  1144556677  ",
    username: "  clinic-owner  ",
    password: "claveSegura1",
    role: "clinic_owner",
  });
  assert.ok(result.ok);
  assert.equal(result.data.clinicName, "Clínica Demo");
  assert.equal(result.data.contactEmail, "demo@clinic.test");
  assert.equal(result.data.contactPhone, "1144556677");
  assert.equal(result.data.username, "clinic-owner");
});

test("CREATE contactPhone omitido → null", () => {
  const body = validCreateBody();
  delete body.contactPhone;
  const result = parseClinicCreateInput(body);
  assert.ok(result.ok);
  assert.equal(result.data.contactPhone, null);
});

test("CREATE contactPhone null → null", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), contactPhone: null });
  assert.ok(result.ok);
  assert.equal(result.data.contactPhone, null);
});

test("CREATE contactPhone vacío/whitespace → null", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), contactPhone: "   " });
  assert.ok(result.ok);
  assert.equal(result.data.contactPhone, null);
});

test("CREATE role omitido → clinic_owner", () => {
  const body = validCreateBody();
  delete body.role;
  const result = parseClinicCreateInput(body);
  assert.ok(result.ok);
  assert.equal(result.data.role, "clinic_owner");
});

test("CREATE role null → clinic_owner", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), role: null });
  assert.ok(result.ok);
  assert.equal(result.data.role, "clinic_owner");
});

test("CREATE role '' → clinic_owner", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), role: "" });
  assert.ok(result.ok);
  assert.equal(result.data.role, "clinic_owner");
});

test("CREATE ambos roles válidos", () => {
  const owner = parseClinicCreateInput({ ...validCreateBody(), role: "clinic_owner" });
  const staff = parseClinicCreateInput({ ...validCreateBody(), role: "clinic_staff" });
  assert.ok(owner.ok);
  assert.ok(staff.ok);
  assert.equal(owner.data.role, "clinic_owner");
  assert.equal(staff.data.role, "clinic_staff");
});

test("CREATE role inválido → error exacto", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), role: "superadmin" });
  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.equal(result.error, "role inválido. Debe ser clinic_owner o clinic_staff.");
});

test("CREATE password raw se preserva sin trim", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), password: "  claveSegura1  " });
  assert.ok(result.ok);
  assert.equal(result.data.password, "  claveSegura1  ");
});

/* ==========================================================================
 * parseClinicCreateInput — required ausentes / tipo inválido / vacío / máximos
 * ======================================================================== */

test("CREATE clinicName ausente → obligatorio", () => {
  const body = validCreateBody();
  delete body.clinicName;
  const result = parseClinicCreateInput(body);
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica es obligatorio.");
});

test("CREATE clinicName tipo inválido → obligatorio", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), clinicName: 123 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica es obligatorio.");
});

test("CREATE clinicName vacío → obligatorio", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), clinicName: "   " });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica es obligatorio.");
});

test("CREATE clinicName excede 255 → error de longitud", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), clinicName: "a".repeat(256) });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica excede 255 caracteres.");
});

test("CREATE clinicName exactamente 255 es válido", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), clinicName: "a".repeat(255) });
  assert.ok(result.ok);
  assert.equal(result.data.clinicName.length, 255);
});

test("CREATE contactEmail ausente → obligatorio", () => {
  const body = validCreateBody();
  delete body.contactEmail;
  const result = parseClinicCreateInput(body);
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto es obligatorio.");
});

test("CREATE contactEmail tipo inválido → obligatorio", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), contactEmail: 42 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto es obligatorio.");
});

test("CREATE contactEmail excede 255 → error de longitud (antes que formato)", () => {
  const longEmail = `${"a".repeat(256)}@x.io`; // 261 chars
  const result = parseClinicCreateInput({ ...validCreateBody(), contactEmail: longEmail });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto excede 255 caracteres.");
});

test("CREATE contactEmail inválido → formato", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), contactEmail: "no-es-email" });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto inválido.");
});

test("CREATE contactPhone tipo inválido → debe ser texto", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), contactPhone: 123 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Teléfono de contacto debe ser texto.");
});

test("CREATE contactPhone excede 50 → error de longitud", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), contactPhone: "9".repeat(51) });
  assert.ok(!result.ok);
  assert.equal(result.error, "Teléfono de contacto excede 50 caracteres.");
});

test("CREATE username ausente → obligatorio", () => {
  const body = validCreateBody();
  delete body.username;
  const result = parseClinicCreateInput(body);
  assert.ok(!result.ok);
  assert.equal(result.error, "Usuario es obligatorio.");
});

test("CREATE username vacío → obligatorio", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), username: "  " });
  assert.ok(!result.ok);
  assert.equal(result.error, "Usuario es obligatorio.");
});

test("CREATE username excede 100 → error de longitud", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), username: "u".repeat(101) });
  assert.ok(!result.ok);
  assert.equal(result.error, "Usuario excede 100 caracteres.");
});

test("CREATE username menor a 3 → mínimo", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), username: "ab" });
  assert.ok(!result.ok);
  assert.equal(result.error, "Usuario debe tener al menos 3 caracteres.");
});

test("CREATE password ausente/no string → mínimo 8", () => {
  const body = validCreateBody();
  delete body.password;
  const result = parseClinicCreateInput(body);
  assert.ok(!result.ok);
  assert.equal(result.error, "La contraseña debe tener al menos 8 caracteres.");
});

test("CREATE password menor a 8 raw → error", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), password: "abc123" });
  assert.ok(!result.ok);
  assert.equal(result.error, "La contraseña debe tener al menos 8 caracteres.");
});

test("CREATE password con 8 raw pero <8 tras trim → error", () => {
  const result = parseClinicCreateInput({ ...validCreateBody(), password: "  abcd  " });
  assert.ok(!result.ok);
  assert.equal(result.error, "La contraseña debe tener al menos 8 caracteres.");
});

/* ==========================================================================
 * parseClinicCreateInput — precedencia con múltiples errores
 * ======================================================================== */

test("CREATE precedencia: clinicName gana sobre email/username/password", () => {
  const result = parseClinicCreateInput({
    clinicName: "",
    contactEmail: "malo",
    username: "a",
    password: "x",
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica es obligatorio.");
});

test("CREATE precedencia: contactEmail (obligatorio) gana sobre username/password", () => {
  const result = parseClinicCreateInput({
    clinicName: "Clínica Demo",
    contactEmail: "",
    username: "a",
    password: "x",
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto es obligatorio.");
});

test("CREATE precedencia: contactPhone inválido gana sobre username", () => {
  const result = parseClinicCreateInput({
    clinicName: "Clínica Demo",
    contactEmail: "demo@clinic.test",
    contactPhone: 999,
    username: "a",
    password: "x",
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "Teléfono de contacto debe ser texto.");
});

test("CREATE precedencia: username (obligatorio) gana sobre formato email y password", () => {
  const result = parseClinicCreateInput({
    clinicName: "Clínica Demo",
    contactEmail: "malo",
    username: "",
    password: "x",
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "Usuario es obligatorio.");
});

test("CREATE precedencia: formato email gana sobre username-min y password", () => {
  const result = parseClinicCreateInput({
    clinicName: "Clínica Demo",
    contactEmail: "malo",
    username: "ab",
    password: "x",
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto inválido.");
});

test("CREATE precedencia: username-min gana sobre password", () => {
  const result = parseClinicCreateInput({
    clinicName: "Clínica Demo",
    contactEmail: "demo@clinic.test",
    username: "ab",
    password: "x",
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "Usuario debe tener al menos 3 caracteres.");
});

test("CREATE precedencia: password gana sobre role inválido", () => {
  const result = parseClinicCreateInput({
    clinicName: "Clínica Demo",
    contactEmail: "demo@clinic.test",
    username: "clinic-owner",
    password: "x",
    role: "superadmin",
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "La contraseña debe tener al menos 8 caracteres.");
});

/* ==========================================================================
 * parseClinicUpdateInput
 * ======================================================================== */

test("UPDATE completo devuelve data normalizada y updatedFields ordenado", () => {
  const result = parseClinicUpdateInput({
    clinicName: "  Clínica Nueva  ",
    contactEmail: "  nueva@clinic.test  ",
    contactPhone: "  555  ",
  });
  assert.ok(result.ok);
  assert.equal(result.data.clinicName, "Clínica Nueva");
  assert.equal(result.data.contactEmail, "nueva@clinic.test");
  assert.equal(result.data.contactPhone, "555");
  assert.deepEqual(result.data.updatedFields, [
    "clinicName",
    "contactEmail",
    "contactPhone",
  ]);
});

test("UPDATE clinicName individual", () => {
  const result = parseClinicUpdateInput({ clinicName: "Solo Nombre" });
  assert.ok(result.ok);
  assert.equal(result.data.clinicName, "Solo Nombre");
  assert.deepEqual(result.data.updatedFields, ["clinicName"]);
  assert.equal("contactEmail" in result.data, false);
  assert.equal("contactPhone" in result.data, false);
});

test("UPDATE contactEmail individual", () => {
  const result = parseClinicUpdateInput({ contactEmail: "x@y.io" });
  assert.ok(result.ok);
  assert.equal(result.data.contactEmail, "x@y.io");
  assert.deepEqual(result.data.updatedFields, ["contactEmail"]);
});

test("UPDATE contactPhone individual", () => {
  const result = parseClinicUpdateInput({ contactPhone: "123" });
  assert.ok(result.ok);
  assert.equal(result.data.contactPhone, "123");
  assert.deepEqual(result.data.updatedFields, ["contactPhone"]);
});

test("UPDATE clinicName vacío → error (no se puede vaciar)", () => {
  const result = parseClinicUpdateInput({ clinicName: "   " });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica es obligatorio.");
});

test("UPDATE clinicName tipo inválido → error", () => {
  const result = parseClinicUpdateInput({ clinicName: 5 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica es obligatorio.");
});

test("UPDATE clinicName excede 255 → error de longitud", () => {
  const result = parseClinicUpdateInput({ clinicName: "a".repeat(256) });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica excede 255 caracteres.");
});

test("UPDATE contactEmail vacío → null y se incluye en updatedFields", () => {
  const result = parseClinicUpdateInput({ contactEmail: "" });
  assert.ok(result.ok);
  assert.equal(result.data.contactEmail, null);
  assert.deepEqual(result.data.updatedFields, ["contactEmail"]);
});

test("UPDATE contactEmail whitespace → null", () => {
  const result = parseClinicUpdateInput({ contactEmail: "   " });
  assert.ok(result.ok);
  assert.equal(result.data.contactEmail, null);
});

test("UPDATE contactEmail null → null", () => {
  const result = parseClinicUpdateInput({ contactEmail: null });
  assert.ok(result.ok);
  assert.equal(result.data.contactEmail, null);
  assert.deepEqual(result.data.updatedFields, ["contactEmail"]);
});

test("UPDATE contactEmail inválido (string no vacío) → formato", () => {
  const result = parseClinicUpdateInput({ contactEmail: "malo" });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto inválido.");
});

test("UPDATE contactEmail tipo inválido → debe ser texto", () => {
  const result = parseClinicUpdateInput({ contactEmail: 10 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto debe ser texto.");
});

test("UPDATE contactEmail excede 255 → error de longitud", () => {
  const result = parseClinicUpdateInput({ contactEmail: `${"a".repeat(256)}@x.io` });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto excede 255 caracteres.");
});

test("UPDATE contactPhone vacío → null", () => {
  const result = parseClinicUpdateInput({ contactPhone: "" });
  assert.ok(result.ok);
  assert.equal(result.data.contactPhone, null);
  assert.deepEqual(result.data.updatedFields, ["contactPhone"]);
});

test("UPDATE contactPhone tipo inválido → debe ser texto", () => {
  const result = parseClinicUpdateInput({ contactPhone: 5 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Teléfono de contacto debe ser texto.");
});

test("UPDATE contactPhone excede 50 → error de longitud", () => {
  const result = parseClinicUpdateInput({ contactPhone: "9".repeat(51) });
  assert.ok(!result.ok);
  assert.equal(result.error, "Teléfono de contacto excede 50 caracteres.");
});

test("UPDATE sin campos → error de body vacío", () => {
  const result = parseClinicUpdateInput({});
  assert.ok(!result.ok);
  assert.equal(result.error, "Debe enviar al menos un dato de clínica para actualizar.");
});

test("UPDATE con todos los campos undefined → error de body vacío", () => {
  const result = parseClinicUpdateInput({
    clinicName: undefined,
    contactEmail: undefined,
    contactPhone: undefined,
  });
  assert.ok(!result.ok);
  assert.equal(result.error, "Debe enviar al menos un dato de clínica para actualizar.");
});

test("UPDATE precedencia: clinicName gana sobre email inválido", () => {
  const result = parseClinicUpdateInput({ clinicName: "", contactEmail: "malo" });
  assert.ok(!result.ok);
  assert.equal(result.error, "Nombre de clínica es obligatorio.");
});

test("UPDATE precedencia: contactEmail-tipo gana sobre contactPhone-tipo", () => {
  const result = parseClinicUpdateInput({ contactEmail: 1, contactPhone: 2 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto debe ser texto.");
});

test("UPDATE precedencia: validación de tipo/formato gana sobre body-vacío", () => {
  const result = parseClinicUpdateInput({ contactEmail: "malo" });
  assert.ok(!result.ok);
  assert.equal(result.error, "Email de contacto inválido.");
});

/* ==========================================================================
 * parseClinicDeleteConfirmation
 * ======================================================================== */

test("DELETE confirmClinicName válido", () => {
  const result = parseClinicDeleteConfirmation({ confirmClinicName: "Clínica Demo" });
  assert.ok(result.ok);
  assert.equal(result.confirmClinicName, "Clínica Demo");
});

test("DELETE confirmClinicName aplica trim", () => {
  const result = parseClinicDeleteConfirmation({ confirmClinicName: "  Clínica Demo  " });
  assert.ok(result.ok);
  assert.equal(result.confirmClinicName, "Clínica Demo");
});

test("DELETE confirmClinicName ausente → obligatorio", () => {
  const result = parseClinicDeleteConfirmation({});
  assert.ok(!result.ok);
  assert.equal(result.error, "Confirmación de clínica es obligatorio.");
});

test("DELETE confirmClinicName no string → obligatorio", () => {
  const result = parseClinicDeleteConfirmation({ confirmClinicName: 123 });
  assert.ok(!result.ok);
  assert.equal(result.error, "Confirmación de clínica es obligatorio.");
});

test("DELETE confirmClinicName vacío → obligatorio", () => {
  const result = parseClinicDeleteConfirmation({ confirmClinicName: "   " });
  assert.ok(!result.ok);
  assert.equal(result.error, "Confirmación de clínica es obligatorio.");
});

test("DELETE confirmClinicName excede 255 → error de longitud", () => {
  const result = parseClinicDeleteConfirmation({ confirmClinicName: "a".repeat(256) });
  assert.ok(!result.ok);
  assert.equal(result.error, "Confirmación de clínica excede 255 caracteres.");
});

/* ==========================================================================
 * confirmClinicNameMatches
 * ======================================================================== */

test("confirmClinicNameMatches: match exacto → true", () => {
  assert.equal(confirmClinicNameMatches("Clínica Demo", "Clínica Demo"), true);
});

test("confirmClinicNameMatches: mismatch por casing → false", () => {
  assert.equal(confirmClinicNameMatches("clínica demo", "Clínica Demo"), false);
});

test("confirmClinicNameMatches: mismatch por espacio en el nombre real → false", () => {
  assert.equal(confirmClinicNameMatches("Clínica Demo", "Clínica Demo "), false);
});

test("confirmClinicNameMatches: es case-sensitive y sin normalización adicional", () => {
  assert.equal(confirmClinicNameMatches("ABC", "abc"), false);
  assert.equal(confirmClinicNameMatches("ABC", "ABC"), true);
});
