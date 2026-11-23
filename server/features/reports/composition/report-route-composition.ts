import type {
  ParticularToken,
  Report,
  ReportWorkflowStage,
  StudyTrackingCase,
  StudyTrackingNotification,
} from "../../../../drizzle/schema.ts";
import type { AuditWriteInput } from "../../../lib/audit.ts";
import { serializeError } from "../../../lib/logger.ts";
import {
  normalizeSearchText,
  parseOptionalDate,
  parseReportStudyType,
} from "../domain/index.ts";
import {
  createReportRouteService,
  type ReportRouteAuditInput,
  type ReportUploadPersistenceScope,
} from "../application/index.ts";
import {
  createBestEffortNotificationWriter,
  createPassthroughReportPersistenceRunner,
  logReportStorageCompensation,
} from "./report-upload-persistence-composition.ts";
import type { AdminReportWorkflowItem } from "../infrastructure/db-report-workflow.ts";

type AdminUserRecord = {
  id: number;
  username: string;
};

type AdminSessionRecord = {
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AdminSessionWithUserRecord = {
  session: AdminSessionRecord;
  adminUser: AdminUserRecord | null;
};

type ClinicRecord = {
  id: number;
};

type ReportUploadInput = {
  file: Buffer;
  fileName: string;
  clinicId: number;
  mimeType: string;
};

type UpsertReportInput = {
  clinicId: number;
  patientName: string | null;
  studyType: string | null;
  uploadDate: Date | null;
  fileName: string;
  storagePath: string;
  createdByAdminUserId?: number | null;
};

export type AdminReportsRouteCompositionOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (adminUserId: number) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getClinicById?: (clinicId: number) => Promise<ClinicRecord | null>;
  getReportById?: (reportId: number) => Promise<Report | null>;
  uploadReport?: (input: ReportUploadInput) => Promise<string>;
  upsertReport?: (input: UpsertReportInput) => Promise<Report>;
  getParticularTokenById?: (
    tokenId: number,
  ) => Promise<ParticularToken | null | undefined>;
  updateParticularTokenReport?: (
    id: number,
    reportId: number | null,
  ) => Promise<ParticularToken | null | undefined>;
  getParticularStudyTrackingCase?: (
    particularTokenId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  getStudyTrackingCaseByReportId?: (
    reportId: number,
  ) => Promise<StudyTrackingCase | null | undefined>;
  createStudyTrackingCase?: (
    input: Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">,
  ) => Promise<StudyTrackingCase>;
  updateStudyTrackingCase?: (
    id: number,
    input: Partial<Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<StudyTrackingCase | null | undefined>;
  createStudyTrackingNotification?: (input: {
    studyTrackingCaseId: number;
    clinicId: number;
    reportId: number | null;
    particularTokenId: number | null;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    readAt: Date | null;
  }) => Promise<StudyTrackingNotification>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  runReportPersistence?: <TResult>(
    work: (
      scope: ReportUploadPersistenceScope<
        Report,
        ParticularToken,
        StudyTrackingCase
      >,
    ) => Promise<TResult>,
  ) => Promise<TResult>;
  deleteStorageObject?: (storagePath: string) => Promise<void>;
  isReportStoragePathPersisted?: (storagePath: string) => Promise<boolean>;
  findPersistedReportByStoragePath?: (
    storagePath: string,
  ) => Promise<Report | null | undefined>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
};

export type AdminReportWorkflowRouteCompositionOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionWithUser?: (
    tokenHash: string,
  ) => Promise<AdminSessionWithUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listAdminReportWorkflowItems?: (input: {
    limit: number;
    offset: number;
  }) => Promise<AdminReportWorkflowItem[]>;
  getAdminReportWorkflowItem?: (
    id: number,
  ) => Promise<AdminReportWorkflowItem | null>;
  updateAdminReportWorkflowStage?: (
    id: number,
    stage: ReportWorkflowStage,
    now: Date,
  ) => Promise<AdminReportWorkflowItem | null>;
  updateAdminReportSpecialStain?: (
    id: number,
    requested: boolean,
    now: Date,
  ) => Promise<AdminReportWorkflowItem | null>;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
};

const auditEventNames = {
  reportUploaded: "report.uploaded",
  workflowStageChanged: "report.workflow_stage.changed",
  specialStainChanged: "report.special_stain.changed",
} as const;

type ResolvedAdminReportsDependencies = Required<
  Omit<AdminReportsRouteCompositionOptions, never>
>;

type ResolvedWorkflowDependencies = Required<
  Omit<AdminReportWorkflowRouteCompositionOptions, never>
>;

let defaultAdminReportsDependenciesPromise:
  | Promise<ResolvedAdminReportsDependencies>
  | undefined;
let defaultWorkflowDependenciesPromise:
  | Promise<ResolvedWorkflowDependencies>
  | undefined;

function hasAllAdminReportsDependencies(
  options: AdminReportsRouteCompositionOptions,
) {
  return (
    !!options.deleteAdminSession &&
    !!options.getAdminSessionByToken &&
    !!options.getAdminUserById &&
    !!options.updateAdminSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getClinicById &&
    !!options.getReportById &&
    !!options.uploadReport &&
    !!options.upsertReport &&
    !!options.getParticularTokenById &&
    !!options.updateParticularTokenReport &&
    !!options.getParticularStudyTrackingCase &&
    !!options.getStudyTrackingCaseByReportId &&
    !!options.createStudyTrackingCase &&
    !!options.updateStudyTrackingCase &&
    !!options.createStudyTrackingNotification &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl &&
    !!options.writeAuditLog
  );
}

function hasAllWorkflowDependencies(
  options: AdminReportWorkflowRouteCompositionOptions,
) {
  return (
    !!options.deleteAdminSession &&
    !!options.getAdminSessionWithUser &&
    !!options.updateAdminSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.listAdminReportWorkflowItems &&
    !!options.getAdminReportWorkflowItem &&
    !!options.updateAdminReportWorkflowStage &&
    !!options.updateAdminReportSpecialStain &&
    !!options.writeAuditLog
  );
}

async function loadDefaultAdminReportsDependencies() {
  if (!defaultAdminReportsDependenciesPromise) {
    defaultAdminReportsDependenciesPromise = (async () => {
      const [
        db,
        authSecurity,
        storage,
        audit,
        particular,
        studyTracking,
        reportCommands,
        uploadPersistence,
      ] = await Promise.all([
        import("../../../db.ts"),
        import("../../../lib/auth-security.ts"),
        import("../../../lib/supabase.ts"),
        import("../../../lib/audit.ts"),
        import("../../particular-access/index.ts").then(
          ({ loadReportsParticularAccessPersistence }) =>
            loadReportsParticularAccessPersistence(),
        ),
        import("../../study-tracking/index.ts").then(
          ({ loadParticularAccessStudyTrackingPersistence }) =>
            loadParticularAccessStudyTrackingPersistence(),
        ),
        import("./report-command-composition.ts"),
        import("./report-upload-persistence-composition.ts").then(
          ({ loadReportUploadPersistence }) => loadReportUploadPersistence(),
        ),
      ]);

      return {
        runReportPersistence: uploadPersistence.runReportPersistence,
        isReportStoragePathPersisted:
          uploadPersistence.isReportStoragePathPersisted,
        findPersistedReportByStoragePath:
          uploadPersistence.findPersistedReportByStoragePath,
        deleteStorageObject: storage.deleteStorageObject,
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicById: db.getClinicById,
        getReportById: reportCommands.getReportById,
        uploadReport: storage.uploadReport,
        upsertReport: reportCommands.createOrEditReport,
        getParticularTokenById: particular.getParticularTokenById,
        updateParticularTokenReport: particular.updateParticularTokenReport,
        getParticularStudyTrackingCase:
          studyTracking.getParticularStudyTrackingCase,
        getStudyTrackingCaseByReportId:
          studyTracking.getStudyTrackingCaseByReportId,
        createStudyTrackingCase: studyTracking.createStudyTrackingCase,
        updateStudyTrackingCase: studyTracking.updateStudyTrackingCase,
        createStudyTrackingNotification:
          studyTracking.createStudyTrackingNotification,
        createSignedReportUrl: storage.createSignedReportUrl,
        createSignedReportDownloadUrl: storage.createSignedReportDownloadUrl,
        writeAuditLog: audit.writeAuditLog as unknown as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultAdminReportsDependenciesPromise;
}

async function loadDefaultWorkflowDependencies() {
  if (!defaultWorkflowDependenciesPromise) {
    defaultWorkflowDependenciesPromise = (async () => {
      const [
        db,
        authSecurity,
        audit,
        workflowInfrastructure,
        workflowCommunication,
      ] = await Promise.all([
        import("../../../db.ts"),
        import("../../../lib/auth-security.ts"),
        import("../../../lib/audit.ts"),
        import("../infrastructure/db-report-workflow.ts"),
        import("./report-workflow-communication-composition.ts"),
      ]);
      const repository =
        workflowInfrastructure.createDbReportWorkflowRepository({
          createReportWorkflowNotification:
            workflowCommunication.createReportWorkflowNotification,
        });

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionWithUser: db.getAdminSessionWithUser,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listAdminReportWorkflowItems:
          repository.listAdminReportWorkflowItems,
        getAdminReportWorkflowItem: repository.getAdminReportWorkflowItem,
        updateAdminReportWorkflowStage:
          repository.updateAdminReportWorkflowStage,
        updateAdminReportSpecialStain:
          repository.updateAdminReportSpecialStain,
        writeAuditLog: audit.writeAuditLog as unknown as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultWorkflowDependenciesPromise!;
}

async function resolveAdminReportsDependencies(
  options: AdminReportsRouteCompositionOptions,
): Promise<ResolvedAdminReportsDependencies> {
  const defaults = hasAllAdminReportsDependencies(options)
    ? undefined
    : await loadDefaultAdminReportsDependencies();

  const legacyPersistenceInjected =
    !!options.upsertReport ||
    !!options.updateParticularTokenReport ||
    !!options.getParticularStudyTrackingCase ||
    !!options.getStudyTrackingCaseByReportId ||
    !!options.createStudyTrackingCase ||
    !!options.updateStudyTrackingCase;

  const unavailable = async (): Promise<never> => {
    throw new Error("report storage dependency not configured");
  };

  const resolved = {
    deleteAdminSession:
      options.deleteAdminSession ?? defaults!.deleteAdminSession,
    getAdminSessionByToken:
      options.getAdminSessionByToken ?? defaults!.getAdminSessionByToken,
    getAdminUserById:
      options.getAdminUserById ?? defaults!.getAdminUserById,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ??
      defaults!.updateAdminSessionLastAccess,
    hashSessionToken: options.hashSessionToken ?? defaults!.hashSessionToken,
    getClinicById: options.getClinicById ?? defaults!.getClinicById,
    getReportById: options.getReportById ?? defaults!.getReportById,
    uploadReport: options.uploadReport ?? defaults!.uploadReport,
    upsertReport: options.upsertReport ?? defaults!.upsertReport,
    getParticularTokenById:
      options.getParticularTokenById ?? defaults!.getParticularTokenById,
    updateParticularTokenReport:
      options.updateParticularTokenReport ??
      defaults!.updateParticularTokenReport,
    getParticularStudyTrackingCase:
      options.getParticularStudyTrackingCase ??
      defaults!.getParticularStudyTrackingCase,
    getStudyTrackingCaseByReportId:
      options.getStudyTrackingCaseByReportId ??
      defaults!.getStudyTrackingCaseByReportId,
    createStudyTrackingCase:
      options.createStudyTrackingCase ?? defaults!.createStudyTrackingCase,
    updateStudyTrackingCase:
      options.updateStudyTrackingCase ?? defaults!.updateStudyTrackingCase,
    createStudyTrackingNotification:
      options.createStudyTrackingNotification ??
      defaults!.createStudyTrackingNotification,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaults!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaults!.createSignedReportDownloadUrl,
    writeAuditLog: options.writeAuditLog ?? defaults!.writeAuditLog,
    deleteStorageObject:
      options.deleteStorageObject ?? defaults?.deleteStorageObject ?? unavailable,
    isReportStoragePathPersisted:
      options.isReportStoragePathPersisted ??
      defaults?.isReportStoragePathPersisted ??
      unavailable,
    findPersistedReportByStoragePath:
      options.findPersistedReportByStoragePath ??
      defaults?.findPersistedReportByStoragePath ??
      unavailable,
  };

  // Inyeccion explicita de escrituras (seam de tests) => sin transaccion real;
  // si no, la unidad atomica real cargada por defecto.
  const runReportPersistence =
    options.runReportPersistence ??
    (legacyPersistenceInjected || !defaults
      ? createPassthroughReportPersistenceRunner({
          ...resolved,
          createOrEditReport: resolved.upsertReport,
          createReportDeliveredNotification: createBestEffortNotificationWriter(
            resolved.createStudyTrackingNotification,
          ),
          writeReportUploadedAudit: (auditContext, input) =>
            resolved.writeAuditLog(auditContext, input as unknown as AuditWriteInput),
        })
      : defaults.runReportPersistence);

  return { ...resolved, runReportPersistence };
}

async function resolveWorkflowDependencies(
  options: AdminReportWorkflowRouteCompositionOptions,
): Promise<ResolvedWorkflowDependencies> {
  const defaults = hasAllWorkflowDependencies(options)
    ? undefined
    : await loadDefaultWorkflowDependencies();

  return {
    deleteAdminSession:
      options.deleteAdminSession ?? defaults!.deleteAdminSession,
    getAdminSessionWithUser:
      options.getAdminSessionWithUser ?? defaults!.getAdminSessionWithUser,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ??
      defaults!.updateAdminSessionLastAccess,
    hashSessionToken: options.hashSessionToken ?? defaults!.hashSessionToken,
    listAdminReportWorkflowItems:
      options.listAdminReportWorkflowItems ??
      defaults!.listAdminReportWorkflowItems,
    getAdminReportWorkflowItem:
      options.getAdminReportWorkflowItem ??
      defaults!.getAdminReportWorkflowItem,
    updateAdminReportWorkflowStage:
      options.updateAdminReportWorkflowStage ??
      defaults!.updateAdminReportWorkflowStage,
    updateAdminReportSpecialStain:
      options.updateAdminReportSpecialStain ??
      defaults!.updateAdminReportSpecialStain,
    writeAuditLog: options.writeAuditLog ?? defaults!.writeAuditLog,
  };
}

export function resolveReportSafeErrorName(error: unknown): string {
  return error instanceof Error ? serializeError(error).name : "unknown_error";
}

function logReportDeliveredNotificationFailure(input: {
  reportId: number;
  clinicId: number;
  trackingCaseId: number;
  errorName: string;
}) {
  console.warn(
    "[admin-reports] report_delivered notification failed",
    JSON.stringify({
      reportId: input.reportId,
      clinicId: input.clinicId,
      trackingCaseId: input.trackingCaseId,
      error: input.errorName,
    }),
  );
}

export async function createAdminReportsRouteComposition(
  options: AdminReportsRouteCompositionOptions,
) {
  const dependencies = await resolveAdminReportsDependencies(options);
  const service = createReportRouteService({
    ...dependencies,
    normalizeSearchText,
    parseReportStudyType,
    parseOptionalDate,
    logReportStorageCompensation,
    auditEvents: auditEventNames,
    writeAuditLog: dependencies.writeAuditLog as (
      context: unknown,
      input: ReportRouteAuditInput,
    ) => Promise<void>,
    listAdminReportWorkflowItems: async () => [],
    getAdminReportWorkflowItem: async () => null,
    updateAdminReportWorkflowStage: async () => null,
    updateAdminReportSpecialStain: async () => null,
    resolveSafeErrorName: resolveReportSafeErrorName,
    logReportDeliveredNotificationFailure,
  });

  return {
    auth: {
      deleteAdminSession: dependencies.deleteAdminSession,
      getAdminSessionByToken: dependencies.getAdminSessionByToken,
      getAdminUserById: dependencies.getAdminUserById,
      updateAdminSessionLastAccess:
        dependencies.updateAdminSessionLastAccess,
      hashSessionToken: dependencies.hashSessionToken,
    },
    service,
  };
}

export async function createAdminReportWorkflowRouteComposition(
  options: AdminReportWorkflowRouteCompositionOptions,
) {
  const dependencies = await resolveWorkflowDependencies(options);
  const service = createReportRouteService({
    getClinicById: async () => null,
    getReportById: async () => null,
    uploadReport: async () => "",
    getParticularTokenById: async () => null,
    runReportPersistence: async () => {
      throw new Error("report upload unavailable");
    },
    deleteStorageObject: async () => undefined,
    isReportStoragePathPersisted: async () => true,
    findPersistedReportByStoragePath: async () => null,
    logReportStorageCompensation: () => undefined,
    createStudyTrackingNotification: async () => undefined,
    createSignedReportUrl: async () => "",
    createSignedReportDownloadUrl: async () => "",
    normalizeSearchText,
    parseReportStudyType,
    parseOptionalDate,
    listAdminReportWorkflowItems:
      dependencies.listAdminReportWorkflowItems,
    getAdminReportWorkflowItem: dependencies.getAdminReportWorkflowItem,
    updateAdminReportWorkflowStage:
      dependencies.updateAdminReportWorkflowStage,
    updateAdminReportSpecialStain:
      dependencies.updateAdminReportSpecialStain,
    writeAuditLog: dependencies.writeAuditLog as (
      context: unknown,
      input: ReportRouteAuditInput,
    ) => Promise<void>,
    auditEvents: auditEventNames,
    resolveSafeErrorName: resolveReportSafeErrorName,
    logReportDeliveredNotificationFailure: () => undefined,
  });

  return {
    auth: {
      deleteAdminSession: dependencies.deleteAdminSession,
      getAdminSessionWithUser: dependencies.getAdminSessionWithUser,
      updateAdminSessionLastAccess:
        dependencies.updateAdminSessionLastAccess,
      hashSessionToken: dependencies.hashSessionToken,
    },
    service,
  };
}
