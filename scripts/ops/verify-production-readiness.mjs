const TIMEOUT_MS = 20_000;
const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  "success",
  "status",
  "checks",
  "uptimeSeconds",
  "responseTimeMs",
  "timestamp",
]);
const ALLOWED_CHECK_FIELDS = new Set(["database", "storage"]);

class ReadinessConfigurationError extends Error {}

function parseBaseUrl(args, env) {
  let candidate = "";

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--url") {
      candidate = args[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (argument.startsWith("--url=")) {
      candidate = argument.slice("--url=".length);
      continue;
    }

    if (!argument.startsWith("-") && !candidate) {
      candidate = argument;
    }
  }

  candidate ||= env.READINESS_BASE_URL ?? "";

  if (!candidate.trim()) {
    throw new ReadinessConfigurationError(
      "READINESS_BASE_URL or --url is required.",
    );
  }

  let baseUrl;

  try {
    baseUrl = new URL(candidate);
  } catch {
    throw new ReadinessConfigurationError(
      "The readiness URL must be a valid absolute URL.",
    );
  }

  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new ReadinessConfigurationError(
      "The readiness URL must use HTTP or HTTPS.",
    );
  }

  if (baseUrl.username || baseUrl.password) {
    throw new ReadinessConfigurationError(
      "Credentials are not allowed in the readiness URL.",
    );
  }

  baseUrl.search = "";
  baseUrl.hash = "";
  if (!baseUrl.pathname.endsWith("/")) {
    baseUrl.pathname += "/";
  }

  return baseUrl;
}

function assertExactFields(record, allowedFields, context) {
  const keys = Object.keys(record);

  if (keys.some((key) => !allowedFields.has(key))) {
    throw new Error(`${context} contains unexpected fields.`);
  }
}

function assertFiniteNonNegativeNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
}

function validateHealthPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Health response must be a JSON object.");
  }

  assertExactFields(payload, ALLOWED_TOP_LEVEL_FIELDS, "Health response");

  if (payload.success !== true || payload.status !== "ok") {
    throw new Error("Health response is not ready.");
  }

  if (
    !payload.checks ||
    typeof payload.checks !== "object" ||
    Array.isArray(payload.checks)
  ) {
    throw new Error("Health checks must be a JSON object.");
  }

  assertExactFields(payload.checks, ALLOWED_CHECK_FIELDS, "Health checks");

  if (
    payload.checks.database !== "up" ||
    payload.checks.storage !== "up"
  ) {
    throw new Error("Database or storage is not ready.");
  }

  assertFiniteNonNegativeNumber(payload.uptimeSeconds, "uptimeSeconds");
  assertFiniteNonNegativeNumber(payload.responseTimeMs, "responseTimeMs");

  if (
    typeof payload.timestamp !== "string" ||
    !Number.isFinite(Date.parse(payload.timestamp))
  ) {
    throw new Error("timestamp must be a valid date string.");
  }
}

async function fetchHealth(healthUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(healthUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Health request timed out.");
    }

    throw new Error("Health request failed.");
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const baseUrl = parseBaseUrl(process.argv.slice(2), process.env);
  const healthUrl = new URL("health", baseUrl);
  const response = await fetchHealth(healthUrl);

  if (response.status !== 200) {
    throw new Error(`Health request returned HTTP ${response.status}.`);
  }

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error("Health response is not valid JSON.");
  }

  validateHealthPayload(payload);
  process.stdout.write(
    "PASS readiness: /health returned 200 with database and storage up.\n",
  );
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Readiness failed.";
  const prefix =
    error instanceof ReadinessConfigurationError
      ? "CONFIG readiness"
      : "FAIL readiness";

  process.stderr.write(`${prefix}: ${message}\n`);
  process.exitCode = error instanceof ReadinessConfigurationError ? 2 : 1;
});
