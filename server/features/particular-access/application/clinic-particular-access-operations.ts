import { createTokenStudyTrackingOperations } from "../../study-tracking/index.ts";
import { getParticularTokenLast4 } from "../domain/index.ts";
import type {
  CreateParticularAccessTokenData,
  EmailFailureResult,
  ParticularAccessIssue,
  ParticularAccessReportRecord,
  ParticularAccessSideEffectPorts,
  ParticularAccessTokenRecord,
  ParticularTokenRepository,
} from "./ports/particular-access-ports.ts";

type ClinicParticularAccessDeps<
  TToken extends ParticularAccessTokenRecord,
  TReport extends ParticularAccessReportRecord,
> = ParticularAccessSideEffectPorts &
  Pick<
    ParticularTokenRepository<TToken>,
    | "createParticularToken"
    | "getClinicScopedParticularToken"
    | "listParticularTokens"
    | "updateParticularTokenReport"
    | "revokeParticularToken"
  > & {
    getClinicScopedReportById: (
      reportId: number,
      clinicId: number,
    ) => Promise<TReport | null | undefined>;
  };

async function revokeAfterEmailFailure<
  TToken extends ParticularAccessTokenRecord,
>(
  deps: Pick<ParticularTokenRepository<TToken>, "revokeParticularToken">,
  tokenId: number,
): Promise<unknown | undefined> {
  try {
    await deps.revokeParticularToken(tokenId);
    return undefined;
  } catch (error) {
    return error;
  }
}

export function createClinicParticularAccessOperations<
  TToken extends ParticularAccessTokenRecord,
  TReport extends ParticularAccessReportRecord,
>(deps: ClinicParticularAccessDeps<TToken, TReport>) {
  const tracking = createTokenStudyTrackingOperations(deps.studyTracking);

  async function ensureTracking(token: TToken, clinicUserId: number | null) {
    try {
      await tracking.ensureTrackingForToken({
        token,
        createdByAdminId: token.createdByAdminId ?? null,
        createdByClinicUserId: clinicUserId,
        now: new Date(deps.now()),
      });
      return undefined;
    } catch (error) {
      return {
        kind: "tracking",
        tokenId: token.id,
        clinicId: token.clinicId,
        error,
      } satisfies ParticularAccessIssue;
    }
  }

  return {
    async createToken(
      data: CreateParticularAccessTokenData,
      actor: { clinicId: number; clinicUserId: number },
    ) {
      if (typeof data.reportId === "number") {
        const report = await deps.getClinicScopedReportById(
          data.reportId,
          actor.clinicId,
        );
        if (!report) {
          return { kind: "report_not_found" } as const;
        }
      }

      const rawToken = deps.generateSessionToken();
      const particularToken = await deps.createParticularToken({
        clinicId: actor.clinicId,
        reportId: data.reportId,
        createdByAdminId: null,
        createdByClinicUserId: actor.clinicUserId,
        tokenHash: deps.hashSessionToken(rawToken),
        tokenLast4: getParticularTokenLast4(rawToken),
        tutorLastName: data.tutorLastName,
        petName: data.petName,
        petAge: data.petAge,
        petBreed: data.petBreed,
        petSex: data.petSex,
        petSpecies: data.petSpecies,
        sampleLocation: data.sampleLocation,
        sampleEvolution: data.sampleEvolution,
        detailsLesion: data.detailsLesion,
        extractionDate: data.extractionDate,
        shippingDate: data.shippingDate,
        isActive: true,
        lastLoginAt: null,
      });

      try {
        const emailResult = await deps.sendParticularTokenEmail({
          to: data.recipientEmail,
          token: rawToken,
          tutorLastName: data.tutorLastName,
          petName: data.petName,
        });
        if (!emailResult.sent) {
          const cleanupError = await revokeAfterEmailFailure(
            deps,
            particularToken.id,
          );
          return {
            kind: "email_unavailable",
            tokenId: particularToken.id,
            reason: emailResult.reason,
            ...(cleanupError === undefined ? {} : { cleanupError }),
          } satisfies EmailFailureResult;
        }
      } catch (error) {
        const cleanupError = await revokeAfterEmailFailure(
          deps,
          particularToken.id,
        );
        return {
          kind: "email_failed",
          tokenId: particularToken.id,
          error,
          ...(cleanupError === undefined ? {} : { cleanupError }),
        } satisfies EmailFailureResult;
      }

      const issue = await ensureTracking(
        particularToken,
        actor.clinicUserId,
      );
      return {
        kind: "success",
        rawToken,
        particularToken,
        issues: issue ? [issue] : [],
      } as const;
    },

    listTokens(clinicId: number, limit: number, offset: number) {
      return deps.listParticularTokens({ clinicId, limit, offset });
    },

    async getToken(tokenId: number, clinicId: number) {
      const token = await deps.getClinicScopedParticularToken(
        tokenId,
        clinicId,
      );
      if (!token) {
        return { kind: "not_found" } as const;
      }
      const report =
        typeof token.reportId === "number"
          ? await deps.getClinicScopedReportById(token.reportId, clinicId)
          : null;
      return { kind: "success", token, report } as const;
    },

    async updateTokenReport(
      tokenId: number,
      reportId: number | null,
      clinicId: number,
    ) {
      const token = await deps.getClinicScopedParticularToken(
        tokenId,
        clinicId,
      );
      if (!token) {
        return { kind: "token_not_found" } as const;
      }
      if (typeof reportId === "number") {
        const report = await deps.getClinicScopedReportById(reportId, clinicId);
        if (!report) {
          return { kind: "report_not_found" } as const;
        }
      }
      const updated = await deps.updateParticularTokenReport(tokenId, reportId);
      const report =
        updated && typeof updated.reportId === "number"
          ? await deps.getClinicScopedReportById(updated.reportId, clinicId)
          : null;
      return { kind: "success", updated, report } as const;
    },
  };
}
