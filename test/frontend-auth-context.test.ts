import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const AUTH_CONTEXT_PATH = "frontend/src/context/AuthContext.tsx";
const USE_AUTH_PATH = "frontend/src/hooks/useAuth.ts";
const ROOT_LAYOUT_PATH = "frontend/src/app/layout.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend auth context exposes clinic session state and actions", () => {
  assert.equal(existsSync(resolve(process.cwd(), AUTH_CONTEXT_PATH)), true);

  const source = read(AUTH_CONTEXT_PATH);

  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes('import { getClinicSession, logout as logoutClinic } from "@/lib/api"'));
  assert.ok(source.includes("type AuthContextValue"));
  assert.ok(source.includes("user: AuthUser | null"));
  assert.ok(source.includes("isLoading: boolean"));
  assert.ok(source.includes("isAuthenticated: boolean"));
  assert.ok(source.includes("refreshSession: () => Promise<AuthUser | null>"));
  assert.ok(source.includes("logout: () => Promise<void>"));
  assert.ok(source.includes("export const AuthContext = createContext<AuthContextValue | null>(null)"));
});

test("frontend auth provider loads session and clears user on logout", () => {
  const source = read(AUTH_CONTEXT_PATH);

  assert.ok(source.includes("export function AuthProvider"));
  assert.ok(source.includes("const [user, setUser] = useState<AuthUser | null>(null)"));
  assert.ok(source.includes("const [isLoading, setIsLoading] = useState(true)"));
  assert.ok(source.includes("const session = await getClinicSession()"));
  assert.ok(source.includes("setUser(session)"));
  assert.ok(source.includes("await logoutClinic()"));
  assert.ok(source.includes("setUser(null)"));
  assert.ok(source.includes("useEffect(() =>"));
  assert.ok(source.includes("void refreshSession()"));
});

test("frontend useAuth hook requires provider", () => {
  assert.equal(existsSync(resolve(process.cwd(), USE_AUTH_PATH)), true);

  const source = read(USE_AUTH_PATH);

  assert.ok(source.includes('"use client"'));
  assert.ok(source.includes('import { AuthContext } from "@/context/AuthContext"'));
  assert.ok(source.includes("useContext(AuthContext)"));
  assert.ok(source.includes("throw new Error(\"useAuth must be used within AuthProvider\")"));
  assert.ok(source.includes("return context"));
});

test("frontend root layout remains server-rendered without global auth provider", () => {
  const source = read(ROOT_LAYOUT_PATH);

  assert.equal(
    source.includes('import { AuthProvider } from "@/context/AuthContext"'),
    false,
  );
  assert.equal(source.includes("<AuthProvider>{children}</AuthProvider>"), false);
});
