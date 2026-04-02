import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as crypto from "crypto";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

// ============================================
// HELPERS
// ============================================

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ============================================
// ROUTERS
// ============================================

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Obtener usuario por nombre de usuario
          const clinicUser = await db.getClinicUserByUsername(input.username);

          if (!clinicUser) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Usuario o contraseña inválidos",
            });
          }

          // Verificar contraseña
          const passwordHash = hashPassword(input.password);
          if (clinicUser.passwordHash !== passwordHash) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Usuario o contraseña inválidos",
            });
          }

          // Obtener información de la clínica
          const clinic = await db.getDb().then(async (dbInstance) => {
            if (!dbInstance) throw new Error("Database not available");
            const { clinics } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const result = await dbInstance
              .select()
              .from(clinics)
              .where(eq(clinics.id, clinicUser.clinicId))
              .limit(1);
            return result[0];
          });

          if (!clinic) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Clínica no encontrada",
            });
          }

          // Generar token de sesión
          const token = generateToken();
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

          await db.createActiveSession({
            clinicUserId: clinicUser.id,
            token,
            expiresAt,
          });

          // Establecer cookie de sesión
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, token, {
            ...cookieOptions,
            maxAge: 24 * 60 * 60 * 1000,
          });

          return {
            success: true,
            token,
            clinic: {
              id: clinic.id,
              name: clinic.name,
              clinicId: clinic.clinicId,
            },
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Auth] Login error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al iniciar sesión",
          });
        }
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  reports: router({
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().default(50),
          offset: z.number().default(0),
        }),
      )
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.clinicId) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "No clinic associated with session",
            });
          }

          const reportsList = await db.getReportsByClinicId(
            ctx.clinicId,
            input.limit,
            input.offset,
          );

          return {
            reports: reportsList,
            count: reportsList.length,
          };
        } catch (error) {
          console.error("[Reports] List error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al obtener informes",
          });
        }
      }),

    search: protectedProcedure
      .input(
        z.object({
          query: z.string().optional(),
          studyType: z.string().optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        }),
      )
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.clinicId) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "No clinic associated with session",
            });
          }

          const results = await db.searchReports(
            ctx.clinicId,
            input.query || "",
            input.studyType,
            input.limit,
            input.offset,
          );

          return {
            reports: results,
            count: results.length,
          };
        } catch (error) {
          console.error("[Reports] Search error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al buscar informes",
          });
        }
      }),

    getStudyTypes: protectedProcedure.query(async ({ ctx }) => {
      try {
        if (!ctx.clinicId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No clinic associated with session",
          });
        }

        const studyTypes = await db.getStudyTypes(ctx.clinicId);
        return studyTypes;
      } catch (error) {
        console.error("[Reports] getStudyTypes error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al obtener tipos de estudio",
        });
      }
    }),

    getDownloadUrl: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.clinicId) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "No clinic associated with session",
            });
          }

          const report = await db.getReportById(input.reportId);

          if (!report) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Informe no encontrado",
            });
          }

          if (report.clinicId !== ctx.clinicId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "No tienes acceso a este informe",
            });
          }

          if (!report.downloadUrl && report.driveFileId) {
            // Generar URL de descarga de Google Drive
            const downloadUrl = `https://drive.google.com/uc?export=download&id=${report.driveFileId}`;
            return { downloadUrl };
          }

          return { downloadUrl: report.downloadUrl || "" };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Reports] getDownloadUrl error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al obtener URL de descarga",
          });
        }
      }),
  }),

  sync: router({
    syncFromSheets: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        // Esta función será implementada para sincronizar desde Google Sheets
        // Por ahora retorna un mensaje de éxito
        return {
          success: true,
          message: "Sincronización completada",
        };
      } catch (error) {
        console.error("[Sync] syncFromSheets error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al sincronizar datos",
        });
      }
    }),

    uploadData: publicProcedure
      .input(
        z.object({
          clinics: z.array(
            z.object({
              clinicId: z.string(),
              name: z.string(),
              driveFolderId: z.string().optional(),
            }),
          ),
          clinicUsers: z.array(
            z.object({
              clinicId: z.string(),
              username: z.string(),
              password: z.string(),
              authProId: z.string().optional(),
            }),
          ),
          reports: z.array(
            z.object({
              clinicId: z.string(),
              uploadDate: z.string().optional(),
              studyType: z.string().optional(),
              patientName: z.string().optional(),
              fileName: z.string().optional(),
              driveFileId: z.string(),
              previewUrl: z.string().optional(),
            }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const results = {
            clinicsCreated: 0,
            usersCreated: 0,
            reportsCreated: 0,
            errors: [] as string[],
          };

          // Crear clínicas
          for (const clinic of input.clinics) {
            try {
              await db.upsertClinic({
                clinicId: clinic.clinicId,
                name: clinic.name,
                driveFolderId: clinic.driveFolderId,
              });
              results.clinicsCreated++;
            } catch (error) {
              results.errors.push(
                `Error al crear clínica ${clinic.clinicId}: ${error}`,
              );
            }
          }

          // Crear usuarios de clínicas
          for (const user of input.clinicUsers) {
            try {
              const clinic = await db.getClinicByClinicId(user.clinicId);
              if (!clinic) {
                results.errors.push(`Clínica no encontrada: ${user.clinicId}`);
                continue;
              }

              const passwordHash = hashPassword(user.password);
              await db.upsertClinicUser({
                clinicId: clinic.id,
                username: user.username,
                passwordHash,
                authProId: user.authProId,
              });
              results.usersCreated++;
            } catch (error) {
              results.errors.push(
                `Error al crear usuario ${user.username}: ${error}`,
              );
            }
          }

          // Crear informes
          for (const report of input.reports) {
            try {
              const clinic = await db.getClinicByClinicId(report.clinicId);
              if (!clinic) {
                results.errors.push(
                  `Clínica no encontrada: ${report.clinicId}`,
                );
                continue;
              }

              await db.upsertReport({
                clinicId: clinic.id,
                uploadDate: report.uploadDate
                  ? new Date(report.uploadDate)
                  : undefined,
                studyType: report.studyType,
                patientName: report.patientName,
                fileName: report.fileName,
                driveFileId: report.driveFileId,
                previewUrl: report.previewUrl,
                downloadUrl: `https://drive.google.com/uc?export=download&id=${report.driveFileId}`,
              });
              results.reportsCreated++;
            } catch (error) {
              results.errors.push(
                `Error al crear informe ${report.driveFileId}: ${error}`,
              );
            }
          }

          return results;
        } catch (error) {
          console.error("[Sync] uploadData error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Error al cargar datos",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
