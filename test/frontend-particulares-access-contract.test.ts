import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PARTICULARES_PAGE_PATH = "frontend/src/app/particulares/page.tsx";
const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("particulares page keeps dedicated public surface metadata and noindex policy", () => {
  const source = read(PARTICULARES_PAGE_PATH);

  assert.ok(
    source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'),
  );
  assert.ok(
    source.includes(
      'import { ParticularesContent } from "@/components/public/ParticularesContent";',
    ),
  );
  assert.ok(source.includes("...createPageMetadata("));
  assert.ok(source.includes('"/particulares"'));
  assert.ok(source.includes("robots: {"));
  assert.ok(source.includes("index: false,"));
  assert.ok(source.includes("follow: false,"));
  assert.ok(source.includes("<PublicLayout>"));
  assert.ok(source.includes("<ParticularesContent />"));
});

test("particulares content keeps token-only auth dependencies", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("getParticularReportDownloadUrl,"));
  assert.ok(source.includes("getParticularReportPreviewUrl,"));
  assert.ok(source.includes("getParticularSession,"));
  assert.ok(source.includes("loginParticular,"));
  assert.ok(source.includes("logoutParticular,"));
  assert.ok(source.includes("RateLimitError,"));
  assert.equal(source.includes("loginClinic"), false);
});

test("particulares content keeps token login form contract", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes('const [token, setToken] = useState("")'));
  assert.ok(source.includes("const [rateLimitCooldown, setRateLimitCooldown] = useState(0)"));
  assert.ok(source.includes("const isBlocked = isSubmitting || rateLimitCooldown > 0"));
  assert.ok(source.includes("const response = await loginParticular({ token });"));
  assert.ok(source.includes("setRateLimitCooldown(0);"));
  assert.ok(source.includes("setSession(response.particular);"));
  assert.ok(source.includes('setToken("");'));
  assert.ok(source.includes("error instanceof RateLimitError"));
  assert.ok(source.includes("setRateLimitCooldown(error.retryAfterSeconds)"));
  assert.ok(source.includes('id="particular-token"'));
  assert.ok(source.includes('name="token"'));
  assert.ok(source.includes('type="password"'));
  assert.ok(source.includes("suppressHydrationWarning"));
  assert.ok(source.includes('autoComplete="one-time-code"'));
  assert.ok(
    source.includes('aria-label="Formulario de acceso particular por token"'),
  );
  assert.ok(source.includes("disabled={isBlocked}"));
  assert.ok(source.includes("aria-busy={isSubmitting}"));
  assert.ok(source.includes('<span role="status" aria-live="polite">'));
  assert.ok(source.includes("Validando token..."));
  assert.ok(source.includes("rateLimitCooldown > 0"));
  assert.ok(source.includes("`Espere ${rateLimitCooldown}s`"));
  assert.ok(source.includes('"Ingresar"'));
});

test("particulares content keeps isolated particular session and report actions", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("await logoutParticular();"));
  assert.ok(source.includes("setSession(null);"));
  assert.ok(source.includes('async function openReport(kind: "preview" | "download") {'));
  assert.ok(source.includes('kind === "preview"'));
  assert.ok(source.includes("? await getParticularReportPreviewUrl()"));
  assert.ok(source.includes(": await getParticularReportDownloadUrl();"));
  assert.ok(source.includes('window.open(url, "_blank", "noopener,noreferrer");'));
});

test("particulares content keeps clinics entrypoint and avoids mixed/private navigation", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("href={ROUTES.login}"));
  assert.equal(source.includes("ROUTES.dashboard"), false);
  assert.equal(source.includes("useRouter"), false);
  assert.equal(source.includes("useSearchParams"), false);
  assert.equal(source.includes('from "next/navigation"'), false);
  assert.equal(source.includes("/login?tipo=particular"), false);
});
