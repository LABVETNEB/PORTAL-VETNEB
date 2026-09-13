import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import {
  BENIGN_HEADER_NAMES,
  KEPT_EVENT_TYPES,
  MANIFEST_FILE,
  REDACTED,
  extractReportPayload,
  readZip,
  runCli,
  sanitizeArtifacts,
  validateSanitizedTree,
  writeZip,
} from "../../../scripts/security/playwright-artifact-sanitizer.mjs";

// LIMPIEZA E2E B-4 prerequisite. The fixture mirrors the member layout and
// JSONL event shapes that Playwright 1.63.0 actually writes (measured with an
// isolated synthetic harness): every canary below was observed in raw
// test-results/ and playwright-report/ output. Values are synthetic.

const require = createRequire(import.meta.url);
const { load } = require("js-yaml") as { load: (source: string) => unknown };

const REPO_ROOT = process.cwd();
const SANITIZER_COMMAND = 'node scripts/security/playwright-artifact-sanitizer.mjs --output "${RUNNER_TEMP}/playwright-sanitized"';
const SANITIZED_UPLOAD_ROOT = "${{ runner.temp }}/playwright-sanitized/";
const SANITIZE_STEP_ID = "sanitize-playwright-artifacts";
const SANITIZE_SUCCESS = `steps.${SANITIZE_STEP_ID}.outcome == 'success'`;

// Independent of the sanitizer's own exports on purpose.
const MANDATORY_REDACTED_HEADERS = ["authorization", "proxy-authorization", "cookie", "set-cookie", "x-api-key"];

const canary = (kind: string) => `SYNTHETIC_${kind}_CANARY`;
const CANARY_RE = /SYNTHETIC_[A-Z_]+_CANARY/g;

// Secret classes: must never survive sanitization.
const SECRET_CANARIES = [
  "COOKIE",
  "SESSION",
  "SETCOOKIE",
  "AUTH",
  "APIKEY",
  "RESP_APIKEY",
  "PROXYAUTH",
  "APIREQ_AUTH",
  "APIREQ_COOKIE",
  "APIREQ_BODY",
  "BODY",
  "RESPONSE_BODY",
  "URL",
  "FILL",
  "TYPE",
  "STORAGE",
  "HIDDEN",
  "CONSOLE",
  "CUSTOM_HEADER",
  "REPORT_BODY",
  "CORRUPT",
  "UNKNOWN_FILE",
].map(canary);
// Diagnostic classes: authored assertion text and visible page text, the same
// material a failure screenshot already shows. Preserved for utility.
const DIAGNOSTIC_CANARIES = ["ERROR", "RENDERED"].map(canary);

// P1 review canaries (PR #1719). REPORT_PATH is opaque-shaped; the suite title
// also embeds the harvested cookie value, which is not opaque-shaped. The
// nested-JSON secrets are purely alphabetic so no fallback pattern can catch
// them: only inherited sensitivity does.
const REPORT_PATH_SECRET = "SYNTHETIC_REPORT_PATH_SECRET_92731";
const NESTED_JSON_SECRETS = ["PlainPassword", "PlainNestedSecret", "DeepArraySecret"];
const P1_SECRETS = [REPORT_PATH_SECRET, ...NESTED_JSON_SECRETS];
const REPORT_PATH = [`tenant-${REPORT_PATH_SECRET}`, `suite-${"SYNTHETIC_COOKIE_CANARY"}`];
const NESTED_JSON_ATTACHMENT = {
  auth: { value: "PlainPassword" },
  credentials: { nested: [{ value: "PlainNestedSecret" }] },
  session: [[{ deeper: { value: "DeepArraySecret" } }]],
  diagnostics: { value: "kept-diagnostic-value" },
};
const JSON_ATTACHMENT_SHA = "a94cbb43cf261024f91bbbbc09c68891c2c62ddf";

const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const JPEG = Buffer.from("ffd8ffe000104a464946", "hex");
const SHA_MD = "306b00f6950d56592dcd0e64cc6f8c3c8110c149";
const SHA_PNG = "47f0e989260401cb7957fbeaef8e4326c2be46cf";

type Mapping = Record<string, unknown>;

function jsonl(events: readonly unknown[]): Buffer {
  return Buffer.from(`${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
}

function traceZip(): Buffer {
  const origin = "http://127.0.0.1:49720";
  const errorMessage = `Error: deliberate failure ${canary("ERROR")}\n\nReceived: "${canary("RENDERED")}"\nCall log:\n  - cookie: sid=${canary("SESSION")}`;
  return writeZip([
    {
      name: "test.trace",
      data: jsonl([
        { version: 9, type: "context-options", origin: "testRunner", browserName: "", playwrightVersion: "1.63.0", options: {}, platform: "linux", wallTime: 1, monotonicTime: 1, sdkLanguage: "javascript" },
        { type: "before", callId: "pw:api@1", stepId: "pw:api@1", startTime: 2, class: "Test", method: "pw:api", title: "Navigate", subtitle: `127.0.0.1:49720/?token=${canary("URL")}`, params: { url: `${origin}/?token=${canary("URL")}` }, stack: [] },
        { type: "before", callId: "pw:api@2", stepId: "pw:api@2", startTime: 3, class: "Test", method: "pw:api", title: `Fill "${canary("FILL")}"`, subtitle: "locator('#pw')", params: { selector: "#pw", value: canary("FILL") }, stack: [] },
        { type: "after", callId: "pw:api@2", endTime: 4, error: { message: errorMessage, stack: errorMessage } },
        { type: "after", callId: "attach@1", endTime: 5, attachments: [{ name: "error-context", contentType: "text/markdown", file: `attachments/${SHA_MD}` }] },
        { type: "after", callId: "hook@1", endTime: 6, attachments: [{ name: "screenshot", contentType: "image/png", file: `attachments/${SHA_PNG}` }] },
        { type: "error", message: errorMessage, stack: [{ file: "/work/e2e/example.spec.ts", line: 10, column: 5 }] },
        { type: "stdout", text: canary("CONSOLE") },
      ]),
    },
    {
      name: "1-trace.trace",
      data: jsonl([
        { version: 9, type: "context-options", origin: "library", browserName: "chromium", playwrightVersion: "1.63.0", options: { viewport: { width: 1280, height: 720 }, extraHTTPHeaders: [{ name: "authorization", value: `Bearer ${canary("AUTH")}` }], httpCredentials: { username: "user", password: canary("PROXYAUTH") } }, platform: "linux", wallTime: 1, monotonicTime: 1, sdkLanguage: "javascript", title: "example.spec.ts:10 › example" },
        { type: "before", callId: "call@1", startTime: 1, class: "BrowserContext", method: "addCookies", params: { cookies: [{ name: "arbitrary_cookie_name", value: canary("COOKIE"), url: origin }] }, stepId: "pw:api@0" },
        { type: "before", callId: "call@2", startTime: 2, class: "BrowserContext", method: "setExtraHTTPHeaders", params: { headers: [{ name: "authorization", value: `Bearer ${canary("AUTH")}` }, { name: "x-api-key", value: canary("APIKEY") }] } },
        { type: "before", callId: "call@3", startTime: 3, class: "Frame", method: "goto", params: { url: `${origin}/?token=${canary("URL")}`, waitUntil: "load" } },
        { type: "log", callId: "call@3", time: 3, message: `navigating to "${origin}/?token=${canary("URL")}", waiting until "load"` },
        { type: "frame-snapshot", snapshot: { callId: "call@3", html: ["HTML", {}, ["BODY", {}, ["INPUT", { type: "hidden", value: canary("HIDDEN") }], ["INPUT", { type: "password", __playwright_value_: canary("FILL") }], ["P", {}, canary("RENDERED")]]] } },
        { type: "screencast-frame", pageId: "page@f78f424b6a99414ad467c2f69fa8cd15", file: "screencast/page@f78f424b6a99414ad467c2f69fa8cd15-1.jpeg", width: 1280, height: 720, timestamp: 4 },
        { type: "before", callId: "call@4", startTime: 4, class: "Frame", method: "fill", params: { selector: "#pw", value: canary("FILL") } },
        { type: "input", callId: "call@4", box: { x: 8, y: 97, width: 177, height: 21 } },
        { type: "log", callId: "call@4", time: 4, message: `fill("${canary("FILL")}")` },
        { type: "before", callId: "call@5", startTime: 5, class: "Frame", method: "type", params: { selector: "#user", strict: true, text: canary("TYPE") } },
        { type: "before", callId: "call@6", startTime: 6, class: "Frame", method: "evaluateExpression", params: { expression: "([a]) => localStorage.setItem('k', a)", isFunction: true, arg: { value: { a: [{ s: canary("STORAGE") }], id: 1 }, handles: [] } } },
        { type: "console", messageType: "log", text: canary("CONSOLE"), args: [{ preview: canary("CONSOLE"), value: canary("CONSOLE") }], location: { url: "", lineNumber: 2, columnNumber: 12 }, time: 7, pageId: "page@f78f424b6a99414ad467c2f69fa8cd15" },
        { type: "event", time: 7, class: "BrowserContext", method: "pageError", params: { error: { error: { message: `boom ${canary("ERROR")}`, stack: "Error: boom", name: "Error" } }, location: { url: "", line: 1, column: 1 } }, pageId: "page@f78f424b6a99414ad467c2f69fa8cd15" },
        { type: "before", callId: "call@7", startTime: 8, class: "BrowserContext", method: "storageState", params: {} },
        { type: "after", callId: "call@7", endTime: 9, result: { cookies: [{ name: "page_sid", value: canary("SESSION") }], origins: [{ origin, localStorage: [{ name: "k", value: canary("STORAGE") }] }] } },
        { type: "before", callId: "call@8", startTime: 9, title: `deliberate failure ${canary("ERROR")}`, class: "Frame", method: "expect", params: { selector: "#rendered", expression: "to.have.text", expectedText: [{ string: "never" }], expectedValue: { value: { v: "undefined" }, handles: [] }, isNot: false, timeout: 1500 } },
        { type: "log", callId: "call@8", time: 10, message: `unexpected value "${canary("RENDERED")}"` },
      ]),
    },
    {
      name: "1-trace.network",
      data: jsonl([
        {
          type: "resource-snapshot",
          snapshot: {
            pageref: "page@f78f424b6a99414ad467c2f69fa8cd15",
            startedDateTime: "2026-09-13T17:56:48.566Z",
            time: 8.5,
            request: {
              method: "GET",
              url: `${origin}/?token=${canary("URL")}`,
              httpVersion: "HTTP/1.1",
              cookies: [{ name: "arbitrary_cookie_name", value: canary("COOKIE") }],
              headers: [
                { name: "Accept", value: "text/html" },
                { name: "Cookie", value: `arbitrary_cookie_name=${canary("COOKIE")}; page_sid=${canary("SESSION")}` },
                { name: "authorization", value: `Bearer ${canary("AUTH")}` },
                { name: "x-api-key", value: canary("APIKEY") },
                { name: "x-e2e-tenant", value: canary("CUSTOM_HEADER") },
                { name: "Referer", value: `${origin}/?token=${canary("URL")}` },
              ],
              queryString: [{ name: "token", value: canary("URL") }],
              headersSize: -1,
              bodySize: 41,
              postData: { mimeType: "application/json", text: canary("BODY"), params: [], _file: "resources/c47fce485532892bd80768b2dd0513cdec93b7f8.json" },
            },
            response: {
              status: 200,
              statusText: "OK",
              httpVersion: "1.1",
              cookies: [{ name: "rotated_sid", value: canary("SETCOOKIE"), httpOnly: true }],
              headers: [
                { name: "content-type", value: "application/json" },
                { name: "set-cookie", value: `rotated_sid=${canary("SETCOOKIE")}; Path=/; HttpOnly` },
                { name: "x-api-key", value: canary("RESP_APIKEY") },
              ],
              content: { size: 57, mimeType: "application/json", _file: "resources/2f55b191dfdfe16f3ad3f558dbe3d697333e1f6c.json" },
              headersSize: -1,
              bodySize: 57,
              redirectURL: "",
            },
            timings: { send: 0, wait: 3, receive: 1 },
          },
        },
      ]),
    },
    { name: "1-trace.stacks", data: Buffer.from(JSON.stringify({ files: ["/work/e2e/example.spec.ts"], stacks: [[1, [[0, 10, 5, ""]]]] })) },
    {
      name: "0-trace.trace",
      data: jsonl([
        { type: "before", callId: "call@9", startTime: 11, class: "APIRequestContext", method: "fetch", params: { url: `${origin}/api/echo`, method: "POST", headers: [{ name: "authorization", value: `Bearer ${canary("APIREQ_AUTH")}` }, { name: "cookie", value: `api_sid=${canary("APIREQ_COOKIE")}` }, { name: "proxy-authorization", value: `Basic ${canary("PROXYAUTH")}` }], jsonData: JSON.stringify({ secret: canary("APIREQ_BODY") }) } },
        { type: "log", callId: "call@9", time: 11, message: `  authorization: Bearer ${canary("APIREQ_AUTH")}` },
        { type: "log", callId: "call@9", time: 11, message: `  cookie: api_sid=${canary("APIREQ_COOKIE")}` },
        { type: "after", callId: "call@9", endTime: 12, result: { response: { status: 200, headers: [{ name: "set-cookie", value: `rotated_sid=${canary("SETCOOKIE")}` }] } } },
      ]),
    },
    { name: "resources/c47fce485532892bd80768b2dd0513cdec93b7f8.json", data: Buffer.from(JSON.stringify({ secret: canary("BODY") })) },
    { name: "resources/2f55b191dfdfe16f3ad3f558dbe3d697333e1f6c.json", data: Buffer.from(JSON.stringify({ secret: canary("RESPONSE_BODY") })) },
    { name: "resources/23391392a7c333a82c54bf473696422a3c5940da.html", data: Buffer.from(`<input type="hidden" value="${canary("HIDDEN")}">`) },
    { name: "src/1e507513283d5fe499974af51635c134223db7b6.ts", data: Buffer.from(`await context.addCookies([{ value: "${canary("COOKIE")}" }]);`) },
    { name: "screencast/page@f78f424b6a99414ad467c2f69fa8cd15-1.jpeg", data: JPEG },
    { name: `attachments/${SHA_MD}`, data: Buffer.from(`# Error details\n\n${errorMessage}\n`) },
    { name: `attachments/${SHA_PNG}`, data: PNG },
  ]);
}

function reportHtml(): string {
  const payload = writeZip([
    {
      name: "report.json",
      data: Buffer.from(
        JSON.stringify({
          files: [{ fileId: "c507d77a01594a0503d2", fileName: "example.spec.ts", tests: [{ testId: "c507d77a01594a0503d2-2deda27a9e3a1c293b09", title: "example", path: REPORT_PATH, outcome: "unexpected" }] }],
          stats: { total: 1, unexpected: 1 },
        }),
      ),
    },
    {
      name: "c507d77a01594a0503d2.json",
      data: Buffer.from(
        JSON.stringify({
          fileId: "c507d77a01594a0503d2",
          fileName: "example.spec.ts",
          tests: [
            {
              testId: "c507d77a01594a0503d2-2deda27a9e3a1c293b09",
              title: "example",
              path: REPORT_PATH,
              outcome: "unexpected",
              results: [
                {
                  status: "failed",
                  errors: [{ message: `Error: deliberate failure ${canary("ERROR")}` }],
                  attachments: [
                    { name: "trace", contentType: "application/zip", path: "data/5951147723dee5880a5a438a5f64cf1c15f2b8b9.zip" },
                    { name: "credentials", contentType: "application/json", path: `data/${JSON_ATTACHMENT_SHA}.json` },
                    { name: "inline", contentType: "text/plain", body: canary("REPORT_BODY") },
                  ],
                  steps: [
                    { title: "Navigate", subtitle: `127.0.0.1:49720/?token=${canary("URL")}` },
                    { title: `Fill "${canary("FILL")}"`, subtitle: "locator('#pw')" },
                    { title: `Type "${canary("TYPE")}"`, subtitle: "locator('#user')" },
                  ],
                },
              ],
            },
          ],
        }),
      ),
    },
  ]);
  return `<!DOCTYPE html><html><head><script type="module">/* report app */</script></head><body><template id="playwrightReportBase64">data:application/zip;base64,${payload.toString("base64")}</template></body></html>`;
}

function writeFile(path: string, data: Buffer | string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function createRawFixture(root: string): { report: string; results: string } {
  const report = join(root, "raw", "playwright-report");
  const results = join(root, "raw", "test-results");
  const trace = traceZip();
  const testDir = join(results, "example-spec-example-chromium");
  writeFile(join(results, ".last-run.json"), JSON.stringify({ status: "failed", failedTests: ["c507d77a01594a0503d2-2deda27a9e3a1c293b09"] }));
  writeFile(join(testDir, "trace.zip"), trace);
  writeFile(join(testDir, "test-failed-1.png"), PNG);
  writeFile(join(testDir, "error-context.md"), `# Error details\n\ndeliberate failure ${canary("ERROR")}\n- paragraph: ${canary("RENDERED")}\n  - cookie: sid=${canary("SESSION")}\n`);
  writeFile(join(testDir, "video.webm"), Buffer.from(canary("UNKNOWN_FILE")));
  writeFile(join(testDir, "notes.txt"), canary("UNKNOWN_FILE"));
  writeFile(join(testDir, "corrupt.zip"), Buffer.concat([Buffer.from("504b0304", "hex"), Buffer.from(canary("CORRUPT"))]));
  writeFile(join(report, "index.html"), reportHtml());
  writeFile(join(report, "data", "5951147723dee5880a5a438a5f64cf1c15f2b8b9.zip"), trace);
  writeFile(join(report, "data", `${SHA_MD}.md`), `deliberate failure ${canary("ERROR")}\nAuthorization: Bearer ${canary("AUTH")}\n`);
  writeFile(join(report, "data", `${SHA_PNG}.png`), PNG);
  writeFile(join(report, "data", `${JSON_ATTACHMENT_SHA}.json`), JSON.stringify(NESTED_JSON_ATTACHMENT));
  writeFile(join(testDir, "attachments", `credentials-${JSON_ATTACHMENT_SHA}.json`), JSON.stringify(NESTED_JSON_ATTACHMENT));
  writeFile(join(report, "trace", "index.html"), "<!doctype html><title>Playwright Trace Viewer</title>");
  writeFile(join(report, "trace", "sw.bundle.js"), "self.addEventListener('fetch', () => {});");
  return { report, results };
}

// Scanner over decompressed content: zip members, the report's base64 payload
// and plain files. Never trusts a grep over compressed bytes.
function scanCanaries(root: string): Set<string> {
  const found = new Set<string>();
  const record = (text: string) => {
    for (const hit of text.match(CANARY_RE) ?? []) found.add(hit);
    for (const secret of P1_SECRETS) if (text.includes(secret)) found.add(secret);
  };
  const scanBuffer = (data: Buffer, name: string) => {
    record(data.toString("latin1"));
    if (data.length >= 4 && data.readUInt32LE(0) === 0x04034b50) {
      try {
        for (const entry of readZip(data)) scanBuffer(entry.data, entry.name);
      } catch {
        // Corrupt archives are still scanned as raw bytes above.
      }
    }
    if (name.endsWith("index.html")) {
      const payload = extractReportPayload(data.toString("utf8"));
      if (payload) for (const entry of readZip(payload.zip)) record(entry.data.toString("utf8"));
    }
  };
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else scanBuffer(readFileSync(path), path);
    }
  };
  walk(root);
  return found;
}

function treeDigest(root: string): string {
  const hash = createHash("sha256");
  const walk = (directory: string) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else hash.update(relative(root, path)).update(readFileSync(path));
    }
  };
  walk(root);
  return hash.digest("hex");
}

function withFixture(run: (paths: { root: string; report: string; results: string; output: string }) => void): void {
  const root = mkdtempSync(join(tmpdir(), "vetneb-pw-sanitizer-"));
  try {
    run({ root, ...createRawFixture(root), output: join(root, "staging") });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function parseEvents(data: Buffer): Mapping[] {
  return data
    .toString("utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Mapping);
}

test("raw synthetic Playwright output exposes every canary class (scanner is not vacuous)", () => {
  withFixture(({ root }) => {
    const found = scanCanaries(join(root, "raw"));
    for (const expected of [...SECRET_CANARIES, ...P1_SECRETS, ...DIAGNOSTIC_CANARIES]) {
      assert.ok(found.has(expected), `raw fixture must expose ${expected}`);
    }
    assert.ok(
      validateSanitizedTree({ root: join(root, "raw"), harvestedValues: [canary("COOKIE")] }).length > 0,
      "the staging validator must reject raw Playwright output",
    );
  });
});

test("sanitizer removes every secret canary while preserving diagnostic material", () => {
  withFixture(({ root, report, results, output }) => {
    const rawDigest = treeDigest(join(root, "raw"));
    const result = sanitizeArtifacts({ inputs: [report, results], output });

    assert.deepEqual(result.violations, []);
    assert.equal(treeDigest(join(root, "raw")), rawDigest, "raw inputs must be read-only");

    const found = scanCanaries(output);
    for (const secret of [...SECRET_CANARIES, ...P1_SECRETS]) assert.equal(found.has(secret), false, `${secret} leaked into the sanitized staging tree`);
    for (const diagnostic of DIAGNOSTIC_CANARIES) assert.ok(found.has(diagnostic), `${diagnostic} must stay available for diagnosis`);

    const omitted = result.manifest.omitted.map((entry) => entry.path).sort();
    assert.deepEqual(omitted, [
      "test-results/example-spec-example-chromium/corrupt.zip",
      "test-results/example-spec-example-chromium/notes.txt",
      "test-results/example-spec-example-chromium/video.webm",
    ]);
    for (const path of omitted) assert.equal(existsSync(join(output, path)), false, `${path} must never be copied raw`);
    assert.ok(existsSync(join(output, MANIFEST_FILE)));
    assert.ok(readFileSync(join(output, "test-results/example-spec-example-chromium/test-failed-1.png")).equals(PNG));
    assert.ok(existsSync(join(output, "playwright-report/trace/sw.bundle.js")), "the static trace viewer bundle is kept");
  });
});

test("sanitized trace.zip is a rebuilt, structurally valid, allowlisted trace", () => {
  withFixture(({ report, results, output }) => {
    sanitizeArtifacts({ inputs: [report, results], output });
    const rawEntries = readZip(traceZip());

    for (const tracePath of [
      "test-results/example-spec-example-chromium/trace.zip",
      "playwright-report/data/5951147723dee5880a5a438a5f64cf1c15f2b8b9.zip",
    ]) {
      const archive = readFileSync(join(output, tracePath));
      assert.notDeepEqual(archive, traceZip(), "the raw archive must never be reused");
      const entries = readZip(archive);
      const names = entries.map((entry) => entry.name);

      assert.deepEqual(names.sort(), [
        "0-trace.trace",
        "1-trace.network",
        "1-trace.stacks",
        "1-trace.trace",
        `attachments/${SHA_MD}`,
        `attachments/${SHA_PNG}`,
        "screencast/page@f78f424b6a99414ad467c2f69fa8cd15-1.jpeg",
        "test.trace",
      ]);

      const events = entries.filter((entry) => /\.(trace|network)$/.test(entry.name)).flatMap((entry) => parseEvents(entry.data));
      for (const event of events) assert.ok(KEPT_EVENT_TYPES.includes(String(event.type)), `unexpected event ${String(event.type)}`);
      assert.equal(events.some((event) => event.type === "frame-snapshot"), false, "DOM snapshots are dropped");

      const network = parseEvents(entries.find((entry) => entry.name === "1-trace.network")!.data);
      const rawNetwork = parseEvents(rawEntries.find((entry) => entry.name === "1-trace.network")!.data);
      assert.equal(network.length, rawNetwork.length, "network waterfall entries are preserved");
      const snapshot = network[0].snapshot as Mapping;
      const request = snapshot.request as Mapping;
      const response = snapshot.response as Mapping;
      for (const side of [request, response]) {
        for (const header of side.headers as { name: string; value: string }[]) {
          const name = header.name.toLowerCase();
          if (MANDATORY_REDACTED_HEADERS.includes(name) || !BENIGN_HEADER_NAMES.has(name)) assert.equal(header.value, REDACTED, `${header.name} must be redacted`);
        }
        for (const cookie of side.cookies as { value: string }[]) assert.equal(cookie.value, REDACTED);
      }
      assert.equal(request.url, "http://127.0.0.1:49720/?[REDACTED]");
      assert.equal(request.method, "GET");
      assert.equal(response.status, 200);
      assert.deepEqual(request.postData, { mimeType: "application/json" });
      assert.deepEqual(response.content, { size: 57, mimeType: "application/json" });

      for (const event of events) {
        const snapshotHeaders = ["request", "response"].flatMap((side) => (((event.snapshot as Mapping | undefined)?.[side] as Mapping | undefined)?.headers ?? []) as { name: string; value: unknown }[]);
        for (const header of snapshotHeaders) {
          if (MANDATORY_REDACTED_HEADERS.includes(header.name.toLowerCase())) assert.equal(header.value, REDACTED, `${header.name} must be redacted`);
        }
        const params = (event.params ?? {}) as Mapping;
        for (const key of ["headers", "cookies", "value", "text", "jsonData"]) {
          if (params[key] !== undefined) assert.equal(params[key], REDACTED, `params.${key} must be redacted`);
        }
      }

      const actions = parseEvents(entries.find((entry) => entry.name === "1-trace.trace")!.data);
      const evaluate = actions.find((event) => event.method === "evaluateExpression")!;
      assert.deepEqual((evaluate.params as Mapping).arg, { value: { s: REDACTED }, handles: [] }, "serialized values stay parseable by the viewer");
      const consoleEvent = actions.find((event) => event.type === "console")!;
      assert.equal(consoleEvent.text, REDACTED);
      assert.equal(consoleEvent.args, undefined);

      const testSteps = parseEvents(entries.find((entry) => entry.name === "test.trace")!.data);
      assert.ok(testSteps.some((event) => event.title === `Fill "${REDACTED}"`));
      assert.ok(testSteps.some((event) => event.subtitle === "127.0.0.1:49720/?[REDACTED]"));
      assert.ok(testSteps.some((event) => String((event.error as Mapping | undefined)?.message ?? "").includes(`deliberate failure ${canary("ERROR")}`)));
    }
  });
});

test("sanitized HTML report embeds a rebuilt payload without secret step titles or inline bodies", () => {
  withFixture(({ report, results, output }) => {
    sanitizeArtifacts({ inputs: [report, results], output });
    const payload = extractReportPayload(readFileSync(join(output, "playwright-report/index.html"), "utf8"));
    assert.ok(payload, "the sanitized report must still embed exactly one payload");
    const files = new Map(readZip(payload.zip).map((entry) => [entry.name, JSON.parse(entry.data.toString("utf8")) as Mapping]));
    const detail = JSON.stringify(files.get("c507d77a01594a0503d2.json"));
    assert.ok(detail.includes(`Fill \\"${REDACTED}\\"`));
    assert.ok(detail.includes(`Type \\"${REDACTED}\\"`));
    assert.ok(detail.includes("data/5951147723dee5880a5a438a5f64cf1c15f2b8b9.zip"), "attachment paths stay linked");
    assert.equal(detail.includes('"body"'), false, "inline attachment bodies are dropped");
  });
});

function reportPayloadDocuments(reportIndex: string): Map<string, Mapping> {
  const payload = extractReportPayload(readFileSync(reportIndex, "utf8"));
  assert.ok(payload, "report must embed exactly one payload");
  return new Map(readZip(payload.zip).map((entry) => [entry.name, JSON.parse(entry.data.toString("utf8")) as Mapping]));
}

function rewriteReportPayload(reportIndex: string, mutate: (documents: Map<string, Mapping>) => void): void {
  const documents = reportPayloadDocuments(reportIndex);
  mutate(documents);
  const html = readFileSync(reportIndex, "utf8");
  const zip = writeZip([...documents].map(([name, document]) => ({ name, data: Buffer.from(JSON.stringify(document)) })));
  writeFileSync(
    reportIndex,
    html.replace(/<template id="playwrightReportBase64">[^<]*<\/template>/, `<template id="playwrightReportBase64">data:application/zip;base64,${zip.toString("base64")}</template>`),
  );
}

// P1-1 (review thread PRRT_kwDOR5qlsc6h7CLS): report `tests[].path[]` carries
// describe titles, i.e. test-controlled text, under the same key name as the
// generated `attachments[].path` reference.
test("P1-1 report tests[].path[] is redacted string by string while generated references survive", () => {
  withFixture(({ root, report, results, output }) => {
    const rawDocuments = reportPayloadDocuments(join(report, "index.html"));
    assert.ok(JSON.stringify([...rawDocuments.values()]).includes(REPORT_PATH_SECRET), "raw report payload must contain the path canary");

    const result = sanitizeArtifacts({ inputs: [report, results], output });
    assert.deepEqual(result.violations, []);

    const documents = reportPayloadDocuments(join(output, "playwright-report/index.html"));
    const summary = documents.get("report.json")!;
    const detail = documents.get("c507d77a01594a0503d2.json")!;
    const summaryTest = ((summary.files as Mapping[])[0].tests as Mapping[])[0];
    const detailTest = (detail.tests as Mapping[])[0];

    for (const testEntry of [summaryTest, detailTest]) {
      const path = testEntry.path as string[];
      assert.equal(path.length, REPORT_PATH.length, "path keeps its structure");
      // The opaque rule consumes the whole hyphenated run; the harvested value is
      // replaced in place.
      assert.deepEqual(path, ["[REDACTED]", "suite-[REDACTED]"]);
      assert.equal(testEntry.testId, "c507d77a01594a0503d2-2deda27a9e3a1c293b09", "generated test id is preserved");
      assert.equal(testEntry.outcome, "unexpected");
    }
    const attachments = ((detailTest.results as Mapping[])[0].attachments as Mapping[]).map((attachment) => attachment.path);
    assert.deepEqual(attachments, ["data/5951147723dee5880a5a438a5f64cf1c15f2b8b9.zip", `data/${JSON_ATTACHMENT_SHA}.json`, undefined]);

    const serialized = JSON.stringify([...documents.values()]);
    for (const secret of [REPORT_PATH_SECRET, canary("COOKIE")]) assert.equal(serialized.includes(secret), false, `${secret} survived in the decoded report payload`);
    assert.ok(existsSync(join(root, "raw")));
  });
});

// P1-2 (review thread PRRT_kwDOR5qlsc6h7CLU): sensitivity of a JSON key must be
// inherited by every descendant string, through objects and arrays.
test("P1-2 nested JSON under a sensitive ancestor is redacted at any depth, structure and neutral values survive", () => {
  withFixture(({ report, results, output }) => {
    const rawAttachment = join(results, "example-spec-example-chromium", "attachments", `credentials-${JSON_ATTACHMENT_SHA}.json`);
    for (const secret of NESTED_JSON_SECRETS) assert.ok(readFileSync(rawAttachment, "utf8").includes(secret), `raw attachment must contain ${secret}`);

    const result = sanitizeArtifacts({ inputs: [report, results], output });
    assert.deepEqual(result.violations, []);

    const expected = {
      auth: { value: REDACTED },
      credentials: { nested: [{ value: REDACTED }] },
      session: [[{ deeper: { value: REDACTED } }]],
      diagnostics: { value: "kept-diagnostic-value" },
    };
    for (const sanitizedPath of [
      `test-results/example-spec-example-chromium/attachments/credentials-${JSON_ATTACHMENT_SHA}.json`,
      `playwright-report/data/${JSON_ATTACHMENT_SHA}.json`,
    ]) {
      const text = readFileSync(join(output, sanitizedPath), "utf8");
      assert.deepEqual(JSON.parse(text), expected);
      for (const secret of NESTED_JSON_SECRETS) assert.equal(text.includes(secret), false, `${secret} survived in ${sanitizedPath}`);
    }
  });
});

test("validator independently rejects an unsafe report path and unsafe nested JSON injected into staging", () => {
  withFixture(({ report, results, output }) => {
    assert.deepEqual(sanitizeArtifacts({ inputs: [report, results], output }).violations, []);
    const reportIndex = join(output, "playwright-report/index.html");
    const cleanIndex = readFileSync(reportIndex, "utf8");

    // Harvested (non opaque) value in a suite title.
    rewriteReportPayload(reportIndex, (documents) => {
      ((documents.get("c507d77a01594a0503d2.json")!.tests as Mapping[])[0]).path = ["suite-SYNTHETIC_SECRET"];
    });
    const harvestedPathViolations = validateSanitizedTree({ root: output, harvestedValues: ["SYNTHETIC_SECRET"] });
    assert.ok(
      harvestedPathViolations.some((violation) => violation.path.endsWith("::c507d77a01594a0503d2.json") && violation.rule === "harvested-secret-value"),
      JSON.stringify(harvestedPathViolations),
    );

    // Opaque-shaped value in a suite title, with nothing harvested at all.
    writeFileSync(reportIndex, cleanIndex);
    rewriteReportPayload(reportIndex, (documents) => {
      ((documents.get("report.json")!.files as Mapping[])[0].tests as Mapping[])[0].path = [`tenant-${REPORT_PATH_SECRET}`];
    });
    const opaquePathViolations = validateSanitizedTree({ root: output, harvestedValues: [] });
    assert.ok(opaquePathViolations.some((violation) => violation.path.endsWith("::report.json")), JSON.stringify(opaquePathViolations));

    // A generated-reference key never exempts a non-matching value.
    writeFileSync(reportIndex, cleanIndex);
    rewriteReportPayload(reportIndex, (documents) => {
      const attachment = (((documents.get("c507d77a01594a0503d2.json")!.tests as Mapping[])[0].results as Mapping[])[0].attachments as Mapping[])[0];
      attachment.path = `data/${REPORT_PATH_SECRET}.zip`;
    });
    assert.ok(validateSanitizedTree({ root: output, harvestedValues: [] }).length > 0, "attachment path outside the data/<sha1> format must be checked");
    writeFileSync(reportIndex, cleanIndex);
    assert.deepEqual(validateSanitizedTree({ root: output, harvestedValues: [] }), []);

    for (const unsafe of [
      { auth: { value: "PlainPassword" } },
      { credentials: { nested: [{ value: "PlainPassword" }] } },
      { apiKey: [["PlainPassword"]] },
      { csrf: { deep: { deeper: { value: "PlainPassword" } } } },
    ]) {
      const injected = join(output, "test-results", "injected.json");
      writeFileSync(injected, JSON.stringify(unsafe));
      const violations = validateSanitizedTree({ root: output, harvestedValues: [] });
      assert.deepEqual(violations, [{ path: "test-results/injected.json", rule: "sensitive-ancestor-value" }], JSON.stringify(unsafe));
      rmSync(injected);
    }

    rewriteReportPayload(reportIndex, (documents) => {
      documents.get("report.json")!.metadata = { session: { value: "PlainPassword" } };
    });
    assert.ok(
      validateSanitizedTree({ root: output, harvestedValues: [] }).some((violation) => violation.rule === "sensitive-ancestor-value"),
      "report payload JSON also enforces inherited sensitivity",
    );
  });
});

test("canary matrix: every required secret class is present raw and absent after sanitization", () => {
  withFixture(({ root, report, results, output }) => {
    const matrix: Record<string, string> = {
      "report.title": canary("FILL"),
      "report.subtitle": canary("URL"),
      "report.path[]": REPORT_PATH_SECRET,
      "nested sensitive object": "PlainPassword",
      "nested sensitive array": "DeepArraySecret",
      "authorization header": canary("AUTH"),
      cookie: canary("COOKIE"),
      "set-cookie": canary("SETCOOKIE"),
      "proxy-authorization": canary("PROXYAUTH"),
      "x-api-key": canary("APIKEY"),
      "query value": canary("URL"),
      "fill/type parameters": canary("TYPE"),
      "storage state": canary("STORAGE"),
      "JSON attachment": "PlainNestedSecret",
    };
    const raw = scanCanaries(join(root, "raw"));
    assert.deepEqual(sanitizeArtifacts({ inputs: [report, results], output }).violations, []);
    const sanitized = scanCanaries(output);
    for (const [label, secret] of Object.entries(matrix)) {
      assert.ok(raw.has(secret), `RAW must contain ${label}`);
      assert.equal(sanitized.has(secret), false, `SANITIZED must not contain ${label}`);
    }
  });
});

test("sanitizer fails closed: overlapping, non-empty or rejected staging never yields an uploadable tree", () => {
  withFixture(({ root, report, results, output }) => {
    assert.throws(() => sanitizeArtifacts({ inputs: [report, results], output: join(results, "nested") }), /overlap/);
    assert.throws(() => sanitizeArtifacts({ inputs: [results], output: results }), /overlap/);

    writeFile(join(output, "stale.txt"), "stale");
    assert.throws(() => sanitizeArtifacts({ inputs: [report, results], output }), /absent or empty/);
    assert.equal(runCli(["--output", output, "--input", report, "--input", results]), 1);
    rmSync(output, { recursive: true, force: true });

    const rejected = sanitizeArtifacts({
      inputs: [report, results],
      output,
      validate: () => [{ path: "forced", rule: "forced-violation" }],
    });
    assert.equal(rejected.violations.length, 1);
    assert.equal(existsSync(output), false, "a rejected staging tree is deleted before any upload step can see it");

    assert.equal(runCli(["--output", output]), 1, "missing inputs is a failure, not an empty success");
    assert.equal(runCli(["--input", report]), 1);
    assert.equal(runCli(["--output", output, "--input", report, "--bogus", "x"]), 1);
    assert.equal(existsSync(output), false);

    assert.equal(runCli(["--output", output, "--input", report, "--input", results]), 0);
    assert.deepEqual(validateSanitizedTree({ root: output, harvestedValues: [] }), []);
    assert.ok(existsSync(join(root, "raw", "test-results", "example-spec-example-chromium", "video.webm")), "raw inputs are never deleted");
  });
});

test("sanitizer tolerates absent inputs without inventing content", () => {
  const root = mkdtempSync(join(tmpdir(), "vetneb-pw-sanitizer-empty-"));
  try {
    const output = join(root, "staging");
    const result = sanitizeArtifacts({ inputs: [join(root, "playwright-report"), join(root, "test-results")], output });
    assert.deepEqual(result.violations, []);
    assert.deepEqual(readdirSync(output), [MANIFEST_FILE]);
    assert.deepEqual(result.manifest.inputs, [
      { name: "playwright-report", present: false },
      { name: "test-results", present: false },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Workflow boundary: raw Playwright output can never reach upload-artifact.
// ---------------------------------------------------------------------------

type Step = Mapping & { name?: string; id?: string; if?: string; run?: string; uses?: string; with?: Mapping };

const PLAYWRIGHT_WORKFLOWS: Record<string, { rawInputs: readonly string[]; sanitizeIf: string }> = {
  ".github/workflows/frontend-ci.yml": { rawInputs: ["frontend/playwright-report", "frontend/test-results"], sanitizeIf: "failure()" },
  ".github/workflows/e2e-completeness.yml": { rawInputs: ["frontend/playwright-report", "frontend/test-results"], sanitizeIf: "failure()" },
  ".github/workflows/visual-regression-manual.yml": {
    rawInputs: ["frontend/playwright-report", "frontend/test-results", '"${RUNNER_TEMP}/visual-production-candidate"'],
    sanitizeIf: "${{ always() && inputs.upload_artifacts }}",
  },
};
// Not Playwright runtime output: tracked snapshot baselines (PNG only) and the SBOM.
const NON_PLAYWRIGHT_UPLOAD_PATHS = new Set(["frontend/e2e/**/*.png", "sbom/portal-vetneb.cdx.json"]);

function workflowJobs(workflowPath: string): [string, Step[]][] {
  const document = load(readFileSync(resolve(REPO_ROOT, workflowPath), "utf8")) as Mapping;
  return Object.entries(document.jobs as Mapping).map(([name, job]) => [name, ((job as Mapping).steps ?? []) as Step[]]);
}

function uploadPaths(step: Step): string[] {
  return String(step.with?.path ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function unwrapExpression(condition: string): string {
  const trimmed = condition.trim();
  return trimmed.startsWith("${{") && trimmed.endsWith("}}") ? trimmed.slice(3, -2).trim() : trimmed;
}

// Evaluates the upload condition for a given sanitize outcome, assuming every
// other conjunct is true (failure, always, inputs). Only a pure conjunction is
// accepted, so the sanitize-success conjunct can never be bypassed by `||`.
function uploadRunsWhen(condition: string, sanitizeOutcome: "success" | "failure" | "skipped"): boolean {
  const expression = unwrapExpression(condition);
  assert.equal(/\|\||!(?!=)/.test(expression), false, `upload condition must be a pure conjunction: ${expression}`);
  return expression.split("&&").every((part) => {
    const term = part.trim();
    if (term === SANITIZE_SUCCESS) return sanitizeOutcome === "success";
    assert.match(term, /^(failure\(\)|always\(\)|inputs\.[a-z_]+|inputs\.[a-z_]+ == '[a-z-]+')$/, `unexpected upload condition term: ${term}`);
    return true;
  });
}

test("every Playwright artifact upload reads only the sanitized staging directory", () => {
  const workflowFiles = readdirSync(resolve(REPO_ROOT, ".github/workflows")).filter((name) => /\.ya?ml$/.test(name));
  let uploads = 0;

  for (const file of workflowFiles) {
    const workflowPath = `.github/workflows/${file}`;
    for (const [jobName, steps] of workflowJobs(workflowPath)) {
      for (const step of steps) {
        if (!String(step.uses ?? "").startsWith("actions/upload-artifact@")) continue;
        uploads += 1;
        for (const path of uploadPaths(step)) {
          if (NON_PLAYWRIGHT_UPLOAD_PATHS.has(path)) continue;
          assert.ok(
            path.startsWith(SANITIZED_UPLOAD_ROOT),
            `${workflowPath} › ${jobName} › ${String(step.name)} uploads a non-sanitized path: ${path}`,
          );
        }
        assert.equal(step["continue-on-error"], undefined);
      }
    }
  }
  assert.ok(uploads >= 4, "the guard must actually inspect upload steps");
});

test("sanitized uploads are gated on a preceding fail-closed sanitizer step", () => {
  for (const [workflowPath, contract] of Object.entries(PLAYWRIGHT_WORKFLOWS)) {
    let sanitizedUploads = 0;
    for (const [jobName, steps] of workflowJobs(workflowPath)) {
      const sanitizeIndex = steps.findIndex((step) => step.id === SANITIZE_STEP_ID);
      steps.forEach((step, index) => {
        if (!uploadPaths(step).some((path) => path.startsWith(SANITIZED_UPLOAD_ROOT))) return;
        sanitizedUploads += 1;
        const label = `${workflowPath} › ${jobName} › ${String(step.name)}`;
        assert.ok(sanitizeIndex >= 0 && sanitizeIndex < index, `${label} must run after the sanitizer step`);
        assert.equal(uploadRunsWhen(String(step.if), "success"), true, `${label} must upload after a successful sanitization`);
        assert.equal(uploadRunsWhen(String(step.if), "failure"), false, `${label} must not upload when sanitization fails`);
        assert.equal(uploadRunsWhen(String(step.if), "skipped"), false, `${label} must not upload when sanitization did not run`);
      });

      if (sanitizeIndex < 0) continue;
      const sanitize = steps[sanitizeIndex];
      const run = String(sanitize.run).trim();
      assert.equal(sanitize.if, contract.sanitizeIf, `${workflowPath} sanitizer must run exactly when raw output may exist`);
      assert.ok(run.startsWith(SANITIZER_COMMAND), `${workflowPath} sanitizer must write to the dedicated staging root`);
      assert.equal(run.split("\n").length, 1, "the sanitizer invocation is a single command");
      for (const input of contract.rawInputs) assert.ok(run.includes(`--input ${input}`), `${workflowPath} sanitizer must read ${input}`);
      for (const forbidden of ["||", "exit", "continue-on-error", "true;"]) assert.equal(run.includes(forbidden), false, `sanitizer run must not contain ${forbidden}`);
      assert.equal(sanitize["continue-on-error"], undefined);
      assert.equal(sanitize["timeout-minutes"], 5);
    }
    assert.ok(sanitizedUploads >= 1, `${workflowPath} must upload sanitized Playwright artifacts`);
  }
});
