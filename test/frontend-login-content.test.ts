import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const LOGIN_PAGE_PATH = "frontend/src/app/login/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend login content calls clinic login and redirects to dashboard", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes('import { loginClinic } from "@/lib/api"'));
  assert.ok(source.includes('import { useRouter, useSearchParams } from "next/navigation"'));
  assert.ok(source.includes("await loginClinic({ username, password })"));
  assert.ok(source.includes('router.replace(getSafeNextPath(searchParams.get("next")))'));
  assert.ok(source.includes("router.refresh()"));
});

test("frontend login content preserves dashboard next path safely", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("function getSafeNextPath(nextPath: string | null): string"));
  assert.ok(source.includes("new URL(candidate, SAFE_LOGIN_REDIRECT_ORIGIN)"));
  assert.ok(source.includes("const pathname = parsedNextPath.pathname;"));
  assert.ok(source.includes("parsedNextPath.pathname === ROUTES.dashboardAdmin"));
  assert.ok(source.includes("parsedNextPath.pathname.startsWith(`${ROUTES.dashboardAdmin}/`)"));
  assert.ok(source.includes("pathname === ROUTES.dashboard"));
  assert.ok(source.includes("pathname.startsWith(`${ROUTES.dashboard}/`)"));
  assert.ok(source.includes("return `${pathname}${parsedNextPath.search}`;"));
  assert.equal(source.includes("safePath === ROUTES.dashboardAdmin"), false);
  assert.equal(source.includes("safePath.startsWith(`${ROUTES.dashboardAdmin}/`)"), false);
  assert.equal(source.includes("return candidate;"), false);
  assert.ok(source.includes("return ROUTES.dashboard"));
});

test("frontend login content removes demo bypass and development placeholder", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.equal(source.includes("Ver dashboard (demo sin auth)"), false);
  assert.equal(source.includes("Iniciar sesión (próximamente)"), false);
  assert.equal(source.includes("Nota de desarrollo"), false);
  assert.equal(source.includes("onSubmit={(e) => e.preventDefault()}"), false);
});

test("frontend login content handles controlled credentials loading and errors", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('const [username, setUsername] = useState("")'));
  assert.ok(source.includes('const [password, setPassword] = useState("")'));
  assert.ok(source.includes("const [errorMessage, setErrorMessage]"));
  assert.ok(source.includes("const [isSubmitting, setIsSubmitting]"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("disabled={isSubmitting}"));
});

test("frontend login page wraps client search params usage in suspense", () => {
  const source = read(LOGIN_PAGE_PATH);

  assert.ok(source.includes('import { Suspense } from "react"'));
  assert.ok(source.includes("<Suspense fallback={null}>"));
  assert.ok(source.includes("<LoginContent />"));
  assert.ok(source.includes("</Suspense>"));
});
test("frontend login content keeps particular token entry on the dedicated public surface", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.equal(source.includes("Token de acceso"), false);
  assert.equal(source.includes("Ingresar con token"), false);
  assert.equal(source.includes("Ingrese el token recibido"), false);
  assert.ok(source.includes("router.replace(ROUTES.particulares);"));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={ROUTES.particulares}"));
  assert.ok(source.includes('data-auth-particular-access-link="true"'));
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("openParticularAccess"), false);
  assert.equal(source.includes("router.push(ROUTES.particulares);"), false);
});
test("frontend login content allows toggling clinic password visibility", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('import { Eye, EyeOff, ShieldCheck } from "lucide-react"'));
  assert.ok(source.includes('const [isPasswordVisible, setIsPasswordVisible] = useState(false)'));
  assert.ok(source.includes('type={isPasswordVisible ? "text" : "password"}'));
  assert.ok(source.includes('data-auth-password-input="true"'));
  assert.ok(source.includes('className="h-12 rounded-lg pr-12"'));
  assert.ok(source.includes('onClick={() => setIsPasswordVisible((current) => !current)}'));
  assert.ok(source.includes('aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}'));
  assert.ok(source.includes('aria-pressed={isPasswordVisible}'));
  assert.ok(source.includes('aria-controls="password"'));
  assert.ok(source.includes('data-auth-password-visibility-toggle="true"'));
  assert.ok(source.includes('data-auth-clinic-access-tab="true"'));
});
