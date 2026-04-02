import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  clinicId?: number;
  clinicUserId?: number;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  let user: User | null = null;
  let clinicId: number | undefined;
  let clinicUserId: number | undefined;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Obtener sesión de clínica desde cookie
  try {
    const cookies = opts.req.headers.cookie || "";
    const cookieMatch = cookies
      .split(";")
      .find((c) => c.trim().startsWith(COOKIE_NAME));

    if (cookieMatch) {
      const token = cookieMatch.split("=")[1]?.trim();
      if (token) {
        const session = await db.getActiveSessionByToken(token);
        if (session) {
          // Actualizar último acceso
          await db.updateSessionLastAccess(token);

          const clinicUser = await db.getClinicUserById(session.clinicUserId);
          if (clinicUser) {
            clinicId = clinicUser.clinicId;
            clinicUserId = clinicUser.id;
          }
        }
      }
    }
  } catch (error) {
    // Sesión de clínica es opcional
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    clinicId,
    clinicUserId,
  };
}
