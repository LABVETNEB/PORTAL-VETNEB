const FRONTEND_URL = (process.env.PROD_FRONTEND_URL ?? "https://vetneb.com.ar").replace(/\/+$/, "");
const API_URL = (process.env.PROD_API_URL ?? "https://api.vetneb.com.ar").replace(/\/+$/, "");

const TIMEOUT_MS = 15_000;

function fail(message, error) {
  console.error("SMOKE PROD PUBLIC FALLO");
  console.error(message);
  if (error) {
    console.error(error instanceof Error ? error.message : String(error));
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

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      fail(`TIMEOUT (>${TIMEOUT_MS}ms): ${url}`);
    }
    fail(`ERROR DE RED: ${url}`, error);
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  console.log("INICIANDO SMOKE PROD PUBLIC");
  console.log(`FRONTEND : ${FRONTEND_URL}`);
  console.log(`API      : ${API_URL}`);
  console.log("");

  // GET /health
  const healthRes = await fetchWithTimeout(`${API_URL}/health`);
  const healthJson = await readJson(healthRes);

  assert(healthRes.ok, `HEALTH HTTP ${healthRes.status}`);
  assert(healthJson?.success === true, `HEALTH success=${healthJson?.success} (esperado true)`);
  if (healthJson?.status !== undefined) {
    assert(healthJson.status === "ok", `HEALTH status=${healthJson.status} (esperado ok)`);
  }
  assert(healthJson?.checks?.database === "up", `HEALTH checks.database=${healthJson?.checks?.database} (esperado up)`);
  assert(healthJson?.checks?.storage === "up", `HEALTH checks.storage=${healthJson?.checks?.storage} (esperado up)`);
  console.log("OK /health");

  // GET frontend /
  const frontendRes = await fetchWithTimeout(`${FRONTEND_URL}/`);
  assert(frontendRes.ok, `FRONTEND HTTP ${frontendRes.status}`);
  console.log(`OK ${FRONTEND_URL}/`);

  // GET /robots.txt
  const robotsRes = await fetchWithTimeout(`${FRONTEND_URL}/robots.txt`);
  assert(robotsRes.ok, `ROBOTS.TXT HTTP ${robotsRes.status}`);
  console.log("OK /robots.txt");

  // GET /sitemap.xml
  const sitemapRes = await fetchWithTimeout(`${FRONTEND_URL}/sitemap.xml`);
  assert(sitemapRes.ok, `SITEMAP.XML HTTP ${sitemapRes.status}`);
  const sitemapText = await sitemapRes.text();
  assert(sitemapText.includes(FRONTEND_URL), `SITEMAP no contiene ${FRONTEND_URL}`);
  console.log("OK /sitemap.xml");

  console.log("");
  console.log("SMOKE PROD PUBLIC COMPLETO OK");
}

run().catch((error) => {
  fail("ERROR INESPERADO EN SMOKE PROD PUBLIC", error);
});
