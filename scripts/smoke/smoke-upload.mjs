import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const USERNAME = process.env.SMOKE_USERNAME ?? "admin";
const TMP_DIR = process.env.SMOKE_TMP_DIR ?? path.join(os.tmpdir(), "portal-vetneb-smoke");
const PDF_PATH = path.join(TMP_DIR, "smoke-test.pdf");
const UPLOAD_FILE_ENV = process.env.SMOKE_UPLOAD_FILE;

function requiredEnv(name) {
  const value = process.env[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} es requerido para ejecutar este smoke script.`);
  }

  return value;
}

function fail(message, error) {
  console.error("SMOKE UPLOAD FALLO");
  console.error(sanitizeText(message));

  if (error) {
    console.error(`ERROR: ${sanitizeError(error)}`);
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

function sanitizeText(text) {
  if (typeof text !== "string") {
    return "valor no textual";
  }

  const noNewlines = text.replace(/\r?\n/g, " ").trim();
  const redactedUrls = noNewlines.replace(/https?:\/\/[^\s"']+/gi, "[url-redacted]");
  const redactedTokens = redactedUrls.replace(
    /((?:token|password|cookie|authorization)[^=\s:]*)[:=][^\s,;]+/gi,
    "$1=[redacted]"
  );

  return redactedTokens.length > 300
    ? `${redactedTokens.slice(0, 300)}...`
    : redactedTokens;
}

function sanitizeError(error) {
  if (!error) {
    return "sin detalle";
  }

  if (typeof error === "string") {
    return sanitizeText(error);
  }

  if (error instanceof Error) {
    return sanitizeText(error.message);
  }

  return sanitizeText(String(error));
}

function hasCookieFlag(setCookieHeader, flag) {
  return new RegExp(`(?:^|;)\\s*${flag}(?:;|$)`, "i").test(setCookieHeader);
}

function summarizeStoragePath(storagePath) {
  if (typeof storagePath !== "string" || storagePath.trim() === "") {
    return "missing";
  }

  if (/^https?:\/\//i.test(storagePath)) {
    return "url-redacted";
  }

  if (/[?&](?:token|sig|signature|x-amz-signature|x-amz-security-token)=/i.test(storagePath)) {
    return "sanitized";
  }

  return storagePath;
}

function resolveSignedUrl(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  return (
    payload.signedUrl ??
    payload.downloadUrl ??
    payload.url ??
    payload.previewUrl ??
    payload.data?.signedUrl ??
    ""
  );
}

function resolveStoragePath(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  return (
    payload?.report?.storagePath ??
    payload?.report?.storage_path ??
    payload?.storagePath ??
    payload?.storage_path ??
    ""
  );
}

function resolveReportId(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  return (
    payload?.report?.id ??
    payload?.reportId ??
    payload?.id ??
    payload?.report?.reportId ??
    ""
  );
}

function ensureTmpPdf(targetPath = PDF_PATH) {
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

  fs.writeFileSync(targetPath, pdfContent, "utf8");
  return targetPath;
}

function resolveUploadFile() {
  if (UPLOAD_FILE_ENV && UPLOAD_FILE_ENV.trim() !== "") {
    const providedPath = path.resolve(UPLOAD_FILE_ENV);
    if (!fs.existsSync(providedPath)) {
      throw new Error(
        "SMOKE_UPLOAD_FILE fue provisto pero el archivo no existe. Ajusta la ruta o elimina la variable para usar PDF temporal."
      );
    }

    return {
      filePath: providedPath,
      generatedTemporaryFile: false,
    };
  }

  return {
    filePath: ensureTmpPdf(PDF_PATH),
    generatedTemporaryFile: true,
  };
}

async function assertStatus(response, expectedStatuses, label) {
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${label} fallo. Esperado HTTP ${expectedStatuses.join(" o ")}, recibido HTTP ${response.status}`
    );
  }
}

async function run() {
  requiredEnv("SMOKE_BASE_URL");
  requiredEnv("SMOKE_USERNAME");
  let password = requiredEnv("SMOKE_PASSWORD");

  console.log("INICIANDO SMOKE UPLOAD...");
  console.log(`BASE URL: ${BASE_URL}`);
  console.log(`USUARIO: ${USERNAME}`);

  const uploadFile = resolveUploadFile();
  const filePath = uploadFile.filePath;
  console.log(
    `PDF DE PRUEBA: ${filePath} (temporal=${uploadFile.generatedTemporaryFile ? "yes" : "no"})`
  );

  let setCookie = "";
  let loggedIn = false;

  try {
    const loginRes = await fetchOrExplain(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: USERNAME,
        password,
      }),
    });

    await assertStatus(loginRes, [200], "LOGIN");
    const loginJson = await readJson(loginRes);
    assert(loginJson?.success === true, "LOGIN no devolvio success=true");

    setCookie = loginRes.headers.get("set-cookie") ?? "";
    assert(setCookie, "NO SE RECIBIO COOKIE DE SESION");
    loggedIn = true;

    if (BASE_URL.startsWith("https://")) {
      const hasSecure = hasCookieFlag(setCookie, "Secure");
      const hasSameSiteNone = /;\s*SameSite=None(?:;|$)/i.test(setCookie);
      console.log(
        `cookieFlags secure=${hasSecure ? "yes" : "no"} sameSiteNone=${hasSameSiteNone ? "yes" : "no"}`
      );
    }

    console.log("OK /api/auth/login");

    const form = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: "application/pdf" });

    form.append("file", blob, "smoke-test.pdf");
    form.append("patientName", "SMOKE TEST");
    form.append("studyType", "PDF_PRUEBA");
    form.append("uploadDate", "2026-04-07");

    const uploadRes = await fetchOrExplain(`${BASE_URL}/api/admin/reports/upload`, {
      method: "POST",
      headers: {
        Cookie: setCookie,
      },
      body: form,
    });

    const uploadJson = await readJson(uploadRes);
    const uploadAcceptedStatus = uploadRes.status === 200 || uploadRes.status === 201;
    const uploadCreatedStatus = uploadRes.status === 201;
    void uploadCreatedStatus;
    assert(
      uploadAcceptedStatus,
      `UPLOAD FALLO: ${uploadRes.status} bodyKeys=${Object.keys(uploadJson ?? {}).join(",")}`
    );

    assert(uploadJson?.success === true, "UPLOAD NO DEVOLVIO success=true");
    assert(uploadJson?.report?.id, "UPLOAD NO DEVOLVIO report.id");
    assert(
      uploadJson?.report?.storagePath || uploadJson?.report?.storage_path,
      "UPLOAD NO DEVOLVIO report.storagePath"
    );
    assert(
      uploadJson?.report?.previewUrl || uploadJson?.previewUrl,
      "UPLOAD NO DEVOLVIO previewUrl"
    );
    assert(
      uploadJson?.report?.downloadUrl || uploadJson?.downloadUrl,
      "UPLOAD NO DEVOLVIO downloadUrl"
    );

    const reportId = resolveReportId(uploadJson);
    const storagePath = resolveStoragePath(uploadJson);

    assert(reportId, "UPLOAD NO DEVOLVIO reportId equivalente");
    assert(storagePath, "UPLOAD NO DEVOLVIO storagePath/storage_path equivalente");

    console.log("OK /api/admin/reports/upload");
    console.log(`reportId=${reportId}`);
    console.log(`storagePath=${summarizeStoragePath(storagePath)}`);

    const reportDownloadUrlRes = await fetchOrExplain(
      `${BASE_URL}/api/reports/${reportId}/download-url`,
      {
        method: "GET",
        headers: {
          Cookie: setCookie,
        },
      }
    );
    const reportDownloadUrlJson = await readJson(reportDownloadUrlRes);
    await assertStatus(reportDownloadUrlRes, [200], "REPORT DOWNLOAD URL");

    const signedUrl = resolveSignedUrl(reportDownloadUrlJson);
    assert(
      typeof signedUrl === "string" && signedUrl.trim().length > 0,
      "REPORT DOWNLOAD URL no devolvio signed URL"
    );
    console.log(`OK /api/reports/${reportId}/download-url signedUrl=present`);

    const reportsRes = await fetchOrExplain(`${BASE_URL}/api/reports`, {
      headers: {
        Cookie: setCookie,
      },
    });
    const reportsJson = await readJson(reportsRes);
    await assertStatus(reportsRes, [200], "REPORTS");
    assert(Array.isArray(reportsJson?.reports), "REPORTS NO DEVOLVIO ARRAY");
    console.log("OK /api/reports");

    const logoutRes = await fetchOrExplain(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: setCookie,
      },
    });
    await assertStatus(logoutRes, [200], "LOGOUT");
    console.log("OK /api/auth/logout");
    loggedIn = false;

    console.log("SMOKE UPLOAD COMPLETO OK");
  } finally {
    if (loggedIn && setCookie) {
      try {
        await fetchOrExplain(`${BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Cookie: setCookie,
          },
        });
      } catch {
        // Logout best-effort for cleanup; main failure is handled by the check flow.
      }
    }

    password = "";
    setCookie = "";
    delete process.env.SMOKE_PASSWORD;
  }
}

run().catch((error) => {
  fail("ERROR INESPERADO EN SMOKE UPLOAD", error);
});
