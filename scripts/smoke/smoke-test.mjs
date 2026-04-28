import "dotenv/config";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const USERNAME = process.env.SMOKE_USERNAME ?? "admin";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "admin123";

function fail(message, error) {
  console.error("SMOKE TEST FALLO");
  console.error(message);

  if (error) {
    console.error(error);
  }

  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function fetchOrExplain(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error?.cause?.code === "ECONNREFUSED") {
      fail(
        `NO HAY SERVIDOR ESCUCHANDO EN ${BASE_URL}\nLEVANTA 'pnpm dev' EN OTRA TERMINAL`
      );
    }

    fail(`ERROR DE RED AL INTENTAR ACCEDER A ${url}`, error);
  }
}

async function run() {
  console.log("INICIANDO SMOKE TEST...");
  console.log(`BASE URL: ${BASE_URL}`);
  console.log(`USUARIO: ${USERNAME}`);

  // HEALTH
  const healthRes = await fetchOrExplain(`${BASE_URL}/health`);
  const healthJson = await readJson(healthRes);

  assert(healthRes.ok, `HEALTH FALLO: ${healthRes.status}`);
  assert(healthJson?.checks?.database === "up", "DATABASE NO ESTA UP");
  assert(healthJson?.checks?.storage === "up", "STORAGE NO ESTA UP");
  console.log("OK /health");

  // LOGIN
  const loginRes = await fetchOrExplain(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: USERNAME,
      password: PASSWORD,
    }),
  });

  const loginJson = await readJson(loginRes);
  assert(
    loginRes.ok,
    `LOGIN FALLO: ${loginRes.status} ${JSON.stringify(loginJson)}`
  );

  const setCookie = loginRes.headers.get("set-cookie");
  assert(setCookie, "NO SE RECIBIO COOKIE DE SESION");
  console.log("OK /api/auth/login");

  // /ME
  const meRes = await fetchOrExplain(`${BASE_URL}/api/auth/me`, {
    headers: {
      Cookie: setCookie,
    },
  });

  const meJson = await readJson(meRes);
  assert(meRes.ok, `ME FALLO: ${meRes.status} ${JSON.stringify(meJson)}`);
  assert(
    meJson?.clinicUser?.username === USERNAME,
    "EL USUARIO DEVUELTO NO COINCIDE"
  );
  console.log("OK /api/auth/me");

  // REPORTS
  const reportsRes = await fetchOrExplain(`${BASE_URL}/api/reports`, {
    headers: {
      Cookie: setCookie,
    },
  });

  const reportsJson = await readJson(reportsRes);
  assert(
    reportsRes.ok,
    `REPORTS FALLO: ${reportsRes.status} ${JSON.stringify(reportsJson)}`
  );
  assert(Array.isArray(reportsJson?.reports), "REPORTS NO DEVOLVIO ARRAY");
  console.log("OK /api/reports");

  // STUDY TYPES
  const studyTypesRes = await fetchOrExplain(
    `${BASE_URL}/api/reports/study-types`,
    {
      headers: {
        Cookie: setCookie,
      },
    }
  );

  const studyTypesJson = await readJson(studyTypesRes);
  assert(
    studyTypesRes.ok,
    `STUDY-TYPES FALLO: ${studyTypesRes.status} ${JSON.stringify(studyTypesJson)}`
  );
  assert(
    Array.isArray(studyTypesJson?.studyTypes),
    "STUDY-TYPES NO DEVOLVIO ARRAY"
  );
  console.log("OK /api/reports/study-types");

  // LOGOUT
  const logoutRes = await fetchOrExplain(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: setCookie,
    },
  });

  const logoutJson = await readJson(logoutRes);
  assert(
    logoutRes.ok,
    `LOGOUT FALLO: ${logoutRes.status} ${JSON.stringify(logoutJson)}`
  );
  console.log("OK /api/auth/logout");

  // /ME DESPUES DE LOGOUT
  const meAfterLogoutRes = await fetchOrExplain(`${BASE_URL}/api/auth/me`, {
    headers: {
      Cookie: setCookie,
    },
  });

  const meAfterLogoutJson = await readJson(meAfterLogoutRes);
  assert(
    meAfterLogoutRes.status === 401,
    `ME DESPUES DE LOGOUT DEBIO DAR 401 Y DIO ${meAfterLogoutRes.status} ${JSON.stringify(meAfterLogoutJson)}`
  );
  console.log("OK /api/auth/me DESPUES DE LOGOUT");

  console.log("SMOKE TEST COMPLETO OK");
}

run().catch((error) => {
  fail("ERROR INESPERADO EN SMOKE TEST", error);
});
