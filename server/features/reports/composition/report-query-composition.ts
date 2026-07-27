import {
  createReportCommandUseCases,
  createReportQueryUseCases,
  type ReportQueryRecord,
  type ReportQueryStatus,
  type TransitionReportStatusInput,
  type TransitionReportStatusResult,
} from "../application/index.ts";

type ClinicUserRecord = {
  id: number;
  clinicId: number;
  username: string;
  authProId?: string | null;
  role: unknown;
};

type ActiveSessionRecord = {
  clinicUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AuditWriteInput = {
  event: string;
  clinicId?: number | null;
  reportId?: number | null;
  metadata?: Record<string, unknown>;
  actor?: {
    type: string;
    clinicUserId?: number | null;
  };
};

type SharedClinicRouteOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  getReportById?: (reportId: number) => Promise<ReportQueryRecord | null>;
  getClinicScopedReportById?: (
    reportId: number,
    clinicId: number,
  ) => Promise<ReportQueryRecord | null | undefined>;
};

export type ClinicReportsRouteCompositionOptions = SharedClinicRouteOptions & {
  getReportsByClinicId?: (
    clinicId: number,
    limit: number,
    offset: number,
    currentStatus?: ReportQueryStatus,
  ) => Promise<ReportQueryRecord[]>;
  countReportsByClinicId?: (
    clinicId: number,
    currentStatus?: ReportQueryStatus,
  ) => Promise<number>;
  searchReports?: (
    clinicId: number,
    query: string | undefined,
    studyType: string | undefined,
    limit: number,
    offset: number,
    currentStatus?: ReportQueryStatus,
  ) => Promise<ReportQueryRecord[]>;
  countSearchReports?: (
    clinicId: number,
    query: string | undefined,
    studyType: string | undefined,
    currentStatus?: ReportQueryStatus,
  ) => Promise<number>;
  getStudyTypes?: (clinicId: number) => Promise<string[]>;
  getReportStatusHistory?: (
    reportId: number,
  ) => Promise<unknown[]>;
  createSignedReportUrl?: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl?: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
};

export type ClinicReportStatusRouteCompositionOptions =
  SharedClinicRouteOptions & {
    updateReportStatus?: (input: {
      reportId: number;
      toStatus: ReportQueryStatus;
      note: string | null;
      changedByClinicUserId?: number | null;
      changedByAdminUserId?: number | null;
    }) => Promise<ReportQueryRecord | null | undefined>;
    writeAuditLog?: (
      req: unknown,
      input: AuditWriteInput,
    ) => Promise<void>;
  };

type AuthDependencies = {
  deleteActiveSession: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken: (
    tokenHash: string,
  ) => Promise<ActiveSessionRecord | null>;
  getClinicUserById: (
    clinicUserId: number,
  ) => Promise<ClinicUserRecord | null>;
  updateSessionLastAccess: (tokenHash: string) => Promise<void>;
  hashSessionToken: (token: string) => string;
};

type ReportsDependencies = AuthDependencies & {
  getReportsByClinicId: NonNullable<
    ClinicReportsRouteCompositionOptions["getReportsByClinicId"]
  >;
  countReportsByClinicId: NonNullable<
    ClinicReportsRouteCompositionOptions["countReportsByClinicId"]
  >;
  searchReports: NonNullable<
    ClinicReportsRouteCompositionOptions["searchReports"]
  >;
  countSearchReports: NonNullable<
    ClinicReportsRouteCompositionOptions["countSearchReports"]
  >;
  getStudyTypes: NonNullable<
    ClinicReportsRouteCompositionOptions["getStudyTypes"]
  >;
  getClinicScopedReportById: NonNullable<
    SharedClinicRouteOptions["getClinicScopedReportById"]
  >;
  getReportStatusHistory: (
    reportId: number,
  ) => Promise<unknown[]>;
  createSignedReportUrl: NonNullable<
    ClinicReportsRouteCompositionOptions["createSignedReportUrl"]
  >;
  createSignedReportDownloadUrl: NonNullable<
    ClinicReportsRouteCompositionOptions["createSignedReportDownloadUrl"]
  >;
};

type StatusDependencies = AuthDependencies & {
  getClinicScopedReportById: NonNullable<
    SharedClinicRouteOptions["getClinicScopedReportById"]
  >;
  transitionReportStatus: (
    input: TransitionReportStatusInput,
    clinicScopedReport: ReportQueryRecord,
  ) => Promise<TransitionReportStatusResult<ReportQueryRecord>>;
  writeAuditLog: NonNullable<
    ClinicReportStatusRouteCompositionOptions["writeAuditLog"]
  >;
};

let defaultReportsDependenciesPromise: Promise<ReportsDependencies> | undefined;
let defaultStatusDependenciesPromise: Promise<StatusDependencies> | undefined;

function getInjectedClinicScopedLookup(options: SharedClinicRouteOptions) {
  if (options.getClinicScopedReportById) {
    return options.getClinicScopedReportById;
  }

  if (options.getReportById) {
    return async (reportId: number, clinicId: number) => {
      const report = await options.getReportById!(reportId);
      return report?.clinicId === clinicId ? report : null;
    };
  }

  return undefined;
}

function hasAllReportsDependencies(
  options: ClinicReportsRouteCompositionOptions,
) {
  return (
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!options.getReportsByClinicId &&
    !!options.countReportsByClinicId &&
    !!options.searchReports &&
    !!options.countSearchReports &&
    !!options.getStudyTypes &&
    !!getInjectedClinicScopedLookup(options) &&
    !!options.getReportStatusHistory &&
    !!options.createSignedReportUrl &&
    !!options.createSignedReportDownloadUrl
  );
}

function hasAllStatusDependencies(
  options: ClinicReportStatusRouteCompositionOptions,
) {
  return (
    !!options.deleteActiveSession &&
    !!options.getActiveSessionByToken &&
    !!options.getClinicUserById &&
    !!options.updateSessionLastAccess &&
    !!options.hashSessionToken &&
    !!getInjectedClinicScopedLookup(options) &&
    !!options.updateReportStatus &&
    !!options.writeAuditLog
  );
}

async function loadDefaultReportsDependencies(): Promise<ReportsDependencies> {
  if (!defaultReportsDependenciesPromise) {
    defaultReportsDependenciesPromise = (async () => {
      const [db, authSecurity, storage, queries] = await Promise.all([
        import("../../../db.ts"),
        import("../../../lib/auth-security.ts"),
        import("../../../lib/supabase.ts"),
        import("../infrastructure/report-query-repository.ts"),
      ]);

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getReportsByClinicId: queries.getReportsByClinicId,
        countReportsByClinicId: queries.countReportsByClinicId,
        searchReports: queries.searchReports,
        countSearchReports: queries.countSearchReports,
        getStudyTypes: queries.getStudyTypes,
        getClinicScopedReportById: queries.getClinicScopedReportById,
        getReportStatusHistory: queries.getReportStatusHistory,
        createSignedReportUrl: storage.createSignedReportUrl,
        createSignedReportDownloadUrl: storage.createSignedReportDownloadUrl,
      };
    })();
  }

  return defaultReportsDependenciesPromise;
}

async function loadDefaultStatusDependencies(): Promise<StatusDependencies> {
  if (!defaultStatusDependenciesPromise) {
    defaultStatusDependenciesPromise = (async () => {
      const [db, authSecurity, audit, queries, commands] = await Promise.all([
        import("../../../db.ts"),
        import("../../../lib/auth-security.ts"),
        import("../../../lib/audit.ts"),
        import("../infrastructure/report-query-repository.ts"),
        import("./report-command-composition.ts"),
      ]);

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        getClinicScopedReportById: queries.getClinicScopedReportById,
        transitionReportStatus: (input) =>
          commands.transitionReportStatus(input) as Promise<
            TransitionReportStatusResult<ReportQueryRecord>
          >,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultStatusDependenciesPromise;
}

function resolveAuthDependencies(
  options: SharedClinicRouteOptions,
  defaults: AuthDependencies,
): AuthDependencies {
  return {
    deleteActiveSession:
      options.deleteActiveSession ?? defaults.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaults.getActiveSessionByToken,
    getClinicUserById:
      options.getClinicUserById ?? defaults.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaults.updateSessionLastAccess,
    hashSessionToken: options.hashSessionToken ?? defaults.hashSessionToken,
  };
}

export async function createClinicReportsRouteComposition(
  options: ClinicReportsRouteCompositionOptions,
) {
  const defaults = hasAllReportsDependencies(options)
    ? undefined
    : await loadDefaultReportsDependencies();
  const injectedLookup = getInjectedClinicScopedLookup(options);
  const dependencies: ReportsDependencies = {
    ...resolveAuthDependencies(options, defaults ?? (options as ReportsDependencies)),
    getReportsByClinicId:
      options.getReportsByClinicId ?? defaults!.getReportsByClinicId,
    countReportsByClinicId:
      options.countReportsByClinicId ?? defaults!.countReportsByClinicId,
    searchReports: options.searchReports ?? defaults!.searchReports,
    countSearchReports:
      options.countSearchReports ?? defaults!.countSearchReports,
    getStudyTypes: options.getStudyTypes ?? defaults!.getStudyTypes,
    getClinicScopedReportById:
      injectedLookup ?? defaults!.getClinicScopedReportById,
    getReportStatusHistory:
      (options.getReportStatusHistory ??
        defaults!.getReportStatusHistory) as (
        reportId: number,
      ) => Promise<unknown[]>,
    createSignedReportUrl:
      options.createSignedReportUrl ?? defaults!.createSignedReportUrl,
    createSignedReportDownloadUrl:
      options.createSignedReportDownloadUrl ??
      defaults!.createSignedReportDownloadUrl,
  };
  const repository = {
    findClinicScopedReportById: dependencies.getClinicScopedReportById,
    listReportsByClinicId: dependencies.getReportsByClinicId,
    countReportsByClinicId: dependencies.countReportsByClinicId,
    searchReports: (
      clinicId: number,
      filters: {
        query?: string;
        studyType?: string;
        currentStatus?: ReportQueryStatus;
      },
      limit: number,
      offset: number,
    ) =>
      dependencies.searchReports(
        clinicId,
        filters.query,
        filters.studyType,
        limit,
        offset,
        filters.currentStatus,
      ),
    countSearchReports: (
      clinicId: number,
      filters: {
        query?: string;
        studyType?: string;
        currentStatus?: ReportQueryStatus;
      },
    ) =>
      dependencies.countSearchReports(
        clinicId,
        filters.query,
        filters.studyType,
        filters.currentStatus,
      ),
    getReportStatusHistory: dependencies.getReportStatusHistory,
    getStudyTypes: dependencies.getStudyTypes,
  };

  return {
    auth: resolveAuthDependencies(options, dependencies),
    queries: createReportQueryUseCases({
      repository,
      createSignedReportUrl: dependencies.createSignedReportUrl,
      createSignedReportDownloadUrl:
        dependencies.createSignedReportDownloadUrl,
      transitionReportStatus: async () => {
        throw new Error("report status transition unavailable");
      },
    }),
  };
}

export async function createClinicReportStatusRouteComposition(
  options: ClinicReportStatusRouteCompositionOptions,
) {
  const defaults = hasAllStatusDependencies(options)
    ? undefined
    : await loadDefaultStatusDependencies();
  const lookup =
    getInjectedClinicScopedLookup(options) ??
    defaults!.getClinicScopedReportById;
  const transitionReportStatus = options.updateReportStatus
    ? async (
        input: TransitionReportStatusInput,
        clinicScopedReport: ReportQueryRecord,
      ) =>
        createReportCommandUseCases<ReportQueryRecord>({
          findReportById: async () => clinicScopedReport,
          createOrEditReport: async () => {
            throw new Error("report create unavailable");
          },
          persistReportStatusTransition: (command) =>
            options.updateReportStatus!({
              reportId: command.reportId,
              toStatus: command.toStatus,
              note: command.note ?? null,
              changedByClinicUserId:
                command.changedByClinicUserId ?? null,
              changedByAdminUserId:
                command.changedByAdminUserId ?? null,
            }),
        }).transitionReportStatus(input)
    : defaults!.transitionReportStatus;
  const authDefaults = defaults ?? (options as StatusDependencies);
  const auth = resolveAuthDependencies(options, authDefaults);
  const writeAuditLog = options.writeAuditLog ?? defaults!.writeAuditLog;
  const unavailableRepository = {
    findClinicScopedReportById: lookup,
    listReportsByClinicId: async () => [],
    countReportsByClinicId: async () => 0,
    searchReports: async () => [],
    countSearchReports: async () => 0,
    getReportStatusHistory: async () => [],
    getStudyTypes: async () => [],
  };

  return {
    auth,
    writeAuditLog,
    queries: createReportQueryUseCases({
      repository: unavailableRepository,
      createSignedReportUrl: async () => "",
      createSignedReportDownloadUrl: async () => "",
      transitionReportStatus,
    }),
  };
}
