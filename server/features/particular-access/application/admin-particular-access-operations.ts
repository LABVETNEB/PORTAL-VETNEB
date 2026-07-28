import {
  createTokenStudyTrackingOperations,
} from "../../study-tracking/index.ts";
import {
  belongsToClinic,
  getParticularTokenLast4,
} from "../domain/index.ts";
import type {
  CreateParticularAccessTokenData,
  EmailFailureResult,
  ParticularAccessIssue,
  ParticularAccessReportRecord,
  ParticularAccessSideEffectPorts,
  ParticularAccessTokenRecord,
  ParticularTokenRepository,
} from "./ports/particular-access-ports.ts";

type AdminParticularAccessDeps<
  TToken extends ParticularAccessTokenRecord,
  TReport extends ParticularAccessReportRecord,
> = ParticularAccessSideEffectPorts &
  Pick<
    ParticularTokenRepository<TToken>,
    | "createParticularToken"
    | "getParticularTokenById"
    | "listParticularTokens"
    | "updateParticularTokenReport"
    | "revokeParticularToken"
    | "deleteParticularToken"
  > & {
    getClinicById: (clinicId: number) => Promise<{ id: number } | null>;
    getReportById: (reportId: number) => Promise<TReport | null>;
    createStudyTrackingNotification: (input: {
      studyTrackingCaseId: number;
      clinicId: number;
      reportId: number | null;
      particularTokenId: number | null;
      type: string;
      title: string;
      message: string;
      isRead: boolean;
      readAt: Date | null;
    }) => Promise<unknown>;
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

export function createAdminParticularAccessOperations<
  TToken extends ParticularAccessTokenRecord,
  TReport extends ParticularAccessReportRecord,
>(deps: AdminParticularAccessDeps<TToken, TReport>) {
  const tracking = createTokenStudyTrackingOperations(deps.studyTracking);

  async function ensureTracking(
    token: TToken,
    createdByAdminId: number | null,
  ) {
    try {
      return {
        trackingCase: await tracking.ensureTrackingForToken({
          token,
          createdByAdminId,
          createdByClinicUserId: token.createdByClinicUserId ?? null,
          now: new Date(deps.now()),
        }),
      };
    } catch (error) {
      return {
        issue: {
          kind: "tracking",
          tokenId: token.id,
          clinicId: token.clinicId,
          error,
        } satisfies ParticularAccessIssue,
      };
    }
  }

  return {
    async createToken(
      data: CreateParticularAccessTokenData & { clinicId: number },
      adminId: number,
    ) {
      const clinic = await deps.getClinicById(data.clinicId);
      if (!clinic) {
        return { kind: "clinic_not_found" } as const;
      }

      if (typeof data.reportId === "number") {
        const report = await deps.getReportById(data.reportId);
        if (!report) {
          return { kind: "report_not_found" } as const;
        }
        if (!belongsToClinic(report.clinicId, data.clinicId)) {
          return { kind: "report_wrong_clinic" } as const;
        }
      }

      const rawToken = deps.generateSessionToken();
      const particularToken = await deps.createParticularToken({
        clinicId: data.clinicId,
        reportId: data.reportId,
        createdByAdminId: adminId,
        createdByClinicUserId: null,
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

      const issues: ParticularAccessIssue[] = [];
      const trackingResult = await ensureTracking(particularToken, adminId);
      if (trackingResult.issue) {
        issues.push(trackingResult.issue);
      } else if (trackingResult.trackingCase) {
        try {
          await deps.createStudyTrackingNotification({
            studyTrackingCaseId: trackingResult.trackingCase.id,
            clinicId: particularToken.clinicId,
            reportId:
              particularToken.reportId ??
              trackingResult.trackingCase.reportId ??
              null,
            particularTokenId: particularToken.id,
            type: "token_created",
            title: "Token particular generado",
            message: `Se generó un token particular para ${particularToken.petName}.`,
            isRead: false,
            readAt: null,
          });
        } catch (error) {
          issues.push({
            kind: "notification",
            tokenId: particularToken.id,
            trackingCaseId: trackingResult.trackingCase.id,
            error,
          });
        }
      }

      return {
        kind: "success",
        rawToken,
        particularToken,
        issues,
      } as const;
    },

    async listTokens(params: {
      clinicId?: number;
      limit: number;
      offset: number;
      adminId: number;
    }) {
      const tokens = await deps.listParticularTokens(params);
      const issues: ParticularAccessIssue[] = [];
      await Promise.all(
        tokens.map(async (token) => {
          const result = await ensureTracking(token, params.adminId);
          if (result.issue) {
            issues.push(result.issue);
          }
        }),
      );
      return { tokens, issues };
    },

    async getToken(tokenId: number, adminId: number) {
      const token = await deps.getParticularTokenById(tokenId);
      if (!token) {
        return { kind: "not_found" } as const;
      }
      const trackingResult = await ensureTracking(token, adminId);
      const report =
        typeof token.reportId === "number"
          ? await deps.getReportById(token.reportId)
          : null;
      return {
        kind: "success",
        token,
        report,
        issues: trackingResult.issue ? [trackingResult.issue] : [],
      } as const;
    },

    async updateTokenReport(
      tokenId: number,
      reportId: number | null,
      adminId: number,
    ) {
      const token = await deps.getParticularTokenById(tokenId);
      if (!token) {
        return { kind: "token_not_found" } as const;
      }
      if (typeof reportId === "number") {
        const report = await deps.getReportById(reportId);
        if (!report) {
          return { kind: "report_not_found" } as const;
        }
        if (!belongsToClinic(report.clinicId, token.clinicId)) {
          return { kind: "report_wrong_clinic" } as const;
        }
      }
      const updated = await deps.updateParticularTokenReport(tokenId, reportId);
      const issues: ParticularAccessIssue[] = [];
      if (updated) {
        const result = await ensureTracking(updated, adminId);
        if (result.issue) {
          issues.push(result.issue);
        }
      }
      const report =
        updated && typeof updated.reportId === "number"
          ? await deps.getReportById(updated.reportId)
          : null;
      return { kind: "success", updated, report, issues } as const;
    },

    async deleteToken(tokenId: number) {
      const existing = await deps.getParticularTokenById(tokenId);
      if (!existing) {
        return { kind: "not_found" } as const;
      }
      const deleted = await deps.deleteParticularToken(tokenId);
      return deleted
        ? ({ kind: "success", deletedTokenId: tokenId } as const)
        : ({ kind: "not_found" } as const);
    },
  };
}
