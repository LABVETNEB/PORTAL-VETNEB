import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const USERNAME = process.env.SMOKE_USERNAME ?? "admin";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "admin123";
const TMP_DIR = process.env.SMOKE_TMP_DIR ?? "C:\\PORTAL-VETNEB\\tmp";
const PDF_PATH = path.join(TMP_DIR, "smoke-test.pdf");

function fail(message, error) {
  console.error("SMOKE UPLOAD FALLO");
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

function ensureTmpPdf() {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const pdfContent = `%PDF-1.1
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 18 Tf
72 100 Td
(SMOKE TEST PDF) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000063 00000 n
0000000122 00000 n
0000000248 00000 n
0000000343 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
413
%%EOF`;

  fs.writeFileSync(PDF_PATH, pdfContent, "utf8");
  return PDF_PATH;
}

async function run() {
  console.log("INICIANDO SMOKE UPLOAD...");
  console.log(`BASE URL: ${BASE_URL}`);
  console.log(`USUARIO: ${USERNAME}`);

  const filePath = ensureTmpPdf();
  console.log(`PDF DE PRUEBA: ${filePath}`);

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
    `LOGIN FALLO: ${loginRes.status} ${JSON.stringify(loginJson, null, 2)}`
  );

  const setCookie = loginRes.headers.get("set-cookie");
  assert(setCookie, "NO SE RECIBIO COOKIE DE SESION");
  console.log("OK /api/auth/login");

  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "application/pdf" });

  form.append("file", blob, "smoke-test.pdf");
  form.append("patientName", "SMOKE TEST");
  form.append("studyType", "PDF_PRUEBA");
  form.append("uploadDate", "2026-04-07");

  const uploadRes = await fetchOrExplain(`${BASE_URL}/api/reports/upload`, {
    method: "POST",
    headers: {
      Cookie: setCookie,
    },
    body: form,
  });

  const uploadJson = await readJson(uploadRes);

  if (uploadRes.status !== 201) {
    console.error("DETALLE DE RESPUESTA UPLOAD:");
    console.error(JSON.stringify(uploadJson, null, 2));
  }

  assert(
    uploadRes.status === 201,
    `UPLOAD FALLO: ${uploadRes.status} ${JSON.stringify(uploadJson, null, 2)}`
  );

  assert(uploadJson?.success === true, "UPLOAD NO DEVOLVIO success=true");
  assert(uploadJson?.report?.id, "UPLOAD NO DEVOLVIO report.id");
  assert(uploadJson?.report?.storagePath, "UPLOAD NO DEVOLVIO report.storagePath");
  assert(uploadJson?.report?.previewUrl, "UPLOAD NO DEVOLVIO previewUrl");
  assert(uploadJson?.report?.downloadUrl, "UPLOAD NO DEVOLVIO downloadUrl");

  console.log("OK /api/reports/upload");
  console.log(`REPORT ID: ${uploadJson.report.id}`);

  const reportsRes = await fetchOrExplain(`${BASE_URL}/api/reports`, {
    headers: {
      Cookie: setCookie,
    },
  });

  const reportsJson = await readJson(reportsRes);

  assert(
    reportsRes.ok,
    `REPORTS FALLO: ${reportsRes.status} ${JSON.stringify(reportsJson, null, 2)}`
  );
  assert(Array.isArray(reportsJson?.reports), "REPORTS NO DEVOLVIO ARRAY");
  console.log("OK /api/reports");

  const logoutRes = await fetchOrExplain(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: setCookie,
    },
  });

  const logoutJson = await readJson(logoutRes);
  assert(
    logoutRes.ok,
    `LOGOUT FALLO: ${logoutRes.status} ${JSON.stringify(logoutJson, null, 2)}`
  );
  console.log("OK /api/auth/logout");

  console.log("SMOKE UPLOAD COMPLETO OK");
}

run().catch((error) => {
  fail("ERROR INESPERADO EN SMOKE UPLOAD", error);
});
