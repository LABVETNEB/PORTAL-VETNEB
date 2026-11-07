const DB_URL_VARS = ["SUPABASE_DB_URL", "DATABASE_URL"];

function pickDefined(env) {
  const picked = {};
  for (const name of DB_URL_VARS) {
    if (Object.prototype.hasOwnProperty.call(env, name)) {
      picked[name] = (env[name] ?? "").trim();
    }
  }
  return picked;
}

export function resolveDrizzleDbUrl(processEnv, dotenvEnv) {
  const explicit = pickDefined(processEnv);
  const source =
    Object.keys(explicit).length > 0 ? explicit : pickDefined(dotenvEnv);
  const found = Object.entries(source).filter(([, value]) => value !== "");

  if (found.length === 0) {
    throw new Error("Falta SUPABASE_DB_URL o DATABASE_URL (proceso o .env).");
  }

  if (found.length === 2 && found[0][1] !== found[1][1]) {
    throw new Error(
      "SUPABASE_DB_URL y DATABASE_URL apuntan a destinos distintos; defina solo una o la misma URL en ambas.",
    );
  }

  const [name, value] = found[0];
  let protocol;
  try {
    protocol = new URL(value).protocol;
  } catch {
    throw new Error(`${name} no es una URL valida.`);
  }

  if (protocol !== "postgres:" && protocol !== "postgresql:") {
    throw new Error(`${name} debe usar postgres:// o postgresql://.`);
  }

  return value;
}
