import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.NODE_ENV ??= "test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { getHealthCheckResponse } = await import(
  "../server/lib/http-runtime.ts"
);

const readinessScript = resolve(
  process.cwd(),
  "scripts",
  "ops",
  "verify-production-readiness.mjs",
);

type ScriptResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function runReadinessScript(
  args: string[],
  envOverrides: NodeJS.ProcessEnv = {},
): Promise<ScriptResult> {
  const env = {
    ...process.env,
    ...envOverrides,
  };

  delete env.READINESS_BASE_URL;

  if (envOverrides.READINESS_BASE_URL) {
    env.READINESS_BASE_URL = envOverrides.READINESS_BASE_URL;
  }

  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [readinessScript, ...args], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolveResult({ code, stdout, stderr });
    });
  });
}

async function withHealthServer(
  payload: Record<string, unknown>,
  callback: (input: {
    baseUrl: string;
    requests: Array<{
      method: string | undefined;
      url: string | undefined;
      headers: IncomingHttpHeaders;
    }>;
  }) => Promise<void>,
) {
  const requests: Array<{
    method: string | undefined;
    url: string | undefined;
    headers: IncomingHttpHeaders;
  }> = [];
  const server = createServer((request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload));
  });

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    await callback({
      baseUrl: `http://127.0.0.1:${address.port}`,
      requests,
    });
  } finally {
    await new Promise<void>((resolveClose, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolveClose();
      });
    });
  }
}

function healthyPayload() {
  return {
    success: true,
    status: "ok",
    checks: {
      database: "up",
      storage: "up",
    },
    uptimeSeconds: 120,
    responseTimeMs: 8,
    timestamp: "2026-06-14T12:00:00.000Z",
  };
}

test("public health keeps a stable safe shape without raw dependency errors", async () => {
  const databaseSecret =
    "postgresql://runtime-user:runtime-password@private-db/portal";
  const storageSecret = "service-role-runtime-secret";
  const timestamps = [1_000, 1_025];

  const response = await getHealthCheckResponse({
    checkDatabase: async () => {
      throw new Error(databaseSecret);
    },
    checkStorage: async () => {
      throw new Error(storageSecret);
    },
    now: () => timestamps.shift() ?? 1_025,
    uptime: () => 42.4,
  });

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.payload, {
    success: false,
    status: "degraded",
    checks: {
      database: "down",
      storage: "down",
    },
    uptimeSeconds: 42,
    responseTimeMs: 25,
    timestamp: "1970-01-01T00:00:01.025Z",
  });

  const serialized = JSON.stringify(response.payload);
  assert.equal(serialized.includes(databaseSecret), false);
  assert.equal(serialized.includes(storageSecret), false);
  assert.equal(serialized.includes("details"), false);
  assert.equal(serialized.includes("stack"), false);
});

test("readiness script fails clearly when URL is missing without printing env secrets", async () => {
  const sentinelSecret = "readiness-sentinel-secret-value";
  const result = await runReadinessScript([], {
    SUPABASE_SERVICE_ROLE_KEY: sentinelSecret,
    SMTP_PASS: sentinelSecret,
  });
  const output = result.stdout + result.stderr;

  assert.equal(result.code, 2);
  assert.match(result.stderr, /READINESS_BASE_URL or --url is required/);
  assert.equal(output.includes(sentinelSecret), false);
});

test("readiness script calls only GET /health without credentials", async () => {
  await withHealthServer(healthyPayload(), async ({ baseUrl, requests }) => {
    const result = await runReadinessScript(["--url", baseUrl]);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /PASS readiness/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.method, "GET");
    assert.equal(requests[0]?.url, "/health");
    assert.equal(requests[0]?.headers.authorization, undefined);
    assert.equal(requests[0]?.headers.cookie, undefined);
  });
});

test("readiness script rejects unexpected health fields without echoing values", async () => {
  const sentinelSecret = "postgresql://user:password@private-db/portal";

  await withHealthServer(
    {
      ...healthyPayload(),
      details: {
        databaseError: sentinelSecret,
      },
    },
    async ({ baseUrl }) => {
      const result = await runReadinessScript([baseUrl]);
      const output = result.stdout + result.stderr;

      assert.equal(result.code, 1);
      assert.match(result.stderr, /unexpected fields/);
      assert.equal(output.includes(sentinelSecret), false);
    },
  );
});

test("production readiness documentation lists env names without assignments", () => {
  const documentation = read(
    "IMPLEMENTATION_NOTES/IMPLEMENTATION_PRODUCTION_OBSERVABILITY_READINESS.md",
  );
  const requiredNames = [
    "ADMIN_COOKIE_NAME",
    "CONTACT_TO",
    "COOKIE_NAME",
    "CORS_ORIGIN",
    "DATABASE_MAX_CONNECTIONS",
    "DATABASE_URL",
    "GMAIL_API_CLIENT_ID",
    "GMAIL_API_CLIENT_SECRET",
    "GMAIL_API_FROM",
    "GMAIL_API_REFRESH_TOKEN",
    "LAB_UPLOAD_USERNAMES",
    "MAX_UPLOAD_FILE_SIZE_MB",
    "NODE_ENV",
    "OWNER_OPEN_ID",
    "PARTICULAR_COOKIE_NAME",
    "PORT",
    "SESSION_TTL_HOURS",
    "SMTP_FROM",
    "SMTP_HOST",
    "SMTP_PASS",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SUPABASE_ANON_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS",
    "SUPABASE_STORAGE_BUCKET",
    "SUPABASE_URL",
    "TRUST_PROXY",
  ];

  for (const name of requiredNames) {
    assert.ok(documentation.includes(`\`${name}\``), `missing ${name}`);
    assert.doesNotMatch(
      documentation,
      new RegExp(`${name}\\s*=`),
      `${name} must be documented without a value`,
    );
  }

  assert.doesNotMatch(documentation, /postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(documentation, /service[_ -]?role[_ -]?key\s*[:=]/i);
  assert.doesNotMatch(documentation, /refresh[_ -]?token\s*[:=]/i);
});

test("frontend CI audits the built public surface before E2E", () => {
  const workflow = read(".github/workflows/frontend-ci.yml");
  const buildIndex = workflow.indexOf(
    "      - name: Build frontend\n        run: pnpm --dir frontend build",
  );
  const auditIndex = workflow.indexOf(
    "      - name: Audit built public surface\n        run: pnpm security:public-surface",
  );
  const e2eIndex = workflow.indexOf(
    "      - name: Run frontend E2E smoke tests\n        run: pnpm --dir frontend e2e",
  );

  assert.ok(buildIndex >= 0);
  assert.ok(auditIndex > buildIndex);
  assert.ok(e2eIndex > auditIndex);
});
