import { belongsToClinic } from "../domain/index.ts";
import type {
  ReportAccessAuditInput,
  ReportAccessReportRecord,
  ReportAccessRepository,
  ReportAccessTokenRecord,
} from "./ports/report-access-ports.ts";

type AdminDeps<
  TToken extends ReportAccessTokenRecord,
  TReport extends ReportAccessReportRecord,
> = {
  generateSessionToken: () => string;
  hashSessionToken: (token: string) => string;
  writeAuditLog: (
    request: unknown,
    input: Omit<ReportAccessAuditInput, "actor">,
  ) => Promise<void>;
} &
  Pick<
    ReportAccessRepository<TToken>,
    | "createReportAccessToken"
    | "getReportAccessTokenById"
    | "listReportAccessTokens"
    | "revokeReportAccessToken"
  > & {
    getClinicById: (clinicId: number) => Promise<{ id: number } | null>;
    getReportById: (reportId: number) => Promise<TReport | null>;
  };

export function createAdminReportAccessOperations<
  TToken extends ReportAccessTokenRecord,
  TReport extends ReportAccessReportRecord,
>(deps: AdminDeps<TToken, TReport>) {
  return {
    async createToken(
      data: { clinicId: number; reportId: number; expiresAt: Date | null },
      actor: { id: number },
      auditRequest: unknown,
    ) {
      if (!(await deps.getClinicById(data.clinicId))) {
        return { kind: "clinic_not_found" } as const;
      }
      const report = await deps.getReportById(data.reportId);
      if (!report) {
        return { kind: "report_not_found" } as const;
      }
      if (!belongsToClinic(report.clinicId, data.clinicId)) {
        return { kind: "report_wrong_clinic" } as const;
      }
      const rawToken = deps.generateSessionToken();
      const tokenHash = deps.hashSessionToken(rawToken);
      const token = await deps.createReportAccessToken({
        clinicId: data.clinicId,
        reportId: report.id,
        tokenHash,
        tokenLast4: rawToken.slice(-4),
        expiresAt: data.expiresAt,
        createdByClinicUserId: null,
        createdByAdminUserId: actor.id,
        revokedByClinicUserId: null,
        revokedByAdminUserId: null,
      });
      await deps.writeAuditLog(auditRequest, {
        event: "report_access_token.created",
        clinicId: token.clinicId,
        reportId: token.reportId,
        targetReportAccessTokenId: token.id,
        metadata: {
          tokenLast4: token.tokenLast4,
          expiresAt: token.expiresAt,
          createdVia: "admin",
        },
      });
      return { kind: "success", rawToken, token } as const;
    },

    listTokens(params: {
      clinicId?: number;
      reportId?: number;
      limit: number;
      offset: number;
    }) {
      return deps.listReportAccessTokens(params);
    },

    async getToken(tokenId: number) {
      const token = await deps.getReportAccessTokenById(tokenId);
      if (!token) {
        return { kind: "not_found" } as const;
      }
      return {
        kind: "success",
        token,
        report: await deps.getReportById(token.reportId),
      } as const;
    },

    async revokeToken(
      tokenId: number,
      actor: { id: number },
      auditRequest: unknown,
    ) {
      if (!(await deps.getReportAccessTokenById(tokenId))) {
        return { kind: "not_found" } as const;
      }
      const token = await deps.revokeReportAccessToken({
        id: tokenId,
        revokedByClinicUserId: null,
        revokedByAdminUserId: actor.id,
      });
      const report = token ? await deps.getReportById(token.reportId) : null;
      if (token) {
        await deps.writeAuditLog(auditRequest, {
          event: "report_access_token.revoked",
          clinicId: token.clinicId,
          reportId: token.reportId,
          targetReportAccessTokenId: token.id,
          metadata: {
            tokenLast4: token.tokenLast4,
            revokedAt: token.revokedAt,
            revokedVia: "admin",
          },
        });
      }
      return { kind: "success", token, report } as const;
    },
  };
}
