import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as crypto from "crypto";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (
        name: string,
        value: string,
        options: Record<string, unknown>,
      ) => {
        // Mock cookie setting
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        // Mock cookie clearing
      },
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.login", () => {
  it("should reject invalid credentials", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.login({
        username: "nonexistent",
        password: "wrong",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toContain("Usuario o contraseña inválidos");
    }
  });

  it("should require username and password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.login({
        username: "",
        password: "",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("BAD_REQUEST");
    }
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx } = createPublicContext();
    const clearedCookies: Array<{
      name: string;
      options: Record<string, unknown>;
    }> = [];

    ctx.res.clearCookie = (name: string, options: Record<string, unknown>) => {
      clearedCookies.push({ name, options });
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});
