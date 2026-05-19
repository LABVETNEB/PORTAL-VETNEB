import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("login password visibility starts hidden and toggles input type safely", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(
    source.includes(
      'const [isPasswordVisible, setIsPasswordVisible] = useState(false)',
    ),
  );
  assert.ok(source.includes('type={isPasswordVisible ? "text" : "password"}'));
});

test("login password visibility toggle uses explicit button semantics", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("type=\"button\""));
  assert.ok(
    source.includes("onClick={() => setIsPasswordVisible((current) => !current)}"),
  );
});

test("login password visibility exposes accessible label and pressed state", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(
    source.includes(
      'aria-label={isPasswordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}',
    ),
  );
  assert.ok(source.includes("aria-pressed={isPasswordVisible}"));
});

test("login password visibility keeps lucide eye icons contract", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(
    source.includes('import { Eye, EyeOff, ShieldCheck } from "lucide-react"'),
  );
  assert.ok(source.includes("<EyeOff className=\"h-4 w-4\" aria-hidden=\"true\" />"));
  assert.ok(source.includes("<Eye className=\"h-4 w-4\" aria-hidden=\"true\" />"));
});

test("login redirects particular surface requests to the dedicated public route", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes('if (requestedSurface === "particular") {'));
  assert.ok(source.includes("router.replace(ROUTES.particulares);"));
});

test("login particular button delegates to openParticularAccess handler", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assert.ok(source.includes("onClick={openParticularAccess}"));
  assert.ok(source.includes("function openParticularAccess() {"));
  assert.ok(source.includes("router.push(ROUTES.particulares);"));
});
