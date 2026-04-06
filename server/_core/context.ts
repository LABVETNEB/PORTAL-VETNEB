import type { Request, Response } from "express";
import {
  getActiveSessionByToken,
  getClinicUserById,
  updateSessionLastAccess,
} from "../db";

const COOKIE_NAME = "app_session_id";

type ContextOptions = {
  req: Request;
  res: Response;
};

export async function createContext(opts: ContextOptions) {
  let user = null;
  let clinicId: number | undefined;
  let clinicUserId: number | undefined;

  try {
    const cookies = opts.req.headers.cookie || "";
    const cookieMatch = cookies
      .split(";")
      .find((c: string) => c.trim().startsWith(`${COOKIE_NAME}=`));

    if (cookieMatch) {
      const token = cookieMatch.split("=")[1]?.trim();

      if (token) {
        const session = await getActiveSessionByToken(token);

        if (session) {
          await updateSessionLastAccess(token);

          const clinicUser = await getClinicUserById(session.clinicUserId);

          if (clinicUser) {
            clinicId = clinicUser.clinicId;
            clinicUserId = clinicUser.id;
          }
        }
      }
    }
  } catch {
    // ignorar errores de contexto
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    clinicId,
    clinicUserId,
  };
}

export type AppContext = Awaited<ReturnType<typeof createContext>>;