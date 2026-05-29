import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin clinics create soporta clinic_id legacy requerido en DB real", () => {
  const source = read("server/db-admin-clinics.ts");

  assert.ok(source.includes("column_name = 'clinic_id'"));
  assert.ok(source.includes("buildLegacyClinicExternalId"));
  assert.ok(source.includes('insert into "clinics"'));
  assert.ok(source.includes('"clinic_id"'));
  assert.ok(source.includes("reserveNextClinicId"));
});

test("admin clinics delete limpia report_access_tokens antes de borrar clinics", () => {
  const source = read("server/db-admin-clinics.ts");

  const deleteReportAccessTokensIndex = source.indexOf(
    ".delete(reportAccessTokens)",
  );
  const deleteClinicsIndex = source.indexOf(".delete(clinics)");

  assert.ok(deleteReportAccessTokensIndex >= 0);
  assert.ok(deleteClinicsIndex > deleteReportAccessTokensIndex);
});

test("branch legacy usa toISOString() para timestamps, no Date crudo en raw SQL", () => {
  const source = read("server/db-admin-clinics.ts");

  // La corrección debe estar presente: ISO string + cast explícito de timestamptz
  const isoOccurrences = (source.match(/now\.toISOString\(\)/g) ?? []).length;
  assert.ok(
    isoOccurrences >= 2,
    "debe haber al menos 2 llamadas a now.toISOString() (created_at y updated_at), encontradas: " +
      String(isoOccurrences),
  );

  assert.ok(
    source.includes("::timestamptz"),
    "el cast ::timestamptz debe estar presente en el insert legacy",
  );

  // El insert raw SQL nunca debe pasar ${now} sin conversión a string.
  // Extraemos el bloque del insert legacy y verificamos que no hay Date crudo.
  const legacyInsertStart = source.indexOf('insert into "clinics"');
  const legacyInsertEnd = source.indexOf("returning", legacyInsertStart) + 9;
  const legacyInsertBlock = source.slice(legacyInsertStart, legacyInsertEnd);

  assert.ok(
    !legacyInsertBlock.includes("${now},") &&
      !legacyInsertBlock.includes("${now}\n"),
    "el insert legacy no debe contener ${now} sin .toISOString() como parametro de timestamp",
  );
});

test("buildLegacyClinicExternalId genera clinic-{id} y se usa con el id reservado", () => {
  const source = read("server/db-admin-clinics.ts");

  // La función genera el formato clinic-{id}
  assert.ok(
    source.includes("`clinic-${clinicId}`"),
    "buildLegacyClinicExternalId debe retornar template clinic-${clinicId}",
  );

  // Se usa correctamente con el id reservado
  assert.ok(
    source.includes("buildLegacyClinicExternalId(reservedClinicId)"),
    "debe llamarse con reservedClinicId, no con otro valor",
  );

  // El id reservado proviene de la secuencia de la DB, no de un autoincremento
  assert.ok(
    source.includes("pg_get_serial_sequence"),
    "la reserva del id debe usar pg_get_serial_sequence para evitar conflictos",
  );
});

test("serializeClinic serializa createdAt y updatedAt como ISO string, no expone passwordHash", () => {
  const source = read("server/db-admin-clinics.ts");

  const serializeClinicStart = source.indexOf("function serializeClinic(");
  const serializeClinicEnd = source.indexOf("function serializeClinicUser(");
  const serializeClinicFn = source.slice(serializeClinicStart, serializeClinicEnd);

  assert.ok(
    serializeClinicFn.includes("toIsoDate(row.createdAt)"),
    "serializeClinic debe llamar toIsoDate(row.createdAt)",
  );
  assert.ok(
    serializeClinicFn.includes("toIsoDate(row.updatedAt)"),
    "serializeClinic debe llamar toIsoDate(row.updatedAt)",
  );
  assert.ok(
    !serializeClinicFn.includes("passwordHash"),
    "serializeClinic no debe exponer passwordHash",
  );
  assert.ok(
    !serializeClinicFn.includes("password"),
    "serializeClinic no debe exponer password",
  );

  // toIsoDate usa toISOString()
  const toIsoDateStart = source.indexOf("function toIsoDate(");
  const toIsoDateEnd = source.indexOf("function serializeClinic(");
  const toIsoDateFn = source.slice(toIsoDateStart, toIsoDateEnd);

  assert.ok(
    toIsoDateFn.includes(".toISOString()"),
    "toIsoDate debe usar .toISOString()",
  );
});

test("serializeClinicUser no expone passwordHash, authProId ni campos sensibles", () => {
  const source = read("server/db-admin-clinics.ts");

  const serializeUserStart = source.indexOf("function serializeClinicUser(");
  const serializeUserEnd = source.indexOf("async function getClinicUserRow(");
  const serializeUserFn = source.slice(serializeUserStart, serializeUserEnd);

  assert.ok(
    !serializeUserFn.includes("passwordHash"),
    "serializeClinicUser no debe incluir passwordHash",
  );
  assert.ok(
    !serializeUserFn.includes("password"),
    "serializeClinicUser no debe incluir password",
  );
  assert.ok(
    !serializeUserFn.includes("authProId"),
    "serializeClinicUser no debe exponer authProId",
  );
  assert.ok(
    serializeUserFn.includes("toIsoDate(row.createdAt)"),
    "serializeClinicUser debe serializar createdAt como ISO",
  );
  assert.ok(
    serializeUserFn.includes("toIsoDate(row.updatedAt)"),
    "serializeClinicUser debe serializar updatedAt como ISO",
  );
});

test("migración 0026 existe y añade contact_email y contact_phone con ADD COLUMN IF NOT EXISTS", () => {
  const source = read("drizzle/migrations/0026_clinics_contact_columns_reconciliation.sql");

  assert.ok(
    source.includes('ADD COLUMN IF NOT EXISTS "contact_email"'),
    "la migración debe añadir contact_email con IF NOT EXISTS",
  );
  assert.ok(
    source.includes('ADD COLUMN IF NOT EXISTS "contact_phone"'),
    "la migración debe añadir contact_phone con IF NOT EXISTS",
  );
  assert.ok(
    source.includes("varchar(255)"),
    "contact_email debe ser varchar(255)",
  );
  assert.ok(
    source.includes("varchar(50)"),
    "contact_phone debe ser varchar(50)",
  );
  assert.ok(
    !source.includes("NOT NULL"),
    "las columnas nuevas no deben tener NOT NULL (son opcionales)",
  );
});

test("journal de migraciones conserva 0026 y deja 0029 como última entrada", () => {
  const raw = read("drizzle/migrations/meta/_journal.json");
  const journal = JSON.parse(raw) as {
    entries: Array<{ idx: number; tag: string }>;
  };

  const last = journal.entries[journal.entries.length - 1];

  assert.ok(
    journal.entries.some(
      (entry) =>
        entry.idx === 26 &&
        entry.tag === "0026_clinics_contact_columns_reconciliation",
    ),
    "el journal debe conservar 0026_clinics_contact_columns_reconciliation",
  );
  assert.equal(
    last?.tag,
    "0029_admin_users_email_identifier",
    "la última entrada del journal debe ser 0029_admin_users_email_identifier",
  );
  assert.equal(last?.idx, 29, "idx de la última migración debe ser 29");
});

test("toIsoDate acepta Date o string devuelto por raw SQL postgres-js", () => {
  const source = read("server/db-admin-clinics.ts");

  const toIsoDateStart = source.indexOf("function toIsoDate(");
  const toIsoDateEnd = source.indexOf("function serializeClinic(");
  const toIsoDateFn = source.slice(toIsoDateStart, toIsoDateEnd);

  assert.ok(
    toIsoDateFn.includes("value instanceof Date"),
    "toIsoDate debe manejar Date nativo",
  );
  assert.ok(
    toIsoDateFn.includes("new Date(value)"),
    "toIsoDate debe aceptar string/number devuelto por raw SQL",
  );
  assert.ok(
    toIsoDateFn.includes("Number.isNaN(date.getTime())"),
    "toIsoDate debe validar fechas inválidas",
  );
});

/* ============================================================================
 * Contrato global: clínica registrada debe poder iniciar sesión por username
 * o por contact_email. Tests source-only sobre server/db-admin-clinics.ts y
 * server/db.ts. No tocan DB, no exponen secretos, no validan frontend.
 * ========================================================================== */

test("createAdminClinicWithUser persiste contact_email aplicando trim al input", () => {
  const source = read("server/db-admin-clinics.ts");

  const fnStart = source.indexOf(
    "export async function createAdminClinicWithUser(",
  );
  assert.ok(fnStart >= 0, "createAdminClinicWithUser debe estar exportado");

  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  const fnBody = source.slice(fnStart, fnEnd === -1 ? source.length : fnEnd);

  assert.ok(
    fnBody.includes("input.contactEmail.trim()"),
    "createAdminClinicWithUser debe persistir contactEmail con .trim() en ambas ramas (legacy + drizzle)",
  );

  const trimOccurrences =
    (fnBody.match(/input\.contactEmail\.trim\(\)/g) ?? []).length;
  assert.ok(
    trimOccurrences >= 2,
    "se esperan al menos 2 usos de input.contactEmail.trim() (legacy raw SQL + drizzle insert), encontrados: " +
      String(trimOccurrences),
  );
});

test("createAdminClinicWithUser asocia el clinic_user creado al clinic recién insertado vía clinicId", () => {
  const source = read("server/db-admin-clinics.ts");

  const fnStart = source.indexOf(
    "export async function createAdminClinicWithUser(",
  );
  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  const fnBody = source.slice(fnStart, fnEnd === -1 ? source.length : fnEnd);

  assert.ok(
    fnBody.includes("const clinic = insertedClinics[0]"),
    "debe tomar la clínica recién insertada como referencia para el user",
  );
  assert.ok(
    fnBody.includes(".insert(clinicUsers)"),
    "debe insertar el clinic_user en la misma transacción",
  );
  assert.ok(
    fnBody.includes("clinicId: clinic.clinicId"),
    "el clinic_user debe asociarse al clinicId de la clínica recién creada",
  );
});

test("createAdminClinicWithUser persiste username trim y role del input en clinic_user", () => {
  const source = read("server/db-admin-clinics.ts");

  const fnStart = source.indexOf(
    "export async function createAdminClinicWithUser(",
  );
  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  const fnBody = source.slice(fnStart, fnEnd === -1 ? source.length : fnEnd);

  assert.ok(
    fnBody.includes("const username = input.username.trim()"),
    "debe normalizar input.username con trim() antes de persistir",
  );

  const userInsertStart = fnBody.indexOf(".insert(clinicUsers)");
  assert.ok(userInsertStart >= 0, "debe existir insert sobre clinicUsers");

  const userInsertBlock = fnBody.slice(userInsertStart, userInsertStart + 600);
  assert.ok(
    userInsertBlock.includes("username,"),
    "el insert de clinic_user debe persistir el username normalizado",
  );
  assert.ok(
    userInsertBlock.includes("role: input.role"),
    "el insert de clinic_user debe persistir el role recibido por input",
  );
  assert.ok(
    userInsertBlock.includes("passwordHash: input.passwordHash"),
    "el insert de clinic_user debe persistir el passwordHash (no hardcoded)",
  );
});

test("getClinicUserByIdentifier en server/db.ts resuelve por username y por clinics.contact_email con lower(trim(...))", () => {
  const source = read("server/db.ts");

  const fnStart = source.indexOf(
    "export async function getClinicUserByIdentifier(",
  );
  assert.ok(
    fnStart >= 0,
    "getClinicUserByIdentifier debe existir y estar exportado en server/db.ts",
  );

  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  const fnBody = source.slice(fnStart, fnEnd === -1 ? source.length : fnEnd);

  assert.ok(
    fnBody.includes("identifier.trim()") ||
      fnBody.includes("normalizeLoginIdentifierForLookup"),
    "getClinicUserByIdentifier debe normalizar el identifier con trim() (directo o por helper)",
  );

  assert.ok(
    fnBody.includes("eq(clinicUsers.username,"),
    "debe matchear por clinicUsers.username (rama username)",
  );

  assert.ok(
    fnBody.includes("lower(trim(") &&
      fnBody.includes("clinics.contactEmail"),
    "debe matchear por lower(trim(clinics.contactEmail)) (rama email contacto de la clínica)",
  );

  assert.ok(
    fnBody.includes(".limit(1)"),
    "debe limitar a un solo registro",
  );
});

test("getClinicUserByIdentifier usa join con clinics y NO referencia columna inexistente clinic_users.email", () => {
  const source = read("server/db.ts");

  const fnStart = source.indexOf(
    "export async function getClinicUserByIdentifier(",
  );
  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  const fnBody = source.slice(fnStart, fnEnd === -1 ? source.length : fnEnd);

  assert.ok(
    fnBody.includes("leftJoin(clinics,") ||
      fnBody.includes("innerJoin(clinics,"),
    "debe hacer join sobre la tabla clinics para acceder a contact_email (la columna no vive en clinic_users)",
  );

  assert.ok(
    fnBody.includes("clinicUsers.clinicId") &&
      fnBody.includes("clinics.id"),
    "el join debe ser por clinicUsers.clinicId = clinics.id",
  );

  assert.equal(
    fnBody.includes("clinicUsers.email"),
    false,
    "NO debe referenciar clinicUsers.email: esa columna no existe en el schema",
  );
  assert.equal(
    /\bclinic_users\.email\b/.test(fnBody),
    false,
    "NO debe referenciar clinic_users.email como columna: vive en clinics.contact_email",
  );
});

test("getClinicUserByIdentifier devuelve la forma mínima esperada por el contrato de auth (id, clinicId, username, passwordHash, authProId, role)", () => {
  const source = read("server/db.ts");

  const fnStart = source.indexOf(
    "export async function getClinicUserByIdentifier(",
  );
  const fnEnd = source.indexOf("\nexport ", fnStart + 1);
  const fnBody = source.slice(fnStart, fnEnd === -1 ? source.length : fnEnd);

  for (const field of [
    "id: clinicUsers.id",
    "clinicId: clinicUsers.clinicId",
    "username: clinicUsers.username",
    "passwordHash: clinicUsers.passwordHash",
    "authProId: clinicUsers.authProId",
    "role: clinicUsers.role",
  ]) {
    assert.ok(
      fnBody.includes(field),
      "getClinicUserByIdentifier debe seleccionar el campo: " + field,
    );
  }
});
