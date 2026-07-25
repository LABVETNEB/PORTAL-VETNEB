import type {
  ReportAccessAuditInput,
  ReportAccessReportRecord,
  ReportAccessRepository,
  ReportAccessTokenRecord,
} from "./ports/report-access-ports.ts";

type ClinicDeps<
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
    | "getClinicScopedReportAccessToken"
    | "revokeReportAccessToken"
  > & {
    listReportAccessTokens: (params: {
      clinicId: number;
      reportId?: number;
      limit: number;
      offset: number;
    }) => Promise<TToken[]>;
    getClinicScopedReportById: (
      reportId: number,
      clinicId: number,
    ) => Promise<TReport | null | undefined>;
  };

export function createClinicReportAccessOperations<
  TToken extends ReportAccessTokenRecord,
  TReport extends ReportAccessReportRecord,
>(deps: ClinicDeps<TToken, TReport>) {
  return {
    async createToken(
      data: { reportId: number; expiresAt: Date | null },
      actor: { clinicId: number; clinicUserId: number },
      auditRequest: unknown,
    ) {
      const report = await deps.getClinicScopedReportById(
        data.reportId,
        actor.clinicId,
      );
      if (!report) {
        return { kind: "report_not_found" } as const;
      }
      const rawToken = deps.generateSessionToken();
      const tokenHash = deps.hashSessionToken(rawToken);
      const token = await deps.createReportAccessToken({
        clinicId: actor.clinicId,
        reportId: report.id,
        tokenHash,
        tokenLast4: rawToken.slice(-4),
        expiresAt: data.expiresAt,
        createdByClinicUserId: actor.clinicUserId,
        createdByAdminUserId: null,
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
          createdVia: "clinic",
        },
      });
      return { kind: "success", rawToken, token } as const;
    },

    listTokens(clinicId: number, reportId: number | undefined, limit: number, offset: number) {
      return deps.listReportAccessTokens({ clinicId, reportId, limit, offset });
    },

    async getToken(tokenId: number, clinicId: number) {
      const token = await deps.getClinicScopedReportAccessToken(tokenId, clinicId);
      if (!token) {
        return { kind: "not_found" } as const;
      }
      return {
        kind: "success",
        token,
        report: await deps.getClinicScopedReportById(token.reportId, clinicId),
      } as const;
    },

    async revokeToken(
      tokenId: number,
      actor: { clinicId: number; clinicUserId: number },
      auditRequest: unknown,
    ) {
      if (!(await deps.getClinicScopedReportAccessToken(tokenId, actor.clinicId))) {
        return { kind: "not_found" } as const;
      }
      const token = await deps.revokeReportAccessToken({
        id: tokenId,
        revokedByClinicUserId: actor.clinicUserId,
        revokedByAdminUserId: null,
      });
      const report = token
        ? await deps.getClinicScopedReportById(token.reportId, actor.clinicId)
        : null;
      if (token) {
        await deps.writeAuditLog(auditRequest, {
          event: "report_access_token.revoked",
          clinicId: token.clinicId,
          reportId: token.reportId,
          targetReportAccessTokenId: token.id,
          metadata: {
            tokenLast4: token.tokenLast4,
            revokedAt: token.revokedAt,
            revokedVia: "clinic",
          },
        });
      }
      return { kind: "success", token, report } as const;
    },
  };
}
