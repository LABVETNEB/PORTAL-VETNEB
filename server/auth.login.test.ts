import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { Response } from "express";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): { ctx: TrpcContext } {
  // Crear un mock de Response que sea compatible con Express
  const mockRes = {
    cookie: (
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ): Response => {
      // Mock cookie setting - retorna this para chainable API
      return mockRes as unknown as Response;
    },
    clearCookie: (name: string, options?: Record<string, unknown>): Response => {
      // Mock cookie clearing - retorna this para chainable API
      return mockRes as unknown as Response;
    },
  } as unknown as TrpcContext["res"];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: mockRes,
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
      options?: Record<string, unknown>;
    }> = [];

    // Sobrescribir clearCookie para rastrear llamadas
    const originalClearCookie = ctx.res.clearCookie;
    ctx.res.clearCookie = (
      name: string,
      options?: Record<string, unknown>,
    ): Response => {
      clearedCookies.push({ name, options });
      return ctx.res as unknown as Response;
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});
