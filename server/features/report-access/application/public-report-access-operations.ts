import {
  belongsToClinic,
  canAccessReportPublicly,
  getReportAccessTokenState,
} from "../domain/index.ts";
import type {
  ReportAccessAuditInput,
  ReportAccessReportRecord,
  ReportAccessTokenRecord,
} from "./ports/report-access-ports.ts";

type PublicDeps<
  TToken extends ReportAccessTokenRecord,
  TReport extends ReportAccessReportRecord,
> = {
  hashSessionToken: (token: string) => string;
  getReportAccessTokenWithReportByTokenHash: (
    tokenHash: string,
  ) => Promise<{ token: TToken; report: TReport } | null>;
  recordReportAccessTokenAccess: (
    tokenId: number,
  ) => Promise<TToken | null | undefined>;
  createSignedReportUrl: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  writeAuditLog: (
    request: unknown,
    input: ReportAccessAuditInput,
  ) => Promise<void>;
  buildPublicActor: (tokenId: number) => Record<string, unknown>;
};

export function createPublicReportAccessOperations<
  TToken extends ReportAccessTokenRecord,
  TReport extends ReportAccessReportRecord,
>(deps: PublicDeps<TToken, TReport>) {
  return {
    async access(rawToken: string, currentTime: number, auditRequest: unknown) {
      const tokenHash = deps.hashSessionToken(rawToken);
      const record =
        await deps.getReportAccessTokenWithReportByTokenHash(tokenHash);
      if (
        !record ||
        !belongsToClinic(record.token.clinicId, record.report.clinicId) ||
        getReportAccessTokenState(record.token, new Date(currentTime)) !== "active"
      ) {
        return { kind: "not_found" } as const;
      }
      if (!canAccessReportPublicly(record.report.currentStatus)) {
        return {
          kind: "unavailable",
          currentStatus: record.report.currentStatus,
        } as const;
      }
      const updatedToken = await deps.recordReportAccessTokenAccess(record.token.id);
      const [previewUrl, downloadUrl] = await Promise.all([
        deps.createSignedReportUrl(record.report.storagePath),
        deps.createSignedReportDownloadUrl(
          record.report.storagePath,
          record.report.fileName ?? undefined,
        ),
      ]);
      const accessCount =
        updatedToken?.accessCount ?? record.token.accessCount + 1;
      const lastAccessAt =
        updatedToken?.lastAccessAt ?? new Date(currentTime);
      await deps.writeAuditLog(auditRequest, {
        event: "report.public_accessed",
        clinicId: record.token.clinicId,
        reportId: record.token.reportId,
        targetReportAccessTokenId: record.token.id,
        actor: deps.buildPublicActor(record.token.id),
        metadata: {
          tokenLast4: record.token.tokenLast4,
          accessCount,
          lastAccessAt,
        },
      });
      return {
        kind: "success",
        report: record.report,
        previewUrl,
        downloadUrl,
        accessCount,
        lastAccessAt,
        expiresAt: record.token.expiresAt,
      } as const;
    },
  };
}
